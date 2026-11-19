import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, MOVIL_DOCUMENTS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, waitUntil } from '../../support/browser';
import type { BrowserRowHandler } from '../../core/framework';
import { TOAST_KEY, recordToasts } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-DOC-LISTA. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo, y cada fila lleva esa salvedad en su nota. Los localizadores son de rol (excluyen lo oculto) salvo donde la pantalla no ofrece
// otro rastro (recuento, bloques, estados de carga y el contenedor de la ficha llevan su id de testids.ts). Las lecturas son estrictas.

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa) recupera la sesión guardada; no es un enlace profundo nativo. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';

// --- Localizadores de rol ---------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Buscador de la lista de documentos («Buscar documentos», con el texto de ayuda «Buscar código o título…»). */
export const searchBox = (page: Page): Locator => textbox(page, 'Buscar documentos');
/** Estado de carga de la lista de documentos (id de prueba: el estado no tiene nombre accesible propio). */
export const listLoading = (page: Page): Locator => page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.LIST_LOADING);
/** Recuento «N documentos» (id de prueba: el texto no tiene rol propio). */
export const countOf = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT);
/** Aviso de error de la lista (rol alerta con el título «No se pudieron cargar los documentos»). */
export const listError = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR);
export const listRetry = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_ERROR_RETRY);
/** Bloque «Sin documentos» (id de prueba: el bloque vacío es el único contenedor que lo agrupa). */
export const emptyBlock = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_EMPTY);
/** «Limpiar filtros» dentro del bloque vacío (no el de la barra de búsqueda). */
export const emptyClear = (page: Page): Locator => emptyBlock(page).getByRole('button', { name: 'Limpiar filtros', exact: true });
/** Tarjeta de un documento (`role="listitem"` con su código). */
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(code));
/** Botón ⋯ de una tarjeta (su nombre accesible es «Acciones para CODE»). */
export const cardMenu = (page: Page, code: string): Locator => page.getByRole('button', { name: `Acciones para ${code}`, exact: true });
/** Hoja de acciones abierta de un documento (rol diálogo, nombre «Acciones para CODE»). */
export const sheetOf = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true });
export const sheetItem = (page: Page, code: string, name: string): Locator => sheetOf(page, code).getByRole('button', { name, exact: true });

/** Ficha: su contenedor (id de prueba; el encabezado de la pantalla no lo agrupa). */
export const detailBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL);
export const detailTitleOf = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
export const detailClassBadge = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);
export const detailProgramLink = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PROGRAM_LINK);
export const detailUpdated = (page: Page): Locator => detailBox(page).getByTestId(MOVIL_DOCUMENTS_TESTIDS.UPDATED);
/** Selector de versiones (grupo con rol radiogroup; sus opciones son chips con rol radio). */
export const versionGroup = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT);
/** Versión del selector por su nombre («Versión 2» o «Versión 3 · última»). */
export const versionChip = (page: Page, label: string): Locator => versionGroup(page).getByRole('radio', { name: label, exact: true });
export const versionMeta = (page: Page): Locator => detailBox(page).getByTestId(MOVIL_DOCUMENTS_TESTIDS.VERSION_META);
export const versionNote = (page: Page): Locator => detailBox(page).getByTestId(MOVIL_DOCUMENTS_TESTIDS.VERSION_NOTE);
export const detailDownload = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DOWNLOAD);
/** Contenido de la versión elegida (visor de la ficha) y sus páginas. */
export const viewerBox = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VIEWER);
export const viewerPageN = (page: Page, n: number): Locator => detailBox(page).getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.VIEWER_PAGE_N(n));
export const loadMore = (page: Page): Locator => detailBox(page).getByTestId(MOVIL_DOCUMENTS_TESTIDS.VIEWER_LOAD_MORE);
/** Aviso de «no encontrado» de la ficha (rol alerta) y el enlace «Volver a Documentos». */
export const notFoundNotice = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_NOT_FOUND);
export const backLink = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_BACK);

// --- Sesión y espera ---------------------------------------------------------------------------------------------------------------

/** La lista está montada y ya no muestra el estado de carga: hay recuento o aviso de error. */
export const listSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => !(await isVisible(listLoading(page))) && ((await isVisible(countOf(page))) || (await isVisible(listError(page)))))).reached;

/**
 * Inicio de sesión en la app: registro de avisos instalado antes de cargar la app, ancho de 390 px, /login con alumno01 en «Tenant de
 * trabajo», gestor@sigpro.test y llegar a /programs. Termina con la pantalla de programas visible.
 */
export const signIn = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(DEMO.gestor.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre /documents con carga completa (recupera la sesión guardada) y espera a que la lista se asiente. */
export const openDocumentsPath = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /documents', () => page.goto('/documents', { timeout: CEILING_MS })],
    [
      'ver la lista de documentos',
      async () => {
        if (!(await listSettled(page))) throw new Error('la lista de documentos no se asienta');
      },
    ],
  ]);

/** Abre una dirección de la app con carga completa (sin esperar a una pantalla concreta). */
export const gotoApp = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

/** Recuento de la lista («N documentos»), o `undefined` si no se puede leer. */
export const recountOf = (page: Page): Promise<string | undefined> => safe(async () => (await countOf(page).innerText({ timeout: 500 })).trim(), undefined);
