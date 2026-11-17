import type { BrowserContext, Locator, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { uniqueEmail } from '../../support/api';
import { RESULTS_ROOT } from '../../support/evidence';
import { WRONG_PASSWORD } from '../../support/prepare';
import { outcome, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../support/rows';

// Piezas comunes de las historias web de EP-LOGIN: observación sin excepciones, traducción de celdas por mapas de despacho
// (una celda que ningún mapa reconoce LANZA: nunca se ignora ni se supone qué quiso decir la historia), acciones de la pantalla
// de Acceso y armado del resultado de cada fila.
//
// Criterio: lo que la historia nombra y la app no ofrece es una DISCREPANCIA (la historia manda), no un error del arnés. Por eso
// toda acción sobre un elemento de la historia pasa por `runSteps` (captura el fallo y lo devuelve) y toda lectura es `safe`.

export { cell, fromSteps, strict } from '../api/common';

export const TENANT = 'alumno01';
export const LOGIN_URL = `/login?tenant=${TENANT}`;
export const PROGRAMS_PATH = '/programs';
/** Techo de espera por observación. La historia no fija plazos: este límite es de la prueba, no del producto. */
export const CEILING_MS = 10_000;
/** Tiempo que se observa para afirmar que algo NO ocurre («no se envía», «sigue en /login»). */
export const HOLD_MS = 2_000;
/** Tolerancias de referencia del piloto: solo producen una nota, nunca cambian el veredicto. */
export const REFERENCE_MS = { network: 5_000, local: 1_000, toast: 2_000 } as const;
const POLL_MS = 50;
const SUCCESS_MESSAGE = 'Sesión iniciada. Redirigiendo a Programas…';

export const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));

// ---------------------------------------------------------------------------------------------------------------------
// Lectura sin excepciones
// ---------------------------------------------------------------------------------------------------------------------

export const safe = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await read();
  } catch {
    return fallback;
  }
};

export const isVisible = (target: Locator): Promise<boolean> => safe(() => target.first().isVisible(), false);
export const isEnabled = (target: Locator): Promise<boolean> => safe(() => target.first().isEnabled({ timeout: 500 }), false);
export const isChecked = (target: Locator): Promise<boolean> => safe(() => target.first().isChecked({ timeout: 500 }), false);
export const countOf = (target: Locator): Promise<number> => safe(() => target.count(), 0);
export const valueOf = (target: Locator): Promise<string | undefined> => safe(() => target.first().inputValue({ timeout: 500 }), undefined);
export const attrOf = (target: Locator, name: string): Promise<string | undefined> => safe(async () => (await target.first().getAttribute(name, { timeout: 500 })) ?? undefined, undefined);
export const textOf = (target: Locator): Promise<string | undefined> => safe(async () => (await target.first().innerText({ timeout: 500 })).trim(), undefined);
export const isFocused = (target: Locator): Promise<boolean> => safe(() => target.first().evaluate((element) => element === document.activeElement, undefined, { timeout: 500 }), false);

export const pathOf = (page: Page): string => {
  try {
    return new URL(page.url()).pathname;
  } catch {
    return page.url();
  }
};

/** Líneas del texto visible de un aviso: la primera es el mensaje; el resto es lo que haya debajo (línea de detalle técnico). */
export const linesOf = (text: string | undefined): readonly string[] => (text ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');

/** Lo que hay bajo el mensaje, tal cual. La línea de detalle técnico es una decisión de producto pendiente: se anota, no se compara. */
export const detailOf = (text: string | undefined): string | undefined => {
  const rest = linesOf(text).slice(1);
  return rest.length === 0 ? undefined : rest.join('\n');
};

// ---------------------------------------------------------------------------------------------------------------------
// Esperas con techo y observación de lo que NO ocurre
// ---------------------------------------------------------------------------------------------------------------------

export interface Waited {
  readonly reached: boolean;
  readonly elapsedMs: number;
}

/** Espera a que se cumpla `condition`, con un techo. Nunca lanza: devuelve si se llegó y cuánto se tardó. */
export const waitUntil = async (condition: () => Promise<boolean>, ceilingMs: number = CEILING_MS): Promise<Waited> => {
  const started = performance.now();
  let reached = await safe(condition, false);
  while (!reached && performance.now() - started < ceilingMs) {
    await sleep(POLL_MS);
    reached = await safe(condition, false);
  }
  return { reached, elapsedMs: Math.round(performance.now() - started) };
};

/** Observa durante `durationMs` que `condition` sigue cumpliéndose. Devuelve si se mantuvo y a los cuántos ms dejó de cumplirse. */
export const holdsFor = async (condition: () => Promise<boolean>, durationMs: number = HOLD_MS): Promise<{ readonly held: boolean; readonly brokeAtMs?: number }> => {
  const started = performance.now();
  while (performance.now() - started < durationMs) {
    if (!(await safe(condition, false))) return { held: false, brokeAtMs: Math.round(performance.now() - started) };
    await sleep(POLL_MS);
  }
  return { held: true };
};

/** Si una observación superó la tolerancia de referencia, una nota: el veredicto no depende del tiempo. */
export const slowNote = (what: string, elapsedMs: number, referenceMs: number): readonly string[] =>
  elapsedMs > referenceMs ? [`${what} tardó ${elapsedMs} ms, por encima de la tolerancia de referencia de ${referenceMs} ms (el veredicto no depende del tiempo)`] : [];

// ---------------------------------------------------------------------------------------------------------------------
// Acciones que no lanzan: un elemento que falta es una discrepancia, no un error del arnés
// ---------------------------------------------------------------------------------------------------------------------

const shortError = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'error';

export type Step = readonly [what: string, action: () => Promise<unknown>];

/** Ejecuta las acciones en orden y se detiene en la primera que falla; devuelve su descripción o `undefined` si todas salieron bien. */
export const runSteps = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return `no se pudo ${what}: ${shortError(error)}`;
    }
  }
  return undefined;
};

/** Techo de una acción sobre un elemento de la historia: si no llega a existir o a poder pulsarse, es una discrepancia. */
export const ACTION = { timeout: CEILING_MS } as const;

// ---------------------------------------------------------------------------------------------------------------------
// Traducción de celdas (mapas de despacho; lo desconocido lanza)
// ---------------------------------------------------------------------------------------------------------------------

/** Texto de la interfaz entre «…» en una celda. Lanza si la celda no lo es. */
export const quoted = (text: string): string => {
  const match = /^«(.+)»$/.exec(text);
  if (!match?.[1]) throw new Error(`celda sin interpretación: se esperaba un texto entre «…» y llegó «${text}»`);
  return match[1];
};

/** Un aviso esperado: el texto entre «…» o `(ninguno)`. */
export const noticeOf = (text: string): string | undefined => (text === '(ninguno)' ? undefined : quoted(text));

type Marker = () => string;

const translate = (kind: string, markers: ReadonlyMap<string, Marker>, text: string): string => {
  const marker = markers.get(text);
  if (marker) return marker();
  if (text.startsWith('(')) throw new Error(`celda sin interpretación: ${kind} «${text}»`);
  return text;
};

const EMAILS: ReadonlyMap<string, Marker> = new Map<string, Marker>([
  ['(vacío)', () => ''],
  ['(tres espacios)', () => '   '],
  ['(ana @sigpro.test, con un espacio antes de la arroba)', () => 'ana @sigpro.test'],
  ['(GESTOR@sigpro.test con un espacio delante y otro detrás)', () => ' GESTOR@sigpro.test '],
  // Un correo que nadie ha usado: el contador de intentos de un correo sin cuenta no lo reinicia ningún reinicio de tenant
  ['(correo sin cuenta)', () => uniqueEmail('nadie')],
]);

const PASSWORDS: ReadonlyMap<string, Marker> = new Map<string, Marker>([
  ['(vacío)', () => ''],
  ['(un espacio)', () => ' '],
  ['incorrecta', () => WRONG_PASSWORD],
]);

/** Cada llamada con `(correo sin cuenta)` genera un correo nuevo: llámala UNA vez por fila y reutiliza el resultado. */
export const emailOf = (text: string): string => translate('correo', EMAILS, text);
export const passwordOf = (text: string): string => translate('contraseña', PASSWORDS, text);

// ---------------------------------------------------------------------------------------------------------------------
// Localizadores de la pantalla de Acceso: por rol y etiqueta (los textos de la interfaz que cita la historia)
// ---------------------------------------------------------------------------------------------------------------------

const named = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true }).or(page.getByRole('link', { name, exact: true }));

export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', exact: true });
export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const rememberBox = (page: Page): Locator => page.getByLabel('Mantener la sesión en este equipo', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const ssoButton = (page: Page): Locator => page.getByRole('button', { name: 'Acceder con certificado digital / SSO', exact: true });
export const passwordToggle = (page: Page): Locator => page.getByRole('button', { name: /^(Mostrar|Ocultar) contraseña$/ });
export const optionNamed = (page: Page, name: string): Locator => named(page, name);
export const alertOf = (page: Page): Locator => page.getByRole('alert');
export const successOverlay = (page: Page): Locator => page.getByRole('status').filter({ hasText: SUCCESS_MESSAGE });
export const signedOutNotice = (page: Page): Locator => page.getByRole('status').filter({ hasText: 'Sesión cerrada correctamente.' });
export const SIGNED_OUT_MESSAGE = 'Sesión cerrada correctamente.';
export { SUCCESS_MESSAGE };

/** La pantalla «Programas»: su título es un encabezado en escritorio y el texto de la cabecera en el diseño responsive (390 px). */
export const programsTitle = (page: Page): Locator => programsHeading(page).or(page.getByRole('banner').getByText('Programas', { exact: true }));
export const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await isVisible(programsTitle(page)));
export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await isVisible(loginHeading(page)));

/** Aviso bajo un campo, enlazado por la relación accesible entre el campo y su mensaje. `undefined` si el campo no tiene ninguno. */
export const fieldNotice = async (field: Locator, page: Page): Promise<{ readonly text?: string; readonly invalid: string | undefined }> => {
  const invalid = await attrOf(field, 'aria-invalid');
  const describedBy = (await attrOf(field, 'aria-describedby'))?.split(' ')[0];
  if (!describedBy) return { invalid };
  const text = await textOf(page.locator(`[id="${describedBy}"]`));
  return text === undefined ? { invalid } : { text, invalid };
};

/** El primer aviso de error visible: su mensaje (primera línea) y lo que haya debajo. */
export const alertReading = async (page: Page): Promise<{ readonly message?: string; readonly detail?: string }> => {
  const text = await textOf(alertOf(page));
  const message = linesOf(text)[0];
  const detail = detailOf(text);
  return { ...(message === undefined ? {} : { message }), ...(detail === undefined ? {} : { detail }) };
};

// ---------------------------------------------------------------------------------------------------------------------
// Sondas del navegador: preferencia de cookies, registro de peticiones, formulario visto alguna vez
// ---------------------------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión): así el aviso no se interpone ni roba el foco. No escribe tenant, tema ni idioma. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Anota en la propia página si el formulario de acceso llegó a pintarse en este documento (un destello no se ve en el estado final). */
const recordLoginForm = (): void => {
  const holder = window as unknown as { __loginFormSeen?: boolean };
  holder.__loginFormSeen = false;
  const mark = (): void => {
    if (document.querySelector('[data-testid="login-form"]')) holder.__loginFormSeen = true;
  };
  new MutationObserver(mark).observe(document, { childList: true, subtree: true });
  mark();
};

export const loginFormEverSeen = (page: Page): Promise<boolean> => safe(() => page.evaluate(() => (window as unknown as { __loginFormSeen?: boolean }).__loginFormSeen === true), true);

export interface LoginRequest {
  readonly tenantHeader: string | undefined;
  readonly status?: number;
}

export interface LoginRequests {
  readonly count: () => number;
  readonly list: () => readonly LoginRequest[];
}

const isLoginPost = (method: string, url: string): boolean => {
  try {
    return method === 'POST' && new URL(url).pathname === '/api/auth/login';
  } catch {
    return false;
  }
};

/** Registra las peticiones `POST /api/auth/login` de todas las pestañas del contexto, con su cabecera `x-tenant` y su estado. */
const trackLoginRequests = (context: BrowserContext): LoginRequests => {
  const entries = new Map<unknown, { tenantHeader: string | undefined; status?: number }>();
  context.on('request', (request) => {
    if (isLoginPost(request.method(), request.url())) entries.set(request, { tenantHeader: request.headers()['x-tenant'] });
  });
  context.on('response', (response) => {
    const entry = entries.get(response.request());
    if (entry) entry.status = response.status();
  });
  return { count: () => entries.size, list: () => [...entries.values()].map((entry) => ({ ...entry })) };
};

// ---------------------------------------------------------------------------------------------------------------------
// Resultado de la fila
// ---------------------------------------------------------------------------------------------------------------------

/** Una comprobación de la fila: lo que la historia espera y lo que se observó. La fila coincide si TODAS coinciden. */
export interface Check {
  readonly ok: boolean;
  readonly expected: string;
  readonly observed: string;
}

export const check = (ok: boolean, expected: string, observed: string): Check => ({ ok, expected, observed });

export interface Conclusion {
  readonly checks: readonly Check[];
  /** Notas que no afectan al veredicto (tolerancias superadas, hechos de las Reglas que no son un paso de la fila…). */
  readonly notes?: readonly string[];
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export const conclude = (conclusion: Conclusion): Outcome => {
  const failed = conclusion.checks.filter((item) => !item.ok);
  const difference = failed.length === 0 ? [] : [`Difiere: ${failed.map((item) => `la historia dice «${item.expected}» y se observó «${item.observed}»`).join('; ')}`];
  const note = [...difference, ...(conclusion.notes ?? [])].join('. ');
  return outcome(failed.length === 0, conclusion.checks.map((item) => item.expected).join('; '), conclusion.checks.map((item) => item.observed).join('; '), {
    ...(note === '' ? {} : { note }),
    ...(conclusion.evidence ? { evidence: conclusion.evidence } : {}),
  });
};

/** Lo que el manejador recibe además de la página y el contexto. */
export interface WebRun {
  readonly page: Page;
  readonly context: BrowserContext;
  readonly requests: LoginRequests;
  /** Guarda la pantalla final de la fila (de `target`, por defecto la página principal) ANTES de cualquier sonda que navegue. */
  readonly snapshot: (target?: Page) => Promise<void>;
}

export type WebHandler = (row: ManifestRow, run: WebRun) => Promise<Outcome>;

const COOKIE_EVIDENCE = 'Contexto limpio por fila (almacenamiento vacío). El aviso de cookies no se pulsa: un script de inicio fija solo sigpro.cookies=accepted, para que no robe el foco ni tape el menú; no es una sesión. El tenant lo adopta la propia página de ?tenant=alumno01.';

const captureName = (rowId: string): string => `${rowId.replaceAll('/', '_')}.png`;

const saveCapture = (rowId: string, image: Buffer): string => {
  const relative = `docs/story-runs/EP-LOGIN/captures/${captureName(rowId)}`;
  const target = resolve(RESULTS_ROOT, 'EP-LOGIN', 'captures', captureName(rowId));
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, image);
  return relative;
};

/** Envuelve el manejador de un Esquema: prepara las sondas del contexto y, si la fila discrepa, guarda la captura de la pantalla final. */
export const browserRow =
  (handler: WebHandler): BrowserRowHandler =>
  async (row, { page, context }) => {
    await context.addInitScript(fixCookiePreference);
    await context.addInitScript(recordLoginForm);
    const requests = trackLoginRequests(context);
    const shots: { final?: Buffer } = {};
    const snapshot = async (target: Page = page): Promise<void> => {
      shots.final = await safe(() => target.screenshot(), undefined);
    };
    const result = await handler(row, { page, context, requests, snapshot });
    const log = requests.list();
    const evidence = { cookiePreference: COOKIE_EVIDENCE, ...(log.length === 0 ? {} : { loginRequests: log }), ...result.evidence };
    if (result.verdict !== 'discrepa') return { ...result, evidence };
    const last = context.pages().at(-1) ?? page;
    const image = shots.final ?? (await safe(() => last.screenshot(), undefined));
    return { ...result, evidence: { ...evidence, ...(image ? { capture: saveCapture(row.rowId, image) } : {}) } };
  };

// ---------------------------------------------------------------------------------------------------------------------
// Acciones compuestas de la pantalla de Acceso
// ---------------------------------------------------------------------------------------------------------------------

/** Abre una dirección (por defecto /login?tenant=alumno01) y espera al formulario de acceso. */
export const openLogin = async (page: Page, url: string = LOGIN_URL): Promise<string | undefined> =>
  runSteps([
    [`abrir ${url}`, () => page.goto(url, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** Escribe correo y contraseña, como lo hace una persona: el correo de solo espacios o con espacios alrededor llega al campo tal cual lo deja el navegador. */
export const fillCredentials = async (page: Page, email: string, password: string): Promise<string | undefined> =>
  runSteps([
    ['escribir el correo', () => emailField(page).fill(email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(password, ACTION)],
  ]);

export const pressEnter = async (page: Page): Promise<string | undefined> => runSteps([['pulsar «Entrar»', () => enterButton(page).click(ACTION)]]);

export interface SignedIn {
  readonly ok: boolean;
  readonly observed: string;
  readonly elapsedMs: number;
}

/** Inicia sesión en la propia fila, con el formulario (nunca inyectando una sesión). `remember: false` desmarca la casilla antes de enviar. */
export const signInThroughForm = async (page: Page, credentials: { readonly email: string; readonly password: string }, remember = true): Promise<SignedIn> => {
  const failure =
    (await openLogin(page)) ??
    (remember ? undefined : await runSteps([['desmarcar «Mantener la sesión en este equipo»', () => rememberBox(page).uncheck(ACTION)]])) ??
    (await fillCredentials(page, credentials.email, credentials.password)) ??
    (await pressEnter(page));
  if (failure) return { ok: false, observed: failure, elapsedMs: 0 };
  const arrived = await waitUntil(() => onPrograms(page));
  return { ok: arrived.reached, observed: arrived.reached ? `en /programs (${arrived.elapsedMs} ms)` : `no llegó a /programs: ruta ${pathOf(page)}`, elapsedMs: arrived.elapsedMs };
};

/** «Cerrar sesión» desde el «Menú de usuario» de la cabecera (escritorio). */
export const signOutFromUserMenu = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir el «Menú de usuario»', () => page.getByRole('button', { name: 'Menú de usuario', exact: true }).click(ACTION)],
    ['pulsar «Cerrar sesión»', () => page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }).click(ACTION)],
  ]);

/** «Sin sesión», por comportamiento: abrir /programs en esta pestaña acaba en /login. Navega: va siempre el último paso de la fila. */
export const hasNoSession = async (page: Page, what = 'abrir /programs en esta pestaña'): Promise<Check> => {
  await safe(() => page.goto(PROGRAMS_PATH, { timeout: CEILING_MS }), undefined);
  await waitUntil(async () => (await onLoginForm(page)) || (await onPrograms(page)));
  const stays = await holdsFor(() => onLoginForm(page));
  return check(stays.held, `sin sesión iniciada (${what} acaba en /login)`, stays.held ? `sin sesión: ${what} acaba en /login` : `con sesión: ${what} acaba en ${pathOf(page)}`);
};

/** Mensaje de un resultado de envío: un aviso de error (con su texto) o la pantalla de transición «Sesión iniciada…». */
export interface LoginResult {
  readonly kind: 'redirecting' | 'alert' | 'programs' | 'timeout';
  readonly message?: string;
  readonly detail?: string;
  readonly elapsedMs: number;
}

/** Espera, con techo, a lo primero que aparezca tras pulsar «Entrar»: el aviso de error, la transición o /programs. */
export const awaitLoginResult = async (page: Page): Promise<LoginResult> => {
  let seen: Omit<LoginResult, 'elapsedMs'> = { kind: 'timeout' };
  const waited = await waitUntil(async () => {
    if (await isVisible(successOverlay(page))) {
      const text = await textOf(successOverlay(page));
      const detail = detailOf(text);
      seen = { kind: 'redirecting', message: linesOf(text)[0] ?? SUCCESS_MESSAGE, ...(detail === undefined ? {} : { detail }) };
      return true;
    }
    const alert = await alertReading(page);
    if (alert.message !== undefined) {
      seen = { kind: 'alert', message: alert.message, ...(alert.detail === undefined ? {} : { detail: alert.detail }) };
      return true;
    }
    if (await onPrograms(page)) {
      seen = { kind: 'programs' };
      return true;
    }
    return false;
  });
  return { ...seen, elapsedMs: waited.elapsedMs };
};

/** Describe un resultado de envío con los datos crudos (sin la línea de detalle, que va aparte). */
export const describeResult = (result: LoginResult, page: Page): string => {
  const shown: Readonly<Record<LoginResult['kind'], string>> = {
    redirecting: `ve el mensaje «${result.message ?? ''}»`,
    alert: `ve el aviso de error «${result.message ?? ''}»`,
    programs: 'llegó a /programs sin pantalla de transición',
    timeout: `no apareció ningún mensaje en ${CEILING_MS} ms (ruta ${pathOf(page)})`,
  };
  return shown[result.kind];
};

/** El mensaje que dice la historia coincide con lo observado. «Sesión iniciada…» es la transición; el resto, el aviso de error. */
export const messageMatches = (expected: string, result: LoginResult): boolean => result.message === expected && result.kind === (expected === SUCCESS_MESSAGE ? 'redirecting' : 'alert');

/** «Llega a /programs» tras una transición ya vista; si el mensaje no fue ese, se mira un instante (no se espera el techo entero). */
export const reachesPrograms = (page: Page, ceilingMs: number = CEILING_MS): Promise<Waited> => waitUntil(() => onPrograms(page), ceilingMs);

/** Cadena `evidence.detailLine` solo si hay detalle: texto crudo, sin comparar (decisión de producto pendiente). */
export const detailEvidence = (detail: string | undefined): Readonly<Record<string, unknown>> => (detail === undefined ? {} : { detailLine: detail });

export const lengthOf = (text: string | undefined): string => (text === undefined ? 'no se pudo leer' : `longitud ${text.length}`);
