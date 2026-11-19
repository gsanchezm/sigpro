import type { Page } from '@playwright/test';
import { DEMO } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { CASO, GESTOR, PROGRAM_CODE, REQUISITO, TENANT_A, resetAlumno01, sameList, uncoveredRequirements } from '../api/common';
import {
  READ_MS,
  TRACE_500,
  actionFailed,
  alertOf,
  cellOf,
  cellState,
  concluirWeb,
  coverageSettles,
  delayMatrix,
  emptyBlockOf,
  failMatrix,
  headerCodesOnScreen,
  headerLink,
  interact,
  labeledRows,
  legendEntries,
  legendLabelFor,
  linesOf,
  loadingOf,
  matrixPanel,
  matrixTable,
  onWeb,
  openMatrix,
  rawTextOf,
  rowCodesOnScreen,
  retryButton,
  settledMatrix,
  signIn,
  textCheck,
  textOf,
  within,
  type DelayControl,
} from './common';

// US-REQ-TRAZA-005 — Leer la matriz de trazabilidad del programa (web, 1440 px). Cada fila reinicia alumno01 por la API, inicia sesión
// el gestor por el formulario y abre la pestaña «Matriz de trazabilidad». Las cifras, las etiquetas y los símbolos se leen de la pantalla
// y se comparan con lo que la API dice (los requisitos sin caso). La espera y el fallo de la respuesta los fabrica la prueba (la historia
// los da como dato) y se apagan antes de «Reintentar».

const COVERAGE_PRG_002 = '13 de 14 requisitos con cobertura';
const EMPTY_BODY = 'Este programa no tiene requisitos o casos de prueba que cruzar.';
const HELP = 'Marca qué casos de prueba verifican cada requisito.';
const LEYENDA = ['✓ Superado', '✕ Fallido', '! Bloqueado', '· Sin ejecutar'];
/** Los casos sin ejecutar («·») no se pueden producir con el seed: cada caso tiene al menos una ejecución (historia 001, Reglas). */
const NOTA_SIN_EJECUTAR = 'La rama «·» (caso que nunca se ha ejecutado) no es reproducible con el seed: todos los casos tienen al menos una ejecución; esa rama no se ejercita aquí.';
/**
 * «El motivo que devuelve la API» se lee como la traza de la respuesta que muestra la app (método, ruta, estado y su texto) y el
 * identificador de traza que la API añade a cada error (all-exceptions.filter.ts:32; error-view.ts:42). El campo `message` del cuerpo
 * no aparece en la web: la historia no dice cuál de las dos cosas espera, así que la lectura es una interpretación.
 */
const NOTA_MOTIVO = '«El motivo que devuelve la API» se lee como la traza de la respuesta (método, ruta, estado y su texto) más el identificador de traza que añade la API (all-exceptions.filter.ts:32; error-view.ts:42); el campo message del cuerpo no se muestra en la web. Interpretación: la historia no dice cuál de los dos espera.';

/** Cifras de cobertura de la historia (texto exacto de la leyenda). */
const COBERTURA: ReadonlyMap<string, string> = new Map<string, string>([
  ['13 de 14 requisitos con cobertura', '13 de 14 requisitos con cobertura'],
  ['11 de 12 requisitos con cobertura', '11 de 12 requisitos con cobertura'],
]);

/** Símbolo de la historia (el que pinta la casilla) y el texto de la leyenda que lo acompaña. */
const SIMBOLO: ReadonlyMap<string, string> = new Map<string, string>([
  ['✓', '✓'],
  ['✕', '✕'],
  ['!', '!'],
]);
const RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['Superado', 'Superado'],
  ['Fallido', 'Fallido'],
  ['Bloqueado', 'Bloqueado'],
]);

/** Ruta a la que lleva la cabecera de cada caso. */
const RUTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['/verification/TC-012', '/verification/TC-012'],
  ['/verification/TC-016', '/verification/TC-016'],
]);

/** Espera de la respuesta («1 segundo», «3 segundos»), en milisegundos. */
const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Fallo que provoca la prueba en la respuesta de la matriz. */
const FALLO: ReadonlyMap<string, 'responda 500' | 'no obtenga respuesta'> = new Map<string, 'responda 500' | 'no obtenga respuesta'>([
  ['responda 500', 'responda 500'],
  ['no obtenga respuesta', 'no obtenga respuesta'],
]);

/** Aviso de la historia tras el fallo: el motivo que devuelve la API (la traza de la respuesta) o el texto de red entre comillas. */
type Warning = { readonly kind: 'traza' } | { readonly kind: 'texto'; readonly text: string };
const AVISO: ReadonlyMap<string, Warning> = new Map<string, Warning>([
  ['el motivo que devuelve la API', { kind: 'traza' }],
  ['el texto «No se pudo contactar con el servidor»', { kind: 'texto', text: 'No se pudo contactar con el servidor' }],
]);

/** Reinicio por la API, inicio de sesión del gestor por el formulario y pestaña de la matriz. Devuelve el fallo de preparación, si lo hay. */
const openAsGestor = async (page: Page, program: string, expected: string): Promise<Outcome | undefined> => {
  await resetAlumno01();
  const failure = (await signIn(page, DEMO.gestor)) ?? (await openMatrix(page, program));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!(await settledMatrix(page))) return preparationFailedWeb(expected, 'la matriz no se asienta (ni tabla, ni estado vacío, ni aviso)');
  return undefined;
};

const isSorted = (codes: readonly string[]): boolean => codes.every((code, index) => index === 0 || (codes[index - 1] ?? '') <= code);
const sortedCopy = (codes: readonly string[]): readonly string[] => [...codes].sort();

/** E1: la cifra de cobertura, los requisitos sin caso (los de la API, y solo esos), el orden, la ayuda y la leyenda. */
const coverageFigure: BrowserRowHandler = onWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const uncovered = strict('sin_cobertura', REQUISITO, cell(row, 'sin_cobertura'));
  const prepared = await openAsGestor(page, program, `ve el texto «${coverage}»; la fila de ${uncovered} muestra la etiqueta «Sin cobertura»`);
  if (prepared !== undefined) return prepared;
  const apiUncovered = await uncoveredRequirements(GESTOR, program);
  const shownCoverage = await coverageSettles(page, coverage);
  // Las etiquetas se comparan con los requisitos sin caso que dice la API: una fila de más o de menos no pasa
  await waitUntil(async () => {
    const labeled = await labeledRows(page);
    return labeled !== undefined && apiUncovered !== undefined && sameList(sortedCopy(labeled), sortedCopy(apiUncovered));
  });
  const labeled = await labeledRows(page);
  const rows = await rowCodesOnScreen(page);
  const headers = await headerCodesOnScreen(page);
  const helpVisible = await safe(() => matrixPanel(page).getByText(HELP, { exact: true }).isVisible(), undefined);
  const legend = (await legendEntries(page))?.map((entry) => `${entry.glyph} ${entry.label}`);
  return concluirWeb([
    textCheck(shownCoverage, coverage, 've el texto'),
    check(labeled?.includes(uncovered) === true, `la fila de ${uncovered} muestra la etiqueta «Sin cobertura»`, labeled === undefined ? 'las etiquetas no se leen' : labeled.includes(uncovered) ? 'muestra la etiqueta «Sin cobertura»' : 'no muestra la etiqueta «Sin cobertura»'),
    check(
      labeled !== undefined && apiUncovered !== undefined && sameList(sortedCopy(labeled), sortedCopy(apiUncovered)),
      'solo los requisitos sin caso (según la API) muestran «Sin cobertura»',
      `en pantalla: ${labeled?.join(', ') ?? '(sin leer)'}; según la API: ${apiUncovered?.join(', ') ?? '(sin leer)'}`,
    ),
    check(rows !== undefined && isSorted(rows), 'las filas van en orden de código', `filas: ${rows?.join(', ') ?? '(sin leer)'}`),
    check(headers !== undefined && isSorted(headers), 'las columnas van en orden de código', `columnas: ${headers?.join(', ') ?? '(sin leer)'}`),
    check(helpVisible === true, `se ve el texto «${HELP}»`, helpVisible === undefined ? '(sin leer)' : helpVisible ? `se ve el texto «${HELP}»` : `no se ve «${HELP}»`),
    check(legend !== undefined && sameList(legend, LEYENDA), `la leyenda tiene los cuatro símbolos (${LEYENDA.join(', ')})`, `la leyenda tiene: ${legend?.join(', ') ?? '(sin leer)'}`),
  ]);
});

/** E2: cada cruce enlazado muestra el símbolo de la última ejecución del caso, y la leyenda dice qué significa. */
const symbolOfLastRun: BrowserRowHandler = onWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const symbol = strict('simbolo', SIMBOLO, cell(row, 'simbolo'));
  const meaning = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const prepared = await openAsGestor(page, 'PRG-002', `el cruce de ${requirement} con ${testCase} muestra ${symbol}, que en la leyenda significa «${meaning}»`);
  if (prepared !== undefined) return prepared;
  const state = await cellState(cellOf(page, requirement, testCase));
  const label = state.symbol === undefined ? undefined : await legendLabelFor(page, state.symbol);
  return concluirWeb(
    [
      check(state.symbol === symbol, `el cruce muestra ${symbol}`, `el cruce muestra ${state.symbol ?? '(sin leer)'}`),
      check(label === meaning, `la leyenda de ese símbolo dice «${meaning}»`, `la leyenda de ese símbolo dice «${label ?? '(sin leer)'}»`),
    ],
    { note: NOTA_SIN_EJECUTAR, evidence: { simboloVisto: state.symbol } },
  );
});

/** E3: un cruce sin enlace queda sin marcar y no muestra ningún símbolo. */
const unlinkedCell: BrowserRowHandler = onWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const prepared = await openAsGestor(page, program, `el cruce de ${requirement} con ${testCase} está sin marcar y no muestra ningún símbolo`);
  if (prepared !== undefined) return prepared;
  const state = await cellState(cellOf(page, requirement, testCase));
  return concluirWeb([
    check(state.checked === false, 'el cruce está sin marcar', `el cruce está ${state.checked === undefined ? '(sin leer)' : state.checked ? 'marcado' : 'sin marcar'}`),
    check(state.symbol === '(sin símbolo)', 'no muestra ningún símbolo', `muestra ${state.symbol ?? '(sin leer)'}`),
  ]);
});

/** E4: el código de cada caso en la cabecera de la matriz lleva a su ficha de verificación. */
const headerLinkRoute: BrowserRowHandler = onWeb(async (row, { page }) => {
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const route = strict('ruta', RUTA, cell(row, 'ruta'));
  const expected = `pulsar el código ${testCase} de la cabecera lleva a ${route}`;
  const prepared = await openAsGestor(page, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const pressed = await interact(headerLink(page, testCase), `pulsar el código ${testCase} de la cabecera`, (element) => element.click(ACTION));
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const arrived = await within(async () => pathOf(page) === route);
  const path = pathOf(page);
  return concluirWeb([check(arrived && path === route, `llega a ${route}`, `llega a ${path}`)]);
});

/** E5: un programa sin requisitos ni casos muestra el título y el texto del estado vacío, y ninguna tabla. */
const emptyProgram: BrowserRowHandler = onWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const prepared = await openAsGestor(page, program, `ve el título «Matriz de trazabilidad» y el texto «${EMPTY_BODY}»; no ve ninguna tabla de la matriz`);
  if (prepared !== undefined) return prepared;
  const shown = await within(() => safe(() => emptyBlockOf(page).isVisible(), false));
  const lines = linesOf(await rawTextOf(emptyBlockOf(page)));
  const tables = await safe(() => matrixTable(page).count(), -1);
  return concluirWeb([
    check(shown, 'se ve el estado vacío', shown ? 'se ve el estado vacío' : 'no se ve el estado vacío'),
    check(lines[0] === 'Matriz de trazabilidad', 've el título «Matriz de trazabilidad»', `ve el título «${lines[0] ?? '(sin leer)'}»`),
    check(lines[1] === EMPTY_BODY, `ve el texto «${EMPTY_BODY}»`, `ve el texto «${lines[1] ?? '(sin leer)'}»`),
    check(tables === 0, 'no ve ninguna tabla de la matriz', tables === -1 ? 'no se pudo contar la tabla' : `hay ${tables} tablas de la matriz`),
  ]);
});

/**
 * E6: mientras llegan los datos se ve un indicador de carga y no la tabla. La respuesta se retrasa; el indicador y la tabla se leen en
 * la misma espera, mientras el control indica que la respuesta aún no se ha liberado.
 */
const loadingWhileWaiting: BrowserRowHandler = onWeb(async (row, { page }) => {
  const delay = strict('espera', ESPERA, cell(row, 'espera'));
  const expected = `mientras llega la respuesta ve un indicador de carga y no ve la tabla; al llegar ve «${COVERAGE_PRG_002}»`;
  await resetAlumno01();
  const failure = await signIn(page, DEMO.gestor);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const control: DelayControl = { released: false };
  await delayMatrix(page, 'PRG-002', delay, control);
  const opened = await openMatrix(page, 'PRG-002');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const seen: { current?: { readonly busy: string; readonly tableVisible: boolean | undefined } } = {};
  await within(async () => {
    if (control.released) return false;
    const loader = loadingOf(page).first();
    const visible = await safe(() => loader.isVisible(), false);
    if (!visible || control.released) return false;
    const busy = await safe(async () => (await loader.getAttribute('aria-busy', { timeout: READ_MS })) ?? '', '');
    const tableVisible = await safe<boolean | undefined>(() => matrixTable(page).isVisible(), undefined);
    if (control.released) return false;
    seen.current = { busy, tableVisible };
    return true;
  }, delay);
  const shownCoverage = await coverageSettles(page, COVERAGE_PRG_002);
  return concluirWeb(
    [
      check(seen.current !== undefined, 've un indicador de carga mientras llega la respuesta', seen.current !== undefined ? 've un indicador de carga' : 'no se vio el indicador antes de liberar la respuesta'),
      check(seen.current?.busy === 'true', 'el indicador tiene aria-busy «true»', `aria-busy «${seen.current?.busy ?? '(sin leer)'}»`),
      check(seen.current?.tableVisible === false, 'no ve la tabla de la matriz mientras espera', seen.current?.tableVisible === true ? 've la tabla mientras espera' : seen.current?.tableVisible === undefined ? 'la tabla no se lee' : 'no ve la tabla'),
      textCheck(shownCoverage, COVERAGE_PRG_002, 'al llegar la respuesta ve el texto'),
    ],
    { evidence: { esperaMs: delay, cargadorLeidoAntesDeLiberar: seen.current !== undefined } },
  );
});

/**
 * E7: un fallo al pedir la matriz muestra el aviso y «Reintentar»; con la respuesta correcta, al pulsarlo la matriz se pide y se muestra.
 * El fallo se apaga justo antes de pulsar «Reintentar».
 */
const failureAndRetry: BrowserRowHandler = onWeb(async (row, { page }) => {
  const kind = strict('fallo', FALLO, cell(row, 'fallo'));
  const warning = strict('aviso', AVISO, cell(row, 'aviso'));
  const expected = `ve un aviso de error con ${cell(row, 'aviso')} y el botón «Reintentar»; con la respuesta correcta ve «${COVERAGE_PRG_002}»`;
  await resetAlumno01();
  const failure = await signIn(page, DEMO.gestor);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const failing = { on: true };
  await failMatrix(page, 'PRG-002', kind, failing);
  const opened = await openMatrix(page, 'PRG-002');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const alertShown = await within(() => safe(() => alertOf(page).isVisible(), false));
  const retryShown = await within(() => safe(() => retryButton(page).isVisible(), false));
  const alertText = (await textOf(alertOf(page))) ?? '(sin leer)';
  const warningCheck =
    warning.kind === 'traza'
      ? check(alertText.startsWith(TRACE_500), `el aviso muestra el motivo de la API: «${TRACE_500}» (con su identificador de traza)`, `el aviso dice «${alertText}»`)
      : check(alertText.includes(warning.text), `el aviso muestra «${warning.text}»`, `el aviso dice «${alertText}»`);
  failing.on = false;
  const retried = await interact(retryButton(page), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (retried !== undefined) return actionFailed(expected, retried);
  const shown = await coverageSettles(page, COVERAGE_PRG_002);
  return concluirWeb(
    [
      check(alertShown, 've un aviso de error', alertShown ? 've un aviso de error' : 'no aparece el aviso de error'),
      check(retryShown, 've el botón «Reintentar»', retryShown ? 've el botón «Reintentar»' : 'no aparece el botón «Reintentar»'),
      warningCheck,
      textCheck(shown, COVERAGE_PRG_002, 'al pulsar «Reintentar» ve el texto'),
    ],
    {
      note: warning.kind === 'traza' ? NOTA_MOTIVO : `La app muestra la traza de la petición fallida («GET … → network error»), no el texto «No se pudo contactar con el servidor»: el cliente lanza un ApiError con esa traza (packages/shared/src/client.ts:148) y formatTrace la devuelve no vacía (packages/shared/src/error-view.ts:40-43), así que el texto de respaldo nunca se muestra.`,
      evidence: { avisoLeido: alertText, petición: kind },
    },
  );
});

defineBrowserRows({
  story: 'US-REQ-TRAZA-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, coverageFigure],
    [2, symbolOfLastRun],
    [3, unlinkedCell],
    [4, headerLinkRoute],
    [5, emptyProgram],
    [6, loadingWhileWaiting],
    [7, failureAndRetry],
  ]),
});
