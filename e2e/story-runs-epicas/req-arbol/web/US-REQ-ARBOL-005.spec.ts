import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, RESPONSIVE_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS, actionFailed, eq, interact, listOf, norm, onWeb, openPath, quotedOr, sameList, seenStrict, signIn, textOf, titleButtonOf, waitToast , textsOf } from './common';

// US-REQ-ARBOL-005 — Ver el detalle de un requisito: panel junto al árbol o pantalla completa (web). Preparación de cada fila: reinicio de
// alumno01 con su administrador, inicio de sesión de la cuenta de la fila en /login?tenant=alumno01 (contexto sin sesión) y llegada a Programas.

const prepare = async (page: Page, credentials: { readonly email: string; readonly password: string }, width: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, credentials, width);
};

/** Panel de detalle de escritorio (sección junto al árbol) y de responsive (diálogo a pantalla completa). */
const desktopDetail = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);
const responsiveDetail = (page: Page): Locator => page.getByTestId(RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL);
/** El detalle abierto, sea cual sea su diseño. */
const anyDetail = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL).or(page.getByTestId(RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL));

/** Abre el detalle pulsando el título del requisito en el árbol. */
const openByTitle = (page: Page, code: string): Promise<{ readonly blocked?: string }> =>
  interact(titleButtonOf(page, code), `pulsar el título de la fila de ${code}`, (el) => el.click(ACTION)).then((blocked) => (blocked === undefined ? {} : { blocked: blocked.message }));

/** Texto de las líneas de un bloque, sin los botones de «×» ni los textos de «Quitar». */
const linesWithout = (text: string | undefined, drop: (line: string) => boolean): string => (text ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '' && !drop(line)).join(', ');

/** Lectura de cada campo del detalle, por el nombre de la celda «dato». */
const READERS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['el código', async (page) => textOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE))],
  ['el estado', async (page) => textOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE))],
  ['el campo «Título»', async (page) => norm(await desktopDetail(page).getByLabel('Título', { exact: true }).inputValue({ timeout: 2000 }).catch(() => undefined))],
  [
    'el campo «Prioridad»',
    async (page) =>
      norm(
        await desktopDetail(page)
          .getByLabel('Prioridad', { exact: true })
          .evaluate((node) => (node as HTMLSelectElement).selectedOptions[0]?.textContent ?? '', undefined, { timeout: 2000 })
          .catch(() => undefined),
      ),
  ],
  ['el campo «Etiquetas»', async (page) => linesWithout(await textOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TAGS_CHIPS)), (line) => line === '×' || line.startsWith('Quitar'))],
  ['la descripción', async (page) => textOf(desktopDetail(page).getByRole('textbox', { name: 'Descripción', exact: true }))],
  ['los casos de prueba enlazados', async (page) => (await textsOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TESTS).getByRole('link'))).join(', ')],
]);

// --- Esquema 1: el detalle muestra los datos del requisito abierto ---------------------------------------------------------------------

const detailFields: BrowserRowHandler = async (row, { page }) => {
  const dato = cell(row, 'dato');
  const reader = strict('dato', READERS, dato);
  const valor = quotedOr(cell(row, 'valor'));
  const expected = `ve ${dato} con el valor ${valor}`;
  const failure = await prepare(page, DEMO.gestor, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const opened = await openByTitle(page, 'REQ-017');
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'El título del requisito no se puede pulsar.' });
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const observed = (await reader(page)) ?? '(no legible)';
  return conclude([check(observed === valor, `${dato} vale ${valor}`, `${dato} vale ${observed}`)]);
};

// --- Esquema 2: los casos enlazados se muestran con su enlace y su resultado -----------------------------------------------------------

const linkedTests: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const casos = listOf(cell(row, 'casos'));
  const expected = `ve en «Casos de prueba enlazados» los códigos ${casos.join(' y ')}, cada uno con su resultado, y TC-001 es un enlace a /verification/TC-001`;
  const failure = await prepare(page, DEMO.gestor, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const opened = await openByTitle(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'El título del requisito no se puede pulsar.' });
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const items = desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TESTS).getByRole('listitem');
  const codes = await textsOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_TESTS).getByRole('link'));
  const texts = await textsOf(items);
  const results = texts.map((text, index) => text.replace(codes[index] ?? '', '').trim());
  const link = desktopDetail(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TEST_LINK(casos[0] ?? ''));
  const href = await link.getAttribute('href', { timeout: 2000 }).catch(() => null);
  return conclude([
    check(sameList(codes, casos), `los códigos ${casos.join(', ')}`, `los códigos ${codes.join(', ')}`),
    check(results.length === casos.length && results.every((result) => ['Superado', 'Fallido', 'Bloqueado', 'Sin ejecutar'].includes(result)), 'cada uno con uno de los resultados Superado, Fallido, Bloqueado o Sin ejecutar', `resultados ${results.join(', ')}`),
    eq('el enlace de TC-001', href ?? undefined, '/verification/TC-001'),
  ]);
};

// --- Esquema 3: un requisito sin casos enlazados ni no conformidades lo indica en el detalle -----------------------------------------

const emptyTrace: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `ve el texto «Sin casos de prueba enlazados» y el texto «Sin no conformidades» (${codigo})`;
  const failure = await prepare(page, DEMO.gestor, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const opened = await openByTitle(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'El título del requisito no se puede pulsar.' });
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const noTests = await seenStrict(desktopDetail(page).getByText('Sin casos de prueba enlazados', { exact: true }), '«Sin casos de prueba enlazados»');
  const noNcs = await seenStrict(desktopDetail(page).getByText('Sin no conformidades', { exact: true }), '«Sin no conformidades»');
  return conclude([noTests, noNcs]);
};

// --- Esquema 4: copiar el código muestra un aviso emergente ------------------------------------------------------------------------------

const copyCode: BrowserRowHandler = async (row, { page, context }) => {
  const codigo = cell(row, 'codigo');
  const aviso = quotedOr(cell(row, 'aviso'));
  const expected = `ve el aviso emergente «Código copiado» con el texto ${aviso}`;
  const failure = await prepare(page, DEMO.gestor, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
  await openPath(page, '/programs/PRG-002/requirements');
  const opened = await openByTitle(page, codigo);
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'El título del requisito no se puede pulsar.' });
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const toast = waitToast(page, 'info', 'Código copiado', aviso);
  const blocked = await interact(desktopDetail(page).getByRole('button', { name: `Copiar código ${codigo}`, exact: true }), `pulsar «⧉ Copiar código» en el detalle de ${codigo}`, (el) => el.click(ACTION));
  if (blocked) return actionFailed(expected, blocked);
  const { found, seen } = await toast;
  const clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '(no legible)');
  return conclude([check(found, `ve el aviso «Código copiado» con «${aviso}»`, found ? 've el aviso «Código copiado»' : `avisos de tono info: ${seen.map((entry) => `${entry.title} / ${entry.body}`).join(' · ') || '(ninguno)'}`)], {
    note: `El portapapeles se lee tras el clic (${JSON.stringify(clipboard)}); el veredicto se decide por el aviso, no por el portapapeles.`,
    evidence: { portapapeles: clipboard },
  });
};

// --- Esquema 5: quien no puede editar ve los campos del detalle en solo lectura -------------------------------------------------------

const readOnly: BrowserRowHandler = async (row, { page }) => {
  const cuenta = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = 'el campo «Prioridad» no se puede cambiar, muestra «Baja», y al pasar el puntero aparece «Tu rol no permite editar requisitos»';
  const failure = await prepare(page, cuenta, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements?select=REQ-017');
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const select = desktopDetail(page).getByLabel('Prioridad', { exact: true });
  const disabled = await select.isDisabled({ timeout: 2000 }).catch(() => false);
  const shown = await select.evaluate((node) => (node as HTMLSelectElement).selectedOptions[0]?.textContent ?? '', undefined, { timeout: 2000 }).catch(() => undefined);
  const title = await select.getAttribute('title', { timeout: 2000 }).catch(() => null);
  return conclude([
    check(disabled, 'el campo «Prioridad» no se puede cambiar', disabled ? 'el campo «Prioridad» no se puede cambiar' : 'el campo «Prioridad» se puede cambiar'),
    eq('el valor del campo «Prioridad»', norm(shown), 'Baja'),
    check(title === 'Tu rol no permite editar requisitos', 'el motivo «Tu rol no permite editar requisitos» (atributo title)', `el motivo «${title ?? '(sin motivo)'}»`),
  ], { note: 'El motivo se comprueba en el atributo title del campo, no en el globo que dibuja el navegador al pasar el puntero.' });
};

// --- Esquema 6: el enlace de la dirección abre el detalle del requisito indicado ----------------------------------------------------

const deepLink: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const titulo = cell(row, 'titulo');
  const expected = `ve abierto el detalle de ${codigo} con el título ${titulo}`;
  const failure = await prepare(page, DEMO.gestor, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/PRG-001/requirements?select=${codigo}`);
  await waitUntil(async () => (await desktopDetail(page).count()) > 0);
  const code = await textOf(desktopDetail(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE));
  const shownTitle = norm(await desktopDetail(page).getByLabel('Título', { exact: true }).inputValue({ timeout: 2000 }).catch(() => undefined));
  return conclude([eq('el código del detalle', code, codigo), eq('el título del detalle', shownTitle, titulo)]);
};

// --- Esquema 7: cerrar el detalle lo quita de la pantalla y deja el árbol como estaba ---------------------------------------------------

const CLOSE_CONTROL: ReadonlyMap<string, 'cerrar-desktop' | 'volver-responsive'> = new Map<string, 'cerrar-desktop' | 'volver-responsive'>([
  ['«Cerrar detalle de REQ-017»', 'cerrar-desktop'],
  ['«Volver»', 'volver-responsive'],
]);
const WIDTH_LAYOUT: ReadonlyMap<string, string> = new Map<string, string>([
  ['1440 px', '1440 px'],
  ['390 px', '390 px'],
]);

const closeDetail: BrowserRowHandler = async (row, { page }) => {
  const ancho = strict('ancho', WIDTH_LAYOUT, cell(row, 'ancho'));
  const control = strict('control', CLOSE_CONTROL, cell(row, 'control'));
  const expected = `pulsa ${cell(row, 'control')}: ya no hay ningún detalle abierto y la fila de REQ-017 sigue en el árbol`;
  const failure = await prepare(page, DEMO.gestor, ancho);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const opened = await openByTitle(page, 'REQ-017');
  if (opened.blocked) return actionFailed(expected, { message: opened.blocked, note: 'El título del requisito no se puede pulsar.' });
  await waitUntil(async () => (await anyDetail(page).count()) > 0);
  const hadDetail = (await anyDetail(page).count()) > 0;
  if (!hadDetail) return preparationFailedWeb(expected, 'no se abrió el detalle de REQ-017 antes de cerrarlo');
  const blocked =
    control === 'cerrar-desktop'
      ? await interact(page.getByRole('button', { name: 'Cerrar detalle de REQ-017', exact: true }), 'pulsar «Cerrar detalle de REQ-017»', (el) => el.click(ACTION))
      : await interact(responsiveDetail(page).getByTestId(RESPONSIVE_TESTIDS.REQUIREMENT_DETAIL_CLOSE), 'pulsar «Volver»', (el) => el.click(ACTION));
  if (blocked) return actionFailed(expected, blocked);
  await waitUntil(async () => (await anyDetail(page).count()) === 0);
  const gone = (await anyDetail(page).count()) === 0;
  const stillListed = (await page.getByRole('treeitem', { name: /^REQ-017 / }).count()) === 1;
  return conclude([check(gone, 'ya no hay ningún detalle abierto', gone ? 'ya no hay ningún detalle abierto' : 'sigue abierto un detalle'), check(stillListed, 'la fila de REQ-017 sigue en el árbol', stillListed ? 'la fila de REQ-017 sigue en el árbol' : 'la fila de REQ-017 no está')]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(detailFields)],
    [2, onWeb(linkedTests)],
    [3, onWeb(emptyTrace)],
    [4, onWeb(copyCode)],
    [5, onWeb(readOnly)],
    [6, onWeb(deepLink)],
    [7, onWeb(closeDetail)],
  ]),
});
