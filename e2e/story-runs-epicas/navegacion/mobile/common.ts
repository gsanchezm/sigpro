import type { Locator, Page } from '@playwright/test';
import { BUSQUEDA_DYNAMIC_TESTIDS, BUSQUEDA_TESTIDS, MOVIL_DYNAMIC_TESTIDS, MOVIL_SEARCH_DYNAMIC_TESTIDS, MOVIL_SEARCH_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import type { Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, type Step } from '../../support/browser';
import type { BrowserRowHandler } from '../../core/framework';
import { withNote } from '../web/common';

// Piezas comunes de las filas de la app móvil servida como web de Expo (390 × 844). NO es nativo: iOS y Android nativo no se
// comprueban aquí. Las pestañas inferiores se localizan por su rol (nombre completo) y, de respaldo, por su id de prueba; el estado
// activo se lee del atributo ARIA del elemento (no se mira el color). Las pulsaciones son clics de ratón de Playwright.

export const MOBILE = { width: 390, height: 844 } as const;

/** Nota común de las filas móviles: el veredicto vale para Expo web, no para la app nativa. */
export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): no se ha comprobado en iOS ni en Android nativo. Las pestañas y el estado activo se leen de los atributos ARIA del elemento.';

export const MOBILE_TENANT = 'alumno01';

/** Inicio de sesión en la app móvil: «Tenant de trabajo», correo, contraseña y «Entrar»; espera a /programs. */
export const signInMobile = (page: Page, credentials: Credentials): Promise<string | undefined> =>
  runSteps([
    ['abrir /login', () => page.goto('/login', { timeout: CEILING_MS })],
    ['escribir el tenant en «Tenant de trabajo»', () => page.getByRole('textbox', { name: 'Tenant de trabajo', exact: true }).fill(MOBILE_TENANT, ACTION)],
    ['escribir el correo', () => page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(credentials.email, ACTION)],
    ['escribir la contraseña', () => page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(credentials.password, ACTION)],
    ['pulsar «Entrar»', () => page.getByRole('button', { name: 'Entrar', exact: true }).click(ACTION)],
    ['llegar a /programs', () => page.waitForURL(/\/programs(\?.*)?$/, { timeout: CEILING_MS })],
  ]);

/** Las cinco pestañas: clave (su testid), nombre completo (su nombre accesible) y ruta. */
export interface TabInfo {
  readonly key: string;
  readonly full: string;
  readonly route: string;
}

/** La pestaña «Más» (la que abre el menú y sus páginas). */
export const MORE: TabInfo = { key: 'more', full: 'Más', route: '/more' };

export const TABS: ReadonlyMap<string, TabInfo> = new Map<string, TabInfo>([
  ['Programas', { key: 'programs', full: 'Programas', route: '/programs' }],
  ['Verificación', { key: 'verification', full: 'Verificación', route: '/verification' }],
  ['NC', { key: 'nc', full: 'No conformidades', route: '/nc' }],
  ['Misión', { key: 'mission', full: 'Panel de misión', route: '/mission' }],
  ['Más', MORE],
]);

/** La pestaña: su nombre completo o su id de prueba (respaldo). */
export const tabOf = (page: Page, tab: TabInfo): Locator =>
  page.getByRole('tab', { name: tab.full, exact: true }).or(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.MOBILE_TAB(tab.key)));

/** Pestaña activa: se VE y su atributo `aria-selected` (o `aria-current`) vale verdadero. Una pestaña en una barra oculta no cuenta. */
export const tabActive = async (page: Page, tab: TabInfo): Promise<boolean> => {
  const target = tabOf(page, tab);
  if (!(await isVisible(target))) return false;
  const selected = await attrOf(target, 'aria-selected');
  const current = await attrOf(target, 'aria-current');
  return selected === 'true' || current === 'page';
};

/** Ítems de «Más» en el orden del DOM (su nombre accesible): la secuencia que se compara con la de la historia. */
export const moreSequence = (page: Page): Promise<readonly string[]> =>
  safe(() => page.getByRole('list').getByRole('link').evaluateAll((links) => links.map((link) => link.getAttribute('aria-label') ?? '')), []);

/** Fila de la pantalla «Más» por su clave (su nombre accesible es el de la historia). */
export const moreRow = (page: Page, key: string): Locator => page.getByTestId(MOVIL_DYNAMIC_TESTIDS.MORE_ITEM(key));

/** Toca una pestaña y espera a su ruta (lo que se ve tras el toque). */
export const tapTab = (page: Page, tab: TabInfo): Step => [`tocar la pestaña «${tab.full}»`, () => tabOf(page, tab).click(ACTION)];

/** Ir a «Más» y tocar una de sus filas por su clave. */
export const openFromMore = (page: Page, key: string, label: string): Promise<string | undefined> =>
  runSteps([tapTab(page, MORE), [`tocar «${label}» en Más`, () => moreRow(page, key).click(ACTION)]]);

/** Cuadro «Búsqueda global» de la pantalla móvil (campo con etiqueta visible y aria-label). */
export const searchField = (page: Page): Locator => page.getByRole('textbox', { name: 'Búsqueda global', exact: true });

/** Aviso de estado de la búsqueda (la región `status`), con plazo. */
export const searchStatus = (page: Page): Promise<string | undefined> => textOf(page.getByTestId(BUSQUEDA_TESTIDS.GLOBAL_SEARCH_STATUS));

export const groupOf = (page: Page, kind: string): Locator => page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP(kind));
export const groupTotalOf = (page: Page, kind: string): Promise<string | undefined> => textOf(page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL(kind)));
export const resultOf = (page: Page, kind: string, id: string): Locator => page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM(kind, id));
export const moreInGroup = (page: Page, kind: string): Promise<string | undefined> => textOf(page.getByTestId(MOVIL_SEARCH_DYNAMIC_TESTIDS.GROUP_MORE(kind)));
export const retryButton = (page: Page): Locator => page.getByTestId(MOVIL_SEARCH_TESTIDS.ERROR_RETRY);

/** Anota la nota de Expo web (y la de la historia, si se pasa) en el resultado de una fila móvil, sin cambiar su veredicto. */
export const expo = (handler: BrowserRowHandler, extra?: string): BrowserRowHandler => async (row, fixtures) =>
  withNote(await handler(row, fixtures), extra === undefined ? EXPO_NOTE : `${EXPO_NOTE} ${extra}`);

/** Un texto visible en la página (una sola coincidencia exacta). */
export const shownText = async (page: Page, text: string): Promise<boolean> => {
  const exact = page.getByText(text, { exact: true });
  const found = await safe(() => exact.count(), 0);
  return found === 1 && (await safe(() => exact.first().isVisible(), false));
};

/** Código de un resultado móvil: su nombre accesible empieza por el código y « · ». */
export const resultLink = (page: Page, code: string): Locator => page.getByRole('link', { name: new RegExp(`^${code} · `) });
