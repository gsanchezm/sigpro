import type { Locator, Page } from '@playwright/test';
import { DOCUMENTOS_DYNAMIC_TESTIDS, DOCUMENTOS_TESTIDS, MOVIL_DOCUMENTS_TESTIDS, MOVIL_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import type { AccountKey } from '../api/common';

// Piezas comunes de las filas de la app móvil de EP-DOC-RESTRINGIDOS. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni
// Android nativo, y cada fila lleva esa salvedad en su nota. Los localizadores son de rol (excluyen lo oculto) salvo donde la pantalla
// no ofrece otro rastro (recuento, filas, insignias, bloques de ficha y motivo del botón llevan su id de testids.ts). Las lecturas son
// estrictas: un fallo de lectura es «no leído», nunca «ausente».

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Aproximación declarada: abrir una dirección (carga completa) recupera la sesión guardada; no es un enlace profundo nativo. */
export const DIRECT_APPROXIMATION =
  'Abrir una dirección de la app se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería un enlace profundo o una navegación interna.';

/** Nota de la línea técnica: la traza que muestra la página no decide el veredicto (README «Detalle técnico visible»). */
export const TRACE_NOTE =
  'La línea técnica bajo el aviso (la traza de la petición) no decide el veredicto: la historia la deja en «Decisiones pendientes» (README «Detalle técnico visible»); se anota en la evidencia.';

/** Añade a cada resultado de la fila la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const TENANT_TEXT = 'Tenant de trabajo';

/** Código del segundo factor del seed (el de `admin@sigpro.test`). */
const MFA_CODE = '123456';

// --- Localizadores de rol ---------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Pestaña «Más» de la barra inferior (id de prueba: la pestaña se nombra por su icono). */
export const moreTab = (page: Page): Locator => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB('more'));
/** Entrada «Documentos» del menú «Más». */
export const moreDocuments = (page: Page): Locator => page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM('documents'));
/** Estado de carga de la lista de documentos. */
export const listLoading = (page: Page): Locator => page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.LIST_LOADING);
/** Recuento «N documentos» de la lista (id de prueba: el texto no tiene rol propio). */
export const recountOf = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_COUNT);
/** Aviso de ocultos de la lista (`role="note"`). */
export const hiddenNote = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_HIDDEN_NOTE);
/** Tarjeta de un documento (`role="listitem"`). */
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_ROW(code));
/** Insignia de clasificación dentro de una tarjeta. */
export const badgeIn = (scope: Locator): Locator => scope.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);

/** Ficha: contenedor, aviso de «No tienes permiso», título, insignia, versiones, acciones y motivo de publicar. */
export const detailBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DETAIL);
export const forbiddenBox = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_FORBIDDEN);
export const backLink = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_BACK);
export const detailTitle = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_TITLE);
export const detailBadge = (page: Page): Locator => detailBox(page).getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_CLASS_BADGE);
/** Selector de versión (grupo con rol radiogroup). */
export const versionGroup = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_VERSION_SELECT);
/** Chip de una versión del selector (id de prueba: cada versión es un chip de rol radio). */
export const versionChip = (page: Page, version: number): Locator => page.getByTestId(DOCUMENTOS_DYNAMIC_TESTIDS.DOCUMENT_VERSION_ROW(version));
export const downloadButton = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_DOWNLOAD);
export const publishButton = (page: Page): Locator => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENT_PUBLISH);
export const publishReason = (page: Page): Locator => page.getByTestId(MOVIL_DOCUMENTS_TESTIDS.PUBLISH_REASON);

// --- Lecturas (nunca lanzan: `undefined` = no leído) -------------------------------------------------------------------------------

/** Texto visible normalizado de un elemento, o `undefined`. */
export const textOfLocator = async (target: Locator): Promise<string | undefined> => {
  const text = await safe(() => target.first().innerText({ timeout: 1_000 }), undefined);
  return text === undefined ? undefined : text.replace(/\s+/g, ' ').trim();
};

/** Número de elementos que casan (`-1` si no se pudo contar: nunca cuenta como «0»). */
export const countOfLocator = (target: Locator): Promise<number> => safe(() => target.count(), -1);

/** Valor de un atributo (`undefined` si no está o no se pudo leer). */
export const attrValue = (target: Locator, name: string): Promise<string | undefined> =>
  safe(async () => (await target.first().getAttribute(name, { timeout: 1_000 })) ?? undefined, undefined);

/** Estado efectivo de un botón: `habilitado`, `deshabilitado` o `no leído` (el elemento no existe o no se pudo leer). */
export type ButtonState = 'habilitado' | 'deshabilitado' | 'no leído';

/**
 * Estado efectivo de un botón de la app. react-native-web omite el atributo `aria-disabled` cuando el botón está habilitado (o lo deja
 * en «false»): sin atributo o con «false» y sin la propiedad `disabled` = habilitado; `aria-disabled="true"` o `disabled` = deshabilitado.
 * Un elemento que no existe o no se puede leer nunca cuenta como habilitado.
 */
export const buttonStateOf = async (target: Locator): Promise<ButtonState> => {
  if ((await countOfLocator(target)) !== 1) return 'no leído';
  const read = await safe(
    () => target.first().evaluate((node) => ({ aria: node.getAttribute('aria-disabled'), disabled: (node as HTMLButtonElement).disabled === true }), undefined, { timeout: 1_000 }),
    undefined,
  );
  if (read === undefined) return 'no leído';
  if (read.aria === 'true' || read.disabled) return 'deshabilitado';
  if (read.aria === null || read.aria === 'false') return 'habilitado';
  return 'no leído';
};

/** Caja visible de un elemento (`undefined` si no se pudo leer). */
export const boxOf = (target: Locator): Promise<{ readonly x: number; readonly y: number; readonly width: number; readonly height: number } | undefined> =>
  safe(async () => (await target.first().boundingBox({ timeout: 1_000 })) ?? undefined, undefined);

/** Códigos de los documentos de la lista, en orden (lectura de los enlaces `document-link-…`); `undefined` si no se pudo leer. */
export const shownCodes = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => {
    const ids = await page.locator('[data-testid^="document-link-"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid') ?? ''));
    return ids.map((id) => id.replace('document-link-', '')).filter((code) => /^DOC-\d{3}$/.test(code));
  }, undefined);

/** Lista asentada: recuento con cifra y sin estado de carga (o aviso de error). */
export const settledList = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(async () => {
      const count = await textOfLocator(recountOf(page));
      return count !== undefined && /^\d+ documentos$/.test(count) && (await countOfLocator(listLoading(page))) === 0;
    })
  ).reached;

/** Ausencia observada tras una espera: `ausente` solo si el recuento es 0; nunca cuenta como ausente una lectura fallida. */
export const absenceAfterHold = async (target: Locator, ms = 2_000): Promise<'ausente' | 'presente' | 'no leído'> => {
  await sleep(ms);
  const found = await countOfLocator(target);
  return found === 0 ? 'ausente' : found === -1 ? 'no leído' : 'presente';
};

/** Ruta de la app: `ausente` para el aviso o el elemento que no existe; `no leído` si no se pudo contar. */
export const presenceOf = async (target: Locator): Promise<'presente' | 'ausente' | 'no leído'> => {
  const found = await countOfLocator(target);
  return found === 1 ? 'presente' : found === 0 ? 'ausente' : 'no leído';
};

/** Comprobación de presencia o ausencia exacta de un elemento (`no leído` no cumple). */
export const presentCheck = (state: 'presente' | 'ausente' | 'no leído', expected: 'presente' | 'ausente', what: string): Check =>
  check(state === expected, `${what} ${expected}`, `${what} ${state}`);

/** Comprobación de texto exacto (lectura ausente = no cumple). */
export const textCheck = (observed: string | undefined, expected: string, what: string): Check =>
  check(observed === expected, `${what} «${expected}»`, `${what} «${observed ?? '(sin leer)'}»`);

// --- Acciones -----------------------------------------------------------------------------------------------------------------------

/**
 * Inicio de sesión en la app: ancho de 390 px, /login con el tenant alumno01 en «Tenant de trabajo», el correo y la contraseña de la
 * cuenta, «Entrar» y, para admin, el segundo factor (123456 en «Código de verificación» y «Verificar»). Termina en /programs.
 */
export const signIn = (page: Page, account: AccountKey): Promise<string | undefined> => {
  const credentials = DEMO[account];
  const secondFactor: readonly Step[] = [
    ['ver «Código de verificación»', () => textbox(page, 'Código de verificación').waitFor({ timeout: CEILING_MS })],
    ['escribir el código en «Código de verificación»', () => textbox(page, 'Código de verificación').fill(MFA_CODE, ACTION)],
    ['pulsar «Verificar»', () => buttonNamed(page, 'Verificar').click(ACTION)],
  ];
  const steps: readonly Step[] = [
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    [`escribir el correo ${credentials.email}`, () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ...(account === 'admin' ? secondFactor : []),
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Abre «Documentos» desde la pestaña «Más» (la historia dice «desde Más»): pestaña, entrada y lista visible. */
export const openDocumentsFromMore = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['pulsar la pestaña «Más»', () => moreTab(page).click(ACTION)],
    ['pulsar «Documentos» en el menú «Más»', () => moreDocuments(page).click(ACTION)],
    ['ver la pantalla «Documentos»', () => page.getByTestId(DOCUMENTOS_TESTIDS.DOCUMENTS_PAGE).waitFor({ timeout: CEILING_MS })],
  ]);

/** Abre una dirección de la app con carga completa (la sesión guardada se recupera). */
export const gotoApp = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

/** Resultado de una fila cuya acción no se pudo completar: discrepa con el motivo del paso que falló. */
export const actionFailed = (expected: string, message: string): Outcome =>
  outcome(false, expected, message, { note: 'La pantalla no ofrece el elemento que describe la historia o no reacciona a la acción (ver el mensaje de Playwright).' });

/** Espera a que la ficha o su aviso de «No tienes permiso» aparezcan (uno de los dos). */
export const waitForDetail = (page: Page): Promise<boolean> =>
  waitUntil(async () => (await countOfLocator(detailBox(page))) === 1 || (await countOfLocator(forbiddenBox(page))) === 1).then((result) => result.reached);
