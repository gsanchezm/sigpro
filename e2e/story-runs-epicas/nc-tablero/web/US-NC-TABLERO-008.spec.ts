import { RESPONSIVE_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, attrOf } from '../../support/browser';
import {
  actionFailed,
  armDragLog,
  armToasts,
  cardsOnScreen,
  columnOf,
  controlCheck,
  type DragOutcome,
  interact,
  intercept,
  isDragOutcome,
  onWeb,
  performDrag,
  persistedState,
  prepareWeb,
  readBoard,
  readCardMenu,
  settleLocal,
  settled,
  toastShown,
  verdictWeb,
  waitBoard,
  type Blocked,
} from './common';

// US-NC-TABLERO-008 — Cambio de estado desde el tablero en la web. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador; inicio de sesión de la cuenta de la fila (consultor@sigpro.test mueve, auditor@sigpro.test solo lee) y apertura de
// /nc. Los arrastres se miden con el puntero y se registran por «dragstart»: un arrastre que no arranca en una tarjeta que SÍ es
// arrastrable es «no ejecutable» (con la evidencia medida); en la fila del auditor la tarjeta no es arrastrable y no arrancar es lo
// que dice la historia. Tras cada paso aceptado (y su aviso) se lee el estado por la API.

const TITLE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Abierta', 'open'],
  ['En análisis', 'in_analysis'],
  ['Acción correctiva', 'corrective_action'],
  ['Rechazada', 'rejected'],
]);

const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001', 'NC-001'],
  ['NC-002', 'NC-002'],
  ['NC-003', 'NC-003'],
  ['NC-004', 'NC-004'],
  ['NC-005', 'NC-005'],
]);

const NUMBER_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['3', 3],
  ['4', 4],
  ['5', 5],
]);

const AVISO_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001 pasó a «En análisis»', 'NC-001 pasó a «En análisis»'],
  ['NC-002 pasó a «Acción correctiva»', 'NC-002 pasó a «Acción correctiva»'],
  ['NC-003 pasó a «En análisis»', 'NC-003 pasó a «En análisis»'],
  ['NC-005 pasó a «Abierta»', 'NC-005 pasó a «Abierta»'],
  ['NC-001: no se puede pasar de «Abierta» a «Acción correctiva»', 'NC-001: no se puede pasar de «Abierta» a «Acción correctiva»'],
  ['NC-001: no se puede pasar de «Abierta» a «Rechazada»', 'NC-001: no se puede pasar de «Abierta» a «Rechazada»'],
]);

/** Opciones «Mover a …» que el menú de la tarjeta debe ofrecer (además de «Abrir detalle» y «Comentario rápido…»). */
const MENU_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['«Mover a «En análisis»»', ['Mover a «En análisis»']],
  ['«Mover a «Acción correctiva»», «Mover a «Rechazada»» y «Mover a «Abierta»»', ['Mover a «Acción correctiva»', 'Mover a «Rechazada»', 'Mover a «Abierta»']],
  ['ninguna más', []],
]);

const HTTP_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const MENU_BASE: readonly string[] = ['Abrir detalle', 'Comentario rápido…'];
const CONSULTOR = 'consultor@sigpro.test';
const AUDITOR = 'auditor@sigpro.test';
const READ_ONLY_REASON = 'Tu rol no permite mover no conformidades';
const NOT_DRAGGABLE_NOTE =
  'El arrastre de un rol sin permiso no arranca porque la tarjeta no es arrastrable (draggable=false): es lo que dice la historia. La fila sola no distingue una negativa de la app de un fallo del gesto, por eso se lee el atributo draggable. «Con el motivo» se lee del atributo title de la opción del menú; la historia web no exige que el motivo sea texto visible.';

/** Un arrastre sin medir (el gesto del puntero falló en el arnés) es una fila con su diagnóstico. */
const dragProblem = (expected: string, blocked: Blocked): Outcome => actionFailed(expected, blocked);

/**
 * Un arrastre que no arranca. Solo `draggable="false"` es una discrepancia (la app no deja arrastrar a un rol que sí puede mover).
 * Con la tarjeta arrastrable (o sin atributo legible) es `notExecutable`, con la evidencia medida: draggable, marca de destino y puntero.
 */
const notStarted = (expected: string, code: string, drag: DragOutcome): Outcome => {
  const measured = `draggable=${drag.draggable ?? '(sin leer)'}; marca de la columna destino «${drag.dropOnTarget}»; puntero sobre la columna destino: ${drag.pointerOnTarget ? 'sí' : 'no'}`;
  return drag.draggable === 'false'
    ? verdictWeb([check(false, 'la tarjeta arrastrable, con dragstart', `${code} no se arrastra (${measured})`)])
    : notExecutable(expected, `el gesto de arrastrar no arranca en el arnés: no hay «dragstart» sobre ${code} (${measured}); no se puede afirmar que la app lo impida`);
};

// --- Esquema 1: arrastrar a una columna que admite el paso la mueve y avisa ----------------------------------------------------

const acceptedDrag: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const origin = strict('origen', TITLE_CELLS, cell(row, 'origen'));
  const to = strict('destino', TITLE_CELLS, cell(row, 'destino'));
  const aviso = strict('aviso', AVISO_CELLS, cell(row, 'aviso'));
  const countOrigin = strict('contador_origen', NUMBER_CELLS, cell(row, 'contador_origen'));
  const countTo = strict('contador_destino', NUMBER_CELLS, cell(row, 'contador_destino'));
  const expected = `arrastrar ${code} de «${cell(row, 'origen')}» a «${cell(row, 'destino')}» la mueve, muestra el aviso «${aviso}» y deja los contadores ${countOrigin} y ${countTo}`;
  const failed = await prepareWeb(page, 'escritorio', CONSULTOR, expected);
  if (failed !== undefined) return failed;

  await armDragLog(page);
  await armToasts(page);
  const drag = await performDrag(page, code, to);
  if (!isDragOutcome(drag)) return dragProblem(expected, drag);
  if (!drag.started) return notStarted(expected, code, drag);

  const toast = await toastShown(page, 'ok', aviso);
  const view = await waitBoard(page, 'escritorio', (current) => settled(current) && columnOf(current, origin)?.count === String(countOrigin) && columnOf(current, to)?.count === String(countTo));
  const destination = view === undefined ? undefined : columnOf(view, to);
  const originColumn = view === undefined ? undefined : columnOf(view, origin);
  // Persistencia: la API se lee DESPUÉS del aviso (que solo sale cuando el servidor acepta el paso)
  const persisted = await persistedState(code);
  return verdictWeb(
    [
      check(drag.dropOnTarget === 'valid', `la columna «${cell(row, 'destino')}» se marca como destino válido mientras se arrastra`, `marca de la columna mientras se arrastra: «${drag.dropOnTarget}»`),
      check(toast.seen, `aviso «${aviso}»`, `aviso ${toast.observed}`),
      check(originColumn?.count === String(countOrigin), `contador de «${cell(row, 'origen')}» ${countOrigin}`, `contador de «${cell(row, 'origen')}» ${originColumn?.count ?? '(sin leer)'}`),
      check(destination?.count === String(countTo), `contador de «${cell(row, 'destino')}» ${countTo}`, `contador de «${cell(row, 'destino')}» ${destination?.count ?? '(sin leer)'}`),
      check(destination?.cards.includes(code) === true, `${code} en la columna «${cell(row, 'destino')}»`, `${code} ${destination?.cards.includes(code) === true ? 'en' : 'no está en'} la columna «${cell(row, 'destino')}»`),
      check(persisted === to, `la API guarda ${code} en ${to}`, `la API da state ${persisted ?? '(sin leer)'}`),
    ],
    `Medido con el puntero: dragstart sobre ${code}; pointerOnTarget ${drag.pointerOnTarget ? 'sí' : 'no'}; draggable=${drag.draggable ?? '(sin leer)'}.`,
  );
};

// --- Esquema 2: arrastrar a una columna que la máquina no admite la devuelve a su columna ------------------------------------

const refusedDrag: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', TITLE_CELLS, cell(row, 'destino'));
  const aviso = strict('aviso', AVISO_CELLS, cell(row, 'aviso'));
  const expected = `arrastrar ${code} desde «Abierta» a «${cell(row, 'destino')}» muestra el aviso de error «${aviso}» y la tarjeta sigue en «Abierta» con el contador 4`;
  const failed = await prepareWeb(page, 'escritorio', CONSULTOR, expected);
  if (failed !== undefined) return failed;

  await armDragLog(page);
  await armToasts(page);
  const drag = await performDrag(page, code, to);
  if (!isDragOutcome(drag)) return dragProblem(expected, drag);
  if (!drag.started) return notStarted(expected, code, drag);

  const toast = await toastShown(page, 'danger', aviso);
  const view = await waitBoard(page, 'escritorio', (current) => settled(current) && columnOf(current, 'open')?.cards.includes(code) === true && columnOf(current, 'open')?.count === '4');
  const origin = view === undefined ? undefined : columnOf(view, 'open');
  const persisted = await persistedState(code);
  return verdictWeb(
    [
      check(toast.seen, `aviso de error «${aviso}»`, `aviso ${toast.observed}`),
      check(origin?.cards.includes(code) === true, `${code} sigue en «Abierta»`, `${code} ${origin?.cards.includes(code) === true ? 'sigue' : 'no está'} en «Abierta»`),
      check(origin?.count === '4', 'contador 4 en «Abierta»', `contador ${origin?.count ?? '(sin leer)'} en «Abierta»`),
      check(persisted === 'open', `la API sigue con ${code} en open`, `la API da state ${persisted ?? '(sin leer)'}`),
    ],
    `Medido con el puntero: dragstart sobre ${code}; marca de la columna de destino «${drag.dropOnTarget}» (la marca de una columna no admitida no está en la historia: solo evidencia). La devolución la hace la página tras la respuesta 409 del servidor.`,
  );
};

// --- Esquema 3: el menú de la tarjeta ofrece solo los pasos que la máquina admite --------------------------------------------

const menuOptions: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const steps = strict('pasos', MENU_CELLS, cell(row, 'pasos'));
  const expectedItems = [...MENU_BASE, ...steps];
  const expected = `las opciones del menú de ${code} son «Abrir detalle», «Comentario rápido…» y ${cell(row, 'pasos')}`;
  const failed = await prepareWeb(page, 'escritorio', CONSULTOR, expected);
  if (failed !== undefined) return failed;

  const menu = await readCardMenu(page, code);
  if (menu.blocked !== undefined) return actionFailed(expected, menu.blocked);
  const observed = (menu.entries ?? []).map((entry) => entry.text);
  const same = observed.length === expectedItems.length && expectedItems.every((item, index) => observed[index] === item);
  return verdictWeb([check(menu.entries !== undefined && same, `opciones del menú: ${expectedItems.join(' | ')}`, `opciones del menú: ${menu.entries === undefined ? '(sin leer)' : observed.join(' | ')}`)]);
};

// --- Esquema 4: quien solo lee no puede mover una tarjeta -------------------------------------------------------------------

const readOnlyRole: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', TITLE_CELLS, cell(row, 'destino'));
  const option = `Mover a «${cell(row, 'destino')}»`;
  const expected = `la tarjeta ${code} sigue en «Abierta» con el contador 4; la opción «${option}» del menú de ${code} está deshabilitada con el motivo «${READ_ONLY_REASON}»`;
  const failed = await prepareWeb(page, 'escritorio', AUDITOR, expected);
  if (failed !== undefined) return failed;

  await armDragLog(page);
  const drag = await performDrag(page, code, to);
  if (!isDragOutcome(drag)) return dragProblem(expected, drag);
  await settleLocal();
  const view = await waitBoard(page, 'escritorio', settled);
  const origin = view === undefined ? undefined : columnOf(view, 'open');
  const menu = await readCardMenu(page, code);
  const entry = menu.entries?.find((item) => item.text === option);
  return verdictWeb(
    [
      check(origin?.cards.includes(code) === true && origin?.count === '4', `${code} sigue en «Abierta» con el contador 4`, `${code} ${origin?.cards.includes(code) === true ? 'sigue' : 'no está'} en «Abierta», contador ${origin?.count ?? '(sin leer)'}`),
      check(drag.started === false && drag.draggable === 'false', 'ninguna tarjeta se arrastra (draggable=false)', `arrastre ${drag.started ? 'iniciado' : 'no iniciado'}; draggable=${drag.draggable ?? '(sin leer)'}`),
      controlCheck(entry, 'deshabilitado', READ_ONLY_REASON, `la opción «${option}» del menú de ${code}`),
    ],
    NOT_DRAGGABLE_NOTE,
  );
};

// --- Esquema 5: con menos de 1024 px «Mover a…» elige el paso en una hoja ----------------------------------------------------

const responsiveSheet: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', TITLE_CELLS, cell(row, 'destino'));
  const aviso = `${code} pasó a «${cell(row, 'destino')}»`;
  const expected = `pulsar «Mover a… (${code})» y elegir «Mover a «${cell(row, 'destino')}»» muestra el aviso «${aviso}» y deja la tarjeta en la pestaña «${cell(row, 'destino')}»`;
  const failed = await prepareWeb(page, 'responsive', CONSULTOR, expected);
  if (failed !== undefined) return failed;

  const opened = await interact(page.getByRole('button', { name: `Mover a… (${code})`, exact: true }), `pulsar «Mover a… (${code})»`, (element) => element.click(ACTION));
  if (opened !== undefined) return actionFailed(expected, opened);
  await armToasts(page);
  const chosen = await interact(page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NC_MENU_MOVE(to)), `elegir «Mover a «${cell(row, 'destino')}»» en la hoja`, (element) => element.click(ACTION));
  if (chosen !== undefined) return actionFailed(expected, chosen);
  // Lectura JUSTO tras elegir y sin pulsar ninguna pestaña: la app no cambia de pestaña al mover
  const justAfter = await readBoard(page, 'responsive');
  const selectedAfter = await attrOf(page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NC_TAB('open')), 'aria-selected');
  const panelAfter = justAfter === undefined ? undefined : columnOf(justAfter, 'open');
  const toast = await toastShown(page, 'ok', aviso);
  const persisted = await persistedState(code);
  // Criterio: «la tarjeta está en la pestaña «En análisis»» = aparece en esa pestaña (se abre para leerla)
  const tab = await interact(page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NC_TAB(to)), `elegir la pestaña «${cell(row, 'destino')}»`, (element) => element.click(ACTION));
  if (tab !== undefined) return actionFailed(expected, tab);
  const view = await waitBoard(page, 'responsive', (current) => columnOf(current, to)?.present === true && columnOf(current, to)?.cards.includes(code) === true);
  const panel = view === undefined ? undefined : columnOf(view, to);
  return verdictWeb(
    [
      check(toast.seen, `aviso «${aviso}»`, `aviso ${toast.observed}`),
      check(panel?.cards.includes(code) === true, `${code} en la pestaña «${cell(row, 'destino')}»`, `${code} ${panel?.cards.includes(code) === true ? 'en' : 'no está en'} la pestaña «${cell(row, 'destino')}» (panel con ${panel?.cards.join(', ') || '(ninguna)'})`),
      check(persisted === to, `la API guarda ${code} en ${to}`, `la API da state ${persisted ?? '(sin leer)'}`),
    ],
    `Tras elegir la opción y sin pulsar pestañas: aria-selected de «Abierta» = ${selectedAfter ?? '(sin leer)'}; ${code} ${panelAfter?.cards.includes(code) === true ? 'sigue' : 'no está'} en el panel visible. La app no cambia de pestaña sola (el criterio es que la tarjeta aparezca en la pestaña de destino, que se abre para leerla).`,
  );
};

// --- Esquema 6: un fallo del servidor al mover deja la tarjeta en su columna --------------------------------------------------

const serverFailure: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const status = strict('codigo_http', HTTP_CELLS, cell(row, 'codigo_http'));
  const expected = `con el servidor respondiendo ${cell(row, 'codigo_http')} al paso, arrastrar NC-001 de «Abierta» a «En análisis» muestra el aviso de error «No se pudo mover NC-001» y la tarjeta NC-001 sigue en «Abierta»`;
  const failed = await prepareWeb(page, 'escritorio', CONSULTOR, expected);
  if (failed !== undefined) return failed;

  const interception = await intercept(page, 'POST', '/api/nc/NC-001/transition', { kind: 'failFirst', status });
  await armDragLog(page);
  await armToasts(page);
  const drag = await performDrag(page, 'NC-001', 'in_analysis');
  if (!isDragOutcome(drag)) return dragProblem(expected, drag);
  if (!drag.started) return notStarted(expected, 'NC-001', drag);
  const toast = await toastShown(page, 'danger', 'No se pudo mover NC-001');
  const view = await waitBoard(page, 'escritorio', (current) => settled(current) && columnOf(current, 'open')?.cards.includes('NC-001') === true && columnOf(current, 'open')?.count === '4');
  const origin = view === undefined ? undefined : columnOf(view, 'open');
  return verdictWeb(
    [
      check(toast.seen, 'aviso de error «No se pudo mover NC-001»', `aviso ${toast.observed}`),
      check(origin?.cards.includes('NC-001') === true, 'NC-001 sigue en «Abierta»', `NC-001 ${origin?.cards.includes('NC-001') === true ? 'sigue' : 'no está'} en «Abierta»`),
    ],
    `La respuesta ${status} la fabrica la prueba: la petición no llega al servidor, así que esta fila no afirma persistencia (no se lee la API). Peticiones: ${interception.hits().join(' | ') || '(ninguna)'}. Tarjetas que se ven: ${view === undefined ? '(sin leer)' : cardsOnScreen(view).join(', ') || '(ninguna)'}.`,
  );
};

defineBrowserRows({
  story: 'US-NC-TABLERO-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(acceptedDrag)],
    [2, onWeb(refusedDrag)],
    [3, onWeb(menuOptions)],
    [4, onWeb(readOnlyRole)],
    [5, onWeb(responsiveSheet)],
    [6, onWeb(serverFailure)],
  ]),
});
