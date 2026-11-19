import type { Page } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { HOLD_MS, holdsFor, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  CASO,
  GESTOR,
  PROGRAM_CODE,
  REQUISITO,
  TENANT_A,
  pairCountSettles,
  resetAlumno01,
  sameList,
  signIn as apiSignIn,
  uncoveredRequirements,
  type Account,
} from '../api/common';
import {
  TRACE_500,
  ULTIMO_SIMBOLO_DEL_CASO,
  armToasts,
  coverageSettles,
  delayLinkRequests,
  failMatrix,
  interact,
  labeledRows,
  linesOf,
  rawTextOf,
  textOf,
  toastShown,
  toastStartingWith,
  toastVisible,
  within,
  type DelayControl,
} from '../web/common';
import {
  MOBILE_ACCOUNTS,
  cellOf,
  emptyOf,
  errorOf,
  exactText,
  hintOf,
  matrixTable,
  mobileCellState,
  mobileWord,
  onExpoWeb,
  openMatrixMobile,
  outcomeOf,
  reasonOf,
  retryOf,
  settledMatrixMobile,
  signIn,
  tapCell,
  visibleTextOf,
} from './common';

// US-REQ-TRAZA-007 — Leer, marcar y desmarcar cruces en la matriz de trazabilidad (app móvil, Expo web a 390 px). Mismas reglas que la web:
// cada toque se confirma por la API (GET de la matriz, con sondeo de hasta 5 s) y el enlace se retrasa para ver qué se pinta antes de la
// respuesta. El veredicto vale para Expo web, no para iOS ni Android nativo.

/** Retraso del enlace o desenlace: la historia no fija tiempo; la prueba lo fija para observar el cambio optimista. */
const DELAY_MS = 1_500;

const ESTADO: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['sin marcar', false],
  ['marcado', true],
]);

/** Cifras de cobertura: sin comillas (E1) y entre «…» (E2, donde la historia las escribe así). */
const COBERTURA: ReadonlyMap<string, string> = new Map<string, string>([
  ['13 de 14 requisitos con cobertura', '13 de 14 requisitos con cobertura'],
  ['«14 de 14 requisitos con cobertura»', '14 de 14 requisitos con cobertura'],
  ['«12 de 14 requisitos con cobertura»', '12 de 14 requisitos con cobertura'],
]);

/** Aviso emergente tras el toque (título del aviso). */
const AVISO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Enlace creado»', 'Enlace creado'],
  ['«Enlace eliminado»', 'Enlace eliminado'],
]);

const FALLO: ReadonlyMap<string, 'responda 500' | 'no obtenga respuesta'> = new Map<string, 'responda 500' | 'no obtenga respuesta'>([
  ['responda 500', 'responda 500'],
  ['no obtenga respuesta', 'no obtenga respuesta'],
]);

/** Línea que la historia da tras el fallo: el motivo que devuelve la API (la traza de la respuesta) o el texto de red entre comillas. */
type Line = { readonly kind: 'traza' } | { readonly kind: 'texto'; readonly text: string };
const LINEA: ReadonlyMap<string, Line> = new Map<string, Line>([
  ['el motivo que devuelve la API', { kind: 'traza' }],
  ['el texto «No se pudo contactar con el servidor»', { kind: 'texto', text: 'No se pudo contactar con el servidor' }],
]);

const TITULO_FALLO = 'No se pudieron cargar los requisitos';
const TEXTO_VACIO = 'Este programa no tiene requisitos o casos de prueba que cruzar.';
const PISTA = 'Desliza a los lados para ver todos los casos de prueba.';
const SIN_PERMISO = 'Tu rol no permite editar requisitos';
const ERROR_GENERICO = 'Ha ocurrido un error inesperado';
const CUBIERTOS_13 = '13 de 14 requisitos con cobertura';
/**
 * Borrar REQ-022 arrastra a su hijo REQ-023 (requirements.service.ts:175-184): la matriz del servidor cambia, pero la de la pantalla no se
 * recarga y la historia no fija la cifra tras el rechazo. La vuelta atrás se comprueba con la casilla.
 */
const NOTA_CASCADA = 'Borrar REQ-022 arrastra a su hijo REQ-023 (requirements.service.ts:175-184); la pantalla no se recarga, así que la vuelta atrás se comprueba con la casilla y no con una cifra.';
/**
 * «El motivo que devuelve la API» se lee como la traza de la respuesta que muestra la app (método, ruta, estado y su texto) más el
 * identificador de traza que añade la API (all-exceptions.filter.ts:32; error-view.ts:42); el campo message del cuerpo no se muestra.
 */
const NOTA_MOTIVO = '«El motivo que devuelve la API» se lee como la traza de la respuesta (método, ruta, estado y su texto) más el identificador de traza que añade la API (all-exceptions.filter.ts:32; error-view.ts:42); el campo message del cuerpo no se muestra. Interpretación: la historia no dice cuál de los dos espera.';

const pairText = (requirement: string, testCase: string): string => `${requirement} ↔ ${testCase}`;
const sortedCopy = (codes: readonly string[]): readonly string[] => [...codes].sort();

/** Cuenta de la pantalla móvil por su correo (la historia la nombra en cada fila). */
const accountNamed = (email: string): { readonly credentials: { readonly email: string; readonly password: string }; readonly api: Account } => {
  const found = MOBILE_ACCOUNTS.get(email);
  if (found === undefined) throw new Error(`la cuenta ${email} no está en el mapa de cuentas móviles`);
  return found;
};

/** Preparación común: reinicio, inicio de sesión de la cuenta en el móvil y vista «Matriz de trazabilidad» asentada. */
const prepareMatrix = async (page: Page, email: string, program: string, expected: string): Promise<Outcome | undefined> => {
  await resetAlumno01();
  const failure = (await signIn(page, accountNamed(email).credentials)) ?? (await openMatrixMobile(page, program));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!(await settledMatrixMobile(page))) return preparationFailedWeb(expected, 'la matriz no se asienta (ni tabla, ni estado vacío, ni error)');
  return undefined;
};

/** Espera (con techo) a que las etiquetas «Sin cobertura» de la pantalla sean las que da la API. */
const labelsSettle = (page: Page, expected: readonly string[] | undefined): Promise<unknown> =>
  waitUntil(async () => {
    const labeled = await labeledRows(page);
    return labeled !== undefined && expected !== undefined && sameList(sortedCopy(labeled), sortedCopy(expected));
  });

/** E1: la cifra de cobertura, la pista de desplazamiento y los requisitos sin caso (los de la API, y solo esos). */
const coverageAndLabels: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const uncovered = strict('sin_cobertura', REQUISITO, cell(row, 'sin_cobertura'));
  const expected = `ve «${cell(row, 'cobertura')}», ve «${PISTA}» y la fila de ${uncovered} muestra «Sin cobertura»`;
  const prepared = await prepareMatrix(page, 'gestor@sigpro.test', program, expected);
  if (prepared !== undefined) return prepared;
  const apiUncovered = await uncoveredRequirements(GESTOR, program);
  const shown = await coverageSettles(page, coverage);
  await labelsSettle(page, apiUncovered);
  const labeled = await labeledRows(page);
  const hint = await visibleTextOf(hintOf(page));
  return outcomeOf(
    [
      exactText(shown, coverage, 've el texto'),
      exactText(hint, PISTA, 've el texto'),
      check(labeled?.includes(uncovered) === true, `la fila de ${uncovered} muestra la etiqueta «Sin cobertura»`, labeled === undefined ? 'las etiquetas no se leen' : labeled.includes(uncovered) ? 'muestra la etiqueta «Sin cobertura»' : 'no muestra la etiqueta «Sin cobertura»'),
      check(
        labeled !== undefined && apiUncovered !== undefined && sameList(sortedCopy(labeled), sortedCopy(apiUncovered)),
        'solo los requisitos sin caso (según la API) muestran «Sin cobertura»',
        `en pantalla: ${labeled?.join(', ') ?? '(sin leer)'}; según la API: ${apiUncovered?.join(', ') ?? '(sin leer)'}`,
      ),
    ],
    undefined,
  );
});

/** E2: tocar un cruce lo enlaza o lo desenlaza: se ve el cambio antes de la respuesta, aviso, cifra, símbolo de la última ejecución y enlace confirmado por la API. */
const tapToggles: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const account = strict('cuenta', MOBILE_ACCOUNTS, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado_inicial', ESTADO, cell(row, 'estado_inicial'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const end = strict('estado_final', ESTADO, cell(row, 'estado_final'));
  const symbolWanted = strict('caso', ULTIMO_SIMBOLO_DEL_CASO, cell(row, 'caso'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} muestra ${cell(row, 'aviso')} con «${pairText(requirement, testCase)}», ve «${cell(row, 'cobertura')}» y el cruce queda ${cell(row, 'estado_final')}`;
  const prepared = await prepareMatrix(page, account.credentials.email, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado_inicial')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const control: DelayControl = { released: false };
  await delayLinkRequests(page, DELAY_MS, control);
  await armToasts(page);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, false);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  const early = { seen: false };
  await within(async () => {
    if (control.released) return true;
    if ((await mobileCellState(box)).checked === end) {
      early.seen = true;
      return true;
    }
    return false;
  }, DELAY_MS + 500);
  const toast = await toastShown(page, 'ok', aviso, pairText(requirement, testCase));
  const toastOnScreen = await toastVisible(page, 'ok', aviso);
  const after = await mobileCellState(box);
  const glyph = end ? await textOf(box) : undefined;
  const shown = await coverageSettles(page, coverage);
  const apiPair = await pairCountSettles(account.api, 'PRG-002', requirement, testCase, end ? 1 : 0);
  return outcomeOf(
    [
      check(early.seen, `antes de la respuesta del servidor el cruce ya se ve ${cell(row, 'estado_final')}`, early.seen ? `el cruce se vio ${cell(row, 'estado_final')} antes de la respuesta` : `el cruce no se vio ${cell(row, 'estado_final')} antes de la respuesta`),
      check(toast.seen, `ve el aviso ${cell(row, 'aviso')} con el texto «${pairText(requirement, testCase)}»`, `avisos: ${toast.observed}`),
      check(toastOnScreen === true, 'el aviso se ve en pantalla', toastOnScreen === undefined ? '(sin leer)' : toastOnScreen ? 'se ve' : 'no se ve'),
      exactText(shown, coverage, 've el texto'),
      check(after.checked === end, `el cruce queda ${cell(row, 'estado_final')}`, `el cruce queda ${mobileWord(after.checked) ?? '(sin leer)'}`),
      ...(end ? [check(glyph === symbolWanted, `el cruce marcado muestra el símbolo de su última ejecución (${symbolWanted})`, `el cruce muestra ${glyph ?? '(sin leer)'}`)] : []),
      check(apiPair.count === (end ? 1 : 0), 'la API confirma el enlace en la matriz', apiPair.count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${apiPair.count} vez(es) tras ${apiPair.waitedMs} ms`),
    ],
    undefined,
    { avisos: toast.observed, esperaApiMs: apiPair.waitedMs },
  );
});

/** E3: el auditor ve la matriz pero tocar un cruce no lo cambia: se explica con el texto visible «Tu rol no permite editar requisitos». */
const auditorTaps: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado', ESTADO, cell(row, 'estado'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} deja el cruce ${cell(row, 'estado')} y muestra el texto visible «${SIN_PERMISO}»`;
  const prepared = await prepareMatrix(page, 'auditor@sigpro.test', 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, true);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  const held = await holdsFor(async () => (await mobileCellState(box)).checked === start, HOLD_MS);
  const after = await mobileCellState(box);
  const reason = await visibleTextOf(reasonOf(page));
  const apiPair = await pairCountSettles(accountNamed('auditor@sigpro.test').api, 'PRG-002', requirement, testCase, start ? 1 : 0);
  return outcomeOf(
    [
      check(held.held && after.checked === start, `el cruce sigue ${cell(row, 'estado')} durante 2 s`, held.held ? `el cruce está ${mobileWord(after.checked) ?? '(sin leer)'} durante 2 s` : `el cruce cambió a los ${held.brokeAtMs ?? '?'} ms`),
      exactText(reason, SIN_PERMISO, 'se ve el texto'),
      check(apiPair.count === (start ? 1 : 0), 'la API confirma que el enlace no cambia', apiPair.count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${apiPair.count} vez(es) tras ${apiPair.waitedMs} ms`),
    ],
    undefined,
  );
});

/** E4: un programa sin requisitos ni casos muestra el título y el texto del estado vacío (visibles) y ninguna tabla. */
const emptyProgram: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const expected = `ve el título «Matriz de trazabilidad» y el texto «${TEXTO_VACIO}»; no ve ninguna tabla de la matriz`;
  const prepared = await prepareMatrix(page, 'gestor@sigpro.test', program, expected);
  if (prepared !== undefined) return prepared;
  const shown = await within(() => safe(() => emptyOf(page).isVisible(), false));
  const lines = linesOf(await rawTextOf(emptyOf(page)));
  const tables = await safe(() => matrixTable(page).count(), -1);
  return outcomeOf(
    [
      check(shown, 'se ve el estado vacío', shown ? 'se ve el estado vacío' : 'no se ve el estado vacío'),
      exactText(lines[0], 'Matriz de trazabilidad', 've el título'),
      exactText(lines[1], TEXTO_VACIO, 've el texto'),
      check(tables === 0, 'no ve ninguna tabla de la matriz', tables === -1 ? 'no se pudo contar la tabla' : `hay ${tables} tablas de la matriz`),
    ],
    undefined,
  );
});

/** E5: un fallo al pedir la matriz muestra el título de error y la línea de la historia; «Reintentar» (con la respuesta correcta) la muestra. */
const failureAndRetry: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const kind = strict('fallo', FALLO, cell(row, 'fallo'));
  const line = strict('linea', LINEA, cell(row, 'linea'));
  const expected = `ve el título «${TITULO_FALLO}» y ${cell(row, 'linea')}; al pulsar «Reintentar» con la respuesta correcta ve «${CUBIERTOS_13}»`;
  await resetAlumno01();
  const failure = await signIn(page, accountNamed('gestor@sigpro.test').credentials);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const failing = { on: true };
  await failMatrix(page, 'PRG-002', kind, failing);
  const opened = await openMatrixMobile(page, 'PRG-002');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const shown = await within(() => safe(() => errorOf(page).isVisible(), false));
  const lines = linesOf(await rawTextOf(errorOf(page)));
  const lineCheck: Check =
    line.kind === 'traza'
      ? check(lines[1]?.startsWith(TRACE_500) === true, `la línea es el motivo de la API: «${TRACE_500}» (con su identificador de traza)`, `la línea es «${lines[1] ?? '(sin leer)'}»`)
      : check(lines[1] === line.text, `la línea es «${line.text}»`, `la línea es «${lines[1] ?? '(sin leer)'}»`);
  failing.on = false;
  const retried = await interact(retryOf(page), 'pulsar «Reintentar»', (element) => element.click({ timeout: 10_000 }));
  if (retried !== undefined) return outcomeOf([check(false, expected, retried.message)], retried.note);
  const back = await coverageSettles(page, CUBIERTOS_13);
  return outcomeOf(
    [
      check(shown, 've el aviso de error', shown ? 've el aviso de error' : 'no aparece el aviso de error'),
      exactText(lines[0], TITULO_FALLO, 've el título'),
      lineCheck,
      exactText(back, CUBIERTOS_13, 'al pulsar «Reintentar» ve el texto'),
    ],
    line.kind === 'traza'
      ? NOTA_MOTIVO
      : 'La app muestra la traza de la petición fallida («GET … → network error»), no el texto «No se pudo contactar con el servidor»: el cliente lanza un ApiError con esa traza (packages/shared/src/client.ts:148) y la vista usa failureTrace (apps/mobile/src/features/requirements/view.ts:59), que la devuelve no vacía, así que el texto de respaldo nunca se muestra.',
    { avisoLeido: lines, petición: kind },
  );
});

/** E6: un cambio rechazado por el servidor (el gestor ha borrado el requisito por la API) deja el cruce como estaba y muestra el aviso de error. */
const rejectedTap: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado', ESTADO, cell(row, 'estado'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} muestra el aviso de error «${ERROR_GENERICO}» con la traza de la petición rechazada, y el cruce vuelve a ${cell(row, 'estado')}`;
  const prepared = await prepareMatrix(page, 'consultor@sigpro.test', 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const gestor = await apiSignIn(GESTOR);
  if (gestor.token === undefined) return preparationFailedWeb(expected, 'el gestor inicia sesión por la API para borrar el requisito');
  const deleted = await call('DELETE', `/requirements/${requirement}`, { tenant: TENANT_A, token: gestor.token });
  if (deleted.status !== 204) return preparationFailedWeb(`el gestor borra ${requirement} por la API (204)`, `DELETE respondió ${deleted.status}`);
  await armToasts(page);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, false);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  // Marcado → desmarcar es un DELETE; sin marcar → marcar es un PUT
  const prefix = `${start ? 'DELETE' : 'PUT'} /api/requirements/${requirement}/tests/${testCase} → 404 Not Found`;
  const toast = await toastStartingWith(page, 'danger', ERROR_GENERICO, prefix);
  const toastOnScreen = await toastVisible(page, 'danger', ERROR_GENERICO);
  const after = await mobileCellState(box);
  return outcomeOf(
    [
      check(toast.seen, `ve el aviso de error «${ERROR_GENERICO}» con la traza «${prefix}»`, `avisos: ${toast.observed}`),
      check(toastOnScreen === true, 'el aviso de error se ve en pantalla', toastOnScreen === undefined ? '(sin leer)' : toastOnScreen ? 'se ve' : 'no se ve'),
      check(after.checked === start, `el cruce vuelve a ${cell(row, 'estado')}`, `el cruce está ${mobileWord(after.checked) ?? '(sin leer)'}`),
    ],
    requirement === 'REQ-022' ? NOTA_CASCADA : undefined,
    { avisos: toast.observed },
  );
});

defineBrowserRows({
  story: 'US-REQ-TRAZA-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, coverageAndLabels],
    [2, tapToggles],
    [3, auditorTaps],
    [4, emptyProgram],
    [5, failureAndRetry],
    [6, rejectedTap],
  ]),
});
