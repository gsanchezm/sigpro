import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { DETALLE_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  articleOf,
  backLink,
  DESKTOP_WIDTH,
  delayDetail,
  ERROR_TITLE,
  failDetail,
  LOADING_XPATH,
  NOT_FOUND_TITLE,
  notSeenCheck,
  onWeb,
  openPath,
  prepFailed,
  prepFailedText,
  runSteps,
  seenCheck,
  signIn,
  type SnapshotSpec,
  watchLoading,
} from './common';

// US-PROG-DETALLE-003 — Carga, aviso de no encontrado, error de la ficha y volver a Programas (web). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; gestor@sigpro.test entra desde /login?tenant=alumno01 en un navegador sin sesión y llega a
// /programs. La demora y los fallos de GET /api/programs/PRG-001 los provoca la prueba DESPUÉS de entrar y ANTES de abrir la ficha.

const NAME = 'Sistema de mando táctico Ártemis';
const NAME_HEADING = { level: 1, name: NAME, exact: true } as const;

/** Lo que se lee en cada instantánea de la carga (web): el indicador, y los datos de la ficha que no deben verse mientras carga. */
const SNAPSHOT: SnapshotSpec = {
  loadingXPath: LOADING_XPATH,
  articleTestId: DETALLE_TESTIDS.PROGRAM_DETAIL,
  code: 'PRG-001',
  dataTestIds: [DETALLE_TESTIDS.PROGRAM_DETAIL, DETALLE_TESTIDS.PROGRAM_DETAIL_STATE_BADGE, DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS, DETALLE_TESTIDS.PROGRAM_DETAIL_TABS],
  dataTexts: [NAME, 'Marta Ruiz'],
};

// --- Esquema 1: la ficha muestra la carga hasta que llega el programa -----------------------------------------------------------------------

const WAIT: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const loadingUntilArrival: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = strict('espera', WAIT, cell(row, 'espera'));
  const expected = `mientras espera ve el indicador de carga y no ve el nombre ${NAME}; al llegar la respuesta ve el nombre ${NAME}`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  await delayDetail(page, 'PRG-001', ms);
  // Referencia de tiempo: el goto. La demora ya está fijada en la ruta.
  const since = performance.now();
  const went = await runSteps([['abrir /programs/PRG-001', () => page.goto('/programs/PRG-001', { timeout: CEILING_MS })]]);
  if (went) return actionMissing(expected, went);

  // Una lectura atómica del DOM por iteración: indicador, texto y datos en el MISMO instante. Fuga real = indicador y datos en la misma
  // instantánea. Una instantánea sin indicador (tras haberlo visto) es el fin de la espera, no una fuga.
  const watch = await watchLoading(page, SNAPSHOT, since);
  const name = page.getByRole('heading', NAME_HEADING);
  const arrived = await seenCheck(name, `al llegar la respuesta ve el nombre ${NAME}`, `el nombre ${NAME}`);
  const leakNote = watch.leak === undefined ? 'en ninguna instantánea con indicador se ve un dato de la ficha' : `en la instantánea de ${watch.leak.atMs} ms, con indicador, se ven: ${watch.leak.present.join(', ')}`;
  return conclude(
    [
      check(watch.withIndicator !== undefined, 'mientras espera ve el indicador de carga', watch.withIndicator ? `ve el indicador a los ${watch.withIndicator.atMs} ms` : 'no ve el indicador de carga'),
      check(watch.leak === undefined, 'mientras espera no ve el código, el nombre ni otro dato de la ficha', leakNote),
      arrived,
    ],
    {
      evidence: {
        demoraFijadaMs: ms,
        instantaneas: watch.snapshots,
        primeraConIndicador: watch.withIndicator,
        primeraSinIndicador: watch.withoutIndicator,
        codigoFueraDeLaFicha: watch.withIndicator?.codeOutsideArticle ?? '(sin indicador)',
        nota: 'El código fuera de la ficha son las migas de la cabecera de la app (AppShell, nav.ts breadcrumbsFor): no es un dato de la ficha.',
      },
    },
  );
};

// --- Esquema 2: un código que no es un programa del tenant muestra el aviso de no encontrado -----------------------------------------------

const NOT_A_PROGRAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-000', 'PRG-000'],
  ['PRG-025', 'PRG-025'],
  ['REQ-001', 'REQ-001'],
]);

const notFound: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', NOT_A_PROGRAM, cell(row, 'codigo'));
  const expected = `ve el título «${NOT_FOUND_TITLE}», no ve datos de ningún programa y ve el enlace «Volver a Programas»`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, `/programs/${code}`);
  if (opened) return actionMissing(expected, opened);
  return conclude([
    await seenCheck(page.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE, exact: true }), `el título «${NOT_FOUND_TITLE}»`, `el título «${NOT_FOUND_TITLE}»`),
    await notSeenCheck(articleOf(page), 'no ve datos de ningún programa', 'los datos del programa'),
    await seenCheck(backLink(page), 'el enlace «Volver a Programas»', 'el enlace «Volver a Programas»'),
  ]);
};

// --- Esquema 3: un fallo del servidor muestra el aviso de error -----------------------------------------------------------------------------

const FAILURE: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const serverFailure: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', FAILURE, cell(row, 'codigo_http'));
  const expected = `ve el título «${ERROR_TITLE}», no ve datos del programa y ve el enlace «Volver a Programas»`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  await failDetail(page, 'PRG-001', status, 'always');
  const opened = await openPath(page, '/programs/PRG-001');
  if (opened) return actionMissing(expected, opened);
  return conclude([
    await seenCheck(page.getByRole('heading', { level: 1, name: ERROR_TITLE, exact: true }), `el título «${ERROR_TITLE}»`, `el título «${ERROR_TITLE}»`),
    await notSeenCheck(articleOf(page), 'no ve datos del programa', 'los datos del programa'),
    await seenCheck(backLink(page), 'el enlace «Volver a Programas»', 'el enlace «Volver a Programas»'),
  ]);
};

// --- Esquema 4: el enlace Volver a Programas lleva a la lista ---------------------------------------------------------------------------------

interface DetailSource {
  readonly path: string;
  /** Qué debe mostrar la ficha antes de pulsar el enlace (la preparación de la fila). */
  readonly shows: 'no-encontrado' | 'datos';
}
const DETAIL_SOURCES: ReadonlyMap<string, DetailSource> = new Map<string, DetailSource>([
  ['/programs/PRG-025, que muestra «No se encontró el programa»', { path: '/programs/PRG-025', shows: 'no-encontrado' }],
  ['/programs/PRG-001, que muestra sus datos', { path: '/programs/PRG-001', shows: 'datos' }],
]);

const backToList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ficha = strict('ficha', DETAIL_SOURCES, cell(row, 'ficha'));
  const expected = 'llega a /programs';
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, ficha.path);
  if (opened) return actionMissing(expected, opened);
  const shown = ficha.shows === 'datos' ? await seenCheck(page.getByRole('heading', NAME_HEADING), NAME, NAME) : await seenCheck(page.getByRole('heading', { level: 1, name: NOT_FOUND_TITLE, exact: true }), NOT_FOUND_TITLE, NOT_FOUND_TITLE);
  if (!shown.ok) return prepFailedText(expected, `la ficha no muestra lo que describe la fila (${shown.observed})`);
  const clicked = await runSteps([['pulsar «Volver a Programas»', () => backLink(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  return conclude([check(arrived.reached, 'llega a /programs', `llega a ${pathOf(page)}`)]);
};

defineBrowserRows({
  story: 'US-PROG-DETALLE-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(loadingUntilArrival)],
    [2, onWeb(notFound)],
    [3, onWeb(serverFailure)],
    [4, onWeb(backToList)],
  ]),
});
