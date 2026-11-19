import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, pathOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  checkedCheck,
  disabledWithReason,
  editBudgetField,
  editClassifiedField,
  editNameField,
  editOwnerField,
  editSaveButton,
  editSaveCloseButton,
  editSettled,
  editStatusField,
  enabledCheck,
  fieldValueCheck,
  fillField,
  selectedLabelCheck,
  interact,
  LOCAL_MS,
  NET_MS,
  onWeb,
  openPath,
  signIn,
  waitForOkToast,
} from './common';

// US-PROG-ALTA-010 — Editar un programa y guardar o cerrar la edición (web). Preparación de cada fila: reinicio de alumno01, gestor entra
// desde /login?tenant=alumno01, llega a /programs y abre /programs/PRG-001/edit. Tras el reinicio, PRG-001 tiene los valores de la semilla.

const EDIT_PATH = '/programs/PRG-001/edit';
const DETAIL_PATH = '/programs/PRG-001';
const NAME_SEED = 'Sistema de mando táctico Ártemis';
const NAME_CHANGED = 'Sistema de mando táctico Ártemis II';
const SAVED_TITLE = 'Programa actualizado';
const SAVED_BODY = 'PRG-001 se guardó correctamente';
const NO_CHANGES = 'No hay cambios que guardar';

/** Prepara la fila: gestor en la edición de PRG-001 (o un fallo de preparación con su motivo). */
const openEdit = async (page: Page, expected: string): Promise<string | undefined> => {
  const signed = await signIn(page);
  if (signed) return signed;
  const opened = await openPath(page, EDIT_PATH);
  if (opened) return opened;
  return (await editSettled(page)) ? undefined : `la edición de PRG-001 no se muestra (${expected})`;
};

// --- Esquema 1: el formulario muestra los valores guardados del programa ------------------------------------------------------

/** Campo de la tabla → cómo se lee el valor mostrado (texto de un campo, o marcado). */
const FIELD_OF: ReadonlyMap<string, { readonly locator: (page: Page) => Locator; readonly kind: 'text' | 'checked'; readonly value: string | boolean; readonly what: string }> = new Map([
  ['«Nombre»', { locator: editNameField, kind: 'text', value: NAME_SEED, what: 'el campo «Nombre»' }],
  ['«Responsable»', { locator: editOwnerField, kind: 'text', value: 'Marta Ruiz', what: 'el campo «Responsable»' }],
  ['«Programa clasificado»', { locator: editClassifiedField, kind: 'checked', value: true, what: 'el campo «Programa clasificado»' }],
]);

const showsSaved: BrowserRowHandler = async (row, { page }) => {
  const expected = `el campo ${cell(row, 'campo')} muestra ${cell(row, 'valor')}`;
  const prepared = await openEdit(page, expected);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const field = strict('campo', FIELD_OF, cell(row, 'campo'));
  if (field.kind === 'checked') return conclude([await checkedCheck(field.locator(page), field.value === true, field.what)]);
  // El formulario carga sus personas por red: el valor del responsable se espera con el techo de red
  return conclude([await fieldValueCheck(field.locator(page), String(field.value), field.what, NET_MS)]);
};

/** Fila «cambio» de la tabla → qué se cambia antes de mirar «Guardar». «(ninguno)» no cambia nada. */
const CHANGE_OF: ReadonlyMap<string, 'none' | 'name'> = new Map<string, 'none' | 'name'>([
  ['(ninguno)', 'none'],
  ['escribe «Sistema de mando táctico Ártemis II» en «Nombre»', 'name'],
]);

const preparationWeb = (expected: string, message: string) => preparationFailedWeb(expected, message);

// --- Esquema 2: guardar solo se habilita cuando algún campo cambia ----------------------------------------------------------

const changeRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  const prepared = await openEdit(page, expected);
  if (prepared) return preparationWeb(expected, prepared);
  const change = strict('cambio', CHANGE_OF, cell(row, 'cambio'));
  if (change === 'none') {
    return conclude([
      await disabledWithReason(editSaveButton(page), NO_CHANGES, 'Guardar'),
      await disabledWithReason(editSaveCloseButton(page), NO_CHANGES, 'Guardar y cerrar'),
    ]);
  }
  const typed = await fillField(editNameField(page), NAME_CHANGED, 'Nombre');
  if (typed) return actionFailed(expected, typed);
  return conclude([await enabledCheck(editSaveButton(page), true, 'Guardar'), await enabledCheck(editSaveCloseButton(page), true, 'Guardar y cerrar')]);
};

// --- Esquema 3: guardar aplica el cambio y se queda en la edición ------------------------------------------------------------

/** Campo de la tabla → cambio que hace la fila, y lo que muestra después. */
const SAVE_CHANGE: ReadonlyMap<string, { readonly change: (page: Page) => Promise<unknown>; readonly check: (page: Page) => Promise<Check>; readonly label: string }> = new Map([
  [
    '«Presupuesto (€)»',
    {
      change: (page) => editBudgetField(page).fill('500000', ACTION),
      check: (page) => fieldValueCheck(editBudgetField(page), '500000', 'el campo «Presupuesto (€)»', NET_MS),
      label: 'Presupuesto (€)',
    },
  ],
  [
    '«Estado»',
    {
      change: (page) => editStatusField(page).selectOption({ label: 'En pausa' }, ACTION),
      check: (page) => selectedLabelCheck(editStatusField(page), 'En pausa', 'el campo «Estado»', NET_MS),
      label: 'Estado',
    },
  ],
  [
    '«Prioridad»',
    {
      change: (page) => page.getByRole('radio', { name: 'Alta', exact: true }).check(ACTION),
      check: (page) => checkedCheck(page.getByRole('radio', { name: 'Alta', exact: true }), true, 'la prioridad «Alta»', NET_MS),
      label: 'Prioridad',
    },
  ],
  [
    '«Programa clasificado»',
    {
      change: (page) => editClassifiedField(page).uncheck(ACTION),
      check: (page) => checkedCheck(editClassifiedField(page), false, 'el campo «Programa clasificado»', NET_MS),
      label: 'Programa clasificado',
    },
  ],
]);

const saveRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el aviso «${SAVED_TITLE}» con el texto «${SAVED_BODY}», sigue en ${EDIT_PATH} y el campo ${cell(row, 'campo')} muestra ${cell(row, 'valor')}`;
  const prepared = await openEdit(page, expected);
  if (prepared) return preparationWeb(expected, prepared);
  const item = strict('campo', SAVE_CHANGE, cell(row, 'campo'));
  const changed = await interact(page.locator('body'), `cambiar ${item.label}`, () => item.change(page));
  if (changed) return actionFailed(expected, changed);
  const saved = await interact(editSaveButton(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved) return actionFailed(expected, saved);
  const toast = await waitForOkToast(page, SAVED_TITLE, SAVED_BODY, NET_MS);
  const stays = await waitUntil(async () => pathOf(page) === EDIT_PATH, LOCAL_MS);
  return conclude([
    check(toast, `aviso «${SAVED_TITLE}» con «${SAVED_BODY}»`, `no aparece el aviso «${SAVED_TITLE}» con «${SAVED_BODY}»`),
    check(stays.reached, `sigue en ${EDIT_PATH}`, `está en ${pathOf(page)}`),
    await item.check(page),
  ]);
};

// --- Esquema 4: guardar y cerrar o cancelar llevan al detalle del programa ---------------------------------------------------

/** Botón de la fila de salida → su acción. */
const BUTTON_OF: ReadonlyMap<string, 'saveClose' | 'cancel'> = new Map<string, 'saveClose' | 'cancel'>([
  ['«Guardar y cerrar»', 'saveClose'],
  ['«Cancelar»', 'cancel'],
]);

const exitRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const prepared = await openEdit(page, expected);
  if (prepared) return preparationWeb(expected, prepared);
  const typed = await fillField(editNameField(page), NAME_CHANGED, 'Nombre');
  if (typed) return actionFailed(expected, typed);
  const boton = strict('boton', BUTTON_OF, cell(row, 'boton'));
  if (boton === 'saveClose') {
    const closed = await interact(editSaveCloseButton(page), 'pulsar «Guardar y cerrar»', (element) => element.click(ACTION));
    if (closed) return actionFailed(expected, closed);
    const arrived = await waitUntil(async () => pathOf(page) === DETAIL_PATH, NET_MS);
    const toast = await waitForOkToast(page, SAVED_TITLE, SAVED_BODY, NET_MS);
    return conclude([check(arrived.reached, `llega a ${DETAIL_PATH}`, `está en ${pathOf(page)}`), check(toast, `ve el aviso «${SAVED_TITLE}»`, `no ve el aviso «${SAVED_TITLE}»`)]);
  }
  const cancelled = await interact(page.getByRole('link', { name: 'Cancelar', exact: true }), 'pulsar «Cancelar»', (element) => element.click(ACTION));
  if (cancelled) return actionFailed(expected, cancelled);
  const arrived = await waitUntil(async () => pathOf(page) === DETAIL_PATH, NET_MS);
  const reopened = await openPath(page, EDIT_PATH);
  if (reopened) return preparationWeb(expected, reopened);
  if (!(await editSettled(page))) return preparationWeb(expected, `la edición de PRG-001 no se muestra al reabrirla`);
  return conclude([
    check(arrived.reached, `llega a ${DETAIL_PATH} sin guardar`, `está en ${pathOf(page)}`),
    await fieldValueCheck(editNameField(page), NAME_SEED, `al abrir ${EDIT_PATH}, el campo «Nombre»`),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(showsSaved)],
    [2, onWeb(changeRow)],
    [3, onWeb(saveRow)],
    [4, onWeb(exitRow)],
  ]),
});
