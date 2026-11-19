import type { Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, countText, delayList, eq, failList, interact, norm, onExpoWeb, openMobile, prepareMobile, rowCodes, textOf } from './common';

/** Espera de la respuesta que fija la historia («3 segundos»). */
const WAIT_MS: ReadonlyMap<string, number> = new Map<string, number>([['3 segundos', 3000]]);

// US-REQ-ARBOL-012 — Mostrar la carga, el estado vacío, el error y el programa no encontrado (app móvil, Expo web a 390 px). Preparación de cada
// fila: reinicio de alumno01 con su administrador; la app en /login sin sesión, con alumno01 en «Tenant de trabajo», gestor@sigpro.test, «Entrar»
// y Programas. Las respuestas lentas y los errores de la lista se fijan en la prueba (dato de la historia), solo para la petición de la fila.

const prepare = (page: Page): Promise<string | undefined> => prepareMobile(page, DEMO.gestor);

/** Las líneas de un bloque visible (título, detalle…). */
const linesOf = async (page: Page, testId: string): Promise<readonly string[]> =>
  ((await textOf(page.getByTestId(testId))) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');

// --- Esquema 1: un programa sin requisitos muestra el estado vacío --------------------------------------------------------------------

const emptyState: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `ve el título «Sin requisitos», el texto «Este programa todavía no tiene requisitos.» y el contador «0 de 0 requisitos» (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/${programa}/requirements`);
  await waitUntil(async () => (await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY)).length > 0);
  const lines = await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_EMPTY);
  return conclude([
    check(lines[0] === 'Sin requisitos' && lines[1] === 'Este programa todavía no tiene requisitos.', 'el título «Sin requisitos» y el texto «Este programa todavía no tiene requisitos.»', `el bloque muestra «${lines.join(' · ')}»`),
    eq('el contador', await countText(page), '0 de 0 requisitos'),
  ]);
};

// --- Esquema 2: mientras la lista llega, la pantalla muestra el aviso de carga -----------------------------------------------------

const loading: BrowserRowHandler = async (row, { page }) => {
  const espera = strict('espera', WAIT_MS, cell(row, 'espera'));
  const expected = 'mientras espera ve el aviso «Cargando…» y ningún requisito; al llegar la respuesta ve REQ-001 y «14 de 14 requisitos»';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await delayList(page, 'PRG-001', espera);
  const navigated = await runSteps([['abrir /programs/PRG-001/requirements', () => page.goto('/programs/PRG-001/requirements', { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  const shownLoading = (await linesOf(page, MOVIL_REQUIREMENTS_TESTIDS.LOADING)).includes('Cargando…');
  const rowsWhileWaiting = (await rowCodes(page)).length;
  const arrived = await waitUntil(async () => (await rowCodes(page)).includes('REQ-001'), CEILING_MS);
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  return conclude(
    [
      check(shownLoading, 'el aviso «Cargando…»', shownLoading ? 've el aviso «Cargando…»' : 'no ve el aviso «Cargando…»'),
      check(rowsWhileWaiting === 0, 'ningún requisito mientras espera', `${rowsWhileWaiting} requisitos mientras espera`),
      check(arrived.reached && (await countText(page)) === '14 de 14 requisitos', 've REQ-001 y «14 de 14 requisitos»', `contador «${(await countText(page)) ?? '(no legible)'}»`),
    ],
    { note: `La prueba retrasa la respuesta ${espera} ms (dato de la historia).`, evidence: { esperaMs: espera } },
  );
};

// --- Esquema 3: si la lista no llega, la pantalla muestra el error con la opción de reintentar ---------------------------------

const errorState: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `ve el título «No se pudieron cargar los requisitos» con una línea de detalle técnico, el botón «Reintentar» y ningún requisito (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await failList(page, programa, 500, 'always');
  await openMobile(page, `/programs/${programa}/requirements`);
  await waitUntil(async () => (await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_ERROR)).length > 0);
  const lines = await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_ERROR);
  const retry = await isVisible(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR_RETRY));
  const rows = (await rowCodes(page)).length;
  return conclude([
    check(lines[0] === 'No se pudieron cargar los requisitos', 'el título «No se pudieron cargar los requisitos»', `el título «${lines[0] ?? '(sin título)'}»`),
    check((lines[1] ?? '') !== '', 'una línea de detalle técnico', lines[1] === undefined ? 'sin línea de detalle técnico' : `detalle técnico «${lines[1]}»`),
    check(retry, 'el botón «Reintentar»', retry ? 've el botón «Reintentar»' : 'no ve el botón «Reintentar»'),
    check(rows === 0, 'ningún requisito', `${rows} requisitos visibles`),
  ]);
};

// --- Esquema 4: reintentar vuelve a pedir la lista y muestra el árbol si llega --------------------------------------------------------

const retry: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `tras «Reintentar», con la petición que vuelve a responder bien, ve REQ-001 y «14 de 14 requisitos» (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await failList(page, programa, 500, 1);
  await openMobile(page, `/programs/${programa}/requirements`);
  await waitUntil(async () => (await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_ERROR)).length > 0);
  if ((await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_ERROR)).length === 0) return preparationFailedWeb(expected, 'no se vio el aviso de error antes de «Reintentar»');
  const pressed = await interact(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_ERROR_RETRY), 'pulsar «Reintentar»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const back = await waitUntil(async () => (await rowCodes(page)).includes('REQ-001'));
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  return conclude([check(back.reached, 've REQ-001', back.reached ? 've REQ-001' : 'no ve REQ-001 tras reintentar'), eq('el contador', await countText(page), '14 de 14 requisitos')]);
};

// --- Esquema 5: un programa que no es del tenant muestra el aviso de no encontrado ------------------------------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `ve el título «No se encontró el programa», una línea de detalle técnico y el enlace «Volver a Programas»; no ve cifras ni árbol; al pulsarlo llega a /programs (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/${codigo}/requirements`);
  await waitUntil(async () => (await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND)).length > 0);
  const lines = await linesOf(page, REQUISITOS_TESTIDS.REQUIREMENTS_NOT_FOUND);
  const link = page.getByTestId(MOVIL_REQUIREMENTS_TESTIDS.NOT_FOUND_BACK);
  const linkShown = await isVisible(link);
  const metrics = (await page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_METRICS).count()) > 0;
  const rows = (await rowCodes(page)).length;
  const pressed = await interact(link, 'pulsar «Volver a Programas»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === '/programs');
  return conclude([
    check(lines[0] === 'No se encontró el programa' && (lines[1] ?? '') !== '' && linkShown, 'el título «No se encontró el programa», una línea de detalle técnico y «Volver a Programas»', `el bloque muestra «${lines.join(' · ')}» con enlace ${linkShown ? 'visible' : 'no visible'}`),
    check(!metrics && rows === 0, 'ni cifras ni árbol', `cifras ${metrics ? 'visibles' : 'no visibles'} y ${rows} requisitos`),
    check(arrived.reached, 'llega a /programs', `llega a ${new URL(page.url()).pathname}`),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(emptyState)],
    [2, onExpoWeb(loading)],
    [3, onExpoWeb(errorState)],
    [4, onExpoWeb(retry)],
    [5, onExpoWeb(notFound)],
  ]),
});
