import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import type { Outcome } from '../../core/framework';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { actionFailed, captureBodies, keysOf, plainOf, controlCheck, controlOf, detailDialog, interact, observe, onWeb, pollPersisted, prepareWeb, readDetail, toastShown, verdictWeb, waitDetail, watchRequests, type DetailView } from './common';

// US-NC-GESTION-007 — Edición de la severidad, la descripción y la asignación en el detalle de NC-003 (web, /nc/NC-003, escritorio 1440 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la cuenta de la fila inicia sesión en /login?tenant=alumno01
// y abre /nc/NC-003 (en «Acción correctiva», severidad Crítica, asignada a Andrés Molina). El detalle es un diálogo que se lee por su nombre
// accesible («Detalle de NC-003»). Los controles de la severidad son un selector con opciones (dentro de su diálogo); la asignación es un
// combobox: «fill» reemplaza su texto (que muestra «Andrés Molina» al abrir) y «Quitar asignación» actúa al pulsar.

const EDIT_DENIED = 'Tu rol puede leer y comentar, pero no modificar esta no conformidad.';
const NO_CHANGES = 'No hay cambios que guardar';
const SAVED = 'NC-003 guardada';
const SHORT_DESCRIPTION = 'La descripción debe tener al menos 10 caracteres';
const NOT_FOUND = 'No se encontró la no conformidad';
const NO_MATCH = 'Sin coincidencias';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

/** Severidades de la celda: texto de la interfaz (con comillas) y clave guardada en la API. */
const SEVERITY_CELLS: ReadonlyMap<string, { readonly label: string; readonly key: string }> = new Map<string, { readonly label: string; readonly key: string }>([
  ['«Menor»', { label: 'Menor', key: 'minor' }],
  ['«Mayor»', { label: 'Mayor', key: 'major' }],
]);

const TEN_A = 'a'.repeat(10);
const NINE_A = 'a'.repeat(9);

const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(10 letras a)', TEN_A],
  ['(9 letras a)', NINE_A],
]);

/** Acción de la celda «accion» (quitar la asignación y guardar). */
const ACTION_CELLS: ReadonlyMap<string, 'remove-then-save'> = new Map<string, 'remove-then-save'>([['pulsa «Quitar asignación» y después «Guardar»', 'remove-then-save']]);

const SAVE_CELLS: ReadonlyMap<string, 'Guardar' | 'Guardar y cerrar'> = new Map<string, 'Guardar' | 'Guardar y cerrar'>([
  ['«Guardar»', 'Guardar'],
  ['«Guardar y cerrar»', 'Guardar y cerrar'],
]);

const DESTINATION_CELLS: ReadonlyMap<string, 'stays-open' | 'back-to-list'> = new Map<string, 'stays-open' | 'back-to-list'>([
  ['el detalle de NC-003 sigue abierto con la severidad «Menor»', 'stays-open'],
  ['la pantalla vuelve a /nc', 'back-to-list'],
]);

/** Personas de la celda «persona» (el nombre que muestra la lista «Personas») y la búsqueda que la encuentra. */
const PERSON_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Carmen Vidal', 'Carmen Vidal'],
]);

const SEARCH_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Lucí', 'Lucí'],
  ['CARMEN', 'CARMEN'],
  ['Zzzz', 'Zzzz'],
]);

const DENIED_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['auditor@sigpro.test', 'auditor@sigpro.test']]);

const STATE_CELLS: ReadonlyMap<string, 'sin-cambios' | 'ida-y-vuelta'> = new Map<string, 'sin-cambios' | 'ida-y-vuelta'>([
  ['sin tocar ningún campo', 'sin-cambios'],
  ['con la severidad cambiada a «Menor» y de nuevo a «Crítica»', 'ida-y-vuelta'],
]);

const CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['NC-999', 'NC-999']]);

const DESCRIPTION_RESULT_CELLS: ReadonlyMap<string, 'saved' | 'short'> = new Map<string, 'saved' | 'short'>([
  ['ve el aviso «NC-003 guardada»', 'saved'],
  ['ve el mensaje «La descripción debe tener al menos 10 caracteres» bajo «Descripción» y no se envía ninguna petición', 'short'],
]);

// --- Piezas de la fila sobre el diálogo del detalle -------------------------------------------------------------------------------

const dialogOf = (page: Page): Locator => detailDialog(page, 'NC-003');
const saveOf = (page: Page, name: 'Guardar' | 'Guardar y cerrar'): Locator => dialogOf(page).getByRole('button', { name, exact: true });

/** Abre /nc/NC-003 con la cuenta de la fila y espera a que el detalle muestre la no conformidad. */
const openDetail = async (page: Page, email: string, expected: string): Promise<{ readonly failed?: Outcome; readonly view?: DetailView }> => {
  const failed = await prepareWeb(page, email, expected, '/nc/NC-003');
  if (failed !== undefined) return { failed };
  const view = await waitDetail(page, (current) => current.open && current.stateText !== undefined && current.assigneeValue !== undefined);
  if (view === undefined || !view.open) return { failed: preparationFailedWeb(expected, 'el detalle de NC-003 no se abrió') };
  return { view };
};

/** Envía «Guardar» o «Guardar y cerrar» y devuelve el diagnóstico si el botón no se puede pulsar. */
const saveWith = (page: Page, name: 'Guardar' | 'Guardar y cerrar') => interact(saveOf(page, name), `pulsar «${name}»`, (element) => element.click(ACTION));

// --- Esquema 1: un rol con permiso de edición cambia la severidad ----------------------------------------------------------------

const changeSeverity: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const bodies = captureBodies(page, 'PATCH', '/api/nc/NC-003');
  const expected = `${account} elige ${cell(row, 'severidad')} en «Severidad», pulsa «Guardar» → aviso «${SAVED}» y la severidad del detalle es ${severity.label}`;
  const opened = await openDetail(page, account, expected);
  if (opened.failed !== undefined) return opened.failed;

  const picked = await interact(dialogOf(page).getByRole('option', { name: severity.label, exact: true }), `elegir «${severity.label}»`, (element) => element.click(ACTION));
  if (picked !== undefined) return actionFailed(expected, picked);
  const saved = await saveWith(page, 'Guardar');
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const view = await waitDetail(page, (current) => current.severityText === severity.label);
  const persisted = await pollPersisted('NC-003', (fields) => fields.severity === severity.key);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(view?.severityText === severity.label, `severidad del detalle «${severity.label}»`, `severidad del detalle «${view?.severityText ?? '(sin leer)'}»`),
    check(persisted?.severity === severity.key, `NC-003 guardada con severity ${severity.key}`, `NC-003 con severity ${persisted?.severity ?? '(sin leer)'}`),
    check(bodies().length === 1 && JSON.stringify(keysOf(bodies()[0] ?? '')) === JSON.stringify(['severity']), 'se envía solo el campo cambiado (severity)', `envíos PATCH con: ${bodies().map((raw) => keysOf(raw)?.join(', ') ?? '(sin leer)').join(' | ') || '(ninguno)'}`),
  ]);
};

// --- Esquema 2: los dos botones de guardado se diferencian en lo que pasa después --------------------------------------------

const twoSaveButtons: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const button = strict('boton', SAVE_CELLS, cell(row, 'boton'));
  const destination = strict('destino', DESTINATION_CELLS, cell(row, 'destino'));
  const expected = `gestor@sigpro.test elige «Menor» en «Severidad» y pulsa «${button}» → aviso «${SAVED}» y ${cell(row, 'destino')}`;
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  const picked = await interact(dialogOf(page).getByRole('option', { name: 'Menor', exact: true }), 'elegir «Menor»', (element) => element.click(ACTION));
  if (picked !== undefined) return actionFailed(expected, picked);
  const saved = await saveWith(page, button);
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  if (destination === 'stays-open') {
    const still = await waitDetail(page, (current) => current.open && current.severityText === 'Menor');
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
      check(still?.open === true, 'el detalle de NC-003 sigue abierto', `detalle abierto: ${still?.open === true ? 'sí' : 'no'}`),
      check(still?.severityText === 'Menor', 'severidad «Menor» en el detalle', `severidad «${still?.severityText ?? '(sin leer)'}»`),
    ]);
  }
  const closed = await waitUntil(async () => !(await readDetail(page))?.open && pathOf(page) === '/nc');
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(closed.reached, 'la pantalla vuelve a /nc', `ruta ${pathOf(page)}, detalle abierto: ${(await readDetail(page))?.open === true ? 'sí' : 'no'}`),
  ]);
};

// --- Esquema 3: la descripción debe tener al menos 10 caracteres para guardarse ---------------------------------------------------

const descriptionLength: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const result = strict('resultado', DESCRIPTION_RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test sustituye el texto de «Descripción» por ${cell(row, 'texto')} y pulsa «Guardar» → ${cell(row, 'resultado')}`;
  const log = watchRequests(page);
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  const written = await interact(dialogOf(page).getByRole('textbox', { name: 'Descripción', exact: true }), 'escribir en «Descripción»', (element) => element.fill(text, ACTION));
  if (written !== undefined) return actionFailed(expected, written);
  const saved = await saveWith(page, 'Guardar');
  if (saved !== undefined) return actionFailed(expected, saved);

  if (result === 'saved') {
    const toast = await toastShown(page, 'ok', SAVED);
    const persisted = await pollPersisted('NC-003', (fields) => plainOf(fields.description ?? '') === text);
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
      check(plainOf(persisted?.description ?? '') === text, `NC-003 guardada con la descripción de ${text.length} letras`, `descripción guardada: ${persisted?.description ?? '(sin leer)'}`),
    ]);
  }
  const shown = await waitUntil(async () => (await readDetail(page))?.descriptionError === SHORT_DESCRIPTION);
  const view = await readDetail(page);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${SHORT_DESCRIPTION}» bajo «Descripción»`, `bajo «Descripción»: ${view?.descriptionError ?? '(sin error visible)'}`),
    check(log.count('PATCH', '/api/nc/NC-003') === 0, 'ninguna petición de guardado', `peticiones PATCH /api/nc/NC-003: ${log.count('PATCH', '/api/nc/NC-003')}`),
    check(log.count('GET', '/api/nc/NC-003') > 0, 'control: el registro de peticiones ve la carga del detalle', `peticiones GET /api/nc/NC-003 vistas: ${log.count('GET', '/api/nc/NC-003')}`),
  ]);
};

// --- Esquema 4: elegir una persona la asigna al guardar -----------------------------------------------------------------------

const assignPerson: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const search = strict('busqueda', SEARCH_CELLS, cell(row, 'busqueda'));
  const person = strict('persona', PERSON_CELLS, cell(row, 'persona'));
  const expected = `gestor@sigpro.test escribe ${cell(row, 'busqueda')} en «Buscar persona…», elige ${cell(row, 'persona')} en «Personas» y pulsa «Guardar» → aviso «${SAVED}» y «Asignada a» muestra ${cell(row, 'persona')}`;
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  const typed = await interact(dialogOf(page).getByRole('combobox', { name: 'Asignada a', exact: true }), 'escribir en «Buscar persona…»', (element) => element.fill(search, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const chosen = await interact(dialogOf(page).getByRole('listbox', { name: 'Personas', exact: true }).getByRole('option', { name: person, exact: true }), `elegir ${person} en «Personas»`, (element) => element.click(ACTION));
  if (chosen !== undefined) return actionFailed(expected, chosen);
  const saved = await saveWith(page, 'Guardar');
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const field = await waitUntil(async () => (await readDetail(page))?.assigneeValue === person);
  const persisted = await pollPersisted('NC-003', (fields) => fields.assigneeName === person);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(field.reached, `«Asignada a» muestra ${person}`, `«Asignada a» muestra «${(await readDetail(page))?.assigneeValue ?? '(sin leer)'}»`),
    check(persisted?.assigneeName === person, `NC-003 asignada a ${person} en el servidor`, `NC-003 asignada a ${persisted?.assigneeName ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 5: quitar la asignación deja la no conformidad sin responsable -------------------------------------------------------

const removeAssignee: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('accion', ACTION_CELLS, cell(row, 'accion'));
  const expected = `gestor@sigpro.test pulsa «Quitar asignación» y después «Guardar» → aviso «${SAVED}», «Asignada a» vacío y «Buscar persona…»`;
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  const removed = await interact(dialogOf(page).getByRole('button', { name: 'Quitar asignación', exact: true }), 'pulsar «Quitar asignación»', (element) => element.click(ACTION));
  if (removed !== undefined) return actionFailed(expected, removed);
  const saved = await saveWith(page, 'Guardar');
  if (saved !== undefined) return actionFailed(expected, saved);

  const toast = await toastShown(page, 'ok', SAVED);
  const cleared = await waitUntil(async () => (await readDetail(page))?.assigneeValue === '');
  const view = await readDetail(page);
  const persisted = await pollPersisted('NC-003', (fields) => fields.assigneeId === null);
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${SAVED}»`, toast.observed),
    check(cleared.reached && view?.assigneeValue === '', '«Asignada a» vacío', `«Asignada a» muestra «${view?.assigneeValue ?? '(sin leer)'}»`),
    check(view?.assigneePlaceholder === 'Buscar persona…', '«Buscar persona…» como marcador', `marcador «${view?.assigneePlaceholder ?? '(sin leer)'}»`),
    check(persisted?.assigneeId === null, 'NC-003 sin asignar en el servidor', `NC-003 con assigneeId ${persisted === undefined ? '(sin leer)' : String(persisted.assigneeId)}`),
  ]);
};

// --- Esquema 6: una búsqueda sin coincidencias no ofrece personas -----------------------------------------------------------------

const noMatch: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const search = strict('busqueda', SEARCH_CELLS, cell(row, 'busqueda'));
  const expected = `gestor@sigpro.test escribe ${cell(row, 'busqueda')} en «Buscar persona…» → «${NO_MATCH}» y ninguna persona en «Personas»`;
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  const typed = await interact(dialogOf(page).getByRole('combobox', { name: 'Asignada a', exact: true }), 'escribir en «Buscar persona…»', (element) => element.fill(search, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const list = dialogOf(page).getByRole('listbox', { name: 'Personas', exact: true });
  const visible = await waitUntil(async () => (await list.count()) > 0 && (await list.first().isVisible()));
  const options = await list.getByRole('option').count();
  const text = (await list.first().textContent({ timeout: 2_000 }).catch(() => undefined))?.replace(/\s+/g, ' ').trim();
  return verdictWeb([
    check(visible.reached, 'la lista «Personas» visible', visible.reached ? 'la lista «Personas» visible' : 'la lista «Personas» no aparece'),
    check(text !== undefined && text.includes(NO_MATCH), `«${NO_MATCH}» en la lista`, `texto de la lista: «${text ?? '(sin leer)'}»`),
    check(options === 0, 'ninguna persona en la lista', `personas en la lista: ${options}`),
  ], 'La búsqueda se hace con «fill» (reemplaza el texto «Andrés Molina» que muestra el campo); pressSequentially lo habría añadido.');
};

// --- Esquema 7: un rol sin permiso de edición ve el detalle en solo lectura -------------------------------------------------------

const readOnlyForAuditor: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', DENIED_CELLS, cell(row, 'correo'));
  const expected = `${account} mira el detalle de NC-003 → aviso «${EDIT_DENIED}», «Guardar» y «Guardar y cerrar» deshabilitados; severidad, descripción y asignación de solo lectura`;
  const opened = await openDetail(page, account, expected);
  if (opened.failed !== undefined) return opened.failed;
  const view = await waitDetail(page, (current) => current.deniedNotice !== undefined);
  const save = await controlOf(saveOf(page, 'Guardar'));
  const saveClose = await controlOf(saveOf(page, 'Guardar y cerrar'));
  return verdictWeb([
    check(view?.deniedNotice === EDIT_DENIED, `aviso «${EDIT_DENIED}»`, `aviso «${view?.deniedNotice ?? '(sin aviso)'}»`),
    controlCheck(save, 'deshabilitado', EDIT_DENIED, '«Guardar»'),
    controlCheck(saveClose, 'deshabilitado', EDIT_DENIED, '«Guardar y cerrar»'),
    check(view?.pickerDisabled === true, 'selector de severidad deshabilitado', `selector de severidad ${view?.pickerDisabled === undefined ? '(sin leer)' : view.pickerDisabled ? 'deshabilitado' : 'habilitado'}`),
    check(view?.descriptionReadonly === true, 'descripción de solo lectura', `descripción ${view?.descriptionReadonly === undefined ? '(sin leer)' : view.descriptionReadonly ? 'de solo lectura' : 'editable'}`),
    check(view?.assigneeReadonly === true, 'asignación de solo lectura', `asignación ${view?.assigneeReadonly === undefined ? '(sin leer)' : view.assigneeReadonly ? 'de solo lectura' : 'editable'}`),
  ]);
};

// --- Esquema 8: sin cambios no se puede guardar ----------------------------------------------------------------------------------

const noChangesNoSave: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `gestor@sigpro.test abre el detalle de NC-003 ${cell(row, 'estado')} → «Guardar» y «Guardar y cerrar» deshabilitados con «${NO_CHANGES}»`;
  const opened = await openDetail(page, 'gestor@sigpro.test', expected);
  if (opened.failed !== undefined) return opened.failed;

  if (state === 'ida-y-vuelta') {
    const toMinor = await interact(dialogOf(page).getByRole('option', { name: 'Menor', exact: true }), 'elegir «Menor»', (element) => element.click(ACTION));
    if (toMinor !== undefined) return actionFailed(expected, toMinor);
    const enabled = await waitUntil(async () => {
      const save = await controlOf(saveOf(page, 'Guardar'));
      return save !== undefined && !save.disabled;
    });
    const enabledWhenChanged = enabled.reached;
    const backToCritical = await interact(dialogOf(page).getByRole('option', { name: 'Crítica', exact: true }), 'elegir «Crítica»', (element) => element.click(ACTION));
    if (backToCritical !== undefined) return actionFailed(expected, backToCritical);
    const save = await waitUntil(async () => {
      const current = await controlOf(saveOf(page, 'Guardar'));
      return current !== undefined && current.disabled;
    });
    const saveNow = await controlOf(saveOf(page, 'Guardar'));
    const saveCloseNow = await controlOf(saveOf(page, 'Guardar y cerrar'));
    return verdictWeb([
      check(enabledWhenChanged, '«Guardar» habilitado tras cambiar la severidad a «Menor» (la fila distingue)', enabledWhenChanged ? 'tras cambiar a «Menor» «Guardar» queda habilitado' : 'tras cambiar a «Menor» «Guardar» sigue deshabilitado'),
      check(save.reached, 'tras volver a «Crítica» «Guardar» deshabilitado', save.reached ? 'tras volver a «Crítica» «Guardar» queda deshabilitado' : 'tras volver a «Crítica» «Guardar» sigue habilitado'),
      controlCheck(saveNow, 'deshabilitado', NO_CHANGES, '«Guardar»'),
      controlCheck(saveCloseNow, 'deshabilitado', NO_CHANGES, '«Guardar y cerrar»'),
    ]);
  }
  const save = await controlOf(saveOf(page, 'Guardar'));
  const saveClose = await controlOf(saveOf(page, 'Guardar y cerrar'));
  return verdictWeb([controlCheck(save, 'deshabilitado', NO_CHANGES, '«Guardar»'), controlCheck(saveClose, 'deshabilitado', NO_CHANGES, '«Guardar y cerrar»')]);
};

// --- Esquema 9: un código que no existe muestra el aviso de no encontrado ---------------------------------------------------------

const notFound: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', CODE_CELLS, cell(row, 'codigo'));
  const expected = `gestor@sigpro.test abre /nc/${code} → aviso «${NOT_FOUND}»`;
  const failed = await prepareWeb(page, 'gestor@sigpro.test', expected, `/nc/${code}`);
  if (failed !== undefined) return failed;
  const shown = await waitUntil(async () => (await readDetail(page))?.notFound === NOT_FOUND);
  const view = await readDetail(page);
  return verdictWeb([check(shown.reached, `aviso «${NOT_FOUND}»`, `aviso «${view?.notFound ?? '(sin aviso)'}»`)]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-007',
  surface: 'web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(changeSeverity)],
    [2, onWeb(twoSaveButtons)],
    [3, onWeb(descriptionLength)],
    [4, onWeb(assignPerson)],
    [5, onWeb(removeAssignee)],
    [6, onWeb(noMatch)],
    [7, onWeb(readOnlyForAuditor)],
    [8, onWeb(noChangesNoSave)],
    [9, onWeb(notFound)],
  ]),
});
