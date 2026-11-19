import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { armToasts, interact, recordToasts, TOAST_KEY, type AccountName, type WebAction } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-EDICION, servida como web de Expo (390 × 844). NO es iOS ni Android nativo:
// las filas que dependen del sistema nativo devuelven notExecutable. Los localizadores son de rol y de nombre (la app usa `role` y
// `aria-label`); el motivo de un botón deshabilitado va en su `aria-description` (no en `title`). Toda acción pasa por `interact`.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const VIEWPORT = { width: 390, height: 844 } as const;
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
export const REQUIREMENTS_PATH = '/programs/PRG-001/requirements';
const SETTLE_MS = 1_000;

/** Añade a cada resultado de la fila la salvedad de plataforma (Expo web no es nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Credenciales de las cuentas que usan las filas móviles (las del seed de alumno01). */
export const ACCOUNT_CREDENTIALS: Readonly<Record<'gestor' | 'consultor' | 'auditor' | 'alumno01', Credentials>> = {
  gestor: DEMO.gestor,
  consultor: DEMO.consultor,
  auditor: DEMO.auditor,
  alumno01: { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' },
};

/**
 * Preparación de cada fila: instala el registro de avisos, fija el ancho de la ventana, abre /login, escribe alumno01 en «Tenant de
 * trabajo», la cuenta con su contraseña y pulsa «Entrar». Termina con la sesión iniciada y el registro de avisos armado.
 */
export const signInMobile = (page: Page, credentials: Credentials): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs/, { timeout: CEILING_MS })],
    ['armar el registro de avisos', () => armToasts(page).then(() => undefined)],
  ];
  return runSteps(steps);
};

/** Abre el árbol de requisitos de PRG-001 en la app móvil y espera a que esté cargado. */
export const openRequirementsMobile = (page: Page): Promise<string | undefined> =>
  runSteps([
    ['abrir /programs/PRG-001/requirements', () => page.goto(REQUIREMENTS_PATH, { timeout: CEILING_MS })],
    ['ver el árbol de requisitos', () => tree(page).waitFor({ timeout: CEILING_MS })],
    ['ver la lista cargada', () => sleep(SETTLE_MS)],
    ['armar el registro de avisos', () => armToasts(page).then(() => undefined)],
  ]);

/** Preparación común de cada fila: inicio de sesión y apertura del árbol. Devuelve el fallo de la preparación si lo hay. */
export const prepareMobile = async (page: Page, credentials: Credentials, expected: string): Promise<Outcome | undefined> => {
  const failure = (await signInMobile(page, credentials)) ?? (await openRequirementsMobile(page));
  return failure === undefined ? undefined : preparationFailedWeb(expected, failure);
};

// --- Localizadores --------------------------------------------------------------------------------------------------------------

export const tree = (page: Page): Locator => page.getByRole('list', { name: 'Árbol de requisitos', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_TREE));
/** Tarjeta de un requisito en el árbol (`role="listitem"`, nombre «REQ-… título»). */
export const cardOf = (page: Page, code: string): Locator => page.getByRole('listitem', { name: `${code} ` }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_TREE));
/** Botón que abre la hoja de un requisito («Abrir detalle de REQ-…»). */
export const openSheetButton = (page: Page, code: string): Locator => page.getByRole('button', { name: `Abrir detalle de ${code}`, exact: true });
/** Botón «Nuevo requisito» de la lista. */
export const newButton = (page: Page): Locator => page.getByRole('button', { name: 'Nuevo requisito', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NEW));
/** Diálogo «Nuevo requisito». */
export const newDialog = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_NEW_DIALOG);
/** Hoja (detalle) del requisito abierta. */
export const sheet = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);
/** Confirmación de borrado. */
export const deleteDialog = (page: Page): Locator => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DELETE_DIALOG);
/** Botón de la hoja por su nombre («Editar», «Mover a…», «Eliminar»). */
export const sheetButton = (page: Page, name: string): Locator => sheet(page).getByRole('button', { name, exact: true });

/** Abre la hoja de un requisito tocando su botón de detalle. */
export const openSheet = (code: string): WebAction => (page) => interact(openSheetButton(page, code), `abrir la hoja de ${code}`, (element) => element.click(ACTION));

/** Pulsa un botón por su nombre exacto en la página (o en el diálogo indicado). */
export const pressButton = (locate: (page: Page) => Locator, name: string): WebAction => (page) => interact(locate(page).getByRole('button', { name, exact: true }), `pulsar «${name}»`, (element) => element.click(ACTION));

// --- Estados y motivos (la app móvil los expone en aria-disabled y aria-description) ----------------------------------------

/** Estado de un botón móvil: `aria-disabled` y, si está deshabilitado, su motivo (`aria-description`). */
export const mobileStateCheck = async (target: Locator, expected: 'habilitado' | 'deshabilitado', reason?: string): Promise<Check> => {
  const disabled = (await safe(() => target.first().getAttribute('aria-disabled', { timeout: 500 }), null)) === 'true';
  const described = (await safe(() => target.first().getAttribute('aria-description', { timeout: 500 }), null)) ?? '(sin explicación)';
  const state = disabled ? 'deshabilitado' : 'habilitado';
  const explained = reason === undefined || described === reason;
  return check(state === expected && explained, `${expected}${reason === undefined ? '' : ` con la explicación «${reason}»`}`, `${state}${disabled ? ` con la explicación «${described}»` : ''}`);
};

/** Un texto visible (coincidencia exacta de elemento) en la página. */
export const textVisible = async (page: Page, text: string): Promise<boolean> => safe(() => page.getByText(text, { exact: true }).first().isVisible({ timeout: 1_000 }), false);

/** Espera (con techo) a que un texto exacto aparezca; devuelve si apareció. */
export const waitText = async (page: Page, text: string): Promise<boolean> => (await waitUntil(() => textVisible(page, text))).reached;

/** Resultado de una fila móvil con sus comprobaciones. */
export const outcomeOf = (checks: readonly Check[], note?: string): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    note === undefined ? {} : { note },
  );

/** Espera corta de asentamiento (la reacción local de la app es de ~1 s). */
export const settleMobile = (): Promise<void> => sleep(SETTLE_MS);

/** Acción nula que no hace nada (para ordenar pasos opcionales). */
export const noop: WebAction = async () => undefined;

/** Mismas acciones de la web, reutilizadas para la app móvil (`interact` no depende del diseño). */
export { interact, armToasts, recordToasts, TOAST_KEY };
export type { AccountName, WebAction };
