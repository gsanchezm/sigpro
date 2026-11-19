import { call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, errorsOf, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-REQ-EDICION: cuentas con su sesión (las de alumno01 y las de alumno02), peticiones con su
// tenant, instantáneas de la lista del programa y comprobaciones de la respuesta. Los textos de las celdas se traducen con mapas
// `strict`: un texto que no conocen LANZA. Cada fila comprueba lo que la historia dice (Entonces/Y y las frases de Reglas que la
// fila da por hecha); lo observado se deriva de lo medido, nunca de un texto fijo.

export { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';

/** Cuenta de una celda: el tenant en el que inicia sesión y sus credenciales del seed. */
export interface Account {
  readonly tenant: string;
  readonly credentials: Credentials;
}

const ALUMNO01: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
const ALUMNO02: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };

/** Correo de la celda → cuenta. Cualquier otro correo LANZA al usarse con `strict`. */
export const ACCOUNT_OF: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['gestor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.gestor }],
  ['consultor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.consultor }],
  ['auditor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.auditor }],
  ['alumno01@sigpro.lab', { tenant: TENANT_A, credentials: ALUMNO01 }],
  ['alumno02@sigpro.lab', { tenant: TENANT_B, credentials: ALUMNO02 }],
]);

/** Sesión de una cuenta: su access token (o `undefined` si el login no lo dio) y la última respuesta para explicar un fallo. */
export interface Session {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/** Inicia sesión con la cuenta, con la cabecera `x-tenant` de su tenant. */
export const loginAs = async (account: Account): Promise<Session> => {
  const started = await startSession(account.tenant, account.credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Petición a la API con el tenant indicado (por defecto alumno01) y el token dado (sin cabecera si no hay token). */
export const act = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, token?: string, body?: unknown, tenant: string = TENANT_A): Promise<ApiResult> =>
  call(method, path, { tenant, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

/** Requisitos de la respuesta de una lista (`items`), o `undefined` si la lectura no responde 200. */
export const itemsOf = (result: ApiResult): readonly Record<string, unknown>[] | undefined => {
  const items = field(result.body, 'items');
  return result.status === 200 && Array.isArray(items) ? (items as Record<string, unknown>[]) : undefined;
};

/** Instantánea de la lista del programa (ordenada por código, tal como la devuelve la API). `undefined` si no se puede leer. */
export const snapshotOf = async (token: string, programCode: string): Promise<string | undefined> => {
  const items = itemsOf(await act('GET', `/programs/${programCode}/requirements`, token));
  return items === undefined ? undefined : JSON.stringify(items);
};

/** «No cambia nada»: las dos instantáneas (antes y después) son legibles e idénticas. */
export const unchangedCheck = (before: string | undefined, after: string | undefined, what: string): Check =>
  check(
    before !== undefined && after !== undefined && before === after,
    `${what} no cambia`,
    before === undefined || after === undefined ? `${what}: lectura no disponible` : before === after ? `${what} no cambia` : `${what} cambia`,
  );

/** Código → posición de los requisitos de una lista (vacío si no se pudo leer). */
export const positionsOf = (items: readonly Record<string, unknown>[] | undefined): ReadonlyMap<string, unknown> =>
  new Map((items ?? []).map((item) => [String(field(item, 'code')), field(item, 'position')]));

/** Expectativa de la respuesta de una celda, leída del mapa estricto de la fila. */
export interface Expect {
  readonly status: number;
  /** `code` de error del cuerpo. */
  readonly code?: string;
  /** Campos del cuerpo que deben valer exactamente esto (comparación JSON). */
  readonly fields?: Readonly<Record<string, unknown>>;
  /** Campos de texto cuya longitud debe ser esta. */
  readonly lengths?: Readonly<Record<string, number>>;
  /** Motivos por campo (`errors`): cada clave debe tener exactamente este motivo. */
  readonly errors?: Readonly<Record<string, string>>;
  /** Si se da, `errors` no puede traer ninguna clave aparte de las de `errors`. */
  readonly onlyErrors?: boolean;
  /** Campo que debe traer un motivo no vacío (el texto no se compara). Acepta la clave exacta o «campo.índice». */
  readonly motiveFor?: string;
}

/** Comprobaciones de una respuesta frente a su expectativa. Lo observado sale de lo medido. */
export const expectChecks = (expect: Expect, result: ApiResult): Check[] => {
  const checks: Check[] = [check(result.status === expect.status, `respuesta ${expect.status}`, `respuesta ${result.status}`)];
  if (expect.code !== undefined) checks.push(check(errorCode(result) === expect.code, `código ${expect.code}`, `código ${errorCode(result) ?? '(sin código)'}`));
  for (const [key, value] of Object.entries(expect.fields ?? {})) {
    const observed = field(result.body, key);
    checks.push(check(JSON.stringify(observed) === JSON.stringify(value), `${key} ${JSON.stringify(value)}`, `${key} ${observed === undefined ? '(ausente)' : JSON.stringify(observed)}`));
  }
  for (const [key, length] of Object.entries(expect.lengths ?? {})) {
    const observed = field(result.body, key);
    const actual = typeof observed === 'string' ? observed.length : undefined;
    checks.push(check(actual === length, `${key} de ${length} caracteres`, `${key} de ${actual ?? '(no es texto)'} caracteres`));
  }
  const errors = errorsOf(result);
  for (const [key, value] of Object.entries(expect.errors ?? {})) {
    const label = key === '' ? 'errors (sin nombre de campo)' : `errors.${key}`;
    const observed = errors[key];
    checks.push(check(observed === value, `${label} igual a ${value}`, `${label} ${observed === undefined ? '(sin motivo)' : String(observed)}`));
  }
  if (expect.onlyErrors) {
    const keys = Object.keys(errors);
    checks.push(check(keys.length === Object.keys(expect.errors ?? {}).length, 'errors sin otras claves', `errors con claves ${JSON.stringify(keys)}`));
  }
  if (expect.motiveFor !== undefined) {
    const name = expect.motiveFor;
    const keys = Object.keys(errors).filter((key) => key === name || key.startsWith(`${name}.`));
    const text = keys.map((key) => errors[key]).find((value) => typeof value === 'string' && value !== '');
    checks.push(check(text !== undefined, `motivo para ${name}`, text === undefined ? `sin motivo para ${name} (claves: ${JSON.stringify(Object.keys(errors))})` : `motivo para ${keys.join(', ')}: ${String(text)}`));
  }
  return checks;
};

/** Veredicto de una fila: coincide si todas las comprobaciones se cumplen. Si no, la nota dice en qué difiere (derivada de lo medido). */
export const verdict = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.observed);
  const parts = [failed.length === 0 ? undefined : `difiere en: ${failed.join('; ')}`, extraNote].filter((part): part is string => part !== undefined);
  return conclude(checks, parts.length === 0 ? {} : { note: parts.join('. ') });
};

/** Cuenta de una celda; LANZA si el correo no es uno de los conocidos. Para usar con `strict` o directamente. */
export const accountCell = (text: string): Account => {
  const account = ACCOUNT_OF.get(text);
  if (!account) throw new Error(`celda sin interpretación: cuenta «${text}»`);
  return account;
};

/** Código de la celda (`REQ-001`, `PRG-024`, `TC-004`…): solo se admite el formato del código; cualquier otro texto LANZA. */
export const codeCell = (text: string): string => {
  if (!/^(REQ|PRG|TC)-\d{3}$/.test(text)) throw new Error(`celda sin interpretación: código «${text}»`);
  return text;
};

/** Lista de códigos de una celda («REQ-001, REQ-002 y REQ-003»): cada código pasa por `codeCell`. */
export const codesOf = (text: string): readonly string[] => text.split(/, | y /).map(codeCell);
