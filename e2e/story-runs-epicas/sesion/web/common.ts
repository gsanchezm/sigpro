import type { Locator, Page, Response } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACCESO_TESTIDS, NC_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, noSessionCheck, pathOf, type Step } from '../../support/browser';
import type { Check } from '../../support/checks';
import { outcome, type Outcome } from '../../core/framework';
import { field } from '../../../story-runs/support/api';
import { attemptText, failGestor, lifetimeOf, patchUser } from '../api/common';

// Piezas comunes de las filas web (escritorio 1440 px) y de las filas de la app móvil servida como web de Expo (EP-SESION). Los
// localizadores son de rol y de nombre; el id de prueba solo donde la pantalla no ofrece otro rastro (la tarjeta de la NC, el enlace
// del menú cuando su nombre lleva el distintivo). Las lecturas no lanzan y distinguen «visible», «oculto» y «no legible». Cuando una
// acción de Playwright falla, la nota conserva las tres primeras líneas del error (la llamada y su motivo).

export const LOGIN_PATH = '/login';
export const PROGRAMS_PATH = '/programs';
/** Acceso de alumno01 (la historia lo nombra en cada Dado). */
export const LOGIN_URL = `${LOGIN_PATH}?tenant=${TENANT_A}`;
/** Casilla del acceso: el texto exacto de la interfaz (catálogo `acceso`). */
export const REMEMBER = 'Mantener la sesión en este equipo';
/** No conformidad que la historia exige ver después de la renovación. */
export const NC_CODE = 'NC-001';

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', exact: true });
export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const rememberBox = (page: Page): Locator => page.getByRole('checkbox', { name: REMEMBER, exact: true }).or(page.getByTestId(ACCESO_TESTIDS.LOGIN_REMEMBER));
export const programsHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: 'Programas', exact: true }).or(page.getByRole('banner').getByText('Programas', { exact: true }));
/** Enlace «Programas» del menú lateral (el nombre accesible es el texto; no lleva distintivo). */
export const programsNav = (page: Page): Locator => page.getByRole('link', { name: 'Programas', exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV('programs')));
/** Enlace «No conformidades» del menú lateral. Su nombre puede llevar el recuento de abiertas («No conformidades 3»). */
export const ncNav = (page: Page): Locator => page.getByRole('link', { name: /^No conformidades/ }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV('nc')));
/** Tarjeta de la NC en el tablero de escritorio: su botón «Abrir NC-001» o el contenedor con su id de prueba. */
export const ncCard = (page: Page, code: string): Locator => page.getByRole('button', { name: `Abrir ${code}`, exact: true }).or(page.getByTestId(NC_DYNAMIC_TESTIDS.NC_CARD(code)));

// --- Lecturas que no mienten -------------------------------------------------------------------------------------------------

/** Visible, oculto (o ausente) y no legible (ambiguo o con error). Una lectura no legible nunca cuenta como «oculto». */
export type Reading = 'visible' | 'hidden' | 'unreadable';

export const visibilityOf = async (target: Locator): Promise<Reading> => {
  try {
    const found = await target.count();
    if (found === 0) return 'hidden';
    if (found > 1) return 'unreadable';
    return (await target.isVisible({ timeout: 500 })) ? 'visible' : 'hidden';
  } catch {
    return 'unreadable';
  }
};

/** Path de una URL, o la propia URL si no se puede interpretar. */
export const pathOfUrl = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

/** Pantalla de acceso: ruta /login y el título «Iniciar sesión» visible. */
export const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === LOGIN_PATH && (await visibilityOf(loginHeading(page))) === 'visible';
/** Pantalla de programas: ruta /programs y el encabezado visible. */
export const onProgramsPage = async (page: Page): Promise<boolean> => pathOf(page) === PROGRAMS_PATH && (await isVisible(programsHeading(page)));

// --- Sesión guardada en el navegador -----------------------------------------------------------------------------------------

/** Lo que hay guardado de la sesión: en qué almacén y qué refreshToken lleva (solo para comparar; nunca va a la evidencia). */
export interface StoredSession {
  readonly local: boolean;
  readonly session: boolean;
  readonly refreshToken: string | undefined;
}

/**
 * ¿Dónde guarda la app la sesión? Con «Mantener la sesión» va a localStorage; sin ella, a sessionStorage. Se busca la entrada JSON que
 * lleva un `refreshToken` de texto, sin nombrar la clave. Devuelve `undefined` si la lectura falla: un fallo de lectura NO cuenta como
 * «almacén vacío».
 */
export const storedSession = async (page: Page): Promise<StoredSession | undefined> => {
  try {
    return await page.evaluate((): { readonly local: boolean; readonly session: boolean; readonly refreshToken: string | undefined } => {
      const refreshOf = (store: Storage): string | undefined => {
        for (const key of Object.keys(store)) {
          const raw = store.getItem(key) ?? '';
          try {
            const parsed = JSON.parse(raw) as unknown;
            if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { refreshToken?: unknown }).refreshToken === 'string') {
              return (parsed as { refreshToken: string }).refreshToken;
            }
          } catch {
            // Una entrada que no es JSON no es la sesión: se sigue buscando
          }
        }
        return undefined;
      };
      const local = refreshOf(window.localStorage);
      const session = refreshOf(window.sessionStorage);
      return { local: local !== undefined, session: session !== undefined, refreshToken: local ?? session };
    });
  } catch {
    return undefined;
  }
};

/** El almacén no guarda ninguna sesión (lectura hecha y vacía). */
export const storageEmpty = (stored: StoredSession | undefined): boolean => stored !== undefined && !stored.local && !stored.session;

// --- Tráfico y rutas: lo que hace la web cuando el acceso caduca ----------------------------------------------------------------

export interface TrafficEntry {
  readonly method: string;
  readonly path: string;
  readonly status: number;
  /** La respuesta la fabrica la prueba (el 401 de la fila), no la API. */
  readonly injected: boolean;
}

/** Una petición que sale de la página: qué es y con qué cabecera `Authorization` (el accessToken que lleva). */
export interface RequestEntry {
  readonly method: string;
  readonly path: string;
  readonly authorization: string | undefined;
}

export interface Traffic {
  /** Respuestas de la API y del 401 simulado, en orden. */
  readonly entries: TrafficEntry[];
  /** Peticiones que sale de la página, en orden (se cuentan por recurso, no el total). */
  readonly requests: RequestEntry[];
  /** Rutas del documento principal por las que pasa la pestaña (también las navegaciones sin recarga). */
  readonly visited: string[];
}

/** Empieza a registrar las respuestas, las peticiones y las rutas visitadas. Hay que llamarla después de iniciar sesión. */
export const watchTraffic = (page: Page): Traffic => {
  const entries: TrafficEntry[] = [];
  const requests: RequestEntry[] = [];
  const visited: string[] = [];
  page.on('request', (request) => {
    requests.push({ method: request.method(), path: pathOfUrl(request.url()), authorization: request.headers()['authorization'] });
  });
  page.on('response', (response: Response) => {
    entries.push({ method: response.request().method(), path: pathOfUrl(response.url()), status: response.status(), injected: false });
  });
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(pathOfUrl(frame.url()));
  });
  return { entries, requests, visited };
};

/** Peticiones de un método y ruta concretos desde la posición `from` del registro (cuenta por recurso). */
export const requestsTo = (traffic: Traffic, from: number, method: string, path: string): RequestEntry[] =>
  traffic.requests.slice(from).filter((request) => request.method === method && request.path === path);

/**
 * Responde 401 `invalid_token` UNA sola vez a la primera `GET /api/nc` que haga la página (la lista de no conformidades). Las demás
 * peticiones (la renovación y la repetición de la lista) siguen a la API real. El `fulfill` lleva CORS con el origen reflejado: la web
 * y la API son orígenes distintos, y sin eso el navegador vería un error de red y no un 401.
 */
export const injectNcUnauthorizedOnce = async (page: Page, traffic: Traffic): Promise<{ readonly fired: () => number }> => {
  let fired = 0;
  await page.route(
    (url) => url.pathname === '/api/nc',
    async (route) => {
      const request = route.request();
      if (request.method() !== 'GET' || fired > 0) return route.continue();
      fired += 1;
      traffic.entries.push({ method: 'GET', path: '/api/nc', status: 401, injected: true });
      const origin = request.headers()['origin'];
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        headers: origin === undefined ? {} : { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' },
        body: JSON.stringify({ statusCode: 401, message: 'invalid_token', code: 'invalid_token' }),
      });
    },
  );
  return { fired: () => fired };
};

/** Plazo (`exp - iat`) del refreshToken de la respuesta de renovación; `undefined` si no hay respuesta o no trae token. */
export const renewedRefreshLifetime = (body: unknown): number | undefined => {
  const token = field(body, 'refreshToken');
  return typeof token === 'string' ? lifetimeOf(token) : undefined;
};

/** Traza que va a la evidencia: las últimas 40 respuestas (no solo unas pocas, para poder leer la secuencia completa). */
const TRAIL_LENGTH = 40;

/**
 * Secuencia que la historia exige: la lista responde 401 (simulado), la web pide la renovación (200) y repite la lista (200). Solo se
 * afirma el orden; el recuento de cada recurso lo comprueba cada fila con `requestsTo`.
 */
export const renewalSequence = (entries: readonly TrafficEntry[]): { readonly ok: boolean; readonly observed: string } => {
  const injectedAt = entries.findIndex((entry) => entry.injected);
  const refreshAt = entries.findIndex((entry, index) => index > injectedAt && entry.path === '/api/auth/refresh' && entry.status === 200);
  const retryAt = entries.findIndex((entry, index) => refreshAt >= 0 && index > refreshAt && entry.path === '/api/nc' && entry.method === 'GET' && entry.status === 200);
  const trail = entries.slice(-TRAIL_LENGTH).map((entry) => `${entry.method} ${entry.path} ${entry.status}${entry.injected ? ' (simulado)' : ''}`).join(' → ');
  return { ok: injectedAt >= 0 && refreshAt >= 0 && retryAt >= 0, observed: trail === '' ? '(sin peticiones registradas)' : trail };
};

/** Respuesta de la renovación que dispara el arranque (estado y cuerpo). `undefined` si no llegó respuesta a tiempo. */
export interface RenewalReply {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Espera la primera respuesta de `POST /api/auth/refresh` (de cualquier estado). Hay que LLAMARLA ANTES de la acción que la provoca
 * (recargar, abrir de nuevo): así no se pierde la respuesta si llega durante la acción.
 */
export const renewalResponse = (page: Page): Promise<RenewalReply | undefined> =>
  page
    .waitForResponse((reply) => pathOfUrl(reply.url()) === '/api/auth/refresh', { timeout: CEILING_MS })
    .then(async (reply): Promise<RenewalReply> => {
      const body = (await reply.json().catch(() => undefined)) as unknown;
      return { status: reply.status(), body };
    })
    .catch(() => undefined);

/** Marcadores de datos de la app: si alguno aparece en el texto visible de la página, la pantalla muestra datos. */
export const DATA_MARKERS: readonly string[] = ['PRG-001', 'NC-001', 'REQ-001'];

/**
 * Vigila, desde la PRIMERA carga de cada documento, si algún marcador de datos llega a verse en la página. Se registra en un script
 * inyectado (no depende de la interacción): así una pantalla que muestra datos un instante antes de redirigir queda registrada.
 * Hay que llamarla ANTES de la navegación que se observa.
 */
export const watchDataLeaks = async (page: Page, markers: readonly string[] = DATA_MARKERS): Promise<void> => {
  await page.addInitScript({
    content: `(() => {
  const markers = ${JSON.stringify(markers)};
  const leaks = [];
  Object.defineProperty(window, '__sigproLeaks', { value: leaks, configurable: true });
  const scan = () => {
    const text = document.body ? document.body.innerText : '';
    for (const marker of markers) {
      if (text.includes(marker) && !leaks.includes(marker)) leaks.push(marker);
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true });
  document.addEventListener('DOMContentLoaded', scan);
})();`,
  });
};

/** Marcadores que llegaron a verse en la página observada (`undefined` si la lectura falla: no cuenta como «ninguno»). */
export const dataLeaks = async (page: Page): Promise<readonly string[] | undefined> => {
  try {
    return await page.evaluate((): string[] => {
      const seen = (window as unknown as { __sigproLeaks?: string[] }).__sigproLeaks;
      return seen === undefined ? [] : [...seen];
    });
  } catch {
    return undefined;
  }
};

// --- Preparación de la sesión y cambios de estado ----------------------------------------------------------------------------

/** Reinicia alumno01, abre /login?tenant=alumno01 y inicia sesión con gestor@sigpro.test; devuelve por qué no llegó a /programs, si no llegó. */
export const signInWeb = async (page: Page, remember: boolean): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return runStepsLogged([
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, ACTION)],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor(ACTION)],
    [`fijar la casilla «${REMEMBER}»`, () => rememberBox(page).setChecked(remember, ACTION)],
    ['escribir el correo', () => emailField(page).fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, ACTION)],
    ['ver el encabezado «Programas»', () => programsHeading(page).first().waitFor(ACTION)],
  ]);
};

/**
 * Cambios de estado de la cuenta gestor@sigpro.test que dan las filas (celda «cambio»), con el texto exacto de la historia. Cada uno
 * devuelve el motivo si la API no produce el estado que la historia da por hecho, y `undefined` si lo produce. Una celda que no está
 * aquí lanza (con `strict`), nunca se ignora.
 */
export const CHANGES: ReadonlyMap<string, () => Promise<string | undefined>> = new Map<string, () => Promise<string | undefined>>([
  [
    'alumno01@sigpro.lab desactiva la cuenta gestor@sigpro.test con PATCH /api/admin/users/u2 y active false',
    async () => {
      const changed = await patchUser('u2', { active: false });
      return changed.status === 200 ? undefined : `PATCH /api/admin/users/u2 con active false respondió ${changed.status}`;
    },
  ],
  [
    'envía cinco veces POST /api/auth/login con x-tenant alumno01, el correo gestor@sigpro.test y una contraseña incorrecta, y la cuenta queda bloqueada',
    async () => {
      const fifth = (await failGestor(5))[4];
      return fifth?.status === 423 ? undefined : `el quinto inicio de sesión fallido respondió ${attemptText(fifth)} y no bloqueó la cuenta`;
    },
  ],
]);

/** Texto de la celda «ruta» de las pantallas privadas: solo estas cuatro, con su ruta exacta. */
export const ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/programs', '/programs'],
  ['/programs/PRG-001', '/programs/PRG-001'],
  ['/nc', '/nc'],
  ['/profile', '/profile'],
]);

// --- Pasos con la llamada de Playwright en la nota ----------------------------------------------------------------------------

/** Las tres primeras líneas no vacías del error de Playwright (la llamada y su motivo). */
const callLogOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error))
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, 3)
    .join(' | ');

/** Como `runSteps` de support/browser (que no se toca), pero la falla conserva las tres primeras líneas del error de Playwright. */
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

/** Una acción que la historia nombra y la pantalla no ofrece: discrepancia con la llamada de Playwright en la nota. */
export const actionMissing = (expected: string, failure: string): Outcome =>
  outcome(false, expected, failure, { note: `La historia nombra un elemento que la pantalla no ofrece. Llamada de Playwright: ${failure}` });

/** «Sin sesión» al final de una fila: abrir /programs acaba en /login y se queda ahí (la comprobación navega, va siempre el último paso). */
export const noSessionAtEnd = (page: Page): Promise<Check> => noSessionCheck(page, onLoginForm, onProgramsPage);
