import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, countText, delayList, eq, failList, interact, LOGIN_URL, norm, onWeb, openPath, signIn, textOf, visibleCodes } from './common';

// US-REQ-ARBOL-008 — Mostrar la carga, el estado vacío, el error y el programa no encontrado (web). Preparación de cada fila: reinicio de alumno01
// con su administrador e inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 (contexto sin sesión). Las respuestas lentas y los
// errores de la lista se fijan en la prueba (la historia los da como dato) y solo para la petición de la fila.

const prepare = async (page: Page, width = '1440 px'): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, DEMO.gestor, width);
};

/** Las dos líneas de un aviso de error: título y detalle técnico. */
const alertLines = async (page: Page): Promise<readonly string[]> =>
  ((await textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR))) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');

// --- Esquema 1: un programa sin requisitos muestra el estado vacío --------------------------------------------------------------------

const emptyState: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `ve «Sin requisitos» y «Este programa todavía no tiene requisitos.», el contador «0 de 0 requisitos» y «Expandir todo» y «Contraer todo» deshabilitados (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const empty = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY);
  await waitUntil(async () => (await empty.count()) > 0);
  const lines = ((await textOf(empty)) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');
  const expand = await page.getByRole('button', { name: 'Expandir todo', exact: true }).isDisabled({ timeout: 2000 }).catch(() => false);
  const collapse = await page.getByRole('button', { name: 'Contraer todo', exact: true }).isDisabled({ timeout: 2000 }).catch(() => false);
  return conclude([
    check(lines[0] === 'Sin requisitos' && lines[1] === 'Este programa todavía no tiene requisitos.', 'el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.»', `el área muestra «${lines.join(' · ')}»`),
    eq('el contador', await countText(page), '0 de 0 requisitos'),
    check(expand && collapse, '«Expandir todo» y «Contraer todo» deshabilitados', `«Expandir todo» ${expand ? 'deshabilitado' : 'habilitado'} y «Contraer todo» ${collapse ? 'deshabilitado' : 'habilitado'}`),
  ]);
};

// --- Esquema 2: mientras la lista llega, el área del árbol no muestra requisitos -----------------------------------------------------

/** Espera de la respuesta que fija la historia («3 segundos»). */
const WAIT_MS: ReadonlyMap<string, number> = new Map<string, number>([['3 segundos', 3000]]);

const loading: BrowserRowHandler = async (row, { page }) => {
  const espera = strict('espera', WAIT_MS, cell(row, 'espera'));
  const expected = `mientras espera ve el contador «…», las cifras «…» y ningún requisito; al llegar la respuesta ve REQ-001 y «14 de 14 requisitos»`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await delayList(page, 'PRG-001', espera);
  const started = performance.now();
  const navigated = await runSteps([['abrir /programs/PRG-001/requirements', () => page.goto('/programs/PRG-001/requirements', { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  const counter = await countText(page);
  // Las cuatro cifras, leídas una a una: todas deben mostrar «…» mientras la lista llega
  const cardValues = await Promise.all(['Requisitos', 'Cobertura de verificación', 'Pendientes de aprobación', 'NC abiertas'].map((label) => textOf(page.getByRole('group', { name: label, exact: true }).locator('.metric-value'))));
  const treeShown = await page.getByRole('treeitem').count();
  const arrived = await waitUntil(async () => (await visibleCodes(page)).includes('REQ-001'), CEILING_MS);
  const elapsed = Math.round(performance.now() - started);
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  const final = await countText(page);
  return conclude(
    [
      check(counter === '…', 'el contador «…» mientras espera', `el contador «${counter ?? '(no legible)'}» mientras espera`),
      check(cardValues.every((value) => value === '…'), 'las cuatro cifras «…» mientras espera', `cifras ${cardValues.map((value) => value ?? '(no legible)').join(', ')}`),
      check(treeShown === 0, 'ningún requisito mientras espera', `${treeShown} requisitos mientras espera`),
      check(arrived.reached && final === '14 de 14 requisitos', 've REQ-001 y el contador «14 de 14 requisitos» al llegar la respuesta', `contador «${final ?? '(no legible)'}»`),
    ],
    { note: `La prueba retrasa la respuesta ${espera} ms (dato de la historia); tiempo observado hasta ver REQ-001: ${elapsed} ms.`, evidence: { esperaMs: espera, tiempoHastaVerREQ001Ms: elapsed } },
  );
};

// --- Esquema 3: si la lista no llega, la pantalla muestra el error con la opción de reintentar ---------------------------------------

const errorState: BrowserRowHandler = async (row, { page }) => {
  const ancho = strict('ancho', WIDTH, cell(row, 'ancho'));
  const expected = `ve el aviso de alerta «No se pudieron cargar los requisitos» con una línea de detalle técnico, el botón «Reintentar» y ningún requisito (${ancho})`;
  const failure = await prepare(page, ancho);
  if (failure) return preparationFailedWeb(expected, failure);
  await failList(page, 'PRG-001', 500, 'always');
  const opened = await runSteps([['abrir /programs/PRG-001/requirements', () => page.goto('/programs/PRG-001/requirements', { timeout: CEILING_MS })]]);
  if (opened) return preparationFailedWeb(expected, opened);
  const alert = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR);
  await waitUntil(async () => (await alert.count()) > 0);
  const lines = await alertLines(page);
  const retry = await isVisible(page.getByRole('button', { name: 'Reintentar', exact: true }));
  const shown = Array.from({ length: await page.getByRole('treeitem').count() }, () => '');
  return conclude([
    check(lines[0] === 'No se pudieron cargar los requisitos', 'el aviso «No se pudieron cargar los requisitos»', `el aviso «${lines[0] ?? '(sin título)'}»`),
    check((lines[1] ?? '') !== '', 'una línea de detalle técnico', lines[1] === undefined ? 'sin línea de detalle técnico' : `detalle técnico «${lines[1]}»`),
    check(retry, 'el botón «Reintentar»', retry ? 've el botón «Reintentar»' : 'no ve el botón «Reintentar»'),
    check(shown.length === 0, 'ningún requisito', `${shown.length} requisitos visibles`),
    eq('el contador durante el error', await countText(page), '…'),
  ]);
};

// --- Esquema 4: reintentar vuelve a pedir la lista y muestra el árbol si llega ----------------------------------------------------------

const retry: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `tras «Reintentar» con la petición que vuelve a responder bien, ve REQ-001 y «14 de 14 requisitos» (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await failList(page, programa, 500, 1);
  const opened = await runSteps([[`abrir /programs/${programa}/requirements`, () => page.goto(`/programs/${programa}/requirements`, { timeout: CEILING_MS })]]);
  if (opened) return preparationFailedWeb(expected, opened);
  const alert = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR);
  await waitUntil(async () => (await alert.count()) > 0);
  if ((await alert.count()) === 0) return preparationFailedWeb(expected, 'no se vio el aviso de error antes de «Reintentar»');
  const pressed = await interact(page.getByRole('button', { name: 'Reintentar', exact: true }), 'pulsar «Reintentar»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const back = await waitUntil(async () => (await visibleCodes(page)).includes('REQ-001'));
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  return conclude([
    check(back.reached, 've REQ-001', back.reached ? 've REQ-001' : 'no ve REQ-001 tras reintentar'),
    eq('el contador', await countText(page), '14 de 14 requisitos'),
  ]);
};

// --- Esquema 5: un programa que no es del tenant muestra solo el aviso de no encontrado ---------------------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const ruta = cell(row, 'ruta');
  const expected = `ve «No se encontró el programa» y «Volver a Programas», sin cifras ni árbol; al pulsarlo llega a /programs (${ruta})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  const opened = await runSteps([[`abrir ${ruta}`, () => page.goto(ruta, { timeout: CEILING_MS })]]);
  if (opened) return preparationFailedWeb(expected, opened);
  const notFoundBlock = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND);
  await waitUntil(async () => (await notFoundBlock.count()) > 0);
  const lines = ((await textOf(notFoundBlock)) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');
  const link = page.getByRole('link', { name: 'Volver a Programas', exact: true });
  const linkShown = await isVisible(link);
  const figuresShown = (await page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_METRICS).count()) > 0;
  const programHeader = (await page.getByLabel('Programa', { exact: true }).count()) > 0;
  const treeCount = (await page.getByRole('treeitem').count());
  const pressed = await interact(link, 'pulsar «Volver a Programas»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const back = await waitUntil(async () => new URL(page.url()).pathname === '/programs');
  return conclude([
    check(lines[0] === 'No se encontró el programa' && linkShown, 'el título «No se encontró el programa» y el enlace «Volver a Programas»', `el aviso «${lines.join(' · ')}» con enlace ${linkShown ? 'visible' : 'no visible'}`),
    check(!figuresShown && treeCount === 0, 'ni cifras ni árbol', `cifras ${figuresShown ? 'visibles' : 'no visibles'} y ${treeCount} requisitos`),
    check(!programHeader, 'sin la cabecera del programa', programHeader ? 'con la cabecera del programa' : 'sin la cabecera del programa'),
    check(back.reached, 'llega a /programs', `llega a ${new URL(page.url()).pathname}`),
  ]);
};

// --- Esquema 6: sin una sesión de SIGPRO guardada, la pantalla lleva al acceso ----------------------------------------------------------

const noSession: BrowserRowHandler = async (row, { page }) => {
  const ruta = cell(row, 'ruta');
  const expected = `llega a /login y no ve ningún requisito (${ruta})`;
  await resetTenants([TENANT_A]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.context().addInitScript(() => {
    try {
      localStorage.setItem('sigpro.cookies', 'accepted');
    } catch {
      // sin almacenamiento: no hay preferencia que fijar
    }
  });
  const opened = await runSteps([
    [`abrir ${LOGIN_URL}`, () => page.goto(LOGIN_URL, { timeout: CEILING_MS })],
    [`abrir ${ruta}`, () => page.goto(ruta, { timeout: CEILING_MS })],
  ]);
  if (opened) return preparationFailedWeb(expected, opened);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === '/login');
  const seen = Array.from({ length: await page.getByRole('treeitem').count() }, () => '');
  const loginHeading = await isVisible(page.getByRole('heading', { name: 'Iniciar sesión', exact: true }));
  return conclude([
    check(arrived.reached, 'llega a /login', `llega a ${new URL(page.url()).pathname}`),
    check(seen.length === 0, 'no ve ningún requisito', `ve ${seen.length} requisitos`),
    check(loginHeading, 've el formulario de acceso', loginHeading ? 've el formulario de acceso' : 'no ve el formulario de acceso'),
  ]);
};

// --- Tablas de la historia ----------------------------------------------------------------------------------------------------------

const WIDTH: ReadonlyMap<string, string> = new Map<string, string>([
  ['1440 px', '1440 px'],
  ['390 px', '390 px'],
]);

defineBrowserRows({
  story: 'US-REQ-ARBOL-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(emptyState)],
    [2, onWeb(loading)],
    [3, onWeb(errorState)],
    [4, onWeb(retry)],
    [5, onWeb(notFound)],
    [6, onWeb(noSession)],
  ]),
});
