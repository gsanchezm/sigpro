import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-PROVEEDORES: cuentas del seed con su tenant, inicio de sesión, lectura de la lista de
// GET /api/suppliers y comprobaciones. Las celdas se traducen con mapas `strict(...)` (un texto desconocido LANZA).

export { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';

/** Cuenta de una fila: su tenant y sus credenciales del seed. */
export interface Account {
  readonly tenant: string;
  readonly credentials: Credentials;
}

/** Cuentas que citan las filas. alumno01 y alumno02 son administradores de su tenant, sin segundo factor. */
export const ACCOUNTS: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['gestor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.gestor }],
  ['consultor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.consultor }],
  ['auditor@sigpro.test', { tenant: TENANT_A, credentials: DEMO.auditor }],
  ['alumno01@sigpro.lab', { tenant: TENANT_A, credentials: { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' } }],
  ['alumno02@sigpro.lab', { tenant: TENANT_B, credentials: { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' } }],
]);

const account = (key: string): Account => {
  const found = ACCOUNTS.get(key);
  if (found === undefined) throw new Error(`cuenta sin definir en el manejador: ${key}`);
  return found;
};

/** Gestor de programas de alumno01: la cuenta que usan casi todas las filas. */
export const GESTOR = account('gestor@sigpro.test');

/** Sesión de una cuenta: el token de acceso (o `undefined`) y el rol que devuelve el inicio de sesión. */
export interface Session {
  readonly token: string | undefined;
  readonly role: string | undefined;
  /** Respuesta cruda del inicio de sesión (para explicar un fallo de preparación). */
  readonly last: ApiResult;
}

/** Inicia sesión con la cuenta en su propio tenant (sin segundo factor: ninguna cuenta de esta épica lo usa). */
export const sessionFor = async (who: Account): Promise<Session> => {
  const started = await startSession(who.tenant, who.credentials);
  const role = field(field(started.result.body, 'user'), 'role');
  return { token: started.session?.accessToken, role: typeof role === 'string' ? role : undefined, last: started.result };
};

/**
 * `GET /api/suppliers` con los parámetros dados (`''` cuenta como valor vacío y se envía tal cual). Sin `token` no hay cabecera
 * Authorization. `tenant` va en la cabecera x-tenant.
 */
export const suppliersCall = (tenant: string, token: string | undefined, params: Readonly<Record<string, string>>): Promise<ApiResult> =>
  call('GET', '/suppliers', { tenant, ...(token === undefined ? {} : { token }), query: new URLSearchParams(params).toString() });

/** Elementos de la lista de proveedores (vacío si el cuerpo no es un array). */
export const suppliersOf = (result: ApiResult): readonly unknown[] => (Array.isArray(result.body) ? (result.body as readonly unknown[]) : []);

/** Nombres de los proveedores, en el orden en que llegan. */
export const namesOf = (items: readonly unknown[]): readonly string[] => items.map((item) => String(field(item, 'name')));

/** Un campo de un proveedor o de un contrato, como texto. */
export const textOf = (item: unknown, key: string): string => String(field(item, key));

/** Dos listas de texto iguales y en el mismo orden. */
export const sameList = (actual: readonly string[], expected: readonly string[]): boolean => actual.length === expected.length && actual.every((value, index) => value === expected[index]);

/** Identificadores de la lista de proveedores, en el orden en que llegan. */
export const idsOf = (items: readonly unknown[]): readonly string[] => items.map((item) => textOf(item, 'id'));

/** Identificadores de los seis proveedores del seed, en el orden por nombre (historia 001, tabla de la fila 2). */
export const SIX_IDS: readonly string[] = ['s1', 's5', 's3', 's6', 's4', 's2'];

/** Texto legible de una lista de nombres. */
export const describeNames = (names: readonly string[]): string => (names.length === 0 ? 'una lista vacía' : names.join(', '));

/** La lista de nombres es exactamente la esperada (en orden). */
export const namesCheck = (names: readonly string[], expected: readonly string[]): Check =>
  check(sameList(names, expected), describeNames(expected), describeNames(names));

/** El cuerpo es una lista de proveedores (un array), no un error. */
export const isListCheck = (body: unknown): Check => check(Array.isArray(body), 'una lista de proveedores', Array.isArray(body) ? 'una lista de proveedores' : 'sin lista de proveedores');

// --- Textos de las celdas que se traducen --------------------------------------------------------------------------------------------

/** Los seis proveedores del seed, ordenados por nombre (orden alfabético del español). */
export const SIX: readonly string[] = ['Aeronáutica Levante S.L.', 'Cibertáctica Norte', 'Electrónica del Cantábrico', 'Logística Marítima Atlas', 'Optrónica Meseta S.L.', 'Sistemas Ibéricos S.A.'];

/** Resultado esperado de una búsqueda: los nombres en orden y, si la historia lo dice, el NIF por el que se encuentra. */
export interface Expected {
  readonly names: readonly string[];
  readonly nif?: string;
}

/** Texto del resultado de la historia → lo que la lista debe traer. */
export const RESULTADOS: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['solo Aeronáutica Levante S.L.', { names: ['Aeronáutica Levante S.L.'] }],
  ['solo Cibertáctica Norte', { names: ['Cibertáctica Norte'] }],
  ['solo Cibertáctica Norte, por su NIF B15555555', { names: ['Cibertáctica Norte'], nif: 'B15555555' }],
  ['solo Logística Marítima Atlas', { names: ['Logística Marítima Atlas'] }],
  ['solo Sistemas Ibéricos S.A.', { names: ['Sistemas Ibéricos S.A.'] }],
  ['Aeronáutica Levante S.L. y Optrónica Meseta S.L., en ese orden', { names: ['Aeronáutica Levante S.L.', 'Optrónica Meseta S.L.'] }],
  ['Electrónica del Cantábrico y Optrónica Meseta S.L., en ese orden', { names: ['Electrónica del Cantábrico', 'Optrónica Meseta S.L.'] }],
  ['una lista vacía', { names: [] }],
  ['los seis proveedores', { names: SIX }],
]);

/** Texto del parámetro `q` de la historia → valor que se envía (los paréntesis de la historia nombran lo que se envía). */
export const QUERIES: ReadonlyMap<string, string> = new Map<string, string>([
  ['IBÉRICOS', 'IBÉRICOS'],
  ['ibéricos', 'ibéricos'],
  ['b1555', 'b1555'],
  ['B1111111', 'B1111111'],
  ['B11111111', 'B11111111'],
  ['B111111111', 'B111111111'],
  ['ÓN', 'ÓN'],
  ['zzzzzz', 'zzzzzz'],
  ['(s.l. con espacios delante y detrás)', '  s.l.  '],
  ['(tres espacios)', '   '],
  ['(vacío)', ''],
]);

/** Código de programa de la historia → valor del parámetro `program` (vacío = el parámetro llega vacío). */
export const PROGRAMAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-003', 'PRG-003'],
  ['PRG-010', 'PRG-010'],
  ['PRG-011', 'PRG-011'],
  ['PRG-012', 'PRG-012'],
  ['PRG-013', 'PRG-013'],
  ['(vacío)', ''],
]);
