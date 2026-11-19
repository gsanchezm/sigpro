import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { conclude } from './common';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACTION, isVisible, runSteps, waitUntil } from '../../support/browser';
import {
  actionFailed,
  alertCheck,
  BASE,
  clickWizardButton,
  completeStep1,
  completeToStep3,
  disabledWithReason,
  fieldValueCheck,
  fillStep1,
  fillStep2,
  firstListedCode,
  interact,
  LOCAL_MS,
  NET_MS,
  noNewProgramChecks,
  onWeb,
  openWizard,
  programStatus,
  signIn,
  stepCheck,
  summaryCheck,
  waitForOkToast,
  waitForStep,
  wizardButton,
  wizardBudgetField,
  wizardNameField,
  wizardNotifySwitch,
  wizardOf,
  wizardStartField,
  type Blocked,
} from './common';

// US-PROG-ALTA-008 — Revisar, crear o cancelar el alta desde el asistente (web). Preparación de cada fila: reinicio de alumno01, gestor
// entra desde /login?tenant=alumno01 y abre «Nuevo programa». Las filas que completan el asistente llevan el cuerpo base (prioridad Alta).
// Cuando una fila dice que no se crea nada, el oráculo es la API con el administrador del tenant, no la pantalla.

const STEP_OF: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
]);

/** Llena el asistente con el nombre que indica la fila y lo deja en «Paso 3 de 3» (cuerpo base, salvo el nombre). */
const completeWithName = async (page: Page, name: string): Promise<Blocked | undefined> => {
  const first = await fillStep1(page, name, BASE.owner);
  if (first !== undefined) return first;
  const next = await clickWizardButton(page, 'Siguiente');
  if (next !== undefined) return next;
  const second = await fillStep2(page, BASE.start, BASE.end, BASE.budget, 'Alta');
  if (second !== undefined) return second;
  return clickWizardButton(page, 'Siguiente');
};

// --- Esquema 1: Atrás vuelve un paso y conserva lo escrito ---------------------------------------------------------------------

const backRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const step = strict('paso', STEP_OF, cell(row, 'paso'));
  if (step >= 2) {
    const first = await completeStep1(page);
    if (first) return preparationFailedWeb(expected, first.message);
  }
  // En el paso 2 se escriben también fechas y presupuesto del cuerpo base (lo que da por hecho la fila) antes de retroceder
  if (step === 2) {
    const data = await fillStep2(page, BASE.start, BASE.end, BASE.budget, 'Alta');
    if (data) return preparationFailedWeb(expected, data.message);
  }
  if (step >= 3) {
    const second = await fillStep2(page, BASE.start, BASE.end, BASE.budget, 'Alta');
    if (second) return preparationFailedWeb(expected, second.message);
    const next = await clickWizardButton(page, 'Siguiente');
    if (next) return preparationFailedWeb(expected, next.message);
  }
  if (!(await waitForStep(page, step))) return preparationFailedWeb(expected, `el asistente no llegó a «Paso ${step} de 3»`);
  if (step === 1) return conclude([await disabledWithReason(wizardButton(page, 'Atrás'), 'Estás en el primer paso', 'Atrás')]);
  const back = await clickWizardButton(page, 'Atrás');
  if (back) return actionFailed(expected, back);
  if (step === 2) return conclude([await stepCheck(page, 1, 'vuelve a'), await fieldValueCheck(wizardNameField(page), BASE.name, 'el campo «Nombre»')]);
  return conclude([
    await stepCheck(page, 2, 'vuelve a'),
    await fieldValueCheck(wizardStartField(page), BASE.start, 'el campo «Fecha de inicio»'),
    await fieldValueCheck(wizardBudgetField(page), BASE.budget, 'el campo «Presupuesto (€)»'),
  ]);
};

// --- Esquema 2: cerrar el asistente no crea ningún programa --------------------------------------------------------------------

/** Salida de la tabla → la acción que la provoca (la tecla Esc se pulsa sobre el propio diálogo). */
const EXIT_OF: ReadonlyMap<string, (page: Page) => Promise<Blocked | undefined>> = new Map<string, (page: Page) => Promise<Blocked | undefined>>([
  ['«Cancelar»', (page) => clickWizardButton(page, 'Cancelar')],
  ['el botón «Cerrar» de la cabecera del asistente', (page) => interact(wizardOf(page).getByRole('button', { name: 'Cerrar', exact: true }), 'pulsar «Cerrar»', (element) => element.click(ACTION))],
  ['la tecla Esc', (page) => interact(wizardOf(page), 'pulsar la tecla Esc', () => page.keyboard.press('Escape'))],
]);

const closeRow: BrowserRowHandler = async (row, { page }) => {
  const expected = 'el asistente se cierra y no existe ningún programa PRG-025 en la lista';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filled = await completeToStep3(page);
  if (filled) return preparationFailedWeb(expected, filled.message);
  if (!(await waitForStep(page, 3))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 3 de 3»');
  const exit = strict('salida', EXIT_OF, cell(row, 'salida'));
  const failed = await exit(page);
  if (failed) return actionFailed(expected, failed);
  const closed = await waitUntil(async () => !(await isVisible(wizardOf(page))), LOCAL_MS);
  return conclude([check(closed.reached, 'el asistente se cierra', closed.reached ? 'el asistente se cierra' : 'el asistente sigue abierto'), ...(await noNewProgramChecks())]);
};

// --- Esquema 3: el resumen muestra los datos escritos --------------------------------------------------------------------------

/** Etiqueta de la tabla del Esquema 3 → la etiqueta del resumen (dt). */
const SUMMARY_LABEL: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Código»', 'Código'],
  ['«Fechas»', 'Fechas'],
  ['«Presupuesto»', 'Presupuesto'],
  ['«Prioridad»', 'Prioridad'],
]);

/** Aviso de la tabla del Esquema 6 → el texto del aviso del servidor. */
const NOTICE_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['«500 · Ha ocurrido un error inesperado»', '500 · Ha ocurrido un error inesperado'],
  ['«— · Ha ocurrido un error inesperado»', '— · Ha ocurrido un error inesperado'],
]);

const summaryRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `el resumen muestra ${cell(row, 'campo')} con el valor ${cell(row, 'valor')}`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filled = await completeToStep3(page);
  if (filled) return preparationFailedWeb(expected, filled.message);
  if (!(await waitForStep(page, 3))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 3 de 3»');
  const label = strict('campo', SUMMARY_LABEL, cell(row, 'campo'));
  return conclude([await summaryCheck(page, label, cell(row, 'valor'))]);
};

// --- Esquema 4: el interruptor de aviso no impide crear el programa -----------------------------------------------------------

/** Interruptor de la tabla → si el aviso empieza activado (true) o se apaga antes de crear (false). */
const SWITCH_ON: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['activado', true],
  ['desactivado', false],
]);

const switchRow: BrowserRowHandler = async (row, { page }) => {
  const expected = 'aparece el aviso «Programa creado» con el texto «PRG-025 se añadió a la lista» y el asistente se cierra';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filled = await completeToStep3(page);
  if (filled) return preparationFailedWeb(expected, filled.message);
  if (!(await waitForStep(page, 3))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 3 de 3»');
  const wanted = strict('interruptor', SWITCH_ON, cell(row, 'interruptor'));
  const notify = wizardNotifySwitch(page);
  if (!wanted) {
    const toggled = await interact(notify, 'desactivar «Notificar al equipo por correo»', (element) => element.click(ACTION));
    if (toggled) return actionFailed(expected, toggled);
  }
  const state = wanted ? 'true' : 'false';
  const stateCheck = await waitUntil(async () => (await notify.getAttribute('aria-checked', { timeout: 500 }).catch(() => undefined)) === state, LOCAL_MS);
  const created = await clickWizardButton(page, 'Crear programa');
  if (created) return actionFailed(expected, created);
  const toast = await waitForOkToast(page, 'Programa creado', 'PRG-025 se añadió a la lista', NET_MS);
  const closed = await waitUntil(async () => !(await isVisible(wizardOf(page))), LOCAL_MS);
  const stored = await programStatus('PRG-025');
  // Regla de la historia: la lista muestra el nuevo programa en la primera fila (orden por código, de mayor a menor)
  const firstRow = await waitUntil(async () => (await firstListedCode(page)) === 'PRG-025', NET_MS);
  const firstCode = await firstListedCode(page);
  const interruptor = cell(row, 'interruptor');
  return conclude([
    check(stateCheck.reached, `«Notificar al equipo por correo» ${interruptor}`, stateCheck.reached ? `«Notificar al equipo por correo» está ${interruptor}` : `«Notificar al equipo por correo» no está ${interruptor}`),
    check(toast, 'aviso «Programa creado» con «PRG-025 se añadió a la lista»', toast ? 'aviso «Programa creado» con «PRG-025 se añadió a la lista»' : 'no aparece el aviso «Programa creado» con ese texto'),
    check(closed.reached, 'el asistente se cierra', closed.reached ? 'el asistente se cierra' : 'el asistente sigue abierto'),
    check(stored === 200, 'PRG-025 queda creado en el tenant', `PRG-025 responde ${stored} tras el alta`),
    check(firstRow.reached, 'la lista muestra PRG-025 en la primera fila', `la primera fila de la lista es ${firstCode ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 5: un nombre repetido vuelve al paso 1 con el aviso del servidor -------------------------------------------------

const DUPLICATE_TEXT = 'Ya existe un programa con ese nombre';

/** Nombres de la tabla del Esquema 5: cada uno tal cual va al asistente. */
const DUPLICATE_NAME_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['Sistema de mando táctico Ártemis', 'Sistema de mando táctico Ártemis'],
  ['sistema de MANDO táctico ártemis', 'sistema de MANDO táctico ártemis'],
  ['Programa DUPLICADO de prueba', 'Programa DUPLICADO de prueba'],
]);

const duplicateRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `el asistente vuelve a «Paso 1 de 3» con el aviso «422 · ${DUPLICATE_TEXT}» arriba y bajo «Nombre», y no se crea ningún programa`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filled = await completeWithName(page, strict('nombre', DUPLICATE_NAME_OF, cell(row, 'nombre')));
  if (filled) return preparationFailedWeb(expected, filled.message);
  if (!(await waitForStep(page, 3))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 3 de 3»');
  const submitted = await clickWizardButton(page, 'Crear programa');
  if (submitted) return actionFailed(expected, submitted);
  return conclude([
    await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SERVER_ERROR), `422 · ${DUPLICATE_TEXT}`, 'el aviso de arriba', NET_MS),
    await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_NAME_ERROR), DUPLICATE_TEXT, 'el aviso bajo «Nombre»', NET_MS),
    await stepCheck(page, 1, 'vuelve a'),
    ...(await noNewProgramChecks()),
  ]);
};

// --- Esquema 6: otro error del servidor se queda en el paso 3 -----------------------------------------------------------------

/** Respuesta de la tabla → cómo se provoca el fallo de POST /api/programs (lo demás pasa a la red sin tocar). */
const FAILURE_OF: ReadonlyMap<string, 'status500' | 'noResponse'> = new Map<string, 'status500' | 'noResponse'>([
  ['500', 'status500'],
  ['sin respuesta', 'noResponse'],
]);

/** Responde 500 (o no responde) a POST /api/programs solo; GET y el resto siguen a la red. Lleva cabeceras CORS. */
const failCreate = (page: Page, mode: 'status500' | 'noResponse'): Promise<unknown> =>
  page.route(
    (url) => url.pathname === '/api/programs',
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      if (mode === 'noResponse') return route.abort();
      const origin = request.headers().origin ?? '*';
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization,content-type', 'access-control-expose-headers': '*' },
        body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'Error provocado por la prueba' }),
      });
    },
  );

const serverErrorRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `sigue en «Paso 3 de 3» con el aviso ${cell(row, 'aviso')} y no se crea ningún programa`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filled = await completeToStep3(page);
  if (filled) return preparationFailedWeb(expected, filled.message);
  if (!(await waitForStep(page, 3))) return preparationFailedWeb(expected, 'el asistente no llegó a «Paso 3 de 3»');
  const failure = strict('respuesta', FAILURE_OF, cell(row, 'respuesta'));
  const routed = await runSteps([['provocar la respuesta de POST /api/programs', () => failCreate(page, failure)]]);
  if (routed) return preparationFailedWeb(expected, routed);
  const submitted = await clickWizardButton(page, 'Crear programa');
  if (submitted) return actionFailed(expected, submitted);
  const notice = strict('aviso', NOTICE_OF, cell(row, 'aviso'));
  // «No se crea ningún programa» NO se comprueba: la prueba intercepta POST /api/programs sin reenviarla, así que el servidor nunca
  // recibe el alta y una comprobación del tenant sería vacua. Se anota aquí en lugar de afirmarla como observada.
  return conclude(
    [
      await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_SERVER_ERROR), notice, 'el aviso del servidor', NET_MS),
      await stepCheck(page, 3, 'sigue en'),
    ],
    {
      note: 'no se comprueba «no se crea ningún programa»: la prueba intercepta POST /api/programs y responde 500 o no responde sin reenviarla al servidor, así que la comprobación sería vacua',
    },
  );
};

defineBrowserRows({
  story: 'US-PROG-ALTA-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(backRow)],
    [2, onWeb(closeRow)],
    [3, onWeb(summaryRow)],
    [4, onWeb(switchRow)],
    [5, onWeb(duplicateRow)],
    [6, onWeb(serverErrorRow)],
  ]),
});
