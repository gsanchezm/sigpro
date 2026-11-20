import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, safe, waitUntil } from '../../support/browser';
import { check, cell, conclude, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  MOBILE_URL,
  NETWORK_MS,
  REACTION_MS,
  browserOf,
  countVisible,
  delayGets,
  describeCount,
  enterButton,
  failGets,
  failedAction,
  openLogin,
  phoneContext,
  prepFailed,
  programsTitle,
  quietCookies,
  reachable,
  resetAlumno,
  settle,
  signInToPrograms,
  typeCredentials,
  runStepsLogged,
  withRoutesReleased,
  releaseContextRoutes,
} from './common';
import { MOBILE_NOTE, expoNotRunning, mobileSignInSteps } from './mobile';

// US-A11Y-005 — Listas con carga ocupada, estado vacío y error anunciables (web de 1440 px y, en las filas móviles, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01; las filas que retrasan o rompen una respuesta lo fijan en el navegador de la prueba
// ANTES de la acción. Si la lectura de «ocupada» o de «Cargando…» llega después de que la prueba libera la respuesta, la fila no es un
// hallazgo sobre la app (lectura tardía del arnés) y sale `notExecutable`.

const TITLE_EMPTY = 'Sin programas';
const EMPTY_EXPLANATION = 'Ningún programa coincide con los filtros aplicados.';
const CLEAR = 'Limpiar filtros';

const RESPONSIBLE: ReadonlyMap<string, string> = new Map([['«Marta Ruiz»', 'Marta Ruiz']]);
const STATUS: ReadonlyMap<string, string> = new Map([['«Cancelado»', 'Cancelado']]);
const WAITS: ReadonlyMap<string, number> = new Map([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);
const REGIONS: ReadonlyMap<string, (page: Page) => Locator> = new Map([['la tabla de programas', (page) => page.getByRole('table')]]);
const TITLES: ReadonlyMap<string, string> = new Map([
  ['«No se pudieron cargar los programas»', 'No se pudieron cargar los programas'],
  ['«No se pudo cargar el tablero»', 'No se pudo cargar el tablero'],
]);
const ENDPOINTS: ReadonlyMap<string, string> = new Map([
  ['GET /api/programs', '/api/programs'],
  ['GET /api/nc', '/api/nc'],
]);
const SCREENS: ReadonlyMap<string, string> = new Map([
  ['/programs', '/programs'],
  ['/nc', '/nc'],
]);

/** Filas de programas de la tabla (las que tienen la casilla «Seleccionar PRG-…»). */
const programRows = (page: Page): Locator => page.getByRole('table').getByRole('row').filter({ has: page.getByRole('checkbox', { name: /^Seleccionar PRG-/ }) });

/** Filtra por Responsable y por Estado como una persona. La respuesta filtrada se espera antes de devolver. Devuelve el fallo, si hay. */
const filterBy = async (page: Page, owner: string, status: string): Promise<string | undefined> => {
  const applied = await runStepsLogged([
    [`escribir «${owner}» en «Responsable»`, () => page.getByRole('combobox', { name: 'Responsable', exact: true }).fill(owner, ACTION)],
    [`elegir «${owner}»`, () => page.getByRole('option', { name: new RegExp(`^${owner}`) }).click(ACTION)],
  ]);
  if (applied) return applied;
  // La última respuesta de la lista corresponde al filtro completo: se arma antes de elegir el estado
  const listed = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/programs' && response.request().method() === 'GET', { timeout: CEILING_MS }).then(
    () => true,
    () => false,
  );
  const selected = await runStepsLogged([[`elegir «${status}» en «Estado»`, () => page.getByRole('combobox', { name: 'Estado', exact: true }).selectOption(status, ACTION)]]);
  if (selected) return selected;
  if (!(await listed)) return 'la lista no pidió la respuesta filtrada tras elegir el estado';
  const ready = await waitUntil(async () => (await attrOf(page.getByRole('table'), 'aria-busy')) === 'false', CEILING_MS);
  return ready.reached ? undefined : 'la tabla sigue marcada como ocupada tras el plazo';
};

// --- Esquema 1: mientras llega la lista, su región se anuncia como ocupada (web) -----------------------------------------------

const busyWhileLoading: BrowserRowHandler = async (row, { page, context }) => {
  const ms = strict('espera', WAITS, cell(row, 'espera'));
  const region = strict('region', REGIONS, cell(row, 'region'));
  const expected = `mientras espera, ${cell(row, 'region')} se anuncia como ocupada y, al llegar la respuesta, deja de anunciarse así`;
  await quietCookies(context);
  await resetAlumno();
  const released = { at: 0 };
  await delayGets(page, '/api/programs', ms, released);
  const prepared = await runStepsLogged([openLogin(page), ...typeCredentials(page, DEMO.gestor.email, DEMO.gestor.password)]);
  if (prepared) return prepFailed(expected, prepared);
  const clicked = await runStepsLogged([
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
    ['llegar a /programs', () => programsTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);
  if (clicked) return failedAction(expected, clicked);
  // Se mira la tabla hasta que aparece la marca o hasta que la prueba libera la respuesta. Una lectura hecha ANTES de liberar que no
  // vea la marca es un hallazgo; si no hubo ninguna lectura antes de liberar, la lectura llegó tarde (fallo del arnés).
  const table = region(page);
  const reads = { busy: false, beforeRelease: false };
  await waitUntil(async () => {
    const value = await attrOf(table, 'aria-busy');
    if (released.at === 0) reads.beforeRelease = true;
    if (value === 'true') reads.busy = true;
    return reads.busy || released.at !== 0;
  }, ms + NETWORK_MS);
  if (!reads.busy && !reads.beforeRelease) return notExecutable(expected, `Lectura tardía: la respuesta se liberó a los ${ms} ms antes de la primera lectura de la tabla; fallo del arnés, no de la app.`);
  const busy = { reached: reads.busy };
  const idle = await waitUntil(async () => (await attrOf(table, 'aria-busy')) === 'false', ms + NETWORK_MS);
  return conclude(
    [
      check(busy.reached, `mientras espera la respuesta, ${cell(row, 'region')} se anuncia como ocupada`, busy.reached ? `${cell(row, 'region')} marcada como ocupada` : `${cell(row, 'region')} sin marca de ocupada (aria-busy distinto de true)`),
      check(idle.reached, 'cuando llega la respuesta, deja de anunciarse como ocupada', idle.reached ? 'aria-busy vuelve a false' : 'sigue marcada como ocupada tras la respuesta'),
    ],
    { note: `${COOKIE_NOTE} La respuesta se retrasa ${ms} ms en el navegador de la prueba.` },
  );
};

// --- Esquema 2: en la app móvil, «Cargando…» se ve y se anuncia como ocupada (Expo web) --------------------------------------

const phoneLoading: BrowserRowHandler = async (row, { context }) => {
  const ms = strict('espera', WAITS, cell(row, 'espera'));
  const expected = `«Cargando…» visible y anunciado como ocupado mientras espera la lista (${cell(row, 'espera')})`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(expected, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const phone = await phoneContext(browserOf(context));
  try {
    const page = await phone.newPage();
    const released = { at: 0 };
    await delayGets(page, '/api/programs', ms, released);
    const prepared = await runStepsLogged(mobileSignInSteps(page, DEMO.gestor.email, DEMO.gestor.password));
    if (prepared) return prepFailed(expected, prepared);
    const loading = page.getByRole('status', { name: 'Cargando…', exact: true });
    // Igual que en la lista de escritorio: se mira hasta ver «Cargando…» o hasta que la prueba libera la respuesta
    const reads = { seen: false, beforeRelease: false };
    await waitUntil(async () => {
      if (released.at === 0) reads.beforeRelease = true;
      if ((await countVisible(loading)) === 1) reads.seen = true;
      return reads.seen || released.at !== 0;
    }, ms + NETWORK_MS);
    if (!reads.seen && !reads.beforeRelease) return notExecutable(expected, `Lectura tardía: la respuesta se liberó a los ${ms} ms antes de la primera lectura de «Cargando…»; fallo del arnés, no de la app.`);
    const seen = { reached: reads.seen };
    const busy = await safe(() => loading.first().getAttribute('aria-busy', { timeout: 1_000 }), undefined);
    return conclude(
      [
        check(seen.reached, 'se ve «Cargando…»', seen.reached ? 'se ve «Cargando…»' : `no se ve «Cargando…» (${describeCount(await countVisible(loading))})`),
        check(busy === 'true', 'se anuncia como ocupada', busy === 'true' ? 'se anuncia como ocupada (aria-busy true)' : `aria-busy ${busy ?? '(sin atributo)'}`),
      ],
      { note: `${MOBILE_NOTE} La respuesta se retrasa ${ms} ms en el navegador de la prueba.` },
    );
  } finally {
    await releaseContextRoutes(phone);
    await phone.close();
  }
};

// --- Esquema 3: una lista sin resultados muestra su estado vacío y lo anuncia como estado ----------------------------------

const emptyList: BrowserRowHandler = async (row, { page, context }) => {
  const owner = strict('responsable', RESPONSIBLE, cell(row, 'responsable'));
  const status = strict('estado', STATUS, cell(row, 'estado'));
  const expected = `título «${TITLE_EMPTY}», explicación «${EMPTY_EXPLANATION}», «${CLEAR}» y el estado vacío anunciado como estado`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const filtered = await filterBy(page, owner, status);
  if (filtered) return prepFailed(expected, filtered);
  const title = await settle(() => countVisible(page.getByText(TITLE_EMPTY, { exact: true })), (count) => count === 1);
  const explanation = await settle(() => countVisible(page.getByText(EMPTY_EXPLANATION, { exact: true })), (count) => count === 1);
  const clear = await settle(() => countVisible(page.getByRole('button', { name: CLEAR, exact: true })), (count) => count >= 1);
  const announced = await settle(() => countVisible(page.getByRole('status').filter({ hasText: TITLE_EMPTY })), (count) => count === 1);
  return conclude(
    [
      check(title.ok, `ve el título «${TITLE_EMPTY}»`, `ve el título «${TITLE_EMPTY}»: ${title.ok ? 'sí' : describeCount(title.value)}`),
      check(explanation.ok, `ve la explicación «${EMPTY_EXPLANATION}»`, `ve la explicación: ${explanation.ok ? 'sí' : describeCount(explanation.value)}`),
      check(clear.ok, `ve el botón «${CLEAR}»`, clear.ok ? `ve el botón «${CLEAR}»` : `no se ve «${CLEAR}» (${describeCount(clear.value)})`),
      check(announced.ok, 'el estado vacío se anuncia como estado', announced.ok ? 'el estado vacío se anuncia como estado' : 'el estado vacío no está en ninguna región de estado'),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 4: al quitar los filtros, la lista vuelve a mostrar sus resultados (web) --------------------------------------

const clearFilters: BrowserRowHandler = async (row, { page, context }) => {
  const owner = strict('responsable', RESPONSIBLE, cell(row, 'responsable'));
  const status = strict('estado', STATUS, cell(row, 'estado'));
  const expected = `tras pulsar «${CLEAR}», la tabla de programas muestra 10 filas en la primera página`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const filtered = await filterBy(page, owner, status);
  if (filtered) return prepFailed(expected, filtered);
  // Con la lista vacía hay dos botones «Limpiar filtros» (barra de filtros y bloque vacío): se pulsa el de la barra
  const cleared = await runStepsLogged([[`pulsar «${CLEAR}»`, () => page.getByRole('search').getByRole('button', { name: CLEAR, exact: true }).click(ACTION)]]);
  if (cleared) return failedAction(expected, cleared);
  const rows = await settle(() => countVisible(programRows(page)), (count) => count === 10, NETWORK_MS);
  return conclude([check(rows.ok, 've de nuevo la tabla de programas con 10 filas en la primera página', `la tabla muestra ${describeCount(rows.value)} filas de programa (${rows.value})`)], { note: COOKIE_NOTE });
};

// --- Esquema 5: una lista que no se puede cargar muestra el aviso y «Reintentar» como alerta (web) ----------------------------

const webError: BrowserRowHandler = async (row, { page, context }) => {
  const endpoint = strict('endpoint', ENDPOINTS, cell(row, 'endpoint'));
  const screen = strict('pantalla', SCREENS, cell(row, 'pantalla'));
  const titulo = strict('titulo', TITLES, cell(row, 'titulo'));
  const expected = `ve «${titulo}» y «Reintentar» como alerta; tras dejar de fallar y pulsar «Reintentar», la lista carga`;
  await quietCookies(context);
  await resetAlumno();
  let failing = false;
  await failGets(page, endpoint, () => failing);
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  failing = true;
  const opened = await runStepsLogged([[`abrir ${screen} escribiendo su dirección`, () => page.goto(screen, { timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  const alert = page.getByRole('alert');
  const shown = await settle(() => countVisible(alert.getByText(titulo, { exact: true })), (count) => count === 1, NETWORK_MS);
  const retry = alert.getByRole('button', { name: 'Reintentar', exact: true });
  const retried = await settle(() => countVisible(retry), (count) => count === 1, REACTION_MS);
  failing = false;
  const clicked = await runStepsLogged([['pulsar «Reintentar»', () => retry.click(ACTION)]]);
  if (clicked) return failedAction(expected, clicked);
  const loaded = await settle(
    () => (screen === '/programs' ? countVisible(programRows(page)) : countVisible(page.getByRole('button', { name: /^Abrir NC-\d{3}$/ }))),
    (count) => count > 0,
    NETWORK_MS,
  );
  return conclude(
    [
      check(shown.ok, `ve el título «${titulo}» dentro de un aviso de alerta`, shown.ok ? `ve el título «${titulo}» dentro de un aviso de alerta` : `no se ve «${titulo}» dentro de un aviso de alerta (${describeCount(shown.value)})`),
      check(retried.ok, 've el botón «Reintentar» dentro del aviso', retried.ok ? 've el botón «Reintentar» dentro del aviso' : `no se ve «Reintentar» dentro del aviso (${describeCount(retried.value)})`),
      check(loaded.ok, 'la lista carga sus resultados', loaded.ok ? 'la lista carga sus resultados' : `la lista no carga resultados (${describeCount(loaded.value)})`),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 6: en la app móvil, la lista que no carga muestra el aviso como alerta (Expo web) -------------------------------

const phoneError: BrowserRowHandler = async (row, { context }) => {
  const titulo = strict('titulo', TITLES, cell(row, 'titulo'));
  const expected = `ve «${titulo}» y «Reintentar» dentro de una alerta`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(expected, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const phone = await phoneContext(browserOf(context));
  try {
    const page = await phone.newPage();
    await failGets(page, '/api/programs', () => true);
    const prepared = await runStepsLogged(mobileSignInSteps(page, DEMO.gestor.email, DEMO.gestor.password));
    if (prepared) return prepFailed(expected, prepared);
    const alert = page.getByRole('alert');
    const shown = await settle(() => countVisible(alert.getByText(titulo, { exact: true })), (count) => count === 1, NETWORK_MS);
    const retry = await settle(() => countVisible(alert.getByRole('button', { name: 'Reintentar', exact: true })), (count) => count === 1, REACTION_MS);
    return conclude(
      [
        check(shown.ok, `ve el título «${titulo}» dentro de una alerta`, shown.ok ? `ve el título «${titulo}» dentro de una alerta` : `no se ve «${titulo}» dentro de una alerta (${describeCount(shown.value)})`),
        check(retry.ok, 've el botón «Reintentar» dentro de la alerta', retry.ok ? 've el botón «Reintentar» dentro de la alerta' : `no se ve «Reintentar» dentro de la alerta (${describeCount(retry.value)})`),
      ],
      { note: MOBILE_NOTE },
    );
  } finally {
    await releaseContextRoutes(phone);
    await phone.close();
  }
};

defineBrowserRows({
  story: 'US-A11Y-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(busyWhileLoading)],
    [2, withRoutesReleased(phoneLoading)],
    [3, withRoutesReleased(emptyList)],
    [4, withRoutesReleased(clearFilters)],
    [5, withRoutesReleased(webError)],
    [6, withRoutesReleased(phoneError)],
  ]),
});
