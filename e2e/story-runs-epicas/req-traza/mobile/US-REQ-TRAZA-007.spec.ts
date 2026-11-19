import type { Page } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { CASO, GESTOR, PROGRAM_CODE, REQUISITO, TENANT_A, countPair, linksOf, resetAlumno01, signIn as apiSignIn, traceabilityOf, type Account } from '../api/common';
import { failMatrix, interact, rawTextOf, textOf, linesOf, toastShown } from '../web/common';
import { HOLD_MS, holdsFor } from '../../support/browser';
import {
  MOBILE_ACCOUNTS,
  cellOf,
  coverageText,
  emptyOf,
  errorOf,
  exactText,
  hintOf,
  mobileCellState,
  mobileWord,
  onExpoWeb,
  openMatrixMobile,
  outcomeOf,
  reasonOf,
  retryOf,
  rowOf,
  settledMatrixMobile,
  signIn,
  tapCell,
  within,
} from './common';

// US-REQ-TRAZA-007 — Leer, marcar y desmarcar cruces en la matriz de trazabilidad (app móvil, Expo web a 390 px). Mismas reglas que la web:
// cada toque se confirma por la API (GET de la matriz). El veredicto vale para Expo web, no para iOS ni Android nativo.

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

/** Aviso emergente tras el toque: «Enlace creado» o «Enlace eliminado» (título del aviso). */
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
const TRAZA_500 = 'GET /api/programs/PRG-002/traceability → 500 Internal Server Error';
const CUBIERTOS_13 = '13 de 14 requisitos con cobertura';
const SIN_PERMISO = 'Tu rol no permite editar requisitos';

/** Cuenta de la pantalla móvil por su correo (la historia la nombra en cada fila). */
const accountNamed = (email: string): { readonly credentials: { readonly email: string; readonly password: string }; readonly api: Account } => {
  const found = MOBILE_ACCOUNTS.get(email);
  if (found === undefined) throw new Error(`la cuenta ${email} no está en el mapa de cuentas móviles`);
  return found;
};

/** Cuántas veces está enlazado el par en PRG-002, leído por la API con la cuenta dada (`undefined` si la lectura falla). */
const linkCountByApi = async (account: Account, requirement: string, testCase: string): Promise<number | undefined> => {
  const signed = await apiSignIn(account);
  if (signed.token === undefined) return undefined;
  const read = await traceabilityOf('PRG-002', TENANT_A, signed.token);
  return read.status === 200 ? countPair(linksOf(read.body), requirement, testCase) : undefined;
};

/** Preparación común: reinicio por la API, inicio de sesión de la cuenta en el móvil y vista «Matriz de trazabilidad» asentada. */
const prepareMatrix = async (page: Page, email: string, program: string, expected: string): Promise<Outcome | undefined> => {
  await resetAlumno01();
  const failure = (await signIn(page, accountNamed(email).credentials)) ?? (await openMatrixMobile(page, program));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!(await settledMatrixMobile(page))) return preparationFailedWeb(expected, 'la matriz no se asienta (ni tabla, ni estado vacío, ni error)');
  return undefined;
};

/** E1: la cifra de cobertura, la pista de desplazamiento y la etiqueta «Sin cobertura» de la fila del requisito. */
const coverageAndLabel: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const uncovered = strict('sin_cobertura', REQUISITO, cell(row, 'sin_cobertura'));
  const expected = `ve «${cell(row, 'cobertura')}», ve «${PISTA}» y la fila de ${uncovered} muestra «Sin cobertura»`;
  const prepared = await prepareMatrix(page, 'gestor@sigpro.test', program, expected);
  if (prepared !== undefined) return prepared;
  const rowText = await textOf(rowOf(page, uncovered));
  const hint = await textOf(hintOf(page));
  return outcomeOf([
    exactText(await coverageText(page), coverage, 've el texto'),
    exactText(hint, PISTA, 've el texto'),
    check(rowText !== undefined && rowText.includes('Sin cobertura'), `la fila de ${uncovered} muestra la etiqueta «Sin cobertura»`, rowText === undefined ? 'la fila no se lee' : rowText.includes('Sin cobertura') ? 'muestra la etiqueta «Sin cobertura»' : 'no muestra la etiqueta «Sin cobertura»'),
  ], undefined);
});

/** E2: tocar un cruce lo enlaza o lo desenlaza: aviso con «REQ ↔ CASO», cifra al día, cruce en su estado final y el enlace confirmado por la API. */
const tapToggles: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const account = strict('cuenta', MOBILE_ACCOUNTS, cell(row, 'cuenta'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado_inicial', ESTADO, cell(row, 'estado_inicial'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const end = strict('estado_final', ESTADO, cell(row, 'estado_final'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} muestra ${cell(row, 'aviso')} con «${requirement} ↔ ${testCase}», ve «${cell(row, 'cobertura')}» y el cruce queda ${cell(row, 'estado_final')}`;
  const prepared = await prepareMatrix(page, account.credentials.email, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado_inicial')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, false);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  const toast = await toastShown(page, 'ok', aviso, `${requirement} ↔ ${testCase}`);
  const after = await mobileCellState(box);
  const count = await linkCountByApi(account.api, requirement, testCase);
  return outcomeOf(
    [
      check(toast.seen, `ve el aviso ${cell(row, 'aviso')} con el texto «${requirement} ↔ ${testCase}»`, `avisos: ${toast.observed}`),
      exactText(await coverageText(page), coverage, 've el texto'),
      check(after.checked === end, `el cruce queda ${cell(row, 'estado_final')}`, `el cruce queda ${mobileWord(after.checked) ?? '(sin leer)'}`),
      check(count === (end ? 1 : 0), 'la API confirma el enlace en la matriz', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    undefined,
    { avisos: toast.observed },
  );
});

/** E3: el auditor ve la matriz pero tocar un cruce no lo cambia: se explica con el texto visible «Tu rol no permite editar requisitos». */
const auditorTaps: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado', ESTADO, cell(row, 'estado'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} deja el cruce ${cell(row, 'estado')} y ve «${SIN_PERMISO}»`;
  const prepared = await prepareMatrix(page, 'auditor@sigpro.test', 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, true);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  const held = await holdsFor(async () => (await mobileCellState(box)).checked === start, HOLD_MS);
  const after = await mobileCellState(box);
  const reason = await textOf(reasonOf(page));
  const count = await linkCountByApi(accountNamed('auditor@sigpro.test').api, requirement, testCase);
  return outcomeOf(
    [
      check(held.held && after.checked === start, `el cruce sigue ${cell(row, 'estado')} durante 2 s`, held.held ? `el cruce está ${mobileWord(after.checked) ?? '(sin leer)'} durante 2 s` : `el cruce cambió a los ${held.brokeAtMs ?? '?'} ms`),
      exactText(reason, SIN_PERMISO, 've el texto'),
      check(count === (start ? 1 : 0), 'la API confirma que el enlace no cambia', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    undefined,
  );
});

/** E4: un programa sin requisitos ni casos muestra el título «Matriz de trazabilidad» y el texto del estado vacío. */
const emptyProgram: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const expected = `ve el título «Matriz de trazabilidad» y el texto «${TEXTO_VACIO}»`;
  const prepared = await prepareMatrix(page, 'gestor@sigpro.test', program, expected);
  if (prepared !== undefined) return prepared;
  const lines = linesOf(await rawTextOf(emptyOf(page)));
  return outcomeOf(
    [exactText(lines[0], 'Matriz de trazabilidad', 've el título'), exactText(lines[1], TEXTO_VACIO, 've el texto')],
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
  const shown = await within(() => errorOf(page).isVisible().catch(() => false));
  const lines = linesOf(await rawTextOf(errorOf(page)));
  const lineCheck: Check =
    line.kind === 'traza'
      ? check(lines[1] === TRAZA_500, `la línea es el motivo de la API: «${TRAZA_500}»`, `la línea es «${lines[1] ?? '(sin leer)'}»`)
      : check(lines[1] === line.text, `la línea es «${line.text}»`, `la línea es «${lines[1] ?? '(sin leer)'}»`);
  failing.on = false;
  const retried = await interact(retryOf(page), 'pulsar «Reintentar»', (element) => element.click({ timeout: 10_000 }));
  if (retried !== undefined) return outcomeOf([check(false, expected, retried.message)], retried.note);
  const back = await within(async () => (await coverageText(page)) === CUBIERTOS_13);
  return outcomeOf(
    [
      check(shown, 've el aviso de error', shown ? 've el aviso de error' : 'no aparece el aviso de error'),
      exactText(lines[0], TITULO_FALLO, 've el título'),
      lineCheck,
      check(back, `al pulsar «Reintentar» ve «${CUBIERTOS_13}»`, back ? `ve «${CUBIERTOS_13}»` : `ve «${(await coverageText(page)) ?? '(sin leer)'}»`),
    ],
    kind === 'no obtenga respuesta'
      ? 'La app muestra la traza de la petición fallida («GET … → network error»), no el texto «No se pudo contactar con el servidor»: el cliente lanza un ApiError con esa traza (packages/shared/src/client.ts:148) y la vista usa failureTrace (apps/mobile/src/features/requirements/view.ts), que la devuelve no vacía, así que el texto de respaldo nunca se muestra.'
      : undefined,
    { avisoLeido: lines, petición: kind },
  );
});

/** E6: un cambio rechazado por el servidor (el gestor ha borrado el requisito por la API) deja el cruce como estaba y muestra el aviso de error. */
const rejectedTap: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const start = strict('estado', ESTADO, cell(row, 'estado'));
  const expected = `tocar el cruce de ${requirement} con ${testCase} muestra el aviso de error «Ha ocurrido un error inesperado» y el cruce vuelve a ${cell(row, 'estado')}`;
  const prepared = await prepareMatrix(page, 'consultor@sigpro.test', 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await mobileCellState(box);
  if (before.checked !== start) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${mobileWord(before.checked) ?? '(sin leer)'}`);
  const gestor = await apiSignIn(GESTOR);
  if (gestor.token === undefined) return preparationFailedWeb(expected, 'el gestor inicia sesión por la API para borrar el requisito');
  const deleted = await call('DELETE', `/requirements/${requirement}`, { tenant: TENANT_A, token: gestor.token });
  if (deleted.status !== 204) return preparationFailedWeb(`el gestor borra ${requirement} por la API (204)`, `DELETE respondió ${deleted.status}`);
  const tapError = await tapCell(box, `tocar el cruce de ${requirement} con ${testCase}`, false);
  if (tapError !== undefined) return outcomeOf([check(false, expected, tapError)], undefined);
  const toast = await toastShown(page, 'danger', 'Ha ocurrido un error inesperado');
  const after = await mobileCellState(box);
  return outcomeOf(
    [
      check(toast.seen, 've el aviso de error «Ha ocurrido un error inesperado»', `avisos: ${toast.observed}`),
      check(after.checked === start, `el cruce vuelve a ${cell(row, 'estado')}`, `el cruce está ${mobileWord(after.checked) ?? '(sin leer)'}`),
    ],
    undefined,
    { avisos: toast.observed },
  );
});

defineBrowserRows({
  story: 'US-REQ-TRAZA-007',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, coverageAndLabel],
    [2, tapToggles],
    [3, auditorTaps],
    [4, emptyProgram],
    [5, failureAndRetry],
    [6, rejectedTap],
  ]),
});

