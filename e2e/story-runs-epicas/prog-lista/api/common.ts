import { call, field, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-PROG-LISTA: cuentas con su sesión (el admin pasa por el segundo factor), lectura de
// los códigos de la lista y comprobaciones de la respuesta de GET /api/programs. Los textos de las celdas se traducen aquí con
// mapas; cualquier texto que no conozcan LANZA (una celda nueva no se ignora).

export { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';

/** Código del segundo factor del seed (el de «admin@sigpro.test»). */
export const MFA_CODE = '123456';

export type AccountKey = 'gestor' | 'consultor' | 'auditor' | 'admin';

const ACCOUNTS: Readonly<Record<AccountKey, Credentials>> = {
  gestor: DEMO.gestor,
  consultor: DEMO.consultor,
  auditor: DEMO.auditor,
  admin: DEMO.admin,
};

/** Cuenta de la fila → su mapa de credenciales (el mapa conoce cada texto de la celda; lo demás lanza). */
export const ACCOUNT_OF: ReadonlyMap<string, AccountKey> = new Map<string, AccountKey>([
  ['gestor@sigpro.test', 'gestor'],
  ['consultor@sigpro.test', 'consultor'],
  ['auditor@sigpro.test', 'auditor'],
  ['admin@sigpro.test', 'admin'],
]);

export interface SessionOf {
  /** Access token de la cuenta, o `undefined` si el inicio de sesión no lo dio. */
  readonly token: string | undefined;
  /** Última respuesta de la preparación (para explicar un fallo de preparación). */
  readonly last: ApiResult;
}

/**
 * Inicia sesión en alumno01 con la cuenta: gestor, consultor y auditor con su contraseña; admin completa el segundo factor con
 * 123456 (`POST /api/auth/mfa`) y usa el access token que recibe. Las peticiones llevan la cabecera `x-tenant: alumno01`.
 */
export const sessionFor = async (account: AccountKey): Promise<SessionOf> => {
  const started = await startSession(TENANT_A, ACCOUNTS[account]);
  if (account !== 'admin') return { token: started.session?.accessToken, last: started.result };
  const mfaToken = field(started.result.body, 'mfaToken');
  if (typeof mfaToken !== 'string') return { token: undefined, last: started.result };
  const redeemed = await call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code: MFA_CODE } });
  return { token: sessionOf(redeemed)?.accessToken, last: redeemed };
};

/** `GET /api/programs` del tenant alumno01 con el query dado (sin `?`) y el token opcional. */
export const listPrograms = (query: string | undefined, token?: string): Promise<ApiResult> =>
  call('GET', '/programs', { tenant: TENANT_A, ...(token === undefined ? {} : { token }), ...(query === undefined ? {} : { query }) });

const EMPTY_CODES: ReadonlySet<string> = new Set(['(ninguno)', '(ningún programa)']);
const CODE = /^PRG-\d{3}$/;
const RANGE = /^(PRG-\d{3}) a (PRG-\d{3})$/;

/** Códigos entre dos extremos, ambos incluidos (PRG-001 a PRG-010 → diez códigos). */
const codesBetween = (first: string, last: string): readonly string[] => {
  const from = Number(first.slice(4));
  const to = Number(last.slice(4));
  return Array.from({ length: to - from + 1 }, (_, index) => `PRG-${String(from + index).padStart(3, '0')}`);
};

/**
 * Celda de códigos: «(ninguno)», un rango «PRG-001 a PRG-010» o una lista «PRG-003, PRG-011, PRG-019». Cualquier otra forma lanza.
 */
export const codesOf = (text: string): readonly string[] => {
  if (EMPTY_CODES.has(text)) return [];
  const range = RANGE.exec(text);
  if (range?.[1] !== undefined && range[2] !== undefined) return codesBetween(range[1], range[2]);
  const list = text.split(', ');
  if (!list.every((code) => CODE.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return list;
};

/** Elementos de `items` de la respuesta (vacío si no es una lista). */
export const itemsOf = (result: ApiResult): readonly unknown[] => {
  const items = field(result.body, 'items');
  return Array.isArray(items) ? items : [];
};

/** Códigos de `items`, en el orden en que llegan. */
export const codesIn = (result: ApiResult): readonly string[] => itemsOf(result).map((item) => String(field(item, 'code')));

/** Respuesta 200 con los códigos de `items` exactamente iguales (en orden) a los esperados. */
export const codesCheck = (codes: readonly string[], expected: readonly string[], label = 'los programas'): Check => {
  const same = codes.length === expected.length && codes.every((code, index) => code === expected[index]);
  return check(same, `${label} ${expected.length === 0 ? '(ninguno)' : expected.join(', ')}`, `${label} ${codes.length === 0 ? '(ninguno)' : codes.join(', ')}`);
};

/** Un campo numérico de la respuesta igual al esperado (los números de la historia se comparan como texto exacto). */
export const numberCheck = (result: ApiResult, key: string, expected: number): Check => {
  const value = field(result.body, key);
  return check(value === expected, `${key} ${expected}`, `${key} ${String(value)}`);
};

/** Un campo de la respuesta (o de un elemento) igual, como texto, al que dice la celda. */
export const textFieldCheck = (source: unknown, key: string, expected: string, label = key): Check => {
  const value = field(source, key);
  return check(String(value) === expected, `${label} ${expected}`, `${label} ${String(value)}`);
};

/** Consulta sin coincidencias: `pages 1` y `page 1` (la regla de la historia). */
export const emptyPagingChecks = (result: ApiResult): readonly Check[] => [numberCheck(result, 'pages', 1), numberCheck(result, 'page', 1)];
