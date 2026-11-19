import { call, field, uniqueEmail, type ApiResult } from '../../../story-runs/support/api';
import { NEW_ACCOUNT_PASSWORD } from '../../../story-runs/support/prepare';
import { check, type Check } from '../../support/checks';

// Piezas comunes de las filas de API de EP-REGISTRO: cuerpo válido de la fila, correos que no se repiten, reinicio de tenants
// y lectura de la respuesta de POST /api/auth/register y POST /api/auth/resend. Los marcadores de las celdas («(vacío)»,
// «(sin el campo)»…) se traducen aquí; cualquier otro texto entre paréntesis lanza (una celda nueva no se ignora).

export { NEW_ACCOUNT_PASSWORD, TENANT_A, requestAccount, resetTenants } from '../../../story-runs/support/prepare';

export const TENANT_25 = 'alumno25';
export const TENANT_02 = 'alumno02';

/** Correo nuevo: `nueva-<marca>@organizacion.es`, distinto en cada llamada (el mismo generador que `requestAccount`). */
export const newAccountEmail = (): string => uniqueEmail('nueva').replace(/@.*$/, '@organizacion.es');

/** Correo sin cuenta: `nadie-<marca>@sigpro.test`, distinto en cada llamada. */
export const unknownEmail = (): string => uniqueEmail('nadie');

/** Cuerpo válido de la fila: Ana Prueba, «Unidad de pruebas», consultant, Abcdefghij1! y condiciones aceptadas. Las filas cambian solo lo que indican. */
export const validBody = (email: string): Record<string, unknown> => ({
  first: 'Ana',
  last: 'Prueba',
  email,
  org: 'Unidad de pruebas',
  role: 'consultant',
  password: NEW_ACCOUNT_PASSWORD,
  confirm: NEW_ACCOUNT_PASSWORD,
  terms: true,
});

/** Marcadores de un campo vacío o ausente; `undefined` significa «sin el campo» (JSON lo omite). */
export const EMPTY_MARKERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['(sin el campo)', undefined],
]);

/** Un texto tal cual, o un marcador de la tabla traducido con su mapa; cualquier otro paréntesis lanza. */
export const bodyValue = (text: string, markers: ReadonlyMap<string, string | undefined>): string | undefined => {
  if (markers.has(text)) return markers.get(text);
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: «${text}»`);
  return text;
};

export const postRegister = (tenant: string, body: Record<string, unknown>): Promise<ApiResult> => call('POST', '/auth/register', { tenant, body });

export const postResend = (tenant: string, body: Record<string, unknown>): Promise<ApiResult> => call('POST', '/auth/resend', { tenant, body });

const errorsOf = (result: ApiResult): Readonly<Record<string, unknown>> => {
  const errors = field(result.body, 'errors');
  return typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>) : {};
};

/** Un 201 de solicitud aceptada: `status` pending_approval. */
export const pendingCheck = (result: ApiResult): Check => {
  const status = field(result.body, 'status');
  return check(result.status === 201 && status === 'pending_approval', 'respuesta 201 con status pending_approval', `respuesta ${result.status} con status ${String(status)}`);
};

/** `role` del cuerpo igual al rol pedido. */
export const roleEchoCheck = (result: ApiResult, role: string): Check => {
  const value = field(result.body, 'role');
  return check(value === role, `role ${role}`, `role ${String(value)}`);
};

/** `email` del cuerpo igual al esperado (en minúsculas y sin espacios). */
export const emailEchoCheck = (result: ApiResult, email: string): Check => {
  const value = field(result.body, 'email');
  return check(value === email, `email ${email}`, `email ${String(value)}`);
};

const currentYears = (): readonly string[] => [String(new Date().getFullYear()), String(new Date().getUTCFullYear())];

/** `requestId` con la forma REQ-AAAA-NNNN y el año en curso (el del servidor en UTC o el local). */
export const requestIdCheck = (result: ApiResult): Check => {
  const value = field(result.body, 'requestId');
  const ok = typeof value === 'string' && /^REQ-\d{4}-\d{4}$/.test(value) && currentYears().includes(value.slice(4, 8));
  return check(ok, 'requestId con la forma REQ-AAAA-NNNN del año en curso', `requestId ${String(value)}`);
};

/** Ninguna respuesta de rechazo trae `requestId`. */
export const noRequestIdCheck = (result: ApiResult): Check => {
  const value = field(result.body, 'requestId');
  return check(value === undefined, 'no trae requestId', value === undefined ? 'no trae requestId' : `trae requestId ${String(value)}`);
};

/**
 * Motivo de un campo en `errors` del 422. Con `expected` debe ser exactamente ese texto (la historia lo nombra); sin él basta
 * con que haya un motivo no vacío (la historia solo dice «un motivo»).
 */
export const motiveCheck = (result: ApiResult, fieldName: string, expected?: string): Check => {
  const raw = errorsOf(result)[fieldName];
  const reason = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
  const ok = expected === undefined ? reason !== undefined : reason === expected;
  const wanted = expected === undefined ? `un motivo para ${fieldName}` : `motivo ${expected} para ${fieldName}`;
  return check(ok, wanted, reason === undefined ? `sin motivo para ${fieldName}` : `motivo ${reason} para ${fieldName}`);
};

/** 202 de `POST /api/auth/resend` con cuerpo vacío `{}`. */
export const emptyAcceptedCheck = (result: ApiResult): Check => {
  const empty = JSON.stringify(result.body) === '{}';
  return check(result.status === 202 && empty, 'respuesta 202 con el cuerpo vacío {}', `respuesta ${result.status} con cuerpo ${JSON.stringify(result.body)}`);
};
