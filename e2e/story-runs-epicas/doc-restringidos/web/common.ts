import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, HOLD_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import type { AccountKey } from '../api/common';

// Piezas comunes de las filas web de EP-DOC-RESTRINGIDOS (escritorio 1440 × 900). Los localizadores son de rol y de nombre; los ids
// de prueba solo donde la pantalla no ofrece otro rastro (filas, insignias, recuentos, bloques de ficha y de visor). Cada lectura
// es estricta: un fallo de lectura es «no leído», nunca «ausente». Una ausencia cuenta solo tras comprobar que la lista o la ficha se
// cargaron (recuento o encabezado visibles) y tras observar durante HOLD_MS.

export const VIEWPORT = { width: 1440, height: 900 } as const;
export const LOGIN_URL = `/login?tenant=${TENANT_A}`;

/** Restringidos del seed de alumno01 (la historia 001 los da por hechos: DOC-003, DOC-006, DOC-009 y DOC-012). */
export const RESTRICTED: readonly string[] = ['DOC-003', 'DOC-006', 'DOC-009', 'DOC-012'];
/** Los doce documentos del tenant, en orden ascendente por código. */
export const ALL_DOCUMENTS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);
/** Los documentos que ve el consultor: los doce menos los restringidos. */
export const PUBLIC_DOCUMENTS: readonly string[] = ALL_DOCUMENTS.filter((code) => !RESTRICTED.includes(code));

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
/** Enlace «Documentos» de la navegación principal (la barra lateral). */
export const navDocuments = (page: Page): Locator => page.getByRole('navigation', { name: 'Navegación principal', exact: true }).getByRole('link', { name: 'Documentos', exact: true });
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
/** Enlace al código de un documento (la lista lo usa para abrir la ficha). */
export const linkOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_LINK(code));

/** Ficha: contenedor, título, insignia de cabecera, selector de versión, botones y historial. */
export const detailBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL);
export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
export const detailBadge = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);
export const versionSelect = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT);
export const publishButton = (page: Page): Locator => page.getByRole('button', { name: 'Publicar nueva versión', exact: true }).or(page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH));
export const downloadButton = (page: Page): Locator => page.getByRole('button', { name: 'Descargar PDF', exact: true }).or(page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DOWNLOAD));
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

// --- Lecturas (nunca lanzan: `undefined` = no leído) -------------------------------------------------------------------------------

/** Texto visible normalizado (espacios colapsados) de un elemento, o `undefined`. */
export const textOfLocator = async (target: Locator): Promise<string | undefined> => {
  const text = await safe(() => target.first().innerText({ timeout: 1_000 }), undefined);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Número de elementos que casan (`-1` si no se pudo contar: nunca cuenta como «0»). */
export const countOf = (target: Locator): Promise<number> => safe(() => target.count(), -1);

/** Caja visible de un elemento (`undefined` si no se pudo leer). */
export const boxOf = (target: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined> =>
  safe(async () => (await target.first().boundingBox({ timeout: 1_000 })) ?? undefined, undefined);

/** Tabla de documentos de escritorio (id de prueba). */
export const tableOf = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_TABLE);

/** Texto de la opción seleccionada de un desplegable, o `undefined`. */
export const selectedOptionText = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '', undefined, { timeout: 1_000 }), undefined);

/** Estado habilitado de un botón (`undefined` = no leído). */
export const enabledOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.first().isEnabled({ timeout: 1_000 }), undefined);

/** Códigos de los documentos de la lista, en orden (lectura de los enlaces `document-link-…`); `undefined` si no se pudo leer. */
export const shownCodes = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => {
    const ids = await page.locator('[data-testid^="document-link-"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''));
    return ids.map((id) => id.replace('document-link-', '')).filter((code) => /^DOC-\d{3}$/.test(code));
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

/** Preparación de cada fila: fija la preferencia de cookies y el ancho, abre /login?tenant=alumno01 y entra como la cuenta de la fila. */
export const signIn = (page: Page, account: AccountKey): Promise<string | undefined> => {
  const credentials = DEMO[account];
  const secondFactor: readonly Step[] = [
    ['ver «Verificación en dos pasos»', () => codeField(page).waitFor({ timeout: CEILING_MS })],
    ['escribir el código en «Código de verificación»', () => codeField(page).fill(MFA_CODE, ACTION)],
    ['pulsar «Verificar»', () => verifyButton(page).click(ACTION)],
  ];
  const steps: readonly Step[] = [
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

/** Abre «Documentos» desde la navegación principal (clic en el enlace de la barra lateral). Devuelve el fallo de la acción, si lo hubo. */
export const openDocumentsFromMenu = (page: Page): Promise<string | undefined> => runSteps([['abrir «Documentos» en el menú', () => navDocuments(page).click(ACTION)]]);

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

/** Visibles para el rol: los doce documentos para admin, gestor y auditor; los públicos para el consultor. */
export const visibleFor = (account: AccountKey): readonly string[] => (account === 'consultor' ? PUBLIC_DOCUMENTS : ALL_DOCUMENTS);
