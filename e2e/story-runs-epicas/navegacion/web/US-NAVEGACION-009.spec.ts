import type { Locator, Page } from '@playwright/test';
import { ACCESO_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, isVisible, pathOf, runSteps, textOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { DESKTOP, actionFailed, armToasts, clickAction, noted, prepFailed, prepareWeb, signIn, topsOf, waitToast, isAscending } from './common';

// US-NAVEGACION-009 — Menú de usuario de escritorio: nombre, rol, Perfil, atajos y cierre de sesión. Preparación de cada fila:
// reinicio de alumno01, inicio de sesión con la cuenta de la fila en /login?tenant=alumno01 (navegador sin sesión) y la página.

const userButton = (page: Page): Locator => page.getByRole('button', { name: 'Menú de usuario', exact: true });
const userBox = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_USER_MENU);
const popover = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_USER_MENU_POPOVER);

/** Las tres opciones del menú: «Atajos de teclado» lleva además la marca «?», por eso su nombre se busca por inicio. */
const OPTIONS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['«Perfil»', (page) => page.getByRole('menuitem', { name: 'Perfil', exact: true })],
  ['«Atajos de teclado»', (page) => page.getByRole('menuitem', { name: /^Atajos de teclado/ })],
  ['«Cerrar sesión»', (page) => page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true })],
]);

const SHORTCUTS_BODY = 'N · nuevo programa — / · buscar — Esc · cerrar';
const LOGOUT_NOTICE = 'Sesión cerrada correctamente.';

/** Abre el menú de usuario (clic de persona) y espera a que muestre sus opciones. */
const openMenu = async (page: Page): Promise<string | undefined> => {
  const opened = await clickAction(page, userButton(page), 'abrir «Menú de usuario»');
  if (opened) return opened.note;
  const shown = await waitUntil(() => isVisible(popover(page)));
  return shown.reached ? undefined : 'el menú no se muestra tras pulsarlo';
};

// --- Esquema 1: el botón del menú de usuario muestra el nombre y el rol de la sesión -----------------------------------------

const identity: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const name = cell(row, 'nombre');
  const role = cell(row, 'rol');
  const expected = `ve el nombre ${name} y el rol ${role}; opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, account.credentials, account.tenant);
  if (failure) return prepFailed(expected, failure);
  const opened = await openMenu(page);
  if (opened) return actionFailed(expected, { message: 'no se abre «Menú de usuario»', note: opened });
  const nameShown = await isVisible(userBox(page).getByText(name, { exact: true }));
  const roleShown = await isVisible(userBox(page).getByText(role, { exact: true }));
  const tops = await topsOf([
    page.getByRole('menuitem', { name: 'Perfil', exact: true }),
    page.getByRole('menuitem', { name: /^Atajos de teclado/ }),
    page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }),
  ]);
  const roleText = (await textOf(userBox(page))) ?? '';
  return conclude([
    check(nameShown, `ve el nombre ${name}`, nameShown ? `ve el nombre ${name}` : `no ve el nombre ${name}`),
    check(roleShown, `ve el rol ${role}`, roleShown ? `ve el rol ${role}` : `no ve el rol ${role} (el botón muestra: ${roleText.split('\n').slice(0, 2).join(' / ') || '(vacío)'})`),
    check(isAscending(tops), 'las opciones «Perfil», «Atajos de teclado» y «Cerrar sesión», en ese orden', tops === undefined ? 'alguna opción no se lee' : `posiciones verticales ${tops.map((top) => String(Math.round(top))).join(' y ')}`),
  ]);
};

// --- Esquema 2: cada opción del menú de usuario hace lo suyo -------------------------------------------------------------

const EXPECTED_OPTION: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    'llega a /profile y ve la página «Perfil»',
    async (page) => {
      const arrived = await waitUntil(async () => pathOf(page) === '/profile');
      const title = await waitUntil(() => isVisible(page.getByRole('heading', { name: 'Perfil', exact: true })));
      return [
        check(arrived.reached, 'llega a /profile', arrived.reached ? 'llega a /profile' : `ruta ${pathOf(page)}`),
        check(title.reached, 've la página «Perfil»', title.reached ? 've la página «Perfil»' : 'no ve el título «Perfil»'),
      ];
    },
  ],
  [
    'sigue en /nc, ve el aviso «Atajos de teclado» con el texto «N · nuevo programa — / · buscar — Esc · cerrar» y el menú se cierra',
    async (page) => {
      const toast = await waitToast(page, 'info', 'Atajos de teclado', SHORTCUTS_BODY);
      const closed = await waitUntil(async () => !(await isVisible(popover(page))));
      return [
        check(pathOf(page) === '/nc', 'sigue en /nc', `ruta ${pathOf(page)}`),
        check(toast, `ve el aviso «Atajos de teclado» con «${SHORTCUTS_BODY}»`, toast ? `ve el aviso «Atajos de teclado» con «${SHORTCUTS_BODY}»` : 'no aparece el aviso de atajos'),
        check(closed.reached, 'el menú se cierra', closed.reached ? 'el menú se cierra' : 'el menú sigue abierto'),
      ];
    },
  ],
  [
    'llega a /login y ve el aviso «Sesión cerrada correctamente.»',
    async (page) => {
      const arrived = await waitUntil(async () => pathOf(page) === '/login');
      const notice = await waitUntil(async () => (await textOf(page.getByTestId(ACCESO_TESTIDS.LOGIN_INFO))) === LOGOUT_NOTICE);
      return [
        check(arrived.reached, 'llega a /login', arrived.reached ? 'llega a /login' : `ruta ${pathOf(page)}`),
        check(notice.reached, `ve el aviso «${LOGOUT_NOTICE}»`, notice.reached ? `ve el aviso «${LOGOUT_NOTICE}»` : `aviso ${(await textOf(page.getByTestId(ACCESO_TESTIDS.LOGIN_INFO))) ?? '(ausente)'}`),
      ];
    },
  ],
]);

const option: BrowserRowHandler = async (row, { page }) => {
  const choose = strict('opcion', OPTIONS, cell(row, 'opcion'));
  const expected = cell(row, 'resultado');
  const scene = strict('resultado', EXPECTED_OPTION, expected);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  const menu = await openMenu(page);
  if (menu) return actionFailed(expected, { message: 'no se abre «Menú de usuario»', note: menu });
  // El registro de avisos se arma justo antes de la opción: el aviso de «Atajos» debe llegar después
  await armToasts(page);
  const picked = await clickAction(page, choose(page), `elegir ${cell(row, 'opcion')}`);
  if (picked) return actionFailed(expected, picked);
  return conclude(await scene(page));
};

// --- Esquema 3: la tecla Esc o un clic fuera cierran el menú sin cambiar de página -------------------------------------------

const dismiss: BrowserRowHandler = async (row, { page }) => {
  const action = cell(row, 'accion');
  const expected = `el menú se cierra y sigue en /nc (${action})`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  const menu = await openMenu(page);
  if (menu) return actionFailed(expected, { message: 'no se abre «Menú de usuario»', note: menu });
  const act = strict('accion', new Map<string, () => Promise<string | undefined>>([
    ['pulsa la tecla Esc', () => runSteps([['pulsar la tecla Esc', () => page.keyboard.press('Escape')]])],
    // Zona vacía de la cabecera, a la derecha de las migas y a la izquierda del buscador
    ['pulsa en una zona vacía de la página', () => runSteps([['pulsar en una zona vacía', () => page.mouse.click(700, 8)]])],
  ]), action);
  const failed = await act();
  if (failed) return actionFailed(expected, { message: failed, note: 'la acción no llega a la página' });
  const closed = await waitUntil(async () => !(await isVisible(popover(page))));
  const stays = await waitUntil(async () => pathOf(page) === '/nc', 1_000);
  return conclude([
    check(closed.reached, 'el menú se cierra', closed.reached ? 'el menú se cierra' : 'el menú sigue abierto'),
    check(stays.reached, 'sigue en /nc', stays.reached ? 'sigue en /nc' : `ruta ${pathOf(page)}`),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(identity, 'Regla sin fila (no comprobada): el avatar muestra la inicial del nombre.')],
    [2, noted(option)],
    [3, noted(dismiss)],
  ]),
});
