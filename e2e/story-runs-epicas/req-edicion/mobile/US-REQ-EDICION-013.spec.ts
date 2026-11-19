import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACTION, holdsFor, quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, strict } from '../../support/checks';
import { field } from '../../../story-runs/support/api';
import { ACCOUNT_OF, TENANT_A, act, loginAs, resetTenants, verdict } from '../api/common';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS } from '../../../../packages/shared/src/testids';
import { interact, toastShown, type WebAction } from '../web/common';
import { ACCOUNT_CREDENTIALS, mobileStateCheck, onExpoWeb, openSheet, outcomeOf, prepareMobile, sheet, sheetButton, textVisible, settleMobile } from './common';

// US-REQ-EDICION-013 — Editar un requisito en la hoja (app móvil, Expo web 390 px). Preparación de cada fila: reinicio de alumno01, la app
// en /login con alumno01 en «Tenant de trabajo», inicio de sesión y apertura de la hoja de REQ-001 o de REQ-002 (estado del seed).

const EDIT_FORM = (page: Page): Locator => page.getByTestId(MOVIL_REQUIREMENTS_TESTIDS.EDIT_FORM);
const SAVE = (page: Page): Locator => page.getByRole('button', { name: 'Guardar', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_SAVE));
const SAVE_CLOSE = (page: Page): Locator => page.getByRole('button', { name: 'Guardar y cerrar', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_SAVE_CLOSE));
const TITLE = (page: Page): Locator => EDIT_FORM(page).getByRole('textbox', { name: 'Título', exact: true });
const NOTICE = 'Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.';

/** Abre «Editar» dentro de la hoja abierta. */
const openEdit: WebAction = (page) => interact(sheetButton(page, 'Editar'), 'pulsar «Editar»', (element) => element.click(ACTION));

/** Cambio del formulario de edición de la celda. */
const CHANGE_OF: ReadonlyMap<string, WebAction> = new Map<string, WebAction>([
  ['cambia «Prioridad» a «Baja»', async (page) => {
    const opened = await interact(EDIT_FORM(page).getByRole('combobox', { name: 'Prioridad', exact: true }), 'abrir «Prioridad»', (element) => element.click(ACTION));
    if (opened !== undefined) return opened;
    return interact(page.getByRole('radio', { name: 'Baja', exact: true }), 'elegir «Baja»', (element) => element.click(ACTION));
  }],
  ['cambia «Título» a Disponibilidad revisada del subsistema 001', (page) => interact(TITLE(page), 'escribir en «Título»', (element) => element.fill('Disponibilidad revisada del subsistema 001', ACTION))],
  ['añade la etiqueta «Normativo» en «Etiquetas»', (page) => interact(EDIT_FORM(page).getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_TAG_OPTION('regulatory')), 'marcar la etiqueta «Normativo»', (element) => element.click(ACTION))],
]);

/** Estado que la celda pide tras guardar (texto de la celda) y su valor en la API. */
const STATE_OF: ReadonlyMap<string, string> = new Map([
  ['«Aprobado»', 'approved'],
  ['«Borrador»', 'draft'],
]);

/** Estado del requisito por la API con la cuenta gestor. */
const storedState = async (code: string): Promise<unknown> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : field((await act('GET', `/requirements/${code}`, session.token)).body, 'state');
};

/** Título guardado de un requisito por la API. */
const storedTitle = async (code: string): Promise<unknown> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token === undefined ? undefined : field((await act('GET', `/requirements/${code}`, session.token)).body, 'title');
};

// --- Esquema 1: guardar o guardar y cerrar según el cambio y el estado final -------------------------------------------------

const SAVE_BUTTON_OF: ReadonlyMap<string, (page: Page) => Locator> = new Map([
  ['«Guardar»', SAVE],
  ['«Guardar y cerrar»', SAVE_CLOSE],
]);

const SHEET_AFTER_OF: ReadonlyMap<string, 'open' | 'closed'> = new Map([
  ['sigue abierta con los datos del requisito', 'open'],
  ['se cierra', 'closed'],
]);

const savesAndCloses: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso «Requisito guardado» con ${cell(row, 'aviso_texto')}; la hoja ${cell(row, 'hoja')}; REQ-001 en ${cell(row, 'estado')}`;
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const change = strict('cambio', CHANGE_OF, cell(row, 'cambio'));
  const button = strict('botón', SAVE_BUTTON_OF, cell(row, 'boton'));
  const steps: WebAction[] = [openSheet('REQ-001'), openEdit, change];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  const pressed = await interact(button(page), `pulsar ${cell(row, 'boton')}`, (element) => element.click(ACTION));
  if (pressed !== undefined) return outcomeOf([check(false, expected, pressed.message)], pressed.note);
  const body = quoted(cell(row, 'aviso_texto'));
  const toast = await toastShown(page, 'ok', 'Requisito guardado', body);
  await settleMobile();
  const after = strict('hoja', SHEET_AFTER_OF, cell(row, 'hoja'));
  const sheetOpen = await safe(() => sheet(page).isVisible(), false);
  const formOpen = await safe(() => EDIT_FORM(page).isVisible(), false);
  const state = await storedState('REQ-001');
  const wanted = strict('estado', STATE_OF, cell(row, 'estado'));
  return verdict([
    check(toast.seen, `«Requisito guardado» con «${body}»`, `aviso ${toast.observed}`),
    check(after === 'open' ? sheetOpen && !formOpen : !sheetOpen, `la hoja ${cell(row, 'hoja')}`, after === 'open' ? (sheetOpen && !formOpen ? 'la hoja sigue abierta con los datos' : `la hoja ${sheetOpen ? 'abierta' : 'cerrada'}, formulario ${formOpen ? 'abierto' : 'cerrado'}`) : sheetOpen ? 'la hoja sigue abierta' : 'la hoja se cerró'),
    check(state === wanted, `REQ-001 en ${cell(row, 'estado')}`, `REQ-001 guardado con state ${String(state)}`),
  ]);
};

// --- Esquema 2: el aviso de vuelta a borrador aparece solo al cambiar el texto -------------------------------------------

const NOTICE_OF: ReadonlyMap<string, { readonly visible: boolean; readonly text?: string }> = new Map([
  ['ve el aviso «Este requisito está en estado aprobado. Si cambias el título o la descripción volverá a Borrador.»', { visible: true, text: NOTICE }],
  ['no ve ningún aviso de vuelta a borrador', { visible: false }],
]);

const noticeOnTextOnly: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const notice = strict('aviso', NOTICE_OF, cell(row, 'aviso'));
  const expected = notice.visible ? `aparece el aviso «${NOTICE}» con REQ-001 aprobado` : 'no aparece ningún aviso de vuelta a borrador';
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const steps: WebAction[] = [openSheet('REQ-001'), openEdit, strict('cambio', CHANGE_OF, cell(row, 'cambio'))];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  if (notice.visible) {
    const shown = await waitUntil(() => textVisible(page, NOTICE));
    return verdict([check(shown.reached, `aparece el aviso «${NOTICE}»`, shown.reached ? `aparece el aviso «${NOTICE}»` : 'no aparece ningún aviso de vuelta a borrador')]);
  }
  const hidden = await holdsFor(async () => !(await textVisible(page, NOTICE)));
  return verdict([check(hidden.held, 'no aparece ningún aviso de vuelta a borrador', hidden.held ? 'no aparece ningún aviso de vuelta a borrador' : 'aparece el aviso de vuelta a borrador')]);
};

// --- Esquema 3: sin cambios no se guarda, cancelar descarta y un título no válido no se envía --------------------------

const EXPECT_OF: ReadonlyMap<string, 'no-changes' | 'invalid-title' | 'cancel'> = new Map([
  ['no cambia ningún campo', 'no-changes'],
  ['cambia «Título» a ab y pulsa «Guardar»', 'invalid-title'],
  ['cambia «Título» a Otro título y pulsa «Cancelar»', 'cancel'],
]);

const noChangesCancelOrReject: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = cell(row, 'resultado');
  const failure = await prepareMobile(page, ACCOUNT_CREDENTIALS.gestor, expected);
  if (failure !== undefined) return failure;
  const kind = strict('acción', EXPECT_OF, cell(row, 'accion'));
  const steps: WebAction[] = [openSheet('REQ-002'), openEdit];
  for (const step of steps) {
    const blocked = await step(page);
    if (blocked !== undefined) return outcomeOf([check(false, expected, blocked.message)], blocked.note);
  }
  if (kind === 'no-changes') {
    const save = await mobileStateCheck(SAVE(page), 'deshabilitado', 'No hay cambios que guardar');
    const saveClose = await mobileStateCheck(SAVE_CLOSE(page), 'deshabilitado', 'No hay cambios que guardar');
    return verdict([save, saveClose]);
  }
  if (kind === 'invalid-title') {
    const typed = await interact(TITLE(page), 'escribir «ab» en «Título»', (element) => element.fill('ab', ACTION));
    if (typed !== undefined) return outcomeOf([check(false, expected, typed.message)], typed.note);
    const pressed = await interact(SAVE(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
    if (pressed !== undefined) return outcomeOf([check(false, expected, pressed.message)], pressed.note);
    const notice = await waitUntil(() => textVisible(page, 'El título debe tener al menos 3 caracteres'));
    const title = await storedTitle('REQ-002');
    return verdict([
      check(notice.reached, 'bajo «Título» el aviso «El título debe tener al menos 3 caracteres»', notice.reached ? 'bajo «Título» el aviso «El título debe tener al menos 3 caracteres»' : 'no aparece el aviso del título'),
      check(title === 'Latencia del subsistema 002', 'el título de REQ-002 no cambia', `el título de REQ-002 es «${String(title)}»`),
    ]);
  }
  const typed = await interact(TITLE(page), 'escribir «Otro título» en «Título»', (element) => element.fill('Otro título', ACTION));
  if (typed !== undefined) return outcomeOf([check(false, expected, typed.message)], typed.note);
  const cancelled = await interact(EDIT_FORM(page).getByRole('button', { name: 'Cancelar', exact: true }), 'pulsar «Cancelar»', (element) => element.click(ACTION));
  if (cancelled !== undefined) return outcomeOf([check(false, expected, cancelled.message)], cancelled.note);
  const closed = await waitUntil(async () => !(await safe(() => EDIT_FORM(page).isVisible(), false)));
  const title = await storedTitle('REQ-002');
  return verdict([
    check(closed.reached, 'sale del formulario', closed.reached ? 'sale del formulario' : 'el formulario sigue abierto'),
    check(title === 'Latencia del subsistema 002', 'el título de REQ-002 sigue siendo «Latencia del subsistema 002»', `el título de REQ-002 es «${String(title)}»`),
  ]);
};

// --- Esquema 4: un rol sin permiso de edición no abre el formulario ----------------------------------------------------

const EDIT_STATE_OF: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado con la explicación «Tu rol no permite editar requisitos»', { enabled: false, reason: 'Tu rol no permite editar requisitos' }],
]);

/** Cuenta de la fila (gestor o auditor) con sus credenciales. */
const EDIT_ACCOUNT_OF: ReadonlyMap<string, typeof ACCOUNT_CREDENTIALS.gestor> = new Map([
  ['gestor@sigpro.test', ACCOUNT_CREDENTIALS.gestor],
  ['auditor@sigpro.test', ACCOUNT_CREDENTIALS.auditor],
]);

const editOnlyForEditors: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', EDIT_ACCOUNT_OF, cell(row, 'cuenta'));
  const want = strict('estado', EDIT_STATE_OF, cell(row, 'estado'));
  const expected = want.enabled ? '«Editar» está habilitado' : `«Editar» está deshabilitado con la explicación «${want.reason ?? ''}»`;
  const failure = await prepareMobile(page, credentials, expected);
  if (failure !== undefined) return failure;
  const opened = await openSheet('REQ-001')(page);
  if (opened !== undefined) return outcomeOf([check(false, expected, opened.message)], opened.note);
  return verdict([await mobileStateCheck(sheetButton(page, 'Editar'), want.enabled ? 'habilitado' : 'deshabilitado', want.reason)]);
};

defineBrowserRows({
  story: 'US-REQ-EDICION-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(savesAndCloses)],
    [2, onExpoWeb(noticeOnTextOnly)],
    [3, onExpoWeb(noChangesCancelOrReject)],
    [4, onExpoWeb(editOnlyForEditors)],
  ]),
});
