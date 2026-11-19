import { API_URL, adminToken, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-VER-CASOS: cuentas con su sesión (el admin pasa por el segundo factor), los
// administradores de alumno01 y alumno02 (sin segundo factor), las peticiones a /api/test-cases y las comprobaciones de la
// lista y del detalle. Cualquier texto de celda que no conozcan los mapas o las expresiones LANZA.

export { TENANT_A, TENANT_B, resetTenants };

/** Código del segundo factor del seed (el de «admin@sigpro.test»). */
export const MFA_CODE = '123456';

/** Contraseña de las cuentas de administración de los tenants alumnoNN (`alumnoNN@sigpro.lab`, sin segundo factor). */
const STUDENT_PASSWORD = 'Alumno1234!';

export type AccountKey = 'gestor' | 'consultor' | 'auditor' | 'admin';

const ACCOUNTS: Readonly<Record<AccountKey, Credentials>> = {
  gestor: DEMO.gestor,
  consultor: DEMO.consultor,
  auditor: DEMO.auditor,
  admin: DEMO.admin,
};

export interface SessionOf {
  /** Access token de la cuenta, o `undefined` si el inicio de sesión no lo dio. */
  readonly token: string | undefined;
  /** Última respuesta de la preparación (para explicar un fallo de preparación). */
  readonly last: ApiResult;
}

/**
 * Inicia sesión en el tenant con la cuenta de demostración: gestor, consultor y auditor con su contraseña; admin completa el
 * segundo factor con 123456 (`POST /api/auth/mfa`) y usa el access token que recibe.
 */
export const sessionFor = async (account: AccountKey, tenant: string = TENANT_A): Promise<SessionOf> => {
  const started = await startSession(tenant, ACCOUNTS[account]);
  if (account !== 'admin') return { token: started.session?.accessToken, last: started.result };
  const mfaToken = field(started.result.body, 'mfaToken');
  if (typeof mfaToken !== 'string') return { token: undefined, last: started.result };
  const redeemed = await call('POST', '/auth/mfa', { tenant, body: { mfaToken, code: MFA_CODE } });
  const accessToken = field(redeemed.body, 'accessToken');
  return { token: typeof accessToken === 'string' ? accessToken : undefined, last: redeemed };
};

/** Administrador del tenant `alumnoNN` (`alumnoNN@sigpro.lab`, sin segundo factor): su access token. */
export const tenantAdminSession = async (tenant: string): Promise<SessionOf> => {
  const started = await startSession(tenant, { email: `${tenant}@sigpro.lab`, password: STUDENT_PASSWORD });
  return { token: started.session?.accessToken, last: started.result };
};

/**
 * Preparación del Esquema de aislamiento: reinicia alumno01 y alumno02 y quita el enlace REQ-001 ↔ TC-001 en alumno01 con el token
 * de su administrador (`DELETE /api/requirements/REQ-001/tests/TC-001`). Esa petición solo prepara el estado: debe responder 204.
 */
/** Estado de aislamiento: un fallo de preparación, o la ejecución extra que se registró solo en alumno02 (para distinguir sus datos). */
export interface IsolationState {
  readonly failure?: { readonly step: string; readonly result: ApiResult };
  readonly extraRun?: { readonly id: string | undefined; readonly executedAt: string | undefined };
}

/** Notas de la ejecución de preparación de alumno02 (no existe en alumno01, que parte del seed). */
export const EXTRA_RUN_NOTES = 'Ejecución de preparación: solo existe en alumno02';

/** Cuerpo de una respuesta que puede no ser JSON: el texto tal cual si no lo es. */
const parseBody = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

/**
 * `POST /api/test-cases/:code/runs` en multipart (la forma que pide la API): registra una ejecución «pass» con sus notas. Devuelve la
 * respuesta cruda (el código de estado se comprueba en quien llama).
 */
export const postRun = async (tenant: string, token: string, code: string, notes: string): Promise<ApiResult> => {
  const form = new FormData();
  form.append('result', 'pass');
  form.append('notes', notes);
  const started = performance.now();
  const response = await fetch(`${API_URL}/test-cases/${encodeURIComponent(code)}/runs`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'x-tenant': tenant },
    body: form,
  });
  return { status: response.status, body: parseBody(await response.text()), ms: Math.round(performance.now() - started) };
};

/**
 * Preparación del Esquema de aislamiento: reinicia alumno01 y alumno02, quita el enlace REQ-001 ↔ TC-001 en alumno01 (DELETE, debe
 * responder 204) y registra en alumno02 una ejecución extra de TC-001 (2xx comprobado). Así TC-001 tiene datos distintos por tenant:
 * alumno01 con 2 ejecuciones del seed y alumno02 con 3, y una fuga de ejecuciones se ve en runCount/lastRunAt.
 */
export const isolatedState = async (): Promise<IsolationState> => {
  await resetTenants([TENANT_A, TENANT_B]);
  const token = await adminToken(TENANT_A);
  const removed = await call('DELETE', '/requirements/REQ-001/tests/TC-001', { tenant: TENANT_A, token });
  if (removed.status !== 204) return { failure: { step: 'quitar el enlace REQ-001 ↔ TC-001 en alumno01', result: removed } };
  const admin = await tenantAdminSession(TENANT_B);
  if (admin.token === undefined) return { failure: { step: 'alumno02@sigpro.lab inicia sesión y recibe accessToken', result: admin.last } };
  const run = await postRun(TENANT_B, admin.token, 'TC-001', EXTRA_RUN_NOTES);
  if (run.status < 200 || run.status >= 300) return { failure: { step: 'registrar una ejecución extra de TC-001 en alumno02', result: run } };
  const id = field(run.body, 'id');
  const executedAt = field(run.body, 'executedAt');
  return { extraRun: { id: typeof id === 'string' ? id : undefined, executedAt: typeof executedAt === 'string' ? executedAt : undefined } };
};

/** Ejecuciones de TC-001 en cada tenant tras la preparación: 2 del seed en alumno01; 3 en alumno02 (las 2 del seed más la extra). */
export const ownRunCount = (tenant: string): number => (tenant === TENANT_B ? 3 : 2);
/** Último resultado de TC-001 en cada tenant: el del seed (bloqueado, 05/02/2026) en alumno01; «pass» de la extra en alumno02. */
export const ownLastResult = (tenant: string): string => (tenant === TENANT_B ? 'pass' : 'blocked');
/** Fecha de la última ejecución de TC-001: la del seed en alumno01 y la de la extra en alumno02. */
export const ownLastRunAt = (tenant: string, extra: IsolationState['extraRun']): string | undefined =>
  tenant === TENANT_B ? extra?.executedAt : '2026-02-05T09:00:00.000Z';

/** `GET /api/test-cases` con la query dada (sin `?`), el token opcional y el tenant de la cabecera `x-tenant`. */
export const listCases = (query: string | undefined, token?: string, tenant: string = TENANT_A): Promise<ApiResult> =>
  call('GET', '/test-cases', { tenant, ...(token === undefined ? {} : { token }), ...(query === undefined ? {} : { query }) });

/** `GET /api/test-cases/:code` con el token opcional. */
export const detailCase = (code: string, token?: string, tenant: string = TENANT_A): Promise<ApiResult> =>
  call('GET', `/test-cases/${encodeURIComponent(code)}`, { tenant, ...(token === undefined ? {} : { token }) });

/**
 * Celda «GET /api/test-cases» o «GET /api/test-cases?<query>»: devuelve la query (o `undefined`). Cualquier otra forma LANZA.
 * Solo admite pares clave=valor separados por `&` (sin espacios ni caracteres de escape).
 */
export const queryOfRequest = (text: string): string | undefined => {
  const match = /^GET \/api\/test-cases(?:\?([a-zA-Z0-9=&]+))?$/.exec(text.trim());
  if (!match) throw new Error(`celda sin interpretación: petición «${text}»`);
  return match[1];
};

const CODE = /^TC-\d{3}$/;

/** Códigos de casos separados por «, » (o «(ninguno)»); cualquier otra forma LANZA. */
export const codesOf = (text: string): readonly string[] => {
  if (text === '(ninguno)') return [];
  const list = text.split(', ');
  if (!list.every((code) => CODE.test(code))) throw new Error(`celda sin interpretación: códigos «${text}»`);
  return list;
};

/** Códigos entre dos extremos, ambos incluidos (TC-001 a TC-010 → diez códigos). */
export const codesBetween = (first: string, last: string): readonly string[] => {
  if (!CODE.test(first) || !CODE.test(last)) throw new Error(`celda sin interpretación: extremos «${first}» y «${last}»`);
  const from = Number(first.slice(3));
  const to = Number(last.slice(3));
  return Array.from({ length: to - from + 1 }, (_, index) => `TC-${String(from + index).padStart(3, '0')}`);
};

/** Elementos de `items` de la respuesta (vacío si no es una lista). */
export const itemsOf = (result: ApiResult): readonly unknown[] => {
  const items = field(result.body, 'items');
  return Array.isArray(items) ? items : [];
};

/** Códigos de `items`, en el orden en que llegan. */
export const codesIn = (result: ApiResult): readonly string[] => itemsOf(result).map((item) => String(field(item, 'code')));

/** Lista de códigos exactamente igual (en orden) a la esperada. */
export const codesCheck = (codes: readonly string[], expected: readonly string[], label = 'los casos'): Check => {
  const same = codes.length === expected.length && codes.every((code, index) => code === expected[index]);
  return check(same, `${label} ${expected.length === 0 ? '(ninguno)' : expected.join(', ')}`, `${label} ${codes.length === 0 ? '(ninguno)' : codes.join(', ')}`);
};

/** Un campo numérico de la respuesta igual al esperado. */
export const numberCheck = (source: unknown, key: string, expected: number, label = key): Check => {
  const value = field(source, key);
  return check(value === expected, `${label} ${expected}`, `${label} ${value === undefined ? '(ausente)' : String(value)}`);
};

/** Un campo de la respuesta (o de un elemento) igual, como texto exacto, al que dice la celda. */
export const textFieldCheck = (source: unknown, key: string, expected: string, label = key): Check => {
  const value = field(source, key);
  const observed = value === undefined ? '(ausente)' : value === null ? 'null' : String(value);
  return check(observed === expected, `${label} ${expected}`, `${label} ${observed}`);
};

/** Respuesta con `items` de ese número de elementos. */
export const countCheck = (result: ApiResult, expected: number): Check => check(itemsOf(result).length === expected, `${expected} casos`, `${itemsOf(result).length} casos`);

/** Elemento de `items` con ese código (o `undefined`). */
export const itemByCode = (result: ApiResult, code: string): unknown => itemsOf(result).find((item) => field(item, 'code') === code);

/**
 * Resultado de una fila a partir de sus comprobaciones. Como `conclude`, pero si alguna no se cumple añade a la nota en qué difiere
 * (lo que la historia espera y lo que se observó), además de la nota propia de la fila.
 */
export const concluded = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere en: ${failing.map((entry) => `se esperaba ${entry.expected}, se observó ${entry.observed}`).join('; ')}`;
  const note = [extra.note, difference].filter((text): text is string => text !== undefined && text !== '').join(' · ');
  return conclude(checks, { ...(note === '' ? {} : { note }), ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }) });
};

/** Códigos (o nombres) de una lista de objetos o de textos, unidos con «, » para compararlos con una celda. */
export const joinedCodes = (values: unknown): string =>
  Array.isArray(values) ? values.map((value) => (typeof value === 'string' ? value : String(field(value, 'code')))).join(', ') : `(no es lista: ${String(values)})`;
