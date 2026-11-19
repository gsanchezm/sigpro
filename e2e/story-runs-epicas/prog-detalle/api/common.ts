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
  return [
    check(exact, 'exactamente los 14 campos del detalle', exact ? 'exactamente los 14 campos del detalle' : `campos ${keys.length === 0 ? '(ninguno)' : keys.join(', ')}`),
    check(typeof classified === 'boolean' && Number.isInteger(budget), 'classified booleano y budgetEur entero', `classified ${String(classified)} y budgetEur ${String(budget)}`),
    check(
      typeof status === 'string' && STATUS.has(status) && typeof priority === 'string' && PRIORITY.has(priority) && typeof start === 'string' && ISO_DATE.test(start) && typeof end === 'string' && ISO_DATE.test(end),
      'status y priority de sus listas y fechas YYYY-MM-DD',
      `status ${String(status)}, priority ${String(priority)}, fechas ${String(start)} → ${String(end)}`,
    ),
  ];
};

/** El cuerpo no trae ningún dato del programa (ni campo de datos ni un código PRG-xxx). */
export const noProgramData = (result: ApiResult): Check => {
  const found = DATA_FIELDS.filter((key) => field(result.body, key) !== undefined);
  const code = field(result.body, 'code');
  const pieces = typeof code === 'string' && /^PRG-\d{3}$/.test(code) ? [...found, `code ${code}`] : found;
  return check(pieces.length === 0, 'el cuerpo no trae ningún dato del programa', pieces.length === 0 ? 'sin datos del programa' : `trae ${pieces.join(', ')}`);
};

/** 404 `program_not_found`: estado, `code` y `message` (la regla pide ambos con ese mismo texto). */
export const notFoundCheck = (result: ApiResult): Check => {
  const message = field(result.body, 'message');
  const ok = result.status === 404 && errorCode(result) === 'program_not_found' && message === 'program_not_found';
  return check(ok, 'respuesta 404 con code y message program_not_found', `respuesta ${result.status} con code ${String(errorCode(result))} y message ${String(message)}`);
};

/** Un campo del cuerpo igual, como texto exacto, al que dice la celda. */
export const fieldCheck = (body: unknown, key: string, expected: string): Check => {
  const value = field(body, key);
  return check(String(value) === expected, `el campo ${key} vale ${expected}`, `el campo ${key} vale ${value === undefined ? '(sin campo)' : String(value)}`);
};
