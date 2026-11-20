import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS, RESPONSIVE_DYNAMIC_TESTIDS, RESPONSIVE_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, isFocused, isVisible, pathOf, quoted, runSteps, textOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { DRAWER_ASIDE, RESPONSIVE, actionFailed, clickAction, navEntries, noted, prepFailed, prepareWeb, signIn, topsOf, isAscending } from './common';

// US-NAVEGACION-006 — Cajón de navegación del diseño responsive (390 px). Preparación de cada fila: reinicio de alumno01, inicio
// de sesión con la cuenta de la fila en /login?tenant=alumno01 con una ventana de 390 px, y la página de la fila.

/** Las claves de las entradas de la barra (para comprobar que, cerrado, no queda ninguna en la página). */
const ALL_KEYS = ['mission', 'programs', 'requirements', 'verification', 'nc', 'documents', 'audit', 'admin', 'lab'] as const;

const menuButton = (page: Page): Locator => page.getByRole('button', { name: 'Menú', exact: true });
const drawer = (page: Page): Locator => page.getByRole('complementary', { name: 'Navegación principal', exact: true });
const scrim = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_DRAWER_SCRIM);
/** Botón de cierre del cajón: se localiza por su id dentro del cajón (su nombre es una decisión pendiente de la historia). */
const closeButton = (page: Page): Locator => page.getByTestId(RESPONSIVE_TESTIDS.LAYOUT_SIDEBAR_COLLAPSE);

/** Lo que cada fila hace antes de mirar: la acción sobre «Menú» y el cajón (la columna «accion»). */
type Action = (page: Page) => Promise<{ readonly message: string; readonly note: string } | undefined>;

const openDrawer: Action = (page) => clickAction(page, menuButton(page), 'pulsar «Menú»');

const ACTIONS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['pulsa «Menú»', openDrawer],
  [
    'pulsa «Menú» y después el botón de cierre del cajón',
    async (page) => (await openDrawer(page)) ?? clickAction(page, closeButton(page), 'pulsar el botón de cierre del cajón'),
  ],
  [
    'pulsa «Menú» y después la tecla Esc',
    async (page) => {
      const opened = await openDrawer(page);
      if (opened) return opened;
      return runSteps([['pulsar la tecla Esc', () => page.keyboard.press('Escape')]]).then((failure) => (failure === undefined ? undefined : { message: failure, note: 'la tecla Esc no llega a la página' }));
    },
  ],
  [
    'pulsa «Menú» y después la zona oscura que queda fuera del cajón',
    async (page) => {
      const opened = await openDrawer(page);
      if (opened) return opened;
      // El velo cubre toda la pantalla: el clic cae a la derecha del cajón (280 px), fuera de él
      const failure = await runSteps([['pulsar la zona oscura fuera del cajón', () => scrim(page).click({ position: { x: 360, y: 400 }, timeout: CEILING_MS })]]);
      return failure === undefined ? undefined : { message: failure, note: 'la zona oscura no recibe el clic' };
    },
  ],
]);

const drawerGone = (page: Page): Promise<boolean> => waitUntil(async () => !(await isVisible(drawer(page)))).then((result) => result.reached);

/** Cuántas entradas de la barra hay en la página (cualquier clave); 0 cuando el cajón está cerrado. */
const entriesInPage = async (page: Page): Promise<number> => {
  let total = 0;
  for (const key of ALL_KEYS) total += await page.getByTestId(RESPONSIVE_DYNAMIC_TESTIDS.NAV(key)).count();
  return total;
};

// Lo que cada fila de «resultado» exige después de la acción.
const RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    've el cajón con «Navegación principal» y sus 7 entradas',
    async (page) => {
      await waitUntil(() => isVisible(drawer(page)));
      const entries = await navEntries(page, DRAWER_ASIDE);
      return [
        check(await isVisible(drawer(page)), 've el cajón «Navegación principal»', (await isVisible(drawer(page))) ? 've el cajón «Navegación principal»' : 'no ve el cajón'),
        check(entries.length === 7, '7 entradas', `${String(entries.length)} entradas`),
      ];
    },
  ],
  [
    'el cajón se cierra y no queda ninguna entrada del menú en la página',
    async (page) => {
      const closed = await drawerGone(page);
      const left = await entriesInPage(page);
      return [check(closed, 'el cajón se cierra', closed ? 'el cajón se cierra' : 'el cajón sigue abierto'), check(left === 0, 'ninguna entrada del menú en la página', `${String(left)} entradas en la página`)];
    },
  ],
  [
    'el cajón se cierra y el foco vuelve a «Menú»',
    async (page) => {
      const closed = await drawerGone(page);
      const focused = await waitUntil(() => isFocused(menuButton(page)), 1_000);
      return [check(closed, 'el cajón se cierra', closed ? 'el cajón se cierra' : 'el cajón sigue abierto'), check(focused.reached, 'el foco vuelve a «Menú»', focused.reached ? 'el foco vuelve a «Menú»' : 'el foco no está en «Menú»')];
    },
  ],
  ['el cajón se cierra', async (page) => [check(await drawerGone(page), 'el cajón se cierra', (await isVisible(drawer(page))) ? 'el cajón sigue abierto' : 'el cajón se cierra')]],
]);

// --- Esquema 1: el cajón se abre con «Menú» y se cierra de cuatro maneras ----------------------------------------------------

const closeWays: BrowserRowHandler = async (row, { page }) => {
  const action = strict('accion', ACTIONS, cell(row, 'accion'));
  const result = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await prepareWeb(page, RESPONSIVE);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const acted = await action(page);
  if (acted) return actionFailed(expected, acted);
  return conclude(await result(page));
};

// --- Esquema 2: elegir una entrada lleva a su sección y cierra el cajón --------------------------------------------------

const choose: BrowserRowHandler = async (row, { page }) => {
  const label = quoted(cell(row, 'entrada'));
  const route = cell(row, 'ruta');
  const expected = `elige «${label}»: llega a ${route} y el cajón se cierra`;
  await prepareWeb(page, RESPONSIVE);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await openDrawer(page);
  if (opened) return actionFailed(expected, opened);
  const link = drawer(page).getByRole('link', { name: label, exact: true });
  const chosen = await clickAction(page, link, `elegir «${label}»`);
  if (chosen) return actionFailed(expected, chosen);
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const closed = await drawerGone(page);
  return conclude([
    check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `no llega a ${route} (ruta ${pathOf(page)})`),
    check(closed, 'el cajón se cierra', closed ? 'el cajón se cierra' : 'el cajón sigue abierto'),
  ]);
};

// --- Esquema 3: el pie del cajón muestra la sesión y sus tres opciones -----------------------------------------------------

const footer: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const name = cell(row, 'nombre');
  const role = cell(row, 'rol');
  const expected = `pie del cajón: ${name} y ${role}; opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden`;
  await prepareWeb(page, RESPONSIVE);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, account.credentials, account.tenant);
  if (failure) return prepFailed(expected, failure);
  const opened = await openDrawer(page);
  if (opened) return actionFailed(expected, opened);
  const group = page.getByTestId(RESPONSIVE_TESTIDS.LAYOUT_USER_MENU);
  await waitUntil(() => isVisible(group));
  const profile = group.getByRole('link', { name: 'Perfil', exact: true });
  const shortcuts = group.getByRole('button', { name: 'Atajos de teclado', exact: true });
  const logout = group.getByRole('button', { name: 'Cerrar sesión', exact: true });
  const tops = await topsOf([profile, shortcuts, logout]);
  const nameShown = await isVisible(group.getByText(name, { exact: true }));
  const roleShown = await isVisible(group.getByText(role, { exact: true }));
  const roleText = (await textOf(group)) ?? '';
  return conclude([
    check(nameShown, `ve el nombre ${name}`, nameShown ? `ve el nombre ${name}` : `no ve el nombre ${name}`),
    check(roleShown, `ve el rol ${role}`, roleShown ? `ve el rol ${role}` : `no ve el rol ${role} (texto del pie: ${roleText.split('\n').slice(0, 3).join(' / ')})`),
    check(isAscending(tops), 'opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden', tops === undefined ? 'alguna opción no se lee' : `posiciones verticales ${tops.map((top) => String(Math.round(top))).join(' y ')}`),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(closeWays)],
    [2, noted(choose)],
    [3, noted(footer)],
  ]),
});
