import { call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { adminCredentials } from '../../../story-runs/support/api';
import { check, conclude, errorsOf, type Check } from '../../support/checks';
import type { Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-NC-TABLERO: cuentas del seed (y alumno02 para la fila de aislamiento), llamadas a
// /api/nc, mapas estrictos de las celdas y comprobaciones de la respuesta. Lo que la historia da por hecho (la máquina de estados,
// los códigos de error, los mensajes de los campos) se escribe aquí desde el TEXTO de la historia, no desde el código de la app.

export { TENANT_A, TENANT_B, resetTenants };

/** Sesión de una cuenta en un tenant: su access token (o `undefined` si el login no lo dio) y la última respuesta cruda. */
export interface Actor {
  readonly token: string | undefined;
  readonly last: ApiResult;
}

/** Login de una cuenta en su tenant (cabecera x-tenant). La sesión la inicia la propia fila. */
export const actorOf = async (tenant: string, credentials: Credentials): Promise<Actor> => {
  const started = await startSession(tenant, credentials);
  return { token: started.session?.accessToken, last: started.result };
};

/** Petición a la API con el tenant y, si se da, el token; query y cuerpo solo si hay. */
export const request = (tenant: string, token: string | undefined, method: 'GET' | 'POST', path: string, body?: unknown, query?: string): Promise<ApiResult> =>
  call(method, path, {
    tenant,
    ...(token === undefined ? {} : { token }),
    ...(body === undefined ? {} : { body }),
    ...(query === undefined || query === '' ? {} : { query }),
  });

/** Lista de no conformidades del tenant con la consulta ya codificada (sin `?`). */
export const listNc = (tenant: string, token: string | undefined, query?: string): Promise<ApiResult> => request(tenant, token, 'GET', '/nc', undefined, query);

/** Detalle de una no conformidad por su código. */
export const detailNc = (tenant: string, token: string | undefined, code: string): Promise<ApiResult> => request(tenant, token, 'GET', `/nc/${code}`);

/** Paso de estado: `POST /api/nc/<code>/transition` con el cuerpo dado (sin cuerpo si `body` es `undefined`). */
export const transitionNc = (tenant: string, token: string | undefined, code: string, body: unknown): Promise<ApiResult> =>
  request(tenant, token, 'POST', `/nc/${code}/transition`, body);

/** Elementos de la lista (`items`) de una respuesta 200; lista vacía si no la trae. */
export const itemsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const items = field(body, 'items');
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
};

/** Códigos de una lista en el orden de la respuesta. */
export const codesOfItems = (body: unknown): readonly string[] => itemsOf(body).map((item) => String(field(item, 'code')));

/** Estado de una no conformidad por código, en un mapa (para comparar «nada más cambia» antes y después). */
export const stateMap = (body: unknown): ReadonlyMap<string, string> =>
  new Map(itemsOf(body).map((item) => [String(field(item, 'code')), String(field(item, 'state'))] as const));

/** Dos mapas de estado iguales (mismos códigos y mismo estado en cada uno). */
export const sameStates = (before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): boolean =>
  before.size === after.size && [...before].every(([code, state]) => after.get(code) === state);

/** Diferencias entre dos mapas de estado, en una frase («NC-002 open → in_analysis»), o «ninguna». */
export const diffStates = (before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): string => {
  const changes = [...before].filter(([code, state]) => after.get(code) !== state).map(([code, state]) => `${code} ${state} → ${after.get(code) ?? '(ausente)'}`);
  return changes.length === 0 ? 'ninguna' : changes.join(', ');
};

/** Estado (`state`) de una respuesta 200, o `undefined` si no hay estado legible. */
export const stateOfBody = (result: ApiResult): string | undefined => {
  const state = field(result.body, 'state');
  return result.status === 200 && typeof state === 'string' ? state : undefined;
};

/** Pasos que la máquina de estados da desde un estado (escritos desde el texto de las Reglas de la historia, no desde el código). */
export const MACHINE: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['open', ['in_analysis']],
  ['in_analysis', ['corrective_action', 'rejected', 'open']],
  ['corrective_action', ['closed', 'in_analysis']],
  ['closed', []],
  ['rejected', ['open']],
]);

/** Cuentas de las celdas «cuenta» (las del seed de alumno01 y la cuenta de administración de alumno02). */
export const ACCOUNT_CELLS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', adminCredentials(TENANT_A)],
  ['alumno02@sigpro.lab', adminCredentials(TENANT_B)],
]);

/** Tenant en el que inicia sesión cada cuenta de las celdas (el de su correo). */
export const TENANT_OF_ACCOUNT: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', TENANT_A],
  ['consultor@sigpro.test', TENANT_A],
  ['auditor@sigpro.test', TENANT_A],
  ['alumno01@sigpro.lab', TENANT_A],
  ['alumno02@sigpro.lab', TENANT_B],
]);

/** Cabecera x-tenant de las celdas «cabecera». */
export const TENANT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Códigos de no conformidad que nombran las celdas (los del seed y los que no existen). */
export const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-000', 'NC-000'],
  ['NC-001', 'NC-001'],
  ['NC-002', 'NC-002'],
  ['NC-003', 'NC-003'],
  ['NC-004', 'NC-004'],
  ['NC-005', 'NC-005'],
  ['NC-008', 'NC-008'],
  ['NC-010', 'NC-010'],
  ['NC-013', 'NC-013'],
  ['NC-006', 'NC-006'],
  ['NC-007', 'NC-007'],
  ['NC-009', 'NC-009'],
  ['NC-011', 'NC-011'],
  ['NC-012', 'NC-012'],
]);

/** Programas de las celdas. */
export const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-003', 'PRG-003'],
]);

/** Severidades en la API (claves) tal como las escribe la historia. */
export const SEVERITY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['minor', 'minor'],
  ['major', 'major'],
  ['critical', 'critical'],
]);

/** Estados en la API (claves) que nombran las celdas. */
export const STATE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['open', 'open'],
  ['in_analysis', 'in_analysis'],
  ['corrective_action', 'corrective_action'],
  ['closed', 'closed'],
  ['rejected', 'rejected'],
]);

/** Responsable de la celda: el nombre (tal cual) o `(ninguno)` para una no conformidad sin responsable. */
export const RESPONSIBLE_CELLS: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Marta Ruiz', 'Marta Ruiz'],
  ['(ninguno)', null],
]);

/** Números de las celdas (contadores y totales). */
export const NUMBER_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['12', 12],
]);

/** Valor de `to` que nombran las celdas de los pasos: `(vacío)` es la cadena vacía (declarado en el informe). */
export const TO_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['in_analysis', 'in_analysis'],
  ['corrective_action', 'corrective_action'],
  ['rejected', 'rejected'],
  ['open', 'open'],
  ['closed', 'closed'],
  ['cerrada', 'cerrada'],
  ['(vacío)', ''],
]);

/** Listas de códigos que nombran las celdas de «codigos» (en el orden que dice la historia; `ordered` si la historia lo dice). */
export interface CodeList {
  readonly codes: readonly string[];
  readonly ordered: boolean;
}

export const LIST_CELLS: ReadonlyMap<string, CodeList> = new Map<string, CodeList>([
  ['(ninguno)', { codes: [], ordered: true }],
  ['NC-012', { codes: ['NC-012'], ordered: true }],
  ['NC-010, NC-011, NC-012', { codes: ['NC-010', 'NC-011', 'NC-012'], ordered: true }],
  ['NC-007', { codes: ['NC-007'], ordered: true }],
  ['NC-005, NC-006, NC-007, NC-008', { codes: ['NC-005', 'NC-006', 'NC-007', 'NC-008'], ordered: true }],
  ['NC-003, NC-006, NC-009, NC-012', { codes: ['NC-003', 'NC-006', 'NC-009', 'NC-012'], ordered: true }],
  ['NC-005, NC-010', { codes: ['NC-005', 'NC-010'], ordered: true }],
  ['NC-003, NC-007, NC-011', { codes: ['NC-003', 'NC-007', 'NC-011'], ordered: true }],
  ['NC-009, NC-012', { codes: ['NC-009', 'NC-012'], ordered: true }],
  [
    'NC-001, NC-002, NC-003, NC-004, NC-005, NC-006, NC-007, NC-008, NC-009, NC-010, NC-011 y NC-012, en ese orden',
    { codes: ['NC-001', 'NC-002', 'NC-003', 'NC-004', 'NC-005', 'NC-006', 'NC-007', 'NC-008', 'NC-009', 'NC-010', 'NC-011', 'NC-012'], ordered: true },
  ],
]);

/** Consultas de la lista (pares clave/valor) y, si la celda nombra a una persona, su nombre tal como lo escribe la historia. */
export interface Consulta {
  readonly pairs: readonly (readonly [string, string])[];
  readonly person?: string;
}

export const CONSULTA_CELLS: ReadonlyMap<string, Consulta> = new Map<string, Consulta>([
  ['(sin consulta)', { pairs: [] }],
  ['q=012', { pairs: [['q', '012']] }],
  ['q=nc-01', { pairs: [['q', 'nc-01']] }],
  ['q=ejecución 007', { pairs: [['q', 'ejecución 007']] }],
  ['program=PRG-002', { pairs: [['program', 'PRG-002']] }],
  ['severity=critical', { pairs: [['severity', 'critical']] }],
  ['severity=critical y program=PRG-003', { pairs: [['severity', 'critical'], ['program', 'PRG-003']] }],
  ['assignee=none', { pairs: [['assignee', 'none']] }],
  ['assignee=u4 (Andrés Molina)', { pairs: [['assignee', 'u4']], person: 'Andrés Molina' }],
  ['q=zzzz-no-existe', { pairs: [['q', 'zzzz-no-existe']] }],
]);

/** Cadena de consulta (sin `?`) a partir de los pares, con codificación de URL (acentos y espacios). */
export const queryOf = (pairs: readonly (readonly [string, string])[]): string | undefined =>
  pairs.length === 0 ? undefined : pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');

/** Pasos que nombran las celdas de «pasos» / «transitions»: listas en el orden que da la historia. */
export const STEPS_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['in_analysis', ['in_analysis']],
  ['corrective_action, rejected, open', ['corrective_action', 'rejected', 'open']],
  ['closed, in_analysis', ['closed', 'in_analysis']],
  ['(ninguno)', []],
  ['open', ['open']],
]);

/** Respuesta que nombran las celdas «respuesta» (código HTTP, `code`, estado de un 200 o motivo de un 422). */
export interface Expect {
  readonly status: number;
  readonly code?: string;
  readonly state?: string;
  readonly errorField?: string;
  readonly errorKey?: string;
}

export const EXPECT_CELLS: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['409 invalid_transition', { status: 409, code: 'invalid_transition' }],
  ['200 con state in_analysis', { status: 200, state: 'in_analysis' }],
  ['422 validation_failed con un motivo para comment igual a commentLong', { status: 422, code: 'validation_failed', errorField: 'comment', errorKey: 'commentLong' }],
]);

/** Comprobaciones de una respuesta frente a lo que dice la historia: estado HTTP, `code`, `state` y el motivo del campo. */
export const answerChecks = (expect: Expect, result: ApiResult): Check[] => {
  const checks: Check[] = [check(result.status === expect.status, `respuesta ${expect.status}`, `respuesta ${result.status}`)];
  if (expect.code !== undefined) checks.push(check(errorCode(result) === expect.code, `código ${expect.code}`, `código ${errorCode(result) ?? '(sin código)'}`));
  if (expect.state !== undefined) {
    const state = stateOfBody(result);
    checks.push(check(state === expect.state, `state ${expect.state}`, `state ${state ?? '(sin state)'}`));
  }
  if (expect.errorField !== undefined && expect.errorKey !== undefined) {
    const value = errorsOf(result)[expect.errorField];
    const observed = typeof value === 'string' ? value : '(sin motivo)';
    checks.push(check(observed === expect.errorKey, `motivo ${expect.errorKey} para ${expect.errorField}`, `motivo ${observed} para ${expect.errorField}`));
  }
  return checks;
};

/** Estado de una no conformidad leído por el administrador de alumno01: `undefined` si la lectura no da estado. */
export const stateNow = async (token: string, code: string): Promise<string | undefined> => stateOfBody(await detailNc(TENANT_A, token, code));

/** Resultado de una fila: coincide si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere. */
export const verdict = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failing = checks.filter((entry) => !entry.ok);
  const difference = failing.length === 0 ? undefined : `difiere de la historia en: ${failing.map((entry) => `${entry.expected} (observado: ${entry.observed})`).join('; ')}`;
  const note = [extraNote, difference].filter((text): text is string => text !== undefined && text !== '').join(' ');
  return conclude(checks, note === '' ? {} : { note });
};

/** Comprobación de igualdad de listas de códigos: exacta si la historia da el orden, por conjunto si no. */
export const codesCheck = (observedCodes: readonly string[], expected: CodeList, what: string): Check => {
  const left = expected.ordered ? [...observedCodes] : [...observedCodes].sort();
  const right = expected.ordered ? [...expected.codes] : [...expected.codes].sort();
  const same = left.length === right.length && left.every((code, index) => code === right[index]);
  const observedText = observedCodes.length === 0 ? '(ninguno)' : observedCodes.join(', ');
  return check(same, `${what} ${expected.codes.length === 0 ? '(ninguno)' : expected.codes.join(', ')}${expected.ordered ? ' en ese orden' : ''}`, `${what} ${observedText}`);
};

/** Lista de textos de un valor (p. ej. `transitions`), o `undefined` si no es una lista. */
export const stringsOf = (value: unknown): readonly string[] | undefined => (Array.isArray(value) ? value.map((item) => String(item)) : undefined);

/** Dos listas de textos iguales, en el mismo orden. */
export const sameOrder = (observed: readonly string[] | undefined, expected: readonly string[]): boolean =>
  observed !== undefined && observed.length === expected.length && expected.every((item, index) => observed[index] === item);

/** Un mapa de estados sin una no conformidad (para comparar «las demás no cambian»). */
export const withoutCode = (states: ReadonlyMap<string, string>, code: string): ReadonlyMap<string, string> => new Map([...states].filter(([key]) => key !== code));
