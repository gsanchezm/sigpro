import type { Locator, Page } from '@playwright/test';
import { MOVIL_NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { actionFailed, captureBodies, interact, keysOf, observe, plainOf, pollPersisted, toastShown, verdictWeb, watchRequests, type Blocked } from '../web/common';
import { onMobile, openCard, prepareMobile, readEdit, sheetOf, waitDetail, waitEdit, waitSheetReady, type MobileEditView } from './common';

// US-NC-GESTION-011 — Edición de NC-003 desde su hoja de detalle en la app móvil (Expo web a 390 px; NO es nativo). Preparación de cada fila:
// reinicio de alumno01 con su administrador; la cuenta abre la app con alumno01 en «Tenant de trabajo», llega a /nc y toca NC-003 (Crítica,
// «Desviación detectada…», asignada a Andrés Molina). «Editar» abre el formulario dentro de la hoja; sus controles están acotados a él.

const SAVED = 'NC-003 guardada';
const NO_CHANGES = 'No hay cambios que guardar';
const DENIED = 'Tu rol puede leer y comentar, pero no modificar esta no conformidad.';
const SHORT = 'La descripción debe tener al menos 10 caracteres';
const SAVE_PATH = '/api/nc/NC-003';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

const SEVERITY_CELLS: ReadonlyMap<string, { readonly label: string; readonly key: string }> = new Map<string, { readonly label: string; readonly key: string }>([
  ['«Menor»', { label: 'Menor', key: 'minor' }],
  ['«Mayor»', { label: 'Mayor', key: 'major' }],
]);

const BUTTON_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Guardar»', 'Guardar'],
  ['«Guardar y cerrar»', 'Guardar y cerrar'],
]);

const DESTINATION_CELLS: ReadonlyMap<string, 'stays-open' | 'closes'> = new Map<string, 'stays-open' | 'closes'>([
  ['la hoja de detalle sigue abierta en la vista de lectura con la severidad «Menor»', 'stays-open'],
  ['la hoja de detalle se cierra', 'closes'],
]);

const TEXT_CELLS: ReadonlyMap<string, { readonly text: string; readonly accepted: boolean }> = new Map<string, { readonly text: string; readonly accepted: boolean }>([
  ['(9 letras a)', { text: 'a'.repeat(9), accepted: false }],
  ['(10 letras a)', { text: 'a'.repeat(10), accepted: true }],
]);

const PERSON_CELLS: ReadonlyMap<string, { readonly search: string }> = new Map<string, { readonly search: string }>([
  ['Lucí', { search: 'Lucí' }],
  ['CARMEN', { search: 'CARMEN' }],
]);

const PERSON_NAME_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Carmen Vidal', 'Carmen Vidal'],
]);

const INTENT_CELLS: ReadonlyMap<string, 'remove-and-save' | 'no-change' | 'auditor-look'> = new Map<string, 'remove-and-save' | 'no-change' | 'auditor-look'>([
  ['pulsa «Editar», pulsa «Quitar asignación» y pulsa «Guardar»', 'remove-and-save'],
  ['pulsa «Editar» y no cambia ningún campo', 'no-change'],
  ['mira el botón «Editar»', 'auditor-look'],
]);

const DESCRIPTION_RESULT_CELLS: ReadonlyMap<string, 'saved' | 'short'> = new Map<string, 'saved' | 'short'>([
  ['ve el aviso «NC-003 guardada»', 'saved'],
  ['ve el mensaje «La descripción debe tener al menos 10 caracteres» bajo el campo y no se envía ninguna petición', 'short'],
]);

// --- Piezas de la hoja y del formulario --------------------------------------------------------------------------------------------

const sheet = (page: Page): Locator => sheetOf(page, 'NC-003');
const editForm = (page: Page): Locator => page.getByTestId(MOVIL_NC_TESTIDS.EDIT_FORM);

/** Abre NC-003 desde /nc (ya con sesión) y espera a que la hoja muestre el estado. */
const openSheet = async (page: Page, email: string, expected: string): Promise<Outcome | undefined> => {
  const failed = await prepareMobile(page, email, expected);
  if (failed !== undefined) return failed;
  const tapped = await openCard(page, 'NC-003');
  if (tapped !== undefined) return actionFailed(expected, tapped);
  const ready = await waitSheetReady(page, 'NC-003');
  return ready ? undefined : actionFailed(expected, { message: 'la hoja de NC-003 no se abre', note: 'la tarjeta no abre el detalle en el plazo' });
};

/** Pulsa «Editar» dentro de la hoja y espera al formulario de edición. */
const openEdit = async (page: Page): Promise<{ readonly blocked?: Blocked; readonly view?: MobileEditView }> => {
  const clicked = await interact(sheet(page).getByRole('button', { name: 'Editar', exact: true }), 'pulsar «Editar»', (element) => element.click(ACTION));
  if (clicked !== undefined) return { blocked: clicked };
  const view = await waitEdit(page, (current) => current.open);
  return view?.open === true ? { view } : { blocked: { message: 'el formulario de edición no aparece', note: 'el botón «Editar» no abre el formulario en el plazo' } };
};

const chooseSeverity = (page: Page, label: string): Promise<{ readonly message: string; readonly note: string } | undefined> =>
  interact(editForm(page).getByRole('radio', { name: label, exact: true }), `elegir «${label}» en «Severidad»`, (element) => element.click(ACTION));

const saveButton = (page: Page, name: string): Locator => editForm(page).getByRole('button', { name, exact: true });

// --- Esquema 1: un rol con permiso de edición cambia la severidad y guarda --------------------------------------------------------

const changeSeverity: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const expected = `${account} pulsa «Editar», elige «${severity.label}» en «Severidad» y pulsa «Guardar» → aviso «${SAVED}» y la severidad del detalle es ${severity.label}`;
  const opened = await openSheet(page, account, expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const picked = await chooseSeverity(page, severity.label);
  if (picked !== undefined) return actionFailed(expected, picked);
  const log = watchRequests(page);
  const bodies = captureBodies(page, 'PATCH', SAVE_PATH);
  const saved = await interact(saveButton(page, 'Guardar'), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const view = await waitDetail(page, 'NC-003', (current) => current.editOpen === false && current.severityText === severity.label);
  const persisted = await pollPersisted('NC-003', (fields) => fields.severity === severity.key);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(view?.severityText === severity.label, `severidad del detalle «${severity.label}»`, `severidad del detalle «${view?.severityText ?? '(sin leer)'}»`),
    check(persisted?.severity === severity.key, `NC-003 guardada con severity ${severity.key}`, `NC-003 con severity ${persisted?.severity ?? '(sin leer)'}`),
    check(log.count('PATCH', SAVE_PATH) === 1, 'una petición PATCH de cambios', `peticiones PATCH: ${log.count('PATCH', SAVE_PATH)}`),
    check(bodies().length === 1 && JSON.stringify(keysOf(bodies()[0] ?? '')) === JSON.stringify(['severity']), 'se envía solo el campo cambiado (severity)', `envíos PATCH con: ${bodies().map((raw) => keysOf(raw)?.join(', ') ?? '(sin leer)').join(' | ') || '(ninguno)'}`),
  ]);
};

// --- Esquema 2: los dos botones de guardado se diferencian en lo que pasa después -----------------------------------------------

const twoSaveButtons: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const button = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const destination = strict('destino', DESTINATION_CELLS, cell(row, 'destino'));
  const expected = `gestor@sigpro.test pulsa «Editar», elige «Menor» en «Severidad» y pulsa «${button}» → aviso «${SAVED}» y ${cell(row, 'destino')}`;
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const picked = await chooseSeverity(page, 'Menor');
  if (picked !== undefined) return actionFailed(expected, picked);
  const saved = await interact(saveButton(page, button), `pulsar «${button}»`, (element) => element.click(ACTION));
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  if (destination === 'stays-open') {
    const view = await waitDetail(page, 'NC-003', (current) => current.open && current.editOpen === false && current.severityText === 'Menor');
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
      check(view?.open === true && view.editOpen === false, 'la hoja sigue abierta en la vista de lectura', `hoja abierta: ${view?.open === true ? 'sí' : 'no'}; formulario de edición abierto: ${view?.editOpen === true ? 'sí' : 'no'}`),
      check(view?.severityText === 'Menor', 'severidad «Menor» en la vista de lectura', `severidad «${view?.severityText ?? '(sin leer)'}»`),
    ]);
  }
  const closed = await waitUntil(async () => (await sheet(page).count()) === 0);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(closed.reached, 'la hoja de detalle se cierra', closed.reached ? 'la hoja de detalle se cerró' : 'la hoja de detalle sigue abierta'),
  ]);
};

// --- Esquema 3: la descripción debe tener al menos 10 caracteres para guardarse -------------------------------------------------

const descriptionLength: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const result = strict('resultado', DESCRIPTION_RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test pulsa «Editar», sustituye el texto de «Descripción» por ${cell(row, 'texto')} y pulsa «Guardar» → ${cell(row, 'resultado')}`;
  const log = watchRequests(page);
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const written = await interact(editForm(page).getByRole('textbox', { name: 'Descripción', exact: true }), 'escribir en «Descripción»', (element) => element.fill(text.text, ACTION));
  if (written !== undefined) return actionFailed(expected, written);
  const saved = await interact(saveButton(page, 'Guardar'), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved !== undefined) return actionFailed(expected, saved);

  if (result === 'saved') {
    const toast = await toastShown(page, 'ok', SAVED);
    const persisted = await pollPersisted('NC-003', (fields) => plainOf(fields.description ?? '') === text.text);
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
      check(plainOf(persisted?.description ?? '') === text.text, 'NC-003 guardada con la descripción de 10 letras', `descripción en el servidor: ${persisted?.description ?? '(sin leer)'}`),
    ]);
  }
  const shown = await waitUntil(async () => (await readEdit(page))?.descriptionError === SHORT);
  const view = await readEdit(page);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${SHORT}» bajo el campo`, `bajo el campo: «${view?.descriptionError ?? '(sin error visible)'}»`),
    check(log.count('PATCH', SAVE_PATH) === 0, 'ninguna petición de guardado', `peticiones PATCH: ${log.count('PATCH', SAVE_PATH)}`),
    check(log.count('GET', SAVE_PATH) > 0, 'control: el registro de peticiones ve la carga del detalle', `peticiones GET vistas: ${log.count('GET', SAVE_PATH)}`),
  ]);
};

// --- Esquema 4: elegir una persona la asigna al guardar --------------------------------------------------------------------------

const assignPerson: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const person = strict('busqueda', PERSON_CELLS, cell(row, 'busqueda'));
  const persona = strict('persona', PERSON_NAME_CELLS, cell(row, 'persona'));
  const expected = `gestor@sigpro.test pulsa «Editar», escribe ${cell(row, 'busqueda')} en «Buscar persona», elige ${persona} y pulsa «Guardar» → aviso «${SAVED}» y «Asignada a» muestra ${persona}`;
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const combo = await interact(editForm(page).getByRole('combobox', { name: 'Asignada a', exact: true }), 'abrir «Asignada a»', (element) => element.click(ACTION));
  if (combo !== undefined) return actionFailed(expected, combo);
  const owners = page.getByTestId('nc-assignee-dialog');
  const typed = await interact(owners.getByRole('textbox', { name: 'Buscar persona', exact: true }), 'escribir en «Buscar persona»', (element) => element.fill(person.search, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const chosen = await interact(owners.getByRole('radio', { name: persona, exact: true }), `elegir ${persona}`, (element) => element.click(ACTION));
  if (chosen !== undefined) return actionFailed(expected, chosen);
  const saved = await interact(saveButton(page, 'Guardar'), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const shown = await waitDetail(page, 'NC-003', (current) => current.editOpen === false && current.assignee === persona);
  const persisted = await pollPersisted('NC-003', (fields) => fields.assigneeName === persona);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(shown?.assignee === persona, `«Asignada a» muestra ${persona}`, `«Asignada a» muestra «${shown?.assignee ?? '(sin leer)'}»`),
    check(persisted?.assigneeName === persona, `NC-003 asignada a ${persona} en el servidor`, `NC-003 asignada a ${persisted?.assigneeName ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 5: quitar la asignación deja la no conformidad sin responsable -----------------------------------------------------

const removeAssignee: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', INTENT_CELLS, cell(row, 'intento'));
  const expected = `gestor@sigpro.test pulsa «Editar», pulsa «Quitar asignación» y pulsa «Guardar» → aviso «${SAVED}» y «Asignada a» muestra «Sin asignar»`;
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const cleared = await interact(editForm(page).getByRole('button', { name: 'Quitar asignación', exact: true }), 'pulsar «Quitar asignación»', (element) => element.click(ACTION));
  if (cleared !== undefined) return actionFailed(expected, cleared);
  const saved = await interact(saveButton(page, 'Guardar'), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const shown = await waitDetail(page, 'NC-003', (current) => current.editOpen === false && current.assignee === 'Sin asignar');
  const persisted = await pollPersisted('NC-003', (fields) => fields.assigneeId === null);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(shown?.assignee === 'Sin asignar', '«Asignada a» muestra «Sin asignar»', `«Asignada a» muestra «${shown?.assignee ?? '(sin leer)'}»`),
    check(persisted?.assigneeId === null, 'NC-003 sin asignar en el servidor', `NC-003 con assigneeId ${persisted === undefined ? '(sin leer)' : String(persisted.assigneeId)}`),
  ]);
};

// --- Esquema 6: sin cambios no se puede guardar ---------------------------------------------------------------------------------

const noChangesNoSave: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', INTENT_CELLS, cell(row, 'intento'));
  const expected = `gestor@sigpro.test pulsa «Editar» y no cambia ningún campo → «Guardar» y «Guardar y cerrar» deshabilitados con «${NO_CHANGES}»`;
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const edit = await openEdit(page);
  if (edit.blocked !== undefined) return actionFailed(expected, edit.blocked);
  const view = await waitEdit(page, (current) => current.save.disabled === true);
  return verdictWeb([
    check(view?.save.disabled === true && view.save.reason === NO_CHANGES, `«Guardar» deshabilitado con «${NO_CHANGES}»`, `«Guardar» ${view?.save.disabled === true ? 'deshabilitado' : 'habilitado'}; motivo «${view?.save.reason ?? '(sin motivo)'}»`),
    check(view?.saveClose.disabled === true && view.saveClose.reason === NO_CHANGES, `«Guardar y cerrar» deshabilitado con «${NO_CHANGES}»`, `«Guardar y cerrar» ${view?.saveClose.disabled === true ? 'deshabilitado' : 'habilitado'}; motivo «${view?.saveClose.reason ?? '(sin motivo)'}»`),
    check(view?.noChangesVisible === NO_CHANGES, `«${NO_CHANGES}» visible en el formulario`, `texto visible: «${view?.noChangesVisible ?? '(no visible)'}»`),
  ]);
};

// --- Esquema 7: el rol de auditoría no puede entrar en la edición ----------------------------------------------------------------

const auditorCannotEdit: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', INTENT_CELLS, cell(row, 'intento'));
  const expected = `auditor@sigpro.test mira el botón «Editar» de NC-003 → deshabilitado y «${DENIED}» visible junto al botón`;
  const opened = await openSheet(page, 'auditor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const view = await waitDetail(page, 'NC-003', (current) => current.editDisabled !== undefined);
  return verdictWeb([
    check(view?.editDisabled === true, '«Editar» deshabilitado', `«Editar» ${view?.editDisabled === undefined ? '(sin leer)' : view.editDisabled ? 'deshabilitado' : 'habilitado'}`),
    check(view?.editReason === DENIED, `motivo «${DENIED}» en el botón`, `motivo en el botón: «${view?.editReason ?? '(sin motivo)'}»`),
    check(view?.deniedVisible === DENIED, `«${DENIED}» visible junto al botón`, `texto visible: «${view?.deniedVisible ?? '(no visible)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-011',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(changeSeverity)],
    [2, onMobile(twoSaveButtons)],
    [3, onMobile(descriptionLength)],
    [4, onMobile(assignPerson)],
    [5, onMobile(removeAssignee)],
    [6, onMobile(noChangesNoSave)],
    [7, onMobile(auditorCannotEdit)],
  ]),
});
