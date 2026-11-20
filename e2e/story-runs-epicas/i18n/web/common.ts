// Piezas comunes de las filas de navegador de EP-I18N. Web a 1440 px; la app móvil servida como web de Expo (390 px, NO nativa)
// tiene sus piezas en `../mobile/common.ts`, que reutiliza estas. Criterio: cada control se busca como lo haría una persona (por
// rol y nombre, o por texto visible). El idioma cambia el nombre de cada control, así que cada nombre se toma de la historia en el
// idioma de la fila. Las lecturas no lanzan y tienen plazo; un elemento ausente o ambiguo NO cuenta como cumplido.

import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { TENANT_A, WRONG_PASSWORD } from '../../../story-runs/support/prepare';
import { ACTION, HOLD_MS, holdsFor, linesOf, pathOf, safe, waitUntil, type Step } from '../../support/browser';
import { check, conclude as concludeChecks, type Check } from '../../support/checks';
import { notExecutable, outcome, type Outcome } from '../../core/framework';

export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:5173';
export const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';
/** Acceso de la web con el tenant de la prueba. */
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;

export type Lang = 'es' | 'en';

export interface AccessTexts {
  readonly title: string;
  readonly submit: string;
  readonly email: string;
  readonly password: string;
  readonly forgot: string;
  readonly language: string;
  readonly tenant: string;
  readonly remember: string;
  readonly noAccount: string;
  readonly mfaTitle: string;
  readonly mfaCode: string;
  readonly verify: string;
}

/** Nombres de los controles de Acceso en cada idioma, tal como los citan las historias de EP-I18N. */
export const ACCESS: Readonly<Record<Lang, AccessTexts>> = {
  es: {
    title: 'Iniciar sesión',
    submit: 'Entrar',
    email: 'Correo electrónico',
    password: 'Contraseña',
    forgot: '¿Olvidaste la contraseña?',
    language: 'Idioma',
    tenant: 'Tenant de trabajo',
    remember: 'Mantener la sesión en este equipo',
    noAccount: '¿Sin cuenta?',
    mfaTitle: 'Verificación en dos pasos',
    mfaCode: 'Código de verificación',
    verify: 'Verificar',
  },
  en: {
    title: 'Sign in',
    submit: 'Sign in',
    email: 'Email',
    password: 'Password',
    forgot: 'Forgot password?',
    language: 'Language',
    tenant: 'Working tenant',
    remember: 'Keep me signed in on this device',
    noAccount: 'No account?',
    mfaTitle: 'Two-step verification',
    mfaCode: 'Verification code',
    verify: 'Verify',
  },
};

/** La opción «ES» o «EN» de un selector de idioma, tal como la escribe la celda sin comillas. */
export const LANG_OPTION: ReadonlyMap<string, Lang> = new Map<string, Lang>([
  ['ES', 'es'],
  ['EN', 'en'],
]);

/** Contraseña que la historia llama «incorrecta»: la misma que usa el piloto (cualquier texto que no sea la del usuario). */
export const WRONG_PASSWORD_CELL = 'incorrecta';

/** Encabezado de nivel 1 con ese nombre exacto (título de una pantalla de Acceso o de una sección). */
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

/** Nota de cada fila de páginas privadas: el aviso de cookies tapa el pie, así que la prueba fija la preferencia antes de abrir. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como las épicas anteriores; el aviso de cookies no se ejerce aquí.';

/** Nota de las filas de la app móvil: se miden como web de Expo a 390 px, no como iOS ni Android nativos. */
export const MOBILE_NOTE = 'Se mide la app móvil como web de Expo a 390 × 844 px: no es nativo (no hay iOS ni Android).';

/** Nota de la comprobación «debajo de un campo»: solo mide la posición vertical del aviso, no que sea el de ese campo. */
export const BELOW_NOTE = 'La comprobación «debajo del campo» es laxa: solo mide que el aviso empieza por debajo del borde inferior del campo, no que sea el aviso de ese campo.';

/** Se ejecuta en cada carga: fija la preferencia de cookies solo si no hay ninguna (no es sesión ni elección de idioma). */
export const fixCookiePreference = (): void => {
  try {
    if (window.localStorage.getItem('sigpro.cookies') === null) window.localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // Sin almacenamiento el aviso queda como esté: ninguna fila depende de él
  }
};

/** Contexto nuevo de la web a 1440 px con el idioma del sistema de la fila y almacenamiento vacío (sin elección guardada). */
export const webContext = async (browser: Browser, locale: string, withCookies = false): Promise<BrowserContext> => {
  const context = await browser.newContext({ baseURL: WEB_URL, viewport: { width: 1440, height: 900 }, locale, timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
  if (withCookies) await context.addInitScript(fixCookiePreference);
  return context;
};

/** Contexto nuevo de la app móvil servida como web de Expo a 390 × 844 (el mismo criterio que el proyecto `mobile` del config). */
export const phoneContext = (browser: Browser, locale: string): Promise<BrowserContext> =>
  browser.newContext({ baseURL: MOBILE_URL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale, timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });

/** El navegador del contexto del arnés; sin él no hay forma de abrir contextos propios (error del arnés, no hallazgo). */
export const browserOf = (context: BrowserContext): Browser => {
  const browser = context.browser();
  if (!browser) throw new Error('El contexto del arnés no tiene navegador: no se pueden abrir contextos propios');
  return browser;
};

/** ¿Responde la URL? Sondeo con plazo: si no responde, la fila no se ejecuta en esta superficie (entorno, no hallazgo). */
export const reachable = (url: string): Promise<boolean> => safe(async () => (await fetch(url, { signal: AbortSignal.timeout(3_000) })).ok, false);

export const notRunning = (url: string): string =>
  `Entorno: la app móvil (Expo web) no responde en ${url} durante esta superficie; la fila no se ejecuta aquí (hace falta Expo levantado en ese puerto).`;

/** Texto con espacios no separables (U+00A0 y U+202F) pasados a espacio normal: solo para comparar textos sin tipografía. */
export const normalizeSpaces = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ').trim();

// --- Lecturas (no lanzan, con plazo) --------------------------------------------------------------------------------------------

/** Cuántos elementos visibles casan: -1 si la lectura falla (no cuenta como ninguno ni como uno). */
export const visibleCount = (target: Locator): Promise<number> => safe(() => target.filter({ visible: true }).count(), -1);

/** Texto del único elemento visible que casa (espacios normalizados); `undefined` si no hay uno solo (ninguno o ambiguo). */
export const readVisible = (target: Locator): Promise<string | undefined> =>
  safe(async () => {
    const visible = target.filter({ visible: true });
    if ((await visible.count()) !== 1) return undefined;
    return normalizeSpaces(await visible.innerText({ timeout: 1_000 }));
  }, undefined);

/** Valor del único campo visible que casa (`inputValue` también lee `select`); `undefined` si no hay uno solo. */
export const readValue = (target: Locator): Promise<string | undefined> =>
  safe(async () => {
    const visible = target.filter({ visible: true });
    if ((await visible.count()) !== 1) return undefined;
    return visible.inputValue({ timeout: 1_000 });
  }, undefined);

export const describeCount = (count: number): string => {
  if (count < 0) return 'lectura fallida';
  if (count === 0) return 'ninguno visible';
  if (count === 1) return 'uno visible';
  return `${count} visibles (ambiguo)`;
};

// --- Comprobaciones (cada una con lo que la historia dice y lo medido) -----------------------------------------------------

/** Plazo de una reacción local (cambio de idioma, aparición de un texto o de un campo): tolerancia del arnés (3 s locales). */
export const REACTION_MS = 3_000;
/** Plazo de algo que pasa por la red o por una navegación: tolerancia del arnés (5 s de red o de navegación). */
export const NETWORK_MS = 5_000;

/** Una comprobación con el tiempo que tardó en cumplirse: dato aparte (el README pide registrar la espera, no compararla). */
export interface TimedCheck extends Check {
  readonly waitedMs: number;
}

const timed = (entry: Check, waitedMs: number): TimedCheck => ({ ...entry, waitedMs });

/** «<etiqueta> «X»»: el único elemento visible tiene ese texto exacto (espera con techo). */
export const textCheck = async (target: Locator, label: string, expected: string, ceilingMs: number = REACTION_MS): Promise<TimedCheck> => {
  const reached = await waitUntil(async () => (await readVisible(target)) === expected, ceilingMs);
  const measured = await readVisible(target);
  return timed(check(reached.reached, `${label} «${expected}»`, measured === undefined ? `${label}: ${describeCount(await visibleCount(target))}` : `${label} «${measured}»`), reached.elapsedMs);
};

/** Los encabezados de nivel 1 que se ven, con espacios normalizados (lo observado del título). */
const visibleHeadings = (page: Page): Promise<readonly string[]> =>
  safe<readonly string[]>(async () => (await page.getByRole('heading', { level: 1 }).filter({ visible: true }).allInnerTexts()).map(normalizeSpaces), []);

/** «título «X»»: el encabezado de nivel 1 con ese nombre se ve (tras una carga o navegación: plazo de red). */
export const titleCheck = async (page: Page, expected: string): Promise<TimedCheck> => {
  const reached = await waitUntil(async () => (await visibleCount(heading1(page, expected))) === 1, NETWORK_MS);
  const shown = await visibleHeadings(page);
  return timed(check(reached.reached, `título «${expected}»`, `títulos visibles: ${shown.length > 0 ? shown.map((text) => `«${text}»`).join(', ') : '(ninguno)'}`), reached.elapsedMs);
};

/** Un control o elemento que debe verse una sola vez (espera con techo); lo observado es cuántos se ven. */
export const oneVisibleCheck = async (target: Locator, label: string): Promise<TimedCheck> => {
  const reached = await waitUntil(async () => (await visibleCount(target)) === 1, REACTION_MS);
  const count = await visibleCount(target);
  return timed(check(reached.reached, `${label} visible`, `${label}: ${describeCount(count)}`), reached.elapsedMs);
};

/** Un campo con ese valor exacto (espera con techo). */
export const valueCheck = async (target: Locator, label: string, expected: string): Promise<TimedCheck> => {
  const reached = await waitUntil(async () => (await readValue(target)) === expected, REACTION_MS);
  const measured = await readValue(target);
  return timed(check(reached.reached, `${label} «${expected}»`, measured === undefined ? `${label}: ${describeCount(await visibleCount(target))}` : `${label} «${measured}»`), reached.elapsedMs);
};

/** `lang` del documento: espera con techo a que sea el de la elección. */
export const langCheck = async (page: Page, expected: string): Promise<TimedCheck> => {
  const current = (): Promise<string | null | undefined> => safe(() => page.locator('html').getAttribute('lang', { timeout: 1_000 }), undefined);
  const reached = await waitUntil(async () => (await current()) === expected, REACTION_MS);
  const measured = await current();
  return timed(check(reached.reached, `idioma declarado de la página «${expected}»`, `idioma declarado «${measured ?? '(sin atributo)'}»`), reached.elapsedMs);
};

/** Escapa un texto para usarlo dentro de una expresión regular. */
const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Un texto de la interfaz como lo busca una persona: por subcadena y sensible a mayúsculas. El texto de un enlace puede compartir
 * elemento con otro texto («¿Sin cuenta?» y «Solicitar acceso» van en el mismo párrafo), así que la coincidencia exacta no sirve.
 */
export const textOfUi = (page: Page, text: string): Locator => page.getByText(new RegExp(escapeRegExp(text)));

/** «Ningún elemento visible con ese texto» durante una ventana de observación (el ancla positiva va antes). */
export const absentText = async (page: Page, text: string): Promise<Check> => {
  const held = await holdsFor(async () => (await visibleCount(textOfUi(page, text))) === 0);
  const count = held.held ? 0 : await visibleCount(textOfUi(page, text));
  return check(held.held, `no ve «${text}»`, held.held ? `no aparece «${text}» durante ${HOLD_MS / 1000} s` : `aparece «${text}» (${describeCount(count)}) a los ${held.brokeAtMs ?? 0} ms`);
};

/** [Regla] Ninguno de los textos de la lista se ve durante la ventana de observación; lo observado son los que siguen visibles. */
export const absentAll = async (page: Page, texts: readonly string[]): Promise<Check> => {
  const found = async (): Promise<readonly string[]> => {
    const counts = await Promise.all(texts.map((text) => visibleCount(textOfUi(page, text))));
    return texts.filter((_text, index) => counts[index] !== 0);
  };
  const held = await holdsFor(async () => (await found()).length === 0);
  const remaining = held.held ? [] : await found();
  return check(held.held, `[regla] ninguno de los ${texts.length} textos en español listados`, held.held ? `ninguno de los ${texts.length} visible durante ${HOLD_MS / 1000} s` : `siguen visibles: ${remaining.join(', ')}`);
};

/** [Control] Cada texto de la lista se ve en español antes de elegir el idioma: sin esto, la ausencia posterior no prueba nada. */
export const spanishShownCheck = async (page: Page, texts: readonly string[]): Promise<Check> => {
  const missing = async (): Promise<readonly string[]> => {
    const counts = await Promise.all(texts.map((text) => visibleCount(textOfUi(page, text))));
    return texts.filter((_text, index) => (counts[index] ?? 0) < 1);
  };
  const reached = await waitUntil(async () => (await missing()).length === 0, REACTION_MS);
  const absent = reached.reached ? [] : await missing();
  return check(reached.reached, `[control] los ${texts.length} textos de la lista se ven en español antes de elegir el idioma`, reached.reached ? `se ven los ${texts.length}` : `no se ven: ${absent.join(', ')}`);
};

/** Texto visible de la página, o `undefined` si la lectura falla (un fallo de lectura no cuenta como «sin texto»). */
const visibleBodyText = (page: Page): Promise<string | undefined> => safe<string | undefined>(() => page.locator('body').innerText({ timeout: 1_000 }), undefined);

/** Un código como palabra suelta: no pegado a otra palabra ni a una dirección de correo («admin@…» no cuenta como código). */
const codePattern = (code: string): RegExp => new RegExp(`(^|[^A-Za-z0-9_@.])${code}($|[^A-Za-z0-9_@])`);

/** Qué códigos de la lista aparecen como texto visible; `undefined` si la lectura falla. */
export const codesVisible = async (page: Page, codes: readonly string[]): Promise<readonly string[] | undefined> => {
  const text = await visibleBodyText(page);
  if (text === undefined) return undefined;
  return codes.filter((code) => codePattern(code).test(text));
};

/** [Regla] Ningún código de MENSAJE aparece como texto visible (una frase sin versión no se sustituye por su clave). Solo estos códigos deciden el veredicto. */
export const messageCodesCheck = async (page: Page, codes: readonly string[]): Promise<Check> => {
  const found = await codesVisible(page, codes);
  if (found === undefined) return check(false, '[regla] ningún código de mensaje visible', 'lectura fallida del texto de la página');
  return check(found.length === 0, `[regla] ningún código de mensaje visible (${codes.join(', ')})`, found.length === 0 ? `ninguno de los ${codes.length} códigos aparece como texto` : `aparecen como texto: ${found.join(', ')}`);
};

/** Ningún aviso visible en ese lugar durante la ventana de observación (el ancla positiva va antes). */
export const noVisibleCheck = async (target: Locator, label: string): Promise<Check> => {
  const held = await holdsFor(async () => (await visibleCount(target)) === 0);
  const count = held.held ? 0 : await visibleCount(target);
  return check(held.held, `ningún aviso ${label}`, held.held ? `ningún aviso ${label} durante ${HOLD_MS / 1000} s` : `aviso ${label}: ${describeCount(count)}`);
};

/** El aviso (`role=alert`) tiene ese título: se mira la primera línea, porque la traza HTTP va debajo. */
export const alertCheck = async (target: Locator, expected: string): Promise<TimedCheck> => {
  const first = async (): Promise<string | undefined> => linesOf(await readVisible(target))[0];
  const reached = await waitUntil(async () => (await first()) === expected, NETWORK_MS);
  const measured = await first();
  return timed(check(reached.reached, `aviso «${expected}»`, measured === undefined ? `aviso: ${describeCount(await visibleCount(target))}` : `aviso «${measured}»`), reached.elapsedMs);
};

interface Box {
  readonly x: number;
  readonly y: number;
  readonly height: number;
}

const boxOf = (target: Locator): Promise<Box | undefined> =>
  safe(async () => {
    const box = await target.filter({ visible: true }).boundingBox({ timeout: 1_000 });
    return box ?? undefined;
  }, undefined);

/** «debajo de «X»»: el aviso empieza por debajo del borde inferior del campo (posiciones medidas; comprobación laxa, ver BELOW_NOTE). */
export const belowField = async (error: Locator, field: Locator, fieldName: string): Promise<Check> => {
  const [errorBox, fieldBox] = await Promise.all([boxOf(error), boxOf(field)]);
  if (errorBox === undefined) return check(false, `aviso debajo de «${fieldName}»`, 'aviso: sin posición legible');
  if (fieldBox === undefined) return check(false, `aviso debajo de «${fieldName}»`, `campo «${fieldName}»: sin posición legible`);
  const below = errorBox.y >= fieldBox.y + fieldBox.height - 1;
  return check(below, `aviso debajo de «${fieldName}»`, `aviso en y=${Math.round(errorBox.y)}, campo en y=${Math.round(fieldBox.y)}–${Math.round(fieldBox.y + fieldBox.height)}`);
};

/** La ruta actual es la esperada (la ruta sin consulta). */
export const pathCheck = (page: Page, expected: string): Check => {
  const measured = pathOf(page);
  return check(measured === expected, `en ${expected}`, `en ${measured}`);
};

// --- Recarga (la Regla «pasa al idioma elegido sin recargarla») -----------------------------------------------------------

const MARK_KEY = 'marcaSinRecarga';

/** Marca la ventana: si la página se recarga, la marca desaparece. */
export const markPage = (page: Page): Promise<void> =>
  page.evaluate((key: string) => {
    (window as unknown as Record<string, string>)[key] = 'antes';
  }, MARK_KEY);

/** La marca que queda tras la acción (undefined si la lectura falla o la página se recargó). */
export const markOf = (page: Page): Promise<string | undefined> =>
  safe(() => page.evaluate((key: string) => (window as unknown as Record<string, string | undefined>)[key], MARK_KEY), undefined);

/** [Regla] La página no se recargó al elegir: la marca de la ventana sobrevive. */
export const sinRecargaCheck = (marker: string | undefined): Check =>
  check(marker === 'antes', '[regla] la página no se recarga al elegir', marker === 'antes' ? 'la página no se recargó (la marca sobrevive)' : `la marca desapareció (${marker ?? 'sin marca'})`);

// --- Resultados -----------------------------------------------------------------------------------------------------------------

/** Pasos con diagnóstico: ante un fallo, las tres primeras líneas del error de Playwright y la línea de elementos que tapan. */
export const callLogOf = (error: unknown): string => {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const head = lines.slice(0, 3).join(' | ');
  const covered = lines.find((line) => line.includes('intercepts pointer events'));
  return covered ? `${head} | ${covered}` : head;
};

/** Como `runSteps` de support/browser (que no se toca), pero la falla conserva el diagnóstico de `callLogOf`. */
export const runStepsLogged = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return `no se pudo ${what}: ${callLogOf(error)}`;
    }
  }
  return undefined;
};

/** La acción de la fila no se pudo hacer: la pantalla no ofrece lo que la historia nombra (la llamada de Playwright va en la nota). */
export const actionMissing = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: `La historia nombra un elemento que la pantalla no ofrece. Llamada de Playwright: ${failure}` });

/** Resultado de una fila a partir de sus comprobaciones. Si alguna difiere, la nota dice cuál (esperado / observado) y se conserva la nota de la fila. La espera más larga va a la evidencia. */
export const conclude = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const differing = checks.filter((entry) => !entry.ok).map((entry) => `esperado «${entry.expected}» / observado «${entry.observed}»`);
  const notes = [differing.length > 0 ? `Difiere en: ${differing.join('; ')}.` : undefined, extra.note].filter((note): note is string => note !== undefined);
  const longestWaitMs = Math.max(0, ...checks.map((entry) => (entry as Partial<TimedCheck>).waitedMs ?? 0));
  return concludeChecks(checks, { ...extra, evidence: { ...extra.evidence, esperaMaximaMs: longestWaitMs }, note: notes.length > 0 ? notes.join(' ') : undefined });
};

/** Añade una nota de plataforma o de preparación al resultado, sin perder la que ya tenga (las notas se concatenan). */
export const withNote = (result: Outcome, note: string): Outcome => ({ ...result, note: result.note ? `${result.note} ${note}` : note });

/** Fila de la app móvil sin Expo levantado: no se ejecuta, con el motivo de entorno. */
export const unreachableMobile = (expected: string): Outcome => notExecutable(expected, notRunning(MOBILE_URL));

// --- Predicados de la pantalla (bilingües: la elección queda guardada y el texto cambia) -----------------------------------

/** En /login con el título de Acceso en cualquier idioma. */
export const onLoginFormAny = async (page: Page): Promise<boolean> => {
  if (pathOf(page) !== '/login') return false;
  const counts = await Promise.all([heading1(page, ACCESS.es.title), heading1(page, ACCESS.en.title)].map((target) => visibleCount(target)));
  return counts.some((count) => count >= 1);
};

/** En el segundo paso de verificación, con el título en cualquier idioma. */
export const onMfaAny = async (page: Page): Promise<boolean> => {
  const counts = await Promise.all([heading1(page, ACCESS.es.mfaTitle), heading1(page, ACCESS.en.mfaTitle)].map((target) => visibleCount(target)));
  return counts.some((count) => count >= 1);
};

/** En /programs con la sección «Programas» o «Programs» visible. */
export const onProgramsAny = async (page: Page): Promise<boolean> => {
  if (pathOf(page) !== '/programs') return false;
  const names = ['Programas', 'Programs'];
  const counts = await Promise.all(names.map((name) => visibleCount(page.getByRole('heading', { name, exact: true }).or(page.getByRole('link', { name, exact: true })))));
  return counts.some((count) => count >= 1);
};

// --- Pasos (cada uno con su nombre, para el diagnóstico) -----------------------------------------------------------------

/** Abre Acceso de la web y espera su título en español (el idioma por defecto). */
export const enterAccessWeb = (page: Page): readonly Step[] => [
  ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
  ['ver el título «Iniciar sesión»', () => heading1(page, ACCESS.es.title).waitFor(ACTION)],
];

/** Elige «ES» o «EN» en el selector «Idioma» (o «Language») de la web: un `select`, como lo haría una persona. */
export const pickLangWeb = (page: Page, from: string, lang: Lang): Step => [
  `elegir «${lang.toUpperCase()}» en «${from}»`,
  () => page.getByRole('combobox', { name: from, exact: true }).selectOption(lang, ACTION),
];

/** Entra en Acceso de la web con la cuenta de la fila; si el idioma es inglés, lo elige antes de entrar. Espera la llegada a /programs. */
export const signInWeb = (page: Page, lang: Lang, email: string, password: string): readonly Step[] => [
  ...enterAccessWeb(page),
  ...(lang === 'en' ? [pickLangWeb(page, ACCESS.es.language, 'en')] : []),
  [`escribir «${ACCESS[lang].email}»`, () => page.getByLabel(ACCESS[lang].email, { exact: true }).fill(email, ACTION)],
  [`escribir «${ACCESS[lang].password}»`, () => page.getByLabel(ACCESS[lang].password, { exact: true }).fill(password, ACTION)],
  [`pulsar «${ACCESS[lang].submit}»`, () => page.getByRole('button', { name: ACCESS[lang].submit, exact: true }).click(ACTION)],
  ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
];

/** La contraseña que se envía: «incorrecta» es una contraseña que no es la de la cuenta; cualquier otro texto va tal cual. */
export const passwordSent = (cell: string): string => (cell === WRONG_PASSWORD_CELL ? WRONG_PASSWORD : cell);

/** Nota de la fila que envía «incorrecta»: la contraseña enviada no es la de la cuenta (la misma convención del piloto). */
export const PASSWORD_NOTE = 'La celda «incorrecta» se envía como una contraseña que no es la de la cuenta (la misma convención del piloto).';

/** Añade la nota de la convención de «incorrecta» solo cuando la celda la usa. */
export const passwordNote = (cellText: string, result: Outcome): Outcome => (cellText === WRONG_PASSWORD_CELL ? withNote(result, PASSWORD_NOTE) : result);
