import { expect, test, type APIRequestContext } from '@playwright/test';
import { API_URL, loginByApi, resetTenant, type RoleName } from '../support/auth';

// Pruebas de API de No conformidades con `request` (sin UI): lista y filtros, detalle, validación 422, permisos por rol,
// máquina de estados (409), cierre con comentario de ≥ 20 caracteres, comentarios, aislamiento por tenant y auditoría.
// Tenant propio: alumno02 (alumno03 solo se lee, para el aislamiento). Evita a propósito los caminos de los defectos
// plantados (cierre con 19 caracteres y open → rejected).

const TENANT = 'alumno02';
const OTHER_TENANT = 'alumno03';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
  await resetTenant(request, OTHER_TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Nc {
  code: string;
  programCode: string;
  programName: string;
  severity: string;
  description: string;
  state: string;
  assigneeId: string | null;
  assigneeName: string | null;
  testRunId: string | null;
  commentCount: number;
  createdAt: string;
}
interface NcComment {
  id: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  kind: string;
  createdAt: string;
}
interface NcDetail extends Nc {
  comments: NcComment[];
  transitions: string[];
}
interface ApiBody {
  code?: string;
  errors?: Record<string, string>;
}

const tokens = new Map<string, string>();
const call = async (request: APIRequestContext, role: RoleName, method: 'get' | 'post' | 'patch' | 'put' | 'delete', path: string, data?: unknown, tenant = TENANT) => {
  const key = `${tenant}|${role}`;
  if (!tokens.has(key)) tokens.set(key, (await loginByApi(request, role, tenant)).accessToken);
  return request[method](`${API_URL}${path}`, { headers: { Authorization: `Bearer ${tokens.get(key)}`, 'x-tenant': tenant }, data });
};
const list = async (request: APIRequestContext, query = '', tenant = TENANT) => ((await (await call(request, 'admin', 'get', `/nc${query}`, undefined, tenant)).json()) as { items: Nc[]; total: number; totalAll: number });
const detail = async (request: APIRequestContext, code: string, tenant = TENANT) => (await (await call(request, 'admin', 'get', `/nc/${code}`, undefined, tenant)).json()) as NcDetail;
const codes = (items: readonly Nc[]) => items.map((item) => item.code);
const longComment = (n = 30) => `Acción correctiva comprobada ${'x'.repeat(n)}`;

test('GET /nc devuelve las 12 NC del seed con programa, asignado y nº de comentarios; exige sesión', async ({ request }) => {
  const body = await list(request);
  expect(body.total).toBe(12);
  expect(body.totalAll).toBe(12);
  expect(codes(body.items)).toEqual(Array.from({ length: 12 }, (_, i) => `NC-${String(i + 1).padStart(3, '0')}`));
  expect(body.items.find((nc) => nc.code === 'NC-003')).toMatchObject({
    programCode: 'PRG-001',
    severity: 'critical',
    state: 'corrective_action',
    assigneeId: 'u4',
    assigneeName: 'Andrés Molina',
    commentCount: 3,
  });
  expect(body.items.find((nc) => nc.code === 'NC-005')).toMatchObject({ assigneeId: null, assigneeName: null, state: 'rejected' });
  expect(Number.isNaN(Date.parse(body.items[0]?.createdAt ?? ''))).toBe(false);

  const anonymous = await request.get(`${API_URL}/nc`, { headers: { 'x-tenant': TENANT } });
  expect(anonymous.status()).toBe(401);
});

test('filtros: asignado (id o none), severidad, programa y texto; los valores inválidos se ignoran', async ({ request }) => {
  expect(codes((await list(request, '?assignee=none')).items)).toEqual(['NC-005', 'NC-010']);
  expect(codes((await list(request, '?assignee=u4')).items)).toEqual(['NC-003', 'NC-007', 'NC-011']);
  expect(codes((await list(request, '?severity=critical')).items)).toEqual(['NC-003', 'NC-006', 'NC-009', 'NC-012']);
  expect(codes((await list(request, '?program=PRG-002')).items)).toEqual(['NC-005', 'NC-006', 'NC-007', 'NC-008']);
  expect(codes((await list(request, '?q=ejecución 007')).items)).toEqual(['NC-007']);
  expect(codes((await list(request, '?q=nc-01')).items)).toEqual(['NC-010', 'NC-011', 'NC-012']);

  const combined = await list(request, '?severity=critical&program=PRG-003&assignee=u1');
  expect(codes(combined.items)).toEqual(['NC-012']);
  expect(combined.total).toBe(1);
  expect(combined.totalAll).toBe(12);

  expect((await list(request, '?severity=enorme')).total).toBe(12);
});

test('GET /nc/:code devuelve el detalle con sus comentarios (más antiguo primero) y los estados siguientes', async ({ request }) => {
  const nc = await detail(request, 'NC-003');
  expect(nc.comments).toHaveLength(3);
  expect(nc.commentCount).toBe(3);
  const times = nc.comments.map((comment) => Date.parse(comment.createdAt));
  expect(times).toEqual([...times].sort((a, b) => a - b));
  expect(nc.comments[0]).toMatchObject({ authorName: 'Carmen Vidal', kind: 'comment' });
  expect(nc.comments.map((comment) => comment.kind)).toContain('quick');
  expect(nc.transitions).toEqual(['closed', 'in_analysis']);
  expect((await detail(request, 'NC-004')).transitions).toEqual([]);
  expect((await detail(request, 'NC-005')).transitions).toEqual(['open']);
  expect((await call(request, 'admin', 'get', '/nc/NC-999')).status()).toBe(404);
});

test('POST /nc: 422 por campo (descripción corta, severidad, programa o asignado inexistentes) y alta válida de cualquier rol', async ({ request }) => {
  const short = await call(request, 'admin', 'post', '/nc', { programCode: 'PRG-001', severity: 'major', description: 'corta' });
  expect(short.status()).toBe(422);
  expect(((await short.json()) as ApiBody).errors).toEqual({ description: 'descShort' });

  const badSeverity = await call(request, 'admin', 'post', '/nc', { programCode: 'PRG-001', severity: 'enorme', description: 'Descripción suficiente' });
  expect(badSeverity.status()).toBe(422);
  expect(((await badSeverity.json()) as ApiBody).errors).toEqual({ severity: 'severityRequired' });

  const noProgram = await call(request, 'admin', 'post', '/nc', { programCode: 'PRG-999', severity: 'major', description: 'Descripción suficiente' });
  expect(noProgram.status()).toBe(422);
  expect(((await noProgram.json()) as ApiBody).errors).toEqual({ programCode: 'programRequired' });

  const noUser = await call(request, 'admin', 'post', '/nc', { programCode: 'PRG-001', severity: 'major', description: 'Descripción suficiente', assigneeId: 'u99' });
  expect(noUser.status()).toBe(422);
  expect(((await noUser.json()) as ApiBody).errors).toEqual({ assigneeId: 'badAssignee' });

  // El auditor también puede abrir NC; la descripción se sanea (lista blanca) y entra en «Abierta»
  const created = await call(request, 'auditor', 'post', '/nc', {
    programCode: 'PRG-002',
    severity: 'critical',
    description: '<p>Desviación en el <b>enlace</b> de datos</p><script>alert(1)</script><img src=x onerror=alert(2)>',
  });
  expect(created.status()).toBe(201);
  const nc = (await created.json()) as Nc;
  expect(nc).toMatchObject({ code: 'NC-013', state: 'open', severity: 'critical', programCode: 'PRG-002', assigneeId: null, commentCount: 0 });
  expect(nc.description).toContain('<strong>enlace</strong>');
  expect(nc.description).not.toContain('<script');
  expect(nc.description).not.toContain('onerror');
  expect(nc.description).not.toContain('<img');
  expect((await list(request)).total).toBe(13);
});

test('PATCH /nc/:code: permisos, campos editables, asignación con null y 422', async ({ request }) => {
  expect((await call(request, 'auditor', 'patch', '/nc/NC-002', { severity: 'minor' })).status()).toBe(403);

  const empty = await call(request, 'consultant', 'patch', '/nc/NC-002', {});
  expect(empty.status()).toBe(422);
  expect(((await empty.json()) as ApiBody).errors).toEqual({ '': 'nothingToUpdate' });

  const severity = await call(request, 'consultant', 'patch', '/nc/NC-002', { severity: 'critical' });
  expect(severity.status()).toBe(200);
  expect(((await severity.json()) as NcDetail).severity).toBe('critical');

  const unassign = await call(request, 'program_manager', 'patch', '/nc/NC-002', { assigneeId: null });
  expect(((await unassign.json()) as NcDetail).assigneeName).toBeNull();
  const assign = await call(request, 'program_manager', 'patch', '/nc/NC-002', { assigneeId: 'u2' });
  expect(((await assign.json()) as NcDetail).assigneeName).toBe('Javier Ortega');

  const unknownUser = await call(request, 'admin', 'patch', '/nc/NC-002', { assigneeId: 'u99' });
  expect(unknownUser.status()).toBe(422);
  expect(((await unknownUser.json()) as ApiBody).errors).toEqual({ assigneeId: 'badAssignee' });

  const description = await call(request, 'admin', 'patch', '/nc/NC-002', { description: '<p>Nueva descripción con <i>cursiva</i><script>x</script></p>' });
  const edited = (await description.json()) as NcDetail;
  expect(edited.description).toContain('<em>cursiva</em>');
  expect(edited.description).not.toContain('<script');
  expect((await call(request, 'admin', 'patch', '/nc/NC-999', { severity: 'minor' })).status()).toBe(404);

  // Persistido
  expect(await detail(request, 'NC-002')).toMatchObject({ severity: 'critical', assigneeId: 'u2' });
});

test('POST /nc/:code/transition: 403 por rol, 409 si el paso no existe, 422 si el estado no es válido y la cadena completa', async ({ request }) => {
  const body = (to: string, comment?: string) => ({ to, ...(comment ? { comment } : {}) });
  const as = async (role: RoleName, code: string, to: string, comment?: string) => call(request, role, 'post', `/nc/${code}/transition`, body(to, comment));

  // 403: el auditor no mueve nada y el consultor no cierra
  const audit = await as('auditor', 'NC-001', 'in_analysis');
  expect(audit.status()).toBe(403);
  expect(((await audit.json()) as ApiBody).code).toBe('forbidden');
  expect((await as('consultant', 'NC-009', 'closed', longComment())).status()).toBe(403);

  // 409: saltarse pasos, repetir el estado, salir de un estado terminal
  for (const [role, code, to] of [
    ['program_manager', 'NC-001', 'closed'],
    ['consultant', 'NC-001', 'corrective_action'],
    ['consultant', 'NC-001', 'open'],
    ['program_manager', 'NC-004', 'open'],
  ] as const) {
    const response = await as(role, code, to, longComment());
    expect(response.status(), `${code} → ${to}`).toBe(409);
    expect(((await response.json()) as ApiBody).code).toBe('invalid_transition');
  }

  // 422: estado desconocido
  const badState = await as('admin', 'NC-001', 'cerrada');
  expect(badState.status()).toBe(422);
  expect(((await badState.json()) as ApiBody).errors).toEqual({ to: 'badState' });
  expect((await as('admin', 'NC-999', 'in_analysis')).status()).toBe(404);

  // Los intentos rechazados no cambian nada
  expect((await detail(request, 'NC-001')).state).toBe('open');

  // Cadena válida: open → in_analysis → corrective_action (cada respuesta trae sus siguientes pasos)
  const analysis = await as('consultant', 'NC-001', 'in_analysis');
  expect(analysis.status()).toBe(200);
  expect(await analysis.json()).toMatchObject({ state: 'in_analysis', transitions: ['corrective_action', 'rejected', 'open'] });
  const corrective = await as('consultant', 'NC-001', 'corrective_action');
  expect(((await corrective.json()) as NcDetail).state).toBe('corrective_action');
  // in_analysis → rejected → open (reabrir un rechazo)
  expect((await as('consultant', 'NC-006', 'in_analysis')).status()).toBe(200);
  expect(((await (await as('consultant', 'NC-006', 'rejected')).json()) as NcDetail).state).toBe('rejected');
  expect(((await (await as('program_manager', 'NC-006', 'open')).json()) as NcDetail).state).toBe('open');
});

test('cerrar: exige comentario (422), de al menos 20 caracteres (422) y deja un comentario de tipo closure', async ({ request }) => {
  const close = (comment?: string) => call(request, 'program_manager', 'post', '/nc/NC-003/transition', { to: 'closed', ...(comment === undefined ? {} : { comment }) });

  const missing = await close();
  expect(missing.status()).toBe(422);
  expect(((await missing.json()) as ApiBody).errors).toEqual({ comment: 'closureRequired' });
  expect(((await (await close('   ')).json()) as ApiBody).errors).toEqual({ comment: 'closureRequired' });

  const short = await close('corto');
  expect(short.status()).toBe(422);
  expect(((await short.json()) as ApiBody).errors).toEqual({ comment: 'closureShort' });
  expect((await detail(request, 'NC-003')).state).toBe('corrective_action');

  const comment = '  Verificada en banco de pruebas y aceptada por el cliente  ';
  const closed = await close(comment);
  expect(closed.status()).toBe(200);
  const nc = (await closed.json()) as NcDetail;
  expect(nc.state).toBe('closed');
  expect(nc.transitions).toEqual([]);
  expect(nc.commentCount).toBe(4);
  const closure = nc.comments.filter((item) => item.kind === 'closure');
  expect(closure).toHaveLength(1);
  expect(closure[0]).toMatchObject({ body: comment.trim(), authorName: 'Javier Ortega' });

  // Cerrada es terminal
  const reopen = await call(request, 'admin', 'post', '/nc/NC-003/transition', { to: 'in_analysis' });
  expect(reopen.status()).toBe(409);
});

test('POST /nc/:code/comments: comentario normal y rápido (cualquier rol), 422 por contenido y 404', async ({ request }) => {
  const normal = await call(request, 'auditor', 'post', '/nc/NC-008/comments', { body: '  Revisado por auditoría  ' });
  expect(normal.status()).toBe(201);
  expect(await normal.json()).toMatchObject({ body: 'Revisado por auditoría', kind: 'comment', authorName: 'Andrés Molina' });

  const quick = await call(request, 'consultant', 'post', '/nc/NC-008/comments', { body: 'Seguimiento rápido', kind: 'quick' });
  expect(quick.status()).toBe(201);
  expect(((await quick.json()) as NcComment).kind).toBe('quick');

  const empty = await call(request, 'admin', 'post', '/nc/NC-008/comments', { body: '   ' });
  expect(empty.status()).toBe(422);
  expect(((await empty.json()) as ApiBody).errors).toEqual({ body: 'commentRequired' });
  const long = await call(request, 'admin', 'post', '/nc/NC-008/comments', { body: 'x'.repeat(1001) });
  expect(((await long.json()) as ApiBody).errors).toEqual({ body: 'commentLong' });
  const closureKind = await call(request, 'admin', 'post', '/nc/NC-008/comments', { body: 'intento de cierre', kind: 'closure' });
  expect(closureKind.status()).toBe(422);
  expect((await call(request, 'admin', 'post', '/nc/NC-999/comments', { body: 'hola' })).status()).toBe(404);

  const nc = await detail(request, 'NC-008');
  expect(nc.comments.map((comment) => comment.body)).toEqual(['Revisado por auditoría', 'Seguimiento rápido']);
  expect(nc.commentCount).toBe(2);
  expect((await list(request, '?q=NC-008')).items[0]?.commentCount).toBe(2);
});

test('aislamiento: cada tenant ve solo sus NC y el JWT manda sobre la cabecera x-tenant', async ({ request }) => {
  // alumno03 no ha cambiado: sigue con el seed
  const other = await list(request, '', OTHER_TENANT);
  expect(other.total).toBe(12);
  expect(other.items.find((nc) => nc.code === 'NC-003')).toMatchObject({ state: 'corrective_action', commentCount: 3 });
  expect((await call(request, 'admin', 'get', '/nc/NC-013', undefined, OTHER_TENANT)).status()).toBe(404);
  expect((await detail(request, 'NC-008', OTHER_TENANT)).comments).toHaveLength(0);

  // Con el token de alumno02, la cabecera x-tenant de otro tenant no cambia lo que se ve
  const token = tokens.get(`${TENANT}|admin`);
  const spoofed = await request.get(`${API_URL}/nc/NC-013`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant': OTHER_TENANT } });
  expect(spoofed.status()).toBe(200);
});

test('auditoría: cada mutación válida deja su evento nc.* y las rechazadas (403, 409, 422) no dejan ninguno', async ({ request }) => {
  const events = async () => {
    const response = await call(request, 'admin', 'get', '/audit?entity=nc&limit=100');
    return (await response.json()) as { total: number; items: { action: string; entity: string; entityId: string; actorName: string | null; diff: Record<string, unknown> | null }[] };
  };
  const before = await events();
  // 1 alta + 5 cambios de estado válidos (NC-001 ×2, NC-006 ×3) + 1 cierre + 1 edición de severidad… (ver tests anteriores)
  const actions = before.items.map((item) => item.action);
  expect(actions).toEqual(expect.arrayContaining(['nc.created', 'nc.updated', 'nc.state_changed', 'nc.commented']));
  expect(before.items.every((item) => item.entity === 'nc')).toBe(true);
  expect(before.items.find((item) => item.action === 'nc.created')).toMatchObject({ entityId: 'NC-013', actorName: 'Andrés Molina' });
  expect(before.items.find((item) => item.action === 'nc.state_changed' && item.entityId === 'NC-003')).toMatchObject({ actorName: 'Javier Ortega', diff: { from: 'corrective_action', to: 'closed' } });

  // Rechazadas: 403 por rol, 409 por paso inexistente y 422 por validación
  expect((await call(request, 'auditor', 'post', '/nc/NC-007/transition', { to: 'in_analysis' })).status()).toBe(403);
  expect((await call(request, 'admin', 'post', '/nc/NC-007/transition', { to: 'closed', comment: longComment() })).status()).toBe(409);
  expect((await call(request, 'admin', 'post', '/nc/NC-007/comments', { body: '' })).status()).toBe(422);
  expect((await events()).total).toBe(before.total);

  // Una válida suma exactamente un evento, y es el más reciente
  expect((await call(request, 'consultant', 'post', '/nc/NC-007/comments', { body: 'Nuevo comentario' })).status()).toBe(201);
  const after = await events();
  expect(after.total).toBe(before.total + 1);
  expect(after.items[0]).toMatchObject({ action: 'nc.commented', entityId: 'NC-007', actorName: 'Lucía Fernández' });
});
