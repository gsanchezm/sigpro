import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, conclude, strict } from '../../support/checks';
import { ACTION, pathOf, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  actionMissing,
  clickOn,
  contractChecks,
  contractLink,
  delaySuppliers,
  faultEvidence,
  injectFailures,
  unchangedFor,
  countNavigations,
  prepFailedText,
  fichaChecks,
  fichaOf,
  listboxOf,
  literal,
  matchQuery,
  onWeb,
  openPath,
  panelOf,
  PANEL_WEB,
  prepFailed,
  programPath,
  runSteps,
  searchInputOf,
  seenCheck,
  settledPanel,
  signIn,
  type SearchSnapshot,
  typeInto,
  waitSearch,
  watchSearch,
} from './common';

// US-PROVEEDORES-003 — Buscar un proveedor del tenant desde el Resumen de un programa y ver su ficha (web, 1440 px). Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; después se entra con gestor@sigpro.test desde /login?tenant=alumno01 en un
// navegador sin sesión, y se abre /programs/PRG-001 (carga completa, con la sesión guardada).
//
// Notas de la prueba:
//  - el aviso de la búsqueda, la lista de opciones, el campo y la ficha se leen en UNA sola ejecución del DOM por instantánea;
//  - «Proveedor del tenant» se escribe tecla a tecla (la historia lo pide así); la búsqueda se pide al servidor 250 ms después;
//  - las teclas ↓ ↑ se pulsan cuando la lista ya muestra opciones (una persona espera a verlas antes de moverse por ellas).

const SEARCHING = 'Buscando proveedores…';
const SEARCH_ERROR = 'No se pudo buscar proveedores';
const REMOVE = 'Quitar proveedor seleccionado';

/** Una acción sobre el campo → el texto que escribe la persona (vacío = solo enfocar y abrir la lista). */
const ACCIONES: ReadonlyMap<string, string> = new Map<string, string>([
  ['abre «Proveedor del tenant» sin escribir', ''],
  ['escribe a en «Proveedor del tenant»', 'a'],
  ['escribe ca en «Proveedor del tenant»', 'ca'],
  ['escribe e en «Proveedor del tenant»', 'e'],
  ['escribe Sistemas en «Proveedor del tenant»', 'Sistemas'],
  ['escribe zzzzzz en «Proveedor del tenant»', 'zzzzzz'],
]);

/** Lo que dice la historia de la lista → número de opciones que se ven (0 = ninguna lista). */
const LISTAS: ReadonlyMap<string, number> = new Map<string, number>([
  ['ve cinco opciones', 5],
  ['ve una opción', 1],
  ['no ve ninguna lista de opciones', 0],
]);

/** Posición de la opción en la lista (1 = primera). */
const POSICIONES: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 0],
  ['2', 1],
  ['3', 2],
  ['4', 3],
  ['5', 4],
]);

/** Texto que escribe la persona para elegir cada proveedor (campo vacío antes de escribir): uno que lo identifica sin ambigüedad. */
const BUSQUEDA_DE: ReadonlyMap<string, string> = new Map<string, string>([
  ['Aeronáutica Levante S.L.', 'Levante'],
  ['Cibertáctica Norte', 'norte'],
  ['Electrónica del Cantábrico', 'Cantábrico'],
  ['Logística Marítima Atlas', 'Atlas'],
  ['Optrónica Meseta S.L.', 'Meseta'],
  ['Sistemas Ibéricos S.A.', 'IBÉRICOS'],
]);

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

const CODES_HTTP: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

/** Teclas de la celda → secuencia de teclas de Playwright. */
const TECLAS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['↓ y después Intro', ['ArrowDown', 'Enter']],
  ['↓ ocho veces y después Intro', ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']],
  ['↑ y después Intro', ['ArrowUp', 'Enter']],
]);

/** Salida de la lista → la acción que la cierra sin elegir. */
const SALIDAS: ReadonlyMap<string, 'esc' | 'fuera'> = new Map<string, 'esc' | 'fuera'>([
  ['pulsa Esc', 'esc'],
  ['pulsa fuera del campo, sobre el título «Proveedores» de la sección', 'fuera'],
]);

/** Preparación común: la cuenta entra y la ficha de PRG-001 se abre con la sección ya cargada. */
const summaryReady = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, programPath('PRG-001'));
  if (opened) return actionMissing(expected, opened);
  await settledPanel(page, PANEL_WEB);
  return undefined;
};

/** Enfoca el campo (abre la lista) y, si la historia escribe, escribe el texto tecla a tecla. */
const openAndType = async (page: Page, text: string, expected: string): Promise<Outcome | undefined> => {
  const focused = await clickOn(searchInputOf(page), 'enfocar «Proveedor del tenant»');
  if (focused) return actionMissing(expected, focused);
  if (text === '') return undefined;
  const typed = await typeInto(searchInputOf(page), text);
  return typed ? actionMissing(expected, typed) : undefined;
};

/** Elige un proveedor con el ratón: escribe el texto y pulsa su opción. */
const pickByMouse = async (page: Page, text: string, proveedor: string, expected: string): Promise<Outcome | undefined> => {
  const opened = await openAndType(page, text, expected);
  if (opened) return opened;
  await waitSearch(page, (snap) => snap.options.includes(proveedor));
  const clicked = await clickOn(listboxOf(page).getByRole('option').filter({ hasText: proveedor }), `pulsar la opción de ${proveedor}`);
  return clicked ? actionMissing(expected, clicked) : undefined;
};

/** Ficha abierta con el proveedor elegido y lista cerrada (la elección ya está hecha). */
const fichaShown =
  (proveedor: string) =>
  (snap: SearchSnapshot): boolean =>
    snap.fichaVisible && snap.value === proveedor && !snap.listVisible;

// --- Esquema 1: la búsqueda cuenta los proveedores que cumplen el texto y dice cuántos ve ----------------------------------------

const countAndNotice: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const text = strict('accion', ACCIONES, cell(row, 'accion'));
  const count = strict('lista', LISTAS, cell(row, 'lista'));
  const aviso = literal(cell(row, 'aviso'));
  const expected = `${cell(row, 'lista')} y el aviso de la búsqueda dice ${aviso}`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const typed = await openAndType(page, text, expected);
  if (typed) return typed;
  const snap = await waitSearch(page, (current) => current.status === aviso && (count === 0 ? !current.listVisible : current.listVisible && current.options.length === count));
  const listOk = count === 0 ? !snap.listVisible : snap.listVisible && snap.options.length === count;
  // Una sola letra: la longitud mínima de la búsqueda es una decisión pendiente (001); la fila no afirma ningún mínimo
  const note = text.length === 1 ? 'Una sola letra: la longitud mínima de la búsqueda es una decisión pendiente (001); la fila no afirma ningún mínimo.' : undefined;
  return conclude(
    [
      check(listOk, cell(row, 'lista'), count === 0 ? (snap.listVisible ? `ve una lista con ${snap.options.length} opciones` : 'no ve ninguna lista de opciones') : `ve ${snap.listVisible ? snap.options.length : 0} opciones`),
      check(snap.status === aviso, `el aviso dice ${aviso}`, `el aviso dice ${snap.status ?? '(no se ve)'}`),
    ],
    note === undefined ? {} : { note },
  );
};

// --- Esquema 2: sin texto, la lista enseña los cinco primeros proveedores por nombre -----------------------------------------------

const firstFive: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const position = strict('lugar', POSICIONES, cell(row, 'lugar'));
  const expected = `la opción ${cell(row, 'lugar')} de la lista es ${cell(row, 'opcion')}, y no ve «Sistemas Ibéricos S.A.» en la lista`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const opened = await openAndType(page, '', expected);
  if (opened) return opened;
  const snap = await waitSearch(page, (current) => current.options.length === 5);
  return conclude([
    check(snap.options[position] === cell(row, 'opcion'), `la opción ${cell(row, 'lugar')} es ${cell(row, 'opcion')}`, `la opción ${cell(row, 'lugar')} es ${snap.options[position] ?? '(no se ve)'}`),
    check(!snap.options.includes('Sistemas Ibéricos S.A.'), 'no ve «Sistemas Ibéricos S.A.» en la lista', snap.options.includes('Sistemas Ibéricos S.A.') ? 've «Sistemas Ibéricos S.A.» en la lista' : 'no ve «Sistemas Ibéricos S.A.» en la lista'),
  ]);
};

// --- Esquema 3: la búsqueda encuentra por NIF y sin distinguir mayúsculas -----------------------------------------------------------

const searchByNif: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const texto = cell(row, 'texto');
  const opcion = cell(row, 'opcion');
  const expected = `escribe ${texto} en «Proveedor del tenant» y la única opción es ${opcion}`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const opened = await openAndType(page, texto, expected);
  if (opened) return opened;
  const snap = await waitSearch(page, (current) => current.listVisible && current.options.length === 1);
  return conclude([
    check(snap.listVisible && snap.options.length === 1, 'una única opción', snap.listVisible ? `${snap.options.length} opciones` : 'ninguna lista de opciones'),
    check(snap.options[0] === opcion, `la única opción es ${opcion}`, `la opción es ${snap.options[0] ?? '(ninguna)'}`),
  ]);
};

// --- Esquema 4: mientras busca, el aviso dice que está buscando y luego muestra el resultado ---------------------------------

const searchingWhileWaiting: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = `mientras espera, el aviso dice «${SEARCHING}» y no ve ninguna opción; al llegar la respuesta la única opción es Aeronáutica Levante S.L.`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  await delaySuppliers(page, matchQuery('Levante'), delay);
  const opened = await openAndType(page, 'Levante', expected);
  if (opened) return opened;
  const snaps = await watchSearch(page, (current) => current.listVisible && current.options.length > 0);
  const searching = snaps.filter((snap) => snap.status === SEARCHING);
  const leak = searching.find((snap) => snap.options.length > 0);
  const last = snaps[snaps.length - 1];
  return conclude(
    [
      check(searching.length > 0, `ve el aviso «${SEARCHING}» mientras espera`, searching.length > 0 ? `ve el aviso «${SEARCHING}» mientras espera` : `no ve el aviso «${SEARCHING}»`),
      check(leak === undefined, 'no ve ninguna opción mientras espera', leak === undefined ? 'no ve ninguna opción mientras espera' : `ve ${leak.options.length} opciones a los ${leak.atMs} ms`),
      check(last?.listVisible === true && last.options.length === 1 && last.options[0] === 'Aeronáutica Levante S.L.', 'la única opción es Aeronáutica Levante S.L.', `opciones: ${last?.options.join(', ') || '(ninguna)'}`),
    ],
    { evidence: { delayMs: delay, snapshots: snaps.length, searchingSnapshots: searching.length } },
  );
};

// --- Esquema 5: un fallo de la búsqueda muestra su aviso y no ofrece opciones -----------------------------------------------------

const failedSearch: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `el aviso de la búsqueda dice «${SEARCH_ERROR}» y no ve ninguna lista de opciones`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  // Todas las peticiones de «fall» fallan: la búsqueda se pide una sola vez tras la pausa, pero no depende de cuántas
  // Todas las peticiones de «fall» responden con el error (la historia dice «responda», no «la primera»)
  const faults = await injectFailures(page, matchQuery('fall'), status, 'always');
  const opened = await openAndType(page, 'fall', expected);
  if (opened) return opened;
  const snap = await waitSearch(page, (current) => current.status === SEARCH_ERROR);
  return conclude(
    [
      check(snap.status === SEARCH_ERROR, `el aviso dice «${SEARCH_ERROR}»`, `el aviso dice ${snap.status ?? '(no se ve)'}`),
      check(!snap.listVisible, 'no ve ninguna lista de opciones', snap.listVisible ? 've una lista de opciones' : 'no ve ninguna lista de opciones'),
    ],
    { evidence: faultEvidence(faults) },
  );
};

// --- Esquema 6: elegir un proveedor con el ratón muestra su ficha ---------------------------------------------------------------

const pickWithMouse: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `el campo muestra ${proveedor}, la lista se cierra y aparece la ficha de proveedor de ${proveedor} con NIF ${cell(row, 'nif')}, correo ${cell(row, 'correo')} y estado ${literal(cell(row, 'estado'))}`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const before = await settledPanel(page, PANEL_WEB);
  const picked = await pickByMouse(page, cell(row, 'texto'), proveedor, expected);
  if (picked) return picked;
  const snap = await waitSearch(page, fichaShown(proveedor));
  const ficha = await fichaChecks(page, proveedor, cell(row, 'nif'), cell(row, 'correo'), cell(row, 'estado'));
  return conclude([
    check(snap.value === proveedor, `el campo muestra ${proveedor}`, `el campo muestra ${snap.value ?? '(sin leer)'}`),
    check(!snap.listVisible, 'la lista de opciones se cierra', snap.listVisible ? 'la lista sigue abierta' : 'la lista de opciones se cierra'),
    ...ficha,
    await unchangedFor(page, PANEL_WEB, before),
  ]);
};

// --- Esquema 7: cada contrato de la ficha muestra su programa, su importe y su fecha de firma ----------------------------------

const contractLine: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `en la línea del contrato con ${cell(row, 'codigo')} ve ${cell(row, 'nombre_programa')}, el importe ${literal(cell(row, 'importe'))} y ${literal(cell(row, 'firma'))}`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const picked = await pickByMouse(page, strict('busqueda', BUSQUEDA_DE, proveedor), proveedor, expected);
  if (picked) return picked;
  await waitSearch(page, fichaShown(proveedor));
  return conclude(
    await contractChecks(page, cell(row, 'codigo'), cell(row, 'nombre_programa'), cell(row, 'importe'), cell(row, 'firma')),
  );
};

// --- Esquema 8: el código de un contrato lleva a su programa --------------------------------------------------------------------

const contractCodeLink: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const expected = `al pulsar el código ${codigo} de un contrato de la ficha llega a /programs/${codigo}`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const picked = await pickByMouse(page, 'Levante', 'Aeronáutica Levante S.L.', expected);
  if (picked) return picked;
  await waitSearch(page, fichaShown('Aeronáutica Levante S.L.'));
  // El enlace debe llevar a la ruta del programa (su destino se lee antes de pulsar)
  const href = await safe(() => contractLink(page, codigo).getAttribute('href', { timeout: 1_000 }), null);
  const navigations = countNavigations(page);
  const pressed = await clickOn(contractLink(page, codigo), `pulsar el código ${codigo}`);
  if (pressed) return actionMissing(expected, pressed);
  const arrived = await waitUntil(async () => pathOf(page) === programPath(codigo));
  // Con PRG-001 la página ya está en esa ruta: la ruta no distingue el clic. El destino del enlace (href) sí se comprueba, y el número
  // de navegaciones del marco principal va en la evidencia (las navegaciones sin recarga también cuentan).
  const note =
    codigo === 'PRG-001'
      ? 'La fila no distingue el toque: la ruta ya es la de destino (PRG-001). Se comprueba el destino del enlace (href); el número de navegaciones va en la evidencia.'
      : undefined;
  return conclude(
    [check(href === programPath(codigo), `el enlace lleva a ${programPath(codigo)}`, `el enlace lleva a ${href ?? '(sin leer)'}`), check(arrived.reached, `llega a ${programPath(codigo)}`, `llega a ${pathOf(page)}`)],
    { ...(note === undefined ? {} : { note }), evidence: { navegacionesDespuesDelClic: navigations.count() } },
  );
};

// --- Esquema 9: con el teclado se elige la opción activa ------------------------------------------------------------------------

const keyboardPick: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const keys = strict('teclas', TECLAS, cell(row, 'teclas'));
  const proveedor = cell(row, 'proveedor');
  const expected = `enfoca «Proveedor del tenant» y pulsa ${cell(row, 'teclas')}: el campo muestra ${proveedor} y aparece su ficha de proveedor`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const opened = await openAndType(page, '', expected);
  if (opened) return opened;
  await waitSearch(page, (current) => current.listVisible && current.options.length > 0);
  // Todas las teclas menos la última (Intro) mueven la opción activa; Intro la elige
  const movement = keys.slice(0, -1);
  const confirm = keys[keys.length - 1] ?? 'Enter';
  for (const key of movement) {
    const pressed = await runSteps([[`pulsar la tecla ${key}`, () => searchInputOf(page).press(key, ACTION)]]);
    if (pressed) return actionMissing(expected, pressed);
  }
  // Con «↑» la primera opción ya está activa al abrir la lista: la comprobación es que ↑ no saca de la lista
  const isUp = movement.length === 1 && movement[0] === 'ArrowUp';
  const active = await waitSearch(page, (current) => current.listVisible && current.active === proveedor);
  const activeOk = active.listVisible && active.active === proveedor;
  const pressed = await runSteps([[`pulsar la tecla ${confirm}`, () => searchInputOf(page).press(confirm, ACTION)]]);
  if (pressed) return actionMissing(expected, pressed);
  const snap = await waitSearch(page, fichaShown(proveedor));
  const note = isUp
    ? 'Ninguna fila prueba que ↑ mueva la opción: la primera ya está activa al abrir la lista. Esta fila solo comprueba que ↑ no saca de la lista.'
    : undefined;
  return conclude(
    [
      isUp
        ? check(activeOk, 'con ↑ no sale de la lista: la lista sigue abierta y la primera opción sigue activa', `con ↑ la lista ${active.listVisible ? 'sigue abierta' : 'se cierra'} y la opción activa es ${active.active ?? '(ninguna)'}`)
        : check(activeOk, `la opción activa es ${proveedor} antes de Intro`, `la opción activa es ${active.active ?? '(ninguna)'} antes de Intro`),
      check(snap.value === proveedor, `el campo muestra ${proveedor}`, `el campo muestra ${snap.value ?? '(sin leer)'}`),
      await seenCheck(fichaOf(page).getByText(`Ficha de proveedor: ${proveedor}`, { exact: true }), `la ficha de proveedor de ${proveedor}`, `la ficha de proveedor de ${proveedor}`),
    ],
    note === undefined ? {} : { note },
  );
};

// --- Esquema 10: Esc o salir del campo cierra la lista sin elegir -------------------------------------------------------------

const closeWithoutPicking: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const salida = strict('salida', SALIDAS, cell(row, 'salida'));
  const expected = `${cell(row, 'salida')}: no ve ninguna lista de opciones, el campo sigue con el texto «ca» y no aparece ninguna ficha de proveedor`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const opened = await openAndType(page, 'ca', expected);
  if (opened) return opened;
  // Antes de la salida: la lista debe estar abierta con sus 5 opciones; si no, la fila no prueba nada
  const open = await waitSearch(page, (current) => current.listVisible && current.options.length === 5);
  if (!(open.listVisible && open.options.length === 5)) {
    return prepFailedText(expected, `la lista de opciones no se abrió con «ca» antes de la salida (${open.listVisible ? `${open.options.length} opciones` : 'sin lista'})`);
  }
  const action =
    salida === 'esc'
      ? runSteps([['pulsar Esc', () => searchInputOf(page).press('Escape', ACTION)]])
      : clickOn(panelOf(page).getByRole('heading', { name: 'Proveedores', exact: true }), 'pulsar el título «Proveedores» de la sección');
  const failed = await action;
  if (failed) return actionMissing(expected, failed);
  const snap = await waitSearch(page, (current) => !current.listVisible);
  return conclude([
    check(!snap.listVisible, 'no ve ninguna lista de opciones', snap.listVisible ? 've una lista de opciones' : 'no ve ninguna lista de opciones'),
    check(snap.value === 'ca', 'el campo sigue con el texto «ca»', `el campo tiene «${snap.value ?? '(sin leer)'}»`),
    check(!snap.fichaVisible, 'no aparece ninguna ficha de proveedor', snap.fichaVisible ? 'aparece una ficha de proveedor' : 'no aparece ninguna ficha de proveedor'),
  ]);
};

// --- Esquema 11: el botón de quitar la elección deja el campo vacío y oculta la ficha -----------------------------------------

const removeChoice: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `al pulsar «${REMOVE}» el campo «Proveedor del tenant» queda vacío y no aparece ninguna ficha de proveedor`;
  const ready = await summaryReady(page, expected);
  if (ready) return ready;
  const picked = await pickByMouse(page, strict('busqueda', BUSQUEDA_DE, proveedor), proveedor, expected);
  if (picked) return picked;
  await waitSearch(page, fichaShown(proveedor));
  const before = await settledPanel(page, PANEL_WEB);
  const removed = await clickOn(page.getByRole('button', { name: REMOVE, exact: true }), `pulsar «${REMOVE}»`);
  if (removed) return actionMissing(expected, removed);
  const snap = await waitSearch(page, (current) => current.value === '' && !current.fichaVisible);
  return conclude([
    check(snap.value === '', 'el campo «Proveedor del tenant» queda vacío', `el campo tiene «${snap.value ?? '(sin leer)'}»`),
    check(!snap.fichaVisible, 'no aparece ninguna ficha de proveedor', snap.fichaVisible ? 'aparece una ficha de proveedor' : 'no aparece ninguna ficha de proveedor'),
    await unchangedFor(page, PANEL_WEB, before),
  ]);
};

defineBrowserRows({
  story: 'US-PROVEEDORES-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(countAndNotice)],
    [2, onWeb(firstFive)],
    [3, onWeb(searchByNif)],
    [4, onWeb(searchingWhileWaiting)],
    [5, onWeb(failedSearch)],
    [6, onWeb(pickWithMouse)],
    [7, onWeb(contractLine)],
    [8, onWeb(contractCodeLink)],
    [9, onWeb(keyboardPick)],
    [10, onWeb(closeWithoutPicking)],
    [11, onWeb(removeChoice)],
  ]),
});
