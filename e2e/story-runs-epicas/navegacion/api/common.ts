import { adminCredentials, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, type Credentials } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-NAVEGACION: cuentas por nombre (la columna «cuenta» de las historias), la búsqueda
// global, la lectura de sus grupos y la creación del programa de prueba de US-NAVEGACION-003. Lo esperado sale de la historia;
// lo observado, de la respuesta. Las cuentas de `alumnoNN@sigpro.lab` solo existen en su propio tenant (tabla de Preparación).

/** Cuenta que nombra una historia y el tenant en el que se entra con ella (su propio tenant). */
export interface Account {
  readonly credentials: Credentials;
  readonly tenant: string;
}

export const ACCOUNTS: ReadonlyMap<string, Account> = new Map<string, Account>([
  ['gestor@sigpro.test', { credentials: DEMO.gestor, tenant: TENANT_A }],
  ['consultor@sigpro.test', { credentials: DEMO.consultor, tenant: TENANT_A }],
  ['auditor@sigpro.test', { credentials: DEMO.auditor, tenant: TENANT_A }],
  ['alumno01@sigpro.lab', { credentials: adminCredentials(TENANT_A), tenant: TENANT_A }],
  ['alumno02@sigpro.lab', { credentials: adminCredentials(TENANT_B), tenant: TENANT_B }],
]);

export const SEARCH_PATH = '/search';

/** `GET /api/search?q=…` con el token dado (o sin cabecera `Authorization` si no hay token) y la cabecera `x-tenant` dada. `q` undefined = sin el parámetro. */
export const searchAs = (tenant: string, token: string | undefined, q: string | undefined): Promise<ApiResult> =>
  call('GET', SEARCH_PATH, {
    tenant,
    ...(token === undefined ? {} : { token }),
    ...(q === undefined ? {} : { query: `q=${encodeURIComponent(q)}` }),
  });

/** Datos fijos del programa que crea US-NAVEGACION-003 (responsable u1, fechas y presupuesto de la historia). */
export const PROGRAM_DATA = { ownerId: 'u1', startDate: '2027-01-10', endDate: '2027-12-31', budget: 500000 } as const;

/** `POST /api/programs` con el token del administrador del tenant; el nombre lo fija la fila. */
export const createProgram = (tenant: string, token: string, name: string): Promise<ApiResult> =>
  call('POST', '/programs', { tenant, token, body: { name, ...PROGRAM_DATA } });

/** Un grupo de la respuesta: tipo, total y los códigos de sus elementos, en el orden que devuelve la API. */
export interface GroupView {
  readonly kind: string;
  readonly total: number;
  readonly ids: readonly string[];
  readonly items: readonly unknown[];
}

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

/** Texto de un campo del cuerpo; `undefined` si no es texto. */
export const textField = (value: unknown, key: string): string | undefined => {
  const found = field(value, key);
  return typeof found === 'string' ? found : undefined;
};

/** Los grupos de una respuesta de búsqueda; `undefined` si la respuesta no trae una lista `groups`. */
export const groupsOf = (result: ApiResult): readonly GroupView[] | undefined => {
  const groups = field(result.body, 'groups');
  if (!Array.isArray(groups)) return undefined;
  return groups.map((group): GroupView => {
    const items = listOf(field(group, 'items'));
    const total = field(group, 'total');
    return {
      kind: String(field(group, 'kind')),
      total: typeof total === 'number' ? total : Number.NaN,
      ids: items.map((item) => String(textField(item, 'id'))),
      items,
    };
  });
};

/** Forma de un grupo esperado: tipo, total y códigos de sus elementos en orden. */
export interface ExpectedGroup {
  readonly kind: string;
  readonly total: number;
  readonly ids: readonly string[];
}

/** Compara los grupos observados con los que dice la historia (orden, tipo, total y códigos exactos). El observado es lo medido. */
export const groupsCheck = (result: ApiResult, expected: readonly ExpectedGroup[], expectedText: string): Check => {
  const groups = groupsOf(result);
  const observed =
    groups === undefined
      ? 'la respuesta no trae la lista de grupos'
      : groups.length === 0
        ? '(ninguno)'
        : groups.map((group) => `${group.kind} con total ${String(group.total)} (${group.ids.join(', ')})`).join(' y ');
  const same =
    groups !== undefined &&
    groups.length === expected.length &&
    expected.every((want, index) => {
      const got = groups[index];
      return got !== undefined && got.kind === want.kind && got.total === want.total && got.ids.length === want.ids.length && want.ids.every((id, position) => got.ids[position] === id);
    });
  return check(same, expectedText, observed);
};

/** Respuesta 200 con grupos vacíos (la lista `groups` existe y no tiene elementos). */
export const emptyGroupsCheck = (result: ApiResult): Check => {
  const groups = field(result.body, 'groups');
  const empty = Array.isArray(groups) && groups.length === 0;
  return check(empty, 'groups vacío', empty ? 'groups vacío' : `groups ${JSON.stringify(groups) ?? 'ausente'}`);
};

/** Comprobación de estado HTTP en texto corto: «respuesta 200», «respuesta 401 missing_token», etc. */
export const statusCheck = (result: ApiResult, status: number, expectedText: string): Check =>
  check(result.status === status, expectedText, `respuesta ${String(result.status)}`);

/** Sello de tiempo que hace único el nombre de cada fila (la historia pide «una marca de tiempo»). */
export const stamp = (): string => String(Date.now());
