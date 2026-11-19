import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  attrOne,
  cardMenuOf,
  DESKTOP_WIDTH,
  notSeenCheck,
  onWeb,
  openFullLink,
  prepFailed,
  prepFailedText,
  programRow,
  runSteps,
  sidePanel,
  sidePanelClose,
  signIn,
  valueCheck,
  viewDetailItem,
  type StepFailure,
} from './common';

// US-PROG-DETALLE-004 — Panel lateral de un programa desde la lista y paso a su ficha completa (web). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 en un navegador sin sesión y llega a
// /programs con la lista. El escritorio es 1440 px; el diseño responsive, 390 px (por debajo de 1024 px no hay panel lateral).

const CODE = 'PRG-001';
const CODES: ReadonlyMap<string, string> = new Map<string, string>([[CODE, CODE]]);

/** Abre el panel pulsando la fila del programa, en la celda del nombre (los enlaces y botones de la fila no abren el panel). */
const openPanel = (page: Page): Promise<StepFailure | undefined> =>
  runSteps([[`pulsar la fila del programa ${CODE}`, () => programRow(page, CODE).getByRole('cell').nth(2).click(ACTION)]]);

/** Espera (con techo) a que el panel lateral se vea. */
const panelShown = async (page: Page): Promise<boolean> => (await waitUntil(() => isVisible(sidePanel(page)))).reached;

const PANEL_DATA: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['el código', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_CODE)],
  ['el nombre', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_NAME)],
  ['el estado', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_STATUS)],
  ['el campo «Responsable»', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_OWNER)],
  ['el campo «Fechas»', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_DATES)],
  ['el campo «Presupuesto»', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_BUDGET)],
  ['el campo «Avance»', (page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_PANEL_PROGRESS)],
]);

/** Etiqueta que la historia nombra junto a cada campo del panel (la que va en el `dt` hermano del `dd`). */
const PANEL_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ['el campo «Responsable»', 'Responsable'],
  ['el campo «Fechas»', 'Fechas'],
  ['el campo «Presupuesto»', 'Presupuesto'],
  ['el campo «Avance»', 'Avance'],
]);

/** Una petición a la API observada: método, ruta con su query e instante (`performance.now()`, en el proceso de la prueba). */
interface ApiEvent {
  readonly at: number;
  readonly method: string;
  readonly target: string;
}

/**
 * Escucha TODAS las peticiones a /api/ (no solo las de programas) desde que se registra. Se llama cuando la lista ya ha terminado su carga
 * inicial (`listSettled`), así que la petición inicial de la lista no entra en la cuenta. Guarda el instante de inicio del listener.
 */
const observeApi = (page: Page): { readonly startedAt: number; readonly events: ApiEvent[] } => {
  const events: ApiEvent[] = [];
  const startedAt = performance.now();
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) events.push({ at: performance.now(), method: request.method(), target: `${url.pathname}${url.search}` });
  });
  return { startedAt, events };
};

/** La lista ha terminado su carga inicial: la red está en reposo (o se agota el techo) y la tabla ya no está marcada como ocupada. */
const listSettled = async (page: Page): Promise<void> => {
  await page.waitForLoadState('networkidle', { timeout: CEILING_MS }).catch(() => undefined);
  await waitUntil(async () => (await attrOne(page.getByRole('table'), 'aria-busy')) === 'false');
};

// --- Esquema 1: el panel muestra los datos del programa de la fila -------------------------------------------------------------------------

const panelData: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const dato = cell(row, 'dato');
  const locate = strict('dato', PANEL_DATA, dato);
  const valor = cell(row, 'valor');
  const expected = `ve ${dato} con el valor ${valor}`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  await listSettled(page);
  const observer = observeApi(page);
  const clickAt = performance.now();
  const opened = await openPanel(page);
  if (opened) return actionMissing(expected, opened);
  await panelShown(page);
  // Se observa un segundo con el panel abierto. Solo cuentan las peticiones posteriores al clic en la fila.
  await sleep(1_000);
  const counted = observer.events
    .filter((event) => event.at >= clickAt)
    .map((event) => ({ metodo: event.method, ruta: event.target, msDesdeClic: Math.round(event.at - clickAt) }));
  const described = counted.map((event) => `${event.metodo} ${event.ruta} a los ${event.msDesdeClic} ms`).join('; ');
  const checks: Check[] = [
    await valueCheck(locate(page), valor, dato),
    check(counted.length === 0, 'el panel no hace ninguna petición a /api/', counted.length === 0 ? 'ninguna petición a /api/' : `peticiones: ${described}`),
  ];
  const label = PANEL_LABELS.get(dato);
  if (label !== undefined) checks.push(await valueCheck(locate(page).locator('xpath=..').locator('dt'), label, 'la etiqueta del campo'));
  return conclude(checks, {
    evidence: { inicioDelListenerMs: Math.round(observer.startedAt), clicMs: Math.round(clickAt), peticionesDesdeElClic: counted },
  });
};

// --- Esquema 2: el panel se cierra con el botón o con la tecla Escape ----------------------------------------------------------------------

const CLOSE: ReadonlyMap<string, 'boton' | 'escape'> = new Map<string, 'boton' | 'escape'>([
  ['pulsa el botón «×»', 'boton'],
  ['pulsa la tecla Escape', 'escape'],
]);

const closesPanel: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const how = strict('accion', CLOSE, cell(row, 'accion'));
  const expected = 'el panel deja de verse';
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPanel(page);
  if (opened) return actionMissing(expected, opened);
  if (!(await panelShown(page))) return prepFailedText(expected, 'el panel no se ve tras pulsar la fila');

  const acted =
    how === 'boton'
      ? await runSteps([['pulsar el botón «×» del panel', () => sidePanelClose(page).click(ACTION)]])
      : await runSteps([['pulsar la tecla Escape', () => page.keyboard.press('Escape')]]);
  if (acted) return actionMissing(expected, acted);
  await waitUntil(async () => !(await isVisible(sidePanel(page))));
  return conclude([await notSeenCheck(sidePanel(page), 'el panel deja de verse', 'el panel')]);
};

// --- Esquema 3: abrir la ficha completa lleva a la ficha del programa ----------------------------------------------------------------------

const fullRecord: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const expected = `llega a /programs/${code}`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPanel(page);
  if (opened) return actionMissing(expected, opened);
  if (!(await panelShown(page))) return prepFailedText(expected, 'el panel no se ve tras pulsar la fila');
  const clicked = await runSteps([['pulsar «Abrir ficha completa»', () => openFullLink(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === `/programs/${code}`);
  return conclude([check(arrived.reached, expected, `llega a ${pathOf(page)}`)]);
};

// --- Esquema 4: con una ventana estrecha no hay panel y la tarjeta lleva a la ficha --------------------------------------------------------

const narrowCard: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const expected = `no ve ningún panel lateral y llega a /programs/${code}`;
  const signed = await signIn(page, 390);
  if (signed) return prepFailed(expected, signed);
  const menu = await runSteps([[`abrir el menú de acciones de la tarjeta de ${code}`, () => cardMenuOf(page, code).click(ACTION)]]);
  if (menu) return actionMissing(expected, menu);
  const picked = await runSteps([['elegir «Ver detalle»', () => viewDetailItem(page).click(ACTION)]]);
  if (picked) return actionMissing(expected, picked);
  const arrived = await waitUntil(async () => pathOf(page) === `/programs/${code}`);
  // Después de elegir «Ver detalle» y de llegar a la ruta de detalle: no hay ningún panel lateral
  const noPanel = await notSeenCheck(sidePanel(page), 'ningún panel lateral', 'el panel lateral');
  return conclude([check(arrived.reached, `llega a /programs/${code}`, `llega a ${pathOf(page)}`), noPanel]);
};

defineBrowserRows({
  story: 'US-PROG-DETALLE-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(panelData)],
    [2, onWeb(closesPanel)],
    [3, onWeb(fullRecord)],
    [4, onWeb(narrowCard)],
  ]),
});
