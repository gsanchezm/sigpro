import { call, field, uniqueEmail, usersByEmail, type ApiResult } from '../../../story-runs/support/api';
import { check, type Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de API de EP-RECUPERAR: la petición a POST /api/auth/forgot (pública, sin Authorization y con la
// cabecera x-tenant de la fila), el correo nuevo de «(correo sin cuenta)», el estado de una cuenta leído por la API (GET /api/admin/users,
// con los indicadores de AdminUserDto) y las comprobaciones de la respuesta y del motivo del correo. Lo que la historia da por hecho y
// la app no produce es una preparación no cumplida, nunca un error del arnés.

export { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';

/** «(correo sin cuenta)»: `nadie-<marca>@sigpro.test`, distinto en cada llamada. */
export const unknownEmail = (): string => uniqueEmail('nadie');

/** `POST /api/auth/forgot` con la cabecera `x-tenant` de la fila y sin `Authorization` (el endpoint es público). */
export const postForgot = (tenant: string, body: Record<string, unknown>): Promise<ApiResult> => call('POST', '/auth/forgot', { tenant, body });

/** Estado de una cuenta según `AdminUserDto` (`locked`, `pending`, `active`). `sin cuenta` si no hay ninguna con ese correo. */
export type AccountState = 'activa' | 'bloqueada' | 'pendiente de aprobación' | 'desactivada' | 'sin cuenta';

const stateOf = (user: Readonly<Record<string, unknown>> | undefined): AccountState => {
  if (user === undefined) return 'sin cuenta';
  if (user.locked === true) return 'bloqueada';
  if (user.pending === true) return 'pendiente de aprobación';
  return user.active === true ? 'activa' : 'desactivada';
};

/** Estado de la cuenta de `email` en el tenant, leído por la API (nunca por la pantalla). */
export const stateOfAccount = async (tenant: string, email: string): Promise<AccountState> => stateOf((await usersByEmail(tenant)).get(email));

/** La preparación de la fila no produjo lo que la historia da por hecho: la fila discrepa con ese motivo (no es un error del arnés). */
export const preparationMissed = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, {
    note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.',
  });

/** El cuerpo de la respuesta es exactamente `{}`. */
export const emptyBodyCheck = (result: ApiResult): Check => {
  const text = String(JSON.stringify(result.body));
  return check(text === '{}', 'cuerpo vacío {}', `cuerpo ${text}`);
};

/** Motivo del correo en `errors` (la respuesta 422 lo trae por campo; cualquier otra no). */
const emailReasonOf = (result: ApiResult): string | undefined => {
  const errors = field(result.body, 'errors');
  const reason = typeof errors === 'object' && errors !== null ? (errors as Record<string, unknown>).email : undefined;
  return typeof reason === 'string' ? reason : undefined;
};

/** El motivo del correo es exactamente el que nombra la historia (`required`, `badEmail`…). */
export const motiveCheck = (result: ApiResult, expected: string): Check => {
  const reason = emailReasonOf(result);
  return check(reason === expected, `motivo ${expected} para el correo`, reason === undefined ? 'sin motivo para el correo' : `motivo ${reason} para el correo`);
};

/** La historia dice «(ninguno)»: la respuesta no lleva ningún motivo para el correo. */
export const noMotiveCheck = (result: ApiResult): Check => {
  const reason = emailReasonOf(result);
  return check(reason === undefined, 'sin motivo para el correo', reason === undefined ? 'sin motivo para el correo' : `motivo ${reason} para el correo`);
};
