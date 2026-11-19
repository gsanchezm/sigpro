import type { Locator, Page } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { ACTION, HOLD_MS, holdsFor, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  CASO,
  GESTOR,
  PROGRAM_CODE,
  REQUISITO,
  TENANT_A,
  countPair,
  linksOf,
  resetAlumno01,
  sameList,
  signIn as apiSignIn,
  traceabilityOf,
  uncoveredRequirements,
  type Account,
} from '../api/common';
import {
  READ_MS,
  UI_ACCOUNTS,
  actionFailed,
  armToasts,
  cellOf,
  cellState,
  concluirWeb,
  coverageSettles,
  delayLinkRequests,
  interact,
  labeledRows,
  markedWord,
  onWeb,
  openMatrix,
  settledMatrix,
  signIn,
  textCheck,
  toastShown,
  toastStartingWith,
  toastVisible,
  uncoveredLabelOf,
  within,
  type DelayControl,
} from './common';

// US-REQ-TRAZA-006 — Marcar y desmarcar un cruce en la matriz de trazabilidad (web). Cada fila reinicia alumno01, inicia sesión la cuenta
// de la fila por el formulario y abre la matriz. Tras cada acción, el enlace se vuelve a leer por la API (GET de la matriz): la pantalla
// sola no prueba que el cambio se guardó. El enlace se retrasa para ver qué se pinta antes de la respuesta del servidor.

/** Retraso del enlace o desenlace: la historia no fija tiempo; la prueba lo fija para observar el cambio optimista. */
const DELAY_MS = 1_500;

const COBERTURA: ReadonlyMap<string, string> = new Map<string, string>([
  ['14 de 14 requisitos con cobertura', '14 de 14 requisitos con cobertura'],
  ['13 de 14 requisitos con cobertura', '13 de 14 requisitos con cobertura'],
  ['12 de 14 requisitos con cobertura', '12 de 14 requisitos con cobertura'],
]);

/** Estado del cruce en la celda de la historia: «sin marcar» o «marcado». */
const ESTADO: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['sin marcar', false],
  ['marcado', true],
]);

/** Etiqueta «Sin cobertura» de la fila del requisito, en la celda de la historia. */
const ETIQUETA: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['muestra la etiqueta «Sin cobertura»', true],
  ['no muestra la etiqueta «Sin cobertura»', false],
]);

/** Operación de la celda («marca» o «desmarca»): el verbo de la petición que la casilla dispara. */
const OPERACION: ReadonlyMap<string, { readonly method: 'PUT' | 'DELETE'; readonly label: string }> = new Map<string, { readonly method: 'PUT' | 'DELETE'; readonly label: string }>([
  ['marca', { method: 'PUT', label: 'marcar' }],
  ['desmarca', { method: 'DELETE', label: 'desmarcar' }],
]);

/** Intento del auditor sobre la casilla. */
const INTENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['marcarla', 'marcar'],
  ['desmarcarla', 'desmarcar'],
]);

const SIN_PERMISO = 'Tu rol no permite editar requisitos';
const ERROR_GENERICO = 'Ha ocurrido un error inesperado';
/** Símbolo del caso TC-010 (su último resultado es «pass»: historia 001, Reglas). */
const SIMBOLO_TC_010 = '✓';
/**
 * La cifra de la historia tras borrar REQ-022 es la de la pantalla, que no se recarga: en el servidor, borrar REQ-022 arrastra a su hijo
 * REQ-023 (requirements.service.ts:175-184; el padre se asigna en data.ts) y la cifra sería «11 de 12» (fila 2) y, borrando REQ-028, «13 de 13»
 * (fila 1). Por eso la cifra no prueba la vuelta atrás: la prueba es la casilla.
 */
const NOTA_CASCADA = 'La cifra de la historia es la de la pantalla, que no se recarga: en el servidor, borrar el requisito deja «13 de 13» (REQ-028) o «11 de 12» (REQ-022, que arrastra a su hijo REQ-023; requirements.service.ts:175-184). La cifra no prueba la vuelta atrás: la prueba es la casilla.';

const pairText = (requirement: string, testCase: string): string => `${requirement} ↔ ${testCase}`;
const sortedCopy = (codes: readonly string[]): readonly string[] => [...codes].sort();

/** Cuántas veces está enlazado el par en PRG-002, leído por la API con la cuenta dada (`undefined` si la lectura falla). */
const linkCountByApi = async (account: Account, requirement: string, testCase: string): Promise<number | undefined> => {
  const signed = await apiSignIn(account);
  if (signed.token === undefined) return undefined;
  const read = await traceabilityOf('PRG-002', TENANT_A, signed.token);
  return read.status === 200 ? countPair(linksOf(read.body), requirement, testCase) : undefined;
};

/** Preparación común: reinicio, inicio de sesión de la cuenta y pestaña abierta con la matriz asentada. */
const prepareMatrix = async (page: Page, credentials: { readonly email: string; readonly password: string }, program: string, expected: string): Promise<Outcome | undefined> => {
  await resetAlumno01();
  const failure = (await signIn(page, credentials)) ?? (await openMatrix(page, program));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!(await settledMatrix(page))) return preparationFailedWeb(expected, 'la matriz no se asienta (ni tabla, ni estado vacío, ni aviso)');
  return undefined;
};

/** Espera a que las etiquetas «Sin cobertura» de la pantalla sean las que da la API (con techo). */
const labelsSettle = (page: Page, expected: readonly string[] | undefined): Promise<unknown> =>
  waitUntil(async () => {
    const labeled = await labeledRows(page);
    return labeled !== undefined && expected !== undefined && sameList(sortedCopy(labeled), sortedCopy(expected));
  });

/**
 * Marca o desmarca la casilla con la petición retrasada: el cambio optimista debe verse antes de que el control se libere. Devuelve si
 * la casilla llegó a verse en el estado de la acción mientras la respuesta seguía pendiente.
 */
const clickWithPendingAnswer = async (page: Page, box: Locator, label: string, target: boolean, control: DelayControl): Promise<{ readonly blocked?: { readonly message: string; readonly note: string }; readonly seenBeforeAnswer: boolean }> => {
  await armToasts(page);
  const blocked = await interact(box, label, (element) => element.click(ACTION));
  if (blocked !== undefined) return { blocked, seenBeforeAnswer: false };
  const early = { seen: false };
  await within(async () => {
    if (control.released) return true;
    if ((await safe<boolean | undefined>(() => box.isChecked({ timeout: READ_MS }), undefined)) === target) {
      early.seen = true;
      return true;
    }
    return false;
  }, DELAY_MS + 500);
  return { seenBeforeAnswer: early.seen };
};

/** E1: marcar un cruce lo enlaza: se ve marcado antes de la respuesta, aviso «Enlace creado», cifra, símbolo y enlace confirmado por la API. */
const markCross: BrowserRowHandler = onWeb(async (row, { page }) => {
  const account = strict('cuenta', UI_ACCOUNTS, cell(row, 'cuenta'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const expected = `marcar ${requirement} con ${testCase} se ve marcado, muestra «Enlace creado» con «${pairText(requirement, testCase)}», ve «${cell(row, 'cobertura')}» y la API lo confirma`;
  const prepared = await prepareMatrix(page, account.credentials, program, expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== false) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está sin marcar`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const control: DelayControl = { released: false };
  await delayLinkRequests(page, DELAY_MS, control);
  const pressed = await clickWithPendingAnswer(page, box, `marcar el cruce de ${requirement} con ${testCase}`, true, control);
  if (pressed.blocked !== undefined) return actionFailed(expected, pressed.blocked);
  const toast = await toastShown(page, 'ok', 'Enlace creado', pairText(requirement, testCase));
  const toastOnScreen = await toastVisible(page, 'ok', 'Enlace creado');
  const after = await cellState(box);
  const shown = await coverageSettles(page, coverage);
  const count = await linkCountByApi(account.api, requirement, testCase);
  return concluirWeb(
    [
      check(pressed.seenBeforeAnswer, 'antes de la respuesta del servidor la casilla ya se ve marcada', pressed.seenBeforeAnswer ? 'la casilla se vio marcada antes de la respuesta' : 'la casilla no se vio marcada antes de la respuesta'),
      check(toast.seen, `ve el aviso «Enlace creado» con el texto «${pairText(requirement, testCase)}»`, `avisos: ${toast.observed}`),
      check(toastOnScreen === true, 'el aviso se ve en pantalla', toastOnScreen === undefined ? '(sin leer)' : toastOnScreen ? 'se ve' : 'no se ve'),
      check(after.checked === true, 'el cruce queda marcado', `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      check(after.symbol === SIMBOLO_TC_010, `el cruce marcado conserva el símbolo de la última ejecución (${SIMBOLO_TC_010})`, `el cruce muestra ${after.symbol ?? '(sin leer)'}`),
      textCheck(shown, coverage, 've el texto'),
      check(count === 1, 'la API confirma el enlace en la matriz', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    { evidence: { avisos: toast.observed } },
  );
});

/** E2: desmarcar un cruce lo desenlaza: se ve sin marcar antes de la respuesta, aviso «Enlace eliminado», cifra, etiqueta y enlace confirmado por la API. */
const unmarkCross: BrowserRowHandler = onWeb(async (row, { page }) => {
  const account = strict('cuenta', UI_ACCOUNTS, cell(row, 'cuenta'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const label = strict('etiqueta', ETIQUETA, cell(row, 'etiqueta'));
  const expected = `desmarcar ${requirement} con ${testCase} se ve sin marcar, muestra «Enlace eliminado» con «${pairText(requirement, testCase)}», ve «${cell(row, 'cobertura')}», la fila de ${requirement} ${cell(row, 'etiqueta')} y la API lo confirma`;
  const prepared = await prepareMatrix(page, account.credentials, program, expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== true) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está marcado`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const control: DelayControl = { released: false };
  await delayLinkRequests(page, DELAY_MS, control);
  const pressed = await clickWithPendingAnswer(page, box, `desmarcar el cruce de ${requirement} con ${testCase}`, false, control);
  if (pressed.blocked !== undefined) return actionFailed(expected, pressed.blocked);
  const toast = await toastShown(page, 'ok', 'Enlace eliminado', pairText(requirement, testCase));
  const toastOnScreen = await toastVisible(page, 'ok', 'Enlace eliminado');
  const after = await cellState(box);
  const shown = await coverageSettles(page, coverage);
  const apiUncovered = await uncoveredRequirements(account.api, program);
  await labelsSettle(page, apiUncovered);
  const labeledOnScreen = await uncoveredLabelOf(page, requirement);
  const labeled = await labeledRows(page);
  const count = await linkCountByApi(account.api, requirement, testCase);
  return concluirWeb(
    [
      check(pressed.seenBeforeAnswer, 'antes de la respuesta del servidor la casilla ya se ve sin marcar', pressed.seenBeforeAnswer ? 'la casilla se vio sin marcar antes de la respuesta' : 'la casilla no se vio sin marcar antes de la respuesta'),
      check(toast.seen, `ve el aviso «Enlace eliminado» con el texto «${pairText(requirement, testCase)}»`, `avisos: ${toast.observed}`),
      check(toastOnScreen === true, 'el aviso se ve en pantalla', toastOnScreen === undefined ? '(sin leer)' : toastOnScreen ? 'se ve' : 'no se ve'),
      check(after.checked === false, 'el cruce queda sin marcar', `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      textCheck(shown, coverage, 've el texto'),
      check(labeledOnScreen === label, `la fila de ${requirement} ${cell(row, 'etiqueta')}`, labeledOnScreen === undefined ? 'la fila no se lee' : labeledOnScreen ? 'muestra la etiqueta «Sin cobertura»' : 'no muestra la etiqueta «Sin cobertura»'),
      check(
        labeled !== undefined && apiUncovered !== undefined && sameList(sortedCopy(labeled), sortedCopy(apiUncovered)),
        'la etiqueta «Sin cobertura» está solo en los requisitos sin caso (según la API)',
        `en pantalla: ${labeled?.join(', ') ?? '(sin leer)'}; según la API: ${apiUncovered?.join(', ') ?? '(sin leer)'}`,
      ),
      check(count === 0, 'la API confirma que el enlace ya no está', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    { evidence: { avisos: toast.observed } },
  );
});

/**
 * E3: el auditor ve la matriz con las casillas deshabilitadas, con el motivo en el título; tocarla no cambia el cruce (y la API lo confirma).
 * El clic es forzado: una casilla deshabilitada no recibe el clic, y eso es lo que se observa.
 */
const auditorCannotChange: BrowserRowHandler = onWeb(async (row, { page }) => {
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const stateWanted = strict('estado', ESTADO, cell(row, 'estado'));
  const intent = strict('intento', INTENTO, cell(row, 'intento'));
  const auditor = UI_ACCOUNTS.get('auditor@sigpro.test');
  if (auditor === undefined) throw new Error('la cuenta de auditor no está en el mapa de cuentas de pantalla');
  const expected = `el cruce de ${requirement} con ${testCase} sigue ${cell(row, 'estado')}, la casilla está deshabilitada y su título es «${SIN_PERMISO}»`;
  const prepared = await prepareMatrix(page, auditor.credentials, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== stateWanted) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const hovered = await interact(box, `pasar el puntero sobre el cruce de ${requirement} con ${testCase}`, (element) => element.hover({ timeout: READ_MS }));
  const titled = await cellState(box);
  const attempted = await interact(box, `${intent} el cruce de ${requirement} con ${testCase}`, (element) => element.click({ force: true, timeout: READ_MS }));
  if (attempted !== undefined) return actionFailed(expected, attempted);
  const held = await holdsFor(async () => (await safe<boolean | undefined>(() => box.isChecked({ timeout: READ_MS }), undefined)) === stateWanted, HOLD_MS);
  const after = await cellState(box);
  const count = await linkCountByApi(auditor.api, requirement, testCase);
  return concluirWeb(
    [
      check(hovered === undefined, 'el puntero pasa sobre la casilla', hovered === undefined ? 'el puntero pasó sobre la casilla' : hovered.message),
      check(after.disabled === true, 'la casilla está deshabilitada', `la casilla está ${after.disabled === undefined ? '(sin leer)' : after.disabled ? 'deshabilitada' : 'habilitada'}`),
      check(held.held && after.checked === stateWanted, `el cruce sigue ${cell(row, 'estado')} durante 2 s`, held.held ? `el cruce está ${markedWord(after.checked) ?? '(sin leer)'} durante 2 s` : `el cruce cambió a los ${held.brokeAtMs ?? '?'} ms`),
      check(titled.title === SIN_PERMISO, `al pasar el puntero aparece «${SIN_PERMISO}»`, `el título de la casilla es «${titled.title ?? '(sin leer)'}»`),
      check(count === (stateWanted ? 1 : 0), 'la API confirma que el enlace no cambia', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    { note: 'La explicación se lee del atributo title de la casilla: el tooltip nativo no es legible en el DOM.', evidence: { intento: intent } },
  );
});

/**
 * E4: el servidor rechaza el cambio (el gestor ha borrado el requisito por la API): la casilla vuelve a su estado anterior y aparece
 * el aviso de error con la traza de la petición rechazada. El aviso se espera con su cuerpo, no solo con su título.
 */
const rejectedChange: BrowserRowHandler = onWeb(async (row, { page }) => {
  const operation = strict('operacion', OPERACION, cell(row, 'operacion'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const before = strict('estado_anterior', ESTADO, cell(row, 'estado_anterior'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const consultor = UI_ACCOUNTS.get('consultor@sigpro.test');
  if (consultor === undefined) throw new Error('la cuenta de consultor no está en el mapa de cuentas de pantalla');
  const expected = `el aviso «${ERROR_GENERICO}» con la traza de ${operation.method} de ${requirement} con ${testCase}; el cruce vuelve a ${cell(row, 'estado_anterior')} y ve «${cell(row, 'cobertura')}»`;
  const prepared = await prepareMatrix(page, consultor.credentials, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const start = await cellState(box);
  if (start.checked !== before) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado_anterior')}`, `el cruce está ${markedWord(start.checked) ?? '(sin leer)'}`);
  // El gestor borra el requisito por la API después de abrir la matriz (la pantalla no se recarga)
  const gestor = await apiSignIn(GESTOR);
  if (gestor.token === undefined) return preparationFailedWeb(expected, 'el gestor inicia sesión por la API para borrar el requisito');
  const deleted = await call('DELETE', `/requirements/${requirement}`, { tenant: TENANT_A, token: gestor.token });
  if (deleted.status !== 204) return preparationFailedWeb(`el gestor borra ${requirement} por la API (204)`, `DELETE respondió ${deleted.status}`);
  await armToasts(page);
  const blocked = await interact(box, `${operation.label} el cruce de ${requirement} con ${testCase}`, (element) => element.click(ACTION));
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const prefix = `${operation.method} /api/requirements/${requirement}/tests/${testCase} → 404 Not Found`;
  const toast = await toastStartingWith(page, 'danger', ERROR_GENERICO, prefix);
  const toastOnScreen = await toastVisible(page, 'danger', ERROR_GENERICO);
  const after = await cellState(box);
  const shown = await coverageSettles(page, coverage);
  return concluirWeb(
    [
      check(toast.seen, `ve el aviso de error «${ERROR_GENERICO}» con la traza «${prefix}»`, `avisos: ${toast.observed}`),
      check(toastOnScreen === true, 'el aviso de error se ve en pantalla', toastOnScreen === undefined ? '(sin leer)' : toastOnScreen ? 'se ve' : 'no se ve'),
      check(after.checked === before, `el cruce vuelve a estar ${cell(row, 'estado_anterior')}`, `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      textCheck(shown, coverage, 've el texto'),
    ],
    { note: NOTA_CASCADA, evidence: { avisos: toast.observed } },
  );
});

defineBrowserRows({
  story: 'US-REQ-TRAZA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, markCross],
    [2, unmarkCross],
    [3, auditorCannotChange],
    [4, rejectedChange],
  ]),
});
