import type { Page } from '@playwright/test';
import { MOVIL_NC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, runSteps, waitUntil, type Step } from '../../support/browser';
import { check, preparationFailedWeb, type Check } from '../../support/checks';
import { type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ACCOUNT_BY_EMAIL, TOAST_KEY, interact, recordToasts, withLimit, type WebAction } from '../web/common';

// Piezas comunes de las filas MÓVILES de EP-NC-TABLERO: la app móvil servida como web de Expo a 390 × 844. NO es iOS ni Android
// nativo. El motivo de un botón deshabilitado se lee como TEXTO VISIBLE acotado a su elemento (el de MOVIL_NC_TESTIDS) y como
// atributos del botón (data-reason y aria-disabled), porque Expo web no emite aria-description. Las lecturas van en una evaluación.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const READ_ONLY_REASON = 'Tu rol no permite mover no conformidades';
export const ERROR_TITLE = 'No se pudo cargar el tablero';
export const EMPTY_HINT = 'Ninguna no conformidad coincide con los filtros aplicados.';
const TAB_KEY = 'nc';

/** Añade la salvedad de plataforma (Expo web no es nativo) al resultado de cada fila móvil. */
export const onMobile =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Inicio de sesión en la app móvil: alumno01 en «Tenant de trabajo», la cuenta con su contraseña y «Entrar». Termina en /programas. */
export const signInMobile = (page: Page, email: string): Promise<string | undefined> => {
  const credentials: Credentials | undefined = ACCOUNT_BY_EMAIL.get(email);
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials?.email ?? email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials?.password ?? '', ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programas', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Pulsa la pestaña «No conformidades» de la barra inferior (localizada por su testid de la barra). */
export const openNcTab: WebAction = (page) => interact(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(TAB_KEY)), 'pulsar la pestaña «No conformidades»', (element) => element.click(ACTION));

/**
 * Preparación de una fila móvil: reinicio de alumno01 con el token de su administrador, inicio de sesión de la cuenta y apertura de
 * la pestaña «No conformidades». `beforeTab` arma las rutas de la fila antes de abrirla.
 */
export const prepareMobile = async (page: Page, email: string, expected: string, beforeTab?: () => Promise<unknown>): Promise<Outcome | undefined> => {
  await resetTenants([TENANT_A]);
  const signedIn = await signInMobile(page, email);
  if (signedIn !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signedIn}`);
  if (beforeTab !== undefined) await beforeTab();
  const opened = await openNcTab(page);
  if (opened !== undefined) return preparationFailedWeb(expected, `abrir la pestaña «No conformidades»: ${opened.message}`);
  return undefined;
};

// --- Lectura del tablero móvil (una evaluación) ------------------------------------------------------------------------------

export interface MobileColumn {
  readonly state: string;
  readonly present: boolean;
  /** Nombre accesible de la columna: «Abierta · 4». */
  readonly label: string | undefined;
  readonly count: string;
  readonly cards: readonly string[];
}

export interface MobileBoard {
  readonly hasBoard: boolean;
  readonly busy: string | undefined;
  readonly total: string | undefined;
  readonly columns: readonly MobileColumn[];
  readonly cardsTotal: number;
  readonly errorText: string | undefined;
  readonly emptyLines: readonly string[];
  readonly at: number;
}

/** Se ejecuta en el navegador: todo el tablero móvil en una lectura. */
const mobileBoardReader = (): MobileBoard => {
  const states = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'];
  const cardCodes = (root: Element | null): string[] =>
    root === null ? [] : Array.from(root.querySelectorAll('[role="listitem"][data-testid^="nc-card-NC-"]')).map((item) => item.getAttribute('aria-label') ?? '');
  const board = document.querySelector('[data-testid="nc-board"]');
  const countNode = document.querySelector('[data-testid="nc-count"]');
  const errorNode = document.querySelector('[data-testid="nc-error"]');
  const emptyNode = document.querySelector('[data-testid="nc-empty"]');
  return {
    hasBoard: board !== null,
    busy: board === null ? undefined : (board.getAttribute('aria-busy') ?? undefined),
    total: countNode === null ? undefined : (countNode.textContent ?? '').trim(),
    columns: states.map((state) => {
      const region = document.querySelector(`[data-testid="nc-column-${state}"]`);
      const count = document.querySelector(`[data-testid="nc-column-count-${state}"]`);
      return {
        state,
        present: region !== null,
        label: region === null ? undefined : (region.getAttribute('aria-label') ?? undefined),
        count: count === null ? '' : (count.textContent ?? '').trim(),
        cards: cardCodes(region),
      };
    }),
    cardsTotal: document.querySelectorAll('[role="listitem"][data-testid^="nc-card-NC-"]').length,
    errorText: errorNode === null ? undefined : (errorNode.textContent ?? '').replace(/\s+/g, ' ').trim(),
    emptyLines: emptyNode === null ? [] : ((emptyNode as HTMLElement).innerText ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== ''),
    at: Date.now(),
  };
};

export const readMobileBoard = (page: Page): Promise<MobileBoard | undefined> => withLimit<MobileBoard | undefined>(page.evaluate(mobileBoardReader), undefined);

/** Tablero asentado: con recuento no ocupado, o con aviso de error. */
export const mobileSettled = (view: MobileBoard | undefined): boolean => view !== undefined && (view.errorText !== undefined || (view.hasBoard && view.busy === 'false' && view.total !== undefined && !view.total.includes('…')));

/** Espera (con techo) a que el tablero móvil cumpla `ok`; devuelve la última lectura. */
export const waitMobileBoard = async (page: Page, ok: (view: MobileBoard) => boolean, ceilingMs: number = CEILING_MS): Promise<MobileBoard | undefined> => {
  let last: MobileBoard | undefined;
  await waitUntil(async () => {
    last = await readMobileBoard(page);
    return last !== undefined && ok(last);
  }, ceilingMs);
  return last;
};

/** Columna por estado de la lectura móvil. */
export const mobileColumn = (view: MobileBoard, state: string): MobileColumn | undefined => view.columns.find((column) => column.state === state);

/** Códigos de todas las tarjetas que se ven (por conjunto: el orden va por columna). */
export const mobileCards = (view: MobileBoard): readonly string[] => view.columns.flatMap((column) => column.cards);

// --- Lectura de una tarjeta ---------------------------------------------------------------------------------------------------

export interface MobileCardView {
  readonly present: boolean;
  readonly severity: string | undefined;
  readonly program: string | undefined;
  readonly comments: string | undefined;
  readonly assignee: string | undefined;
}

/** Se ejecuta en el navegador: severidad, programa (línea «PRG-…» de la tarjeta), comentarios y responsable. */
const mobileCardReader = (code: string): MobileCardView => {
  const card = document.querySelector(`[data-testid="nc-card-${code}"]`);
  const textOf = (testid: string): string | undefined => {
    const node = document.querySelector(`[data-testid="${testid}"]`);
    return node === null ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim();
  };
  const lines = card === null ? [] : ((card as HTMLElement).innerText ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
  return {
    present: card !== null,
    severity: textOf(`nc-card-severity-${code}`),
    program: lines.find((line) => /^PRG-\d{3}$/.test(line)),
    comments: textOf(`nc-card-comments-${code}`),
    assignee: textOf(`nc-card-assignee-${code}`),
  };
};

export const readMobileCard = (page: Page, code: string): Promise<MobileCardView | undefined> => withLimit<MobileCardView | undefined>(page.evaluate(mobileCardReader, code), undefined);

// --- Lectura de la hoja de detalle -------------------------------------------------------------------------------------------

/** Botón «Mover a …» de la hoja: estado, nombre accesible, si está deshabilitado (aria-disabled) y su data-reason. */
export interface MobileTransition {
  readonly state: string;
  readonly label: string;
  readonly disabled: boolean;
  readonly reasonAttribute: string | undefined;
}

export interface MobileDetail {
  readonly open: boolean;
  readonly heading: string | undefined;
  readonly state: string | undefined;
  readonly severity: string | undefined;
  readonly transitions: readonly MobileTransition[];
  /** Texto VISIBLE del motivo de los botones deshabilitados (solo el elemento del motivo). */
  readonly reasonText: string | undefined;
  readonly sectionText: string | undefined;
  readonly serverError: string | undefined;
}

/** Se ejecuta en el navegador: la hoja de detalle en una lectura. El motivo visible se toma solo de su elemento (si se ve). */
const mobileDetailReader = (reasonTestId: string): MobileDetail => {
  const sheet = document.querySelector('[data-testid="nc-detail"]');
  const textOf = (node: Element | null | undefined): string | undefined => (node === null || node === undefined ? undefined : (node.textContent ?? '').replace(/\s+/g, ' ').trim());
  const inside = (testid: string): Element | null => (sheet === null ? null : sheet.querySelector(`[data-testid="${testid}"]`));
  const reason = inside(reasonTestId);
  const visibleReason = reason !== null && (reason as HTMLElement).offsetParent !== null ? textOf(reason) : undefined;
  return {
    open: sheet !== null,
    heading: sheet === null ? undefined : (sheet.getAttribute('aria-label') ?? undefined),
    state: textOf(inside('nc-state-badge')),
    severity: textOf(inside('nc-severity-badge')),
    transitions:
      sheet === null
        ? []
        : Array.from(sheet.querySelectorAll('[role="button"][data-testid^="nc-transition-"]')).map((button) => ({
            state: (button.getAttribute('data-testid') ?? '').replace(/^nc-transition-/, ''),
            label: button.getAttribute('aria-label') ?? (button.textContent ?? '').trim(),
            disabled: button.getAttribute('aria-disabled') === 'true',
            reasonAttribute: button.getAttribute('data-reason') ?? undefined,
          })),
    reasonText: visibleReason,
    sectionText: textOf(inside('nc-transitions')),
    serverError: textOf(inside('nc-server-error')),
  };
};

export const readMobileDetail = (page: Page): Promise<MobileDetail | undefined> =>
  withLimit<MobileDetail | undefined>(page.evaluate(mobileDetailReader, MOVIL_NC_TESTIDS.TRANSITION_REASON), undefined);

/** Espera (con techo) a que la hoja cumpla `ok`; devuelve la última lectura. */
export const waitMobileDetail = async (page: Page, ok: (view: MobileDetail) => boolean, ceilingMs: number = CEILING_MS): Promise<MobileDetail | undefined> => {
  let last: MobileDetail | undefined;
  await waitUntil(async () => {
    last = await readMobileDetail(page);
    return last !== undefined && ok(last);
  }, ceilingMs);
  return last;
};

/**
 * Un botón «Mover a …» de la hoja: habilitado, o deshabilitado con su motivo como texto visible (el del elemento del motivo) y en
 * data-reason. Una lectura que no llega cuenta como NO cumplida.
 */
export const transitionCheck = (view: MobileDetail | undefined, state: string, expected: { readonly enabled: boolean; readonly reason?: string }, what: string): Check => {
  const entry = view?.transitions.find((item) => item.state === state);
  if (entry === undefined) return check(false, `${what} ${expected.enabled ? 'habilitado' : `deshabilitado, con el texto visible «${expected.reason ?? ''}»`}`, `${what} (sin leer)`);
  if (expected.enabled) return check(!entry.disabled, `${what} habilitado`, `${what} ${entry.disabled ? 'deshabilitado' : 'habilitado'}`);
  const reasonOk = entry.disabled && view?.reasonText === expected.reason && entry.reasonAttribute === expected.reason;
  return check(
    reasonOk,
    `${what} deshabilitado, con el texto visible «${expected.reason ?? ''}»`,
    `${what} ${entry.disabled ? 'deshabilitado' : 'habilitado'}; texto visible «${view?.reasonText ?? '(sin texto visible)'}»; data-reason «${entry.reasonAttribute ?? '(sin atributo)'}»`,
  );
};
