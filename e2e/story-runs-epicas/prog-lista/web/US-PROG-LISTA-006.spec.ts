import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';

import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  actionMissing,
  buttonState,
  codesOf,
  countCheck,
  interactAndAwait,
  LAYOUTS,
  listCheck,
  listedCodes,
  nextButton,
  onWeb,
  openPath,
  pageButton,
  prevButton,
  signIn,
  waitForList,
} from './common';

// US-PROG-LISTA-006 — Paginar la lista de programas de 10 en 10 (web). Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 y llega a /programs. Escritorio a 1440 px;
// responsive a 390 px (solo «Página anterior» y «Página siguiente», sin números).

/** Texto de la celda de habilitación del botón de la historia. */
const ENABLED: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['habilitado', true],
  ['deshabilitado', false],
]);

/** Primer código de la página n (1-based) con 10 programas por página: página 2 empieza en PRG-011. */
const firstOfPage = (page: number): string => `PRG-${String((page - 1) * 10 + 1).padStart(3, '0')}`;

/** Dirección actual sin el origen: camino y consulta. */
const addressOf = (page: Page): string => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

// --- Esquema 1: «Página siguiente» muestra la página que sigue ---------------------------------------------------------------

const nextPage: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const times = Number(cell(row, 'veces'));
  const expectedCodes = codesOf(`${cell(row, 'primera')} a ${cell(row, 'ultima')}`);
  const expectedCount = quoted(cell(row, 'recuento'));
  const expected = `la lista muestra desde ${cell(row, 'primera')} hasta ${cell(row, 'ultima')} y el recuento dice ${cell(row, 'recuento')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  for (let clicks = 0; clicks < times; clicks += 1) {
    const clicked = await interactAndAwait(page, nextButton(page), 'pulsar «Página siguiente»', (element) => element.click(ACTION), clicks + 1);
    if (clicked !== undefined) return actionFailed(expected, clicked);
    // Cada clic avanza una página sobre la que ya se ve: se espera a su primera fila antes del siguiente
    await waitUntil(async () => (await listedCodes(page, layout))[0] === firstOfPage(clicks + 2));
  }
  const shown = await waitForList(page, layout, expectedCodes, expectedCount);
  return conclude([listCheck(shown.codes, expectedCodes), countCheck(shown.count, expectedCount)]);
};

// --- Esquema 2: el número de página lleva a esa página en escritorio ---------------------------------------------------------

const pageNumber: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(`${cell(row, 'primera')} a ${cell(row, 'ultima')}`);
  const expected = `la lista muestra desde ${cell(row, 'primera')} hasta ${cell(row, 'ultima')} y «Página anterior» está ${cell(row, 'anterior')}`;
  const opened = await signIn(page, 'escritorio');
  if (opened) return preparationFailedWeb(expected, opened);
  const number = Number(cell(row, 'pagina'));
  const pressed = await interactAndAwait(page, pageButton(page, number), `pulsar el número ${number} de la paginación`, (element) => element.click(ACTION));
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const shown = await waitForList(page, 'escritorio', expectedCodes);
  return conclude([listCheck(shown.codes, expectedCodes), await buttonState(prevButton(page), strict('anterior', ENABLED, cell(row, 'anterior')), 'Página anterior')]);
};

// --- Esquema 3: los botones de página se deshabilitan en los extremos -------------------------------------------------------

const edgeButtons: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const layout = strict('diseño', LAYOUTS, cell(row, 'diseno'));
  const expected = `«Página anterior» está ${cell(row, 'anterior')} y «Página siguiente» está ${cell(row, 'siguiente')}`;
  const opened = await signIn(page, layout);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openPath(page, layout, `/programs?page=${cell(row, 'pagina')}`);
  if (loaded) return actionMissing(expected, loaded);
  // Los botones dependen del número de páginas, que llega con la respuesta: se espera a la primera fila de la página pedida
  await waitUntil(async () => (await listedCodes(page, layout))[0] === firstOfPage(Number(cell(row, 'pagina'))));
  return conclude([
    await buttonState(prevButton(page), strict('anterior', ENABLED, cell(row, 'anterior')), 'Página anterior'),
    await buttonState(nextButton(page), strict('siguiente', ENABLED, cell(row, 'siguiente')), 'Página siguiente'),
  ]);
};

// --- Esquema 4: la página viaja en la dirección y una página fuera de rango se corrige --------------------------------------

const addressPage: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expectedCodes = codesOf(`${cell(row, 'primera')} a ${cell(row, 'ultima')}`);
  const expectedAddress = cell(row, 'direccion_final');
  const expected = `la lista muestra desde ${cell(row, 'primera')} hasta ${cell(row, 'ultima')} y la dirección de la página es ${expectedAddress}`;
  const opened = await signIn(page, 'escritorio');
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openPath(page, 'escritorio', cell(row, 'direccion'));
  if (loaded) return actionMissing(expected, loaded);
  // Una página fuera de rango se corrige cuando llega la respuesta: se espera a la dirección final
  await waitUntil(async () => addressOf(page) === expectedAddress);
  const shown = await waitForList(page, 'escritorio', expectedCodes);
  return conclude([listCheck(shown.codes, expectedCodes), check(addressOf(page) === expectedAddress, `la dirección de la página es ${expectedAddress}`, `la dirección de la página es ${addressOf(page)}`)]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(nextPage)],
    [2, onWeb(pageNumber)],
    [3, onWeb(edgeButtons)],
    [4, onWeb(addressPage)],
  ]),
});
