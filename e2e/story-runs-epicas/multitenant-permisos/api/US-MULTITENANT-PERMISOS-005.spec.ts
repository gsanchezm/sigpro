import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { check, cell, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ROLE_ACCOUNTS, accessOf, adminOf, conclude, isFailed, runMultipart } from './common';

// US-MULTITENANT-PERMISOS-005: la matriz de permisos por rol en la API. Preparación de cada fila: alumno01 se reinicia con el token de su
// administrador (alumno01@sigpro.lab) y la cuenta del rol de la fila inicia sesión con x-tenant alumno01. Cada operación usa la petición
// mínima de la regla «Operaciones de la matriz». Persistencia comprobada por API: antes y después de cada petición se lee, con el token
// de administrador, el recurso que la operación toca (su «sonda»). Si la operación responde 2xx y escribe, se comprueba su efecto; en
// cualquier otro caso (401, 403, lectura) el recurso no debe cambiar.

interface Probe {
  readonly status: number;
  readonly body: unknown;
}

type Send = (token: string | undefined) => Promise<ApiResult>;

interface Op {
  readonly send: Send;
  /** POST, PATCH o DELETE: su efecto se comprueba si responde 2xx. Una lectura no escribe. */
  readonly write: boolean;
  /** Ruta del recurso afectado, leída con el token de administrador antes y después. */
  readonly probe: string;
  /** Lo que debe verse en la sonda tras una escritura correcta. */
  readonly effect?: { readonly text: string; readonly holds: (before: Probe, after: Probe) => boolean };
}

/** Petición a alumno01 con el token que se le pase (sin token, cuando es `undefined`). */
const api =
  (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: Record<string, unknown>): Send =>
  (token) =>
    call(method, path, { tenant: TENANT_A, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

const itemsOf = (body: unknown): readonly unknown[] => {
  const list = Array.isArray(body) ? body : field(body, 'items');
  return Array.isArray(list) ? list : [];
};
const totalOf = (probe: Probe): number => Number(field(probe.body, 'total'));
const countOf = (probe: Probe, key: string): number => {
  const value = field(probe.body, key);
  return Array.isArray(value) ? value.length : -1;
};
const hasMilestone = (probe: Probe, id: string, name?: string): boolean =>
  itemsOf(probe.body).some((item) => field(item, 'id') === id && (name === undefined || field(item, 'name') === name));

const OPERATIONS: ReadonlyMap<string, Op> = new Map<string, Op>([
  // Programas
  [
    'crear programa',
    {
      send: api('POST', '/programs', { name: 'Programa de permisos', ownerId: 'u1', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 }),
      write: true,
      probe: '/programs',
      effect: { text: 'el listado tiene un programa más', holds: (before, after) => totalOf(after) === totalOf(before) + 1 },
    },
  ],
  [
    'editar programa',
    {
      send: api('PATCH', '/programs/PRG-001', { description: 'Descripción de prueba de permisos' }),
      write: true,
      probe: '/programs/PRG-001',
      effect: { text: 'PRG-001 tiene la descripción de prueba', holds: (_before, after) => field(after.body, 'description') === 'Descripción de prueba de permisos' },
    },
  ],
  [
    'archivar programa',
    {
      send: api('POST', '/programs/PRG-001/archive'),
      write: true,
      probe: '/programs/PRG-001',
      effect: { text: 'PRG-001 queda cerrado (archivado)', holds: (_before, after) => field(after.body, 'status') === 'closed' },
    },
  ],
  [
    'eliminar programa',
    {
      send: api('DELETE', '/programs/PRG-024'),
      write: true,
      probe: '/programs/PRG-024',
      effect: { text: 'PRG-024 deja de existir', holds: (_before, after) => after.status === 404 },
    },
  ],
  ['exportar programas', { send: api('GET', '/programs/export'), write: false, probe: '/programs' }],
  // Requisitos
  [
    'crear requisito',
    {
      send: api('POST', '/requirements', { programCode: 'PRG-001', title: 'Requisito de permisos' }),
      write: true,
      probe: '/programs/PRG-001/requirements',
      effect: { text: 'PRG-001 tiene un requisito más', holds: (before, after) => countOf(after, 'items') === countOf(before, 'items') + 1 },
    },
  ],
  [
    'editar requisito',
    {
      send: api('PATCH', '/requirements/REQ-001', { priority: 'high' }),
      write: true,
      probe: '/requirements/REQ-001',
      effect: { text: 'REQ-001 tiene prioridad high', holds: (_before, after) => field(after.body, 'priority') === 'high' },
    },
  ],
  [
    'eliminar requisito',
    {
      send: api('DELETE', '/requirements/REQ-040'),
      write: true,
      probe: '/requirements/REQ-040',
      effect: { text: 'REQ-040 deja de existir', holds: (_before, after) => after.status === 404 },
    },
  ],
  [
    'aprobar requisito',
    {
      send: api('POST', '/requirements/REQ-017/transition', { to: 'approved' }),
      write: true,
      probe: '/requirements/REQ-017',
      effect: { text: 'REQ-017 queda aprobado', holds: (_before, after) => field(after.body, 'state') === 'approved' },
    },
  ],
  [
    'verificar requisito',
    {
      send: api('POST', '/requirements/REQ-001/transition', { to: 'verified' }),
      write: true,
      probe: '/requirements/REQ-001',
      effect: { text: 'REQ-001 queda verificado', holds: (_before, after) => field(after.body, 'state') === 'verified' },
    },
  ],
  [
    'validar requisito',
    {
      send: api('POST', '/requirements/REQ-002/transition', { to: 'validated' }),
      write: true,
      probe: '/requirements/REQ-002',
      effect: { text: 'REQ-002 queda validado', holds: (_before, after) => field(after.body, 'state') === 'validated' },
    },
  ],
  // Ejecuciones de pruebas (multipart con el resultado, sin archivos)
  [
    'ejecutar caso',
    {
      send: (token) => runMultipart(TENANT_A, token, 'TC-001'),
      write: true,
      probe: '/test-cases/TC-001',
      effect: { text: 'TC-001 tiene una ejecución más', holds: (before, after) => countOf(after, 'runs') === countOf(before, 'runs') + 1 },
    },
  ],
  // Documentos
  ['ver documento restringido', { send: api('GET', '/documents/DOC-003'), write: false, probe: '/documents/DOC-003' }],
  [
    'publicar versión',
    {
      send: api('POST', '/documents/DOC-001/versions', { lines: ['Línea de permisos'] }),
      write: true,
      probe: '/documents/DOC-001',
      effect: { text: 'DOC-001 queda en la versión 4', holds: (_before, after) => field(after.body, 'version') === 4 },
    },
  ],
  // Auditoría y usuarios
  ['ver auditoría', { send: api('GET', '/audit'), write: false, probe: '/audit' }],
  ['listar usuarios', { send: api('GET', '/admin/users'), write: false, probe: '/admin/users' }],
  // No conformidades
  [
    'abrir no conformidad',
    {
      send: api('POST', '/nc', { programCode: 'PRG-001', severity: 'minor', description: 'Desviación de prueba de permisos' }),
      write: true,
      probe: '/nc',
      effect: { text: 'el tablero tiene una no conformidad más', holds: (before, after) => totalOf(after) === totalOf(before) + 1 },
    },
  ],
  [
    'comentar no conformidad',
    {
      send: api('POST', '/nc/NC-001/comments', { body: 'Comentario de prueba de permisos' }),
      write: true,
      probe: '/nc/NC-001',
      effect: { text: 'NC-001 tiene un comentario más', holds: (before, after) => countOf(after, 'comments') === countOf(before, 'comments') + 1 },
    },
  ],
  [
    'editar no conformidad',
    {
      send: api('PATCH', '/nc/NC-001', { severity: 'major' }),
      write: true,
      probe: '/nc/NC-001',
      effect: { text: 'NC-001 tiene gravedad major', holds: (_before, after) => field(after.body, 'severity') === 'major' },
    },
  ],
  [
    'mover no conformidad',
    {
      send: api('POST', '/nc/NC-001/transition', { to: 'in_analysis' }),
      write: true,
      probe: '/nc/NC-001',
      effect: { text: 'NC-001 queda en análisis', holds: (_before, after) => field(after.body, 'state') === 'in_analysis' },
    },
  ],
  [
    'cerrar no conformidad',
    {
      send: api('POST', '/nc/NC-003/transition', { to: 'closed', comment: 'Cierre de prueba de permisos' }),
      write: true,
      probe: '/nc/NC-003',
      effect: { text: 'NC-003 queda cerrada', holds: (_before, after) => field(after.body, 'state') === 'closed' },
    },
  ],
  // Hitos
  [
    'editar hito',
    {
      send: api('PATCH', '/milestones/PRG-001-M01', { name: 'Hito de permisos' }),
      write: true,
      probe: '/programs/PRG-001/milestones',
      effect: { text: 'PRG-001-M01 se llama «Hito de permisos»', holds: (_before, after) => hasMilestone(after, 'PRG-001-M01', 'Hito de permisos') },
    },
  ],
  [
    'eliminar hito',
    {
      send: api('DELETE', '/milestones/PRG-001-M01'),
      write: true,
      probe: '/programs/PRG-001/milestones',
      effect: { text: 'PRG-001-M01 deja de existir', holds: (_before, after) => !hasMilestone(after, 'PRG-001-M01') },
    },
  ],
]);

/** Cabecera de autorización de las filas sin token válido: ninguna, o un texto que no es un JWT. */
const CREDENTIALS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['Bearer texto-sin-formato-JWT', 'texto-sin-formato-JWT'],
]);

const probeRead = async (token: string, path: string): Promise<Probe> => {
  const result = await call('GET', path, { tenant: TENANT_A, token });
  return { status: result.status, body: result.body };
};

const sameProbe = (before: Probe, after: Probe): boolean => JSON.stringify(before) === JSON.stringify(after);

/** Comprobaciones de persistencia: el efecto tras una escritura 2xx, o que el recurso no cambió en cualquier otro caso. */
const persistence = (op: Op, status: number, before: Probe, after: Probe): Check[] => {
  if (op.write && status >= 200 && status < 300 && op.effect) {
    const holds = op.effect.holds(before, after);
    return [check(holds, op.effect.text, holds ? `${op.effect.text} (sonda ${op.probe})` : `sin efecto en ${op.probe}: estado ${after.status}`)];
  }
  const same = sameProbe(before, after);
  return [check(same, `${op.probe} sin cambios`, same ? `${op.probe} sin cambios` : `${op.probe} cambió (estado ${before.status} → ${after.status})`)];
};

const adminToken = async (): Promise<string | { readonly failed: ApiResult }> => {
  const admin = await accessOf(TENANT_A, adminOf(TENANT_A));
  return isFailed(admin) ? { failed: admin.failed } : admin.token;
};

// --- Esquemas 1 a 8: un rol con el permiso recibe la respuesta de éxito y sin él 403 forbidden -------------------------------

const matrixRow: ApiRowHandler = async (row) => {
  const expected = parseResponse(cell(row, 'respuesta'));
  const op = strict('operación', OPERATIONS, cell(row, 'operacion'));
  const credentials = strict('rol', ROLE_ACCOUNTS, cell(row, 'rol'));
  await resetTenants([TENANT_A]);
  const admin = await adminToken();
  if (typeof admin !== 'string') return preparationFailed(cell(row, 'respuesta'), 'administrador de alumno01 inicia sesión', admin.failed);
  const access = await accessOf(TENANT_A, credentials);
  if (isFailed(access)) return preparationFailed(cell(row, 'respuesta'), `el rol ${cell(row, 'rol')} inicia sesión con x-tenant alumno01`, access.failed);
  const before = await probeRead(admin, op.probe);
  const result = await op.send(access.token);
  const after = await probeRead(admin, op.probe);
  return conclude([responseCheck(result, expected), ...persistence(op, result.status, before, after)], {
    evidence: { rol: cell(row, 'rol'), operacion: cell(row, 'operacion'), sonda: op.probe },
  });
};

// --- Esquema 9: sin un token válido la respuesta es 401, aunque el rol no tuviera el permiso -----------------------------

const noValidToken: ApiRowHandler = async (row) => {
  const expected = parseResponse(cell(row, 'respuesta'));
  const op = strict('operación', OPERATIONS, cell(row, 'operacion'));
  const token = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  await resetTenants([TENANT_A]);
  const admin = await adminToken();
  if (typeof admin !== 'string') return preparationFailed(cell(row, 'respuesta'), 'administrador de alumno01 inicia sesión', admin.failed);
  // «El recurso de la operación existe con los datos del seed»: se lee con el administrador antes de la petición sin token
  const before = await probeRead(admin, op.probe);
  if (before.status !== 200) return preparationFailed(cell(row, 'respuesta'), `el recurso ${op.probe} existe`, { status: before.status, body: before.body, ms: 0 });
  const result = await op.send(token);
  const after = await probeRead(admin, op.probe);
  return conclude([responseCheck(result, expected), ...persistence(op, result.status, before, after)], {
    evidence: { credencial: cell(row, 'credencial'), operacion: cell(row, 'operacion'), sonda: op.probe },
  });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, matrixRow],
    [2, matrixRow],
    [3, matrixRow],
    [4, matrixRow],
    [5, matrixRow],
    [6, matrixRow],
    [7, matrixRow],
    [8, matrixRow],
    [9, noValidToken],
  ]),
});
