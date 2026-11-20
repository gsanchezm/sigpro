import type { Locator, Page } from '@playwright/test';
import { ADMIN_DYNAMIC_TESTIDS, ADMIN_TESTIDS, MOVIL_ADMIN_DYNAMIC_TESTIDS, MOVIL_ADMIN_TESTIDS, MOVIL_DYNAMIC_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil, type Step } from '../../support/browser';
import { sleep, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { recordToasts, TOAST_KEY } from '../web/common';

// Piezas comunes de las filas MÓVILES de EP-ADMIN-USUARIOS: la app móvil servida como web de Expo a 390 × 844. NO es iOS ni Android
// nativo: el veredicto vale para Expo web. Las lecturas de nombres ignoran el avatar (su `role="img"` lleva el nombre en `aria-label`).

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo.';
export const LOGIN_PATH = '/login';
export const TENANT_TEXT = 'Tenant de trabajo';
export const ADMIN_PATH = '/admin';
export const MORE_TAB = 'more';
export const USERS_TAB = 'users';
/** Lo que se ve en la tarjeta de la propia cuenta (la historia lo fija como texto visible). */
export const OWN_REASON = 'No puedes modificar tu propia cuenta';
export const TOAST_UPDATED = 'Usuario actualizado';
export const TOAST_FAILED = 'No se pudo guardar el cambio';

/** Añade la salvedad de plataforma (Expo web no es nativo) al resultado de cada fila móvil. */
export const onMobile =
  (handler: BrowserRowHandler): BrowserRowHandler =>
  async (row, fixtures) => {
    const result = await handler(row, fixtures);
    return { ...result, note: result.note === undefined ? EXPO_NOTE : `${result.note} ${EXPO_NOTE}` };
  };

/** Resultado de una fila móvil a partir de sus comprobaciones. */
export const verdict = (checks: readonly Check[], note?: string): Outcome =>
  outcome(
    checks.every((entry) => entry.ok),
    checks.map((entry) => entry.expected).join('; '),
    checks.map((entry) => entry.observed).join('; '),
    note === undefined ? {} : { note },
  );

/** Inicio de sesión en la app móvil: alumno01 en «Tenant de trabajo», el correo y la contraseña de la cuenta, y «Entrar». Termina en «Programas». */
export const signInMobile = (page: Page, email: string, password: string): Promise<string | undefined> => {
  const steps: Step[] = [
    ['instalar el registro de avisos', () => page.context().addInitScript(recordToasts, TOAST_KEY)],
    ['fijar el ancho de la ventana', () => page.setViewportSize(MOBILE_VIEWPORT)],
    ['abrir /login', () => page.goto(LOGIN_PATH, { timeout: CEILING_MS })],
    ['ver el título «Iniciar sesión»', () => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
    [`escribir ${TENANT_A} en «${TENANT_TEXT}»`, () => page.getByRole('textbox', { name: TENANT_TEXT, exact: true }).fill(TENANT_A, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a «Programas»', () => page.getByRole('heading', { name: 'Programas', level: 1, exact: true }).waitFor({ timeout: CEILING_MS })],
  ];
  return runSteps(steps);
};

/** Pulsa la pestaña «Más» de la barra inferior. Devuelve el motivo si no se puede pulsar. */
export const openMoreTab = (page: Page): Promise<string | undefined> =>
  runSteps([['pulsar la pestaña «Más»', () => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(MORE_TAB)).click(ACTION)]]);

/** Desde «Más», pulsa «Administración» (solo aparece para el rol admin) y espera a la pantalla. */
export const openAdminFromMore = async (page: Page): Promise<string | undefined> => {
  const more = await openMoreTab(page);
  if (more !== undefined) return more;
  const shown = await waitUntil(() => isVisible(page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM('admin'))));
  if (!shown.reached) return 'la entrada «Administración» no aparece en «Más»';
  return runSteps([['pulsar «Administración» en «Más»', () => page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM('admin')).click(ACTION)]]);
};

/** Pestaña de Administración por su clave (testid de la pestaña). */
export const tabOf = (page: Page, key: 'users' | 'audit' | 'chaos' | 'data'): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_TAB(key));

/** Valor `aria-selected` de una pestaña (lectura con plazo). */
export const selectedTab = (page: Page, key: 'users' | 'audit' | 'chaos' | 'data'): Promise<string | undefined> => attrOf(tabOf(page, key), 'aria-selected');

/** La lista de usuarios está montada, sin indicador de carga y con el recuento asentado. */
export const usersReady = async (page: Page): Promise<boolean> => {
  const count = await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_COUNT));
  const loading = await safe(() => page.getByTestId(MOVIL_ADMIN_TESTIDS.USERS_LOADING).count(), 1);
  return count !== undefined && !count.includes('…') && loading === 0 && (await isVisible(page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_TABLE)));
};

export const waitUsersReady = async (page: Page): Promise<boolean> => (await waitUntil(() => usersReady(page))).reached;

/** Tarjetas de usuarios visibles (una por cuenta). */
export const cardsOf = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_USERS_TABLE).locator('[data-testid^="admin-user-row-"]');

export const cardOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROW(id));
export const roleComboOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROLE(id));
export const activeSwitchOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ACTIVE(id));
export const statusBadgeOf = (page: Page, id: string): Locator => page.getByTestId(ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_STATUS(id));
export const reasonOf = (page: Page, id: string): Locator => page.getByTestId(MOVIL_ADMIN_DYNAMIC_TESTIDS.USER_REASON(id));

/** Valor visible del selector de rol (su etiqueta, sin la flecha ▾), o `undefined` si no se lee. */
export const comboLabel = async (page: Page, id: string): Promise<string | undefined> => {
  const text = await textOf(roleComboOf(page, id));
  return text === undefined ? undefined : text.replace(/▾/g, '').replace(/\s+/g, ' ').trim();
};

/** Interruptor efectivo: `aria-checked` como texto, o `undefined`. */
export const switchChecked = (page: Page, id: string): Promise<string | undefined> => attrOf(activeSwitchOf(page, id), 'aria-checked');

/** Estado efectivo de deshabilitado (RN-web pone `aria-disabled="true"` solo si está deshabilitado). */
export const effectivelyDisabled = async (target: Locator): Promise<boolean | undefined> => {
  const attr = await attrOf(target, 'aria-disabled');
  if (attr === undefined) return undefined;
  return attr === 'true';
};

/** Elige una opción del selector de rol de una tarjeta (la hoja con opciones tipo radio). */
export const pickRole = async (page: Page, id: string, value: string): Promise<string | undefined> => {
  const opened = await runSteps([['abrir el selector de rol', () => roleComboOf(page, id).click(ACTION)]]);
  if (opened !== undefined) return opened;
  const option = page.getByTestId(`${ADMIN_DYNAMIC_TESTIDS.ADMIN_USER_ROLE(id)}-option-${value}`);
  return runSteps([[`elegir la opción «${value}»`, () => option.click(ACTION)]]);
};

/** Nombre visible de una tarjeta: el texto del nodo exacto (el avatar no entra en el texto de la tarjeta). */
export const cardShowsName = (page: Page, id: string, name: string): Promise<boolean> => isVisible(cardOf(page, id).getByText(name, { exact: true }));

/** Milisegundos de espera tras una acción local (1 s) o de red (5 s). */
export const settleLocal = (): Promise<void> => sleep(1_000);


/** Ruta y query actuales de la página (sin el origen), p. ej. `/admin?tab=audit`. */
export const pathAndQuery = (page: Page): string => {
  try {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  } catch {
    return page.url();
  }
};
