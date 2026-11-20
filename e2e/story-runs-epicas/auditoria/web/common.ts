import type { Locator, Page, Route } from '@playwright/test';
import { AUDITORIA_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, linesOf, pathOf, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas web de EP-AUDITORIA (escritorio, 1440 × 900). Los localizadores son de rol y de nombre; los ids de
// prueba solo donde la pantalla no ofrece otro rastro (el recuento, los estados de error y vacío). Las acciones sobre la pantalla
// pasan por `act` (diagnóstico: qué recibe el clic, si otro elemento lo tapa); lo que se lee sale del texto visible de cada fila.

export const LOGIN_URL = `/login?tenant=${TENANT_A}`;
export const AUDIT_PATH = '/audit';
export const ADMIN_AUDIT_PATH = '/admin?tab=audit';
/** Nota de cada fila web: la preferencia de cookies se fija por adelantado (el aviso tapa controles), como en las demás épicas. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app; el aviso de cookies no se ejerce aquí.';

/** Recuento que muestra la pantalla para `shown` eventos cargados de `total`. */
export const countText = (shown: number, total: number): string => `Mostrando ${shown} de ${total} eventos`;

/** Envuelve una fila web para añadir la nota de cookies a su resultado. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento no hay preferencia que fijar
  }
};

/** Reinicia alumno01 con el token de su administrador: la fila parte de un tenant recién reiniciado. */
export const resetAlumno = (): Promise<void> => resetTenants([TENANT_A]);

/**
 * Entra en /login?tenant=alumno01 con la cuenta y la contraseña de la fila (sin MFA: ni las cuentas del tenant ni auditor@sigpro.test
 * lo piden) y espera a salir de /login. Devuelve el motivo del fallo, o `undefined` si entró.
 */
export const signIn = (page: Page, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 1440, height: 900 })],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    [`escribir el correo ${email}`, () => page.getByLabel('Correo electrónico', { exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByLabel('Contraseña', { exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['salir de /login', () => page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/**
 * Abre una ruta de la app con la sesión ya iniciada en la misma página (la sesión vive en el almacenamiento de la pestaña, como en
 * las referencias de las épicas anteriores). Comprueba que la app se queda en esa ruta: si vuelve a /login, la sesión no sobrevive.
 */
export const openPath = async (page: Page, path: string): Promise<string | undefined> => {
  const opened = await runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return opened;
  const wanted = path.split('?')[0] ?? path;
  const arrived = await waitUntil(async () => pathOf(page) === wanted);
  return arrived.reached ? undefined : `la app no se queda en ${wanted} (está en ${pathOf(page)}): la sesión no sobrevive a la carga`;
};

// --- Acciones con diagnóstico ----------------------------------------------------------------------------------------------

export interface Blocked {
  readonly message: string;
  readonly note: string;
  readonly evidence?: Readonly<Record<string, unknown>>;
}

interface Hit {
  readonly hit: string;
  readonly inside: boolean;
}

/** Se ejecuta en el navegador: qué recibe el clic en el centro del elemento. No usa variables de fuera. */
const hitAtCenter = (node: Element): Hit => {
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
  if (hit === null) return { hit: '(ninguno)', inside: false };
  const testid = hit.getAttribute('data-testid');
  const name = `${hit.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
  return { hit: name, inside: hit === node || node.contains(hit) };
};

/** Lo que se registra de una acción fallida: primeras líneas del error, la línea «intercepts pointer events» y quién recibe el clic. */
const describeFailure = async (target: Locator, label: string, error: unknown): Promise<Blocked> => {
  const lines = (error instanceof Error ? error.message : String(error)).split('\n').map((line) => line.trim()).filter((line) => line !== '');
  const intercept = lines.find((line) => line.includes('intercepts pointer events'));
  const present = (await safe(() => target.count(), 0)) > 0;
  const message = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
  if (!present) return { message, note: 'La historia nombra un elemento que la pantalla no ofrece (no existe con ese nombre).' };
  const probe = await safe<Hit | undefined>(() => target.first().evaluate(hitAtCenter, undefined, { timeout: 2_000 }), undefined);
  if (probe === undefined) return { message: `${message} · recibe el clic: (no se pudo leer)`, note: 'el elemento existe pero no se pudo comprobar qué lo tapa' };
  const note = probe.inside
    ? 'el elemento existe y recibe el clic en su centro, pero la acción no se completó (ver el mensaje de Playwright)'
    : `el elemento existe pero otro lo tapa: ${probe.hit}`;
  return { message: `${message} · recibe el clic: ${probe.hit}`, note, evidence: { recibeElClic: probe.hit, dentroDelElemento: probe.inside } };
};

/** Ejecuta una acción sobre la pantalla; si falla, devuelve el diagnóstico (no lanza). `undefined` si la acción salió bien. */
export const act = async (target: Locator, label: string, run: (element: Locator) => Promise<unknown>): Promise<Blocked | undefined> => {
  try {
    await run(target);
    return undefined;
  } catch (error) {
    return describeFailure(target, label, error);
  }
};

/** Una acción fallida como resultado de la fila: discrepa, con el diagnóstico en el observado, la nota y la evidencia. */
export const actionFailed = (expected: string, blocked: Blocked): Outcome =>
  outcome(false, expected, blocked.message, { note: blocked.note, ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }) });

// --- Localizadores ----------------------------------------------------------------------------------------------------------

export const feedOf = (page: Page): Locator => page.getByRole('feed', { name: 'Registro de auditoría', exact: true });
export const countOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_COUNT);
export const forbiddenOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_FORBIDDEN);
export const emptyOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_EMPTY);
export const endOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_END);
export const errorOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_ERROR);
export const retryOf = (page: Page): Locator => page.getByTestId(AUDITORIA_TESTIDS.AUDIT_ERROR_RETRY);
export const loadMoreOf = (page: Page): Locator => page.getByRole('button', { name: 'Cargar más', exact: true });
/** Aviso de una página siguiente fallida: dentro del propio feed, debajo de lo cargado. */
export const moreErrorOf = (page: Page): Locator => feedOf(page).getByRole('alert');
export const rowsOf = (page: Page): Locator => feedOf(page).getByRole('article');
export const sidebarOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR);
export const titleOf = (page: Page): Locator => page.getByRole('heading', { name: 'Auditoría', level: 1, exact: true });
export const subtitleOf = (page: Page): Locator => page.getByText('Registro de actividad del tenant', { exact: true });
export const entitySelect = (page: Page): Locator => page.getByLabel('Entidad', { exact: true });
export const fromInput = (page: Page): Locator => page.getByLabel('Desde', { exact: true });
export const toInput = (page: Page): Locator => page.getByLabel('Hasta', { exact: true });
export const searchInput = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar en la auditoría', exact: true });
export const clearButton = (page: Page): Locator => page.getByRole('button', { name: 'Limpiar filtros', exact: true });

/** Texto del recuento (`Mostrando N de M eventos`), o `undefined` si no se puede leer. */
export const countNow = (page: Page): Promise<string | undefined> => textOf(countOf(page));

/** Espera (con techo) a que el recuento tenga exactamente este texto. */
export const waitCount = async (page: Page, text: string): Promise<boolean> => (await waitUntil(async () => (await countNow(page)) === text)).reached;

/** La lista está montada y ya no muestra su primera carga (el recuento deja de ser «…»). */
export const waitSettled = async (page: Page): Promise<boolean> => (await waitUntil(async () => (await countNow(page))?.startsWith('Mostrando') === true)).reached;

/**
 * Lee una fila como texto VISIBLE de sus hojas (`innerText` del DOM vivo), sin los avatares (`[role="img"]`): fecha, actor, acción,
 * código de la acción, entidad, código de la entidad y resumen. Un elemento sin hijos es una hoja. Si la fila no se puede leer,
 * devuelve `undefined`. No se clona el nodo: un clon desconectado no tiene texto visible.
 */
export const leavesOf = (row: Locator): Promise<readonly string[] | undefined> =>
  safe(
    () =>
      row.first().evaluate(
        (node) => {
          const leaves: string[] = [];
          const walk = (element: Element): void => {
            if (element.getAttribute('role') === 'img') return;
            if (element.children.length === 0) {
              const text = ('innerText' in element ? (element as HTMLElement).innerText : (element.textContent ?? '')).trim();
              if (text !== '') leaves.push(text);
              return;
            }
            Array.from(element.children).forEach(walk);
          };
          walk(node);
          return leaves;
        },
        undefined,
        { timeout: 2_000 },
      ),
    undefined,
  );

/** Clave de una fila para comprobar que no se repite: acción, entityId y hora (la hora sale del texto visible de la fila). */
export const rowKeysOf = async (page: Page): Promise<{ readonly rows: number; readonly distinct: number } | undefined> => {
  const rows = await countOfLocator(rowsOf(page));
  if (rows === undefined) return undefined;
  const keys = new Set<string>();
  for (let index = 0; index < rows; index += 1) {
    const fields = await leavesOf(rowsOf(page).nth(index));
    if (fields === undefined) return undefined;
    const parsed = fieldsOf(fields);
    keys.add(`${parsed.time ?? ''}|${parsed.code ?? ''}|${parsed.entityId ?? ''}`);
  }
  return { rows, distinct: keys.size };
};

/** Campos de una fila de la lista, en el orden en que la pantalla los pinta. */
export interface RowFields {
  readonly time: string | undefined;
  readonly actor: string | undefined;
  readonly action: string | undefined;
  readonly code: string | undefined;
  readonly entity: string | undefined;
  readonly entityId: string | undefined;
  readonly summary: string;
}

export const fieldsOf = (leaves: readonly string[]): RowFields => ({
  time: leaves[0],
  actor: leaves[1],
  action: leaves[2],
  code: leaves[3],
  entity: leaves[4],
  entityId: leaves[5],
  summary: leaves.length > 6 ? leaves.slice(6).join(' · ') : '',
});

/** Primera fila de la lista, leída; `undefined` si no hay ninguna o no se puede leer. */
export const firstRow = async (page: Page): Promise<RowFields | undefined> => {
  const leaves = await leavesOf(rowsOf(page).first());
  return leaves === undefined || leaves.length < 6 ? undefined : fieldsOf(leaves);
};

// --- Estados de error y de vacío -------------------------------------------------------------------------------------------

/** Texto de una zona de aviso dividido en líneas (vacío si no se puede leer). */
export const linesIn = async (target: Locator): Promise<readonly string[]> => linesOf(await textOf(target));

/** Estado de un localizador. Una lectura fallida es `unknown`, nunca «oculto». */
/**
 * Estado de un localizador: `visible`; `hidden` (existe en el DOM pero no se ve); `absent` (no existe: no hay ningún nodo, así que
 * «no aparece» no se distingue de «no está montado» sin un control positivo de la pantalla); `unknown` (la lectura falló).
 */
export type Presence = 'visible' | 'hidden' | 'absent' | 'unknown';
export const presenceOf = async (target: Locator): Promise<Presence> => {
  try {
    if ((await target.count()) === 0) return 'absent';
    return (await target.first().isVisible({ timeout: 1_000 })) ? 'visible' : 'hidden';
  } catch {
    return 'unknown';
  }
};

/** «No se ve» (oculto o ausente). Solo vale como comprobación de «no aparece» junto a un control positivo de la misma pantalla. */
export const notShown = (presence: Presence): boolean => presence === 'hidden' || presence === 'absent';

/** Cuántos localizadores hay (`undefined` si la lectura falló). */
export const countOfLocator = (target: Locator): Promise<number | undefined> => safe(() => target.count(), undefined);

// --- Peticiones: registro de las que hace la pantalla y pruebas de fallo --------------------------------------------------

export interface AuditRequests {
  /** URLs de las GET a `/api/audit` que hizo la pantalla, en orden. */
  readonly urls: string[];
}

/** Registra las GET a `/api/audit` de la página desde que se llama (la pantalla y su doble montaje de StrictMode). */
export const watchAuditRequests = (page: Page): AuditRequests => {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const parsed = new URL(request.url());
    if (parsed.pathname.endsWith('/api/audit')) urls.push(request.url());
  });
  return { urls };
};

/** Peticiones con `cursor` (las de «página siguiente»). */
export const cursorRequestsIn = (requests: AuditRequests): number => requests.urls.filter((url) => new URL(url).searchParams.has('cursor')).length;

/** Estado de la prueba de fallo: `on` mientras la prueba responde 500; cuántas se fallaron y cuántas pasaron. */
export interface Failure {
  on: boolean;
  failed: number;
  passed: number;
}

const corsOf = (origin: string | undefined): Readonly<Record<string, string>> => ({
  'access-control-allow-origin': origin ?? '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
});

/**
 * Responde 500 a las GET de /api/audit que cumplen `match` mientras `failure.on` sea verdadero, y deja pasar el resto a la API real.
 * Falla TODAS las que cumplen mientras la prueba está «encendida», no solo la primera: la historia dice «la primera página», pero la
 * pantalla monta dos veces en desarrollo (StrictMode) y su primera respuesta se descarta; fallar solo una taparía el aviso. La prueba
 * apaga `on` al pulsar «Reintentar» o «Cargar más».
 */
export const failAuditRequests = (page: Page, match: (url: URL) => boolean, failure: Failure): Promise<unknown> =>
  page.route(
    (url) => url.pathname.endsWith('/api/audit') && match(url),
    async (route: Route) => {
      const request = route.request();
      if (request.method() !== 'GET') return route.continue();
      if (!failure.on) {
        failure.passed += 1;
        return route.continue();
      }
      failure.failed += 1;
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: corsOf(request.headers().origin),
        body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'internal_error', code: 'internal_error' }),
      });
    },
  );

/** Desplaza el feed hasta su final (el centinela entra en el contenedor y pide la página siguiente). */
export const scrollFeedToEnd = (page: Page): Promise<unknown> =>
  feedOf(page).evaluate(
    (element) => {
      element.scrollTop = element.scrollHeight;
    },
    undefined,
    { timeout: 2_000 },
  );

/** Verdadero si el aviso de la página siguiente aparece DESPUÉS del último evento cargado en el orden del documento. */
export const moreErrorAfterRows = (page: Page): Promise<boolean | undefined> =>
  safe(
    () =>
      moreErrorOf(page).first().evaluate(
        (alert) => {
          const rows = Array.from(alert.closest('[role="feed"]')?.querySelectorAll('article') ?? []);
          const last = rows[rows.length - 1];
          return last !== undefined && (last.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
        },
        undefined,
        { timeout: 2_000 },
      ),
    undefined,
  );

/** Comprobación de que la lista no pidió nada más por su cuenta durante `ms`: ninguna petición con cursor nueva tras la pausa. */
export const noExtraCursorRequest = async (requests: AuditRequests, before: number, ms: number): Promise<Check> => {
  await sleep(ms);
  const now = cursorRequestsIn(requests);
  return check(now === before, `ninguna petición nueva con cursor en ${ms} ms`, now === before ? `sigue en ${before} petición(es) con cursor` : `hubo otra petición con cursor (${now})`);
};

/** La evidencia de un fallo provocado: cuántas peticiones se fallaron, cuántas pasaron y cuántas hizo la pantalla. */
export const failureEvidence = (failure: Failure, requests: AuditRequests): Readonly<Record<string, unknown>> => ({
  peticionesFalladas: failure.failed,
  peticionesDejadasPasar: failure.passed,
  peticionesAuditoria: requests.urls.length,
  peticionesConCursor: cursorRequestsIn(requests),
});

/** Texto de la traza (el aviso de error) como evidencia, sin juzgarla: su formato no está decidido por la historia. */
export const traceEvidence = async (target: Locator): Promise<string> => (await linesIn(target)).join(' | ');

/** Presencia observada en una frase («visible», «no visible», «sin leer»), para que el observado no sea un texto fijo. */
export const presenceText = (presence: Presence): string => (presence === 'visible' ? 'visible' : presence === 'hidden' ? 'no visible' : presence === 'absent' ? 'ausente del DOM' : 'sin leer');
