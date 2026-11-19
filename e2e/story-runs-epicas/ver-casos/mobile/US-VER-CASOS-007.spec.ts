import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, CEILING_MS, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { codesBetween, codesShown, describeCodes, failGet, delayGet, sameCodes, waitForList, type FailureMode } from '../web/common';
import {
  cardLeaves,
  countText,
  errorLeaves as listErrorLeaves,
  listErrorOf,
  loadMoreOf,
  mobileSettled,
  mobileSnapshot,
  onExpoWeb,
  openFromTab,
  signIn,
  startsWithCodes,
  VERIFICATION_PATH,
  badgeOf,
  concluded,
  DIRECT_APPROXIMATION,
} from './common';

// US-VER-CASOS-007 — Ver la lista de casos en tarjetas con «Cargar más» y sus estados (app móvil, Expo web a 390 px). Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador; la app en /login sin sesión guardada, gestor@sigpro.test inicia
// sesión, llega a /programs y abre la sección «Verificación».

/** Celda «veces» → número de pulsaciones de «Cargar más». */
const CLICKS = new Map<string, number>([
  ['0', 0],
  ['1', 1],
  ['2', 2],
]);

/** Celda «boton» → si el botón «Cargar más» está en la pantalla. */
const LOAD_MORE_SHOWN: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
]);

/** Celda «espera» → retraso de la respuesta de GET /api/test-cases. */
const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Celda «fallo» → cómo falla la primera carga. */
const FAILURES: ReadonlyMap<string, FailureMode> = new Map<string, FailureMode>([
  ['responde con error 500', 'status500'],
  ['no obtiene respuesta del servidor', 'noResponse'],
]);

/** Celda «detalle» → lo que debe verse en la traza del aviso. */
const TRACES: ReadonlyMap<string, 'trace' | 'text'> = new Map<string, 'trace' | 'text'>([
  ['la traza de la petición fallida', 'trace'],
  ['el texto «No se pudo contactar con el servidor»', 'text'],
]);

/** Celda «resultado» → etiqueta del último resultado. */
const RESULT_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Bloqueado»', 'Bloqueado'],
  ['«Fallido»', 'Fallido'],
  ['«Superado»', 'Superado'],
]);

/** Celda «pagina» de la falla de la página siguiente. */
const FAILING_PAGE: ReadonlyMap<string, string> = new Map<string, string>([['2', '2']]);

const prepared = async (page: Parameters<BrowserRowHandler>[1]['page'], expected: string): Promise<ReturnType<typeof preparationFailedWeb> | undefined> => {
  await resetTenants([TENANT_A]);
  const opened = await signIn(page);
  return opened ? preparationFailedWeb(expected, opened) : undefined;
};

// --- Esquema 1: «Cargar más» añade los casos siguientes ----------------------------------------------------------------------

const loadMore: BrowserRowHandler = async (row, { page }) => {
  const clicks = strict('veces', CLICKS, cell(row, 'veces'));
  const shown = strict('boton', LOAD_MORE_SHOWN, cell(row, 'boton'));
  const expected = `tras ${clicks} «Cargar más»: recuento ${cell(row, 'recuento')}, último caso visible ${cell(row, 'ultimo')} y «Cargar más» ${cell(row, 'boton')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opened = await openFromTab(page);
  if (opened) return preparationFailedWeb(expected, opened);
  for (let click = 1; click <= clicks; click += 1) {
    const before = await countText(page);
    const pressed = await runSteps([['pulsar «Cargar más»', () => loadMoreOf(page).click(ACTION)]]);
    if (pressed) return preparationFailedWeb(expected, pressed);
    await waitUntil(async () => (await countText(page)) !== before, CEILING_MS);
  }
  await mobileSettled(page);
  const count = await countText(page);
  const codes = await codesShown(page);
  const buttons = await safe(() => loadMoreOf(page).count(), -1);
  return concluded([
    check(count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${count ?? '(sin leer)'}»`),
    check(sameCodes(codes, codesBetween('TC-001', cell(row, 'ultimo'))), `los casos desde TC-001 hasta ${cell(row, 'ultimo')}`, `los casos ${describeCodes(codes)}`),
    check(shown ? buttons === 1 : buttons === 0, `«Cargar más» ${cell(row, 'boton')}`, buttons === -1 ? '«Cargar más» (sin leer)' : buttons === 1 ? '«Cargar más» aparece' : '«Cargar más» no aparece'),
  ]);
};

// --- Esquema 2: cada tarjeta muestra sus datos --------------------------------------------------------------------------------

const cardData: BrowserRowHandler = async (row, { page }) => {
  const result = strict('resultado', RESULT_LABEL, cell(row, 'resultado'));
  const expected = `la tarjeta del caso ${cell(row, 'codigo')} con ${cell(row, 'resultado')}, ${cell(row, 'titulo')}, ${cell(row, 'programa')} y ${cell(row, 'ejecuciones')} ejecuciones`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opened = await openFromTab(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const leaves = await cardLeaves(page, cell(row, 'codigo'));
  const badge = await badgeOf(page, cell(row, 'codigo'));
  const runs = `${cell(row, 'ejecuciones')} ejecuciones`;
  return concluded([
    check(badge === result, `el último resultado ${result}`, `el último resultado «${badge ?? '(sin leer)'}»`),
    check(leaves?.includes(cell(row, 'titulo')) === true, `el título ${cell(row, 'titulo')}`, `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(leaves?.includes(cell(row, 'programa')) === true, `el programa ${cell(row, 'programa')}`, `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(leaves?.includes(runs) === true, `${runs}`, `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 3: la primera carga muestra un indicador hasta que llega la lista ----------------------------------------------

const firstLoad: BrowserRowHandler = async (row, { page }) => {
  const ms = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `mientras espera, indicador de carga y ningún caso; al llegar, 10 casos empezando por TC-001 (espera ${cell(row, 'espera')})`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  await delayGet(page, '/api/test-cases', ms);
  const navigated = await runSteps([['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  const seen: { snapshot?: Awaited<ReturnType<typeof mobileSnapshot>> } = {};
  await waitUntil(async () => {
    const snapshot = await mobileSnapshot(page);
    if (snapshot === undefined || (snapshot.loading === 0 && snapshot.cards === 0 && snapshot.errors === 0)) return false;
    seen.snapshot = snapshot;
    return true;
  }, CEILING_MS);
  const during = seen.snapshot;
  const arrived = await waitForList(page, codesBetween('TC-001', 'TC-010'), undefined, CEILING_MS);
  return concluded([
    check(during !== undefined && during.loading > 0 && during.cards === 0, 'indicador de carga y ningún caso mientras espera', during === undefined ? 'no se vio nada mientras espera (sin leer)' : `${during.loading} indicador(es) de carga y ${during.cards} casos`),
    check(sameCodes(arrived.codes, codesBetween('TC-001', 'TC-010')), '10 casos, empezando por TC-001', describeCodes(arrived.codes)),
  ], { note: DIRECT_APPROXIMATION });
};

// --- Esquema 4: si la primera carga no llega, el aviso dice qué ha pasado y ofrece volver a pedirla ---------------------

const firstLoadFails: BrowserRowHandler = async (row, { page }) => {
  const mode = strict('fallo', FAILURES, cell(row, 'fallo'));
  const trace = strict('detalle', TRACES, cell(row, 'detalle'));
  const expected = `el aviso «No se pudieron cargar los casos de prueba», con ${cell(row, 'detalle')}, el botón «Reintentar» y ningún caso`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  await failGet(page, '/api/test-cases', mode, 'always');
  const navigated = await runSteps([['abrir /verification', () => page.goto(VERIFICATION_PATH, { timeout: CEILING_MS })]]);
  if (navigated) return preparationFailedWeb(expected, navigated);
  await waitUntil(() => listErrorOf(page).isVisible(), CEILING_MS);
  const shown = await listErrorLeaves(page);
  const snapshot = await mobileSnapshot(page);
  const fragments = shown.fragments ?? [];
  const traceOk = trace === 'trace' ? fragments.some((fragment) => fragment.startsWith('GET /api/test-cases → 500')) : fragments.includes('No se pudo contactar con el servidor');
  return concluded(
    [
      check(shown.title === 'No se pudieron cargar los casos de prueba', 'el aviso «No se pudieron cargar los casos de prueba»', `el aviso «${shown.title ?? '(sin leer)'}»`),
      check(traceOk, trace === 'trace' ? 'la traza de la petición fallida (GET /api/test-cases → 500…)' : 'el texto «No se pudo contactar con el servidor»', `con ${fragments.length === 0 ? '(sin traza)' : fragments.join(' · ')}`),
      check(shown.retry === 'Reintentar', 'el botón «Reintentar»', `el botón «${shown.retry ?? '(sin leer)'}»`),
      check(snapshot !== undefined && snapshot.cards === 0, 'ningún caso', snapshot === undefined ? '(sin leer)' : `${snapshot.cards} casos`),
    ],
    { note: trace === 'text' && !traceOk ? `${DIRECT_APPROXIMATION} Sin respuesta del servidor, el aviso muestra la traza («GET /api/test-cases → network error») y no el texto «No se pudo contactar con el servidor»: la lista usa la traza para cualquier ApiError.` : DIRECT_APPROXIMATION },
  );
};

// --- Esquema 5: si falla la página siguiente, los casos vistos se conservan y aparece el aviso de error -------------------

const nextPageFails: BrowserRowHandler = async (row, { page }) => {
  const pageNumber = strict('pagina', FAILING_PAGE, cell(row, 'pagina'));
  const expected = `sigue viendo los casos desde TC-001, el aviso «No se pudieron cargar los casos de prueba» con «Reintentar» y el recuento «1–10 de 25»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const opened = await openFromTab(page);
  if (opened) return preparationFailedWeb(expected, opened);
  await failGet(page, '/api/test-cases', 'status500', 'always', (url) => url.searchParams.get('page') === pageNumber);
  const pressed = await runSteps([['pulsar «Cargar más»', () => loadMoreOf(page).click(ACTION)]]);
  if (pressed) return preparationFailedWeb(expected, pressed);
  await waitUntil(() => listErrorOf(page).isVisible(), CEILING_MS);
  const shown = await listErrorLeaves(page);
  const codes = await codesShown(page);
  const count = await countText(page);
  return concluded([
    check(startsWithCodes(codes, ['TC-001']) && codes?.length === 10, 'los 10 casos desde TC-001 siguen a la vista', `${codes?.length ?? '(sin leer)'} casos, empezando por ${codes?.[0] ?? '(ninguno)'}`),
    check(shown.title === 'No se pudieron cargar los casos de prueba' && shown.retry === 'Reintentar', 'el aviso «No se pudieron cargar los casos de prueba» con «Reintentar»', `el aviso «${shown.title ?? '(sin leer)'}» con «${shown.retry ?? '(sin leer)'}»`),
    check(count === '1–10 de 25', 'el recuento «1–10 de 25»', `el recuento «${count ?? '(sin leer)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-VER-CASOS-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(loadMore)],
    [2, onExpoWeb(cardData)],
    [3, onExpoWeb(firstLoad)],
    [4, onExpoWeb(firstLoadFails)],
    [5, onExpoWeb(nextPageFails)],
  ]),
});
