import { adminCredentials, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, conclude, errorsOf, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-NC-GESTION. Todo va al tenant alumno01 (cabecera x-tenant). Lo que la historia da por
// hecho (los mensajes de los campos, los códigos de error, los estados, los datos del seed) se escribe aquí desde el TEXTO de la
// historia y del seed (`apps/api/src/seed/data.ts`), no desde lo que devuelve la app. Las listas de una celda («(vacío)», etc.) se
// traducen con mapas estrictos: una celda sin mapa LANZA.

export { TENANT_A, resetTenants };

/** Sesión de una cuenta: su access token (o `undefined` si el login no lo dio), su rol según la respuesta y la última respuesta cruda. */
export interface Actor {
  readonly token: string | undefined;
  readonly role: string | undefined;
  /** Id de la persona que inicia sesión (`user.id` de la respuesta del login): es el `authorId` de sus comentarios. */
  readonly id: string | undefined;
  readonly last: ApiResult;
}

/** Login de una cuenta en alumno01 (cabecera x-tenant). La sesión la inicia la propia fila. */
export const actorOf = async (credentials: Credentials): Promise<Actor> => {
  const started = await startSession(TENANT_A, credentials);
  const user = field(started.result.body, 'user');
  const role = field(user, 'role');
  const id = field(user, 'id');
  return {
    token: started.session?.accessToken,
    role: typeof role === 'string' ? role : undefined,
    id: typeof id === 'string' ? id : undefined,
    last: started.result,
  };
};

/** Petición a la API en alumno01 con el token dado (o sin cabecera Authorization si es `undefined`). */
export const request = (token: string | undefined, method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<ApiResult> =>
  call(method, path, {
    tenant: TENANT_A,
    ...(token === undefined ? {} : { token }),
    ...(body === undefined ? {} : { body }),
  });

export const createNc = (token: string | undefined, body: unknown): Promise<ApiResult> => request(token, 'POST', '/nc', body);
export const listNc = (token: string | undefined): Promise<ApiResult> => request(token, 'GET', '/nc');
export const detailNc = (token: string | undefined, code: string): Promise<ApiResult> => request(token, 'GET', `/nc/${code}`);
export const patchNc = (token: string | undefined, code: string, body?: unknown): Promise<ApiResult> => request(token, 'PATCH', `/nc/${code}`, body);
export const commentNc = (token: string | undefined, code: string, body: unknown): Promise<ApiResult> => request(token, 'POST', `/nc/${code}/comments`, body);
export const transitionNc = (token: string | undefined, code: string, body: unknown): Promise<ApiResult> => request(token, 'POST', `/nc/${code}/transition`, body);

/** Cuentas de las celdas «correo» (las del seed de alumno01 y la cuenta de administración de alumno01). */
export const ACCOUNT_CELLS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Rol que nombran las celdas «rol» (el de la respuesta del login). */
export const ROLE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['admin', 'admin'],
  ['program_manager', 'program_manager'],
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
]);

/** Estado de una no conformidad (`state`) de una respuesta 200 con cuerpo de no conformidad; `undefined` si no hay estado legible. */
export const stateOf = (result: ApiResult): string | undefined => {
  const state = field(result.body, 'state');
  return result.status === 200 && typeof state === 'string' ? state : undefined;
};

/** Campos que comparan «el resto de datos sin cambios» (la lectura de la no conformidad, sin ids de comentario). */
export interface NcFields {
  readonly code: string | undefined;
  readonly programCode: string | undefined;
  readonly programName: string | undefined;
  readonly severity: string | undefined;
  readonly description: string | undefined;
  readonly state: string | undefined;
  readonly assigneeId: string | null | undefined;
  readonly assigneeName: string | null | undefined;
  readonly commentCount: number | undefined;
  readonly testRunId: string | null | undefined;
  readonly createdAt: string | undefined;
}

const textField = (body: unknown, key: string): string | undefined => {
  const value = field(body, key);
  return typeof value === 'string' ? value : undefined;
};

const nullableField = (body: unknown, key: string): string | null | undefined => {
  const value = field(body, key);
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
};

/** Campos de una no conformidad (de la respuesta de alta, detalle o PATCH). `undefined` si el cuerpo no es una no conformidad. */
export const fieldsOf = (result: ApiResult): NcFields | undefined => {
  const commentCount = field(result.body, 'commentCount');
  if (result.status < 200 || result.status >= 300 || typeof field(result.body, 'code') !== 'string') return undefined;
  return {
    code: textField(result.body, 'code'),
    programCode: textField(result.body, 'programCode'),
    programName: textField(result.body, 'programName'),
    severity: textField(result.body, 'severity'),
    description: textField(result.body, 'description'),
    state: textField(result.body, 'state'),
    assigneeId: nullableField(result.body, 'assigneeId'),
    assigneeName: nullableField(result.body, 'assigneeName'),
    commentCount: typeof commentCount === 'number' ? commentCount : undefined,
    testRunId: nullableField(result.body, 'testRunId'),
    createdAt: textField(result.body, 'createdAt'),
  };
};

/** Una lectura de una no conformidad mostrada como texto para las frases de observado (sin valores inventados). */
export const showValue = (value: unknown): string => (value === undefined ? '(ausente)' : value === null ? 'null' : typeof value === 'string' ? value : JSON.stringify(value));

/** Igualdad de los campos indicados entre dos lecturas (ambas deben existir). */
export const sameFields = (before: NcFields | undefined, after: NcFields | undefined, keys: readonly (keyof NcFields)[]): boolean =>
  before !== undefined && after !== undefined && keys.every((key) => before[key] === after[key]);

/** Comprobación de un campo frente a lo que dice la historia. Un campo AUSENTE (`undefined`) nunca cumple: no se lee, no coincide. */
export const fieldCheck = (label: string, observed: unknown, expected: unknown): Check =>
  check(observed !== undefined && observed === expected, `${label} ${showValue(expected)}`, `${label} ${showValue(observed)}`);

/** Valores del seed de NC-003 que la historia da por hecho (si la fila no los envía, deben seguir así). */
export const NC003_SEED = {
  severity: 'critical',
  description: 'Desviación detectada en la ejecución 003: el resultado no cumple el criterio de aceptación.',
  state: 'corrective_action',
  programCode: 'PRG-001',
  assigneeId: 'u4',
  assigneeName: 'Andrés Molina',
  commentCount: 3,
} as const;

/** Lista de no conformidades de una respuesta 200: `items`; lista vacía si no la trae. */
export const itemsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const items = field(body, 'items');
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
};

/** Estado de cada no conformidad del tenant (`code` → `state`) desde una lista; `undefined` si la lectura no llega. */
export const statesOf = (result: ApiResult): ReadonlyMap<string, string> | undefined => {
  if (result.status !== 200) return undefined;
  return new Map(itemsOf(result.body).map((item) => [String(field(item, 'code')), String(field(item, 'state'))] as const));
};

/** Comprobaciones de una respuesta frente a la historia: estado HTTP, `code` y el motivo de un campo (`errors`). */
export interface Expect {
  readonly status: number;
  readonly code?: string;
  readonly errorField?: string;
  readonly errorKey?: string;
}

/** Comprobaciones de una respuesta de error o de validación: estado, código y motivo del campo, si los hay. */
export const answerChecks = (expect: Expect, result: ApiResult): Check[] => {
  const checks: Check[] = [check(result.status === expect.status, `respuesta ${expect.status}`, `respuesta ${result.status}`)];
  if (expect.code !== undefined) checks.push(check(field(result.body, 'code') === expect.code, `código ${expect.code}`, `código ${showValue(field(result.body, 'code'))}`));
  if (expect.errorField !== undefined && expect.errorKey !== undefined) {
    const value = errorsOf(result)[expect.errorField];
    const observed = typeof value === 'string' ? value : '(sin motivo)';
    checks.push(check(observed === expect.errorKey, `motivo ${expect.errorKey} en ${expect.errorField}`, `motivo ${observed} en ${expect.errorField}`));
  }
  return checks;
};

/** Resultado de una fila: coincide si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere. */
export const verdict = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere de la historia en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extraNote, difference].filter((text): text is string => text !== undefined && text !== '').join(' ');
  return conclude(checks, note === '' ? {} : { note });
};

/** Lectura del estado de una no conformidad por la cuenta administradora de alumno01: `undefined` si no hay estado legible. */
export const persistedState = async (code: string): Promise<string | undefined> => {
  const admin = await actorOf(adminCredentials(TENANT_A));
  if (admin.token === undefined) return undefined;
  return stateOf(await detailNc(admin.token, code));
};

/** Estados del seed que la historia nombra (NC-001 «Abierta», NC-002 «En análisis», NC-003 «Acción correctiva», NC-004 «Cerrada»). */
export const SEED_STATE: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001', 'open'],
  ['NC-002', 'in_analysis'],
  ['NC-003', 'corrective_action'],
  ['NC-004', 'closed'],
]);

/** Descripción de NC-003 que dice la historia (la del seed). */
export const NC003_DESCRIPTION = 'Desviación detectada en la ejecución 003: el resultado no cumple el criterio de aceptación.';
