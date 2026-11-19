import { adminCredentials, adminToken, call, errorCode, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { check, errorsOf, preparationFailed, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-REQ-FLUJO: cuentas del seed, lectura del requisito, el paso de estado, la auditoría y las
// comprobaciones de la respuesta. Los textos de las celdas se traducen con mapas `strict` (un texto que no conocen LANZA). Cada fila
// compara con lo que dice la historia; lo observado se deriva de lo medido, nunca de un texto fijo.

export { TENANT_A, TENANT_B, resetTenants, adminToken };

/** Cuenta de inicio de sesión de alumno01 (rol admin, sin segundo factor). */
export const ALUMNO01: Credentials = adminCredentials(TENANT_A);

/** Cuentas de las celdas «cuenta» (las del seed; todas existen en el tenant alumno01 tras el reinicio). */
export const ACCOUNT_CELLS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', ALUMNO01],
]);

/** Requisitos de las celdas: códigos del seed (PRG-001 a PRG-003, REQ-001 a REQ-040) y uno que no existe en ningún tenant. */
export const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
  ['REQ-003', 'REQ-003'],
  ['REQ-041', 'REQ-041'],
]);

/** Estados de partida y de destino (los códigos del flujo, tal cual en la API). */
export const STATE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['draft', 'draft'],
  ['approved', 'approved'],
  ['verified', 'verified'],
  ['validated', 'validated'],
]);

/** Tenants de las celdas «tenant» / «otro». */
export const TENANT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Respuesta esperada de una celda: código HTTP, `code` del cuerpo y, si se da, el `message` y el motivo `badState` en el campo `to`. */
export interface Expectation {
  readonly status: number;
  readonly code: string;
  readonly message?: string;
  readonly badStateTo?: boolean;
}

/** Respuestas que nombran las celdas, tal cual están escritas en la historia. */
export const EXPECTATION_CELLS: ReadonlyMap<string, Expectation> = new Map<string, Expectation>([
  ['404 con el código requirement_not_found', { status: 404, code: 'requirement_not_found' }],
  ['422 con el código validation_failed y el motivo badState en el campo to', { status: 422, code: 'validation_failed', badStateTo: true }],
  ['422 con el código validation_failed', { status: 422, code: 'validation_failed' }],
  ['401 con el código missing_token', { status: 401, code: 'missing_token' }],
  ['401 con el código invalid_token', { status: 401, code: 'invalid_token' }],
  ['409 con el código invalid_transition', { status: 409, code: 'invalid_transition' }],
  ['403 con el código forbidden', { status: 403, code: 'forbidden' }],
]);

/** Preparación que no se cumple con la respuesta HTTP que lo muestra (estado, cuerpo recortado en la evidencia). */
export const premiseFailed = (expected: string, step: string, result: ApiResult): Outcome => preparationFailed(expected, step, result);

/** Sesión de una cuenta: su token (o `undefined` si el inicio de sesión no dio tokens) y la respuesta cruda. */
export interface SessionOf {
  readonly token: string | undefined;
  readonly result: ApiResult;
}

export const loginAs = async (credentials: Credentials, tenant: string): Promise<SessionOf> => {
  const started = await startSession(tenant, credentials);
  return { token: started.session?.accessToken, result: started.result };
};

/** Lectura del requisito con un token del tenant. */
export const readRequirement = (tenant: string, token: string, code: string): Promise<ApiResult> => call('GET', `/requirements/${code}`, { tenant, token });

/** Estado del requisito en una respuesta 200; `undefined` si no hay estado legible. */
export const stateOf = (result: ApiResult): string | undefined => {
  const state = field(result.body, 'state');
  return result.status === 200 && typeof state === 'string' ? state : undefined;
};

export const describeState = (state: string | undefined): string => state ?? '(sin estado)';

/** Paso de estado: `POST /api/requirements/:code/transition` con el token dado (sin cabecera si `token` es `undefined`). */
export const transition = (code: string, tenant: string, token: string | undefined, body: unknown): Promise<ApiResult> =>
  call('POST', `/requirements/${code}/transition`, { tenant, ...(token === undefined ? {} : { token }), ...(body === undefined ? {} : { body }) });

/** Campos de un requisito que cambian entre dos lecturas (todos los del cuerpo, salvo los indicados). */
export interface Comparison {
  readonly changed: readonly string[];
  readonly compared: number;
}

const objectOf = (body: unknown): Record<string, unknown> => (typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {});

export const compareRequirements = (before: unknown, after: unknown, ignore: readonly string[] = []): Comparison => {
  const keys = [...new Set([...Object.keys(objectOf(before)), ...Object.keys(objectOf(after))])].filter((key) => !ignore.includes(key));
  const changed = keys.filter((key) => JSON.stringify(objectOf(before)[key]) !== JSON.stringify(objectOf(after)[key]));
  return { changed, compared: keys.length };
};

/** «Ningún campo cambia» (o «ninguno cambia salvo state»), con lo que se comparó y lo que cambió. */
export const unchangedCheck = (comparison: Comparison, phrase: string): Check =>
  check(comparison.changed.length === 0, phrase, comparison.changed.length === 0 ? `ningún campo cambia (${comparison.compared} campos comparados)` : `cambian: ${comparison.changed.join(', ')}`);

/** Auditoría del tenant: total, identificadores de la primera página (más reciente primero) y los eventos. */
export interface AuditView {
  readonly total: number;
  readonly ids: readonly string[];
  readonly items: readonly Record<string, unknown>[];
}

export const readAudit = async (tenant: string, token: string): Promise<AuditView | undefined> => {
  const result = await call('GET', '/audit', { tenant, token, query: 'limit=100' });
  const items = field(result.body, 'items');
  const total = field(result.body, 'total');
  if (result.status !== 200 || !Array.isArray(items) || typeof total !== 'number') return undefined;
  const list = items as Record<string, unknown>[];
  return { total, ids: list.map((item) => String(field(item, 'id'))), items: list };
};

/** Mismo total y mismos eventos (por id, en el mismo orden) en las dos lecturas. */
export const sameAudit = (before: AuditView | undefined, after: AuditView | undefined): Check =>
  check(
    before !== undefined && after !== undefined && before.total === after.total && JSON.stringify(before.ids) === JSON.stringify(after.ids),
    'el total y los eventos de la auditoría siguen iguales',
    before === undefined || after === undefined ? 'auditoría no legible en alguna lectura' : `total ${before.total} → ${after.total}; eventos ${before.ids.length === after.ids.length && before.ids.every((id, index) => id === after.ids[index]) ? 'iguales' : 'distintos'}`,
  );

/** El evento más reciente de la auditoría sobre ese requisito (entidad `requirement`, identificador = código). */
export const latestEventFor = (view: AuditView | undefined, code: string): Record<string, unknown> | undefined =>
  view?.items.find((item) => field(item, 'entity') === 'requirement' && field(item, 'entityId') === code);

/** Comprobaciones de la respuesta de un paso frente a su expectativa (estado, código, mensaje y motivo del campo `to`). */
export const responseChecks = (result: ApiResult, expectation: Expectation, expected: string): Check[] => {
  const errors = errorsOf(result);
  const checks: Check[] = [
    check(result.status === expectation.status, `respuesta ${expected}`, `respuesta ${result.status}`),
    check(errorCode(result) === expectation.code, `código ${expectation.code}`, `código ${errorCode(result) ?? '(sin código)'}`),
  ];
  if (expectation.message !== undefined) {
    const message = field(result.body, 'message');
    checks.push(check(message === expectation.message, `mensaje ${expectation.message}`, `mensaje ${typeof message === 'string' ? message : '(sin mensaje)'}`));
  }
  if (expectation.badStateTo) {
    checks.push(check(errors.to === 'badState', 'motivo badState en el campo to', `motivo ${typeof errors.to === 'string' ? errors.to : '(sin motivo)'} en el campo to`));
  }
  return checks;
};

/** Veredicto de una fila: coincide si todas las comprobaciones se cumplen; si no, la nota dice en qué difiere (de lo medido). */
export const verdictOf = (checks: readonly Check[], extraNote?: string): Outcome => {
  const failed = checks.filter((entry) => !entry.ok).map((entry) => entry.observed);
  const parts = [failed.length === 0 ? undefined : `difiere en: ${failed.join('; ')}`, extraNote].filter((part): part is string => part !== undefined);
  return outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    parts.length === 0 ? {} : { note: parts.join('. ') },
  );
};
