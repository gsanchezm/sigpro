import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  delayDetail,
  failDetail,
  notSeenCheck,
  prepFailed,
  prepFailedText,
  runSteps,
  seen,
  seenCheck,
  type SnapshotSpec,
  type StepFailure,
  watchLoading,
} from '../web/common';
import {
  articleOf,
  backButton,
  DETAIL_TITLE,
  DIRECT_APPROXIMATION,
  errorOf,
  heading1,
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

/** Lo que se lee en cada instantánea de la carga (móvil): «Cargando…» y los datos de la ficha que no deben verse mientras carga. */
const SNAPSHOT: SnapshotSpec = {
  loadingTestId: MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_LOADING,
  articleTestId: DETALLE_TESTIDS.PROGRAM_DETAIL,
  code: 'PRG-001',
  dataTestIds: [
    DETALLE_TESTIDS.PROGRAM_DETAIL,
    DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE,
    DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS,
    MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_OWNER,
    MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DATES,
    MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET,
    MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DESCRIPTION,
  ],
  dataTexts: [NAME],
};

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
  // Referencia de tiempo: el goto (la demora ya está fijada en la ruta)
  const since = performance.now();
  const went = await runSteps([['abrir /programs/PRG-001', () => page.goto(DETAIL, { timeout: CEILING_MS })]]);
  if (went) return actionMissing(expected, went);

  // Una lectura atómica del DOM por iteración: «Cargando…», su texto y los datos del programa en el MISMO instante. Fuga real = «Cargando…»
  // y datos a la vez. El código NO es un dato de esta comprobación: el subtítulo de la pantalla muestra el código pedido mientras carga
  // (ProgramDetailScreen.tsx:46) y la regla móvil solo prohíbe el nombre; se anota en la evidencia (codigoFueraDeLaFicha).
  const watch = await watchLoading(page, SNAPSHOT, since);
  const name = heading1(page, NAME);
  const arrived = await seenCheck(name, `al llegar la respuesta ve el nombre ${NAME}`, `el nombre ${NAME}`);
  const loadingText = watch.withIndicator?.loadingText;
  const leakNote =
    watch.leak === undefined ? 'en ninguna instantánea con «Cargando…» se ve el nombre ni un dato del programa' : `en la instantánea de ${watch.leak.atMs} ms, con «Cargando…», se ven: ${watch.leak.present.join(', ')}`;
  return conclude(
    [
      check(
        watch.withIndicator !== undefined && loadingText === 'Cargando…',
        'mientras espera ve «Cargando…»',
        watch.withIndicator ? `ve «${loadingText ?? '(sin leer)'}» a los ${watch.withIndicator.atMs} ms` : 'no ve «Cargando…»',
      ),
      check(watch.leak === undefined, 'mientras espera no ve el nombre del programa ni sus datos', leakNote),
      arrived,
    ],
    {
      note: DIRECT_APPROXIMATION,
      evidence: {
        demoraFijadaMs: ms,
        instantaneas: watch.snapshots,
        primeraConIndicador: watch.withIndicator,
        primeraSinIndicador: watch.withoutIndicator,
        codigoFueraDeLaFicha: watch.withIndicator?.codeOutsideArticle ?? '(sin indicador)',
        nota: 'El código fuera de la ficha es el subtítulo de la pantalla (pedido por la URL); no es un dato del programa para esta fila.',
      },
    },
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

/**
 * Llega a la ficha desde el origen de la fila. La pantalla de origen (la lista o la búsqueda global) se abre por su dirección, con carga
 * completa y la sesión guardada (`goto`); desde ella la ficha se abre con navegación de la propia app (tocar la tarjeta o el resultado),
 * así que «volver» tiene historial que recorrer.
 */
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
