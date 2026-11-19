import { adminCredentials, call, decodeJwt, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, startSession, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-PROG-DETALLE: cuentas con su sesión (las de alumnoNN no llevan segundo factor; admin@sigpro.test
// recibe solo un mfaToken), lectura de GET /api/programs/:code y las comprobaciones de forma que la historia exige a toda respuesta 200
// (campos exactos, tipos y valores). Los textos de las celdas se traducen con mapas; cualquier texto que no conozcan LANZA.

export { resetTenants, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';

/** Campos que la historia dice que trae el programa, y solo esos (regla de `GET /api/programs/:code`). */
export const PROGRAM_FIELDS: readonly string[] = [
  'code',
  'name',
  'description',
  'status',
  'priority',
  'classified',
  'ownerId',
  'ownerName',
  'startDate',
  'endDate',
  'budgetEur',
  'progress',
  'milestonesDone',
  'milestonesTotal',
];

/** Campos de datos del programa (el `code` de un 404 es `program_not_found`, no un dato del programa: se aparta). */
const DATA_FIELDS: readonly string[] = PROGRAM_FIELDS.filter((key) => key !== 'code');

/** Sesión de una cuenta: tokens (los que haya) y la última respuesta, para explicar un fallo de preparación. */
export interface AccountSession {
  readonly accessToken: string | undefined;
  readonly refreshToken: string | undefined;
  readonly mfaToken: string | undefined;
  readonly last: ApiResult;
}

/** `POST /api/auth/login` de la cuenta en el tenant dado (cabecera x-tenant). */
export const sessionOfAccount = async (tenant: string, credentials: Credentials): Promise<AccountSession> => {
  const started = await startSession(tenant, credentials);
  const mfa = field(started.result.body, 'mfaToken');
  return {
    accessToken: started.session?.accessToken,
    refreshToken: started.session?.refreshToken,
    mfaToken: typeof mfa === 'string' ? mfa : undefined,
    last: started.result,
  };
};

/** Rol que la API pone en el accessToken (decodificación SIN verificar: solo para comprobar la precondición «con el rol …»). */
export const roleOf = (token: string): unknown => field(decodeJwt(token), 'role');

/** `GET /api/programs/:code` con el token dado como Bearer; `tenant` solo si la fila indica la cabecera x-tenant. */
export const getProgram = (code: string, token: string | undefined, tenant?: string): Promise<ApiResult> => call('GET', `/programs/${code}`, { token, tenant });

/** Cuentas de las filas, por el texto exacto de la celda. */
export const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['admin@sigpro.test', DEMO.admin],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
]);

/** Códigos que no son un programa del tenant (celda de la fila). */
export const CODES_NOT_A_PROGRAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-000', 'PRG-000'],
  ['PRG-025', 'PRG-025'],
  ['REQ-001', 'REQ-001'],
]);

// --- Comprobaciones de forma y de ausencia ------------------------------------------------------------------------------------------------

const STATUS: ReadonlySet<string> = new Set(['draft', 'active', 'on_hold', 'closed', 'cancelled']);
const PRIORITY: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Reglas de forma de toda respuesta 200 del detalle: exactamente sus campos, tipos (`classified` booleano, `budgetEur` entero) y valores (listas y fechas). */
export const shapeChecks = (body: unknown): readonly Check[] => {
  const keys = typeof body === 'object' && body !== null ? Object.keys(body) : [];
  const exact = keys.length === PROGRAM_FIELDS.length && PROGRAM_FIELDS.every((key) => keys.includes(key));
  const classified = field(body, 'classified');
  const budget = field(body, 'budgetEur');
  const status = field(body, 'status');
  const priority = field(body, 'priority');
  const start = field(body, 'startDate');
  const end = field(body, 'endDate');
  const progress = field(body, 'progress');
  const done = field(body, 'milestonesDone');
  const total = field(body, 'milestonesTotal');
  return [
    check(exact, 'exactamente los 14 campos del detalle', exact ? 'exactamente los 14 campos del detalle' : `campos ${keys.length === 0 ? '(ninguno)' : keys.join(', ')}`),
    check(
      typeof classified === 'boolean' && [budget, progress, done, total].every((value) => Number.isInteger(value)),
      'classified booleano; budgetEur, progress, milestonesDone y milestonesTotal enteros',
      `classified ${String(classified)}, budgetEur ${String(budget)}, progress ${String(progress)}, milestonesDone ${String(done)}, milestonesTotal ${String(total)}`,
    ),
    check(
      typeof status === 'string' && STATUS.has(status) && typeof priority === 'string' && PRIORITY.has(priority) && typeof start === 'string' && ISO_DATE.test(start) && typeof end === 'string' && ISO_DATE.test(end),
      'status y priority de sus listas y fechas YYYY-MM-DD',
      `status ${String(status)}, priority ${String(priority)}, fechas ${String(start)} → ${String(end)}`,
    ),
  ];
};

/**
 * Rutas donde el cuerpo trae datos de programa, en CUALQUIER nivel (también anidados): una clave de datos del programa, o un valor que sea
 * un código PRG-xxx (eco del código). El `code` de un error es `program_not_found`, así que no cuenta por sí solo.
 */
const dataHits = (value: unknown, path: string): string[] => {
  if (Array.isArray(value)) return value.flatMap((item, index) => dataHits(item, `${path}[${index}]`));
  if (typeof value === 'string') return /^PRG-\d{3}$/.test(value) ? [`${path}=${value}`] : [];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [...(DATA_FIELDS.includes(key) ? [`${path}.${key}`] : []), ...dataHits(child, `${path}.${key}`)]);
  }
  return [];
};

/** El cuerpo no trae ningún dato del programa, ni al nivel superior ni anidado (ni un campo de datos ni un código PRG-xxx). */
export const noProgramData = (result: ApiResult): Check => {
  const hits = dataHits(result.body, '$');
  return check(hits.length === 0, 'el cuerpo no trae ningún dato del programa, ni anidado', hits.length === 0 ? 'sin datos del programa' : `trae ${hits.join(', ')}`);
};

/** JSON canónico: las claves se ordenan en todos los niveles, así dos cuerpos se comparan enteros sin depender del orden de las claves. */
export const canonicalJson = (value: unknown): string => JSON.stringify(sortKeys(value));
const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === 'object' && value !== null) {
    const entries = Object.keys(value).sort().map((key): [string, unknown] => [key, sortKeys((value as Record<string, unknown>)[key])]);
    return Object.fromEntries(entries);
  }
  return value;
};

/**
 * `traceId` del cuerpo de error: la API pone un id aleatorio por petición (el filtro de excepciones). Es el detalle técnico visible, que la
 * historia no afirma ni compara: por eso la comparación de cuerpos se hace sin él.
 */
export const traceIdOf = (body: unknown): string | undefined => {
  const value = field(body, 'traceId');
  return typeof value === 'string' ? value : undefined;
};

/** Copia del cuerpo sin su `traceId` (el cuerpo original no se modifica). */
export const withoutTraceId = (body: unknown): unknown => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete copy.traceId;
  return copy;
};

/** Igualdad por TIPO y valor: un texto con su texto; un número solo con su número entero escrito; un booleano con «true» o «false». */
export const sameValue = (actual: unknown, expected: string): boolean => {
  if (typeof actual === 'string') return actual === expected;
  if (typeof actual === 'number') return /^-?\d+$/.test(expected) && Number(expected) === actual;
  if (typeof actual === 'boolean') return expected === (actual ? 'true' : 'false');
  return false;
};

/** 404 `program_not_found`: estado, `code` y `message` (la regla pide ambos con ese mismo texto). */
export const notFoundCheck = (result: ApiResult): Check => {
  const message = field(result.body, 'message');
  const ok = result.status === 404 && errorCode(result) === 'program_not_found' && message === 'program_not_found';
  return check(ok, 'respuesta 404 con code y message program_not_found', `respuesta ${result.status} con code ${String(errorCode(result))} y message ${String(message)}`);
};

/** Un campo del cuerpo igual, por tipo y valor, al que dice la celda (un número «11» no es el texto «11»). */
export const fieldCheck = (body: unknown, key: string, expected: string): Check => {
  const value = field(body, key);
  const shown = value === undefined ? '(sin campo)' : typeof value === 'string' ? value : JSON.stringify(value);
  return check(sameValue(value, expected), `el campo ${key} vale ${expected}`, `el campo ${key} vale ${shown}`);
};
