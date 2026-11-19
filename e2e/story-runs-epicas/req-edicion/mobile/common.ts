import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, runSteps, safe, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { armToasts, interact, recordToasts, TOAST_KEY, type WebAction } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-REQ-EDICION, servida como web de Expo (390 × 844). NO es iOS ni Android nativo:
// las filas que dependen del sistema nativo devuelven notExecutable. Los localizadores son de rol y de nombre o de id de prueba de la
// propia fila/elemento. Expo web NO emite `aria-description`: el motivo de un botón deshabilitado sale en `data-reason` (Button.tsx) y
// como texto visible junto al control, que se lee SOLO dentro del elemento de su motivo (`requirement-action-reason-*`).

export const EXPO_NOTE =
  'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo. Decisión: la explicación de un botón deshabilitado se lee como texto visible junto al control, dentro de su elemento de motivo; Expo web no emite aria-description, y el motivo medido queda en data-reason (Button.tsx).';
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

// --- Localizadores --------------------------------------------------------------------------------------------------------

export const tree = (page: Page): Locator => page.getByRole('list', { name: 'Árbol de requisitos', exact: true }).or(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_TREE));
/** Fila de un requisito en el árbol: solo su propio testid (el contenedor de la lista siempre está visible y no prueba nada). */
export const cardOf = (page: Page, code: string): Locator => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW(code));
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

// --- Estados y motivos -------------------------------------------------------------------------------------------------------

/** Elemento del motivo visible de una acción de la hoja («edit», «move», «delete», «save»). */
export const reasonOf = (page: Page, action: 'edit' | 'move' | 'delete' | 'save'): Locator => page.getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ACTION_REASON(action));

/** Elemento del motivo del botón «Nuevo requisito» de la lista. */
export const newReasonOf = (page: Page): Locator => page.getByTestId(MOVIL_REQUIREMENTS_TESTIDS.NEW_REASON);

/**
 * Estado de un botón móvil. Se mide `aria-disabled` y `data-reason` (Button.tsx). Si se da `reasonOf`, el motivo visible se lee SOLO
 * dentro de ese elemento (nunca a nivel de página). Expo web no emite `aria-description`: la explicación se lee como texto visible.
 */
export const mobileStateCheck = async (target: Locator, expected: 'habilitado' | 'deshabilitado', reason?: string, reasonElement?: Locator): Promise<Check> => {
  const disabled = (await safe(() => target.first().getAttribute('aria-disabled', { timeout: 500 }), null)) === 'true';
  const dataReason = (await safe(() => target.first().getAttribute('data-reason', { timeout: 500 }), null)) ?? undefined;
  const visibleReason = reasonElement === undefined ? undefined : await safe(() => reasonElement.first().innerText({ timeout: 1_000 }), undefined);
  const state = disabled ? 'deshabilitado' : 'habilitado';
  const reasonOk = reason === undefined || (dataReason === reason && (reasonElement === undefined || visibleReason?.trim() === reason));
  const detail = disabled ? ` con data-reason «${dataReason ?? '(sin motivo)'}»${reasonElement === undefined ? '' : ` y texto visible «${visibleReason ?? '(no visible)'}»`}` : '';
  return check(state === expected && reasonOk, `${expected}${reason === undefined ? '' : ` con la explicación «${reason}»`}`, `${state}${detail}`);
};

/** Cuenta los POST /api/requirements que la página envía desde que se llama (un alta enviada o no). */
export const countCreates = (page: Page): (() => number) => {
  let total = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/requirements')) total += 1;
  });
  return () => total;
};

// --- Textos y resultados ----------------------------------------------------------------------------------------------------

/** Un texto visible (coincidencia exacta de elemento) en la página o dentro del ámbito dado. */
export const textVisible = async (page: Page, text: string, scope?: Locator): Promise<boolean> =>
  safe(() => (scope ?? page).getByText(text, { exact: true }).first().isVisible({ timeout: 1_000 }), false);

/** Espera (con techo) a que un texto exacto aparezca en el ámbito; devuelve si apareció. */
export const waitText = async (page: Page, text: string, scope?: Locator): Promise<boolean> => (await waitUntil(() => textVisible(page, text, scope))).reached;

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
