import type { Locator, Page } from '@playwright/test';
import { MOVIL_PROGRAMS_DYNAMIC_TESTIDS, MOVIL_PROGRAMS_TESTIDS, MOVIL_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, DEMO } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import type { BrowserRowHandler } from '../../core/framework';
import { type AccountName, MFA_CODE, TOAST_KEY, armToasts, codesOf, interact, recordToasts, tokensOf, type WebAction } from '../web/common';

// Piezas comunes de las filas de la app móvil de EP-PROG-GESTION, servida como web de Expo (390 × 844). NO es iOS ni Android
// nativo: la hoja de compartir del sistema se sustituye por un `navigator.share` simulado que registra lo que la app le entrega.
// Los localizadores son de rol y de nombre; los ids de prueba solo donde la app no ofrece otro rastro.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const SHARE_NAME = 'sigpro-programas.csv';
export const LOGIN_PATH = '/login';
/** Aproximación declarada de la hoja de compartir: se registra lo que la app entrega; la hoja del sistema no se comprueba. */
export const SHARE_APPROXIMATION =
  'La hoja de compartir del sistema se aproxima con un navigator.share simulado que registra lo que la app le entrega; no se comprueba la hoja real. Decisión pendiente de la historia: en el navegador, donde no hay hoja, no está decidido si el archivo debe descargarse.';
export const TENANT_TEXT = 'Tenant de trabajo';
const SHARE_LOG = '__sigproShare';

/** Añade a cada resultado de la fila la salvedad de plataforma (Expo web no es nativo). */
export const onExpoWeb =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Sustituye la hoja de compartir del sistema: registra cada `navigator.share(...)` que hace la app (título y texto). */
export const stubShareSheet = (): void => {
  try {
    const log: unknown[] = [];
    Object.defineProperty(window, '__sigproShare', { value: log, configurable: true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: (data: unknown) => {
        log.push(data);
        return Promise.resolve();
      },
    });
  } catch {
    // sin API de compartir que simular: la app avisará con su error
  }
};

/** Datos que la app entregó a la hoja de compartir, en orden (título y texto). */
export const sharedCalls = (page: Page): Promise<readonly { readonly title?: string; readonly text?: string }[]> =>
  safe(
    () =>
      page.evaluate((key: string) => {
        const log = (window as unknown as Record<string, unknown>)[key];
        return Array.isArray(log) ? (log as { title?: string; text?: string }[]) : [];
      }, SHARE_LOG),
    [],
  );

// --- Localizadores --------------------------------------------------------------------------------------------------------

export const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
export const buttonNamed = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
export const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });
export const programsHeading = (page: Page): Locator => heading1(page, 'Programas');
export const searchBox = (page: Page): Locator => textbox(page, 'Buscar programas');
export const selectToggle = (page: Page): Locator => buttonNamed(page, 'Seleccionar');
export const selectAllButton = (page: Page): Locator => buttonNamed(page, 'Seleccionar todos');
export const bulkBar = (page: Page): Locator => page.getByRole('toolbar', { name: 'Acciones masivas', exact: true });
export const bulkCount = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_BULK_COUNT);
export const recountOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_COUNT);
export const cardOf = (page: Page, code: string): Locator => page.getByRole('listitem', { name: code, exact: true });
export const cardsOf = (page: Page): Locator => page.getByTestId(MOVIL_TESTIDS.PROGRAMS_CARDS);
export const cardCheckbox = (page: Page, code: string): Locator => page.getByRole('checkbox', { name: `Seleccionar ${code}`, exact: true });
export const cardLink = (page: Page, code: string): Locator => page.getByRole('link', { name: new RegExp(`^${code} · `) });
export const menuButtonOf = (page: Page, code: string): Locator => buttonNamed(page, `Acciones para ${code}`);
export const actionSheet = (page: Page, code: string): Locator => page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true });
export const confirmDialog = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_DELETE_DIALOG);
export const exportButton = (page: Page): Locator => buttonNamed(page, 'Exportar CSV');
export const reasonOf = (page: Page, key: string): Locator => page.getByTestId(MOVIL_PROGRAMS_DYNAMIC_TESTIDS.ACTION_REASON(key));

/** Estado de una tarjeta: su línea de estado (catálogo) o `undefined`. */
const STATE_LABELS: readonly string[] = ['Borrador', 'Activo', 'En pausa', 'Cerrado', 'Cancelado'];
export const stateOfCard = async (page: Page, code: string): Promise<string | undefined> => {
  const badge = await textOf(cardOf(page, code).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_STATE_BADGE));
  return badge !== undefined && STATE_LABELS.includes(badge) ? badge : undefined;
};

/** Trozos del texto visible de una tarjeta (nombre, código, estado…), separados por salto de línea o tabulador. */
export const cardTokens = async (page: Page, code: string): Promise<readonly string[]> => tokensOf(await textOf(cardOf(page, code)));

/** Códigos de las tarjetas que se ven, en orden (cada tarjeta lleva su código como nombre accesible). */
export const cardCodes = async (page: Page): Promise<readonly string[]> => {
  const names = await cardsOf(page).getByRole('listitem').evaluateAll((items) => items.map((item) => item.getAttribute('aria-label') ?? ''));
  return names.filter((name) => /^PRG-\d{3}$/.test(name));
};

/** Texto de un elemento solo si se ve de verdad: ni él ni sus ancestros con `hidden`, `display:none` o `visibility:hidden`. */
export const visibleTextOf = (target: Locator): Promise<string | undefined> =>
  safe(
    () =>
      target.first().evaluate((element) => {
        let node: Element | null = element;
        while (node !== null) {
          const style = getComputedStyle(node);
          if (node.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden') return undefined;
          node = node.parentElement;
        }
        return (element as HTMLElement).innerText.trim();
      }),
    undefined,
  );

/** Un botón deshabilitado (propiedad `disabled` o `aria-disabled`). Una lectura fallida no cuenta como deshabilitado. */
export const isDisabledControl = (target: Locator): Promise<boolean | undefined> =>
  safe(
    () =>
      target.first().evaluate((element) => (element as HTMLButtonElement).disabled === true || element.getAttribute('aria-disabled') === 'true' || element.closest('[aria-disabled="true"]') !== null),
    undefined,
  );

/** Estado de una acción visible en la pantalla móvil: habilitada o deshabilitada con su motivo como texto visible. */
export const visibleStateCheck = async (target: Locator, reasonTarget: Locator, expected: { readonly enabled: boolean; readonly reason?: string }, label: string): Promise<Check> => {
  const disabled = await isDisabledControl(target);
  const reason = (await visibleTextOf(reasonTarget)) ?? '(sin motivo visible)';
  const observed = disabled === undefined ? '(sin leer)' : disabled ? `deshabilitado${reason === '(sin motivo visible)' ? '' : `, con el texto «${reason}»`}` : 'habilitado';
  const ok = expected.enabled ? disabled === false : disabled === true && (expected.reason === undefined || reason === expected.reason);
  return check(ok, expected.enabled ? `${label} habilitado` : `${label} deshabilitado${expected.reason ? `, con el texto «${expected.reason}»` : ''}`, `${label} ${observed}`);
};

// --- Sesión, espera y acciones ----------------------------------------------------------------------------------------------

/** La pantalla de programas está montada y ya no muestra «Cargando…» (la primera página llegó). */
export const waitSettled = async (page: Page): Promise<boolean> =>
  (await waitUntil(async () => (await isVisible(programsHeading(page))) && !(await isVisible(page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAMS_LOADING))))).reached;

const settledOrThrow = async (page: Page): Promise<void> => {
  if (!(await waitSettled(page))) throw new Error('la lista de programas no aparece');
};

/**
 * Preparación de cada fila: reinicio (lo hace la fila antes), la app en /login con alumno01 en «Tenant de trabajo», la cuenta con su
 * contraseña y «Entrar». El administrador completa «Verificación en dos pasos» con 123456. Termina en /programs con la lista asentada.
 */
export const signIn = (page: Page, account: AccountName): Promise<string | undefined> => {
  const credentials = account === 'gestor' ? DEMO.gestor : account === 'consultor' ? DEMO.consultor : account === 'auditor' ? DEMO.auditor : DEMO.admin;
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize({ width: 390, height: 844 })],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => textbox(page, TENANT_TEXT).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => textbox(page, 'Correo electrónico').fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => textbox(page, 'Contraseña').fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => buttonNamed(page, 'Entrar').click(ACTION)],
  ];
  if (account === 'admin') {
    steps.push(
      ['ver «Verificación en dos pasos»', () => heading1(page, 'Verificación en dos pasos').waitFor({ timeout: CEILING_MS })],
      ['escribir el código 123456', () => textbox(page, 'Código de verificación').pressSequentially(MFA_CODE, { delay: 0 })],
      ['pulsar «Verificar»', () => buttonNamed(page, 'Verificar').click(ACTION)],
    );
  }
  steps.push(
    ['llegar a /programs', () => programsHeading(page).waitFor({ timeout: CEILING_MS })],
    ['ver la lista de programas', () => settledOrThrow(page)],
    ['armar el registro de avisos', () => armToasts(page)],
  );
  return runSteps(steps);
};

/** Una acción de la pantalla móvil con diagnóstico (la de web sirve tal cual: `interact` no depende del diseño). */
export type MobileAction = WebAction;

/** Activa o desactiva el modo «Seleccionar» (botón con `aria-pressed`). */
export const toggleSelectMode: MobileAction = (page) => interact(selectToggle(page), 'pulsar «Seleccionar»', (element) => element.click(ACTION));

/** Marca o desmarca la casilla de una tarjeta (con el modo de selección ya activo). */
export const checkCard = (code: string, on: boolean): MobileAction => (page) =>
  interact(cardCheckbox(page, code), `${on ? 'marcar' : 'desmarcar'} la casilla de ${code}`, (element) => (on ? element.check(ACTION) : element.uncheck(ACTION)));

/** Pulsa una acción de la barra de acciones masivas. */
export const barAction = (name: string): MobileAction => (page) => interact(bulkBar(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en la barra de acciones masivas`, (element) => element.click(ACTION));

/** Abre el menú ⋯ de una tarjeta (hoja de acciones). */
export const openCardMenu = (code: string): MobileAction => (page) => interact(menuButtonOf(page, code), `abrir «Acciones para ${code}»`, (element) => element.click(ACTION));

/** Pulsa una acción de la hoja de una tarjeta (botón con ese nombre dentro de la hoja). */
export const pressSheetAction = (code: string, name: string): MobileAction => (page) =>
  interact(actionSheet(page, code).getByRole('button', { name, exact: true }), `pulsar «${name}» en la hoja de ${code}`, (element) => element.click(ACTION));

/** Pulsa «Cancelar» o «Eliminar» en la hoja de confirmación del borrado. */
export const confirmAction = (name: string): MobileAction => (page) =>
  interact(confirmDialog(page).getByRole('button', { name, exact: true }), `pulsar «${name}» en la hoja de confirmación`, (element) => element.click(ACTION));


/** Celda de estado en la app móvil: «habilitado(a)» o «deshabilitado(a), con el texto/motivo «…»». Otra forma LANZA. */
export const parseVisible = (text: string): { readonly enabled: boolean; readonly reason?: string } => {
  if (text === 'habilitado' || text === 'habilitada') return { enabled: true };
  const match = /^deshabilitad[ao], con el (?:texto|motivo) «(.+)»$/.exec(text);
  if (match?.[1]) return { enabled: false, reason: match[1] };
  throw new Error(`celda sin interpretación: estado «${text}»`);
};

/** Pulsa una tarjeta (con el modo de selección activo marca o desmarca el programa; si no, abre su detalle). */
export const tapCard = (code: string): MobileAction => (page) => interact(cardLink(page, code), `tocar la tarjeta de ${code}`, (element) => element.click(ACTION));

/** Pulsa «Seleccionar todos» (marca los programas de la página, o los quita si ya estaban todos). */
export const selectAll: MobileAction = (page) => interact(selectAllButton(page), 'pulsar «Seleccionar todos»', (element) => element.click(ACTION));

/** Códigos de una celda de la historia: «PRG-001 y PRG-003», «PRG-004, PRG-012 y PRG-020», «desde PRG-001 hasta PRG-024». */
export const codesFromCell = (text: string): readonly string[] => {
  const from = /^desde (PRG-\d{3}) hasta (PRG-\d{3})$/.exec(text);
  const list = from?.[1] !== undefined && from[2] !== undefined ? `${from[1]} a ${from[2]}` : text;
  return codesOf(list);
};
