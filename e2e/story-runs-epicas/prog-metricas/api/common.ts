import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, type Check } from '../../support/checks';
import type { ManifestRow } from '../../core/framework';

// Piezas comunes de EP-PROG-METRICAS (API y, por reutilización, web y móvil): cuentas con su sesión, cambios que la historia
// nombra como preparación («alumno01@sigpro.lab archiva PRG-001…»), lectura de `kpis` del resumen de misión y comprobaciones.
// Los textos de las celdas se traducen con mapas estrictos: un texto que no conocen LANZA (una celda nueva no se ignora).

export { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';

/** Administradores de cada tenant de la épica: `alumnoNN@sigpro.lab`, con la contraseña del seed y sin segundo factor. */
export const ADMIN_ALUMNO01: Credentials = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' };
export const ADMIN_ALUMNO02: Credentials = { email: 'alumno02@sigpro.lab', password: 'Alumno1234!' };
const ADMIN_OF: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  [TENANT_A, ADMIN_ALUMNO01],
  [TENANT_B, ADMIN_ALUMNO02],
]);

/** Cuentas de las filas de API (la celda `cuenta`). La contraseña sale de la celda `contraseña`, no de aquí. */
export const ACCOUNTS: ReadonlyMap<string, true> = new Map<string, true>([
  ['gestor@sigpro.test', true],
  ['consultor@sigpro.test', true],
  ['auditor@sigpro.test', true],
  ['alumno01@sigpro.lab', true],
]);

/** Los 24 códigos del seed de alumno01 (PRG-001 a PRG-024). */
export const PROGRAM_CODES: readonly string[] = Array.from({ length: 24 }, (_, index) => `PRG-${String(index + 1).padStart(3, '0')}`);

/** Sesión de una cuenta: su access token, o `undefined` si el inicio de sesión no lo dio (con su última respuesta). */
export interface Session {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/** Un paso de preparación que no se cumplió: qué se intentaba y la respuesta cruda. */
export interface Failed {
  readonly step: string;
  readonly result: ApiResult;
}

/** Cambio que la historia nombra como preparación: devuelve su respuesta, o `undefined` si la fila no cambia nada. */
export type Change = (token: string) => Promise<ApiResult | undefined>;

/** Inicia sesión con una cuenta del tenant (remember por defecto, como la API). */
export const sessionAs = async (tenant: string, credentials: Credentials): Promise<Session> => {
  const started = await startSession(tenant, credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Sesión del administrador del tenant (alumno01@sigpro.lab o alumno02@sigpro.lab). */
export const adminSession = (tenant: string): Promise<Session> => {
  const credentials = ADMIN_OF.get(tenant);
  if (credentials === undefined) throw new Error(`no hay administrador conocido para el tenant ${tenant}`);
  return sessionAs(tenant, credentials);
};

/** ¿Respondió 2xx? (las preparaciones se comprueban así). */
export const isOk = (result: ApiResult): boolean => result.status >= 200 && result.status < 300;

/** Lista de `items` de una respuesta (vacía si no es una lista). */
export const itemsOf = (result: ApiResult): readonly unknown[] => {
  const items = field(result.body, 'items');
  return Array.isArray(items) ? items : [];
};

/** Una petición del tenant alumno01 con el token dado. */
const act = (method: 'POST' | 'DELETE', path: string, token: string, body?: unknown): Promise<ApiResult> =>
  call(method, path, { tenant: TENANT_A, token, ...(body === undefined ? {} : { body }) });

/** `GET /api/mission/summary`: la cabecera `x-tenant` es la que pide la fila; el token es el de la cuenta de la fila. */
export const summaryOf = (token: string | undefined, headerTenant: string = TENANT_A): Promise<ApiResult> =>
  call('GET', '/mission/summary', { tenant: headerTenant, ...(token === undefined ? {} : { token }) });

// --- Cifras de `kpis` ---------------------------------------------------------------------------------------------------------

/** Columna de la historia → nombre de la cifra en `kpis`. */
export const KPI_OF_COLUMN: ReadonlyMap<string, string> = new Map<string, string>([
  ['programas', 'programsTotal'],
  ['activos', 'activePrograms'],
  ['avance', 'programsProgress'],
  ['hitos_cumplidos', 'milestonesDone'],
  ['hitos', 'milestonesTotal'],
  ['nc_abiertas', 'ncOpen'],
  ['nc_total', 'ncTotal'],
]);

/** El número de una celda (solo dígitos; otra forma lanza). */
export const numberOf = (row: ManifestRow, column: string): number => {
  const text = cell(row, column);
  if (!/^\d+$/.test(text)) throw new Error(`celda sin interpretación: «${text}» en la columna ${column} no es un número`);
  return Number(text);
};

/** Valor de una cifra de `kpis` tal como lo devuelve la API (sin convertir). */
export const kpiValue = (result: ApiResult, kpi: string): unknown => field(field(result.body, 'kpis'), kpi);

/** Una cifra de `kpis` igual al número esperado. */
export const kpiCheck = (result: ApiResult, kpi: string, expected: number): Check => {
  const observed = kpiValue(result, kpi);
  return check(observed === expected, `${kpi} ${expected}`, `${kpi} ${String(observed)}`);
};

/** Una comprobación por cada cifra que la fila nombra (columna presente), con el número de su celda. */
export const kpiChecksOf = (result: ApiResult, row: ManifestRow): Check[] =>
  [...KPI_OF_COLUMN].filter(([column]) => row.cells[column] !== undefined).map(([column, kpi]) => kpiCheck(result, kpi, numberOf(row, column)));

/** Texto de lo que la fila nombra: «programsTotal 24, activePrograms 12…». */
export const kpiTextOf = (row: ManifestRow): string =>
  [...KPI_OF_COLUMN]
    .filter(([column]) => row.cells[column] !== undefined)
    .map(([column, kpi]) => `${kpi} ${numberOf(row, column)}`)
    .join(', ');

// --- Cambios de preparación ---------------------------------------------------------------------------------------------------

/** `POST /api/programs/PRG-001/archive` (alumno01 con su administrador). */
export const archivePrg001: Change = (token) => act('POST', '/programs/PRG-001/archive', token);
/** `POST /api/programs/PRG-001/duplicate` (alumno01 con su administrador). */
export const duplicatePrg001: Change = (token) => act('POST', '/programs/PRG-001/duplicate', token);
/** `DELETE /api/programs/PRG-001` (alumno01 con su administrador). */
export const deletePrg001: Change = (token) => act('DELETE', '/programs/PRG-001', token);

/** Cambios de programas de la historia 001 (Esquema 2): el texto de la celda `cambio` es la clave, exacta. */
export const PROGRAM_CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['no hay ningún cambio en los programas', async () => undefined],
  ['alumno01@sigpro.lab archiva PRG-001 con POST /api/programs/PRG-001/archive', archivePrg001],
  ['alumno01@sigpro.lab duplica PRG-001 con POST /api/programs/PRG-001/duplicate', duplicatePrg001],
  ['alumno01@sigpro.lab elimina PRG-001 con DELETE /api/programs/PRG-001', deletePrg001],
]);

/** Transiciones de NC de la historia 001 (Esquema 5). El texto incluye las comillas invertidas que trae la celda. */
export const NC_CHANGES: ReadonlyMap<string, Change> = new Map<string, Change>([
  ['alumno01@sigpro.lab pasa NC-001 a `in_analysis` con POST /api/nc/NC-001/transition', (token) => act('POST', '/nc/NC-001/transition', token, { to: 'in_analysis' })],
  ['alumno01@sigpro.lab pasa NC-002 a `rejected` con POST /api/nc/NC-002/transition', (token) => act('POST', '/nc/NC-002/transition', token, { to: 'rejected' })],
  [
    'alumno01@sigpro.lab pasa NC-003 a `closed` con POST /api/nc/NC-003/transition y el comentario `Acción correctiva verificada por calidad`',
    (token) => act('POST', '/nc/NC-003/transition', token, { to: 'closed', comment: 'Acción correctiva verificada por calidad' }),
  ],
]);

/** Borra los 24 programas de alumno01, uno a uno. Devuelve el primero que no responde 2xx. */
export const removeAll = async (token: string): Promise<Failed | undefined> => {
  for (const code of PROGRAM_CODES) {
    const result = await act('DELETE', `/programs/${code}`, token);
    if (!isOk(result)) return { step: `eliminar ${code} con DELETE /api/programs/${code}`, result };
  }
  return undefined;
};

/** Archiva los programas en estado activo de alumno01. La historia dice 12: si no son 12, la preparación no se cumple. */
export const archiveActive = async (token: string): Promise<Failed | undefined> => {
  const listed = await call('GET', '/programs', { tenant: TENANT_A, token, query: 'pageSize=100' });
  if (!isOk(listed)) return { step: 'listar los programas', result: listed };
  const active = itemsOf(listed)
    .filter((item) => field(item, 'status') === 'active')
    .map((item) => String(field(item, 'code')));
  if (active.length !== 12) return { step: `listar los 12 programas activos (hay ${active.length})`, result: listed };
  for (const code of active) {
    const result = await act('POST', `/programs/${code}/archive`, token);
    if (!isOk(result)) return { step: `archivar ${code} con POST /api/programs/${code}/archive`, result };
  }
  return undefined;
};
