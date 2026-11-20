import type { Locator, Page, Request as BrowserRequest, Response as BrowserResponse } from '@playwright/test';
import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, attrOf, holdsFor, isDisabled, isEnabled, isFocused, isVisible, pathOf, safe, textOf, valueOf, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';

// Piezas comunes de EP-MFA en navegador (web, y la app móvil servida como web, que las importa desde mobile/). Tres criterios:
//  - Lecturas de UN único elemento: si hay varios o ninguno, la lectura es ambigua y NO se toma el primero a ciegas.
//  - Lo que la historia da por hecho se comprueba en el acto: `settles` espera al estado esperado y comprueba que se mantiene.
//  - El tráfico de acceso (login y segundo paso) se registra ANTES de la acción: la cabecera x-tenant y el cuerpo de la respuesta
//    de /api/auth/mfa son observables y no dependen de la pantalla.

/** Fragmento del texto de la pantalla de segundo paso (catálogo `acceso.mfaHint`, `AccessPage.tsx:374` y `login.tsx:148`). */
export const MFA_HINT_PREFIX = 'Introduce el código de 6 dígitos de tu aplicación de autenticación para';
export const WRONG_CODE_MESSAGE = 'Código incorrecto o caducado';
export const INCOMPLETE_EXPLANATION = 'Introduce los 6 dígitos del código';

/** Nota de toda acción que no se pudo hacer: el diagnóstico real (primera línea del error de Playwright) va en lo observado. */
export const ACTION_NOTE = 'La acción no se completó.';
/** Nota de toda fila de navegador: una lectura que falla (`safe`, un elemento ambiguo o ausente) cuenta como discrepancia. */
export const READ_NOTE = 'Una lectura que falla (elemento ausente, ambiguo o sin plazo) cuenta como discrepancia, no como cumplida.';
/** Ventana propia de «no aparece» / «sin sesión»: `noSessionCheck` del marco observa solo 2 s; aquí se observan 3,5 s. */
export const NO_SESSION_MS = 3_500;

/** Códigos de las celdas «código» y «segundo_codigo» (el texto tal cual). */
export const CODES: ReadonlyMap<string, string> = new Map<string, string>([
  ['000000', '000000'],
  ['111111', '111111'],
  ['123456', '123456'],
  ['123457', '123457'],
]);

/** Lo que se teclea en el campo: `(vacío)` no escribe nada (solo limpia el campo). */
export const TYPED: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['12345', '12345'],
  ['12345a', '12345a'],
  ['abcdef', 'abcdef'],
  ['123456', '123456'],
  ['1234567', '1234567'],
]);

/** Contenido que debe tener el campo tras teclear (`(vacío)` = campo vacío). */
export const CONTENT: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['12345', '12345'],
  ['123456', '123456'],
]);

const onlyOne = async (target: Locator): Promise<boolean> => (await safe(() => target.count(), 0)) === 1;

/** Cuántos elementos casan: 1 es la única lectura válida. */
export const soleCount = (target: Locator): Promise<number> => safe(() => target.count(), 0);
export const soleVisible = async (target: Locator): Promise<boolean> => (await onlyOne(target)) && (await isVisible(target));
export const soleEnabled = async (target: Locator): Promise<boolean> => (await onlyOne(target)) && (await isEnabled(target));
export const soleDisabled = async (target: Locator): Promise<boolean> => (await onlyOne(target)) && (await isDisabled(target));
export const soleFocused = async (target: Locator): Promise<boolean> => (await onlyOne(target)) && (await isFocused(target));
export const soleText = async (target: Locator): Promise<string | undefined> => ((await onlyOne(target)) ? textOf(target) : undefined);
export const soleValue = async (target: Locator): Promise<string | undefined> => ((await onlyOne(target)) ? valueOf(target) : undefined);
export const soleAttr = async (target: Locator, name: string): Promise<string | undefined> => ((await onlyOne(target)) ? attrOf(target, name) : undefined);

/** Espera a que `holds` se cumpla y luego comprueba que sigue cumpliéndose `holdMs` («se ve y no cambia»). */
export const settles = async (holds: () => Promise<boolean>, holdMs = 1_000): Promise<boolean> => {
  const reached = await waitUntil(holds);
  return reached.reached && (await holdsFor(holds, holdMs)).held;
};

export type AuthEndpoint = 'login' | 'mfa';

export interface AuthPost {
  readonly endpoint: AuthEndpoint;
  /** Cabecera `x-tenant` de la petición (`undefined` si no la lleva). */
  readonly tenant: string | undefined;
  /** Campo `code` del cuerpo, si lo hay (solo el segundo paso lo lleva). */
  readonly code: unknown;
}

export interface MfaReply {
  readonly status: number;
  readonly body: unknown;
}

export interface AuthTraffic {
  /** POST de inicio de sesión y de segundo paso, en orden de envío. */
  readonly posts: AuthPost[];
  /** Respuesta de cada POST /api/auth/mfa; la promesa se resuelve sola (`undefined` si no se pudo leer el cuerpo) y nunca rechaza. */
  readonly mfaReplies: Promise<MfaReply | undefined>[];
}

const ENDPOINTS: ReadonlyMap<string, AuthEndpoint> = new Map<string, AuthEndpoint>([
  ['/auth/login', 'login'],
  ['/auth/mfa', 'mfa'],
]);

const pathnameOf = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

const endpointOf = (url: string): AuthEndpoint | undefined => {
  const path = pathnameOf(url);
  return Array.from(ENDPOINTS).find(([suffix]) => path.endsWith(suffix))?.[1];
};

const codeOf = (request: BrowserRequest): unknown => {
  try {
    return field(request.postDataJSON() as unknown, 'code');
  } catch {
    return undefined;
  }
};

/** Registra el tráfico de acceso de la página. Hay que llamarlo ANTES de la primera acción (el login ocurre dentro de la fila). */
export const trackAuth = (page: Page): AuthTraffic => {
  const posts: AuthPost[] = [];
  const mfaReplies: Promise<MfaReply | undefined>[] = [];
  page.on('request', (request) => {
    const endpoint = endpointOf(request.url());
    // Solo POST: el preflight OPTIONS de Expo web (otro origen) no cuenta como envío
    if (endpoint === undefined || request.method() !== 'POST') return;
    posts.push({ endpoint, tenant: request.headers()['x-tenant'], code: codeOf(request) });
  });
  page.on('response', (response: BrowserResponse) => {
    if (response.request().method() !== 'POST' || endpointOf(response.url()) !== 'mfa') return;
    // El cuerpo se lee dentro del propio listener: leerlo después puede fallar si la página navega
    mfaReplies.push(
      response.json().then(
        (body: unknown) => ({ status: response.status(), body }),
        () => undefined,
      ),
    );
  });
  return { posts, mfaReplies };
};

/** Todas las peticiones de acceso llevan `x-tenant: alumno01`, y hubo al menos un inicio de sesión. */
export const tenantCheck = (traffic: AuthTraffic): Check => {
  const tenants = traffic.posts.map((post) => post.tenant ?? '(sin cabecera)');
  const hasLogin = traffic.posts.some((post) => post.endpoint === 'login');
  const everyOnTenant = traffic.posts.every((post) => post.tenant === TENANT_A);
  return check(hasLogin && everyOnTenant, `las peticiones de acceso llevan x-tenant ${TENANT_A}`, tenants.length === 0 ? 'no hubo peticiones de acceso' : `x-tenant: ${tenants.join(', ')}`);
};

/** La última respuesta de POST /api/auth/mfa es 200 y su usuario es del tenant alumno01. */
export const replyCheck = async (traffic: AuthTraffic): Promise<Check> => {
  const last = traffic.mfaReplies[traffic.mfaReplies.length - 1];
  const reply = last === undefined ? undefined : await last;
  const tenant = field(field(reply?.body, 'user'), 'tenant');
  const ok = reply?.status === 200 && tenant === TENANT_A;
  return check(ok, `respuesta 200 de POST /api/auth/mfa con user.tenant ${TENANT_A}`, reply === undefined ? 'no hay respuesta de POST /api/auth/mfa' : `respuesta ${String(reply.status)} con user.tenant ${String(tenant)}`);
};

/** Cuántas peticiones del segundo paso (POST /api/auth/mfa) se enviaron con ese código. */
export const sentWithCode = (traffic: AuthTraffic, code: string): number => traffic.posts.filter((post) => post.endpoint === 'mfa' && post.code === code).length;

/**
 * «Sin sesión», con ventana propia de 3,5 s: abrir /programs en esta página debe acabar en /login y quedarse ahí. Navega, así que
 * se llama siempre al final de la fila. Un fallo de lectura cuenta como «con sesión» (dirección segura).
 */
export const noSessionWindow = async (page: Page, onLoginForm: (page: Page) => Promise<boolean>, onPrograms: (page: Page) => Promise<boolean>): Promise<Check> => {
  // La carga de la ruta es fontanería: si falla, lanza (no se traga el fallo)
  await page.goto('/programs', { timeout: CEILING_MS });
  await waitUntil(async () => (await onLoginForm(page)) || (await onPrograms(page)));
  const stays = await holdsFor(() => onLoginForm(page), NO_SESSION_MS);
  return check(stays.held, `sin sesión iniciada (abrir /programs acaba en /login, observado ${NO_SESSION_MS / 1000} s)`, stays.held ? 'sin sesión: abrir /programs acaba en /login' : `con sesión: abrir /programs acaba en ${pathOf(page)}`);
};

/** Un único elemento se ve con el texto exacto (para el correo y los avisos). */
export const exactTextVisible = (page: Page, text: string): Promise<boolean> => soleVisible(page.getByText(text, { exact: true }));
