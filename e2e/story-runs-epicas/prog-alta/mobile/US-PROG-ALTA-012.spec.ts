import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, textOf, waitUntil } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, alertCheck, fieldValueCheck, interact, LOCAL_MS, NET_MS, noNewProgramChecks, textCheck, visibleCheck, waitForOkToast, type Blocked } from '../web/common';
import {
  disabledReason,
  newProgramButton,
  newProgramReason,
  onExpoWeb,
  ownerField,
  ownerOption,
  ownerSearch,
  ownerSheet,
  signIn,
  wizardButton,
  wizardField,
  wizardOf,
  wizardReason,
  wizardStepText,
} from './common';

// US-PROG-ALTA-012 — Crear un programa con el asistente en una hoja (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio de
// alumno01 (el envoltorio de la fila); en la app, sin sesión guardada, con alumno01 en «Tenant de trabajo», la cuenta de la fila entra y
// llega a /programs. El cuerpo base de los ejemplos es nombre Programa de prueba alfa, responsable Javier Ortega, fechas 2027-03-01 a
// 2027-03-02, presupuesto 900000 y prioridad Alta.

const BASE_NAME = 'Programa de prueba alfa';
const BASE_OWNER = 'Javier Ortega';
const DUPLICATE_TEXT = 'Ya existe un programa con ese nombre';
const NO_ROLE = 'Tu rol no permite crear programas';
const FIRST_STEP_REASON = 'Estás en el primer paso';

// --- Mapas de las celdas de la tabla (lo que no conocen LANZA) -----------------------------------------------------------------

/** Cuenta de la fila: credenciales y si su rol puede abrir el asistente (gestor sí, consultor no). */
const ACCOUNT_OF: ReadonlyMap<string, { readonly credentials: Credentials; readonly canCreate: boolean }> = new Map([
  ['gestor@sigpro.test', { credentials: DEMO.gestor, canCreate: true }],
  ['consultor@sigpro.test', { credentials: DEMO.consultor, canCreate: false }],
]);

/** Responsable de la fila: la persona a elegir, o `undefined` si no se elige ninguna. */
const OWNER_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['Javier Ortega', 'Javier Ortega'],
  ['(ninguno)', undefined],
]);

/** Fecha de la fila («(vacío)» deja el campo sin escribir). */
const DATE_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2027-03-01', '2027-03-01'],
  ['2027-03-02', '2027-03-02'],
]);

/** Presupuesto de la fila («(vacío)» deja el campo sin escribir). */
const BUDGET_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['900000', '900000'],
  ['0', '0'],
  ['1', '1'],
]);

/** Paso del que parte «Atrás» (Esquema 4). */
const BACK_FROM: ReadonlyMap<string, 1 | 2> = new Map<string, 1 | 2>([
  ['1', 1],
  ['2', 2],
]);

/** Búsqueda de responsable (Esquema 5): cuántas personas deben quedar en la hoja. */
const SEARCH_OF: ReadonlyMap<string, { readonly text: string; readonly matches: 'one' | 'none' }> = new Map<string, { readonly text: string; readonly matches: 'one' | 'none' }>([
  ['lucía', { text: 'lucía', matches: 'one' }],
  ['xyz', { text: 'xyz', matches: 'none' }],
]);

/** Nombre del Esquema 6 → qué se espera al crear: el alta o el aviso de nombre repetido. */
const CREATE_OF: ReadonlyMap<string, 'created' | 'duplicate'> = new Map<string, 'created' | 'duplicate'>([
  [BASE_NAME, 'created'],
  ['Sistema de mando táctico Ártemis', 'duplicate'],
]);

/** Resultado del Esquema 2 → qué aviso (o el paso siguiente) se espera. */
const STEP_ONE_RESULT: ReadonlyMap<string, 'nameError' | 'ownerError' | 'step2'> = new Map<string, 'nameError' | 'ownerError' | 'step2'>([
  ['ve el aviso «El nombre debe tener al menos 3 caracteres» y sigue en «Paso 1 de 3»', 'nameError'],
  ['ve el aviso «Selecciona un responsable de la lista» y sigue en «Paso 1 de 3»', 'ownerError'],
  ['pasa a «Paso 2 de 3»', 'step2'],
]);

/** Resultado del Esquema 3 → el aviso bajo el campo de paso 2 (testid, texto, nombre), o el paso 3. */
const PLAN_RESULT: ReadonlyMap<string, readonly [testid: string, text: string, what: string] | 'step3'> = new Map<string, readonly [string, string, string] | 'step3'>([
  ['ve el aviso «La fecha de inicio es obligatoria» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START_ERROR, 'La fecha de inicio es obligatoria', 'el aviso bajo «Fecha de inicio»']],
  ['ve el aviso «La fecha de fin debe ser posterior al inicio» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END_ERROR, 'La fecha de fin debe ser posterior al inicio', 'el aviso bajo «Fecha de fin»']],
  ['ve el aviso «El presupuesto debe ser mayor que 0» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET_ERROR, 'El presupuesto debe ser mayor que 0', 'el aviso bajo «Presupuesto (€)»']],
  ['pasa a «Paso 3 de 3»', 'step3'],
]);

// --- Pasos del asistente -------------------------------------------------------------------------------------------------------

/** Espera (con el techo local) a que el asistente muestre el paso indicado. */
const mobileStep = async (page: Page, step: number, verb: 'sigue en' | 'pasa a' | 'vuelve a'): Promise<Check> => {
  const expected = `Paso ${step} de 3`;
  const reached = await waitUntil(async () => (await wizardStepText(page)) === expected, LOCAL_MS);
  const observed = await wizardStepText(page);
  return check(reached.reached, `${verb} «${expected}»`, `la hoja muestra «${observed ?? '(sin leer)'}»`);
};

/** Abre la hoja «Nuevo programa» desde la lista y espera a su primer paso. */
const openSheet = async (page: Page): Promise<Blocked | undefined> => {
  const clicked = await interact(newProgramButton(page), 'pulsar «Nuevo programa»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  await waitUntil(() => isVisible(wizardOf(page)), NET_MS);
  return undefined;
};

/** Escribe el nombre y, si se da, elige el responsable (abre su hoja y toca a la persona). */
const fillStep1 = async (page: Page, name: string | undefined, owner: string | undefined): Promise<Blocked | undefined> => {
  if (name !== undefined) {
    const typed = await interact(wizardField(page, 'Nombre'), `escribir «${name}» en «Nombre»`, (element) => element.fill(name, ACTION));
    if (typed !== undefined) return typed;
  }
  if (owner === undefined) return undefined;
  const opened = await interact(wizardOf(page).getByRole('combobox', { name: 'Responsable', exact: true }), 'abrir «Responsable»', (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return interact(ownerOption(page, owner), `elegir «${owner}»`, (element) => element.click(ACTION));
};

/** Escribe el paso 2 (fechas, presupuesto y prioridad opcional). `undefined` = no tocar ese campo. */
const fillStep2 = async (page: Page, start: string | undefined, end: string | undefined, budget: string | undefined, priority?: string): Promise<Blocked | undefined> => {
  const fields: readonly (readonly [string, string | undefined])[] = [
    ['Fecha de inicio', start],
    ['Fecha de fin', end],
    ['Presupuesto (€)', budget],
  ];
  for (const [label, text] of fields) {
    if (text === undefined) continue;
    const typed = await interact(wizardField(page, label), `escribir «${text}» en «${label}»`, (element) => element.fill(text, ACTION));
    if (typed !== undefined) return typed;
  }
  if (priority === undefined) return undefined;
  return interact(wizardOf(page).getByRole('radio', { name: priority, exact: true }), `elegir la prioridad «${priority}»`, (element) => element.click(ACTION));
};

/** Pulsa un botón del asistente por su nombre. */
const pressWizard = (page: Page, name: string): Promise<Blocked | undefined> => interact(wizardButton(page, name), `pulsar «${name}»`, (element) => element.click(ACTION));

/** Deja la hoja en el paso 2 con el nombre y el responsable del cuerpo base. */
const reachStep2 = async (page: Page): Promise<Blocked | undefined> => {
  const filled = await fillStep1(page, BASE_NAME, BASE_OWNER);
  if (filled !== undefined) return filled;
  const next = await pressWizard(page, 'Siguiente');
  if (next !== undefined) return next;
  return (await waitUntil(async () => (await wizardStepText(page)) === 'Paso 2 de 3', NET_MS)).reached ? undefined : { present: true, message: 'la hoja no llegó a «Paso 2 de 3»', note: 'la hoja no avanzó' };
};

/** Deja la hoja en el paso 3 con el cuerpo base completo (prioridad Alta y sin clasificar) y el nombre indicado. */
const reachStep3 = async (page: Page, name: string): Promise<Blocked | undefined> => {
  const first = await fillStep1(page, name, BASE_OWNER);
  if (first !== undefined) return first;
  const next = await pressWizard(page, 'Siguiente');
  if (next !== undefined) return next;
  const second = await fillStep2(page, '2027-03-01', '2027-03-02', '900000', 'Alta');
  if (second !== undefined) return second;
  const last = await pressWizard(page, 'Siguiente');
  if (last !== undefined) return last;
  return (await waitUntil(async () => (await wizardStepText(page)) === 'Paso 3 de 3', NET_MS)).reached ? undefined : { present: true, message: 'la hoja no llegó a «Paso 3 de 3»', note: 'la hoja no avanzó' };
};

// --- Esquema 1: solo los roles que gestionan programas pueden abrir el asistente -------------------------------------------

const onlyManagers: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const signed = await signIn(page, account.credentials);
  if (signed) return preparationFailedWeb(expected, signed);
  if (!account.canCreate) {
    return conclude([
      await disabledReason(newProgramButton(page), NO_ROLE, 'Nuevo programa'),
      await visibleCheck(newProgramReason(page), `el texto «${NO_ROLE}» debajo`),
      textCheck(await textOf(newProgramReason(page)), NO_ROLE, 'el motivo visible'),
    ]);
  }
  const opened = await openSheet(page);
  if (opened) return actionFailed(expected, opened);
  return conclude([await visibleCheck(wizardOf(page), 'la hoja «Nuevo programa»'), await mobileStep(page, 1, 'sigue en')]);
};

// --- Esquema 2: el paso 1 pide un nombre de al menos tres caracteres y un responsable -----------------------------------

const stepOneRule: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openSheet(page);
  if (opened) return preparationFailedWeb(expected, opened.message);
  const filled = await fillStep1(page, cell(row, 'nombre'), strict('responsable', OWNER_OF, cell(row, 'responsable')));
  if (filled) return actionFailed(expected, filled);
  const next = await pressWizard(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  const result = strict('resultado', STEP_ONE_RESULT, expected);
  if (result === 'step2') return conclude([await mobileStep(page, 2, 'pasa a')]);
  const alert =
    result === 'nameError'
      ? await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR), 'El nombre debe tener al menos 3 caracteres', 'el aviso bajo «Nombre»')
      : await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR), 'Selecciona un responsable de la lista', 'el aviso del responsable');
  return conclude([alert, await mobileStep(page, 1, 'sigue en')]);
};

// --- Esquema 3: el paso 2 pide fechas coherentes y un presupuesto mayor que cero ------------------------------------------

const planRule: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openSheet(page);
  if (opened) return preparationFailedWeb(expected, opened.message);
  const reached = await reachStep2(page);
  if (reached) return preparationFailedWeb(expected, reached.message);
  const typed = await fillStep2(page, strict('inicio', DATE_OF, cell(row, 'inicio')), strict('fin', DATE_OF, cell(row, 'fin')), strict('presupuesto', BUDGET_OF, cell(row, 'presupuesto')));
  if (typed) return actionFailed(expected, typed);
  const next = await pressWizard(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  const result = strict('resultado', PLAN_RESULT, expected);
  if (result === 'step3') return conclude([await mobileStep(page, 3, 'pasa a')]);
  const [testid, text, what] = result;
  return conclude([await alertCheck(wizardOf(page).getByTestId(testid), text, what), await mobileStep(page, 2, 'sigue en')]);
};

// --- Esquema 4: «Atrás» depende del paso en el que está la hoja -------------------------------------------------------------

const backRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openSheet(page);
  if (opened) return preparationFailedWeb(expected, opened.message);
  const from = strict('paso', BACK_FROM, cell(row, 'paso'));
  if (from === 2) {
    const reached = await reachStep2(page);
    if (reached) return preparationFailedWeb(expected, reached.message);
  } else {
    const typed = await fillStep1(page, BASE_NAME, undefined);
    if (typed) return preparationFailedWeb(expected, typed.message);
  }
  if (from === 1) {
    return conclude([
      await mobileStep(page, 1, 'sigue en'),
      await disabledReason(wizardButton(page, 'Atrás'), FIRST_STEP_REASON, 'Atrás'),
      textCheck(await textOf(wizardReason(page, 'back')), FIRST_STEP_REASON, 'el texto visible debajo de «Atrás»'),
    ]);
  }
  const back = await pressWizard(page, 'Atrás');
  if (back) return actionFailed(expected, back);
  return conclude([await mobileStep(page, 1, 'vuelve a'), await fieldValueCheck(wizardField(page, 'Nombre'), BASE_NAME, 'el campo «Nombre»')]);
};

// --- Esquema 5: el buscador de responsables filtra la hoja -----------------------------------------------------------------

/** Personas de la hoja del responsable, por su nombre accesible. */
const optionsOf = (page: Page): Locator => ownerSheet(page).getByRole('radio');

const searchRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openSheet(page);
  if (opened) return preparationFailedWeb(expected, opened.message);
  const tapped = await interact(ownerField(page), 'tocar «Responsable»', (element) => element.click(ACTION));
  if (tapped) return preparationFailedWeb(expected, tapped.message);
  const search = strict('texto', SEARCH_OF, cell(row, 'texto'));
  const typed = await interact(ownerSearch(page), `escribir «${search.text}» en «Buscar responsable»`, (element) => element.fill(search.text, ACTION));
  if (typed) return actionFailed(expected, typed);
  if (search.matches === 'one') {
    const waited = await waitUntil(async () => (await optionsOf(page).count()) === 1 && (await ownerOption(page, 'Lucía Fernández').count()) === 1, LOCAL_MS);
    return conclude([check(waited.reached, 'solo Lucía Fernández', `la hoja muestra ${await optionsOf(page).count()} personas`)]);
  }
  const none = await waitUntil(async () => (await optionsOf(page).count()) === 0, LOCAL_MS);
  return conclude([
    check(none.reached, 'ninguna persona en la hoja', `la hoja muestra ${await optionsOf(page).count()} personas`),
    await visibleCheck(ownerSheet(page).getByText('Sin coincidencias', { exact: true }), 'el texto «Sin coincidencias»'),
  ]);
};

// --- Esquema 6: crear el programa con el nombre de la fila ------------------------------------------------------------------

const createRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openSheet(page);
  if (opened) return preparationFailedWeb(expected, opened.message);
  const kind = strict('nombre', CREATE_OF, cell(row, 'nombre'));
  const filled = await reachStep3(page, cell(row, 'nombre'));
  if (filled) return preparationFailedWeb(expected, filled.message);
  const submitted = await pressWizard(page, 'Crear programa');
  if (submitted) return actionFailed(expected, submitted);
  if (kind === 'created') {
    const toast = await waitForOkToast(page, 'Programa creado', 'PRG-025 se añadió a la lista', NET_MS);
    const closed = await waitUntil(async () => !(await isVisible(wizardOf(page))), NET_MS);
    return conclude([check(toast, 'aviso «Programa creado» con «PRG-025 se añadió a la lista»', 'no aparece ese aviso'), check(closed.reached, 'la hoja se cierra', 'la hoja sigue abierta')]);
  }
  return conclude([
    await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SERVER_ERROR), `422 · ${DUPLICATE_TEXT}`, 'el aviso de arriba', NET_MS),
    await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR), DUPLICATE_TEXT, 'el aviso bajo «Nombre»', NET_MS),
    await mobileStep(page, 1, 'vuelve a'),
    ...(await noNewProgramChecks()),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(onlyManagers)],
    [2, onExpoWeb(stepOneRule)],
    [3, onExpoWeb(planRule)],
    [4, onExpoWeb(backRow)],
    [5, onExpoWeb(searchRow)],
    [6, onExpoWeb(createRow)],
  ]),
});
