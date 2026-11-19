import { adminCredentials, adminToken, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude as sharedConclude, errorsOf, strict, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

/**
 * Resultado de las comprobaciones de una fila. Una fila que discrepa lleva en `note` en qué difiere: a la nota propia de la fila se
 * añade cada comprobación que no se cumplió (lo que la historia esperaba y lo que se observó).
 */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `Difiere de la historia en: ${failing.map((entry) => `se esperaba ${entry.expected}; se observó ${entry.observed}`).join('; ')}.`;
  const note = [extra.note, difference].filter((part): part is string => part !== undefined).join(' ');
  return sharedConclude(checks, { ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }), ...(note === '' ? {} : { note }) });
};

// Piezas comunes de las filas de API de EP-PROG-ALTA. Todas las peticiones llevan `x-tenant: alumno01`. Las cuentas de la historia
// salen de un mapa de texto → credenciales (lo que no conoce LANZA). Las comprobaciones de «Entonces» se construyen aquí con la
// frase que dice la historia y lo que se observó; el valor esperado nunca se lee de la app.

export { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';

/** Programas de la semilla tras el reinicio (PRG-001 a PRG-024). */
export const SEED_COUNT = 24;

/** Cuentas que citan las historias de la épica, con su texto de la tabla. «alumno01@sigpro.lab» es la administración del tenant. */
export const CREDENTIALS_OF: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
]);

/** Cuenta de la celda → credenciales (lanza si la cuenta no es una de las de la historia). */
export const credentialsOf = (text: string): Credentials => strict('cuenta', CREDENTIALS_OF, text);

export interface SessionOf {
  /** Access token de la cuenta, o `undefined` si el inicio de sesión no lo dio. */
  readonly token: string | undefined;
  /** Última respuesta de la preparación (para explicar un fallo de preparación). */
  readonly last: ApiResult;
}

/** Inicia sesión en alumno01 con la cuenta de la fila (ninguna de estas cuentas tiene segundo factor). */
export const sessionFor = async (credentials: Credentials): Promise<SessionOf> => {
  const started = await startSession(TENANT_A, credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Cuerpo base de los ejemplos que fija la historia: cada Esquema cambia solo lo que dice su tabla. */
export const baseBody = (): Record<string, unknown> => ({
  name: 'Programa de prueba alfa',
  ownerId: 'u2',
  startDate: '2027-03-01',
  endDate: '2027-03-02',
  budget: 900000,
});

/** Petición con token opcional (sin token no se envía la cabecera Authorization). */
const withToken = (token: string | undefined): { readonly token?: string } => (token === undefined ? {} : { token });

export const createProgram = (token: string | undefined, body: unknown): Promise<ApiResult> => call('POST', '/programs', { tenant: TENANT_A, ...withToken(token), body });

export const updateProgram = (token: string | undefined, code: string, body: unknown): Promise<ApiResult> =>
  call('PATCH', `/programs/${code}`, { tenant: TENANT_A, ...withToken(token), body });

export const getProgram = (token: string | undefined, code: string): Promise<ApiResult> => call('GET', `/programs/${code}`, { tenant: TENANT_A, ...withToken(token) });

/** `GET /api/programs` sin filtros: `totalAll` es el número de programas del tenant. */
export const listPrograms = (token: string | undefined): Promise<ApiResult> => call('GET', '/programs', { tenant: TENANT_A, ...withToken(token) });

/** Describe un valor para un mensaje: texto entre comillas, «(ausente)» si no está. */
const describe = (value: unknown): string => (value === undefined ? '(ausente)' : typeof value === 'string' ? `«${value}»` : String(value));

/** Un campo del cuerpo de la respuesta igual al esperado (los importes y las fechas se comparan tal cual). */
export const fieldCheck = (source: unknown, key: string, expected: unknown, label = key): Check => {
  const value = field(source, key);
  return check(value === expected, `${label} ${describe(expected)}`, `${label} ${describe(value)}`);
};

/** Un campo que debe existir en el cuerpo (sin fijar su valor). */
export const presentCheck = (source: unknown, key: string): Check => {
  const value = field(source, key);
  return check(value !== undefined && value !== null, `trae ${key}`, value === undefined || value === null ? `sin ${key}` : `trae ${key}`);
};

/** Un motivo por campo del 422 (`errors`). Sin `motive`, basta con que el campo traiga un motivo de texto. */
export const reasonCheck = (result: ApiResult, key: string, motive?: string): Check => {
  const value = errorsOf(result)[key];
  const ok = motive === undefined ? typeof value === 'string' && value !== '' : value === motive;
  return check(ok, `motivo ${motive ?? '(cualquiera)'} en ${key}`, `motivo en ${key}: ${typeof value === 'string' ? value : '(ninguno)'}`);
};

/** Un programa nuevo no existe: el total del tenant sigue en la semilla y PRG-025 responde 404. */
export const noProgramCreated = async (token: string): Promise<readonly Check[]> => {
  const list = await listPrograms(token);
  const next = await getProgram(token, 'PRG-025');
  const total = field(list.body, 'totalAll');
  return [
    check(total === SEED_COUNT, `ningún programa nuevo: el tenant sigue con ${SEED_COUNT} programas`, `el tenant tiene ${describe(total)} programas`),
    check(next.status === 404, 'no se asigna el código PRG-025', `PRG-025 responde ${next.status}`),
  ];
};

/** Estado de la semilla tras el reinicio: 24 programas y PRG-024 existe. Falsa si no se da. */
export const seedReady = async (token: string): Promise<{ readonly ok: boolean; readonly result: ApiResult }> => {
  const list = await listPrograms(token);
  return { ok: field(list.body, 'totalAll') === SEED_COUNT, result: list };
};

/** Mapas de columna → campo de la API. Lo que no conocen LANZA (una columna nueva no se ignora). */
export const API_FIELD: ReadonlyMap<string, string> = new Map<string, string>([
  ['nombre', 'name'],
  ['descripción', 'description'],
  ['propietario', 'ownerId'],
  ['inicio', 'startDate'],
  ['fin', 'endDate'],
  ['presupuesto', 'budget'],
  ['prioridad', 'priority'],
  ['clasificado', 'classified'],
  ['estado', 'status'],
]);

/** Programa de la semilla PRG-001 tal como lo da la historia (la historia es la fuente; la app se compara contra esto). */
export const SEED_PRG_001: Readonly<Record<string, unknown>> = {
  name: 'Sistema de mando táctico Ártemis',
  ownerId: 'u1',
  ownerName: 'Marta Ruiz',
  status: 'active',
  priority: 'medium',
  classified: true,
  budgetEur: 450000,
  startDate: '2023-01-01',
  endDate: '2024-07-01',
};

/** Los campos editables de un programa (los que se comparan para saber si la edición cambió algo). */
export const EDITABLE_KEYS: readonly string[] = [
  'name',
  'description',
  'ownerId',
  'ownerName',
  'status',
  'priority',
  'classified',
  'startDate',
  'endDate',
  'budgetEur',
  'progress',
  'milestonesDone',
  'milestonesTotal',
];

/**
 * Auditoría del tenant para un código (`GET /api/audit?q=<código>`, del más reciente al más antiguo). Lo lee el administrador de
 * alumno01 (rol admin: `audit.view`), sin segundo factor. `undefined` si la lectura no responde 200.
 */
export const auditItems = async (code: string): Promise<readonly unknown[] | undefined> => {
  const listed = await call('GET', '/audit', { tenant: TENANT_A, token: await adminToken(TENANT_A), query: `q=${code}&limit=100` });
  if (listed.status !== 200) return undefined;
  const items = field(listed.body, 'items');
  return Array.isArray(items) ? items : undefined;
};

/** Cuántas entradas de auditoría de `action` sobre `code` hay ahora. */
export const auditCount = async (code: string, action: string): Promise<number | undefined> =>
  (await auditItems(code))?.filter((item) => field(item, 'action') === action && field(item, 'entityId') === code).length;

/** Campos de la última entrada de `action` sobre `code` (`diff.fields`), o `undefined` si no hay ninguna o no se puede leer. */
export const latestAuditFields = async (code: string, action: string): Promise<readonly string[] | undefined> => {
  const entry = (await auditItems(code))?.find((item) => field(item, 'action') === action && field(item, 'entityId') === code);
  const fields = field(field(entry, 'diff'), 'fields');
  return Array.isArray(fields) ? fields.map((value) => String(value)) : undefined;
};

/** Foto de los campos editables de un programa (cuerpo de la respuesta de GET o de PATCH). */
export const snapshotOf = (source: unknown): Readonly<Record<string, unknown>> =>
  Object.fromEntries(EDITABLE_KEYS.map((key) => [key, field(source, key)]));

/** Comprueba que PRG-001 tiene los datos que da la historia tras el reinicio (la preparación de la fila). */
export const seedPrg001Check = (source: unknown): Check => {
  const mismatches = Object.entries(SEED_PRG_001).filter(([key, value]) => field(source, key) !== value);
  return check(mismatches.length === 0, 'PRG-001 con los datos de la semilla', mismatches.length === 0 ? 'PRG-001 con los datos de la semilla' : `PRG-001 difiere en ${mismatches.map(([key]) => key).join(', ')}`);
};

/** «Nada cambió»: cada campo editable de PRG-001 igual a la foto de antes de la edición. */
export const unchangedChecks = (before: Readonly<Record<string, unknown>>, after: unknown): readonly Check[] => {
  const changed = EDITABLE_KEYS.filter((key) => field(after, key) !== before[key]);
  return [check(changed.length === 0, 'PRG-001 conserva todos sus valores', changed.length === 0 ? 'PRG-001 conserva todos sus valores' : `PRG-001 cambió: ${changed.join(', ')}`)];
};
