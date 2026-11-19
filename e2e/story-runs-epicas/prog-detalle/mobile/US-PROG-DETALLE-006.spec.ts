import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  articleOf,
  delayDetail,
  failDetail,
  notSeenCheck,
  prepFailed,
  prepFailedText,
  runSteps,
  seen,
  seenCheck,
  textOne,
  type StepFailure,
} from '../web/common';
import {
  backButton,
  DETAIL_TITLE,
  DIRECT_APPROXIMATION,
  errorOf,
  heading1,
  loadingOf,
  notFoundOf,
  onExpoWeb,
  openDetail,
  programCardLink,
  retryButton,
  signIn,
  textbox,
} from './common';

// US-PROG-DETALLE-006 — Carga, aviso de no encontrado, error con reintento y volver a Programas en la app móvil (web de Expo a 390 px). Preparación
// de cada fila: reinicio de alumno01 con el token de su administrador; después la app se deja en /login sin sesión guardada, con alumno01 en
// «Tenant de trabajo», y gestor@sigpro.test inicia sesión. La demora y el fallo de GET /api/programs/PRG-001 los provoca la prueba. El veredicto
// vale para Expo web, no para iOS ni Android nativo.

const NAME = 'Sistema de mando táctico Ártemis';
const DETAIL = '/programs/PRG-001';

// --- Esquema 1: la ficha muestra «Cargando…» hasta que llega el programa --------------------------------------------------------------------

const WAIT: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const loadingUntilArrival: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = strict('espera', WAIT, cell(row, 'espera'));
  const expected = `mientras espera ve «Cargando…» y no ve el nombre ${NAME}; al llegar la respuesta ve el nombre ${NAME}`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  await delayDetail(page, 'PRG-001', ms);
  const went = await runSteps([['abrir /programs/PRG-001', () => page.goto(DETAIL, { timeout: CEILING_MS })]]);
  if (went) return actionMissing(expected, went);

  // Se mira durante la espera (con el techo por defecto): si el nombre llega antes de ver «Cargando…», la comprobación no se cumple
  const watched: { loading: boolean; text?: string; nameWhileLoading: boolean } = { loading: false, nameWhileLoading: false };
  const name = heading1(page, NAME);
  await waitUntil(async () => {
    if ((await seen(loadingOf(page))) === true) {
      watched.loading = true;
      watched.text ??= await textOne(loadingOf(page));
      if ((await seen(name)) === true) watched.nameWhileLoading = true;
    }
    return (await seen(name)) === true;
  });
  return conclude(
    [
      check(watched.loading && watched.text === 'Cargando…', 'mientras espera ve «Cargando…»', watched.loading ? `ve «${watched.text ?? '(sin leer)'}»` : 'no ve «Cargando…»'),
      check(!watched.nameWhileLoading, 'no ve el nombre mientras espera', watched.nameWhileLoading ? 've el nombre mientras espera' : 'no ve el nombre mientras espera'),
      await seenCheck(name, `al llegar la respuesta ve el nombre ${NAME}`, `el nombre ${NAME}`),
    ],
    { note: DIRECT_APPROXIMATION },
  );
};

// --- Esquema 2: un código que no es un programa muestra el aviso de no encontrado ---------------------------------------------------------

const NOT_A_PROGRAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-000', 'PRG-000'],
  ['PRG-025', 'PRG-025'],
  ['REQ-001', 'REQ-001'],
]);

/** El código va debajo del título «Detalle del programa» (su caja empieza más abajo). `undefined` si no se puede medir. */
const codeBelowTitle = async (page: Page, code: string): Promise<boolean | undefined> => {
  try {
    const title = await heading1(page, DETAIL_TITLE).boundingBox({ timeout: 1_000 });
    const codeBox = await page.getByText(code, { exact: true }).boundingBox({ timeout: 1_000 });
    return title && codeBox ? codeBox.y > title.y : undefined;
  } catch {
    return undefined;
  }
};

const notFound: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', NOT_A_PROGRAM, cell(row, 'codigo'));
  const expected = `ve el título «${DETAIL_TITLE}» con el código ${code} debajo, ve «Programa no encontrado» y no ve datos de ningún programa`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, `/programs/${code}`);
  if (opened) return actionMissing(expected, opened);
  const below = await codeBelowTitle(page, code);
  return conclude(
    [
      await seenCheck(heading1(page, DETAIL_TITLE), `ve el título «${DETAIL_TITLE}»`, `el título «${DETAIL_TITLE}»`),
      await seenCheck(page.getByText(code, { exact: true }), `ve el código ${code}`, `el código ${code}`),
      check(below === true, `el código ${code} debajo del título`, below === undefined ? 'posición del código sin medir' : below ? `el código ${code} debajo del título` : `el código ${code} no está debajo del título`),
      await seenCheck(notFoundOf(page).getByText('Programa no encontrado', { exact: true }), 've «Programa no encontrado»', '«Programa no encontrado»'),
      await notSeenCheck(articleOf(page), 'no ve datos de ningún programa', 'los datos del programa'),
    ],
    { note: DIRECT_APPROXIMATION },
  );
};

// --- Esquema 3: un fallo del servidor se puede reintentar -----------------------------------------------------------------------------------

const FAILURE: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const retry: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', FAILURE, cell(row, 'codigo_http'));
  const expected = `la primera respuesta es ${cell(row, 'codigo_http')}; ve «No se pudo cargar el programa» y «Reintentar»; al pulsar «Reintentar» ve el nombre ${NAME}`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  // Solo la primera respuesta de la ficha falla; las siguientes responden con normalidad
  await failDetail(page, 'PRG-001', status, 1);
  const opened = await openDetail(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  const errorShown = (await seen(errorOf(page))) === true && (await seen(errorOf(page).getByText('No se pudo cargar el programa', { exact: true }))) === true;
  const retryShown = (await seen(retryButton(page))) === true;
  if (!errorShown || !retryShown) {
    return prepFailedText(expected, 'tras la primera respuesta fallida no se ve «No se pudo cargar el programa» con «Reintentar»');
  }
  const pressed = await runSteps([['pulsar «Reintentar»', () => retryButton(page).click(ACTION)]]);
  if (pressed) return actionMissing(expected, pressed);
  const name = heading1(page, NAME);
  await waitUntil(async () => (await seen(name)) === true);
  return conclude([await seenCheck(name, `ve el nombre ${NAME}`, `el nombre ${NAME}`)], { note: DIRECT_APPROXIMATION });
};

// --- Esquema 4: el botón Volver a Programas lleva a la lista de Programas -------------------------------------------------------------------

type Origin = 'lista' | 'busqueda';
const ORIGIN: ReadonlyMap<string, Origin> = new Map<string, Origin>([
  ['la lista de Programas', 'lista'],
  ['la búsqueda global, con el resultado del programa PRG-001', 'busqueda'],
]);

/** Llega a la ficha desde el origen de la fila: la lista (tarjeta) o la búsqueda global (su resultado), siempre con navegación de la propia app. */
const reachDetail = async (page: Page, origin: Origin): Promise<StepFailure | undefined> => {
  if (origin === 'lista') {
    const listed = await runSteps([
      ['abrir la lista de Programas', () => page.goto('/programs', { timeout: CEILING_MS })],
      ['ver la lista de Programas', () => heading1(page, 'Programas').waitFor({ timeout: CEILING_MS })],
    ]);
    if (listed) return listed;
    return runSteps([['pulsar la tarjeta de PRG-001', () => programCardLink(page, 'PRG-001').click(ACTION)]]);
  }
  const searched = await runSteps([
    ['abrir la búsqueda global', () => page.goto('/search', { timeout: CEILING_MS })],
    ['escribir PRG-001 en «Búsqueda global»', () => textbox(page, 'Búsqueda global').fill('PRG-001', ACTION)],
  ]);
  if (searched) return searched;
  return runSteps([['pulsar el resultado PRG-001', () => programCardLink(page, 'PRG-001').click(ACTION)]]);
};

const backToList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const origin = strict('origen', ORIGIN, cell(row, 'origen'));
  const expected = 'llega a /programs';
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const reached = await reachDetail(page, origin);
  if (reached) return actionMissing(expected, reached);
  const shown = await waitUntil(async () => (await seen(heading1(page, NAME))) === true);
  if (!shown.reached) return prepFailedText(expected, `la ficha de PRG-001 no se ve desde ${cell(row, 'origen')}`);
  const clicked = await runSteps([['pulsar «Volver a Programas»', () => backButton(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  return conclude([check(arrived.reached, expected, `llega a ${pathOf(page)}`)], { note: DIRECT_APPROXIMATION });
};

defineBrowserRows({
  story: 'US-PROG-DETALLE-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(loadingUntilArrival)],
    [2, onExpoWeb(notFound)],
    [3, onExpoWeb(retry)],
    [4, onExpoWeb(backToList)],
  ]),
});
