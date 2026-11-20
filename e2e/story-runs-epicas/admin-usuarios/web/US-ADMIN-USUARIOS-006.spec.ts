import type { Page } from '@playwright/test';
import { ADMIN_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_PATH, onWeb, panelOf, resetAlumno, signInWeb, tabOf, usersTable, verdict, waitTableReady } from './common';

// US-ADMIN-USUARIOS-006 — Entrar en Administración según el rol y elegir sus pestañas (web, escritorio 1440 × 900).
// Preparación de cada fila: reinicio de alumno01 con su administrador; después se abre /login?tenant=alumno01 sin sesión guardada y la
// cuenta de la fila inicia sesión con su correo y su contraseña (la cookie de preferencia se fija antes, como en el piloto).

type TabKey = 'users' | 'audit' | 'chaos' | 'data';

/** Contraseñas de las cuentas de la historia: solo valen las del seed. */
const PASSWORDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Alumno1234!', 'Alumno1234!'],
  ['Gestor1234!', 'Gestor1234!'],
  ['Consul1234!', 'Consul1234!'],
  ['Audit1234!', 'Audit1234!'],
]);

const VISIBILITY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['ve', true],
  ['no ve', false],
]);

const TAB_CELLS: ReadonlyMap<string, { readonly key: TabKey; readonly address: string; readonly heading: string }> = new Map<string, { readonly key: TabKey; readonly address: string; readonly heading: string }>([
  ['«Auditoría»', { key: 'audit', address: '/admin?tab=audit', heading: 'Registro de auditoría' }],
  ['«Modo caos»', { key: 'chaos', address: '/admin?tab=chaos', heading: 'Modo caos' }],
  ['«Datos»', { key: 'data', address: '/admin?tab=data', heading: 'Datos del tenant' }],
  ['«Usuarios»', { key: 'users', address: '/admin', heading: 'Usuarios del tenant' }],
]);

const UNKNOWN_SECTIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['otra', '/admin?tab=otra'],
  ['AUDIT', '/admin?tab=AUDIT'],
]);

const NON_ADMIN: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

/** Ruta y query actuales de la página (sin el origen). */
const pathAndQuery = (page: Page): string => {
  try {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  } catch {
    return page.url();
  }
};

/** Pestaña seleccionada (`aria-selected`) de la sección dada, leída con un plazo. */
const selectedTab = (page: Page, key: TabKey): Promise<string | undefined> => attrOf(tabOf(page, key), 'aria-selected');

// --- Esquema 1: solo el admin ve el enlace Administración en el menú -----------------------------------------------------------

const menuLink: BrowserRowHandler = async (row, { page }) => {
  const email = cell(row, 'correo');
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const visible = strict('visibilidad', VISIBILITY, cell(row, 'visibilidad'));
  const expected = `${cell(row, 'visibilidad')} el enlace «Administración»`;
  await resetAlumno();
  const signed = await signInWeb(page, email, password);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signed}`);
  // El menú lateral de escritorio se ve a 1440 px: se espera a que esté montado (su enlace «Programas») antes de mirar «Administración»
  const sidebarReady = await waitUntil(() => isVisible(page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.NAV('programs'))));
  const link = page.getByRole('link', { name: 'Administración', exact: true });
  const count = await safe(() => link.count(), undefined);
  const shown = count === undefined ? undefined : count > 0 && (await isVisible(link));
  return verdict([
    check(sidebarReady.reached, 'el menú lateral está montado', `enlace «Programas» visible=${String(sidebarReady.reached)} (${sidebarReady.elapsedMs} ms)`),
    check(shown !== undefined && shown === visible, `${visible ? 've' : 'no ve'} el enlace «Administración»`, shown === undefined ? 'no se pudo leer el enlace «Administración»' : `enlaces «Administración» en el menú: ${String(count)}, visible=${String(shown)}`),
  ]);
};

// --- Esquema 2: elegir una pestaña muestra su sección y la dirección la recoge ------------------------------------------------

const chooseTab: BrowserRowHandler = async (row, { page }) => {
  const target = strict('pestana', TAB_CELLS, cell(row, 'pestana'));
  const expected = `la pestaña ${cell(row, 'pestana')} seleccionada, la dirección ${target.address} y la sección «${target.heading}»`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const ready = await waitTableReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la pestaña «Usuarios» no asienta su lista');
  const clicked = await runSteps([[`pulsar «${cell(row, 'pestana')}»`, () => tabOf(page, target.key).click(ACTION)]]);
  const selected = await waitUntil(async () => (await selectedTab(page, target.key)) === 'true');
  const address = await waitUntil(async () => pathAndQuery(page) === target.address);
  const headingShown = await waitUntil(() => isVisible(panelOf(page, target.key).getByRole('heading', { name: target.heading, exact: true })));
  return verdict([
    check(clicked === undefined && selected.reached, `la pestaña ${cell(row, 'pestana')} seleccionada`, clicked ?? `la pestaña ${cell(row, 'pestana')} está ${String(await selectedTab(page, target.key))}`),
    check(address.reached, `la dirección es ${target.address}`, `la dirección es ${pathAndQuery(page)}`),
    check(headingShown.reached, `la página muestra la sección «${target.heading}»`, headingShown.reached ? `la página muestra la sección «${target.heading}»` : `no se ve la sección «${target.heading}»`),
  ]);
};

// --- Esquema 3: una sección que no existe en la dirección muestra Usuarios --------------------------------------------------

const unknownSection: BrowserRowHandler = async (row, { page }) => {
  const address = strict('seccion', UNKNOWN_SECTIONS, cell(row, 'seccion'));
  const expected = `${address} muestra la pestaña «Usuarios» seleccionada y la sección «Usuarios del tenant»`;
  await resetAlumno();
  const signed = await signInWeb(page, 'alumno01@sigpro.lab');
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como alumno01@sigpro.lab: ${signed}`);
  const opened = await runSteps([[`abrir ${address}`, () => page.goto(address, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const ready = await waitTableReady(page);
  if (!ready) return preparationFailedWeb(expected, 'la pestaña «Usuarios» no asienta su lista');
  const users = await waitUntil(async () => (await selectedTab(page, 'users')) === 'true');
  const heading = await waitUntil(() => isVisible(panelOf(page, 'users').getByRole('heading', { name: 'Usuarios del tenant', exact: true })));
  return verdict([
    check(users.reached, 'la pestaña «Usuarios» seleccionada', `la pestaña «Usuarios» está ${String(await selectedTab(page, 'users'))}`),
    check(heading.reached, 'la página muestra la sección «Usuarios del tenant»', `encabezado «Usuarios del tenant» visible=${String(heading.reached)}`),
  ]);
};

// --- Esquema 4: quien no es admin abre /admin y ve el aviso sin ninguna sección ------------------------------------------------

const forbiddenFor: BrowserRowHandler = async (row, { page }) => {
  const email = strict('correo', NON_ADMIN, cell(row, 'correo'));
  const expected = `«Tu rol no permite administrar el tenant» con «Solo admin puede entrar en Administración.», sin pestañas ni sección, y «Volver a Programas» lleva a /programs`;
  await resetAlumno();
  const signed = await signInWeb(page, email);
  if (signed !== undefined) return preparationFailedWeb(expected, `iniciar sesión como ${email}: ${signed}`);
  const opened = await runSteps([['abrir /admin', () => page.goto(ADMIN_PATH, { timeout: CEILING_MS })]]);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const notice = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN);
  const shown = await waitUntil(() => isVisible(notice));
  if (!shown.reached) return preparationFailedWeb(expected, 'el aviso de rol no aparece en /admin');
  const title = await safe(() => notice.getByRole('heading', { level: 1, name: 'Tu rol no permite administrar el tenant', exact: true }).count(), 0);
  const explanation = await textOf(notice.locator('p'));
  const tabs = await safe(() => page.getByTestId(ADMIN_TESTIDS.ADMIN_TABS).count(), undefined);
  const panels = await safe(() => page.locator('[data-testid^="admin-panel-"]').count(), undefined);
  const table = await safe(() => usersTable(page).count(), undefined);
  const back = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK);
  const backText = await textOf(back);
  const clicked = await runSteps([['pulsar «Volver a Programas»', () => back.click(ACTION)]]);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === '/programs');
  return verdict([
    check(title === 1, 'el aviso tiene el título «Tu rol no permite administrar el tenant»', `encabezados de nivel 1 con ese texto dentro del aviso: ${String(title)}`),
    check(explanation === 'Solo admin puede entrar en Administración.', 'la explicación «Solo admin puede entrar en Administración.»', `la explicación es «${explanation ?? '(sin texto)'}»`),
    check(tabs === 0 && panels === 0 && table === 0, 'no ve pestañas ni ninguna sección de Administración', `pestañas ${String(tabs)}, paneles ${String(panels)}, tabla ${String(table)}`),
    check(clicked === undefined && backText === 'Volver a Programas' && arrived.reached, 'el enlace «Volver a Programas» lleva a /programs', `el enlace dice «${backText ?? '(sin texto)'}» y la página acaba en ${pathAndQuery(page)}`),
  ]);
};


defineBrowserRows({
  story: 'US-ADMIN-USUARIOS-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(menuLink)],
    [2, onWeb(chooseTab)],
    [3, onWeb(unknownSection)],
    [4, onWeb(forbiddenFor)],
  ]),
});
