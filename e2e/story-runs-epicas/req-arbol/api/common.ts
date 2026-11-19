import { adminCredentials, call, decodeJwt, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, startSession, TENANT_A, TENANT_B, type Credentials } from '../../../story-runs/support/prepare';
import { REQUIREMENT_TAGS } from '../../../../packages/shared/src/domain';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-REQ-ARBOL: cuentas con su sesión (las de alumnoNN no llevan segundo factor; admin@sigpro.test
// recibe solo un mfaToken), lectura de GET /api/programs/:code/requirements y GET /api/requirements/:code, y las comprobaciones de forma
// que la historia exige a toda respuesta 200 (campos exactos, tipos, valores y orden). Los textos de las celdas se traducen con mapas
// estrictos: cualquier texto que no conozcan LANZA.

export { resetTenants, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';

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

/** Cuentas de las filas, por el texto exacto de la celda «cuenta». */
export const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
]);

/** Cuenta del aislamiento: la del tenant alumno01 o la administradora de alumno02 (dueña de PRG-025 y de REQ-041). */
export const ISOLATION_ACCOUNT: ReadonlyMap<string, 'gestor' | 'alumno02'> = new Map<string, 'gestor' | 'alumno02'>([
  ['gestor@sigpro.test del tenant alumno01', 'gestor'],
  ['alumno02@sigpro.lab del tenant alumno02', 'alumno02'],
]);

/** Cabecera x-tenant de la fila (`undefined`: la fila no la envía). */
export const ISOLATION_HEADER: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['sin cabecera x-tenant', undefined],
  ['con la cabecera x-tenant: alumno02', TENANT_B],
]);

/** Credencial de una fila sin sesión válida: sin cabecera, un texto que no es JWT, el refreshToken de gestor o el mfaToken de admin. */
export type Credential = 'ninguna' | 'texto' | 'refresh' | 'mfa';
export const CREDENTIAL: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', 'ninguna'],
  ['una cabecera Bearer con un texto que no es JWT', 'texto'],
  ['una cabecera Bearer con el refreshToken de gestor@sigpro.test', 'refresh'],
  ['una cabecera Bearer con el mfaToken de admin@sigpro.test', 'mfa'],
]);

/** Respuesta esperada de una fila: estado y, si lo hay, el código del cuerpo. */
export interface Expected {
  readonly status: number;
  readonly code?: string;
}

/** Texto de una respuesta esperada («404 program_not_found»; «401 missing_token»). Cualquier otro texto LANZA. */
export const expectedOf = (text: string): Expected => {
  const match = /^(\d{3})(?: ([a-z_]+))?$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: respuesta «${text}»`);
  return { status: Number(match[1]), ...(match[2] ? { code: match[2] } : {}) };
};

// --- Lecturas de la API -------------------------------------------------------------------------------------------------------

/** `GET /api/programs/:code/requirements` con el token dado como Bearer; `tenant` solo si la fila indica la cabecera x-tenant. */
export const getList = (code: string, token: string | undefined, tenant?: string): Promise<ApiResult> =>
  call('GET', `/programs/${code}/requirements`, { token, ...(tenant === undefined ? {} : { tenant }) });

/** `GET /api/requirements/:code` con el token dado como Bearer; `tenant` solo si la fila indica la cabecera x-tenant. */
export const getRequirement = (code: string, token: string | undefined, tenant?: string): Promise<ApiResult> =>
  call('GET', `/requirements/${code}`, { token, ...(tenant === undefined ? {} : { tenant }) });

/** Lista de requisitos del cuerpo (`items`); vacía si no es una lista. */
export const itemsOf = (body: unknown): readonly Readonly<Record<string, unknown>>[] => {
  const items = field(body, 'items');
  return Array.isArray(items) ? (items as Readonly<Record<string, unknown>>[]) : [];
};

/** Requisito de la lista por su código, o `undefined`. */
export const itemByCode = (body: unknown, code: string): Readonly<Record<string, unknown>> | undefined => itemsOf(body).find((item) => item.code === code);

/** Códigos de una lista de objetos `{ code }` (p. ej. `tests`), en su orden. */
export const codesOfObjects = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value.map((entry) => field(entry, 'code')) : []);

// --- Valores: texto de la celda frente a lo medido -----------------------------------------------------------------------------

/** Celda que significa «lista vacía» («(vacío)» o «(ninguno)»). */
const EMPTY_LIST: ReadonlySet<string> = new Set(['(vacío)', '(ninguno)']);

/** Lista que dice una celda: «TC-001 y TC-008», «maintainability, safety», «TC-012» o «(vacío)». */
export const listOf = (text: string): readonly string[] => {
  if (EMPTY_LIST.has(text)) return [];
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: lista «${text}»`);
  return text.split(' y ').flatMap((part) => part.split(', '));
};

/**
 * Igualdad por TIPO y valor frente a la celda: `null` solo con «null»; un número solo con su número escrito; un texto con su texto;
 * una lista con sus elementos en orden (la celda vacía es la lista vacía).
 */
export const sameValue = (actual: unknown, expected: string): boolean => {
  if (expected === 'null') return actual === null;
  if (Array.isArray(actual)) return sameList(actual, listOf(expected));
  if (typeof actual === 'number') return /^-?\d+$/.test(expected) && Number(expected) === actual;
  if (typeof actual === 'string') return actual === expected;
  if (typeof actual === 'boolean') return expected === (actual ? 'true' : 'false');
  return false;
};

const sameList = (actual: readonly unknown[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((value, index) => value === expected[index]);

/** Un valor del cuerpo frente a la celda, como comprobación con su frase («el campo X vale Y»). */
export const valueCheck = (label: string, actual: unknown, expected: string): Check =>
  check(sameValue(actual, expected), `${label} vale ${expected}`, `${label} vale ${shown(actual)}`);

/** Texto legible de un valor medido (para la frase observada). */
export const shown = (value: unknown): string => (value === undefined ? '(sin campo)' : typeof value === 'string' ? value : JSON.stringify(value));

// --- Comprobaciones de forma (la historia exige estas formas en toda respuesta 200) -------------------------------------------

/** Campos exactos de un requisito en el listado y en el detalle (regla de la historia). */
export const REQUIREMENT_FIELDS: readonly string[] = ['code', 'programCode', 'parentCode', 'title', 'description', 'priority', 'state', 'tags', 'position', 'testCaseCodes', 'tests', 'ncs'];

const STATES: ReadonlySet<string> = new Set(['draft', 'approved', 'verified', 'validated']);
const PRIORITIES: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
const TAG_KEYS: ReadonlySet<string> = new Set<string>(REQUIREMENT_TAGS);
const RESULTS: ReadonlySet<unknown> = new Set<unknown>(['pass', 'fail', 'blocked', null]);
const SEVERITIES: ReadonlySet<string> = new Set(['minor', 'major', 'critical']);
const NC_STATES: ReadonlySet<string> = new Set(['open', 'in_analysis', 'corrective_action', 'closed', 'rejected']);

const sameKeys = (value: unknown, expected: readonly string[]): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && [...expected].sort().every((key, index) => keys[index] === key);
};

/** Un requisito (listado o detalle): exactamente sus campos, con valores de sus listas, `tests` en el orden de `testCaseCodes`. */
export const requirementShape = (value: unknown): readonly Check[] => {
  const exact = sameKeys(value, REQUIREMENT_FIELDS);
  const tags = field(value, 'tags');
  const tests = field(value, 'tests');
  const ncs = field(value, 'ncs');
  const links = field(value, 'testCaseCodes');
  const tagsOk = Array.isArray(tags) && tags.every((tag) => typeof tag === 'string' && TAG_KEYS.has(tag));
  const testsOk = Array.isArray(tests) && tests.every((test) => sameKeys(test, ['code', 'lastResult']) && RESULTS.has(field(test, 'lastResult')));
  const testsInOrder = Array.isArray(tests) && Array.isArray(links) && sameList(codesOfObjects(tests), links as readonly string[]);
  const ncsOk = Array.isArray(ncs) && ncs.every((nc) => sameKeys(nc, ['code', 'severity', 'state']) && SEVERITIES.has(String(field(nc, 'severity'))) && NC_STATES.has(String(field(nc, 'state'))));
  const ncCodes = Array.isArray(ncs) ? ncs.map((nc) => field(nc, 'code') as string) : [];
  const ncsSorted = ncCodes.every((code, index) => index === 0 || (ncCodes[index - 1] as string) < code);
  return [
    check(exact, 'exactamente los 12 campos del requisito', exact ? 'exactamente los 12 campos del requisito' : `campos ${typeof value === 'object' && value !== null ? Object.keys(value).join(', ') : '(no es un objeto)'}`),
    check(
      STATES.has(String(field(value, 'state'))) && PRIORITIES.has(String(field(value, 'priority'))) && tagsOk,
      'state, priority y tags de sus listas',
      `state ${shown(field(value, 'state'))}, priority ${shown(field(value, 'priority'))}, tags ${shown(tags)}`,
    ),
    check(testsOk && testsInOrder, 'tests con code y lastResult, en el orden de testCaseCodes', testsOk && testsInOrder ? 'tests en el orden de testCaseCodes' : `tests ${shown(tests)} frente a testCaseCodes ${shown(links)}`),
    check(ncsOk && ncsSorted, 'ncs con code, severity y state, ordenadas por code', ncsOk && ncsSorted ? 'ncs ordenadas por code' : `ncs ${shown(ncs)}`),
  ];
};

/** Un listado de programa: exactamente `program` (code y name) e `items`; cada elemento con su forma y ordenado por código. */
export const listShape = (body: unknown): readonly Check[] => {
  const program = field(body, 'program');
  const items = itemsOf(body);
  const codes = items.map((item) => item.code as string);
  const sorted = codes.every((code, index) => index === 0 || (codes[index - 1] as string) < code);
  const twoKeys = sameKeys(body, ['program', 'items']);
  const programOk = sameKeys(program, ['code', 'name']);
  return [
    check(twoKeys && programOk, 'dos claves (program con code y name, e items)', twoKeys && programOk ? 'dos claves (program con code y name, e items)' : `claves ${typeof body === 'object' && body !== null ? Object.keys(body).join(', ') : '(sin cuerpo)'}`),
    check(sorted, 'items ordenados por code de menor a mayor', sorted ? 'items ordenados por code' : `orden ${codes.join(', ')}`),
    ...items.flatMap((item) => requirementShape(item)),
  ];
};

/** Un listado o un detalle que no debe traer ningún dato de requisito: ni `items` con elementos ni un campo de requisito ni un código REQ-xxx. */
const REQUIREMENT_DATA_KEYS: ReadonlySet<string> = new Set(['programCode', 'parentCode', 'title', 'description', 'priority', 'state', 'tags', 'position', 'testCaseCodes', 'tests', 'ncs', 'items']);

const dataHits = (value: unknown, path: string): string[] => {
  if (Array.isArray(value)) return value.flatMap((item, index) => dataHits(item, `${path}[${index}]`));
  if (typeof value === 'string') return /^REQ-\d{3}$/.test(value) ? [`${path}=${value}`] : [];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [...(REQUIREMENT_DATA_KEYS.has(key) ? [`${path}.${key}`] : []), ...dataHits(child, `${path}.${key}`)]);
  }
  return [];
};

/** El cuerpo no trae ningún dato del requisito ni del listado, ni al nivel superior ni anidado. */
export const noRequirementData = (result: ApiResult): Check => {
  const hits = dataHits(result.body, '$');
  return check(hits.length === 0, 'el cuerpo no trae ningún dato de requisito', hits.length === 0 ? 'sin datos de requisito' : `trae ${hits.join(', ')}`);
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

/** `traceId` del cuerpo de error (id aleatorio por petición: detalle técnico visible, que la historia no compara). */
export const traceIdOf = (body: unknown): string | undefined => {
  const value = field(body, 'traceId');
  return typeof value === 'string' ? value : undefined;
};

/** Copia del cuerpo sin su `traceId` (el original no se modifica). */
export const withoutTraceId = (body: unknown): unknown => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const copy: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  delete copy.traceId;
  return copy;
};

/** 404 con `code` y `message` iguales a `code` (la regla pide ambos con ese mismo texto). */
export const notFoundCheck = (result: ApiResult, code: string): Check => {
  const message = field(result.body, 'message');
  const ok = result.status === 404 && errorCode(result) === code && message === code;
  return check(ok, `respuesta 404 con code y message ${code}`, `respuesta ${result.status} con code ${String(errorCode(result))} y message ${shown(message)}`);
};

/** Estado y `code` esperados frente a lo observado. */
export const statusCheck = (result: ApiResult, expected: Expected): Check => {
  const code = errorCode(result);
  const observed = `${result.status}${code === undefined ? '' : ` ${code}`}`;
  const ok = result.status === expected.status && (expected.code === undefined || code === expected.code);
  return check(ok, `respuesta ${expected.status}${expected.code === undefined ? '' : ` ${expected.code}`}`, `respuesta ${observed}`);
};

/** «Igual que la de referencia» (estado y cuerpo entero, sin el traceId). */
export const sameAs = (result: ApiResult, reference: ApiResult, label: string): Check => {
  const same = result.status === reference.status && canonicalJson(withoutTraceId(result.body)) === canonicalJson(withoutTraceId(reference.body));
  return check(same, `${label}: estado y cuerpo iguales (sin traceId)`, same ? `${label}: estado y cuerpo iguales (sin traceId)` : `${label}: distinto (${result.status} ${canonicalJson(withoutTraceId(result.body))})`);
};

/** Un valor medido frente a una celda de tipo texto con comillas angulares («…»), cuyo contenido se compara exacto. */
export const quotedText = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  if (!match?.[1]) throw new Error(`celda sin interpretación: texto «${text}» sin comillas «…»`);
  return match[1];
};

/** Descripción HTML sin etiquetas, con los espacios tal como están. */
export const plainOf = (html: unknown): string => (typeof html === 'string' ? html.replace(/<[^>]+>/g, '') : '(no es texto)');

/** Cuerpo del alta de «Programa de aislamiento» (PRG-025 en alumno02), como lo describe la historia. */
export const ISOLATION_PROGRAM_BODY = { name: 'Programa de aislamiento', ownerId: 'u1', startDate: '2025-01-01', endDate: '2025-12-31', budget: 100000 } as const;

/** Preparación común del aislamiento: alumno02@sigpro.lab entra en alumno02 y devuelve su sesión (`undefined` si no entra). */
export const isolationAdmin = (): Promise<AccountSession> => sessionOfAccount(TENANT_B, adminCredentials(TENANT_B));
