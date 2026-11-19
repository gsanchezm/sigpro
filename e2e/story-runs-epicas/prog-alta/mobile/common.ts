import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { EDITAR_PROGRAMA_TESTIDS, MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, textOf, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';

// Piezas comunes de las filas de la app móvil de EP-PROG-ALTA. La app se ejecuta como web de Expo a 390 × 844: NO es iOS ni Android
// nativo. Las lecturas genéricas (alertas de campo, avisos emergentes, valores, casillas, esperas) son las de web/common.ts de esta
// misma épica; aquí van el inicio de sesión móvil, los localizadores de rol de la app y el aviso de plataforma de cada fila.

export { actionFailed, alertCheck, checkedCheck, fieldValueCheck, interact, LOCAL_MS, NET_MS, okToasts, programNow, stepCheck, textCheck, visibleCheck, waitForOkToast, type Blocked } from '../web/common';

/** Salvedad de plataforma: el veredicto de una fila móvil vale para Expo web, no para iOS ni Android nativo. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';

/** Envuelve una fila móvil: antes de cada fila reinicia alumno01 (cada fila parte de la semilla) y añade la salvedad de plataforma. */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    await resetTenants([TENANT_A]);
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Resultado de una comprobación de la fila móvil que no se pudo hacer (la pantalla no llegó al estado). */
export const preparationFailedMobile = (expected: string, reason: string): Outcome =>
  outcome(false, expected, `la preparación no se cumplió: ${reason}`, { note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.' });

export const VIEWPORT = { width: 390, height: 844 } as const;
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
export const DETAIL_PATH = '/programs/PRG-001';
export const EDIT_PATH = '/programs/PRG-001/edit';

// --- Localizadores de rol ----------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const loginHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
export const programsHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Programas', level: 1, exact: true });
/** Botón «Nuevo programa» de la cabecera de la lista (la app lo marca con `aria-disabled` y su motivo en `data-reason`). */
export const newProgramButton = (page: Page): Locator => buttonNamed(page, 'Nuevo programa');
/** Motivo visible de «Nuevo programa» (id de prueba: el texto no tiene rol propio). */
export const newProgramReason = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.NEW_REASON);
/** Hoja «Nuevo programa» (diálogo con el título como nombre accesible). */
export const wizardOf = (page: Page): Locator => page.getByRole('dialog', { name: 'Nuevo programa', exact: true });
export const wizardStepText = (page: Page): Promise<string | undefined> => textOf(wizardOf(page).getByTestId(MOVIL_PROGRAMS_TESTIDS.WIZARD_STEP_TEXT));
export const wizardField = (page: Page, name: string): Locator => wizardOf(page).getByRole('textbox', { name, exact: true });
export const wizardButton = (page: Page, name: string): Locator => wizardOf(page).getByRole('button', { name, exact: true });
/** Motivo visible de una acción del asistente deshabilitada (id de prueba del motivo). */
export const wizardReason = (page: Page, action: string): Locator => wizardOf(page).getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON(action));
/** Campo «Responsable» (un combobox que abre una hoja con el buscador y las personas). */
export const ownerField = (page: Page): Locator => page.getByRole('combobox', { name: 'Responsable', exact: true });
/** Hoja del responsable: su título es «Responsable». */
export const ownerSheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Responsable', exact: true });
export const ownerSearch = (page: Page): Locator => ownerSheet(page).getByRole('textbox', { name: 'Buscar responsable', exact: true });
export const ownerOption = (page: Page, persona: string): Locator => ownerSheet(page).getByRole('radio', { name: persona, exact: true });
/** Campo de un formulario de la edición (su nombre accesible es la etiqueta visible). */
export const editField = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const editStatusField = (page: Page): Locator => page.getByRole('combobox', { name: 'Estado', exact: true });
export const editSaveButton = (page: Page): Locator => buttonNamed(page, 'Guardar');
export const editSaveCloseButton = (page: Page): Locator => buttonNamed(page, 'Guardar y cerrar');
export const editNameField = (page: Page): Locator => editField(page, 'Nombre');
export const editStartField = (page: Page): Locator => editField(page, 'Fecha de inicio');
export const editEndField = (page: Page): Locator => editField(page, 'Fecha de fin');
export const editBudgetField = (page: Page): Locator => editField(page, 'Presupuesto (€)');
export const editClassifiedSwitch = (page: Page): Locator => page.getByRole('switch', { name: 'Programa clasificado', exact: true });
/** Motivo visible de «Guardar» deshabilitado (id de prueba de la acción). */
export const saveReason = (page: Page): Locator => page.getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON('save'));

// --- Sesión y espera ------------------------------------------------------------------------------------------------------------

/** La lista de programas está montada y ya no muestra la carga. */
const listSettled = (page: Page): Promise<boolean> =>
  waitUntil(async () => (await isVisible(programsHeading(page))) && !(await isVisible(page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING))), CEILING_MS).then((r) => r.reached);

/** Inicio de sesión en la app: viewport de 390 px, alumno01 en «Tenant de trabajo», la cuenta de la fila y llegar a /programs. */
export const signIn = (page: Page, credentials: Credentials = DEMO.gestor): Promise<string | undefined> =>
  runSteps([
    ['fijar el ancho de la ventana', () => page.setViewportSize(VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => loginHeading(page).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
    ['ver la lista de programas', async () => {
      if (!(await listSettled(page))) throw new Error('la lista de programas no aparece');
    }],
  ]);

/** Abre una dirección de la app (carga completa, que recupera la sesión guardada). */
export const openPath = (page: Page, path: string): Promise<string | undefined> => runSteps([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);

/** La pantalla de edición está montada: formulario, aviso de permiso o aviso de no encontrado. */
export const editSettled = async (page: Page): Promise<boolean> =>
  (
    await waitUntil(
      async () =>
        (await isVisible(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_FORM))) ||
        (await isVisible(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_DENIED))) ||
        (await isVisible(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NOT_FOUND))),
      CEILING_MS,
    )
  ).reached;

/** Motivo de un botón deshabilitado: `aria-disabled` y el motivo en `data-reason` (lectura fallida = no cumple). */
export const disabledReason = async (target: Locator, reason: string, label: string): Promise<Check> => {
  const disabled = (await attrOf(target, 'aria-disabled')) === 'true';
  const dataReason = await attrOf(target, 'data-reason');
  return check(disabled && dataReason === reason, `«${label}» deshabilitado con motivo «${reason}»`, `«${label}» ${disabled ? 'deshabilitado' : 'habilitado'}, motivo «${dataReason ?? '(sin motivo)'}»`);
};

/** Un botón habilitado o deshabilitado (`aria-disabled`), con espera local. */
export const mobileEnabledCheck = async (target: Locator, expectEnabled: boolean, label: string): Promise<Check> => {
  const waited = await waitUntil(async () => ((await attrOf(target, 'aria-disabled')) === 'true') === !expectEnabled, 1_000);
  const disabled = (await attrOf(target, 'aria-disabled')) === 'true';
  return check(waited.reached, `«${label}» ${expectEnabled ? 'habilitado' : 'deshabilitado'}`, `«${label}» ${disabled ? 'deshabilitado' : 'habilitado'}`);
};

/** Aproximación declarada: abrir la edición con una carga completa de la página no es una navegación interna de la app. */
export const LOAD_APPROXIMATION =
  'Abrir la edición se aproxima con una carga completa de la página en Expo web, que recupera la sesión guardada; en iOS o Android sería una navegación interna.';

/** Envuelve una fila móvil que abre su pantalla con una carga completa: añade la aproximación a la salvedad de plataforma. */
export const onExpoWebLoad =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  onExpoWeb(async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? LOAD_APPROXIMATION : `${result.note} ${LOAD_APPROXIMATION}` };
  });

/**
 * Un selector de la app (campo de responsable o de estado) muestra el valor esperado: espera (con el techo de red) porque la lista de
 * personas carga aparte. Una lectura fallida no cuenta.
 */
export const pickerCheck = async (target: Locator, expected: string, what: string): Promise<Check> => {
  const waited = await waitUntil(async () => (await pickerText(target)) === expected, 5_000);
  const observed = await pickerText(target);
  return check(waited.reached, `${what} muestra ${expected}`, `${what} muestra ${observed ?? '(sin leer)'}`);
};

/** Un valor de texto visible de un selector de la app (el campo muestra su opción; el símbolo ▾ no cuenta). */
export const pickerText = async (target: Locator): Promise<string | undefined> => {
  const text = await textOf(target);
  return text === undefined ? undefined : text.replace('▾', '').trim();
};
