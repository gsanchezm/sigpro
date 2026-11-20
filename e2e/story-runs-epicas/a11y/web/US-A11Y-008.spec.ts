import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, safe } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { ALUMNO_ADMIN, COOKIE_NOTE, NETWORK_MS, countVisible, describeCount, focusCheck, prepFailed, programRow, quietCookies, resetAlumno, runStepsLogged, settle, signInToPrograms, withRoutesReleased } from './common';
import { adminToken, call, field } from '../../../story-runs/support/api';

// US-A11Y-008 — Diálogos: el foco entra, no sale y vuelve al control que lo abrió (web de 1440 px).
// Preparación de cada fila: reinicio de alumno01 y sesión desde el formulario de acceso. Un diálogo se localiza por su título y el
// foco se lee de lo que tiene (`:focus`); los disparadores se pulsan como una persona.

const NC_TITLE = 'Nueva no conformidad';
const NC_TRIGGER = 'Nueva no conformidad';
const NC_SUBMIT = 'Abrir no conformidad';
const NC_CANCEL = 'Cancelar';
const DELETE_TITLE = 'Eliminar programa';
const NC_COUNT = 12;

const ACCOUNTS: ReadonlyMap<string, { readonly email: string; readonly password: string }> = new Map<string, { readonly email: string; readonly password: string }>([
  [DEMO.gestor.email, DEMO.gestor],
  [ALUMNO_ADMIN.email, ALUMNO_ADMIN],
]);
const PASSWORDS: ReadonlyMap<string, string> = new Map([
  [DEMO.gestor.password, DEMO.gestor.password],
  [ALUMNO_ADMIN.password, ALUMNO_ADMIN.password],
]);

const newNcDialog = (page: Page): Locator => page.getByRole('dialog', { name: NC_TITLE, exact: true });
const ncTrigger = (page: Page): Locator => page.getByRole('button', { name: NC_TRIGGER, exact: true });
const ncCards = (page: Page): Locator => page.getByRole('button', { name: /^Abrir NC-\d{3}$/ });
/** Barra de acciones masivas de la lista de programas: su «Eliminar» no es el de la fila. */
const bulkDelete = (page: Page): Locator => page.getByRole('toolbar', { name: 'Acciones masivas', exact: true }).getByRole('button', { name: 'Eliminar', exact: true });

/** Disparadores de la fila «Al abrirse», por el texto de la celda. */
const TRIGGERS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Nueva no conformidad»', (page) => ncTrigger(page)],
  ['«Eliminar» de la barra de acciones masivas', (page) => bulkDelete(page)],
]);

/** Tipo de pantalla de la fila «Al abrirse» (la de programas lleva la selección de PRG-001 hecha por la prueba). */
const SCREEN_KIND: ReadonlyMap<string, 'nc' | 'programs'> = new Map<string, 'nc' | 'programs'>([
  ['/nc', 'nc'],
  ['/programs con PRG-001 seleccionado', 'programs'],
]);

/** Control que debe tener el foco al abrirse el diálogo. */
const FOCUS_TARGET: ReadonlyMap<string, 'programa' | 'boton'> = new Map<string, 'programa' | 'boton'>([
  ['el campo «Programa»', 'programa'],
  ['un botón del diálogo', 'boton'],
]);

/** Control de partida de la fila del Tab (el campo «Programa» o el botón «Abrir no conformidad»). */
const FROM: ReadonlyMap<string, 'programa' | 'submit'> = new Map<string, 'programa' | 'submit'>([
  ['el campo «Programa»', 'programa'],
  ['«Abrir no conformidad»', 'submit'],
]);

/** Control que debe tener el foco tras pulsar la tecla. */
const LANDS_ON: ReadonlyMap<string, 'programa' | 'submit'> = new Map<string, 'programa' | 'submit'>([
  ['el campo «Programa»', 'programa'],
  ['el botón «Abrir no conformidad»', 'submit'],
]);

/**
 * Códigos de las no conformidades que devuelve la API (`GET /api/nc`, `items[].code`), ordenados. Es el oráculo del conjunto: no se
 * cuentan tarjetas de la interfaz. `undefined` si la respuesta no es una lista (fallo del arnés o de la petición).
 */
const apiNcCodes = async (): Promise<string[] | undefined> => {
  const result = await call('GET', '/nc', { tenant: TENANT_A, token: await adminToken(TENANT_A) });
  const items = field(result.body, 'items');
  if (result.status !== 200 || !Array.isArray(items)) return undefined;
  return (items as readonly unknown[]).map((item) => String(field(item, 'code'))).sort();
};

const sameList = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((code, index) => code === b[index]);

const KEYS: ReadonlyMap<string, string> = new Map([
  ['Tab', 'Tab'],
  ['Mayús con Tab', 'Shift+Tab'],
]);

const CLOSERS: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['Esc', (page) => page.keyboard.press('Escape')],
  ['«Cancelar»', (page) => newNcDialog(page).getByRole('button', { name: NC_CANCEL, exact: true }).click(ACTION)],
]);

/**
 * El foco inicial de la confirmación de borrado es el botón que el propio diálogo indica (DeleteDialog.tsx:27, `initialFocus`:
 * «Eliminar»), dentro del diálogo. No vale cualquier botón.
 */
const focusOnDialogButton = async (page: Page, dialog: Locator): Promise<Check> => {
  const inside = await settle(
    () => safe(() => dialog.evaluate((element) => element.contains(document.activeElement), undefined, { timeout: 1_000 }), false),
    (value) => value === true,
    2_000,
  );
  const focus = await focusCheck(page, 'Eliminar', 'button');
  return check(inside.ok && focus.ok, 'el foco inicial está en el botón «Eliminar» del diálogo', inside.ok ? focus.observed : `${focus.observed} (fuera del diálogo)`);
};

// --- Esquema 1: al abrirse, el foco entra en el diálogo ------------------------------------------------------------------------

const openDialogs: BrowserRowHandler = async (row, { page, context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const screen = strict('pantalla', SCREEN_KIND, cell(row, 'pantalla'));
  const titulo = cell(row, 'titulo');
  const controlInicial = cell(row, 'control_inicial');
  const focusTarget = strict('control_inicial', FOCUS_TARGET, controlInicial);
  const expected = `se abre el diálogo «${titulo}» y el foco está en ${controlInicial}`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, account.email, password);
  if (signed) return prepFailed(expected, signed);
  if (screen === 'nc') {
    const ready = await runStepsLogged([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })], ['ver el tablero', () => ncCards(page).first().waitFor({ timeout: CEILING_MS })]]);
    if (ready) return prepFailed(expected, ready);
  } else {
    // «/programs con PRG-001 seleccionado»: la casilla de la fila se marca como una persona
    const selected = await runStepsLogged([['marcar la casilla «Seleccionar PRG-001»', () => programRow(page, 'PRG-001').getByRole('checkbox').check(ACTION)]]);
    if (selected) return prepFailed(expected, selected);
  }
  const trigger = strict('disparador', TRIGGERS, cell(row, 'disparador'));
  const pressed = await runStepsLogged([['pulsar el disparador', () => trigger(page).click(ACTION)]]);
  if (pressed) return prepFailed(expected, pressed);
  const dialog = page.getByRole('dialog', { name: titulo, exact: true }).or(page.getByRole('alertdialog', { name: titulo, exact: true }));
  const opened = await settle(() => countVisible(dialog), (count) => count === 1, 2_000);
  const focus = focusTarget === 'programa' ? await focusCheck(page, 'Programa', 'combobox') : await focusOnDialogButton(page, dialog);
  return conclude([check(opened.ok, `se abre el diálogo «${titulo}»`, opened.ok ? `se abre el diálogo «${titulo}»` : `no se abre un diálogo «${titulo}» (${describeCount(opened.value)})`), focus], {
    note: COOKIE_NOTE,
  });
};

// --- Esquema 2: Tab no sale del diálogo y da la vuelta entre sus controles ------------------------------------------------------

const trapped: BrowserRowHandler = async (row, { page, context }) => {
  const desde = cell(row, 'desde');
  const tecla = cell(row, 'tecla');
  const fromKind = strict('desde', FROM, desde);
  const landing = strict('control', LANDS_ON, cell(row, 'control'));
  const expected = `desde ${desde}, al pulsar ${tecla} el foco está en ${cell(row, 'control')} y ningún control de fondo tiene el foco`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const ready = await runStepsLogged([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })], ['ver el tablero', () => ncCards(page).first().waitFor({ timeout: CEILING_MS })]]);
  if (ready) return prepFailed(expected, ready);
  const opened = await runStepsLogged([['pulsar «Nueva no conformidad»', () => ncTrigger(page).click(ACTION)]]);
  if (opened) return prepFailed(expected, opened);
  const dialog = newNcDialog(page);
  const from = fromKind === 'submit' ? dialog.getByRole('button', { name: NC_SUBMIT, exact: true }) : dialog.getByRole('combobox', { name: 'Programa', exact: true });
  const placed = await runStepsLogged([[`dar el foco a ${desde}`, () => from.focus({ timeout: CEILING_MS })]]);
  if (placed) return prepFailed(expected, placed);
  const key = strict('tecla', KEYS, tecla);
  const pressed = await runStepsLogged([[`pulsar ${tecla}`, () => page.keyboard.press(key)]]);
  if (pressed) return prepFailed(expected, pressed);
  const focus = landing === 'programa' ? await focusCheck(page, 'Programa', 'combobox') : await focusCheck(page, NC_SUBMIT, 'button');
  const inside = await settle(
    () => safe(() => dialog.evaluate((element) => element.contains(document.activeElement), undefined, { timeout: 1_000 }), false),
    (value) => value === true,
    2_000,
  );
  return conclude([focus, check(inside.ok, 'ningún control de la página de fondo tiene el foco', inside.ok ? 'el foco está dentro del diálogo' : 'el foco ha salido del diálogo')], {
    note: COOKIE_NOTE,
  });
};

// --- Esquema 3: Esc y «Cancelar» cierran el diálogo sin crear nada y devuelven el foco al disparador -----------------------

const closeWithoutCreating: BrowserRowHandler = async (row, { page, context }) => {
  const accion = cell(row, 'accion');
  const closer = strict('accion', CLOSERS, accion);
  const expected = `${accion} cierra el diálogo, el foco vuelve a «${NC_TRIGGER}» y siguen existiendo ${NC_COUNT} no conformidades`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const ready = await runStepsLogged([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })], ['ver el tablero', () => ncCards(page).first().waitFor({ timeout: CEILING_MS })]]);
  if (ready) return prepFailed(expected, ready);
  const idsBefore = await apiNcCodes();
  if (idsBefore === undefined) return notExecutable(expected, 'GET /api/nc no devolvió una lista de no conformidades (error del arnés, con la evidencia).');
  if (idsBefore.length !== NC_COUNT) return prepFailed(expected, `antes de abrir el diálogo la API lista ${idsBefore.length} no conformidades, no ${NC_COUNT}`);
  const opened = await runStepsLogged([['pulsar «Nueva no conformidad»', () => ncTrigger(page).click(ACTION)]]);
  if (opened) return prepFailed(expected, opened);
  const dialogOpen = await settle(() => countVisible(newNcDialog(page)), (count) => count === 1, 2_000);
  if (!dialogOpen.ok) return prepFailed(expected, 'el diálogo «Nueva no conformidad» no se abre');
  const closed = await runStepsLogged([[`pulsar ${accion}`, () => closer(page)]]);
  if (closed) return prepFailed(expected, closed);
  const gone = await settle(() => countVisible(newNcDialog(page)), (count) => count === 0, 2_000);
  const focus = await focusCheck(page, NC_TRIGGER, 'button');
  const idsAfter = await settle(() => apiNcCodes(), (codes) => codes !== undefined && codes.length === NC_COUNT, NETWORK_MS);
  const sameCards = idsAfter.value !== undefined && sameList(idsAfter.value, idsBefore);
  return conclude(
    [
      check(gone.ok, 'el diálogo se cierra', gone.ok ? 'el diálogo se cierra' : `el diálogo sigue abierto (${describeCount(gone.value)})`),
      focus,
      check(
        sameCards,
        `siguen existiendo las ${NC_COUNT} no conformidades (mismos códigos según la API, ninguna nueva)`,
        idsAfter.value === undefined ? 'GET /api/nc no devolvió lista tras cerrar el diálogo' : `la API lista ${idsAfter.value.length}: ${idsAfter.value.join(', ')}`,
      ),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 4: la confirmación de borrado se anuncia como confirmación con su título y su texto ------------------------------

const deleteConfirmation: BrowserRowHandler = async (row, { page, context }) => {
  const codigo = cell(row, 'codigo');
  const text = `${codigo} se eliminará de forma permanente junto con sus requisitos y documentos.`;
  const expected = `el diálogo «${DELETE_TITLE}» con el texto «${text}» y los botones «Cancelar» y «Eliminar»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, ALUMNO_ADMIN.email, ALUMNO_ADMIN.password);
  if (signed) return prepFailed(expected, signed);
  const selected = await runStepsLogged([[`marcar la casilla «Seleccionar ${codigo}»`, () => programRow(page, codigo).getByRole('checkbox').check(ACTION)]]);
  if (selected) return prepFailed(expected, selected);
  const deleted = await runStepsLogged([['pulsar «Eliminar» de la barra de acciones masivas', () => bulkDelete(page).click(ACTION)]]);
  if (deleted) return prepFailed(expected, deleted);
  const dialog = page.getByRole('alertdialog', { name: DELETE_TITLE, exact: true });
  const shown = await settle(() => countVisible(dialog), (count) => count === 1, 2_000);
  const body = await settle(() => countVisible(dialog.getByText(text, { exact: true })), (count) => count === 1, 2_000);
  const cancel = await countVisible(dialog.getByRole('button', { name: 'Cancelar', exact: true }));
  const confirm = await countVisible(dialog.getByRole('button', { name: 'Eliminar', exact: true }));
  return conclude(
    [
      check(shown.ok, `el lector anuncia el diálogo como confirmación «${DELETE_TITLE}»`, shown.ok ? `el diálogo es una confirmación llamada «${DELETE_TITLE}»` : `no hay una confirmación «${DELETE_TITLE}» (${describeCount(shown.value)})`),
      check(body.ok, `su texto dice «${text}»`, body.ok ? `su texto dice «${text}»` : `no aparece ese texto en el diálogo (${describeCount(body.value)})`),
      check(cancel === 1 && confirm === 1, 'sus botones son «Cancelar» y «Eliminar»', `botones: «Cancelar» (${describeCount(cancel)}) y «Eliminar» (${describeCount(confirm)})`),
    ],
    {
      note: `${COOKIE_NOTE} La confirmación se localiza como role alertdialog (DeleteDialog.tsx:22). Reglas sin fila (no evaluadas): el foco vuelve al control que abrió este diálogo tras cerrarlo; no se mide porque ninguna fila cierra la confirmación.`,
    },
  );
};

defineBrowserRows({
  story: 'US-A11Y-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(openDialogs)],
    [2, withRoutesReleased(trapped)],
    [3, withRoutesReleased(closeWithoutCreating)],
    [4, withRoutesReleased(deleteConfirmation)],
  ]),
});
