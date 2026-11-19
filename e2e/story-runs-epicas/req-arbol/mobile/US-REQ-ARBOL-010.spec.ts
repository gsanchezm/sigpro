import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, eq, interact, listOf, norm, onExpoWeb, openButton, openMobile, prepareMobile, quotedOr, rowCodes, sheet, textOf , sheetOpen } from './common';

// US-REQ-ARBOL-010 — Ver el detalle de un requisito en una hoja: campos, casos de prueba y no conformidades (app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01 con su administrador; la app en /login sin sesión, con alumno01 en «Tenant de trabajo»,
// gestor@sigpro.test, «Entrar» y llegada a Programas.

const prepare = (page: Page): Promise<string | undefined> => prepareMobile(page, DEMO.gestor);

/** Abre la hoja de detalle pulsando la fila del requisito. */
const openSheet = async (page: Page, code: string): Promise<{ readonly blocked?: string }> => {
  const blocked = await interact(openButton(page, code), `pulsar la fila de ${code}`, (el) => el.click(ACTION));
  if (blocked) return { blocked: blocked.message };
  await waitUntil(async () => (await sheetOpen(page)));
  return {};
};

/** Lectura de los campos de la hoja, por el nombre de la celda «dato». */
const READERS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['el código', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE))],
  ['el estado', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE))],
  ['el título', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TITLE))],
  ['el campo «Prioridad»', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_PRIORITY))],
  ['el campo «Etiquetas»', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TAGS))],
  ['el campo «Descripción»', (page) => textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DESCRIPTION))],
]);

// --- Esquema 1: la hoja muestra los datos del requisito de la fila pulsada -----------------------------------------------------------

const sheetFields: BrowserRowHandler = async (row, { page }) => {
  const dato = cell(row, 'dato');
  const reader = strict('dato', READERS, dato);
  const valor = quotedOr(cell(row, 'valor'));
  const expected = `la hoja «Detalle del requisito» muestra ${dato} con el valor ${valor}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-002/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes('REQ-017'));
  const opened = await openSheet(page, 'REQ-017');
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'La fila no se puede pulsar.' });
  const observed = (await reader(page)) ?? '(no legible)';
  return conclude([check(norm(observed) === norm(valor), `${dato} vale ${valor}`, `${dato} vale ${observed}`)]);
};

// --- Esquema 2: un requisito sin etiquetas lo indica en el campo Etiquetas ---------------------------------------------------------

const noTags: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `el campo «Etiquetas» dice «Sin etiquetas» (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-002/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes(codigo));
  const opened = await openSheet(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'La fila no se puede pulsar.' });
  return conclude([eq('el campo «Etiquetas»', await textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TAGS)), 'Sin etiquetas')]);
};

// --- Esquema 3: los casos de prueba enlazados se listan con su código y su resultado ----------------------------------------------

const RESULT_LABELS: readonly string[] = ['Superado', 'Fallido', 'Bloqueado', 'Sin ejecutar'];
const LINKED: ReadonlyMap<string, string> = new Map<string, string>([['TC-001 y TC-008', 'TC-001 y TC-008']]);

const linkedTests: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const casos = strict('casos', LINKED, cell(row, 'casos'));
  const wanted = listOf(casos);
  const expected = `en «Casos de prueba enlazados» ve los códigos ${wanted.join(' y ')}, cada uno con uno de los resultados ${RESULT_LABELS.join(', ')} (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes(codigo));
  const opened = await openSheet(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'La fila no se puede pulsar.' });
  const heading = await sheet(page).getByText('Casos de prueba enlazados', { exact: true }).count();
  const codes: string[] = [];
  const results: string[] = [];
  for (const code of wanted) {
    codes.push((await textOf(sheet(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TEST_LINK(code)))) ?? '(sin código)');
    results.push((await textOf(sheet(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TRACE_TEST(code)))) ?? '(sin resultado)');
  }
  return conclude([
    check(heading > 0, 'la sección «Casos de prueba enlazados»', heading > 0 ? 've «Casos de prueba enlazados»' : 'no ve «Casos de prueba enlazados»'),
    check(codes.join(', ') === wanted.join(', '), `los códigos ${wanted.join(', ')}`, `los códigos ${codes.join(', ')}`),
    check(results.every((result) => RESULT_LABELS.includes(result)), `cada uno con uno de los resultados ${RESULT_LABELS.join(', ')}`, `resultados ${results.join(', ')}`),
  ]);
};

// --- Esquema 4: un requisito sin casos ni no conformidades lo indica en Trazabilidad -------------------------------------------------

const emptyTrace: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `en «Casos de prueba enlazados» ve «Sin casos de prueba enlazados» y en «No conformidades» ve «Sin no conformidades» (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes(codigo));
  const opened = await openSheet(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'La fila no se puede pulsar.' });
  const noTests = await sheet(page).getByText('Sin casos de prueba enlazados', { exact: true }).count();
  const noNcs = await sheet(page).getByText('Sin no conformidades', { exact: true }).count();
  return conclude([
    check(noTests === 1, 'el texto «Sin casos de prueba enlazados»', noTests === 1 ? 've «Sin casos de prueba enlazados»' : `aparece ${noTests} veces o no aparece`),
    check(noNcs === 1, 'el texto «Sin no conformidades»', noNcs === 1 ? 've «Sin no conformidades»' : `aparece ${noNcs} veces o no aparece`),
  ]);
};

// --- Esquema 5: abrir el enlace de un requisito muestra su hoja al cargar la lista ----------------------------------------------------

const deepLink: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `la hoja «Detalle del requisito» muestra el código ${codigo}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/PRG-002/requirements?select=${codigo}`);
  await waitUntil(async () => (await sheetOpen(page)));
  const shown = (await textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE))) ?? '(no legible)';
  return conclude([check(shown === codigo, `la hoja muestra ${codigo}`, `la hoja muestra ${shown}`)]);
};

// --- Esquema 6: cerrar la hoja devuelve al árbol ----------------------------------------------------------------------------------

const closeSheet: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `pulsa «Cerrar» y ya no se ve la hoja «Detalle del requisito»; la fila de REQ-017 sigue en el árbol (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/${programa}/requirements`);
  await waitUntil(async () => (await rowCodes(page)).includes('REQ-017'));
  const opened = await openSheet(page, 'REQ-017');
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'La fila no se puede pulsar.' });
  const closer: Locator = sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL_CLOSE);
  const pressed = await interact(closer, 'pulsar «Cerrar»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  await waitUntil(async () => !(await sheetOpen(page)));
  const gone = !(await sheetOpen(page));
  const stillThere = (await rowCodes(page)).includes('REQ-017');
  return conclude([check(gone, 'ya no se ve la hoja «Detalle del requisito»', gone ? 'ya no se ve la hoja' : 'la hoja sigue abierta'), check(stillThere, 'la fila de REQ-017 sigue en el árbol', stillThere ? 'la fila de REQ-017 sigue en el árbol' : 'la fila de REQ-017 no está')]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(sheetFields)],
    [2, onExpoWeb(noTags)],
    [3, onExpoWeb(linkedTests)],
    [4, onExpoWeb(emptyTrace)],
    [5, onExpoWeb(deepLink)],
    [6, onExpoWeb(closeSheet)],
  ]),
});
