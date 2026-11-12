// Lógica pura de Administración en móvil (web: admin-view.ts, tenant-info.ts, UsersPanel y ChaosPanel): pestañas, estado de
// un usuario, búsqueda, cambios optimistas con su motivo de rechazo, palancas del modo caos y líneas de «Información del
// tenant». Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { ApiError, type AdminUserDto, type ChaosConfig, type MessageKey, type Tone, type UpdateUserInput } from '@sigpro/shared';

// --- Pestañas ------------------------------------------------------------------------------------------------------

export type AdminTab = 'users' | 'audit' | 'chaos' | 'data';

/** Orden de las secciones (el de la web). */
export const ADMIN_TABS: readonly AdminTab[] = ['users', 'audit', 'chaos', 'data'];

/** Sección de la URL (`?tab=`); si no es una conocida, la primera. */
export const parseTab = (value: string | undefined): AdminTab => ADMIN_TABS.find((tab) => tab === value) ?? 'users';

/** La primera sección es la de por defecto y no se escribe en la URL (como la web). */
export const tabParam = (tab: AdminTab): string | undefined => (tab === 'users' ? undefined : tab);

// --- Usuarios ------------------------------------------------------------------------------------------------------

export type UserStatus = 'ok' | 'locked' | 'pending' | 'inactive';

/** Estado visible de un usuario, por prioridad: pendiente de aprobación → bloqueado → desactivado → normal. */
export const userStatus = (user: Pick<AdminUserDto, 'active' | 'locked' | 'pending'>): UserStatus => {
  if (user.pending) return 'pending';
  if (user.locked) return 'locked';
  return user.active ? 'ok' : 'inactive';
};

export const USER_STATUS_TONE: Readonly<Record<UserStatus, Tone>> = { ok: 'ok', locked: 'danger', pending: 'warn', inactive: 'neutral' };

/** Búsqueda de usuarios: por nombre o correo, sin distinguir mayúsculas ni espacios de los extremos. */
export const filterUsers = <T extends Pick<AdminUserDto, 'name' | 'email'>>(users: readonly T[], search: string): readonly T[] => {
  const needle = search.trim().toLowerCase();
  return needle ? users.filter((user) => user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)) : users;
};

/** Vista optimista de un cambio: lo que se verá mientras la API responde. */
export const applyChange = (user: AdminUserDto, input: UpdateUserInput): AdminUserDto => ({
  ...user,
  ...(input.active !== undefined ? { active: input.active } : {}),
  ...(input.role !== undefined ? { role: input.role } : {}),
});

/** Sustituye un usuario de la lista (sin mutarla); si el id no existe, la lista queda igual. */
export const replaceUser = (users: readonly AdminUserDto[], id: string, apply: (user: AdminUserDto) => AdminUserDto): readonly AdminUserDto[] =>
  users.map((user) => (user.id === id ? apply(user) : user));

// Código de error de la API → clave del texto (mapa de despacho, sin switch)
const ERROR_KEY: ReadonlyMap<string, MessageKey<'admin'>> = new Map<string, MessageKey<'admin'>>([
  ['self_change', 'errorSelfChange'],
  ['last_admin', 'errorLastAdmin'],
  ['user_not_found', 'errorUserNotFound'],
]);

/** Clave del texto que explica un rechazo de la API al cambiar un usuario, o `undefined` si el código no se conoce. */
export const rejectionKey = (failure: unknown): MessageKey<'admin'> | undefined => {
  const code = failure instanceof ApiError ? failure.body.code : undefined;
  return code ? ERROR_KEY.get(code) : undefined;
};

/** Traza para mostrar: la de la API o, si no hay (fallo de red), el texto dado. */
export const traceOr = (trace: string, fallback: string): string => (trace === '' || trace === 'error' ? fallback : trace);

// --- Modo caos -----------------------------------------------------------------------------------------------------

/** Rango de los deslizadores: los de la web (latencia 0–5000 ms de 100 en 100; errores 0–100 % de 5 en 5). */
export const LATENCY_MAX = 5000;
export const LATENCY_STEP = 100;
export const ERROR_STEP = 5;

export const NO_CHAOS: ChaosConfig = { latencyMs: 0, errorRate: 0, flakyLabels: false };

/** Cada cuántos ms alternan los textos del botón de ejemplo con los textos alternos activos. */
export const FLAKY_LABEL_MS = 2500;

export const toPercent = (rate: number): number => Math.round(rate * 100);

/** El modo caos está activo si alguna de sus tres palancas no está en reposo. */
export const isChaosActive = (config: ChaosConfig): boolean => config.latencyMs > 0 || config.errorRate > 0 || config.flakyLabels;

/** Igualdad de configuraciones: la tasa de error se compara en porcentaje entero (lo que muestra el deslizador). */
export const sameConfig = (a: ChaosConfig, b: ChaosConfig): boolean =>
  a.latencyMs === b.latencyMs && toPercent(a.errorRate) === toPercent(b.errorRate) && a.flakyLabels === b.flakyLabels;

/** Porcentaje del deslizador de errores → tasa 0–1 de la API. */
export const rateOf = (percent: number): number => percent / 100;

// --- Datos del tenant ----------------------------------------------------------------------------------------------

export interface TenantInfo {
  readonly tenant: string;
  readonly users: readonly { readonly active: boolean }[];
}

/** Líneas de «Información del tenant»: tenant y recuento de usuarios (total y activos). El título lo pone el diálogo. */
export const tenantInfoLines = (
  info: TenantInfo,
  labels: { readonly tenant: (tenant: string) => string; readonly users: (total: number, active: number) => string },
): readonly string[] => [labels.tenant(info.tenant), labels.users(info.users.length, info.users.filter((user) => user.active).length)];
