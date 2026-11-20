import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, holdsFor, isVisible, quoted, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, clickAction, isAscending, prepareWeb, topsOf } from '../web/common';
import { MOBILE, expo, groupOf, groupTotalOf, moreInGroup, openFromMore, retryButton, searchField, searchStatus, shownText, signInMobile } from './common';

// US-NAVEGACION-012 — Búsqueda global de la app móvil (Expo web, 390 × 844). Preparación de cada fila: reinicio de alumno01, inicio
// de sesión de gestor@sigpro.test con «alumno01» en «Tenant de trabajo» y «Búsqueda global» abierta desde «Más». Las esperas («hace
// fallar», «retrasa 3 segundos») se hacen interceptando GET /api/search en la propia prueba.

const SEARCH_ROUTE = '**/api/search**';
const SUMMARY = '3 resultados en 2 grupos';

/** Reglas de la historia sin fila (se anotan): el foco al abrir la pantalla, el texto de ayuda y el campo vacío al salir. */
const RULES = 'Reglas sin fila (no comprobadas): el foco al abrir la pantalla, el texto de ayuda «Buscar código o nombre…» y el campo vacío al salir.';

/** Tipos de grupo por su nombre visible (la columna «grupo»). */
const KIND_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['Requisitos', 'requirement'],
  ['Casos de prueba', 'testcase'],
]);

/** Texto que escribe la fila en el campo («(vacío)» deja el campo sin texto). */
const TYPED: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['a', 'a'],
  ['zz', 'zz'],
]);

const TOTAL_OF_ROW: ReadonlyMap<string, string> = new Map<string, string>([
  ['5 / 40', '5 / 40'],
  ['5 / 25', '5 / 25'],
]);

const SHOWN: ReadonlyMap<string, number> = new Map<string, number>([
  ['5', 5],
]);

/** Abre la búsqueda desde «Más» con una sesión de gestor en la app móvil. */
const enterSearch = async (page: Page, expected: string): Promise<{ readonly failure?: string }> => {
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const signed = await signInMobile(page, DEMO.gestor);
  if (signed) return { failure: `${signed} (${expected})` };
  const opened = await openFromMore(page, 'search', 'Búsqueda global');
  if (opened) return { failure: opened };
  const ready = await waitUntil(() => isVisible(searchField(page)));
  return ready.reached ? {} : { failure: 'no se abre la pantalla «Búsqueda global»' };
};

/** Escribe en el campo como una persona; devuelve el fallo del paso o `undefined`. */
const typeText = (page: Page, text: string): Promise<string | undefined> =>
  runSteps([[`escribir ${text === '' ? '(vacío)' : text} en «Búsqueda global»`, () => searchField(page).fill(text, ACTION)]]);

// --- Esquema 1: el campo muestra el aviso mínimo o el resultado de lo escrito -----------------------------------------------

const minimum: BrowserRowHandler = async (row, { page }) => {
  const text = strict('texto', TYPED, cell(row, 'texto'));
  const notice = quoted(cell(row, 'aviso'));
  const expected = `ve el aviso «${notice}»`;
  const entered = await enterSearch(page, expected);
  if (entered.failure) return preparationFailedWeb(expected, entered.failure);
  if (text !== '') {
    const typed = await typeText(page, text);
    if (typed) return actionFailed(expected, { message: typed, note: 'El campo no recibe el texto.' });
  }
  const shown = await waitUntil(() => shownText(page, notice), 5_000);
  return conclude([check(shown.reached, `ve el aviso «${notice}»`, shown.reached ? `ve el aviso «${notice}»` : `no ve «${notice}» (estado: ${(await searchStatus(page)) ?? '(sin aviso)'})`)]);
};

// --- Esquema 2: los grupos muestran su total y el aviso de estado dice cuántos resultados hay -------------------------------

const groups: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const expected = `ve el grupo «Programas» con el total 1 y el grupo «Documentos» con el total 2, en ese orden; aviso «${SUMMARY}»`;
  const entered = await enterSearch(page, expected);
  if (entered.failure) return preparationFailedWeb(expected, entered.failure);
  const typed = await typeText(page, text);
  if (typed) return actionFailed(expected, { message: typed, note: 'El campo no recibe el texto.' });
  const summary = await waitUntil(async () => (await searchStatus(page)) === SUMMARY);
  const programTotal = await groupTotalOf(page, 'program');
  const documentTotal = await groupTotalOf(page, 'document');
  const tops = await topsOf([groupOf(page, 'program'), groupOf(page, 'document')]);
  return conclude([
    check(summary.reached, `aviso «${SUMMARY}»`, `aviso «${(await searchStatus(page)) ?? '(sin aviso)'}»`),
    check(programTotal === '1' && documentTotal === '2', 'Programas con total 1 y Documentos con total 2', `Programas total ${programTotal ?? '(sin total)'}; Documentos total ${documentTotal ?? '(sin total)'}`),
    check(isAscending(tops), 'Programas antes que Documentos', tops === undefined ? 'algún grupo no se lee' : `posiciones verticales ${tops.map((top) => String(Math.round(top))).join(' y ')}`),
  ]);
};

// --- Esquema 3: un grupo con más coincidencias que resultados muestra su total parcial y el «N más» ----------------------

const partial: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const group = quoted(cell(row, 'grupo'));
  const total = strict('total', TOTAL_OF_ROW, quoted(cell(row, 'total')));
  const shown = strict('mostrados', SHOWN, cell(row, 'mostrados'));
  const more = cell(row, 'masq');
  const expected = `ve el grupo «${group}» con el total «${total}», con ${String(shown)} resultados y debajo «${more} más»`;
  const kind = strict('grupo', KIND_OF, group);
  const entered = await enterSearch(page, expected);
  if (entered.failure) return preparationFailedWeb(expected, entered.failure);
  const typed = await typeText(page, text);
  if (typed) return actionFailed(expected, { message: typed, note: 'El campo no recibe el texto.' });
  const totalShown = await waitUntil(async () => (await groupTotalOf(page, kind)) === total);
  const items = await groupOf(page, kind).getByRole('link').count();
  const moreText = await moreInGroup(page, kind);
  return conclude([
    check(totalShown.reached, `el grupo «${group}» con el total «${total}»`, `el grupo «${group}» con el total «${(await groupTotalOf(page, kind)) ?? '(sin total)'}»`),
    check(items === shown, `${String(shown)} resultados en el grupo`, `${String(items)} resultados en el grupo`),
    check(moreText === `${more} más`, `debajo «${more} más»`, `debajo «${moreText ?? '(sin «más»)'}»`),
  ]);
};

// --- Esquema 4: un error de la búsqueda se puede reintentar -----------------------------------------------------------------

const retry: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const expected = `ve el aviso «No se pudo buscar» y el botón «Reintentar»; tras dejar de hacer fallar, «Reintentar» muestra «${SUMMARY}»`;
  const entered = await enterSearch(page, expected);
  if (entered.failure) return preparationFailedWeb(expected, entered.failure);
  // Un único fallo de red mientras `failing` valga: después se deja pasar (la historia dice «dejar de hacer fallar»)
  let failing = true;
  await page.route(SEARCH_ROUTE, async (route) => {
    if (failing) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', message: 'prueba' }) });
      return;
    }
    await route.continue();
  });
  const typed = await typeText(page, text);
  if (typed) return actionFailed(expected, { message: typed, note: 'El campo no recibe el texto.' });
  const failed = await waitUntil(async () => (await searchStatus(page)) === 'No se pudo buscar');
  const offered = await waitUntil(() => isVisible(retryButton(page)));
  failing = false;
  const retried = await clickAction(page, retryButton(page), 'pulsar «Reintentar»');
  if (retried) return actionFailed(expected, retried);
  const summary = await waitUntil(async () => (await searchStatus(page)) === SUMMARY);
  return conclude([
    check(failed.reached && offered.reached, 've el aviso «No se pudo buscar» y el botón «Reintentar»', failed.reached && offered.reached ? 've el aviso «No se pudo buscar» y el botón «Reintentar»' : `aviso ${(await searchStatus(page)) ?? '(sin aviso)'}; botón ${offered.reached ? 'visible' : 'ausente'}`),
    check(summary.reached, `tras «Reintentar», aviso «${SUMMARY}»`, `aviso «${(await searchStatus(page)) ?? '(sin aviso)'}»`),
  ]);
};

// --- Esquema 5: mientras la búsqueda espera la respuesta, el aviso dice «Buscando…» ------------------------------------------

const waiting: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const expected = `ve el aviso «Buscando…» mientras espera; al llegar la respuesta, «${SUMMARY}»`;
  const entered = await enterSearch(page, expected);
  if (entered.failure) return preparationFailedWeb(expected, entered.failure);
  let intercepted = 0;
  await page.route(SEARCH_ROUTE, async (route) => {
    intercepted += 1;
    await sleep(3_000);
    await route.continue();
  });
  const typed = await typeText(page, text);
  if (typed) return actionFailed(expected, { message: typed, note: 'El campo no recibe el texto.' });
  const busy = await waitUntil(async () => (await searchStatus(page)) === 'Buscando…', 2_500);
  // «Buscando…» dura mientras la respuesta tarda: se sostiene ≥ 1,5 s después de aparecer (no basta con verlo un instante)
  const held = await holdsFor(async () => (await searchStatus(page)) === 'Buscando…', 1_500);
  const summary = await waitUntil(async () => (await searchStatus(page)) === SUMMARY);
  const checks: Check[] = [
    check(busy.reached, 've el aviso «Buscando…» mientras espera', busy.reached ? 've el aviso «Buscando…» mientras espera' : `aviso ${(await searchStatus(page)) ?? '(sin aviso)'}`),
    check(summary.reached, `al llegar la respuesta, aviso «${SUMMARY}»`, `aviso «${(await searchStatus(page)) ?? '(sin aviso)'}»`),
  ];
  checks.push(check(held.held, '«Buscando…» dura mientras la respuesta tarda (≥ 1,5 s)', held.held ? '«Buscando…» dura ≥ 1,5 s' : 'el aviso cambia antes de 1,5 s'));
  checks.push(check(intercepted > 0, 'la intercepción recibe la petición de GET /api/search', `peticiones interceptadas: ${String(intercepted)}`));
  return conclude(checks);
};

defineBrowserRows({
  story: 'US-NAVEGACION-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, expo(minimum, RULES)],
    [2, expo(groups, RULES)],
    [3, expo(partial, RULES)],
    [4, expo(retry, RULES)],
    [5, expo(waiting, RULES)],
  ]),
});
