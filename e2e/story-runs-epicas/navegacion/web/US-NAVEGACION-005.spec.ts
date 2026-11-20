import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, isVisible, quoted, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { DESKTOP, DESKTOP_ASIDE, actionFailed, clickAction, crumbsOf, navEntries, noted, prepFailed, prepareWeb, signIn } from './common';

// US-NAVEGACION-005 — Diseño de escritorio desde 1024 px, barra plegable y migas de pan. Preparación de cada fila: reinicio de
// alumno01, inicio de sesión con la cuenta de la fila en /login?tenant=alumno01 (navegador sin sesión) y la página de la fila.

type Design = 'escritorio' | 'responsive';

/** Diseño que describe cada fila de la columna «diseno» de la primera tabla. */
const DESIGN: ReadonlyMap<string, Design> = new Map<string, Design>([
  ['el diseño responsive, sin barra lateral fija y con el botón «Menú» en la cabecera', 'responsive'],
  ['el diseño de escritorio, con la barra lateral fija y la cabecera con migas de pan', 'escritorio'],
]);

const WIDTH: ReadonlyMap<string, number> = new Map<string, number>([
  ['1023', 1023],
  ['1024', 1024],
  ['1440', 1440],
]);

/** Control que pliega la barra (la columna «control» de la tercera tabla). */
const CONTROL: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['Contraer barra lateral', (page) => page.getByRole('button', { name: 'Contraer barra lateral', exact: true })],
  ['Menú', (page) => page.getByRole('button', { name: 'Menú', exact: true })],
]);

/** Qué se ve en la pantalla: el diseño de escritorio (barra fija y migas) o el responsive (botón «Menú», sin barra fija). */
const observedDesign = async (page: Page): Promise<Design | 'indeterminado'> => {
  const sidebar = await isVisible(page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR));
  const crumbs = await isVisible(page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_BREADCRUMBS));
  const menu = await isVisible(page.getByRole('button', { name: 'Menú', exact: true }));
  if (sidebar && crumbs) return 'escritorio';
  if (!sidebar && !crumbs && menu) return 'responsive';
  return 'indeterminado';
};

// --- Esquema 1: el diseño de escritorio empieza en 1024 px de ancho ---------------------------------------------------------

const breakpoint: BrowserRowHandler = async (row, { page }) => {
  const width = strict('ancho', WIDTH, cell(row, 'ancho'));
  const design = strict('diseno', DESIGN, cell(row, 'diseno'));
  const expected = `ve ${cell(row, 'diseno')}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const resized = await runSteps([['cambiar el ancho de la ventana', () => page.setViewportSize({ width, height: 900 })]]);
  if (resized) return actionFailed(expected, { message: resized, note: 'el cambio de ancho no se aplica' });
  await waitUntil(async () => (await observedDesign(page)) === design);
  const seen = await observedDesign(page);
  return conclude([check(seen === design, `el diseño ${design}`, `el diseño ${seen}`)]);
};

// --- Esquema 2: las migas muestran la sección y el elemento en el que está la persona ---------------------------------------

const crumbs: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const route = cell(row, 'ruta');
  const expected = cell(row, 'migas');
  const wanted = expected.split(' / ');
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, account.credentials, account.tenant);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([[`abrir ${route}`, () => page.goto(route, { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la ruta no abre' });
  await waitUntil(async () => ((await crumbsOf(page)) ?? []).length > 0);
  const seen = (await crumbsOf(page)) ?? [];
  return conclude([check(seen.length === wanted.length && wanted.every((label, index) => seen[index] === label), `migas ${expected}`, `migas ${seen.join(' / ') || '(no legibles)'}`)]);
};

// --- Esquema 3: el control de plegado alterna la barra entre desplegada y plegada ---------------------------------------------

type BarState = 'desplegada' | 'plegada' | 'indeterminado';

/** La barra está desplegada si cada entrada muestra su nombre; plegada, si solo muestra el icono (sin nombre). */
const barState = async (page: Page): Promise<BarState> => {
  const entries = await navEntries(page, DESKTOP_ASIDE);
  if (entries.length === 0) return 'indeterminado';
  const named = entries.every((entry) => (entry.title ?? '') !== '' && entry.text.includes(entry.title ?? '\u0000'));
  const iconsOnly = entries.every((entry) => entry.text.trim() !== '' && !entry.text.includes(entry.title ?? '\u0000'));
  if (named) return 'desplegada';
  return iconsOnly ? 'plegada' : 'indeterminado';
};

const foldsAndUnfolds: BrowserRowHandler = async (row, { page }) => {
  const control = strict('control', CONTROL, quoted(cell(row, 'control')));
  const expected = `pulsa «${quoted(cell(row, 'control'))}»: la barra se pliega; y otra vez: se despliega`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  await waitUntil(async () => (await barState(page)) === 'desplegada');
  const before = await barState(page);
  const first = await clickAction(page, control(page), `pulsar «${quoted(cell(row, 'control'))}»`);
  if (first) return actionFailed(expected, first);
  const folded = await waitUntil(async () => (await barState(page)) === 'plegada');
  const second = await clickAction(page, control(page), `pulsar «${quoted(cell(row, 'control'))}» otra vez`);
  if (second) return actionFailed(expected, second);
  const unfolded = await waitUntil(async () => (await barState(page)) === 'desplegada');
  const checks: Check[] = [
    check(before === 'desplegada', 'la barra está desplegada al entrar', `la barra está ${before}`),
    check(folded.reached, 'la barra se pliega y solo muestra los iconos', `la barra queda ${await barState(page)}`),
    check(unfolded.reached, 'la barra se despliega y muestra el nombre de cada entrada', `la barra queda ${await barState(page)} tras la segunda pulsación`),
  ];
  return conclude(checks);
};

defineBrowserRows({
  story: 'US-NAVEGACION-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(breakpoint)],
    [2, noted(crumbs, 'Reglas sin fila (no comprobadas): la barra plegada no muestra la insignia y conserva los nombres como enlace; plegar no cambia la sección; «Inicio» lleva a /.')],
    [3, noted(foldsAndUnfolds, 'Reglas sin fila (no comprobadas): plegar no cambia la sección ni la dirección.')],
  ]),
});
