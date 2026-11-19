import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { EDITAR_PROGRAMA_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, pathOf, textOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { absentCheck, actionFailed, alertCheck, fieldValueCheck, interact, NET_MS, programNow, textCheck, visibleCheck, waitForOkToast, type Blocked } from '../web/common';
import {
  DETAIL_PATH,
  EDIT_PATH,
  buttonNamed,
  disabledReason,
  editBudgetField,
  editNameField,
  editSaveButton,
  editSaveCloseButton,
  editSettled,
  editStartField,
  editStatusField,
  onExpoWebLoad,
  openPath,
  ownerField,
  pickerCheck,
  saveReason,
  signIn,
} from './common';

// US-PROG-ALTA-013 — Editar un programa y guardar o cerrar la edición (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio de
// alumno01 (el envoltorio de la fila); en la app, sin sesión guardada, con alumno01 en «Tenant de trabajo», la cuenta de la fila inicia
// sesión y abre la edición de PRG-001. Abrir la edición es una carga completa de la página (ver la nota de la fila). Lo que se guarda se
// comprueba en el tenant por API con el administrador.

const NAME_SEED = 'Sistema de mando táctico Ártemis';
const NAME_CHANGED = 'Sistema de mando táctico Ártemis II';
const NO_CHANGES = 'No hay cambios que guardar';
const DENIED_TEXT = 'Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.';
const SAVED_TITLE = 'Programa actualizado';
const SAVED_BODY = 'PRG-001 se guardó correctamente';

/** Cuentas de la tabla del Esquema 5 (consultor y auditor no pueden editar). */
const DENIED_ACCOUNT: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Campo de la tabla del Esquema 1 → cómo se lee: un campo de texto o un selector, y lo que muestra con PRG-001 tras el reinicio. */
interface Shown {
  readonly kind: 'input' | 'picker';
  readonly locator: (page: Page) => Locator;
  readonly expected: string;
  readonly what: string;
}
const SHOWN: ReadonlyMap<string, Shown> = new Map<string, Shown>([
  ['«Nombre»', { kind: 'input', locator: editNameField, expected: NAME_SEED, what: 'el campo «Nombre»' }],
  ['«Responsable»', { kind: 'picker', locator: ownerField, expected: 'Marta Ruiz', what: 'el campo «Responsable»' }],
  ['«Estado»', { kind: 'picker', locator: editStatusField, expected: 'Activo', what: 'el campo «Estado»' }],
]);

/** Campo de la tabla del Esquema 2 → el campo que cambia y cómo. */
const CHANGED: ReadonlyMap<string, 'budget' | 'status'> = new Map<string, 'budget' | 'status'>([
  ['«Presupuesto (€)»', 'budget'],
  ['«Estado»', 'status'],
]);

/** Cambio de la tabla del Esquema 4 → el aviso esperado: el nombre repetido (arriba y bajo el campo) o la fecha de fin (bajo su campo). */
const FAILURE: ReadonlyMap<string, 'duplicate' | 'endDate'> = new Map<string, 'duplicate' | 'endDate'>([
  ['escribe Radar de vigilancia costera RVC-2 en «Nombre»', 'duplicate'],
  ['escribe 2024-07-02 en «Fecha de inicio»', 'endDate'],
]);

/** Escribe en un campo de la edición; si falla, el diagnóstico. */
const typeInto = (target: Locator, text: string, label: string): Promise<Blocked | undefined> =>
  interact(target, `escribir «${text}» en ${label}`, (element) => element.fill(text, ACTION));

/** Inicia sesión con la cuenta y abre la edición de PRG-001; devuelve el motivo si no se llega a ver la pantalla. */
const openEdit = async (page: Page, credentials: Credentials = DEMO.gestor): Promise<string | undefined> => {
  const signed = await signIn(page, credentials);
  if (signed) return signed;
  const opened = await openPath(page, EDIT_PATH);
  if (opened) return opened;
  return (await editSettled(page)) ? undefined : 'la edición de PRG-001 no se muestra';
};

// --- Esquema 1: la pantalla muestra los valores guardados y no deja guardar sin cambios -------------------------------------

const showsSaved: BrowserRowHandler = async (row, { page }) => {
  const expected = `el campo ${cell(row, 'campo')} muestra ${cell(row, 'valor')} y «Guardar» está deshabilitado con el texto «${NO_CHANGES}»`;
  const prepared = await openEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const field = strict('campo', SHOWN, cell(row, 'campo'));
  // Los selectores cargan sus datos por red (la lista de personas): su valor se espera con el techo de red
  const value =
    field.kind === 'input'
      ? await fieldValueCheck(field.locator(page), field.expected, field.what, NET_MS)
      : await pickerCheck(field.locator(page), field.expected, field.what);
  return conclude([
    value,
    check(cell(row, 'valor') === field.expected, `la tabla dice ${field.expected}`, `la tabla dice ${cell(row, 'valor')}`),
    await disabledReason(editSaveButton(page), NO_CHANGES, 'Guardar'),
    textCheck(await textOf(saveReason(page)), NO_CHANGES, 'el texto bajo «Guardar»'),
  ]);
};

// --- Esquema 2: guardar aplica el cambio y se queda en la pantalla --------------------------------------------------------

const saveChange: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el aviso «${SAVED_TITLE}» con el texto «${SAVED_BODY}» y sigue en la edición con el campo ${cell(row, 'campo')} en ${cell(row, 'valor')}`;
  const prepared = await openEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const changed = strict('campo', CHANGED, cell(row, 'campo'));
  const valor = cell(row, 'valor');
  if (changed === 'budget') {
    const typed = await typeInto(editBudgetField(page), valor, 'Presupuesto (€)');
    if (typed) return actionFailed(expected, typed);
  } else {
    const opened = await interact(editStatusField(page), 'abrir «Estado»', (element) => element.click(ACTION));
    if (opened) return actionFailed(expected, opened);
    const chosen = await interact(page.getByRole('radio', { name: valor, exact: true }), `elegir «${valor}»`, (element) => element.click(ACTION));
    if (chosen) return actionFailed(expected, chosen);
  }
  const saved = await interact(editSaveButton(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved) return actionFailed(expected, saved);
  const toast = await waitForOkToast(page, SAVED_TITLE, SAVED_BODY, NET_MS);
  const stays = await waitUntil(async () => pathOf(page) === EDIT_PATH, 1_000);
  const shown =
    changed === 'budget'
      ? await fieldValueCheck(editBudgetField(page), valor, 'el campo «Presupuesto (€)»', NET_MS)
      : await pickerCheck(editStatusField(page), valor, 'el campo «Estado»');
  return conclude([
    check(toast, `ve el aviso «${SAVED_TITLE}» con «${SAVED_BODY}»`, `no aparece el aviso «${SAVED_TITLE}»`),
    check(stays.reached, `sigue en ${EDIT_PATH}`, `está en ${pathOf(page)}`),
    shown,
  ]);
};

// --- Esquema 3: guardar y cerrar lleva al detalle del programa ---------------------------------------------------------------

const saveAndClose: BrowserRowHandler = async (row, { page }) => {
  const expected = `llega al detalle de PRG-001 (${DETAIL_PATH}) y ve el aviso «${SAVED_TITLE}»`;
  const prepared = await openEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const typed = await typeInto(editNameField(page), NAME_CHANGED, 'Nombre');
  if (typed) return actionFailed(expected, typed);
  const closed = await interact(editSaveCloseButton(page), `pulsar ${cell(row, 'boton')}`, (element) => element.click(ACTION));
  if (closed) return actionFailed(expected, closed);
  const arrived = await waitUntil(async () => pathOf(page) === DETAIL_PATH, NET_MS);
  const toast = await waitForOkToast(page, SAVED_TITLE, SAVED_BODY, NET_MS);
  return conclude([check(arrived.reached, `llega a ${DETAIL_PATH}`, `está en ${pathOf(page)}`), check(toast, `ve el aviso «${SAVED_TITLE}»`, `no ve el aviso «${SAVED_TITLE}»`)]);
};

// --- Esquema 4: los avisos del servidor y de las fechas aparecen junto al campo que falla ------------------------------

const serverAlerts: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  // Cuenta las peticiones de guardado: una edición que falla por fechas no debe enviar ningún PATCH
  let patches = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/programs/PRG-001') patches += 1;
  });
  const prepared = await openEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const kind = strict('cambio', FAILURE, cell(row, 'cambio'));
  const typed =
    kind === 'duplicate'
      ? await typeInto(editNameField(page), 'Radar de vigilancia costera RVC-2', 'Nombre')
      : await typeInto(editStartField(page), '2024-07-02', 'Fecha de inicio');
  if (typed) return actionFailed(expected, typed);
  const saved = await interact(editSaveButton(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved) return actionFailed(expected, saved);
  if (kind === 'duplicate') {
    // Primero los avisos (la respuesta de red llega antes); después el tenant, que no debe cambiar
    const alerts = [
      await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SERVER_ERROR), '422 · Ya existe un programa con ese nombre', 'el aviso de arriba', NET_MS),
      await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME_ERROR), 'Ya existe un programa con ese nombre', 'el aviso bajo «Nombre»', NET_MS),
    ];
    const stored = await programNow('PRG-001');
    return conclude([...alerts, check(stored?.name === NAME_SEED, 'el programa no cambia', `PRG-001 tiene el nombre «${String(stored?.name)}»`)]);
  }
  const alert = await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END_ERROR), 'La fecha de fin debe ser posterior al inicio', 'el aviso bajo «Fecha de fin»');
  const stored = await programNow('PRG-001');
  return conclude([
    alert,
    check(patches === 0, 'no se envía ninguna edición', `se enviaron ${patches} peticiones PATCH`),
    check(stored?.startDate === '2023-01-01' && stored?.endDate === '2024-07-01', 'no se guarda nada', `PRG-001 tiene inicio ${String(stored?.startDate)} y fin ${String(stored?.endDate)}`),
  ]);
};

// --- Esquema 5: quien no puede editar ve el texto y no ve campos para editar --------------------------------------------

const deniedRole: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el texto «${DENIED_TEXT}» y el botón «Volver al detalle», y no ve campos para editar`;
  const credentials = strict('cuenta', DENIED_ACCOUNT, cell(row, 'cuenta'));
  const prepared = await openEdit(page, credentials);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const denied = page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DENIED);
  return conclude([
    await visibleCheck(denied.getByText(DENIED_TEXT, { exact: true }), `el texto «${DENIED_TEXT}»`),
    await visibleCheck(buttonNamed(page, 'Volver al detalle'), 'el botón «Volver al detalle»'),
    await absentCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_FORM), 'formulario de edición'),
    await absentCheck(editNameField(page), 'campo «Nombre» para editar'),
  ]);
};

// --- Esquema 6: un programa que no existe en el tenant muestra el aviso de no encontrado ---------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el aviso «No se encontró el programa» y el botón «Volver a Programas» (${cell(row, 'codigo')})`;
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openPath(page, `/programs/${cell(row, 'codigo')}/edit`);
  if (opened) return preparationFailedWeb(expected, opened);
  const shown = await waitUntil(() => isVisible(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND)), NET_MS);
  if (!shown.reached) return conclude([check(false, 'el aviso de no encontrado', 'no se ve el aviso de no encontrado')]);
  return conclude([
    await visibleCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND).getByText('No se encontró el programa', { exact: true }), 'el aviso «No se encontró el programa»'),
    await visibleCheck(buttonNamed(page, 'Volver a Programas'), 'el botón «Volver a Programas»'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWebLoad(showsSaved)],
    [2, onExpoWebLoad(saveChange)],
    [3, onExpoWebLoad(saveAndClose)],
    [4, onExpoWebLoad(serverAlerts)],
    [5, onExpoWebLoad(deniedRole)],
    [6, onExpoWebLoad(notFound)],
  ]),
});
