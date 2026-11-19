import type { Locator, Page, Route } from '@playwright/test';
import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, startSession, type Credentials } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, HITOS_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, waitUntil } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-HITOS (escritorio 1440 px). Los localizadores son de rol y de nombre (pestañas, botones,
// deslizadores, menús, diálogos, tablas) y, solo donde la pantalla no ofrece otro rastro (la fila de un hito, el recuento, los avisos
// emergentes y los bloques de carga o error), un id de prueba de `testids.ts`. Las lecturas son ESTRICTAS: un elemento ausente o
// ambiguo da `undefined` («sin resolver») y eso NO cuenta como cumplido. Un paso que falla guarda las tres primeras líneas de
// Playwright y las que nombran la causa; `support/browser.ts` no se toca.

export const DESKTOP_WIDTH = 1440;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
/** La prueba fija la preferencia de cookies antes de abrir la app: el aviso tapa el pie y los clics darían un falso fallo. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';
/** Nombre de la pestaña «Hitos» de la ficha. */
export const HITOS_TAB = 'Hitos';
/** Ruta que la API sirve para la lista de hitos del programa (la web la llama con el prefijo /api). */
export const milestonesPath = (code: string): string => `/api/programs/${code}/milestones`;

/** Añade a cada resultado la salvedad de la preferencia de cookies. */
export const withCookieNote =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Igualdad de texto: solo tipografía (espacio de no ruptura como espacio); nada más se relaja. */
/** Espacios tipográficos que `Intl` pone en los importes: el espacio de no ruptura y el estrecho de no ruptura. */
const TYPO_SPACES = new RegExp(`[${String.fromCharCode(0xa0)}${String.fromCharCode(0x202f)}]`, 'g');
export const same = (actual: string, expected: string): boolean => actual.replace(TYPO_SPACES, ' ') === expected.replace(TYPO_SPACES, ' ');

/** Texto de la historia entre «…» quitado; el valor sin comillas se devuelve tal cual. */
export const literal = (text: string): string => {
  const match = /^«(.+)»$/.exec(text.trim());
  return match?.[1] ?? text.trim();
};

// --- Pasos con su causa ----------------------------------------------------------------------------------------------------------------

export interface StepFailure {
  readonly what: string;
  readonly callLog: readonly string[];
}

export type Step = readonly [what: string, action: () => Promise<unknown>];

const CAUSE = /intercepts pointer events|element is not enabled|element is disabled|not visible|resolved to \d+ elements?|strict mode violation|outside of the viewport|not stable|not editable|element is not attached/;

/** Las tres primeras líneas no vacías del mensaje y, aparte, hasta tres líneas que nombran la causa. */
export const callLogOf = (error: unknown): readonly string[] => {
  const lines = (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const causes = lines
    .slice(3)
    .filter((line) => CAUSE.test(line))
    .slice(0, 3)
    .map((line) => `[causa] ${line}`);
  return [...lines.slice(0, 3), ...causes];
};

/** Ejecuta los pasos en orden y se detiene en el primero que falla. */
export const runSteps = async (steps: readonly Step[]): Promise<StepFailure | undefined> => {
  for (const [what, action] of steps) {
    try {
      await action();
    } catch (error) {
      return { what, callLog: callLogOf(error) };
    }
  }
  return undefined;
};

const NOTE_ACTION = 'Un paso de la historia no se pudo hacer en la pantalla. Puede ser la app (el elemento no está, no responde o lo tapa otro) o el manejador (un localizador que no resuelve): la causa de Playwright va en la evidencia (callLog).';
const NOTE_PREP = 'No se llegó al estado inicial que da por hecho la historia. La causa de Playwright va en la evidencia (callLog): distinguir si es la app o el manejador.';

/** Un paso de la historia que la pantalla no permite: discrepancia con su causa (la historia manda, no el arnés). */
export const actionMissing = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `no se pudo ${failure.what}`, { note: NOTE_ACTION, evidence: { callLog: failure.callLog } });

/** El estado inicial no se produjo: el paso de la preparación falló. */
export const prepFailed = (expected: string, failure: StepFailure): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: no se pudo ${failure.what}`, { note: NOTE_PREP, evidence: { callLog: failure.callLog } });

// --- Lecturas estrictas ----------------------------------------------------------------------------------------------------------------

/** Presencia visible: 0 → no está (`false`); 1 → se ve o no; más de uno o error → `undefined` (sin resolver). */
export const seen = async (target: Locator): Promise<boolean | undefined> => {
  try {
    const count = await target.count();
    if (count === 0) return false;
    if (count > 1) return undefined;
    return await target.isVisible({ timeout: 1_000 });
  } catch {
    return undefined;
  }
};

/** Texto visible de un único elemento; `undefined` si no hay exactamente uno, no se ve o no se puede leer. */
export const textOne = async (target: Locator): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    if (!(await target.isVisible({ timeout: 1_000 }))) return undefined;
    return (await target.innerText({ timeout: 1_000 })).trim();
  } catch {
    return undefined;
  }
};

/** Un atributo de un único elemento (`undefined` si no hay exactamente uno o no existe el atributo). */
export const attrOne = async (target: Locator, name: string): Promise<string | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return (await target.getAttribute(name, { timeout: 1_000 })) ?? undefined;
  } catch {
    return undefined;
  }
};

/** Estado habilitado de un único elemento (`undefined` si no se puede leer). */
export const enabledOne = async (target: Locator): Promise<boolean | undefined> => {
  try {
    if ((await target.count()) !== 1) return undefined;
    return await target.isEnabled({ timeout: 1_000 });
  } catch {
    return undefined;
  }
};

/** Texto visible igual al esperado (la historia lo da entre «…»). */
export const textCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const want = literal(expected);
  const text = await textOne(target);
  return check(text !== undefined && same(text, want), `${what} ${want}`, `${what} ${text ?? '(sin leer)'}`);
};

/** «Se ve» con lectura estricta. */
export const seenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === true, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver`);
};

/** «No se ve»: solo se cumple si el elemento no existe o no se ve. */
export const notSeenCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const value = await seen(target);
  return check(value === false, expected, value === true ? `ve ${what}` : value === false ? `no ve ${what}` : `${what}: lectura sin resolver`);
};

/** Un atributo igual al esperado. */
export const attrCheck = async (target: Locator, name: string, expected: string, what: string): Promise<Check> => {
  const value = await attrOne(target, name);
  return check(value !== undefined && same(value, expected), `${what} ${expected}`, `${what} ${value ?? '(sin leer)'}`);
};

/** Habilitado o deshabilitado (estado efectivo del elemento). */
export const enabledCheck = async (target: Locator, enabled: boolean, what: string): Promise<Check> => {
  const value = await enabledOne(target);
  return check(value === enabled, enabled ? `${what} habilitado` : `${what} deshabilitado`, value === undefined ? `${what}: lectura sin resolver` : `${what} ${value ? 'habilitado' : 'deshabilitado'}`);
};

// --- Sesión y navegación ---------------------------------------------------------------------------------------------------------------

/** Fija SOLO la preferencia de cookies (no es una sesión). */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Entra en /login?tenant=alumno01 con la cuenta de la fila y espera a la lista de Programas (escritorio). */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<StepFailure | undefined> =>
  runSteps([
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: DESKTOP_WIDTH, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    ['escribir el correo', () => page.getByLabel('Correo electrónico', { exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    [
      'ver la lista de programas',
      async () => {
        if (!(await waitUntil(() => isVisible(page.getByRole('table')))).reached) throw new Error('la lista de programas no aparece');
      },
    ],
  ]);

/** Abre la ficha del programa (carga completa, con la sesión guardada) y elige la pestaña «Hitos». */
export const openHitos = (page: Page, code: string): Promise<StepFailure | undefined> =>
  runSteps([
    [`abrir /programs/${code}`, () => page.goto(`/programs/${code}`, { timeout: CEILING_MS })],
    [
      'ver la ficha del programa',
      async () => {
        if (!(await waitUntil(() => isVisible(page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL)))).reached) throw new Error('la ficha no aparece');
      },
    ],
    ['pulsar la pestaña «Hitos»', () => page.getByRole('tab', { name: HITOS_TAB, exact: true }).click(ACTION)],
    [
      'ver el panel de hitos',
      async () => {
        if (!(await waitUntil(() => isVisible(page.getByTestId(HITOS_TESTIDS.MILESTONES_PANEL)))).reached) throw new Error('el panel de hitos no aparece');
      },
    ],
  ]);

/** Preparación común de la pantalla: inicio de sesión con la cuenta de la fila y apertura de la pestaña «Hitos» del programa. */
export const enterAndOpen = async (page: Page, credentials: Credentials, code: string): Promise<StepFailure | undefined> =>
  (await signIn(page, credentials)) ?? (await openHitos(page, code));

/** Espera a que la lista de hitos esté cargada: filas, aviso de vacío o aviso de error. */
export const settledMilestones = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const rows = await page.locator('tr[data-testid^="milestone-row-"]').count();
      return rows > 0 || (await isVisible(page.getByTestId(HITOS_TESTIDS.MILESTONES_EMPTY))) || (await isVisible(page.getByTestId(HITOS_TESTIDS.MILESTONES_ERROR)));
    })
  ).reached;

// --- Localizadores ---------------------------------------------------------------------------------------------------------------------

/** Tabla de hitos del programa (su nombre accesible lo da el código). */
export const tableOf = (page: Page, code: string): Locator => page.getByRole('table', { name: `Hitos de ${code}`, exact: true });
/** Fila de un hito por su nombre (el nombre es un botón de la celda). */
export const rowOf = (page: Page, code: string, name: string): Locator =>
  tableOf(page, code)
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name, exact: true }) });
export const nameCellOf = (page: Page, code: string, name: string): Locator => rowOf(page, code, name).getByRole('button', { name, exact: true });
export const sliderOf = (page: Page, name: string): Locator => page.getByRole('slider', { name: `Avance de ${name}`, exact: true });
export const menuButtonOf = (page: Page, name: string): Locator => page.getByRole('button', { name: `Acciones para el hito ${name}`, exact: true });
export const newButton = (page: Page): Locator => page.getByRole('button', { name: 'Nuevo hito', exact: true });
export const countLine = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_COUNT);
export const emptyLine = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_EMPTY);
export const errorBox = (page: Page): Locator => page.getByTestId(HITOS_TESTIDS.MILESTONES_ERROR);
export const headerProgress = (page: Page): Locator => page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS);
export const skeletonRows = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW);

/** Nombres de las filas de la tabla, en orden, leídos en UNA sola lectura (la celda del nombre es el primer botón de cada fila). */
export const milestoneNamesOf = (page: Page): Promise<readonly string[]> =>
  page
    .evaluate(() => Array.from(document.querySelectorAll('tr[data-testid^="milestone-row-"]')).map((row) => (row.querySelector('button')?.textContent ?? '').trim()))
    .catch(() => []);

/** Estado visible de la fila de un hito («Cumplido», «En curso», «Pendiente»): la insignia de la columna «Estado». */
export const statusOfRow = (page: Page, code: string, name: string): Promise<string | undefined> =>
  textOne(rowOf(page, code, name).getByTestId(/^milestone-status-/));

/** Lista de avisos emergentes visibles: tono, título y cuerpo, leídos en una sola lectura (sin el botón «×»). */
export interface ToastView {
  readonly tone: string;
  readonly title: string;
  readonly body: string;
}

export const toastsOf = (page: Page): Promise<readonly ToastView[]> =>
  page
    .evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-testid^="toast-"][role]')).map((element) => {
        // Solo los nodos de texto hoja (div sin divs dentro): el título y el cuerpo. El botón «×» no es un div.
        const leaves = Array.from(element.querySelectorAll('div'))
          .filter((node) => node.querySelector('div') === null)
          .map((node) => (node.textContent ?? '').trim());
        return { tone: element.getAttribute('data-testid') ?? '', title: leaves[0] ?? '', body: leaves[1] ?? '' };
      }),
    )
    .catch(() => []);

/** Un aviso con ese título (y, si se indica, ese cuerpo) está visible. */
export const hasToast = async (page: Page, title: string, body?: string): Promise<boolean> =>
  (await toastsOf(page)).some((toast) => same(toast.title, title) && (body === undefined || same(toast.body, body)));

/** Espera a un aviso con ese título y cuerpo, con el techo de la prueba. */
export const waitToast = async (page: Page, title: string, body?: string): Promise<boolean> => (await waitUntil(() => hasToast(page, title, body))).reached;

interface RecordedWindow {
  __sigproToasts?: ToastView[];
}

/**
 * Registro de avisos: se instala ANTES de la acción y guarda cada aviso que aparece desde entonces, aunque dure menos de lo que tarda la
 * comprobación (un aviso vive 3 s). Así «no aparece ningún aviso» se comprueba sobre todo lo que salió, no sobre lo que se ve en un instante.
 */
export const armToasts = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const host = window as unknown as { __sigproToasts?: { tone: string; title: string; body: string }[]; __sigproArmed?: boolean };
    if (host.__sigproArmed === true) return;
    host.__sigproArmed = true;
    host.__sigproToasts = [];
    const record = (element: HTMLElement): void => {
      // Hojas de texto: el título y el cuerpo. El botón «×» (web) no es un div y no entra.
      const leaves = Array.from(element.querySelectorAll('div'))
        .filter((node) => node.querySelector('div') === null)
        .map((node) => (node.textContent ?? '').trim());
      host.__sigproToasts?.push({ tone: element.getAttribute('data-testid') ?? '', title: leaves[0] ?? '', body: leaves[1] ?? '' });
    };
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('[data-testid^="toast-"][role]')) record(node);
          node.querySelectorAll<HTMLElement>('[data-testid^="toast-"][role]').forEach(record);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

/** Todos los avisos registrados desde `armToasts`, en orden de aparición. */
export const recordedToasts = (page: Page): Promise<readonly ToastView[]> =>
  page.evaluate(() => (window as unknown as RecordedWindow).__sigproToasts ?? []).catch(() => []);

/**
 * Un aviso con ese título NO salió desde `armToasts`. Espera `durationMs` (por encima de la vida de un aviso y del retardo de red) y
 * después mira el registro: un aviso que apareciera y se fuera durante la espera también cuenta.
 */
export const noRecordedToastFor = async (page: Page, title: string, durationMs = 3_500): Promise<boolean> => {
  await sleep(durationMs);
  return !(await recordedToasts(page)).some((toast) => same(toast.title, title));
};

/** Texto visible del porcentaje de la cabecera del programa («22%», sin espacio), que va justo después de la barra. */
export const headerPercentText = (page: Page): Promise<string | undefined> => textOne(headerProgress(page).locator('xpath=following-sibling::span[1]'));

/** Cuenta las peticiones de un método a una ruta de la API desde que se registra (no cambia la página). */
export const requestCounter = (page: Page, method: string, pathname: string): { readonly count: () => number } => {
  let total = 0;
  page.on('request', (request) => {
    if (request.method() === method && new URL(request.url()).pathname === pathname) total += 1;
  });
  return { count: () => total };
};

/** Número de hitos que devuelve la API para el programa (lectura por HTTP, sin tocar la pantalla). -1 si la lista no llega. */
export const milestoneCountByApi = async (token: string, code: string): Promise<number> => {
  const listed = await call('GET', `/programs/${code}/milestones`, { tenant: TENANT_A, token });
  return Array.isArray(listed.body) ? (listed.body as readonly unknown[]).length : -1;
};

// --- Demoras y fallos provocados por la prueba -----------------------------------------------------------------------------------

const CORS_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';
const CORS_HEADERS = 'authorization,content-type';

/** Respuesta de la prueba con cabeceras CORS (la web llama a la API desde otro origen). */
const fulfillWith = (route: Route, status: number, body: unknown): Promise<void> => {
  const origin = route.request().headers().origin ?? '*';
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': origin, 'access-control-allow-methods': CORS_METHODS, 'access-control-allow-headers': CORS_HEADERS, 'access-control-expose-headers': '*' },
    body: body === undefined ? '' : JSON.stringify(body),
  });
};

/** Demora `ms` la respuesta de GET /api/programs/:code/milestones (la prueba fija el retardo; la historia lo da como dato). */
export const delayMilestones = (page: Page, code: string, ms: number): Promise<unknown> =>
  page.route(
    (url) => url.pathname === milestonesPath(code),
    async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await sleep(ms);
      return route.continue();
    },
  );

/**
 * Responde 500 a GET /api/programs/:code/milestones mientras `failing.on` sea verdadero; si no, deja pasar la petición. Así una
 * misma ruta sirve para el fallo y para el reintento (la historia dice «cuando la prueba deja de responder 500»).
 */
export const failingMilestones = (page: Page, code: string): Promise<{ on: boolean }> => {
  const failing = { on: true };
  return page
    .route(
      (url) => url.pathname === milestonesPath(code),
      async (route) => {
        const request = route.request();
        if (request.method() === 'OPTIONS') return fulfillWith(route, 204, undefined);
        if (request.method() !== 'GET' || !failing.on) return route.continue();
        return fulfillWith(route, 500, { statusCode: 500, error: 'Error', message: 'Error provocado por la prueba' });
      },
    )
    .then(() => failing);
};

/** Responde 500 a un PATCH o un DELETE de un hito concreto (la prueba lo provoca; la historia lo da como dato). */
export const failMilestoneWrite = (page: Page, id: string, method: 'PATCH' | 'DELETE'): Promise<unknown> =>
  page.route(
    (url) => url.pathname === `/api/milestones/${id}`,
    async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') return fulfillWith(route, 204, undefined);
      if (request.method() !== method) return route.continue();
      return fulfillWith(route, 500, { statusCode: 500, error: 'Error', message: 'Error provocado por la prueba' });
    },
  );

// --- Preparación por HTTP (fuera del navegador) ----------------------------------------------------------------------------------

/** Borra, uno a uno y con su id, todos los hitos de un programa de alumno01 con el token dado. Devuelve la última respuesta si falla. */
export const deleteAllMilestones = async (token: string, code: string): Promise<ApiResult | undefined> => {
  const listed = await call('GET', `/programs/${code}/milestones`, { tenant: TENANT_A, token });
  if (listed.status !== 200 || !Array.isArray(listed.body)) return listed;
  for (const item of listed.body as readonly unknown[]) {
    const id = field(item, 'id');
    if (typeof id !== 'string') continue;
    const removed = await call('DELETE', `/milestones/${id}`, { tenant: TENANT_A, token });
    if (removed.status !== 204) return removed;
  }
  return undefined;
};

/** Token de gestor@sigpro.test en alumno01 (para las preparaciones que borran o cambian hitos por la API). */
export const gestorToken = async (): Promise<string | undefined> => (await startSession(TENANT_A, DEMO.gestor)).session?.accessToken;
