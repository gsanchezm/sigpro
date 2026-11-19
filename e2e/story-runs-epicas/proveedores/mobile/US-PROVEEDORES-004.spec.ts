import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { CEILING_MS, pathOf, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  actionMissing,
  buttonNamesOf,
  clickOn,
  contractChecks,
  contractLink,
  delaySuppliers,
  faultEvidence,
  fichaChecks,
  injectFailures,
  leavesOf,
  literal,
  matchProgram,
  matchQuery,
  goneFor,
  countNavigations,
  panelOf,
  prepFailed,
  programPath,
  same,
  seenCheck,
  typeInto,
  unchangedFor,
  waitPanelUntil,
  type SearchSnapshot,
} from '../web/common';
import { cardOf, chooseSuppliers, onExpoWeb, openDetail, PANEL_MOVIL, resultsOf, searchFieldOf, settledMobilePanel, signIn, waitMobileSearch, watchMobilePanel } from './common';

// US-PROVEEDORES-004 — Ver los proveedores contratados y buscar un proveedor en la pestaña «Proveedores» (app móvil como web de Expo a 390 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; después la app se deja en /login sin sesión guardada, con
// alumno01 en «Tenant de trabajo», la cuenta de la fila inicia sesión y se abre la ruta de la fila (carga completa, con la sesión guardada).
// El veredicto vale para Expo web: NO es iOS ni Android nativo.

const ERROR_TITLE = 'No se pudieron cargar los proveedores';
const LOADING = 'Cargando…';
const RETRY = 'Reintentar';
const REMOVE = 'Quitar proveedor seleccionado';
const EMPTY_MESSAGE = 'Este programa no tiene proveedores contratados.';
const SEARCH_ERROR = 'No se pudo buscar proveedores';
/** Palabras de los botones de edición: el panel de solo lectura no debe ofrecer ninguna. */
const EDIT_BUTTON = /añadir|agregar|editar|eliminar|borrar|asignar|quitar|nuevo|nueva/i;

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

const CODES_HTTP: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Lugar de la lista → posición (0 = primero). */
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

/** Código de programa de la historia → código (la fila de contrato solo cita PRG-001 y PRG-002, pero la columna trae más valores). */
const CODIGOS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-009', 'PRG-009'],
  ['PRG-013', 'PRG-013'],
]);

/** NIF de cada proveedor del seed, como lo fija la tabla de la historia 001 (cada opción del buscador debe mostrar el suyo). */
const NIF_DE: ReadonlyMap<string, string> = new Map<string, string>([
  ['Aeronáutica Levante S.L.', 'B11111111'],
  ['Sistemas Ibéricos S.A.', 'B12222222'],
  ['Electrónica del Cantábrico', 'B13333333'],
  ['Optrónica Meseta S.L.', 'B14444444'],
  ['Cibertáctica Norte', 'B15555555'],
  ['Logística Marítima Atlas', 'B16666666'],
]);

/** Una opción muestra su nombre (hoja exacta) y su NIF (hoja exacta) entre sus textos. */
const optionShowsNameAndNif = (name: string, leaves: readonly string[]): boolean => {
  const nif = NIF_DE.get(name);
  return nif !== undefined && leaves.some((leaf) => leaf === name) && leaves.some((leaf) => leaf === nif);
};

/** Lo que dice la historia de la fila «contenido» → lo que se ve en el panel. */
interface CardExpect {
  readonly kind: 'tarjeta';
  readonly nombre: string;
  readonly nif: string;
  readonly importe: string;
  readonly estado: string;
}
interface EmptyExpect {
  readonly kind: 'vacio';
}
const CONTENIDOS: ReadonlyMap<string, CardExpect | EmptyExpect> = new Map<string, CardExpect | EmptyExpect>([
  ['una tarjeta de Aeronáutica Levante S.L. con NIF B11111111, importe 150.000 € y estado «Aprobado»', { kind: 'tarjeta', nombre: 'Aeronáutica Levante S.L.', nif: 'B11111111', importe: '150.000 €', estado: 'Aprobado' }],
  ['una tarjeta de Cibertáctica Norte con NIF B15555555, importe 350.000 € y estado «No aprobado»', { kind: 'tarjeta', nombre: 'Cibertáctica Norte', nif: 'B15555555', importe: '350.000 €', estado: 'No aprobado' }],
  ['el mensaje «Este programa no tiene proveedores contratados.» y ninguna tarjeta', { kind: 'vacio' }],
]);

const ACCIONES: ReadonlyMap<string, string> = new Map<string, string>([
  ['toca «Proveedor del tenant» sin escribir', ''],
  ['escribe a en «Proveedor del tenant»', 'a'],
  ['escribe ca en «Proveedor del tenant»', 'ca'],
  ['escribe e en «Proveedor del tenant»', 'e'],
  ['escribe Sistemas en «Proveedor del tenant»', 'Sistemas'],
  ['escribe zzzzzz en «Proveedor del tenant»', 'zzzzzz'],
]);

const LISTAS: ReadonlyMap<string, number> = new Map<string, number>([
  ['ve cinco opciones', 5],
  ['ve una opción', 1],
  ['no ve ninguna lista de opciones', 0],
]);

/** Preparación común: la cuenta entra y se abre la ruta de la fila. */
const readyFor = async (page: Page, credentials: Credentials, path: string, expected: string): Promise<Outcome | undefined> => {
  const signed = await signIn(page, credentials);
  if (signed) return prepFailed(expected, signed);
  const opened = await openDetail(page, path);
  return opened ? actionMissing(expected, opened) : undefined;
};

/** Elige la pestaña «Proveedores» (la preparación de las filas del panel). */
const withSuppliersTab = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const chosen = await chooseSuppliers(page);
  return chosen ? actionMissing(expected, chosen) : undefined;
};

/** Texto que comprueba un «Entonces» sobre las hojas de una tarjeta o de una línea: aparece como hoja exacta. */
const hasLeaf = (leaves: readonly string[], text: string): boolean => leaves.some((leaf) => same(leaf, text));

/** Toca el campo y escribe el texto (vacío = solo tocar y abrir la lista). */
const openSearch = async (page: Page, text: string, expected: string): Promise<Outcome | undefined> => {
  const touched = await clickOn(searchFieldOf(page), 'tocar «Proveedor del tenant»');
  if (touched) return actionMissing(expected, touched);
  if (text === '') return undefined;
  const typed = await typeInto(searchFieldOf(page), text);
  return typed ? actionMissing(expected, typed) : undefined;
};

/** Elige un proveedor tocando su opción: escribe el texto y toca la opción con su nombre. */
const pickByTap = async (page: Page, text: string, proveedor: string, expected: string): Promise<Outcome | undefined> => {
  const opened = await openSearch(page, text, expected);
  if (opened) return opened;
  await waitMobileSearch(page, (snap) => snap.options.includes(proveedor));
  const tapped = await clickOn(resultsOf(page).getByRole('option').filter({ hasText: proveedor }), `tocar la opción de ${proveedor}`);
  return tapped ? actionMissing(expected, tapped) : undefined;
};

/** Ficha abierta con el proveedor elegido y lista cerrada. */
const fichaShown = (proveedor: string) => (snap: SearchSnapshot): boolean => snap.fichaVisible && snap.value === proveedor && !snap.listVisible;

// --- Esquema 1: la pestaña lista los proveedores contratados o dice que no hay ninguno ----------------------------------------

const listedOrEmpty: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const contenido = strict('contenido', CONTENIDOS, cell(row, 'contenido'));
  const counter = literal(cell(row, 'contador'));
  const expected = `en «Proveedores» el contador ${counter} y ${cell(row, 'contenido')}`;
  const ready = await readyFor(page, DEMO.gestor, programPath(cell(row, 'codigo')), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const panel = await settledMobilePanel(page);
  const checks: Check[] = [check(panel.counter === counter, `el contador ${counter}`, `el contador ${panel.counter ?? '(no se ve)'}`)];
  if (contenido.kind === 'vacio') {
    checks.push(check(panel.emptyText !== null && same(panel.emptyText, EMPTY_MESSAGE), `el mensaje «${EMPTY_MESSAGE}»`, `el mensaje ${panel.emptyText === null ? '(no se ve)' : `«${panel.emptyText}»`}`));
    checks.push(check(panel.rowNames.length === 0, 'ninguna tarjeta', `${panel.rowNames.length} tarjetas`));
    return conclude(checks);
  }
  const leaves = await leavesOf(cardOf(page, contenido.nombre));
  checks.push(check(leaves.length > 0, `una tarjeta de ${contenido.nombre}`, leaves.length > 0 ? `una tarjeta de ${contenido.nombre}` : `no se ve la tarjeta de ${contenido.nombre}`));
  checks.push(check(hasLeaf(leaves, `NIF ${contenido.nif}`), `NIF ${contenido.nif}`, `NIF ${hasLeaf(leaves, `NIF ${contenido.nif}`) ? contenido.nif : '(no se ve)'}`));
  checks.push(check(hasLeaf(leaves, `Importe ${contenido.importe}`), `importe ${contenido.importe}`, `importe ${hasLeaf(leaves, `Importe ${contenido.importe}`) ? contenido.importe : '(no se ve)'}`));
  checks.push(check(hasLeaf(leaves, contenido.estado), `estado ${contenido.estado}`, `estado ${hasLeaf(leaves, contenido.estado) ? contenido.estado : '(no se ve)'}`));
  return conclude(checks);
};

// --- Esquema 2: la pestaña muestra «Cargando…» hasta que llega la lista --------------------------------------------------------

const loadingTab: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = 'mientras espera ve «Cargando…» y no ve ninguna tarjeta ni el contador; al llegar la respuesta ve la tarjeta de Aeronáutica Levante S.L.';
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  await delaySuppliers(page, matchProgram('PRG-001'), delay);
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const snaps = await watchMobilePanel(page);
  const withLoader = snaps.filter((snap) => snap.loading);
  const leak = withLoader.find((snap) => snap.rowNames.length > 0 || snap.counter !== null);
  const leaves = await leavesOf(cardOf(page, 'Aeronáutica Levante S.L.'));
  return conclude(
    [
      check(withLoader.some((snap) => snap.loadingText === LOADING), `ve «${LOADING}» mientras espera`, withLoader.length > 0 ? `ve «${withLoader[0]?.loadingText ?? '(sin texto)'}» mientras espera` : `no ve «${LOADING}»`),
      check(leak === undefined, 'no ve ninguna tarjeta ni el contador mientras espera', leak === undefined ? 'no ve ninguna tarjeta ni el contador mientras espera' : `ve tarjetas o contador a los ${leak.atMs} ms`),
      check(leaves.length > 0, 'al llegar la respuesta ve la tarjeta de Aeronáutica Levante S.L.', leaves.length > 0 ? 've la tarjeta de Aeronáutica Levante S.L.' : 'no ve la tarjeta de Aeronáutica Levante S.L.'),
    ],
    { evidence: { delayMs: delay, snapshots: snaps.length, firstLoadingAtMs: withLoader[0]?.atMs ?? null } },
  );
};

// --- Esquema 3: un fallo de la lista muestra el aviso de error con su botón de reintento ----------------------------------------

const failedTab: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `ve el título «${ERROR_TITLE}» y el botón «${RETRY}», y no ve ninguna tarjeta ni el contador`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  // La primera petición de la lista responde con el error; las siguientes (si las hubiera) llegan al servidor
  const faults = await injectFailures(page, matchProgram('PRG-001'), status, 1);
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const panel = await settledMobilePanel(page);
  const alert = panelOf(page).getByRole('alert').filter({ hasText: ERROR_TITLE });
  return conclude(
    [
      await seenCheck(alert, `el título «${ERROR_TITLE}»`, `el título «${ERROR_TITLE}»`),
      await seenCheck(alert.getByRole('button', { name: RETRY, exact: true }), `el botón «${RETRY}»`, `el botón «${RETRY}»`),
      check(panel.rowNames.length === 0 && panel.counter === null, 'ninguna tarjeta ni el contador', `${panel.rowNames.length} tarjetas y contador ${panel.counter ?? '(no se ve)'}`),
    ],
    { evidence: faultEvidence(faults) },
  );
};

// --- Esquema 4: «Reintentar» vuelve a pedir la lista y la muestra -----------------------------------------------------------

const retryTab: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `al ver el aviso «${ERROR_TITLE}», pulsar «${RETRY}»; ve la tarjeta de Aeronáutica Levante S.L. y ya no ve el aviso`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  // La primera petición de la lista responde con el error; «Reintentar» (la segunda) llega al servidor
  const faults = await injectFailures(page, matchProgram('PRG-001'), status, 1);
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const before = await settledMobilePanel(page);
  const pressed = await clickOn(panelOf(page).getByRole('button', { name: RETRY, exact: true }), `pulsar «${RETRY}»`);
  if (pressed) return actionMissing(expected, pressed);
  // Se espera a que la lista recargada aparezca (o a que se agote el techo) antes de juzgar
  await waitPanelUntil(page, (snap) => !snap.error && snap.rowNames.includes('Aeronáutica Levante S.L.'), PANEL_MOVIL);
  const leaves = await leavesOf(cardOf(page, 'Aeronáutica Levante S.L.'));
  const alertGone = await goneFor(panelOf(page).getByRole('alert').filter({ hasText: ERROR_TITLE }), `ya no ve el aviso «${ERROR_TITLE}»`, `el aviso «${ERROR_TITLE}»`);
  return conclude(
    [
      check(before.error, `ve el aviso «${ERROR_TITLE}» antes de pulsar`, before.error ? `ve el aviso «${ERROR_TITLE}» antes de pulsar` : 'no ve el aviso antes de pulsar'),
      check(leaves.length > 0, 've la tarjeta de Aeronáutica Levante S.L.', leaves.length > 0 ? 've la tarjeta de Aeronáutica Levante S.L.' : 'no ve la tarjeta de Aeronáutica Levante S.L.'),
      alertGone,
    ],
    {
      note: 'La historia dice «la primera petición» responde con el error: la prueba falla solo la primera petición de la lista y deja pasar las siguientes. Los conteos (provocadas, falladas, dejadas pasar) van en la evidencia.',
      evidence: faultEvidence(faults),
    },
  );
};

// --- Esquema 5: todos los roles ven el panel en modo de solo lectura -----------------------------------------------------------

const readOnlyForEveryRole: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = 've la tarjeta de Aeronáutica Levante S.L. con estado «Aprobado» y no ve ningún botón para añadir, editar o eliminar proveedores del programa';
  const ready = await readyFor(page, credentials, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  await settledMobilePanel(page);
  const leaves = await leavesOf(cardOf(page, 'Aeronáutica Levante S.L.'));
  const buttons = await buttonNamesOf(page);
  const editing = buttons?.filter((name) => EDIT_BUTTON.test(name)) ?? [];
  return conclude([
    check(hasLeaf(leaves, 'Aprobado'), 'la tarjeta de Aeronáutica Levante S.L. con estado «Aprobado»', hasLeaf(leaves, 'Aprobado') ? 'la tarjeta con estado «Aprobado»' : 'sin tarjeta o sin estado «Aprobado»'),
    check(buttons !== undefined && editing.length === 0, 'ningún botón para añadir, editar o eliminar proveedores', buttons === undefined ? 'botones sin leer' : editing.length === 0 ? 'ningún botón para añadir, editar o eliminar proveedores' : `botones de edición: ${editing.join(', ')}`),
  ]);
};

// --- Esquema 6: la búsqueda cuenta los proveedores que cumplen el texto y dice cuántos ve -------------------------------------

const countAndNoticeMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const text = strict('accion', ACCIONES, cell(row, 'accion'));
  const count = strict('lista', LISTAS, cell(row, 'lista'));
  const aviso = literal(cell(row, 'aviso'));
  const expected = `${cell(row, 'lista')} y el aviso de la búsqueda dice ${aviso}`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const opened = await openSearch(page, text, expected);
  if (opened) return opened;
  const snap = await waitMobileSearch(page, (current) => current.status === aviso && (count === 0 ? !current.listVisible : current.listVisible && current.options.length === count));
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

// --- Esquema 7: sin texto, la lista enseña los cinco primeros proveedores por nombre -----------------------------------------

const firstFiveMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const position = strict('lugar', POSICIONES, cell(row, 'lugar'));
  const expected = `la opción ${cell(row, 'lugar')} de la lista es ${cell(row, 'opcion')}, y no ve «Sistemas Ibéricos S.A.» en la lista`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const opened = await openSearch(page, '', expected);
  if (opened) return opened;
  const snap = await waitMobileSearch(page, (current) => current.options.length === 5);
  return conclude([
    check(snap.options[position] === cell(row, 'opcion'), `la opción ${cell(row, 'lugar')} es ${cell(row, 'opcion')}`, `la opción ${cell(row, 'lugar')} es ${snap.options[position] ?? '(no se ve)'}`),
    check(!snap.options.includes('Sistemas Ibéricos S.A.'), 'no ve «Sistemas Ibéricos S.A.» en la lista', snap.options.includes('Sistemas Ibéricos S.A.') ? 've «Sistemas Ibéricos S.A.» en la lista' : 'no ve «Sistemas Ibéricos S.A.» en la lista'),
    // La regla: cada opción muestra el nombre y el NIF del proveedor (NIF de la historia 001)
    check(
      snap.options.length > 0 && snap.options.every((name, index) => optionShowsNameAndNif(name, snap.optionLeaves[index] ?? [])),
      'cada opción muestra su nombre y su NIF',
      snap.options.length === 0 ? '(sin opciones)' : snap.options.map((name, index) => (optionShowsNameAndNif(name, snap.optionLeaves[index] ?? []) ? `${name} con su NIF` : `${name} sin su NIF`)).join('; '),
    ),
  ]);
};

// --- Esquema 8: un fallo de la búsqueda muestra su aviso y no ofrece opciones -------------------------------------------------

const failedSearchMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `el aviso de la búsqueda dice «${SEARCH_ERROR}» y no ve ninguna lista de opciones`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  // Todas las peticiones de «fall» responden con el error (la historia dice «responda», no «la primera»)
  const faults = await injectFailures(page, matchQuery('fall'), status, 'always');
  const typed = await openSearch(page, 'fall', expected);
  if (typed) return typed;
  const snap = await waitMobileSearch(page, (current) => current.status === SEARCH_ERROR);
  return conclude(
    [
      check(snap.status === SEARCH_ERROR, `el aviso dice «${SEARCH_ERROR}»`, `el aviso dice ${snap.status ?? '(no se ve)'}`),
      check(!snap.listVisible, 'no ve ninguna lista de opciones', snap.listVisible ? 've una lista de opciones' : 'no ve ninguna lista de opciones'),
    ],
    { evidence: faultEvidence(faults) },
  );
};

// --- Esquema 9: tocar un proveedor muestra su ficha ------------------------------------------------------------------------

const tapSupplier: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `el campo muestra ${proveedor}, la lista se cierra y ve la ficha de proveedor de ${proveedor} con NIF ${cell(row, 'nif')}, correo ${cell(row, 'correo')} y estado ${literal(cell(row, 'estado'))}`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const before = await settledMobilePanel(page);
  const picked = await pickByTap(page, cell(row, 'texto'), proveedor, expected);
  if (picked) return picked;
  const snap = await waitMobileSearch(page, fichaShown(proveedor));
  const ficha = await fichaChecks(page, proveedor, cell(row, 'nif'), cell(row, 'correo'), cell(row, 'estado'));
  return conclude([
    check(snap.value === proveedor, `el campo muestra ${proveedor}`, `el campo muestra ${snap.value ?? '(sin leer)'}`),
    check(!snap.listVisible, 'la lista se cierra', snap.listVisible ? 'la lista sigue abierta' : 'la lista se cierra'),
    ...ficha,
    await unchangedFor(page, PANEL_MOVIL, before),
  ]);
};

// --- Esquema 10: cada contrato de la ficha muestra su programa, su importe y su fecha de firma -----------------------------

const contractLine: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `en la línea del contrato con ${cell(row, 'codigo')} ve ${cell(row, 'nombre_programa')}, el importe ${literal(cell(row, 'importe'))} y ${literal(cell(row, 'firma'))}`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const picked = await pickByTap(page, strict('busqueda', BUSQUEDA_DE, proveedor), proveedor, expected);
  if (picked) return picked;
  await waitMobileSearch(page, fichaShown(proveedor));
  return conclude(await contractChecks(page, cell(row, 'codigo'), cell(row, 'nombre_programa'), cell(row, 'importe'), cell(row, 'firma')));
};

// --- Esquema 11: el código de un contrato lleva a su programa -----------------------------------------------------------------

const contractCodeLink: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('codigo', CODIGOS, cell(row, 'codigo'));
  const expected = `al tocar el código ${codigo} de un contrato de la ficha llega a /programs/${codigo}`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const picked = await pickByTap(page, 'Levante', 'Aeronáutica Levante S.L.', expected);
  if (picked) return picked;
  await waitMobileSearch(page, fichaShown('Aeronáutica Levante S.L.'));
  // Las navegaciones del marco principal (también las que no recargan la página) se cuentan desde antes del toque
  const navigations = countNavigations(page);
  const pressed = await clickOn(contractLink(page, codigo), `tocar el código ${codigo}`);
  if (pressed) return actionMissing(expected, pressed);
  const arrived = await waitUntil(async () => pathOf(page) === programPath(codigo), CEILING_MS);
  // Con PRG-001 la página ya está en esa ruta: la comprobación de la ruta no distingue el toque, y el enlace de la ficha no tiene destino
  // legible (es un botón de la app móvil). El número de navegaciones va en la evidencia como única señal del toque.
  const note =
    codigo === 'PRG-001'
      ? 'La fila no distingue el toque: la ruta ya es la de destino (PRG-001) y el enlace móvil no expone su destino. El número de navegaciones va en la evidencia.'
      : undefined;
  return conclude([check(arrived.reached, `llega a ${programPath(codigo)}`, `llega a ${pathOf(page)}`)], {
    ...(note === undefined ? {} : { note }),
    evidence: { navegacionesDespuesDelToque: navigations.count() },
  });
};

// --- Esquema 12: «Quitar proveedor seleccionado» deja el campo vacío y oculta la ficha ------------------------------------

const removeChoiceMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const proveedor = cell(row, 'proveedor');
  const expected = `al tocar «${REMOVE}» el campo «Proveedor del tenant» queda vacío y no ve ninguna ficha de proveedor`;
  const ready = await readyFor(page, DEMO.gestor, programPath('PRG-001'), expected);
  if (ready) return ready;
  const chosen = await withSuppliersTab(page, expected);
  if (chosen) return chosen;
  const picked = await pickByTap(page, strict('busqueda', BUSQUEDA_DE, proveedor), proveedor, expected);
  if (picked) return picked;
  await waitMobileSearch(page, fichaShown(proveedor));
  const before = await settledMobilePanel(page);
  const removed = await clickOn(page.getByRole('button', { name: REMOVE, exact: true }), `tocar «${REMOVE}»`);
  if (removed) return actionMissing(expected, removed);
  const snap: SearchSnapshot = await waitMobileSearch(page, (current) => current.value === '' && !current.fichaVisible);
  return conclude([
    check(snap.value === '', 'el campo «Proveedor del tenant» queda vacío', `el campo tiene «${snap.value ?? '(sin leer)'}»`),
    check(!snap.fichaVisible, 'no ve ninguna ficha de proveedor', snap.fichaVisible ? 've una ficha de proveedor' : 'no ve ninguna ficha de proveedor'),
    await unchangedFor(page, PANEL_MOVIL, before),
  ]);
};

defineBrowserRows({
  story: 'US-PROVEEDORES-004',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(listedOrEmpty)],
    [2, onExpoWeb(loadingTab)],
    [3, onExpoWeb(failedTab)],
    [4, onExpoWeb(retryTab)],
    [5, onExpoWeb(readOnlyForEveryRole)],
    [6, onExpoWeb(countAndNoticeMobile)],
    [7, onExpoWeb(firstFiveMobile)],
    [8, onExpoWeb(failedSearchMobile)],
    [9, onExpoWeb(tapSupplier)],
    [10, onExpoWeb(contractLine)],
    [11, onExpoWeb(contractCodeLink)],
    [12, onExpoWeb(removeChoiceMobile)],
  ]),
});
