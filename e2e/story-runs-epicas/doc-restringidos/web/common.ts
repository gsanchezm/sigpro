import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, HOLD_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { resetAlumno, type AccountKey } from '../api/common';

// Piezas comunes de las filas web de EP-DOC-RESTRINGIDOS (escritorio 1440 × 900). Cada fila reinicia alumno01 ANTES de entrar (en
// `signIn`). Los localizadores son de rol y de nombre; los ids de prueba solo donde la pantalla no ofrece otro rastro (filas, insignias,
// recuentos, bloques de ficha y de visor). Cada lectura es estricta: un fallo de lectura es «no leído», nunca «ausente» ni «habilitado».
// Una ausencia cuenta solo tras comprobar que la lista o la ficha se cargaron, y un elemento solo cuenta como visible si se ve.

export { ALL_DOCUMENTS, PUBLIC_DOCUMENTS, RESTRICTED, visibleFor } from '../api/common';

export const VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;

/** Nota que se añade a cada fila web: la preferencia de cookies se fija por adelantado, como en el piloto. */
export const COOKIE_NOTE = 'La prueba fija la preferencia de cookies (sigpro.cookies = accepted) antes de abrir la app, como el piloto; el aviso de cookies no se ejerce aquí.';

/** Envuelve una fila web para añadir la nota de cookies a su resultado. */
export const onWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? COOKIE_NOTE : `${result.note} ${COOKIE_NOTE}` };
  };

/** Fija SOLO la preferencia de cookies: el aviso tapa zonas de la página y no es una sesión. */
const fixCookiePreference = (): void => {
  try {
    localStorage.setItem('sigpro.cookies', 'accepted');
  } catch {
    // sin almacenamiento: no hay preferencia que fijar
  }
};

/** Código del segundo factor del seed (el de `admin@sigpro.test`). */
const MFA_CODE = '123456';

// --- Localizadores -----------------------------------------------------------------------------------------------------------------

export const emailField = (page: Page): Locator => page.getByLabel('Correo electrónico', { exact: true });
export const passwordField = (page: Page): Locator => page.getByLabel('Contraseña', { exact: true });
export const enterButton = (page: Page): Locator => page.getByRole('button', { name: 'Entrar', exact: true });
export const codeField = (page: Page): Locator => page.getByLabel('Código de verificación', { exact: true });
export const verifyButton = (page: Page): Locator => page.getByRole('button', { name: 'Verificar', exact: true });
/**
 * Enlace «Documentos» de la barra lateral. El nombre «Navegación principal» está en el `aside` (rol «complementary»), no en el `nav`
 * que contiene los enlaces, así que se busca dentro del `aside`. Solo por rol: si no casa, el clic lo diagnostica.
 */
export const navDocuments = (page: Page): Locator =>
  page.getByRole('complementary', { name: 'Navegación principal', exact: true }).getByRole('link', { name: 'Documentos', exact: true });
/** Buscador «Buscar documentos» de la lista. */
export const searchBox = (page: Page): Locator => page.getByRole('searchbox', { name: 'Buscar documentos', exact: true });
/** Recuento encima de la lista (primer párrafo vivo de la página de documentos). */
export const subtitleAbove = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE).locator('p[aria-live="polite"]').first();
/** Recuento debajo de la tabla (id de prueba). */
export const countBelow = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT);
/** Aviso de ocultos de la lista (`role="note"`). */
export const hiddenNote = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_HIDDEN_NOTE);
/** Filas de carga de la lista (mientras llega la primera respuesta). */
export const skeletonRows = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.SKELETON_ROW);
/** Fila de la tabla de un documento (id de prueba: no tiene nombre accesible propio). */
export const rowOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(code));
/** Insignia de clasificación dentro de una fila de la tabla. */
export const badgeIn = (row: Locator): Locator => row.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);
/** Tabla de documentos de escritorio (id de prueba). */
export const tableOf = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_TABLE);

/** Ficha: contenedor, título, insignia de cabecera, selector de versión, botones y historial. */
export const detailBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL);
export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
export const detailBadge = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);
export const versionSelect = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT);
export const publishButton = (page: Page): Locator => page.getByRole('button', { name: 'Publicar nueva versión', exact: true });
export const downloadButton = (page: Page): Locator => page.getByRole('button', { name: 'Descargar PDF', exact: true });
export const versionsList = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSIONS);
/** Aviso «No tienes permiso» de la ficha (rol alerta) y su enlace de vuelta. */
export const forbiddenBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_FORBIDDEN);
export const backLink = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_BACK);

/** Visor (ruta `/documents/:id/view`): contenedor, aviso de error, encabezado y páginas. */
export const viewerPage = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_PAGE);
export const viewerError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_ERROR);
export const viewerTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_TITLE);
export const viewerClass = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_CLASS);
export const viewerVersion = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.VIEWER_VERSION);
export const viewerPageOne = (page: Page): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.VIEWER_PAGE_N(1));
/** Cualquier página del visor (`viewer-page-N`): el contenido del documento. */
export const anyViewerPage = (page: Page): Locator => page.locator('[data-testid^="viewer-page-"]');

// --- Lecturas (nunca lanzan: `undefined` = no leído) -------------------------------------------------------------------------------

/** Texto visible normalizado (espacios colapsados) de un elemento, o `undefined`. */
export const textOfLocator = async (target: Locator): Promise<string | undefined> => {
  const text = await safe(() => target.first().innerText({ timeout: 1_000 }), undefined);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Número de elementos que casan (`-1` si no se pudo contar: nunca cuenta como «0»). */
export const countOf = (target: Locator): Promise<number> => safe(() => target.count(), -1);

/** ¿Se ve el elemento? `true`/`false`, o `undefined` si no se pudo leer (nunca se toma por «no visible»). */
export const visibleOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isVisible({ timeout: 1_000 }), undefined);

/** Caja visible de un elemento (`undefined` si no se pudo leer). */
export const boxOf = (target: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined> =>
  safe(async () => (await target.first().boundingBox({ timeout: 1_000 })) ?? undefined, undefined);

/** Texto de la opción seleccionada de un desplegable, o `undefined`. */
export const selectedOptionText = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '', undefined, { timeout: 1_000 }), undefined);

/** ¿El centro del objetivo lo recibe el propio objetivo (o un descendiente)? `undefined` si no se pudo medir. */
const centerHitsTarget = (target: Locator): Promise<boolean | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (node) => {
          const box = node.getBoundingClientRect();
          const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return top !== null && (top === node || node.contains(top));
        },
        undefined,
        { timeout: 2_000 },
      ),
    undefined,
  );

/** Estado efectivo de un botón visible: deshabilitado (atributo o propiedad), tapado (otro elemento recibe el clic) o habilitado. */
export type ButtonState = 'habilitado' | 'deshabilitado' | 'no visible' | 'tapado' | 'no leído';

export const buttonStateOf = async (target: Locator): Promise<ButtonState> => {
  const visible = await visibleOf(target);
  if (visible === undefined) return 'no leído';
  if (!visible) return 'no visible';
  const disabled = await safe(
    () => target.first().evaluate((node) => (node as HTMLButtonElement).disabled === true || node.getAttribute('aria-disabled') === 'true', undefined, { timeout: 1_000 }),
    undefined,
  );
  if (disabled === undefined) return 'no leído';
  if (disabled) return 'deshabilitado';
  const hit = await centerHitsTarget(target);
  if (hit === undefined) return 'no leído';
  return hit ? 'habilitado' : 'tapado';
};

/** Códigos de los documentos de la tabla, en orden: las filas `document-row-DOC-…` (no los botones ⋯ de cada fila). */
export const shownCodes = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => {
    const ids = await page.locator('[data-testid^="document-row-"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''));
    return ids.map((id) => /^document-row-(DOC-\d{3})$/.exec(id)?.[1]).filter((code): code is string => code !== undefined);
  }, undefined);

/** Espera (con techo) a que la lista muestre un recuento con cifra en sus dos sitios (cabecera y pie) y sin filas de carga. */
export const settledList = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const above = await textOfLocator(subtitleAbove(page));
      const below = await textOfLocator(countBelow(page));
      return above !== undefined && below !== undefined && /^\d+ documentos$/.test(below) && above === below && (await countOf(skeletonRows(page))) === 0;
    })
  ).reached;

/**
 * Observa la ausencia de un elemento tras HOLD_MS: `ausente` solo si el recuento es 0; `presente` si hay uno; `no leído` si el
 * recuento no se pudo hacer (nunca cuenta como ausente).
 */
export const absenceAfterHold = async (target: Locator): Promise<'ausente' | 'presente' | 'no leído'> => {
  await sleep(HOLD_MS);
  const found = await countOf(target);
  return found === 0 ? 'ausente' : found === -1 ? 'no leído' : 'presente';
};

// --- Acciones -----------------------------------------------------------------------------------------------------------------------

/**
 * Preparación de cada fila: reinicia alumno01 (`POST /api/admin/reset`, 2xx comprobado), fija la preferencia de cookies y el ancho,
 * abre /login?tenant=alumno01 y entra como la cuenta de la fila (admin con el segundo factor). Si el reinicio falla, la fila es
 * preparación fallida con ese motivo.
 */
export const signIn = (page: Page, account: AccountKey): Promise<string | undefined> => {
  const credentials = DEMO[account];
  const secondFactor: readonly Step[] = [
    ['ver «Verificación en dos pasos»', () => codeField(page).waitFor({ timeout: CEILING_MS })],
    ['escribir el código en «Código de verificación»', () => codeField(page).fill(MFA_CODE, ACTION)],
    ['pulsar «Verificar»', () => verifyButton(page).click(ACTION)],
  ];
  const steps: readonly Step[] = [
    ['reiniciar alumno01 (POST /api/admin/reset)', () => resetAlumno()],
    ['fijar la preferencia de cookies', () => page.context().addInitScript(fixCookiePreference)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(VIEWPORT)],
    ['abrir /login?tenant=alumno01', () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    [`escribir el correo ${credentials.email}`, () => emailField(page).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => passwordField(page).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ...(account === 'admin' ? secondFactor : []),
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Qué elemento está en el centro del objetivo (el que recibe el clic), o `undefined` si no se pudo leer. */
const hitOf = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate(
        (node) => {
          const box = node.getBoundingClientRect();
          const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          if (top === null) return '(ninguno)';
          const testid = top.getAttribute('data-testid');
          return `${top.tagName.toLowerCase()}${testid === null ? '' : `[data-testid="${testid}"]`}`;
        },
        undefined,
        { timeout: 2_000 },
      ),
    undefined,
  );

/**
 * Clic diagnosticado: si falla, el motivo dice si el elemento no existe, cuál es el mensaje de Playwright (las primeras líneas y la
 * de «intercepts pointer events») y qué elemento recibe el clic en su centro. Devuelve `undefined` si el clic salió bien.
 */
export const clickDiagnosed = async (target: Locator, label: string): Promise<string | undefined> => {
  try {
    await target.click(ACTION);
    return undefined;
  } catch (error) {
    const lines = (error instanceof Error ? error.message : String(error))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    const intercept = lines.find((line) => line.includes('intercepts pointer events'));
    const head = `no se pudo ${label}: ${lines.slice(0, 3).join(' · ')}${intercept === undefined ? '' : ` · ${intercept}`}`;
    const found = await countOf(target);
    if (found === 0) return `${head} · el elemento no existe en la pantalla (0 coincidencias)`;
    return `${head} · recibe el clic: ${(await hitOf(target)) ?? '(no se pudo leer)'}`;
  }
};

/** Abre «Documentos» desde la barra lateral (clic en su enlace). Devuelve el diagnóstico del clic fallido, si lo hubo. */
export const openDocumentsFromMenu = (page: Page): Promise<string | undefined> => clickDiagnosed(navDocuments(page), 'abrir «Documentos» en el menú');

/** Abre una ruta de la app en la misma pestaña (carga completa: la sesión guardada se recupera). */
export const gotoRoute = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path} en la misma pestaña`, () => page.goto(path, { timeout: CEILING_MS })]]);

/** Resultado de una fila que no pudo completar su acción: discrepa con el motivo del paso que falló. */
export const actionFailed = (expected: string, message: string): Outcome =>
  outcome(false, expected, message, { note: 'La pantalla no ofrece el elemento que describe la historia o no reacciona a la acción (ver el mensaje de Playwright).' });

/** Comprobación de texto exacto (lectura ausente = no cumple). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

/** Comprobación de presencia: exactamente un elemento (el recuento medido va en lo observado; `-1` = no leído, no cumple). */
export const presenceCheck = (found: number, expected: string, what: string): Check =>
  check(found === 1, expected, found === 1 ? `${what} está (1 elemento)` : found === 0 ? `${what} no está (0 elementos)` : found === -1 ? `${what} (sin leer)` : `${what} aparece ${found} veces`);

/** Comprobación de visibilidad: el elemento se ve (`undefined` = no leído, no cumple). */
export const seenCheck = (seen: boolean | undefined, expected: string, what: string): Check =>
  check(seen === true, expected, seen === undefined ? `${what} (sin leer)` : seen ? `${what} se ve` : `${what} no se ve`);

/** Comprobación del estado efectivo de un botón (`habilitado`, `deshabilitado`, …). */
export const buttonCheck = (state: ButtonState, expected: ButtonState, label: string): Check => check(state === expected, `«${label}» está ${expected}`, `«${label}» está ${state}`);
