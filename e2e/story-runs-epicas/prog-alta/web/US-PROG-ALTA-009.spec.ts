import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, linesOf, safe, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  alertCheck,
  clickWizardButton,
  fieldValueCheck,
  fillField,
  interact,
  LOCAL_MS,
  onWeb,
  openWizard,
  signIn,
  stepCheck,
  wizardNameField,
  wizardOf,
  wizardOwnerField,
} from './common';

// US-PROG-ALTA-009 — Elegir el responsable con búsqueda en el asistente (web). Preparación de cada fila: reinicio de alumno01; gestor
// entra desde /login?tenant=alumno01, llega a /programs y abre «Nuevo programa» (paso 1). Tras el reinicio hay siete personas.

const ALL_PERSONS: readonly string[] = ['Marta Ruiz', 'Javier Ortega', 'Lucía Fernández', 'Andrés Molina', 'Carmen Vidal', 'Pablo Serrano', 'Alumno 01'];

/** Lista de personas del asistente (su id de prueba: la lista no tiene nombre accesible propio). */
const personList = (page: Page): Locator => wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_LIST);
const optionsOf = (page: Page): Locator => personList(page).getByRole('option');

/** ¿Están esas personas, y solo esas, en la lista? Cada una por su nombre accesible (el avatar es decorativo). */
const listedAsExpected = async (page: Page, expected: readonly string[]): Promise<boolean> => {
  const count = await safe(() => optionsOf(page).count(), -1);
  if (count !== expected.length) return false;
  for (const name of expected) {
    const found = await safe(() => personList(page).getByRole('option', { name, exact: true }).count(), 0);
    if (found !== 1) return false;
  }
  return true;
};

/** Un «Entonces» de la lista: exactamente esas personas, o «Sin coincidencias» sin ninguna persona. Espera con el techo local. */
const listCheck = async (page: Page, expected: readonly string[], noMatch: boolean): Promise<Check> => {
  const waited = await waitUntil(async () => listedAsExpected(page, expected), LOCAL_MS);
  const count = await safe(() => optionsOf(page).count(), -1);
  if (noMatch) {
    const text = await safe(() => personList(page).textContent(), undefined);
    const shownText = linesOf(text ?? undefined).join(' ');
    return check(waited.reached && count === 0 && shownText === 'Sin coincidencias', 'la lista muestra «Sin coincidencias»', `la lista muestra ${count} personas y el texto «${shownText}»`);
  }
  return check(waited.reached, `la lista muestra ${expected.join(', ')}`, `la lista muestra ${count} personas (no son ${expected.join(', ')})`);
};

// --- Esquema 1: escribir en el campo filtra las personas por su nombre --------------------------------------------------------

/** Texto de la tabla → (texto escrito, lista esperada). «(vacío)» deja el campo sin escribir (las siete). */
const FILTER_OF: ReadonlyMap<string, { readonly typed: string; readonly expected: readonly string[]; readonly noMatch: boolean }> = new Map([
  ['lucía', { typed: 'lucía', expected: ['Lucía Fernández'], noMatch: false }],
  ['PABLO', { typed: 'PABLO', expected: ['Pablo Serrano'], noMatch: false }],
  ['xyz', { typed: 'xyz', expected: [], noMatch: true }],
  ['(vacío)', { typed: '', expected: ALL_PERSONS, noMatch: false }],
]);

const filterRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filter = strict('texto', FILTER_OF, cell(row, 'texto'));
  const typed = await fillField(wizardOwnerField(page), filter.typed, 'Responsable');
  if (typed) return actionFailed(expected, typed);
  return conclude([await listCheck(page, filter.expected, filter.noMatch)]);
};

// --- Esquema 2: elegir una persona fija el responsable y cierra la lista ------------------------------------------------------

const pickRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `el campo «Responsable» muestra ${cell(row, 'persona')}, la lista se cierra y el asistente sigue en «Paso 1 de 3»`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const persona = cell(row, 'persona');
  const opening = await interact(wizardOwnerField(page), 'abrir «Responsable»', (element) => element.click(ACTION));
  if (opening) return actionFailed(expected, opening);
  const chosen = await interact(wizardOf(page).getByRole('option', { name: persona, exact: true }), `elegir «${persona}»`, (element) => element.click(ACTION));
  if (chosen) return actionFailed(expected, chosen);
  const closed = await waitUntil(async () => !(await isVisible(personList(page))), LOCAL_MS);
  return conclude([
    await fieldValueCheck(wizardOwnerField(page), persona, 'el campo «Responsable»'),
    check(closed.reached, 'la lista se cierra', 'la lista sigue abierta'),
    await stepCheck(page, 1, 'sigue en'),
  ]);
};

// --- Esquema 3: escribir sobre la persona elegida quita la elección -----------------------------------------------------------

const TYPED_OVER: ReadonlyMap<string, string> = new Map<string, string>([
  ['Pablo', 'Pablo'],
  ['x', 'x'],
]);

const overwriteRow: BrowserRowHandler = async (row, { page }) => {
  const expected = 'el campo ya no tiene responsable elegido y pulsar «Siguiente» muestra el aviso «Selecciona un responsable de la lista»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const first = await interact(wizardOwnerField(page), 'abrir «Responsable»', (element) => element.click(ACTION));
  if (first) return preparationFailedWeb(expected, first.message);
  const picked = await interact(wizardOf(page).getByRole('option', { name: 'Andrés Molina', exact: true }), 'elegir «Andrés Molina»', (element) => element.click(ACTION));
  if (picked) return preparationFailedWeb(expected, picked.message);
  if (!(await waitUntil(async () => await fieldValueIs(page, 'Andrés Molina'), LOCAL_MS)).reached) return preparationFailedWeb(expected, 'el campo no muestra «Andrés Molina» tras elegirlo');
  const typed = await fillField(wizardOwnerField(page), strict('texto', TYPED_OVER, cell(row, 'texto')), 'Responsable');
  if (typed) return actionFailed(expected, typed);
  const next = await clickWizardButton(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  return conclude([await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR), 'Selecciona un responsable de la lista', 'el aviso bajo «Responsable»')]);
};

/** ¿El campo «Responsable» muestra ese texto? (lectura fallida = no). */
const fieldValueIs = async (page: Page, text: string): Promise<boolean> => (await safe(() => wizardOwnerField(page).inputValue({ timeout: 500 }), undefined)) === text;

// --- Esquema 4: la tecla Esc cierra primero la lista de responsables y después el asistente -------------------------------

/** Situación de la tabla → si la lista del responsable está abierta (true) o cerrada (false) antes de pulsar Esc. */
const SITUATION_OPEN: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['con la lista abierta', true],
  ['con la lista cerrada', false],
]);

const escRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const listOpenBefore = strict('situacion', SITUATION_OPEN, cell(row, 'situacion'));
  // Abierta: el foco abre la lista del responsable. Cerrada: se abre y luego el foco pasa a «Nombre» (la lista se cierra sola).
  const focused = await interact(wizardOwnerField(page), 'enfocar «Responsable»', (element) => element.click(ACTION));
  if (focused) return preparationFailedWeb(expected, focused.message);
  if (!listOpenBefore) {
    const moved = await interact(wizardNameField(page), 'pasar el foco a «Nombre»', (element) => element.click(ACTION));
    if (moved) return preparationFailedWeb(expected, moved.message);
  }
  const listOpen = await waitUntil(async () => (await isVisible(personList(page))) === listOpenBefore, LOCAL_MS);
  if (!listOpen.reached) return preparationFailedWeb(expected, `la lista no está ${listOpenBefore ? 'abierta' : 'cerrada'} antes de pulsar Esc`);
  const pressed = await interact(wizardOf(page), 'pulsar la tecla Esc', () => page.keyboard.press('Escape'));
  if (pressed) return actionFailed(expected, pressed);
  if (listOpenBefore) {
    const listClosed = await waitUntil(async () => !(await isVisible(personList(page))), LOCAL_MS);
    return conclude([
      check(listClosed.reached, 'la lista se cierra', 'la lista sigue abierta'),
      check(await isVisible(wizardOf(page)), 'el asistente sigue abierto en «Paso 1 de 3»', 'el asistente se cierra'),
      await stepCheck(page, 1, 'sigue en'),
    ]);
  }
  const wizardClosed = await waitUntil(async () => !(await isVisible(wizardOf(page))), LOCAL_MS);
  return conclude([check(wizardClosed.reached, 'el asistente se cierra', 'el asistente sigue abierto')]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(filterRow)],
    [2, onWeb(pickRow)],
    [3, onWeb(overwriteRow)],
    [4, onWeb(escRow)],
  ]),
});
