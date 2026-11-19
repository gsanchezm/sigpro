import type { Locator, Page } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { ACTION, HOLD_MS, holdsFor, safe } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  CASO,
  GESTOR,
  PROGRAM_CODE,
  REQUISITO,
  TENANT_A,
  codesOf,
  countPair,
  linksOf,
  resetAlumno01,
  sameList,
  signIn as apiSignIn,
  traceabilityOf,
  type Account,
} from '../api/common';
import {
  READ_MS,
  actionFailed,
  cellOf,
  type Blocked,
  cellState,
  concluirWeb,
  coverageText,
  interact,
  labeledRows,
  markedWord,
  onWeb,
  openMatrix,
  settledMatrix,
  signIn,
  textCheck,
  toastShown,
  uncoveredLabelOf,
  UI_ACCOUNTS,
} from './common';

// US-REQ-TRAZA-006 — Marcar y desmarcar un cruce en la matriz de trazabilidad (web). Cada fila reinicia alumno01, inicia sesión la cuenta
// de la fila por el formulario y abre la matriz. Tras cada acción, el enlace se vuelve a leer por la API (GET de la matriz): la pantalla
// sola no prueba que el cambio se guardó.

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

/** Operación sobre la casilla (marcar o desmarcar). */
const OPERACION: ReadonlyMap<string, 'marca' | 'desmarca'> = new Map<string, 'marca' | 'desmarca'>([
  ['marca', 'marca'],
  ['desmarca', 'desmarca'],
]);

/** Intento del auditor sobre la casilla. */
const INTENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['marcarla', 'marcar'],
  ['desmarcarla', 'desmarcar'],
]);

/** Cuenta del auditor de la historia (la fila no la nombra en su celda: el Dado lo fija). */
const AUDITOR_UI = UI_ACCOUNTS.get('auditor@sigpro.test');
const CONSULTOR_UI = UI_ACCOUNTS.get('consultor@sigpro.test');

/** Cuántas veces está enlazado el par, leído por la API con la cuenta dada (`undefined` si la lectura falla). */
const linkCountByApi = async (account: Account, program: string, requirement: string, testCase: string): Promise<number | undefined> => {
  const signed = await apiSignIn(account);
  if (signed.token === undefined) return undefined;
  const read = await traceabilityOf(program, TENANT_A, signed.token);
  return read.status === 200 ? countPair(linksOf(read.body), requirement, testCase) : undefined;
};

/** Requisitos sin ningún caso enlazado, según la API (para comprobar la etiqueta de la pantalla). */
const uncoveredByApi = async (account: Account, program: string): Promise<readonly string[] | undefined> => {
  const signed = await apiSignIn(account);
  if (signed.token === undefined) return undefined;
  const read = await traceabilityOf(program, TENANT_A, signed.token);
  if (read.status !== 200) return undefined;
  const covered = new Set(linksOf(read.body).map((pair) => pair.requirementCode));
  return codesOf(read.body, 'requirements').filter((code) => !covered.has(code));
};

/** Mensaje de la cuenta del aviso «Enlace creado» / «Enlace eliminado»: «REQ ↔ CASO». */
const pairText = (requirement: string, testCase: string): string => `${requirement} ↔ ${testCase}`;

/** Clic sobre la casilla del cruce (con diagnóstico si falla). */
const clickCell = (box: Locator, label: string): Promise<Blocked | undefined> => interact(box, label, (element) => element.click(ACTION));

/** Preparación común de una fila de la matriz: reinicio, inicio de sesión de la cuenta y pestaña abierta. */
const prepareMatrix = async (page: Page, credentials: { readonly email: string; readonly password: string }, program: string, expected: string): Promise<Outcome | undefined> => {
  await resetAlumno01();
  const failure = (await signIn(page, credentials)) ?? (await openMatrix(page, program));
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  if (!(await settledMatrix(page))) return preparationFailedWeb(expected, 'la matriz no se asienta (ni tabla, ni estado vacío, ni aviso)');
  return undefined;
};

/** E1: marcar un cruce lo enlaza: aviso «Enlace creado», la casilla marcada, la cifra al día y el enlace visible por la API. */
const markCross: BrowserRowHandler = onWeb(async (row, { page }) => {
  const account = strict('cuenta', UI_ACCOUNTS, cell(row, 'cuenta'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const expected = `marcar ${requirement} con ${testCase} muestra «Enlace creado» con «${pairText(requirement, testCase)}», queda marcado, ve «${cell(row, 'cobertura')}» y la API lo confirma`;
  const prepared = await prepareMatrix(page, account.credentials, program, expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== false) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está sin marcar`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const blocked = await clickCell(box, `marcar el cruce de ${requirement} con ${testCase}`);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Enlace creado', pairText(requirement, testCase));
  const after = await cellState(box);
  const count = await linkCountByApi(account.api, program, requirement, testCase);
  return concluirWeb(
    [
      check(toast.seen, `ve el aviso «Enlace creado» con el texto «${pairText(requirement, testCase)}»`, `avisos: ${toast.observed}`),
      check(after.checked === true, 'el cruce queda marcado', `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      textCheck(await coverageText(page), coverage, 've el texto'),
      check(count === 1, 'la API confirma el enlace en la matriz', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    { evidence: { avisos: toast.observed, casillaTrasConfirmar: after.checked } },
  );
});

/** E2: desmarcar un cruce lo desenlaza: aviso «Enlace eliminado», la casilla sin marcar, la cifra y la etiqueta «Sin cobertura» al día. */
const unmarkCross: BrowserRowHandler = onWeb(async (row, { page }) => {
  const account = strict('cuenta', UI_ACCOUNTS, cell(row, 'cuenta'));
  const program = strict('programa', PROGRAM_CODE, cell(row, 'programa'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  const label = strict('etiqueta', ETIQUETA, cell(row, 'etiqueta'));
  const expected = `desmarcar ${requirement} con ${testCase} muestra «Enlace eliminado» con «${pairText(requirement, testCase)}», queda sin marcar, ve «${cell(row, 'cobertura')}», la fila de ${requirement} ${cell(row, 'etiqueta')} y la API lo confirma`;
  const prepared = await prepareMatrix(page, account.credentials, program, expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== true) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está marcado`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const blocked = await clickCell(box, `desmarcar el cruce de ${requirement} con ${testCase}`);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'ok', 'Enlace eliminado', pairText(requirement, testCase));
  const after = await cellState(box);
  const labeledOnScreen = await uncoveredLabelOf(page, requirement);
  const labeledRowsOnScreen = await labeledRows(page);
  const uncoveredApi = await uncoveredByApi(account.api, program);
  const count = await linkCountByApi(account.api, program, requirement, testCase);
  return concluirWeb(
    [
      check(toast.seen, `ve el aviso «Enlace eliminado» con el texto «${pairText(requirement, testCase)}»`, `avisos: ${toast.observed}`),
      check(after.checked === false, 'el cruce queda sin marcar', `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      textCheck(await coverageText(page), coverage, 've el texto'),
      check(labeledOnScreen === label, `la fila de ${requirement} ${cell(row, 'etiqueta')}`, labeledOnScreen === undefined ? 'la fila no se lee' : labeledOnScreen ? 'muestra la etiqueta «Sin cobertura»' : 'no muestra la etiqueta «Sin cobertura»'),
      check(
        labeledRowsOnScreen !== undefined && uncoveredApi !== undefined && sameList([...labeledRowsOnScreen].sort(), [...uncoveredApi].sort()),
        'la etiqueta «Sin cobertura» está solo en los requisitos sin caso (según la API)',
        `en pantalla: ${labeledRowsOnScreen?.join(', ') ?? '(sin leer)'}; según la API: ${uncoveredApi?.join(', ') ?? '(sin leer)'}`,
      ),
      check(count === 0, 'la API confirma que el enlace ya no está', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    { evidence: { avisos: toast.observed, casillaTrasConfirmar: after.checked } },
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
  if (AUDITOR_UI === undefined) throw new Error('la cuenta de auditor no está en el mapa de cuentas de pantalla');
  const expected = `el cruce de ${requirement} con ${testCase} sigue ${cell(row, 'estado')}, la casilla está deshabilitada y su título es «Tu rol no permite editar requisitos»`;
  const prepared = await prepareMatrix(page, AUDITOR_UI.credentials, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const before = await cellState(box);
  if (before.checked !== stateWanted) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado')}`, `el cruce está ${markedWord(before.checked) ?? '(sin leer)'}`);
  const hovered = await interact(box, `pasar el puntero sobre el cruce de ${requirement} con ${testCase}`, (element) => element.hover({ timeout: READ_MS }));
  const title = await cellState(box);
  const attempted = await interact(box, `${cell(row, 'intento')} el cruce de ${requirement} con ${testCase}`, (element) => element.click({ force: true, timeout: READ_MS }));
  if (attempted !== undefined) return actionFailed(expected, attempted);
  const held = await holdsFor(async () => (await safe<boolean | undefined>(() => box.isChecked({ timeout: READ_MS }), undefined)) === stateWanted, HOLD_MS);
  const after = await cellState(box);
  const count = await linkCountByApi(AUDITOR_UI.api, 'PRG-002', requirement, testCase);
  return concluirWeb(
    [
      check(after.disabled === true, 'la casilla está deshabilitada', `la casilla está ${after.disabled === undefined ? '(sin leer)' : after.disabled ? 'deshabilitada' : 'habilitada'}`),
      check(held.held && after.checked === stateWanted, `el cruce sigue ${cell(row, 'estado')} durante 2 s`, held.held ? `el cruce está ${markedWord(after.checked) ?? '(sin leer)'} durante 2 s` : `el cruce cambió a los ${held.brokeAtMs ?? '?'} ms`),
      check(title.title === 'Tu rol no permite editar requisitos', 'al pasar el puntero aparece «Tu rol no permite editar requisitos»', `el título de la casilla es «${title.title ?? '(sin leer)'}»`),
      check(count === (stateWanted ? 1 : 0), 'la API confirma que el enlace no cambia', count === undefined ? 'la matriz no se pudo leer por la API' : `la API lista el par ${count} vez(es)`),
    ],
    {
      note: hovered === undefined ? 'La explicación se lee del atributo title de la casilla: el tooltip nativo no es legible en el DOM.' : `La explicación se lee del atributo title; el paso de pasar el puntero no se completó: ${hovered.message}`,
      evidence: { intento: intent, tituloTrasPuntero: title.title },
    },
  );
});

/**
 * E4: el servidor rechaza el cambio (el gestor ha borrado el requisito por la API): la casilla y la cifra vuelven a su estado anterior y
 * aparece el aviso de error.
 */
const rejectedChange: BrowserRowHandler = onWeb(async (row, { page }) => {
  const operation = strict('operacion', OPERACION, cell(row, 'operacion'));
  const requirement = strict('requisito', REQUISITO, cell(row, 'requisito'));
  const testCase = strict('caso', CASO, cell(row, 'caso'));
  const before = strict('estado_anterior', ESTADO, cell(row, 'estado_anterior'));
  const coverage = strict('cobertura', COBERTURA, cell(row, 'cobertura'));
  if (CONSULTOR_UI === undefined) throw new Error('la cuenta de consultor no está en el mapa de cuentas de pantalla');
  const expected = `el aviso «Ha ocurrido un error inesperado»; el cruce de ${requirement} con ${testCase} vuelve a ${cell(row, 'estado_anterior')} y ve «${cell(row, 'cobertura')}»`;
  const prepared = await prepareMatrix(page, CONSULTOR_UI.credentials, 'PRG-002', expected);
  if (prepared !== undefined) return prepared;
  const box = cellOf(page, requirement, testCase);
  const start = await cellState(box);
  if (start.checked !== before) return preparationFailedWeb(`el cruce de ${requirement} con ${testCase} está ${cell(row, 'estado_anterior')}`, `el cruce está ${markedWord(start.checked) ?? '(sin leer)'}`);
  // El gestor borra el requisito por la API después de abrir la matriz (la pantalla no se recarga)
  const gestor = await apiSignIn(GESTOR);
  if (gestor.token === undefined) return preparationFailedWeb(expected, 'el gestor inicia sesión por la API para borrar el requisito');
  const deleted = await call('DELETE', `/requirements/${requirement}`, { tenant: TENANT_A, token: gestor.token });
  if (deleted.status !== 204) return preparationFailedWeb(`el gestor borra ${requirement} por la API (204)`, `DELETE respondió ${deleted.status}`);
  const blocked = await clickCell(box, `${operation === 'marca' ? 'marcar' : 'desmarcar'} el cruce de ${requirement} con ${testCase}`);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const toast = await toastShown(page, 'danger', 'Ha ocurrido un error inesperado');
  const after = await cellState(box);
  return concluirWeb(
    [
      check(toast.seen, 've el aviso de error «Ha ocurrido un error inesperado»', `avisos: ${toast.observed}`),
      check(after.checked === before, `el cruce vuelve a estar ${cell(row, 'estado_anterior')}`, `el cruce está ${markedWord(after.checked) ?? '(sin leer)'}`),
      textCheck(await coverageText(page), coverage, 've el texto'),
    ],
    { evidence: { avisos: toast.observed } },
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

