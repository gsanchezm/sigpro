import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { actionFailed, interact, newButton, newDialog, observe, onWeb, persistedTotalAll, pollPersisted, prepareWeb, readNew, toastShown, verdictWeb, waitCount, watchRequests, type Blocked } from './common';

// US-NC-GESTION-006 — Alta de una no conformidad desde «Nueva no conformidad» en /nc (escritorio 1440 px). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador; la cuenta de la fila inicia sesión en /login?tenant=alumno01 y abre /nc. El recuento del seed
// es «12 no conformidades · 8 abiertas». Las peticiones se observan con un registro instalado antes de la acción; un formulario con errores
// no debe enviar ninguna petición de alta. El alta válida se comprueba también en el servidor (NC-013) con la cuenta administradora.

const TEN_A = 'a'.repeat(10);
const COUNT_BEFORE = '12 no conformidades · 8 abiertas';
const COUNT_AFTER_CREATE = '13 no conformidades · 9 abiertas';
const CREATE_PATH = '/api/nc';
const LIST_PATH = '/api/nc';

/** Severidades de la celda: el texto de la interfaz (con sus comillas) y la clave que guarda la API. */
const SEVERITY_CELLS: ReadonlyMap<string, { readonly label: string; readonly key: string }> = new Map<string, { readonly label: string; readonly key: string }>([
  ['«Crítica»', { label: 'Crítica', key: 'critical' }],
  ['«Menor»', { label: 'Menor', key: 'minor' }],
  ['«Mayor»', { label: 'Mayor', key: 'major' }],
]);

/** Cuentas de las celdas «correo» de esta historia (la de alumno01 es la administradora del tenant). */
const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
  ['alumno01@sigpro.lab', 'alumno01@sigpro.lab'],
]);

/** Mensajes de error del formulario, tal como los escribe la historia (la celda los trae entre comillas). */
const MESSAGE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Elige un programa»', 'Elige un programa'],
  ['«Elige una severidad»', 'Elige una severidad'],
  ['«La descripción debe tener al menos 10 caracteres»', 'La descripción debe tener al menos 10 caracteres'],
]);

/** Campos que rellena cada combinación de la celda «combinacion» (`undefined` = el campo se deja sin elegir o vacío) y el error que debe mostrarse. */
interface Filling {
  readonly program: string | undefined;
  readonly severity: string | undefined;
  readonly description: string | undefined;
  readonly errorField: 'programError' | 'severityError' | 'descriptionError';
}

const FILLING_CELLS: ReadonlyMap<string, Filling> = new Map<string, Filling>([
  ['sin programa, severidad «Menor» y descripción (10 letras a)', { program: undefined, severity: 'Menor', description: TEN_A, errorField: 'programError' }],
  ['programa PRG-001, sin severidad y descripción (10 letras a)', { program: 'PRG-001', severity: undefined, description: TEN_A, errorField: 'severityError' }],
  ['programa PRG-001, severidad «Menor» y descripción (9 letras a)', { program: 'PRG-001', severity: 'Menor', description: 'a'.repeat(9), errorField: 'descriptionError' }],
  ['programa PRG-001, severidad «Menor» y descripción (12 espacios)', { program: 'PRG-001', severity: 'Menor', description: ' '.repeat(12), errorField: 'descriptionError' }],
  ['programa PRG-001, severidad «Menor» y descripción vacía', { program: 'PRG-001', severity: 'Menor', description: undefined, errorField: 'descriptionError' }],
]);

/** Intento de la celda «intento» (enviar con el formulario vacío, o cancelar). */
const INTENT_CELLS: ReadonlyMap<string, 'submit-empty' | 'cancel'> = new Map<string, 'submit-empty' | 'cancel'>([
  ['pulsa «Abrir no conformidad» con el formulario vacío', 'submit-empty'],
  ['pulsa «Cancelar»', 'cancel'],
]);

/** Abre «Nueva no conformidad» desde /nc y espera al diálogo; un fallo devuelve su diagnóstico. */
const openNew = async (page: Page): Promise<Blocked | undefined> => {
  const clicked = await interact(newButton(page), 'pulsar «Nueva no conformidad»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  const shown = await waitUntil(async () => (await newDialog(page).count()) > 0);
  return shown.reached ? undefined : { message: 'no se abrió el diálogo «Nueva no conformidad»', note: 'el botón no abre el formulario en el plazo' };
};

/** Rellena el formulario abierto: programa (por su código), severidad (opción del selector) y descripción (editor enriquecido). */
const fillNew = async (page: Page, filling: { readonly program?: string; readonly severity?: string; readonly description?: string }): Promise<Blocked | undefined> => {
  const dialog = newDialog(page);
  if (filling.program !== undefined) {
    const program = filling.program;
    const picked = await interact(dialog.getByRole('combobox', { name: 'Programa', exact: true }), 'elegir el programa en «Programa»', (element) => element.selectOption(program, ACTION));
    if (picked !== undefined) return picked;
  }
  if (filling.severity !== undefined) {
    const option = filling.severity;
    const chosen = await interact(dialog.getByRole('option', { name: option, exact: true }), `elegir la severidad «${option}»`, (element) => element.click(ACTION));
    if (chosen !== undefined) return chosen;
  }
  if (filling.description !== undefined) {
    const text = filling.description;
    const written = await interact(dialog.getByRole('textbox', { name: 'Descripción', exact: true }), 'escribir en «Descripción»', (element) => element.fill(text, ACTION));
    if (written !== undefined) return written;
  }
  return undefined;
};

/** Pulsa «Abrir no conformidad» del diálogo. */
const submitNew = (page: Page): Promise<Blocked | undefined> =>
  interact(newDialog(page).getByRole('button', { name: 'Abrir no conformidad', exact: true }), 'pulsar «Abrir no conformidad»', (element) => element.click(ACTION));

// --- Esquema 1: cada rol abre una no conformidad con datos válidos -------------------------------------------------------------

const createValid: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const expected = `${account} abre «Nueva no conformidad» con PRG-001, severidad «${severity.label}» y descripción (10 letras a) → aviso «NC-013 abierta» y recuento «${COUNT_AFTER_CREATE}»`;
  const log = watchRequests(page);
  const failed = await prepareWeb(page, account, expected, '/nc');
  if (failed !== undefined) return failed;

  const opened = await openNew(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const filled = await fillNew(page, { program: 'PRG-001', severity: severity.label, description: TEN_A });
  if (filled !== undefined) return actionFailed(expected, filled);
  const submitted = await submitNew(page);
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const toast = await toastShown(page, 'ok', 'NC-013 abierta');
  const counted = await waitCount(page, COUNT_AFTER_CREATE);
  const dialogGone = await waitUntil(async () => (await newDialog(page).count()) === 0);
  // Comprobación en el servidor, después de los avisos y con sondeo: la NC existe con lo que se eligió
  const saved = await pollPersisted('NC-013', (fields) => fields.code === 'NC-013');
  return verdictWeb([
    check(toast.readable && toast.seen, 'aviso «NC-013 abierta»', toast.observed),
    check(counted === COUNT_AFTER_CREATE, `recuento «${COUNT_AFTER_CREATE}»`, `recuento «${counted ?? '(sin leer)'}»`),
    check(dialogGone.reached, 'el formulario se cierra', dialogGone.reached ? 'el formulario se cerró' : 'el formulario sigue abierto'),
    check(saved?.severity === severity.key, `NC-013 guardada con severidad ${severity.key}`, `NC-013 guardada con severidad ${saved?.severity ?? '(sin leer)'}`),
    check(saved?.programCode === 'PRG-001', 'NC-013 en PRG-001', `NC-013 en ${saved?.programCode ?? '(sin leer)'}`),
    check(saved?.state === 'open', 'NC-013 en estado open', `NC-013 en estado ${saved?.state ?? '(sin leer)'}`),
    check(saved?.assigneeId === null, 'NC-013 sin asignar (el alta no ofrece persona)', `NC-013 con assigneeId ${saved === undefined ? '(sin leer)' : String(saved.assigneeId)}`),
    check(log.count('POST', CREATE_PATH) === 1, 'una sola petición POST /api/nc', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
  ]);
};

// --- Esquema 2: cada campo obligatorio se valida antes de enviar ---------------------------------------------------------------

const eachFieldValidated: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const filling = strict('combinacion', FILLING_CELLS, cell(row, 'combinacion'));
  const message = strict('mensaje', MESSAGE_CELLS, cell(row, 'mensaje'));
  const expected = `al enviar «${cell(row, 'combinacion')}» aparece «${message}» bajo su campo, el formulario sigue abierto y no hay petición de alta`;
  const log = watchRequests(page);
  const failed = await prepareWeb(page, 'gestor@sigpro.test', expected, '/nc');
  if (failed !== undefined) return failed;

  const opened = await openNew(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const filled = await fillNew(page, {
    ...(filling.program === undefined ? {} : { program: filling.program }),
    ...(filling.severity === undefined ? {} : { severity: filling.severity }),
    ...(filling.description === undefined ? {} : { description: filling.description }),
  });
  if (filled !== undefined) return actionFailed(expected, filled);
  // Relectura del editor tras escribir: lo que llega a «Descripción» es el texto de la fila (vacío si la fila no escribe nada)
  const readBack = (await newDialog(page).getByRole('textbox', { name: 'Descripción', exact: true }).first().textContent({ timeout: 2_000 }).catch(() => null)) ?? undefined;
  const submitted = await submitNew(page);
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const shown = await waitUntil(async () => (await readNew(page))?.[filling.errorField] === message);
  const view = await readNew(page);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${message}» bajo su campo`, `bajo su campo: ${view?.[filling.errorField] ?? '(sin error visible)'}`),
    check(readBack !== undefined && readBack.trim() === (filling.description ?? '').trim(), 'el campo «Descripción» contiene el texto de la fila', `campo «Descripción» con «${readBack ?? '(sin leer)'}»`),
    check((await readNew(page))?.open === true, 'el formulario sigue abierto', (await readNew(page))?.open === true ? 'el formulario sigue abierto' : 'el formulario no está abierto'),
    check(log.count('POST', CREATE_PATH) === 0, 'ninguna petición de alta', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
    check(log.count('GET', LIST_PATH) > 0, 'control: el registro de peticiones ve la carga de la lista', `peticiones GET /api/nc vistas: ${log.count('GET', LIST_PATH)}`),
  ]);
};

// --- Esquema 3: sin rellenar nada, los tres mensajes aparecen a la vez ----------------------------------------------------------

const allThreeAtOnce: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', INTENT_CELLS, cell(row, 'intento'));
  const expected = 'con el formulario vacío, «Elige un programa» bajo «Programa», «Elige una severidad» bajo «Severidad» y «La descripción debe tener al menos 10 caracteres» bajo «Descripción», y no hay petición de alta';
  const log = watchRequests(page);
  const failed = await prepareWeb(page, 'gestor@sigpro.test', expected, '/nc');
  if (failed !== undefined) return failed;

  const opened = await openNew(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const submitted = await submitNew(page);
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const all = await waitUntil(async () => {
    const view = await readNew(page);
    return view?.programError === 'Elige un programa' && view.severityError === 'Elige una severidad' && view.descriptionError === 'La descripción debe tener al menos 10 caracteres';
  });
  const view = await readNew(page);
  await observe(2_000);
  return verdictWeb([
    check(all.reached, 'los tres mensajes a la vez', `Programa: ${view?.programError ?? '(sin error)'}; Severidad: ${view?.severityError ?? '(sin error)'}; Descripción: ${view?.descriptionError ?? '(sin error)'}`),
    check(log.count('POST', CREATE_PATH) === 0, 'ninguna petición de alta', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
    check(log.count('GET', LIST_PATH) > 0, 'control: el registro de peticiones ve la carga de la lista', `peticiones GET /api/nc vistas: ${log.count('GET', LIST_PATH)}`),
  ]);
};

// --- Esquema 4: cancelar no abre ninguna no conformidad --------------------------------------------------------------------------

const cancelOpens: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  strict('intento', INTENT_CELLS, cell(row, 'intento'));
  const expected = `con el formulario «Nueva no conformidad» rellenado (PRG-001, «Menor», 10 letras a), pulsa «Cancelar»: el formulario se cierra, no se envía ninguna petición y el recuento sigue en «${COUNT_BEFORE}»`;
  const log = watchRequests(page);
  const failed = await prepareWeb(page, 'gestor@sigpro.test', expected, '/nc');
  if (failed !== undefined) return failed;

  const opened = await openNew(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const filled = await fillNew(page, { program: 'PRG-001', severity: 'Menor', description: TEN_A });
  if (filled !== undefined) return actionFailed(expected, filled);
  const cancelled = await interact(newDialog(page).getByRole('button', { name: 'Cancelar', exact: true }), 'pulsar «Cancelar»', (element) => element.click(ACTION));
  if (cancelled !== undefined) return actionFailed(expected, cancelled);

  const closed = await waitUntil(async () => (await newDialog(page).count()) === 0);
  const counted = await waitCount(page, COUNT_BEFORE);
  await observe(2_000);
  const total = await persistedTotalAll();
  return verdictWeb([
    check(closed.reached, 'el formulario se cierra', closed.reached ? 'el formulario se cerró' : 'el formulario sigue abierto'),
    check(counted === COUNT_BEFORE, `recuento «${COUNT_BEFORE}»`, `recuento «${counted ?? '(sin leer)'}»`),
    check(log.count('POST', CREATE_PATH) === 0, 'ninguna petición de alta', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
    check(total === 12, 'el servidor sigue con 12 no conformidades (no se abrió nada)', `el servidor tiene ${total ?? '(sin leer)'} no conformidades`),
  ]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-006',
  surface: 'web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(createValid)],
    [2, onWeb(eachFieldValidated)],
    [3, onWeb(allThreeAtOnce)],
    [4, onWeb(cancelOpens)],
  ]),
});
