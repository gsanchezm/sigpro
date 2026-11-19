import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  actionFailed,
  alertCheck,
  BASE,
  clickWizardButton,
  completeStep1,
  disabledWithReason,
  fillField,
  fillStep1,
  fillStep2,
  newProgramButton,
  onWeb,
  openWizard,
  signIn,
  stayedInStep,
  stepCheck,
  textCheck,
  visibleCheck,
  waitForStep,
  wizardDescriptionField,
  wizardOf,
  wizardStepText,
  type Blocked,
} from './common';

// US-PROG-ALTA-007 — Abrir el asistente de alta y validar sus dos primeros pasos (web). Preparación de cada fila: reinicio de alumno01
// y, en un navegador sin sesión guardada, la cuenta de la fila entra desde /login?tenant=alumno01 y llega a /programs.

const DENIED_REASON = 'Tu rol no permite crear programas';
const NAME_SHORT = 'El nombre debe tener al menos 3 caracteres';
const OWNER_MISSING = 'Selecciona un responsable de la lista';

/** Cuentas de la tabla del Esquema 1 (las tres que cita la historia). */
const ACCOUNT_OF: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Resultado de la tabla del Esquema 1 → cómo se comprueba el botón «Nuevo programa» para esa cuenta. */
const RESULT_OF: ReadonlyMap<string, 'opens' | 'denied'> = new Map<string, 'opens' | 'denied'>([
  ['se abre el asistente «Nuevo programa» en «Paso 1 de 3»', 'opens'],
  ['«Nuevo programa» no se puede pulsar y su motivo es «Tu rol no permite crear programas»', 'denied'],
]);

/** Un fallo de acción en la preparación: la fila no llega al estado que la historia da por hecho. */
const prepFailed = (expected: string, failure: Blocked): Outcome => preparationFailedWeb(expected, failure.message);

// --- Esquema 1: solo los roles que gestionan programas abren el asistente --------------------------------------------------------

const onlyManagers: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const credentials = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const opened = await signIn(page, credentials);
  if (opened) return preparationFailedWeb(expected, opened);
  if (strict('resultado', RESULT_OF, expected) === 'denied') {
    return conclude([await disabledWithReason(newProgramButton(page), DENIED_REASON, 'Nuevo programa')]);
  }
  const clicked = await openWizard(page);
  if (clicked) return actionFailed(expected, clicked);
  const checks: Check[] = [await visibleCheck(wizardOf(page), 'el asistente «Nuevo programa»'), textCheck(await wizardStepText(page), 'Paso 1 de 3', 'el paso')];
  return conclude(checks);
};

// --- Esquema 2: el paso 1 pide un nombre de al menos tres caracteres y un responsable -------------------------------------------

const NAME_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['ab', 'ab'],
  ['abc', 'abc'],
]);

const OWNER_VALUE: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['Javier Ortega', 'Javier Ortega'],
  ['(ninguno)', undefined],
]);

/** Resultado del Esquema 2 → el aviso que se espera (nombre o responsable) o el paso 2. */
const NAME_STEP_RESULT: ReadonlyMap<string, 'nameError' | 'ownerError' | 'step2'> = new Map<string, 'nameError' | 'ownerError' | 'step2'>([
  ['ve el aviso «El nombre debe tener al menos 3 caracteres» bajo «Nombre» y sigue en «Paso 1 de 3»', 'nameError'],
  ['ve el aviso «Selecciona un responsable de la lista» bajo «Responsable» y sigue en «Paso 1 de 3»', 'ownerError'],
  ['pasa a «Paso 2 de 3»', 'step2'],
]);

/** Resultado del Esquema 3 → si avanza al paso 2, o si se queda en el paso 1 sin avanzar. */
const DESCRIPTION_RESULT: ReadonlyMap<string, 'step2' | 'stays'> = new Map<string, 'step2' | 'stays'>([
  ['pasa a «Paso 2 de 3»', 'step2'],
  ['sigue en «Paso 1 de 3» y no avanza', 'stays'],
]);

const stepOneRule: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return prepFailed(expected, openedWizard);
  const name = strict('nombre', NAME_VALUE, cell(row, 'nombre'));
  const owner = strict('responsable', OWNER_VALUE, cell(row, 'responsable'));
  const typed = await fillStep1(page, name, owner);
  if (typed) return actionFailed(expected, typed);
  const next = await clickWizardButton(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  const result = strict('resultado', NAME_STEP_RESULT, expected);
  if (result === 'step2') return conclude([await stepCheck(page, 2, 'pasa a')]);
  const alert =
    result === 'nameError'
      ? await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR), NAME_SHORT, 'el aviso bajo «Nombre»')
      : await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR), OWNER_MISSING, 'el aviso bajo «Responsable»');
  return conclude([alert, await stepCheck(page, 1, 'sigue en')]);
};

// --- Esquema 3: la descripción admite hasta 2000 caracteres para avanzar ---------------------------------------------------------

const DESCRIPTION_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(2000 caracteres)', 'a'.repeat(2000)],
  ['(2001 caracteres)', 'a'.repeat(2001)],
]);

const descriptionLimit: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return prepFailed(expected, openedWizard);
  const filled = await fillStep1(page, BASE.name, BASE.owner);
  if (filled) return actionFailed(expected, filled);
  const typed = await fillField(wizardDescriptionField(page), strict('descripción', DESCRIPTION_VALUE, cell(row, 'descripcion')), 'Descripción');
  if (typed) return actionFailed(expected, typed);
  const next = await clickWizardButton(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  // «No avanza» es que NO ocurra algo: se observa durante el tiempo de la prueba (2 s), no en un instante
  if (strict('resultado', DESCRIPTION_RESULT, expected) === 'step2') return conclude([await stepCheck(page, 2, 'pasa a')]);
  return conclude([await stayedInStep(page, 1)]);
};

// --- Esquema 4: el paso 2 pide fechas coherentes y un presupuesto mayor que cero -------------------------------------------------

const OPTIONAL_DATE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2027-03-01', '2027-03-01'],
  ['2027-03-02', '2027-03-02'],
]);

const BUDGET_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['900000', '900000'],
  ['0', '0'],
  ['1', '1'],
]);

/** Resultado de la tabla del Esquema 4 → aviso esperado (testid, texto, nombre del aviso) o el paso 3 para «pasa a». */
const PLAN_RESULT: ReadonlyMap<string, readonly [testid: string, text: string, what: string] | 'step3'> = new Map<string, readonly [string, string, string] | 'step3'>([
  ['ve el aviso «La fecha de inicio es obligatoria» bajo «Fecha de inicio» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_START_ERROR, 'La fecha de inicio es obligatoria', 'el aviso bajo «Fecha de inicio»']],
  ['ve el aviso «La fecha de fin debe ser posterior al inicio» bajo «Fecha de fin» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_END_ERROR, 'La fecha de fin debe ser posterior al inicio', 'el aviso bajo «Fecha de fin»']],
  ['ve el aviso «El presupuesto debe ser mayor que 0» bajo «Presupuesto (€)» y sigue en «Paso 2 de 3»', [PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_BUDGET_ERROR, 'El presupuesto debe ser mayor que 0', 'el aviso bajo «Presupuesto (€)»']],
  ['pasa a «Paso 3 de 3»', 'step3'],
]);

const planRule: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return prepFailed(expected, openedWizard);
  const first = await completeStep1(page);
  if (first) return prepFailed(expected, first);
  if (!(await waitForStep(page, 2))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 2 de 3»');
  const start = strict('inicio', OPTIONAL_DATE, cell(row, 'inicio'));
  const end = strict('fin', OPTIONAL_DATE, cell(row, 'fin'));
  const budget = strict('presupuesto', BUDGET_VALUE, cell(row, 'presupuesto'));
  const typed = await fillStep2(page, start, end, budget);
  if (typed) return actionFailed(expected, typed);
  const next = await clickWizardButton(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  const result = strict('resultado', PLAN_RESULT, expected);
  if (result === 'step3') return conclude([await stepCheck(page, 3, 'pasa a')]);
  const [testid, text, what] = result;
  return conclude([await alertCheck(wizardOf(page).getByTestId(testid), text, what), await stepCheck(page, 2, 'sigue en')]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(onlyManagers)],
    [2, onWeb(stepOneRule)],
    [3, onWeb(descriptionLimit)],
    [4, onWeb(planRule)],
  ]),
});
