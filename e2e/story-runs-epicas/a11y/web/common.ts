import type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, WRONG_PASSWORD, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, type Check } from '../../support/checks';
import { notExecutable, outcome, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de EP-A11Y: web a 1440 px y la app móvil servida como web de Expo a 390 px (NO es nativa).
// Criterio: cada elemento se localiza por algo distinto de la propiedad que la fila comprueba (su contenedor, la fila o la tarjeta
// a la que pertenece, la estructura del DOM) y su propiedad se LEE con la API de accesibilidad de Playwright (`ariaSnapshot`),
// con el foco (`:focus`) o con sus atributos. Así un nombre equivocado es un hallazgo, no un «no encontrado» del arnés.

export const LOGIN_PATH = `/login?tenant=${TENANT_A}`;
export const MOBILE_URL = process.env.E2E_MOBILE_URL ?? 'http://localhost:8081';
/** Plazo de red o de navegación. La historia no fija plazos: es la tolerancia de la prueba. */
export const NETWORK_MS = 5_000;
/** Plazo de una reacción local de la pantalla. */
export const REACTION_MS = 1_000;

export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la web, para que el aviso de cookies no tape controles; el aviso no se ejerce aquí.';

/** Cuenta de administración de alumno01 (sin segundo factor): la que usan las historias para iniciar sesión sin MFA en el tenant. */
export const ALUMNO_ADMIN = { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' } as const;
/** Celda «incorrecta»: cualquier contraseña que no sea la de la cuenta. */
export const WRONG_PASSWORD_CELL = 'incorrecta';
/** Contraseñas que aparecen en las celdas (validación estricta: una contraseña desconocida lanza). */
export const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  [WRONG_PASSWORD_CELL, WRONG_PASSWORD],
  [DEMO.gestor.password, DEMO.gestor.password],
  [DEMO.consultor.password, DEMO.consultor.password],
  [DEMO.auditor.password, DEMO.auditor.password],
  [DEMO.admin.password, DEMO.admin.password],
  [DEMO.pendiente.password, DEMO.pendiente.password],
  [DEMO.bloqueado.password, DEMO.bloqueado.password],
  [ALUMNO_ADMIN.password, ALUMNO_ADMIN.password],
]);

/** Se ejecuta en cada carga: fija la preferencia de cookies solo si no hay ninguna (no es sesión ni idioma). */
const fixCookiePreference = (): void => {
  try {
    if (window.localStorage.getItem('sigpro.cookies') === null) window.localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // Sin almacenamiento el aviso queda como esté: ninguna fila depende de él
  }
};

/** Preferencia de cookies fijada antes de la primera carga del contexto (ver `COOKIE_NOTE`). */
export const quietCookies = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(fixCookiePreference);
};

/** El navegador del contexto del arnés, para abrir contextos propios (móvil). Sin él es un error del arnés. */
export const browserOf = (context: BrowserContext): Browser => {
  const browser = context.browser();
  if (!browser) throw new Error('El contexto del arnés no tiene navegador: no se pueden abrir contextos propios');
  return browser;
};

/** Contexto nuevo de la app móvil servida como web de Expo a 390 × 844 (el mismo criterio que el proyecto `mobile` del config). */
export const phoneContext = (browser: Browser): Promise<BrowserContext> =>
  browser.newContext({ baseURL: MOBILE_URL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });

/** ¿Responde la URL? Sin respuesta, la fila móvil no se ejecuta en esta superficie (entorno, no hallazgo). */
export const reachable = (url: string): Promise<boolean> => safe(async () => (await fetch(url, { signal: AbortSignal.timeout(3_000) })).ok, false);

/** Reinicio de alumno01 antes de cada fila. Un fallo aquí es del arnés (lo lanza `resetTenants`). */
export const resetAlumno = (): Promise<void> => resetTenants([TENANT_A]);

// --- Localizadores de pantalla (para la preparación; las comprobaciones usan sus propios contenedores) --------------------------

export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
export const programsTitle = (page: Page): Locator => heading1(page, 'Programas');
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
/** Fila de la tabla de programas (o de la lista) que contiene el enlace de ese código. */
export const programRow = (page: Page, code: string): Locator => page.getByRole('row').filter({ has: page.getByRole('link', { name: code, exact: true }) });
/** Tarjeta de no conformidad: el elemento de lista que contiene su botón «Abrir NC-…». */
export const ncCard = (page: Page, code: string): Locator => page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Abrir ${code}`, exact: true }) });

// --- Pasos de preparación (como una persona) -------------------------------------------------------------------------------------

export const openLogin = (page: Page): Step => ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })];

export const typeCredentials = (page: Page, email: string, password: string): readonly Step[] => [
  ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(email, ACTION)],
  ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(password, ACTION)],
];

export const submitLogin = (page: Page): Step => ['pulsar «Entrar»', () => enterButton(page).click(ACTION)];

/**
 * Ejecuta los pasos en orden y se detiene en el primero que falla. Un fallo conserva las primeras líneas del error de Playwright y,
 * si aparece, la línea «intercepts pointer events» del registro de llamadas (diagnóstico: un clic tapado es del arnés, no de la app).
 */
export const runStepsLogged = async (steps: readonly Step[]): Promise<string | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      const intercept = lines.find((line) => /intercepts pointer events/.test(line));
      return `no se pudo ${what}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
    }
  }
  return undefined;
};

/** Inicia sesión desde el formulario y espera a /programs. Devuelve por qué no llegó, si no llegó. */
export const signInToPrograms = (page: Page, email: string, password: string): Promise<string | undefined> =>
  runStepsLogged([
    openLogin(page),
    ['ver el formulario de acceso', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    ...typeCredentials(page, email, password),
    submitLogin(page),
    ['llegar a /programs', () => programsTitle(page).waitFor({ timeout: CEILING_MS })],
    ['esperar a que la lista de programas cargue', () => listSettled(page)],
  ]);

/**
 * Preparación que no se cumple. Un paso que no se pudo dar (pantalla no alcanzada, elemento que no se localiza, clic que no llega)
 * es un error del arnés con su evidencia: `notExecutable`. Un estado leído que no coincide con lo que da por hecho la historia es
 * un hallazgo: `preparationFailedWeb` (discrepa).
 */
export const prepFailed = (expected: string, reason: string): Outcome =>
  reason.startsWith('no se pudo ') ? notExecutable(expected, `Pantalla o acción no alcanzada (error del arnés, con la evidencia): ${reason}`) : preparationFailedWeb(expected, reason);

/** Un localizador que casa con varios elementos no es un dato de la app: la fila no se ejecuta, con el recuento. `undefined` si hay uno o ninguno. */
export const ambiguityOutcome = async (locator: Locator, expected: string, label: string): Promise<Outcome | undefined> => {
  const count = await safe(() => locator.count(), 0);
  return count > 1 ? notExecutable(expected, `Localizador ambiguo para ${label}: ${count} elementos (error del arnés, no un dato de la app).`) : undefined;
};

/** La tabla de programas termina de cargar (sin `aria-busy`): la fila, la barra o el número que se leen después ya existen. */
export const listSettled = async (page: Page): Promise<void> => {
  await page.getByRole('table').waitFor({ timeout: CEILING_MS });
  const done = await waitUntil(async () => (await safe(() => page.getByRole('table').getAttribute('aria-busy', { timeout: 500 }), undefined)) === 'false', NETWORK_MS);
  if (!done.reached) throw new Error('la tabla de programas sigue marcada como ocupada tras el plazo');
};

/** Un fallo al actuar. Un error del arnés (intercepción, elemento inestable, ambigüedad) no es un hallazgo; un elemento que no aparece sí. */
const HARNESS_ERROR = /intercepts pointer events|is not stable|outside of the viewport|strict mode violation|resolved to \d+ elements|not receiving pointer events|Target (page|closed)|Invalid selector/i;
export const failedAction = (expected: string, failure: string): Outcome =>
  HARNESS_ERROR.test(failure)
    ? notExecutable(expected, `Error del arnés al actuar, no un hallazgo sobre la app: ${failure}`)
    : outcome(false, expected, `no se pudo ${failure}`, { note: 'Tras la preparación, la acción de la historia no se pudo completar en la pantalla (ver observado).' });

// --- Nombres y foco leídos de la API de accesibilidad -----------------------------------------------------------------------------

export interface Named {
  readonly role: string;
  readonly name: string;
}

const SNAPSHOT_HEAD = /^\s*-\s+([\w-]+)(?:\s+"((?:[^"\\]|\\.)*)")?/;

/** Rol y nombre accesible del único elemento de `locator` (`ariaSnapshot`); `undefined` si no hay uno solo o la lectura falla. */
export const namedOf = (locator: Locator): Promise<Named | undefined> =>
  safe(async () => {
    if ((await locator.count()) !== 1) return undefined;
    const snapshot = await locator.ariaSnapshot({ timeout: 1_000 });
    const head = snapshot.split('\n').find((line) => line.trim() !== '') ?? '';
    const match = SNAPSHOT_HEAD.exec(head);
    if (!match?.[1]) return undefined;
    return { role: match[1], name: (match[2] ?? '').replace(/\\"/g, '"') };
  }, undefined);

/** Nombre del elemento enfocado desde el DOM, si la API de accesibilidad no le da rol (p. ej. un campo de contraseña). */
const focusedByDom = (page: Page): Promise<Named | undefined> =>
  safe(
    () =>
      page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return undefined;
        const labelled = (element as HTMLInputElement).labels?.[0]?.textContent?.trim();
        return { role: element.getAttribute('role') ?? element.tagName.toLowerCase(), name: element.getAttribute('aria-label') ?? labelled ?? element.textContent?.trim() ?? '' };
      }),
    undefined,
  );

/** Lo que tiene el foco: la lectura de accesibilidad de `:focus`, o el DOM si esa no le da nombre. */
export const focusedNamed = async (page: Page): Promise<Named | undefined> => {
  const named = await namedOf(page.locator(':focus'));
  return named !== undefined && named.name !== '' ? named : focusedByDom(page);
};

export const describeNamed = (named: Named | undefined): string => {
  if (named === undefined) return '(ningún elemento enfocado)';
  return named.name === '' ? `${named.role} sin nombre` : `${named.role} «${named.name}»`;
};

/** Lo que el lector anuncia después de la etiqueta: el texto de los elementos a los que apunta `aria-describedby`. */
export const describedByText = (field: Locator): Promise<string | undefined> =>
  safe(
    () =>
      field.evaluate(
        (element) =>
          (element.getAttribute('aria-describedby') ?? '')
            .split(' ')
            .filter((id) => id !== '')
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .filter((text) => text !== '')
            .join(' | '),
        undefined,
        { timeout: 1_000 },
      ),
    undefined,
  );

/** ¿El aviso de un campo (el primero de su `aria-describedby`) está debajo del campo? `undefined` si no hay aviso o la lectura falla. */
export const noticeBelow = (field: Locator): Promise<boolean | undefined> =>
  safe(
    () =>
      field.evaluate(
        (element) => {
          const ids = (element.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '');
          const notice = ids.map((id) => document.getElementById(id)).find((node) => node !== null);
          if (!notice) return undefined;
          return notice.getBoundingClientRect().top >= element.getBoundingClientRect().bottom - 1;
        },
        undefined,
        { timeout: 1_000 },
      ),
    undefined,
  );

// --- Comprobaciones (cada una: lo que dice la historia y lo medido) --------------------------------------------------------------

/** Espera con techo a que `read` cumpla `ok`; devuelve si se cumplió y el último valor leído. */
export const settle = async <T>(read: () => Promise<T>, ok: (value: T) => boolean, ceilingMs: number = REACTION_MS): Promise<{ readonly ok: boolean; readonly value: T }> => {
  const reached = await waitUntil(async () => ok(await read()), ceilingMs);
  return { ok: reached.reached, value: await read() };
};

export const countVisible = (locator: Locator): Promise<number> => safe(() => locator.filter({ visible: true }).count(), -1);

export const describeCount = (count: number): string => {
  if (count < 0) return 'lectura fallida';
  if (count === 0) return 'ninguno visible';
  if (count === 1) return 'uno visible';
  return `${count} visibles (ambiguo)`;
};

/** «lo anuncia como «X»»: el elemento de `locator` tiene ese nombre accesible. Lo observado es el nombre que se lee. */
export const namedCheck = async (locator: Locator, expectedName: string, label: string, ceilingMs: number = REACTION_MS): Promise<Check> => {
  const named = await settle(() => namedOf(locator), (value) => value?.name === expectedName, ceilingMs);
  const shown = named.value === undefined ? undefined : describeNamed(named.value);
  return check(named.ok, `${label} se anuncia como «${expectedName}»`, shown === undefined ? `${label}: no hay un único elemento que se pueda leer` : `${label} se anuncia como ${shown}`);
};

/** «el foco está en «X»»: lo que tiene el foco tiene ese nombre (y ese rol, si se pide). Lo observado es lo que tiene el foco. */
export const focusCheck = async (page: Page, expectedName: string, role?: string): Promise<Check> => {
  const matches = (named: Named | undefined): boolean => named !== undefined && named.name === expectedName && (role === undefined || named.role === role);
  const focused = await settle(() => focusedNamed(page), matches, 2_000);
  return check(focused.ok, `el foco está en «${expectedName}»`, `el foco está en ${describeNamed(focused.value)}`);
};

/** Contorno de foco de `--accent` (2 px sólido, separado 2 px) sobre lo que tiene el foco; el color depende del tema del documento. */
export const focusRingCheck = async (page: Page): Promise<Check> => {
  const ring = await safe(
    () =>
      page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element) return undefined;
        const style = getComputedStyle(element);
        return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor, offset: style.outlineOffset, dark: document.documentElement.getAttribute('data-theme') === 'dark' };
      }),
    undefined,
  );
  if (ring === undefined) return check(false, 'contorno de foco de 2 px', 'no hay ningún elemento enfocado');
  const color = ring.dark ? 'rgb(214, 138, 201)' : 'rgb(122, 46, 110)';
  const ok = ring.style === 'solid' && ring.width === '2px' && ring.offset === '2px' && ring.color === color;
  return check(ok, `contorno de foco de 2 px sólido, separado 2 px, color ${color}`, `contorno ${ring.style} ${ring.width}, separado ${ring.offset}, color ${ring.color}`);
};

/** Motivo de bloqueo en un `title`. El nombre con el atajo («Nuevo programa (N)») no es un motivo. */
export const isBlockingReason = (title: string | undefined): boolean => title !== undefined && !/\(N\)$/.test(title);

// --- Respuestas controladas por la prueba (fallo 500 o retraso) --------------------------------------------------------------------

/** 500 para las peticiones GET de `pathname` mientras `active()` diga que sí. Las demás peticiones siguen su curso. */
export const failGets = async (page: Page, pathname: string, active: () => boolean): Promise<void> => {
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (route.request().method() !== 'GET' || !active()) return route.fallback();
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', message: 'Error simulado por la prueba' }) });
    },
  );
};

/** Retrasa `ms` la respuesta real de las peticiones `method` de `pathname`. Anota en `released` cuándo la libera: una lectura posterior es un fallo del arnés. */
const holdResponses = async (page: Page, method: string, pathname: string, ms: number, released: { at: number }): Promise<void> => {
  await page.route(
    (url) => url.pathname === pathname,
    async (route) => {
      if (route.request().method() !== method) return route.fallback();
      const response = await route.fetch();
      await new Promise((done) => setTimeout(done, ms));
      released.at = Date.now();
      await route.fulfill({ response });
    },
  );
};

export const delayGets = (page: Page, pathname: string, ms: number, released: { at: number }): Promise<void> => holdResponses(page, 'GET', pathname, ms, released);

export const delayPost = (page: Page, pathname: string, ms: number, released: { at: number }): Promise<void> => holdResponses(page, 'POST', pathname, ms, released);
