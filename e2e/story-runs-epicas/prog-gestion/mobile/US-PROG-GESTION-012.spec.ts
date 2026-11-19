import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { actionFailed, codesOfCsv, interact, recountFor, recountText, timingOf, toastShown, watchResponse, firstToastAt, type WebAction } from '../web/common';
import {
  SHARE_APPROXIMATION,
  SHARE_NAME,
  barAction,
  checkCard,
  codesFromCell,
  exportButton,
  isDisabledControl,
  onExpoWeb,
  reasonOf,
  searchBox,
  sharedCalls,
  signIn,
  stubShareSheet,
  toggleSelectMode,
  visibleStateCheck,
} from './common';

// US-PROG-GESTION-012 — Exportar la lista o la selección con la hoja de compartir (app móvil, Expo web, 390 × 844; NO es nativo).
// La hoja de compartir se sustituye por un `navigator.share` simulado. «Coincide» en esta fila significa: la app entrega a
// `navigator.share` UNA vez, con un título (sigpro-programas.csv) y un texto (el CSV) con esos códigos. No se comprueba la hoja
// nativa: en iOS o Android, la misma acción usa Share con `message`, y eso no se prueba aquí.

/** Filtro de la lista antes de exportar (texto de la celda → acción). */
const FILTERS: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['el estado «En pausa»', (page) => interact(page.getByRole('radio', { name: 'En pausa', exact: true }), 'elegir «En pausa»', (element) => element.click(ACTION))],
  ['ningún filtro', async () => undefined],
  ['el buscador escrito «PRG-999»', (page) => interact(searchBox(page), 'escribir «PRG-999» en el buscador', (element) => element.fill('PRG-999', ACTION))],
]);

const emptyBlock = (page: Page) => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_EMPTY);

/** Nota de la aproximación de la hoja de compartir: se añade a cada fila que comparte un archivo (E1 y E2). */
const onShare = (handler: BrowserRowHandler): BrowserRowHandler =>
  onExpoWeb(async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? SHARE_APPROXIMATION : `${result.note} ${SHARE_APPROXIMATION}` };
  });

/** Espera a que la app entregue algo a `navigator.share` y devuelve la última entrega (título y texto). */
const lastShare = async (page: Page): Promise<{ readonly title?: string; readonly text?: string } | undefined> => {
  await waitUntil(async () => (await sharedCalls(page)).length > 0);
  const calls = await sharedCalls(page);
  return calls[calls.length - 1];
};

/** Los códigos del CSS entregado son exactamente los esperados (en orden). */
const sameCodes = (exported: readonly string[], codes: readonly string[]): Check => {
  const same = exported.length === codes.length && exported.every((code, index) => code === codes[index]);
  return check(same, `el texto entregado tiene las filas ${codes.join(', ')}`, `el texto entregado tiene las filas ${exported.join(', ') || '(ninguna)'}`);
};

// --- Esquema 1: la hoja de compartir recibe el CSV de los programas que cumplen los filtros ------------------------------------

const sharesFiltered: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const codes = codesFromCell(cell(row, 'codigos'));
  const filas = cell(row, 'filas');
  const expected = `la app entrega a navigator.share una vez, con título ${SHARE_NAME} y texto con ${filas} programas (${codes.join(', ')}); aviso informativo «CSV generado» con «${filas} filas exportadas»`;
  await page.context().addInitScript(stubShareSheet);
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const filtered = await strict('filtro', FILTERS, cell(row, 'filtro'))(page);
  if (filtered !== undefined) return actionFailed(expected, filtered);
  // Antes de exportar, la lista debe haberse releído con el filtro (recuento de la historia)
  const listed = await waitUntil(async () => (await recountText(page)) === recountFor(Number(filas)));
  if (!listed.reached) return actionFailed(expected, { message: 'la lista no se relee con el filtro aplicado', note: 'El recuento no llega al de los programas que cumplen el filtro.' });
  const deliveredAt = watchResponse(page, 'GET', '/api/programs/export');
  const clickAt = Date.now();
  const pressed = await interact(exportButton(page), 'pulsar «Exportar CSV»', (element) => element.click(ACTION));
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const shared = await lastShare(page);
  const deliveries = (await sharedCalls(page)).length;
  const toast = await toastShown(page, 'info', 'CSV generado', `${filas} filas exportadas`);
  const firstAt = await firstToastAt(page, 'info', 'CSV generado');
  return conclude(
    [
      check(deliveries === 1, 'una sola entrega a navigator.share', `${deliveries} entregas a navigator.share`),
      check(shared?.title === SHARE_NAME, `título ${SHARE_NAME}`, `título ${shared?.title ?? '(sin título)'}`),
      sameCodes(codesOfCsv(shared?.text ?? ''), codes),
      check(toast.seen, `aviso informativo «CSV generado» con «${filas} filas exportadas»`, `avisos informativos: ${toast.observed}`),
    ],
    timingOf(clickAt, firstAt, deliveredAt()),
  );
};

// --- Esquema 2: exportar la selección comparte solo los programas marcados -----------------------------------------------------

const sharesSelection: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const marcados = codesFromCell(cell(row, 'marcados'));
  const codes = codesFromCell(cell(row, 'codigos'));
  const filas = cell(row, 'filas');
  const expected = `la app entrega a navigator.share una vez, con título ${SHARE_NAME} y texto con las filas de ${codes.join(', ')}; aviso informativo «CSV generado» con «${filas} filas exportadas»`;
  await page.context().addInitScript(stubShareSheet);
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const marked = await toggleSelectMode(page);
  if (marked !== undefined) return actionFailed(expected, marked);
  for (const code of marcados) {
    const tick = await checkCard(code, true)(page);
    if (tick !== undefined) return actionFailed(expected, tick);
  }
  const deliveredAt = watchResponse(page, 'GET', '/api/programs/export');
  const clickAt = Date.now();
  const shared = await barAction('Exportar selección')(page);
  if (shared !== undefined) return actionFailed(expected, shared);
  const data = await lastShare(page);
  const deliveries = (await sharedCalls(page)).length;
  const toast = await toastShown(page, 'info', 'CSV generado', `${filas} filas exportadas`);
  const firstAt = await firstToastAt(page, 'info', 'CSV generado');
  return conclude(
    [
      check(deliveries === 1, 'una sola entrega a navigator.share', `${deliveries} entregas a navigator.share`),
      check(data?.title === SHARE_NAME, `título ${SHARE_NAME}`, `título ${data?.title ?? '(sin título)'}`),
      sameCodes(codesOfCsv(data?.text ?? ''), codes),
      check(toast.seen, `aviso informativo «CSV generado» con «${filas} filas exportadas»`, `avisos informativos: ${toast.observed}`),
    ],
    timingOf(clickAt, firstAt, deliveredAt()),
  );
};

// --- Esquema 3: sin programas que mostrar, exportar no está disponible --------------------------------------------------------

const unavailableWithoutRows: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'el botón «Exportar CSV» deshabilitado y el texto «No hay programas para exportar»';
  const prepared = await signIn(page, 'gestor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const filtered = await strict('filtro', FILTERS, cell(row, 'filtro'))(page);
  if (filtered !== undefined) return actionFailed(expected, filtered);
  // La lista vacía muestra su bloque «Sin programas»: se espera a verlo antes de juzgar el botón
  const empty = await waitUntil(async () => (await emptyBlock(page).count()) > 0);
  if (!empty.reached) return actionFailed(expected, { message: 'no se ve el bloque «Sin programas»', note: 'La lista con ese filtro no muestra el bloque vacío.' });
  const disabled = await waitUntil(async () => (await isDisabledControl(exportButton(page))) === true);
  return conclude([
    check(disabled.reached, 'el botón «Exportar CSV» deshabilitado', 'el botón «Exportar CSV» no está deshabilitado'),
    await visibleStateCheck(exportButton(page), reasonOf(page, 'export'), { enabled: false, reason: 'No hay programas para exportar' }, '«Exportar CSV»'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-GESTION-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onShare(sharesFiltered)],
    [2, onShare(sharesSelection)],
    [3, onExpoWeb(unavailableWithoutRows)],
  ]),
});
