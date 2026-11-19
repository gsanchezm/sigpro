import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, conclude, strict } from '../../support/checks';
import { CEILING_MS } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  buttonNamesOf,
  clickOn,
  faultEvidence,
  injectFailures,
  delaySuppliers,
  literal,
  matchProgram,
  notSeenCheck,
  onWeb,
  openPath,
  panelOf,
  PANEL_WEB,
  prepFailed,
  programPath,
  rowCellsOf,
  runSteps,
  same,
  seenCheck,
  settledPanel,
  signIn,
  summaryField,
  textOne,
  waitPanelUntil,
  watchPanel,
} from './common';

// US-PROVEEDORES-002 — Ver los proveedores contratados en el Resumen de un programa (web, 1440 px). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; después se entra con la cuenta de la fila desde /login?tenant=alumno01 en un navegador sin
// sesión y se llega a Programas; la ficha se abre por su dirección (carga completa, con la sesión guardada).
//
// Notas de la prueba:
//  - los fallos de la lista se provocan sobre `GET /api/suppliers?program=PRG-001`: «la primera petición» responde con el código de la fila
//    (una sola vez en los casos de reintento, todas en los de aviso), tal como dice la historia;
//  - el indicador de carga y el contador se leen en una sola ejecución del DOM por instantánea (`watchPanel`).

const EMPTY_MESSAGE = 'Este programa no tiene proveedores contratados.';
const ERROR_TITLE = 'No se pudieron cargar los proveedores';
const RETRY = 'Reintentar';
/** Palabras de los botones de edición: la sección de solo lectura no debe ofrecer ninguna. */
const EDIT_BUTTON = /añadir|agregar|editar|eliminar|borrar|asignar|quitar|nuevo|nueva/i;

/** Cuentas de la fila: las de demostración y alumno01 (admin de su tenant, sin segundo factor). */
const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Código HTTP de la fila → código que responde la prueba. */
const CODES_HTTP: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

/** Espera que la historia da en la fila «espera» → milisegundos de demora. */
const DELAYS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

// --- Esquema 1: la sección lista los proveedores contratados del programa -------------------------------------------------------------

const contractedList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const counter = literal(cell(row, 'contador'));
  const estado = literal(cell(row, 'estado'));
  const expected = `en «Proveedores» el contador ${counter} y una fila con ${cell(row, 'proveedor')}, NIF ${cell(row, 'nif')}, importe ${cell(row, 'importe')} y estado ${estado}`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, programPath(cell(row, 'codigo')));
  if (opened) return actionMissing(expected, opened);
  const panel = await settledPanel(page, PANEL_WEB);
  const cells = await rowCellsOf(page, cell(row, 'proveedor'));
  const [nif, importe, badge] = cells ?? [];
  return conclude([
    check(panel.counter === counter, `el contador ${counter}`, `el contador ${panel.counter ?? '(no se ve)'}`),
    check(cells !== undefined, `una fila con ${cell(row, 'proveedor')}`, cells === undefined ? `no hay exactamente una fila con ${cell(row, 'proveedor')}` : `una fila con ${cell(row, 'proveedor')}`),
    check(nif === cell(row, 'nif'), `el NIF ${cell(row, 'nif')}`, `el NIF ${nif ?? '(sin leer)'}`),
    check(importe !== undefined && same(importe, cell(row, 'importe')), `el importe ${cell(row, 'importe')}`, `el importe ${importe ?? '(sin leer)'}`),
    check(badge !== undefined && badge === estado, `el estado ${estado}`, `el estado ${badge ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 2: un programa sin proveedores contratados muestra el mensaje vacío -----------------------------------------------------

const emptyList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const counter = literal(cell(row, 'contador'));
  const expected = `en «Proveedores» el contador ${counter} y el mensaje «${EMPTY_MESSAGE}» y ninguna fila de proveedor`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, programPath(cell(row, 'codigo')));
  if (opened) return actionMissing(expected, opened);
  const panel = await settledPanel(page, PANEL_WEB);
  return conclude([
    check(panel.counter === counter, `el contador ${counter}`, `el contador ${panel.counter ?? '(no se ve)'}`),
    check(panel.emptyText !== null && same(panel.emptyText, EMPTY_MESSAGE), `el mensaje «${EMPTY_MESSAGE}»`, `el mensaje ${panel.emptyText === null ? '(no se ve)' : `«${panel.emptyText}»`}`),
    check(panel.rowNames.length === 0, 'ninguna fila de proveedor', `${panel.rowNames.length} filas de proveedor`),
  ]);
};

// --- Esquema 3: la sección muestra la carga hasta que llega la lista ---------------------------------------------------------------

const loadingIndicator: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const delay = strict('espera', DELAYS, cell(row, 'espera'));
  const expected = 'mientras espera, en «Proveedores» ve el indicador de carga y no ve ninguna fila ni el contador; al llegar la respuesta ve la fila de Aeronáutica Levante S.L.';
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  await delaySuppliers(page, matchProgram('PRG-001'), delay);
  const navigated = await runSteps([['abrir /programs/PRG-001', () => page.goto(programPath('PRG-001'), { timeout: CEILING_MS })]]);
  if (navigated) return actionMissing(expected, navigated);
  // Una sola instantánea por lectura: el indicador, las filas y el contador se miran en el mismo instante
  const snaps = await watchPanel(page, PANEL_WEB);
  const withLoader = snaps.filter((snap) => snap.loading);
  const leak = withLoader.find((snap) => snap.rowNames.length > 0 || snap.counter !== null);
  const cells = await rowCellsOf(page, 'Aeronáutica Levante S.L.');
  return conclude(
    [
      check(withLoader.length > 0, 've el indicador de carga mientras espera', withLoader.length > 0 ? 've el indicador de carga mientras espera' : 'no ve el indicador de carga mientras espera'),
      check(leak === undefined, 'no ve ninguna fila ni el contador mientras espera', leak === undefined ? 'no ve ninguna fila ni el contador mientras espera' : `ve filas o contador a los ${leak.atMs} ms`),
      check(cells !== undefined, 'al llegar la respuesta ve la fila de Aeronáutica Levante S.L.', cells === undefined ? 'no ve la fila de Aeronáutica Levante S.L.' : 've la fila de Aeronáutica Levante S.L.'),
    ],
    { evidence: { delayMs: delay, snapshots: snaps.length, firstLoadingAtMs: withLoader[0]?.atMs ?? null, loadingText: withLoader[0]?.loadingText ?? null } },
  );
};

// --- Esquema 4: un fallo de la lista muestra el aviso de error con su botón de reintento -------------------------------------------

const failedList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `en «Proveedores» el título «${ERROR_TITLE}» y el botón «${RETRY}», sin filas ni contador; sigue viendo el campo «Responsable» con Marta Ruiz`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  // Todas las peticiones de la lista fallan (la lista no vuelve a pedirse salvo por «Reintentar»)
  const faults = await injectFailures(page, matchProgram('PRG-001'), status);
  const opened = await openPath(page, programPath('PRG-001'));
  if (opened) return actionMissing(expected, opened);
  const panel = await settledPanel(page, PANEL_WEB);
  const alert = panelOf(page).getByRole('alert').filter({ hasText: ERROR_TITLE });
  const responsable = await textOne(summaryField(page, 'Responsable'));
  return conclude(
    [
      await seenCheck(alert, `el título «${ERROR_TITLE}»`, `el título «${ERROR_TITLE}»`),
      await seenCheck(alert.getByRole('button', { name: RETRY, exact: true }), `el botón «${RETRY}»`, `el botón «${RETRY}»`),
      check(panel.rowNames.length === 0 && panel.counter === null, 'ninguna fila de proveedor ni el contador', `${panel.rowNames.length} filas y contador ${panel.counter ?? '(no se ve)'}`),
      check(responsable !== undefined && same(responsable, 'Marta Ruiz'), 'el campo «Responsable» con Marta Ruiz', `el campo «Responsable» ${responsable ?? '(sin leer)'}`),
    ],
    { evidence: faultEvidence(faults) },
  );
};

// --- Esquema 5: «Reintentar» vuelve a pedir la lista y la muestra -------------------------------------------------------------------

const retryList: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const status = strict('codigo_http', CODES_HTTP, cell(row, 'codigo_http'));
  const expected = `al ver el aviso «${ERROR_TITLE}», pulsar «${RETRY}»; en «Proveedores» ve la fila de Aeronáutica Levante S.L. y ya no ve el aviso`;
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  // Los fallos duran hasta que la fila ve el aviso; después se sueltan y «Reintentar» llega al servidor
  const faults = await injectFailures(page, matchProgram('PRG-001'), status);
  const opened = await openPath(page, programPath('PRG-001'));
  if (opened) return actionMissing(expected, opened);
  const before = await settledPanel(page, PANEL_WEB);
  faults.release();
  const pressed = await clickOn(panelOf(page).getByRole('button', { name: RETRY, exact: true }), `pulsar «${RETRY}»`);
  if (pressed) return actionMissing(expected, pressed);
  // Se espera a que la lista recargada aparezca (o a que se agote el techo) antes de juzgar
  const after = await waitPanelUntil(page, (snap) => !snap.error && snap.rowNames.includes('Aeronáutica Levante S.L.'), PANEL_WEB);
  const cells = await rowCellsOf(page, 'Aeronáutica Levante S.L.');
  return conclude(
    [
      check(before.error, `ve el aviso «${ERROR_TITLE}» antes de pulsar`, before.error ? `ve el aviso «${ERROR_TITLE}» antes de pulsar` : 'no ve el aviso antes de pulsar'),
      check(after.rowNames.includes('Aeronáutica Levante S.L.') && cells !== undefined, 've la fila de Aeronáutica Levante S.L.', after.rowNames.includes('Aeronáutica Levante S.L.') ? 've la fila de Aeronáutica Levante S.L.' : 'no ve la fila de Aeronáutica Levante S.L.'),
      await notSeenCheck(panelOf(page).getByRole('alert').filter({ hasText: ERROR_TITLE }), `ya no ve el aviso «${ERROR_TITLE}»`, `el aviso «${ERROR_TITLE}»`),
    ],
    {
      note: 'Los fallos provocados duran hasta que la fila ve el aviso y después se sueltan: con una sola petición de la sección es lo mismo que «solo la primera responde con error». Las peticiones provocadas van en la evidencia.',
      evidence: faultEvidence(faults),
    },
  );
};

// --- Esquema 6: todos los roles ven la sección en modo de solo lectura ---------------------------------------------------------------

const readOnlyForEveryRole: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = 'en «Proveedores» ve la fila de Aeronáutica Levante S.L. con el estado «Aprobado» y no ve ningún botón para añadir, editar o eliminar proveedores del programa';
  const signed = await signIn(page, credentials);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, programPath('PRG-001'));
  if (opened) return actionMissing(expected, opened);
  await settledPanel(page, PANEL_WEB);
  const cells = await rowCellsOf(page, 'Aeronáutica Levante S.L.');
  const buttons = await buttonNamesOf(page);
  const editing = buttons?.filter((name) => EDIT_BUTTON.test(name)) ?? [];
  return conclude([
    check(cells !== undefined && cells[2] === 'Aprobado', 'la fila de Aeronáutica Levante S.L. con el estado «Aprobado»', cells === undefined ? 'sin fila de Aeronáutica Levante S.L.' : `estado ${cells[2] ?? '(sin leer)'}`),
    check(buttons !== undefined && editing.length === 0, 'ningún botón para añadir, editar o eliminar proveedores', buttons === undefined ? 'botones sin leer' : editing.length === 0 ? 'ningún botón para añadir, editar o eliminar proveedores' : `botones de edición: ${editing.join(', ')}`),
  ]);
};

defineBrowserRows({
  story: 'US-PROVEEDORES-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(contractedList)],
    [2, onWeb(emptyList)],
    [3, onWeb(loadingIndicator)],
    [4, onWeb(failedList)],
    [5, onWeb(retryList)],
    [6, onWeb(readOnlyForEveryRole)],
  ]),
});
