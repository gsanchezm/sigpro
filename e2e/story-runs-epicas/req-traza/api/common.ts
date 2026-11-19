import { call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, preparationFailed, sleep, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-REQ-TRAZA: cuentas con su sesión (cada fila inicia la suya), lecturas de la matriz con
// plazo corto, comprobación de enlaces por pares (antes y después de cada acción) y de las respuestas de error. Los textos de las
// celdas se traducen con mapas `strict`: un texto que no conocen LANZA (una celda nueva no se ignora).

export { TENANT_A, TENANT_B };

// --- Cuentas --------------------------------------------------------------------------------------------------------------------

/** Cuenta de una fila: en qué tenant inicia sesión, sus credenciales y el rol que la API le da en el token. */
export interface Account {
  readonly tenant: string;
  readonly credentials: Credentials;
  readonly role: string;
}

export const GESTOR: Account = { tenant: TENANT_A, credentials: DEMO.gestor, role: 'program_manager' };
export const CONSULTOR: Account = { tenant: TENANT_A, credentials: DEMO.consultor, role: 'consultant' };
export const AUDITOR: Account = { tenant: TENANT_A, credentials: DEMO.auditor, role: 'auditor' };
/** Administrador del tenant (`alumnoNN@sigpro.lab`): no tiene segundo factor. */
export const ALUMNO01: Account = { tenant: TENANT_A, credentials: { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }, role: 'admin' };
export const ALUMNO02: Account = { tenant: TENANT_B, credentials: { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' }, role: 'admin' };

/** Cuenta de la celda «cuenta» (o «gestor@sigpro.test de alumno01», que es la misma cuenta en su tenant). */
export const CUENTA: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['gestor@sigpro.test', GESTOR],
  ['gestor@sigpro.test de alumno01', GESTOR],
  ['consultor@sigpro.test', CONSULTOR],
  ['alumno01@sigpro.lab', ALUMNO01],
  ['alumno02@sigpro.lab', ALUMNO02],
]);

/** Cuenta que representa el rol de la celda «rol» (el administrador del tenant para «admin»). */
export const ROL: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['program_manager', GESTOR],
  ['consultant', CONSULTOR],
  ['auditor', AUDITOR],
  ['admin', ALUMNO01],
]);

/** Cabecera `x-tenant` de la celda «cabecera». */
export const CABECERA: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

// --- Celdas de programa, requisito y caso --------------------------------------------------------------------------------------

export const PROGRAM_CODE: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-003', 'PRG-003'],
  ['PRG-004', 'PRG-004'],
  ['PRG-024', 'PRG-024'],
  ['PRG-025', 'PRG-025'],
  ['PRG-999', 'PRG-999'],
]);

/** Códigos de requisito de las celdas (`PRG-002` aparece en la columna «requisito» a propósito: una petición con un código que no es de requisito). */
export const REQUISITO: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-000', 'REQ-000'],
  ['REQ-001', 'REQ-001'],
  ['REQ-014', 'REQ-014'],
  ['REQ-018', 'REQ-018'],
  ['REQ-021', 'REQ-021'],
  ['REQ-017', 'REQ-017'],
  ['REQ-022', 'REQ-022'],
  ['REQ-023', 'REQ-023'],
  ['REQ-028', 'REQ-028'],
  ['REQ-040', 'REQ-040'],
  ['REQ-041', 'REQ-041'],
  ['REQ-999', 'REQ-999'],
  ['PRG-002', 'PRG-002'],
]);

/** Códigos de caso de prueba de las celdas «caso» (incluidos los que no existen en ningún tenant). */
export const CASO: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-000', 'TC-000'],
  ['TC-002', 'TC-002'],
  ['TC-009', 'TC-009'],
  ['TC-010', 'TC-010'],
  ['TC-011', 'TC-011'],
  ['TC-012', 'TC-012'],
  ['TC-013', 'TC-013'],
  ['TC-016', 'TC-016'],
  ['TC-017', 'TC-017'],
  ['TC-018', 'TC-018'],
  ['TC-019', 'TC-019'],
  ['TC-025', 'TC-025'],
  ['TC-026', 'TC-026'],
  ['TC-999', 'TC-999'],
]);

// --- Listas esperadas (códigos exactos, en el orden de la API) -----------------------------------------------------------------

const seq = (prefix: string, from: number, to: number): readonly string[] =>
  Array.from({ length: to - from + 1 }, (_, index) => `${prefix}-${String(from + index).padStart(3, '0')}`);

/** Lista de requisitos de la celda «requisitos». */
export const LISTA_REQUISITOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['14 elementos, de REQ-001 a REQ-014', seq('REQ', 1, 14)],
  ['14 elementos, de REQ-015 a REQ-028', seq('REQ', 15, 28)],
  ['12 elementos, de REQ-029 a REQ-040', seq('REQ', 29, 40)],
  ['(ninguno)', []],
  ['15 elementos, de REQ-001 a REQ-014 y REQ-041', [...seq('REQ', 1, 14), 'REQ-041']],
]);

/** Lista de casos de prueba de la celda «casos» (de la matriz). */
export const LISTA_CASOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['9 elementos, de TC-001 a TC-009', seq('TC', 1, 9)],
  ['9 elementos, de TC-010 a TC-018', seq('TC', 10, 18)],
  ['7 elementos, de TC-019 a TC-025', seq('TC', 19, 25)],
  ['(ninguno)', []],
]);

/** Casos enlazados a un requisito, en el orden de la API («TC-010 y después TC-017»). */
export const CASOS_ENLAZADOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['TC-012', ['TC-012']],
  ['TC-010 y después TC-017', ['TC-010', 'TC-017']],
  ['TC-011 y después TC-018', ['TC-011', 'TC-018']],
  ['(ninguno)', []],
]);

/** Casos que quedan enlazados tras quitar uno («conserva»). */
export const CONSERVA: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['(ninguno)', []],
  ['TC-010', ['TC-010']],
  ['TC-011', ['TC-011']],
]);

// --- Otras celdas de la matriz -------------------------------------------------------------------------------------------------

/** Lista de la respuesta de la matriz («lista»): el nombre de la propiedad del cuerpo. */
export const LISTA_MATRIZ: ReadonlyMap<string, string> = new Map<string, string>([
  ['requirements', 'requirements'],
  ['testCases', 'testCases'],
  ['links', 'links'],
]);

/** Campos que debe traer cada elemento de la lista («campos»). */
export const CAMPOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['code, title y state', ['code', 'title', 'state']],
  ['code, title y lastResult', ['code', 'title', 'lastResult']],
  ['requirementCode y testCaseCode', ['requirementCode', 'testCaseCode']],
]);

/** Resultado de la última ejecución («resultado»). */
export const RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['pass', 'pass'],
  ['fail', 'fail'],
  ['blocked', 'blocked'],
]);

/** Credencial que envía la fila en la cabecera Authorization («credencial»). */
export type Credential = { readonly kind: 'none' } | { readonly kind: 'text' } | { readonly kind: 'refresh' };

export const CREDENCIAL: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'none' }],
  ['una cabecera Bearer con un texto que no es JWT', { kind: 'text' }],
  ['una cabecera Bearer con el refreshToken de gestor@sigpro.test', { kind: 'refresh' }],
]);

/** Respuesta esperada («respuesta»): código HTTP, `code` de error y, si se da, el motivo por campo. */
export interface Answer {
  readonly status: number;
  readonly code?: string;
  readonly sinCuerpo?: boolean;
  readonly errors?: Readonly<Record<string, string>>;
  /** La historia dice que el `message` del cuerpo es igual al código (solo entonces se comprueba). */
  readonly mensaje?: boolean;
}

export const RESPUESTA: ReadonlyMap<string, Answer> = new Map<string, Answer>([
  ['401 con el código missing_token', { status: 401, code: 'missing_token' }],
  ['401 con el código invalid_token', { status: 401, code: 'invalid_token' }],
  ['204 sin cuerpo', { status: 204, sinCuerpo: true }],
  ['404 con el código requirement_not_found', { status: 404, code: 'requirement_not_found', mensaje: true }],
  ['422 con el código validation_failed y el motivo differentProgram en testCaseCode', { status: 422, code: 'validation_failed', errors: { testCaseCode: 'differentProgram' } }],
]);

/** Enlace esperado («enlace»): «aparece» / «no aparece» (003) y «contiene» / «no contiene» (001, con el par REQ-028 con TC-010). */
export const APARECE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
]);
export const CONTIENE_ENLACE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['contiene el enlace de REQ-028 con TC-010', true],
  ['no contiene el enlace de REQ-028 con TC-010', false],
]);

/** «situacion» de la fila (004, rol sin permiso): el enlace sigue o no está. */
export const SITUACION: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['sigue apareciendo', true],
  ['no aparece', false],
]);

// --- Lecturas con plazo corto ---------------------------------------------------------------------------------------------------

/** Plazo de cada lectura de la API: una lectura que no llega en este tiempo queda «sin leer» (estado 0), nunca cumplida. */
export const READ_MS = 2_000;

/** Lectura con plazo: si no responde a tiempo, devuelve estado 0 («sin leer»). */
export const readWithin = (pending: Promise<ApiResult>): Promise<ApiResult> =>
  Promise.race([pending, sleep(READ_MS).then((): ApiResult => ({ status: 0, body: null, ms: READ_MS }))]);

/** Matriz de un programa con el token (o sin él) y la cabecera `x-tenant` dadas. */
export const traceabilityOf = (program: string, tenant: string, token: string | undefined): Promise<ApiResult> =>
  readWithin(call('GET', `/programs/${program}/traceability`, { tenant, ...(token === undefined ? {} : { token }) }));

// --- Sesiones -------------------------------------------------------------------------------------------------------------------

export interface Signed {
  readonly token: string | undefined;
  readonly refreshToken: string | undefined;
  readonly role: string | undefined;
  readonly last: ApiResult;
}

/** Rol que la API escribe en el token de acceso (el cuerpo del JWT, sin verificar la firma). */
const roleOfToken = (token: string): string | undefined => {
  const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { readonly role?: unknown };
  return typeof payload.role === 'string' ? payload.role : undefined;
};

/** Inicio de sesión de la cuenta en su tenant (`POST /api/auth/login`). */
export const signIn = async (account: Account): Promise<Signed> => {
  const started = await startSession(account.tenant, account.credentials);
  const token = started.session?.accessToken;
  return { token, refreshToken: started.session?.refreshToken, role: token === undefined ? undefined : roleOfToken(token), last: started.result };
};

/** Reinicio de alumno01 (y de alumno02 si la fila lo usa) antes de cada fila. */
export const resetAlumno01 = (): Promise<void> => resetTenants([TENANT_A]);
export const resetBoth = (): Promise<void> => resetTenants([TENANT_A, TENANT_B]);

/**
 * Preparación de aislamiento: alumno02 crea REQ-041 en PRG-001 con «Requisito de aislamiento». Devuelve el fallo de preparación
 * si no se produce (201 y código REQ-041), o `undefined` si todo va bien. Reinicia ambos tenants antes.
 */
export const prepareIsolation = async (expected: string): Promise<Outcome | undefined> => {
  await resetBoth();
  const owner = await signIn(ALUMNO02);
  if (owner.token === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02', owner.last);
  const created = await call('POST', '/requirements', { tenant: TENANT_B, token: owner.token, body: { programCode: 'PRG-001', title: 'Requisito de aislamiento' } });
  if (created.status !== 201 || field(created.body, 'code') !== 'REQ-041') return preparationFailed(expected, 'alumno02 crea REQ-041 en PRG-001', created);
  return undefined;
};

// --- Enlaces por pares ----------------------------------------------------------------------------------------------------------

export interface Pair {
  readonly requirementCode: string;
  readonly testCaseCode: string;
}

export const arrayOf = (body: unknown, key: string): readonly unknown[] => {
  const value = field(body, key);
  return Array.isArray(value) ? value : [];
};

/** Enlaces de la matriz, tal como llegan (en el orden de la API). */
export const linksOf = (body: unknown): readonly Pair[] =>
  arrayOf(body, 'links').map((item) => ({ requirementCode: String(field(item, 'requirementCode')), testCaseCode: String(field(item, 'testCaseCode')) }));

/** Códigos de «requirements» o «testCases». */
export const codesOf = (body: unknown, key: 'requirements' | 'testCases'): readonly string[] => arrayOf(body, key).map((item) => String(field(item, 'code')));

export const pairKey = (pair: Pair): string => `${pair.requirementCode}|${pair.testCaseCode}`;

/** Cuántas veces aparece el par en la lista de enlaces (0 o 1 en una matriz sana). */
export const countPair = (links: readonly Pair[], requirementCode: string, testCaseCode: string): number =>
  links.filter((pair) => pair.requirementCode === requirementCode && pair.testCaseCode === testCaseCode).length;

/** Dos listas de enlaces con los mismos pares, sin importar el orden (para comparar antes y después de una acción). */
export const sameLinkSet = (left: readonly Pair[], right: readonly Pair[]): boolean => {
  const keys = (pairs: readonly Pair[]): string => pairs.map(pairKey).sort().join(';');
  return keys(left) === keys(right);
};

/** Campos (claves) de un elemento de la matriz, ordenados. */
export const keysOf = (item: unknown): readonly string[] => (typeof item === 'object' && item !== null ? Object.keys(item).sort() : []);

/** Dos listas de enlaces iguales, par a par y en orden. */
export const samePairs = (left: readonly Pair[], right: readonly Pair[]): boolean => left.length === right.length && left.every((pair, index) => pairKey(pair) === pairKey(right[index] ?? pair));

/** Casos enlazados a un requisito, en el orden de la lista. */
export const casesOf = (links: readonly Pair[], requirementCode: string): readonly string[] => links.filter((pair) => pair.requirementCode === requirementCode).map((pair) => pair.testCaseCode);

/** La lista va ordenada por requisito y, dentro de cada requisito, por caso. */
export const sortedPairs = (links: readonly Pair[]): boolean =>
  links.every((pair, index) => {
    const previous = links[index - 1];
    if (previous === undefined) return true;
    return previous.requirementCode < pair.requirementCode || (previous.requirementCode === pair.requirementCode && previous.testCaseCode <= pair.testCaseCode);
  });

export const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((code, index) => code === right[index]);

/** Texto de una lista de códigos: «(ninguno)» si está vacía, o el recuento y los códigos. */
export const describeList = (items: readonly string[]): string => (items.length === 0 ? '(ninguno)' : `${items.length} elementos: ${items.join(', ')}`);

/** Texto de los enlaces: «REQ-022 con TC-010, REQ-022 con TC-017», o «(ninguno)». */
export const describePairs = (pairs: readonly Pair[]): string => (pairs.length === 0 ? '(ninguno)' : pairs.map((pair) => `${pair.requirementCode} con ${pair.testCaseCode}`).join(', '));

/** Lista de códigos de `requirements` o `testCases` frente a la celda; exige que la lista exista (una lectura fallida no cuenta). */
export const codeListCheck = (key: 'requirements' | 'testCases', body: unknown, expected: readonly string[], cellText: string): Check => {
  const present = Array.isArray(field(body, key));
  const observed = codesOf(body, key);
  return check(present && sameList(observed, expected), `${key} contiene ${cellText}`, present ? `${key}: ${describeList(observed)}` : `${key}: (sin lista)`);
};

/** Pares de `links` frente a los esperados, y la presencia del par pedido. */
export const pairCheck = (links: readonly Pair[], requirementCode: string, testCaseCode: string, present: boolean): Check => {
  const count = countPair(links, requirementCode, testCaseCode);
  return check(
    present ? count === 1 : count === 0,
    present ? `links contiene el enlace de ${requirementCode} con ${testCaseCode}` : `links no contiene el enlace de ${requirementCode} con ${testCaseCode}`,
    `${requirementCode} con ${testCaseCode}: ${count === 0 ? 'no está en links' : `${count} vez(es) en links`}`,
  );
};

// --- Respuestas de error --------------------------------------------------------------------------------------------------------

/** Claves que puede traer un cuerpo de error (ninguna es un dato del requisito, del caso ni de la matriz). */
const ERROR_KEYS: readonly string[] = ['statusCode', 'error', 'message', 'code', 'errors', 'traceId'];

export const messageOf = (result: ApiResult): string | undefined => {
  const message = field(result.body, 'message');
  return typeof message === 'string' ? message : undefined;
};

/** Estado, `code` y `message` (iguales al código en la API), más el motivo por campo si la celda lo pide; `sinCuerpo` para los 204. */
export const answerChecks = (answer: Answer, result: ApiResult): Check[] => {
  const statusCheck = check(result.status === answer.status, `respuesta ${answer.status}`, `respuesta ${result.status}`);
  if (answer.sinCuerpo === true) return [statusCheck, check(result.body === null, 'sin cuerpo', result.body === null ? 'sin cuerpo' : 'con cuerpo')];
  if (answer.code === undefined) return [statusCheck];
  const code = answer.code;
  const checks: Check[] = [
    statusCheck,
    check(errorCode(result) === code, `código ${code}`, `código ${errorCode(result) ?? '(sin código)'}`),
  ];
  if (answer.mensaje === true) checks.push(check(messageOf(result) === code, `message ${code}`, `message ${messageOf(result) ?? '(sin message)'}`));
  for (const [field_, value] of Object.entries(answer.errors ?? {})) {
    const observed = field(field(result.body, 'errors'), field_);
    checks.push(check(observed === value, `errors.${field_} ${value}`, `errors.${field_} ${typeof observed === 'string' ? observed : '(ausente)'}`));
  }
  return checks;
};

/** El cuerpo solo trae el error (ni requisito, ni caso, ni matriz): «no trae ningún dato». */
export const onlyErrorBody = (result: ApiResult, label: string): Check => {
  const extra = typeof result.body === 'object' && result.body !== null ? Object.keys(result.body).filter((key) => !ERROR_KEYS.includes(key)) : [];
  const present = result.body !== null && extra.length === 0;
  return check(present, `el cuerpo no trae ${label}`, present ? 'el cuerpo solo trae el error' : `el cuerpo trae ${extra.length > 0 ? extra.join(', ') : '(sin cuerpo)'}`);
};

// --- Resultado de la fila ---------------------------------------------------------------------------------------------------------

/**
 * Concluye una fila a partir de sus comprobaciones. Si alguna falla, la nota dice en qué difiere (lo esperado frente a lo observado),
 * además de la nota que dé la fila.
 */
export const concluir = (checks: readonly Check[], extra: { readonly note?: string; readonly evidence?: Readonly<Record<string, unknown>> } = {}): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => `esperaba «${entry.expected}»; se observó «${entry.observed}»`);
  const note = [extra.note, ...failed].filter((part): part is string => part !== undefined && part !== '').join(' · ');
  return conclude(checks, {
    ...(note === '' ? {} : { note }),
    ...(extra.evidence === undefined ? {} : { evidence: extra.evidence }),
  });
};

/** Cuerpo recortado para la evidencia (sin tokens: las respuestas de la matriz no los traen). */
export const bodyOf = (result: ApiResult): string => JSON.stringify(result.body ?? null).slice(0, 300);

/** Prefija la frase de cada comprobación (para distinguir, p. ej., la comprobación del token MFA de la de la respuesta normal). */
export const prefixed = (prefix: string, checks: readonly Check[]): Check[] => checks.map((entry) => ({ ...entry, expected: `${prefix}: ${entry.expected}`, observed: `${prefix}: ${entry.observed}` }));

/**
 * Requisitos del programa sin ningún caso enlazado, según la API (lectura con la cuenta dada). `undefined` si la lectura falla: quien
 * llama no lo da por cumplido.
 */
export const uncoveredRequirements = async (account: Account, program: string): Promise<readonly string[] | undefined> => {
  const signed = await signIn(account);
  if (signed.token === undefined) return undefined;
  const read = await traceabilityOf(program, account.tenant, signed.token);
  if (read.status !== 200) return undefined;
  const covered = new Set(linksOf(read.body).map((pair) => pair.requirementCode));
  return codesOf(read.body, 'requirements').filter((code) => !covered.has(code));
};
