import type { Browser, BrowserContext, Locator, Page, Route } from '@playwright/test';
import { DEMO, TENANT_A, WRONG_PASSWORD, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, type Check } from '../../support/checks';
import { notExecutable, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

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
export const phoneContext = async (browser: Browser): Promise<BrowserContext> => {
  const context = await browser.newContext({ baseURL: MOBILE_URL, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid', serviceWorkers: 'block' });
  // La app móvil no muestra el aviso de cookies, pero se fija la misma preferencia que en la web para que los dos contextos sean iguales
  await quietCookies(context);
  return context;
};

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

/**
 * Clave de una línea del `ariaSnapshot` sin el guion. Playwright escribe `rol "nombre"` (nombre entre comillas dobles, JSON); si la
 * clave contiene caracteres como «: », la envuelve en comillas simples, con `''` como comilla simple escapada.
 */
const snapshotKey = (line: string): string | undefined => {
  const text = line.replace(/^\s*-\s+/, '').trim();
  if (text === '') return undefined;
  if (!text.startsWith("'")) return text;
  let out = '';
  for (let index = 1; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === "'" && text.charAt(index + 1) === "'") {
      out += "'";
      index += 1;
    } else if (char === "'") {
      return out;
    } else {
      out += char;
    }
  }
  return out;
};

const NAMED_KEY = /^([\w-]+)(?: ("(?:[^"\\]|\\.)*"))?/;

/** Rol y nombre de una clave (`rol "nombre"` o `rol`). `undefined` si la clave no empieza por un rol. */
const parseSnapshotKey = (key: string): Named | undefined => {
  const match = NAMED_KEY.exec(key);
  if (!match?.[1]) return undefined;
  const quoted = match[2];
  if (quoted === undefined) return { role: match[1], name: '' };
  try {
    return { role: match[1], name: JSON.parse(quoted) as string };
  } catch {
    return undefined;
  }
};

/** Rol y nombre accesible del único elemento de `locator` (`ariaSnapshot`); `undefined` si no hay uno solo, si no tiene rol o si la lectura falla. */
export const namedOf = (locator: Locator): Promise<Named | undefined> =>
  safe(async () => {
    if ((await locator.count()) !== 1) return undefined;
    const snapshot = await locator.ariaSnapshot({ timeout: 1_000 });
    const head = snapshot.split('\n').find((line) => line.trim() !== '');
    if (head === undefined) return undefined;
    const key = snapshotKey(head);
    return key === undefined ? undefined : parseSnapshotKey(key);
  }, undefined);

/** Campo sin rol que la API no lee: se acepta si `getByLabel` con su etiqueta casa con un único elemento y ese elemento es el mismo campo. */
export const sameElementByLabel = async (page: Page, field: Locator, label: string): Promise<boolean> => {
  const byLabel = page.getByLabel(label, { exact: true });
  if ((await safe(() => byLabel.count(), 0)) !== 1) return false;
  const handle = await field.elementHandle({ timeout: 1_000 }).catch(() => null);
  if (handle === null) return false;
  return byLabel.evaluate((element, other) => element === other, handle).catch(() => false);
};

/** Nombre del elemento enfocado desde el DOM, para cuando la API de accesibilidad no le da nombre. Resuelve `aria-labelledby` y mapea el rol de los `input` por su tipo. */
const focusedByDom = (page: Page): Promise<Named | undefined> =>
  safe(
    () =>
      page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return undefined;
        const labelledIds = (element.getAttribute('aria-labelledby') ?? '').split(' ').filter((id) => id !== '');
        const labelledText = labelledIds
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .join(' ')
          .trim();
        const labelled = (element as HTMLInputElement).labels?.[0]?.textContent?.trim();
        const explicit = element.getAttribute('role');
        const inputType = element instanceof HTMLInputElement ? element.type : '';
        const implicit = element instanceof HTMLInputElement ? (inputType === 'checkbox' || inputType === 'radio' ? inputType : inputType === 'password' ? 'password' : 'textbox') : element.tagName.toLowerCase();
        const name = element.getAttribute('aria-label') ?? (labelledText !== '' ? labelledText : (labelled ?? element.textContent?.trim() ?? ''));
        return { role: explicit ?? implicit, name };
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
  return `${count} visibles`;
};

/** Distancia vertical entre dos cajas (0 si se solapan en vertical). `undefined` si alguna no tiene caja visible. */
export const verticalGap = async (a: Locator, b: Locator): Promise<number | undefined> => {
  const boxA = await safe(() => a.first().boundingBox({ timeout: 1_000 }), null);
  const boxB = await safe(() => b.first().boundingBox({ timeout: 1_000 }), null);
  if (boxA === null || boxB === null) return undefined;
  return Math.max(boxA.y - (boxB.y + boxB.height), boxB.y - (boxA.y + boxA.height), 0);
};

/** Estado de la lista de programas: lo que muestran el filtro «Responsable», el «Estado» y el número de filas. */
export interface FilterState {
  readonly owner: string | undefined;
  readonly status: string | undefined;
  readonly rows: number;
}

export const filterState = async (page: Page): Promise<FilterState> => ({
  owner: await safe(() => page.getByRole('combobox', { name: 'Responsable', exact: true }).inputValue({ timeout: 1_000 }), undefined),
  status: await safe(
    () => page.getByRole('combobox', { name: 'Estado', exact: true }).evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '', undefined, { timeout: 1_000 }),
    undefined,
  ),
  rows: await safe(() => page.getByRole('table').getByRole('row').filter({ has: page.getByRole('checkbox', { name: /^Seleccionar PRG-/ }) }).count(), -1),
});

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

/**
 * Un control que la historia da por hecho y que no aparece en la preparación. Es un hallazgo (discrepa) solo si la pantalla correcta
 * está visible y el control no tiene ningún nodo; si no, el arnés no llegó a la pantalla y la fila sale `notExecutable`.
 */
export const missingControlOutcome = (expected: string, reason: string, screenVisible: boolean, controlNodes: number): Outcome =>
  screenVisible && controlNodes === 0
    ? outcome(false, expected, `el control no aparece en la pantalla correcta (${reason})`, {
        note: 'La historia da por hecho este control; la pantalla correcta está visible y el control no tiene ningún nodo (ni por rol ni por identificador de prueba).',
      })
    : notExecutable(expected, `Pantalla o control no alcanzado (error del arnés, con la evidencia): ${reason}`);

/** Motivo de bloqueo en un `title`. El nombre con el atajo («Nuevo programa (N)») no es un motivo. */
export const isBlockingReason = (title: string | undefined): boolean => title !== undefined && !/\(N\)$/.test(title);

// --- Respuestas controladas por la prueba (fallo 500 o retraso) --------------------------------------------------------------------

// Una ruta que sigue en vuelo cuando la fila ya terminó (o la página se cerró) no puede dejar un error asíncrono: `quietRoute` lo
// absorbe, y `withRoutesReleased` / `releaseContextRoutes` retiran las rutas al salir de cada fila.

/** Envuelve el cuerpo de una ruta: si la fila terminó o la página se cerró antes de responder, no hay nada que responder y no se lanza. */
const quietRoute =
  (handler: (route: Route) => Promise<void>): ((route: Route) => Promise<void>) =>
  async (route: Route): Promise<void> => {
    try {
      await handler(route);
    } catch {
      // La fila terminó o la página se cerró: la petición ya no tiene a quién responder
    }
  };

/** Retira las rutas de la página al terminar la fila; las peticiones en vuelo ya no pueden responder después. */
export const releaseRoutes = async (page: Page): Promise<void> => {
  await page.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
};

/** Igual que `releaseRoutes`, para las rutas del contexto de la app móvil que abre una fila. */
export const releaseContextRoutes = async (context: BrowserContext): Promise<void> => {
  await context.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => undefined);
};

/** Envuelve un manejador de fila: al salir, con éxito o con error, retira las rutas de la página de la fila. */
export const withRoutesReleased =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    try {
      return await handler(row, fixtures);
    } finally {
      await releaseRoutes(fixtures.page);
    }
  };

/** 500 para las peticiones GET de `pathname` mientras `active()` diga que sí. Las demás peticiones siguen su curso. */
export const failGets = async (page: Page, pathname: string, active: () => boolean): Promise<void> => {
  await page.route(
    (url) => url.pathname === pathname,
    quietRoute(async (route) => {
      if (route.request().method() !== 'GET' || !active()) return route.fallback();
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', message: 'Error simulado por la prueba' }) });
    }),
  );
};

/**
 * Estado de una respuesta retenida: `intercepted` pasa a true cuando la ruta casa con una petición real (control positivo: sin él, la
 * retención no se ha producido y la lectura no vale); `at` es el instante de la liberación (0 mientras no se libera).
 */
export interface HeldResponse {
  at: number;
  intercepted: boolean;
}

/** Retrasa `ms` la respuesta real de las peticiones `method` de `pathname`. Marca `intercepted` al casar y anota `at` al liberar. */
const holdResponses = async (page: Page, method: string, pathname: string, ms: number, held: HeldResponse): Promise<void> => {
  await page.route(
    (url) => url.pathname === pathname,
    quietRoute(async (route) => {
      if (route.request().method() !== method) return route.fallback();
      held.intercepted = true;
      const response = await route.fetch();
      await new Promise((done) => setTimeout(done, ms));
      held.at = Date.now();
      await route.fulfill({ response });
    }),
  );
};

export const delayGets = (page: Page, pathname: string, ms: number, held: HeldResponse): Promise<void> => holdResponses(page, 'GET', pathname, ms, held);

export const delayPost = (page: Page, pathname: string, ms: number, held: HeldResponse): Promise<void> => holdResponses(page, 'POST', pathname, ms, held);
