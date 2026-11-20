import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { bodyAt, conclude, fieldReason, itemsOf, prepareTenants, readSnapshots, restoring, runMultipart, statusCheck, unchanged, valueCheck, type Snapshots } from './common';

// US-MULTITENANT-PERMISOS-003: un token no escribe en otro tenant. Preparación de cada fila: la de la regla (perfil «completo» de
// alumno02). Cada fila toma una instantánea de los recursos de los dos tenants ANTES y DESPUÉS de la acción, y compara por API
// con el token de cada tenant: el tenant ajeno no debe cambiar en ninguna lista ni ficha citada.

interface Both {
  readonly a: Snapshots;
  readonly b: Snapshots;
}
interface Ctx {
  readonly before: Both;
  readonly after: Both;
  readonly result: ApiResult;
  readonly token01: string;
  readonly token02: string;
}

/** Rutas que se leen de alumno02 (el tenant ajeno) antes y después de cada acción. */
const PATHS_B: readonly string[] = [
  '/programs',
  '/programs/PRG-001',
  '/programs/PRG-025',
  '/programs/PRG-001/requirements',
  '/programs/PRG-025/milestones',
  '/requirements/REQ-041',
  '/nc',
  '/nc/NC-013',
  '/documents/DOC-001',
  '/documents/DOC-001/content',
  '/test-cases/TC-001',
  '/audit',
];

/** Rutas que se leen de alumno01 (el tenant del token) para las filas que comprueban su propio estado. */
const PATHS_A: readonly string[] = ['/programs/PRG-001/requirements', '/test-cases/TC-001', '/nc', '/audit?q=PRG-025'];

const takeBoth = async (token01: string, token02: string): Promise<Both> => ({
  a: await readSnapshots(TENANT_A, token01, PATHS_A),
  b: await readSnapshots(TENANT_B, token02, PATHS_B),
});

const sameAlumno02 = (ctx: Ctx): Check => unchanged(ctx.before.b, ctx.after.b, PATHS_B, 'las listas y fichas de alumno02');

// --- Operaciones del Esquema 1 (sobre recursos que solo existen en alumno02) -----------------------------------------------

interface Op {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: Record<string, unknown>;
}

const OPS_OTHER: ReadonlyMap<string, Op> = new Map<string, Op>([
  ['PATCH /api/programs/PRG-025 con {"description": "Descripción de otro tenant"}', { method: 'PATCH', path: '/programs/PRG-025', body: { description: 'Descripción de otro tenant' } }],
  ['DELETE /api/programs/PRG-025', { method: 'DELETE', path: '/programs/PRG-025' }],
  ['POST /api/programs/PRG-025/archive', { method: 'POST', path: '/programs/PRG-025/archive' }],
  ['PATCH /api/requirements/REQ-041 con {"priority": "high"}', { method: 'PATCH', path: '/requirements/REQ-041', body: { priority: 'high' } }],
  ['DELETE /api/requirements/REQ-041', { method: 'DELETE', path: '/requirements/REQ-041' }],
  ['PATCH /api/nc/NC-013 con {"severity": "major"}', { method: 'PATCH', path: '/nc/NC-013', body: { severity: 'major' } }],
  ['POST /api/nc/NC-013/comments con {"body": "Comentario de otro tenant"}', { method: 'POST', path: '/nc/NC-013/comments', body: { body: 'Comentario de otro tenant' } }],
  ['PATCH /api/milestones/PRG-025-M01 con {"name": "Hito de otro tenant"}', { method: 'PATCH', path: '/milestones/PRG-025-M01', body: { name: 'Hito de otro tenant' } }],
  ['DELETE /api/milestones/PRG-025-M01', { method: 'DELETE', path: '/milestones/PRG-025-M01' }],
  ['POST /api/programs/PRG-025/milestones con {"name": "Hito de otro tenant", "dueDate": "2026-07-01"}', { method: 'POST', path: '/programs/PRG-025/milestones', body: { name: 'Hito de otro tenant', dueDate: '2026-07-01' } }],
  ['POST /api/requirements/REQ-041/move con {"targetCode": "REQ-001", "placement": "after"}', { method: 'POST', path: '/requirements/REQ-041/move', body: { targetCode: 'REQ-001', placement: 'after' } }],
]);

/** Comprobaciones «Y» del Esquema 1: lo que la historia dice de alumno02 tras el intento. */
const OTHER_CHECKS: ReadonlyMap<string, (ctx: Ctx) => readonly Check[]> = new Map<string, (ctx: Ctx) => readonly Check[]>([
  [
    'el programa PRG-025 de alumno02 sigue con el nombre «Programa de aislamiento nuevo» y la descripción que tenía antes del intento',
    (ctx) => {
      // PRG-025 no está en el seed: su descripción es la que dejó el alta (vacía) y se compara con la leída antes del intento
      const now = bodyAt(ctx.after.b, '/programs/PRG-025');
      const before = field(bodyAt(ctx.before.b, '/programs/PRG-025'), 'description');
      return [
        check(field(now, 'name') === 'Programa de aislamiento nuevo', 'PRG-025 con el nombre «Programa de aislamiento nuevo»', `PRG-025 con el nombre «${String(field(now, 'name'))}»`),
        check(field(now, 'description') === before, 'la descripción de PRG-025 igual que antes del intento', `descripción «${String(field(now, 'description'))}» (antes «${String(before)}»)`),
      ];
    },
  ],
  ['el programa PRG-025 sigue existiendo en alumno02', (ctx) => [check(ctx.after.b['/programs/PRG-025']?.status === 200, 'PRG-025 existe en alumno02', `PRG-025 responde ${String(ctx.after.b['/programs/PRG-025']?.status)}`)]],
  ['el programa PRG-025 de alumno02 sigue en estado borrador', (ctx) => [check(field(bodyAt(ctx.after.b, '/programs/PRG-025'), 'status') === 'draft', 'PRG-025 en borrador', `PRG-025 en estado ${String(field(bodyAt(ctx.after.b, '/programs/PRG-025'), 'status'))}`)]],
  ['el requisito REQ-041 de alumno02 sigue con priority medium', (ctx) => [check(field(bodyAt(ctx.after.b, '/requirements/REQ-041'), 'priority') === 'medium', 'REQ-041 con priority medium', `REQ-041 con priority ${String(field(bodyAt(ctx.after.b, '/requirements/REQ-041'), 'priority'))}`)]],
  ['el requisito REQ-041 sigue existiendo en alumno02', (ctx) => [check(ctx.after.b['/requirements/REQ-041']?.status === 200, 'REQ-041 existe en alumno02', `REQ-041 responde ${String(ctx.after.b['/requirements/REQ-041']?.status)}`)]],
  ['la no conformidad NC-013 de alumno02 sigue con severity minor', (ctx) => [check(field(bodyAt(ctx.after.b, '/nc/NC-013'), 'severity') === 'minor', 'NC-013 con severity minor', `NC-013 con severity ${String(field(bodyAt(ctx.after.b, '/nc/NC-013'), 'severity'))}`)]],
  [
    'la no conformidad NC-013 de alumno02 no recibe ese comentario',
    (ctx) => {
      const comments = field(bodyAt(ctx.after.b, '/nc/NC-013'), 'comments');
      const list = Array.isArray(comments) ? (comments as Record<string, unknown>[]) : [];
      const received = list.some((comment) => comment.body === 'Comentario de otro tenant');
      return [check(!received, 'NC-013 sin el comentario ajeno', received ? 'NC-013 recibió el comentario ajeno' : 'NC-013 sin el comentario ajeno')];
    },
  ],
  [
    'el hito PRG-025-M01 de alumno02 sigue con el nombre «Hito solo de alumno02»',
    (ctx) => {
      const milestone = itemsOf(bodyAt(ctx.after.b, '/programs/PRG-025/milestones')).find((item) => item.id === 'PRG-025-M01');
      return [check(milestone?.name === 'Hito solo de alumno02', 'PRG-025-M01 con el nombre «Hito solo de alumno02»', `PRG-025-M01 con el nombre «${String(milestone?.name ?? '(ausente)')}»`)];
    },
  ],
  [
    'el hito PRG-025-M01 sigue existiendo en alumno02',
    (ctx) => {
      const ids = itemsOf(bodyAt(ctx.after.b, '/programs/PRG-025/milestones')).map((item) => String(item.id));
      return [check(ids.includes('PRG-025-M01'), 'PRG-025-M01 existe en alumno02', `hitos de PRG-025 en alumno02: ${ids.join(', ') || '(ninguno)'}`)];
    },
  ],
  ['PRG-025 de alumno02 sigue con un único hito', (ctx) => [check(itemsOf(bodyAt(ctx.after.b, '/programs/PRG-025/milestones')).length === 1, 'un único hito en PRG-025', `${itemsOf(bodyAt(ctx.after.b, '/programs/PRG-025/milestones')).length} hitos en PRG-025`)]],
  [
    'el orden de los requisitos de PRG-001 en alumno02 no cambia',
    (ctx) => [unchanged(ctx.before.b, ctx.after.b, ['/programs/PRG-001/requirements'], 'el orden de los requisitos de PRG-001 en alumno02')],
  ],
]);

/** Respuesta esperada del Esquema 1 (todas son errores de «no encontrado» del tenant del token). */
const ANOTHER_TENANT_RESPONSE = (text: string): ((result: ApiResult) => readonly Check[]) => {
  const response = parseResponse(text);
  return (result) => [responseCheck(result, response)];
};

const otherTenantWrite: ApiRowHandler = async (row) => {
  const op = strict('operación', OPS_OTHER, cell(row, 'operacion'));
  const expectResponse = ANOTHER_TENANT_RESPONSE(cell(row, 'respuesta'));
  const expectOther = strict('comprobación', OTHER_CHECKS, cell(row, 'comprobacion'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const before = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const result = await call(op.method, op.path, { tenant: TENANT_A, token: prepared.ok.token01, ...(op.body ? { body: op.body } : {}) });
  const after = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const ctx: Ctx = { before, after, result, token01: prepared.ok.token01, token02: prepared.ok.token02 };
  return conclude([...expectResponse(result), sameAlumno02(ctx), ...expectOther(ctx)], { evidence: { operacion: cell(row, 'operacion') } });
};

// --- Esquema 2: un código de otro tenant dentro del cuerpo no se resuelve ---------------------------------------------------

interface ForeignBody {
  readonly method: 'POST';
  readonly path: string;
  readonly body: Record<string, unknown>;
}

const OPS_FOREIGN_BODY: ReadonlyMap<string, ForeignBody> = new Map<string, ForeignBody>([
  ['POST /api/requirements con {"programCode": "PRG-025", "title": "Requisito de otro tenant"}', { method: 'POST', path: '/requirements', body: { programCode: 'PRG-025', title: 'Requisito de otro tenant' } }],
  ['POST /api/requirements/REQ-001/move con {"targetCode": "REQ-041", "placement": "after"}', { method: 'POST', path: '/requirements/REQ-001/move', body: { targetCode: 'REQ-041', placement: 'after' } }],
  ['POST /api/nc con {"programCode": "PRG-025", "severity": "minor", "description": "Desviación de otro tenant"}', { method: 'POST', path: '/nc', body: { programCode: 'PRG-025', severity: 'minor', description: 'Desviación de otro tenant' } }],
]);

/** Respuesta por campo esperada: estado, código y motivo del campo nombrado (o solo estado y código, para un 404). */
const FOREIGN_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['404 program_not_found', ANOTHER_TENANT_RESPONSE('404 program_not_found')],
  [
    '422 validation_failed con targetCode «badTarget»',
    (result) => [statusCheck(result, 422, 'validation_failed'), check(fieldReason(result, 'targetCode') === 'badTarget', 'targetCode «badTarget»', `targetCode «${String(fieldReason(result, 'targetCode') ?? '(sin motivo)')}»`)],
  ],
  [
    '422 validation_failed con programCode «programRequired»',
    (result) => [statusCheck(result, 422, 'validation_failed'), check(fieldReason(result, 'programCode') === 'programRequired', 'programCode «programRequired»', `programCode «${String(fieldReason(result, 'programCode') ?? '(sin motivo)')}»`)],
  ],
]);

const FOREIGN_CHECKS: ReadonlyMap<string, (ctx: Ctx) => Promise<readonly Check[]>> = new Map<string, (ctx: Ctx) => Promise<readonly Check[]>>([
  [
    'en alumno01 no aparece ningún requisito nuevo en PRG-001',
    async (ctx) => [unchanged(ctx.before.a, ctx.after.a, ['/programs/PRG-001/requirements'], 'los requisitos de PRG-001 en alumno01')],
  ],
  [
    'el orden de los hermanos de REQ-001 en alumno01 no cambia',
    async (ctx) => [unchanged(ctx.before.a, ctx.after.a, ['/programs/PRG-001/requirements'], 'el orden de los hermanos de REQ-001 en alumno01')],
  ],
  [
    'GET /api/nc/NC-013 con el mismo token responde 404 nc_not_found',
    async (ctx) => {
      const probe = await call('GET', '/nc/NC-013', { tenant: TENANT_A, token: ctx.token01 });
      // Además, la lista de no conformidades de alumno01 no gana NC-013 ni ninguna otra con ese código (antes y después)
      return [responseCheck(probe, parseResponse('404 nc_not_found')), unchanged(ctx.before.a, ctx.after.a, ['/nc'], 'la lista de no conformidades de alumno01')];
    },
  ],
]);

const foreignBodyCode: ApiRowHandler = async (row) => {
  const op = strict('operación', OPS_FOREIGN_BODY, cell(row, 'operacion'));
  const expectResponse = strict('respuesta', FOREIGN_RESPONSES, cell(row, 'respuesta'));
  const expectOther = strict('comprobación', FOREIGN_CHECKS, cell(row, 'comprobacion'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const before = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const result = await call(op.method, op.path, { tenant: TENANT_A, token: prepared.ok.token01, body: op.body });
  const after = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const ctx: Ctx = { before, after, result, token01: prepared.ok.token01, token02: prepared.ok.token02 };
  return conclude([...expectResponse(result), ...(await expectOther(ctx)), sameAlumno02(ctx)], { evidence: { operacion: cell(row, 'operacion') } });
};

// --- Esquema 3: una escritura en el propio tenant solo cambia el propio tenant ----------------------------------------------

const OWN_OPS: ReadonlyMap<string, (token: string) => Promise<ApiResult>> = new Map<string, (token: string) => Promise<ApiResult>>([
  [
    'POST /api/programs con {"name": "Programa de otro tenant", "ownerId": "u1", "startDate": "2026-03-01", "endDate": "2026-12-31", "budget": 150000}',
    (token) => call('POST', '/programs', { tenant: TENANT_A, token, body: { name: 'Programa de otro tenant', ownerId: 'u1', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 } }),
  ],
  ['PATCH /api/programs/PRG-001 con {"name": "Programa solo de alumno01"}', (token) => call('PATCH', '/programs/PRG-001', { tenant: TENANT_A, token, body: { name: 'Programa solo de alumno01' } })],
  [
    'POST /api/documents/DOC-001/versions con {"lines": ["Versión solo de alumno01"]}',
    (token) => call('POST', '/documents/DOC-001/versions', { tenant: TENANT_A, token, body: { lines: ['Versión solo de alumno01'] } }),
  ],
  ['POST /api/test-cases/TC-001/runs con el resultado pass', (token) => runMultipart(TENANT_A, token, 'TC-001')],
]);

const OWN_RESPONSES: ReadonlyMap<string, (result: ApiResult, ctx: Ctx) => readonly Check[]> = new Map<string, (result: ApiResult, ctx: Ctx) => readonly Check[]>([
  ['201 con el código PRG-025', (result) => [statusCheck(result, 201), valueCheck(result, 'code', 'PRG-025', 'código')]],
  ['200 con el nombre «Programa solo de alumno01»', (result) => [statusCheck(result, 200), valueCheck(result, 'name', 'Programa solo de alumno01', 'nombre')]],
  ['201 con la versión 4', (result) => [statusCheck(result, 201), valueCheck(result, 'version', 4, 'versión')]],
  [
    '201 con una ejecución nueva',
    (result, ctx) => {
      const before = itemsOf({ items: field(bodyAt(ctx.before.a, '/test-cases/TC-001'), 'runs') });
      const beforeIds = before.map((run) => String(run.id));
      const id = field(result.body, 'id');
      return [statusCheck(result, 201), check(typeof id === 'string' && !beforeIds.includes(id), 'una ejecución nueva', `ejecución ${String(id)} ${typeof id === 'string' && !beforeIds.includes(id) ? 'nueva' : 'no es nueva'}`)];
    },
  ],
]);

const OWN_CHECKS: ReadonlyMap<string, (ctx: Ctx) => readonly Check[]> = new Map<string, (ctx: Ctx) => readonly Check[]>([
  [
    'en alumno02, PRG-025 sigue con el nombre «Programa de aislamiento nuevo» y el listado de alumno02 sigue con 25 programas',
    (ctx) => [
      check(field(bodyAt(ctx.after.b, '/programs/PRG-025'), 'name') === 'Programa de aislamiento nuevo', 'PRG-025 de alumno02 con el nombre «Programa de aislamiento nuevo»', `PRG-025 de alumno02 con el nombre «${String(field(bodyAt(ctx.after.b, '/programs/PRG-025'), 'name'))}»`),
      check(field(bodyAt(ctx.after.b, '/programs'), 'total') === 25, 'el listado de alumno02 con 25 programas', `el listado de alumno02 con ${String(field(bodyAt(ctx.after.b, '/programs'), 'total'))} programas`),
      sameAlumno02(ctx),
    ],
  ],
  [
    'en alumno02, PRG-001 sigue con el nombre «Programa de aislamiento»',
    (ctx) => [
      check(field(bodyAt(ctx.after.b, '/programs/PRG-001'), 'name') === 'Programa de aislamiento', 'PRG-001 de alumno02 con el nombre «Programa de aislamiento»', `PRG-001 de alumno02 con el nombre «${String(field(bodyAt(ctx.after.b, '/programs/PRG-001'), 'name'))}»`),
      sameAlumno02(ctx),
    ],
  ],
  [
    'en alumno02, DOC-001 sigue con su versión 4, «Versión solo de alumno02»',
    (ctx) => {
      const content = bodyAt(ctx.after.b, '/documents/DOC-001/content');
      const pages = field(content, 'pages');
      const lines = Array.isArray(pages) ? (pages as unknown[]).flatMap((page) => (Array.isArray(page) ? (page as unknown[]) : [])) : [];
      return [
        check(field(bodyAt(ctx.after.b, '/documents/DOC-001'), 'version') === 4, 'DOC-001 de alumno02 en la versión 4', `DOC-001 de alumno02 en la versión ${String(field(bodyAt(ctx.after.b, '/documents/DOC-001'), 'version'))}`),
        check(lines.includes('Versión solo de alumno02'), 'la línea «Versión solo de alumno02»', lines.includes('Versión solo de alumno02') ? 'la línea «Versión solo de alumno02»' : 'sin la línea «Versión solo de alumno02»'),
        sameAlumno02(ctx),
      ];
    },
  ],
  [
    'la ficha de TC-001 de alumno02 no incluye la ejecución de alumno01',
    (ctx) => {
      // Los ids de ejecución se repiten entre tenants (RUN-051 en ambos): la ejecución de alumno01 se identifica por id Y fecha
      const newId = field(ctx.result.body, 'id');
      const newAt = field(ctx.result.body, 'executedAt');
      const runs = itemsOf({ items: field(bodyAt(ctx.after.b, '/test-cases/TC-001'), 'runs') });
      const includes = runs.some((run) => run.id === newId && run.executedAt === newAt);
      return [
        check(!includes, 'la ficha de alumno02 sin la ejecución de alumno01', includes ? 'incluye la ejecución de alumno01' : 'sin la ejecución de alumno01'),
        unchanged(ctx.before.b, ctx.after.b, ['/test-cases/TC-001'], 'la ficha de TC-001 de alumno02'),
      ];
    },
  ],
]);

const ownTenantWrite: ApiRowHandler = async (row) => {
  const op = strict('operación', OWN_OPS, cell(row, 'operacion'));
  const expectResponse = strict('respuesta', OWN_RESPONSES, cell(row, 'respuesta'));
  const expectOther = strict('comprobación', OWN_CHECKS, cell(row, 'comprobacion'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const before = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const result = await op(prepared.ok.token01);
  const after = await takeBoth(prepared.ok.token01, prepared.ok.token02);
  const ctx: Ctx = { before, after, result, token01: prepared.ok.token01, token02: prepared.ok.token02 };
  return conclude([...expectResponse(result, ctx), ...expectOther(ctx)], { evidence: { operacion: cell(row, 'operacion') } });
};

// --- Esquema 4: el registro de auditoría de un tenant no recoge las escrituras del otro -------------------------------------

const auditCount = async (tenant: string, token: string, code: string): Promise<ApiResult> => call('GET', `/audit?q=${code}`, { tenant, token });

const auditSplit: ApiRowHandler = async (row) => {
  const codigo = cell(row, 'codigo');
  const totalA = Number(cell(row, 'total_alumno01'));
  const totalB = Number(cell(row, 'total_alumno02'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(`201 con el código ${codigo}`, prepared.failed.step, prepared.failed.result);
  const created = await call('POST', '/programs', {
    tenant: TENANT_A,
    token: prepared.ok.token01,
    body: { name: 'Programa de otro tenant', ownerId: 'u1', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 },
  });
  const inA = await auditCount(TENANT_A, prepared.ok.token01, codigo);
  const inB = await auditCount(TENANT_B, prepared.ok.token02, codigo);
  return conclude([
    statusCheck(created, 201),
    valueCheck(created, 'code', codigo, 'código'),
    statusCheck(inA, 200),
    valueCheck(inA, 'total', totalA, `total en alumno01 para ${codigo}`),
    statusCheck(inB, 200),
    valueCheck(inB, 'total', totalB, `total en alumno02 para ${codigo}`),
  ]);
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoring(otherTenantWrite)],
    [2, restoring(foreignBodyCode)],
    [3, restoring(ownTenantWrite)],
    [4, restoring(auditSplit)],
  ]),
});
