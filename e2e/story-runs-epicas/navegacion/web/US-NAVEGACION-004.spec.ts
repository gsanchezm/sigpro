import type { Page } from '@playwright/test';
import { MISION_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, runSteps, textOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { DESKTOP, DESKTOP_ASIDE, actionFailed, navEntries, noted, prepFailed, prepareWeb, signIn } from './common';

// US-NAVEGACION-004 — Barra lateral de escritorio por rol, página actual e insignia de No conformidades. Preparación de cada
// fila: reinicio de alumno01, /login?tenant=alumno01 en un navegador sin sesión e inicio de sesión con la cuenta de la fila.

/** Las nueve entradas de la barra, en el orden de la historia (la lista completa, antes de quitar las que el rol no ve). */
const ENTRY_ORDER = ['Panel de misión', 'Programas', 'Requisitos', 'Verificación', 'No conformidades', 'Documentos', 'Auditoría', 'Administración', 'Lab'] as const;

const COUNT: ReadonlyMap<string, number> = new Map<string, number>([
  ['9', 9],
  ['8', 8],
  ['7', 7],
]);

const HIDDEN: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['(ninguna)', []],
  ['Administración', ['Administración']],
  ['Auditoría y Administración', ['Auditoría', 'Administración']],
]);

/** Entrada marcada como página actual (la columna «entrada»); «(ninguna)» si la página no es de la barra. */
const CURRENT: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['Programas', ['Programas']],
  ['Requisitos', ['Requisitos']],
  ['Verificación', ['Verificación']],
  ['No conformidades', ['No conformidades']],
  ['Documentos', ['Documentos']],
  ['(ninguna)', []],
]);

const BADGE: ReadonlyMap<string, string> = new Map<string, string>([['8', '8']]);

const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);

/** Espera a que la barra lateral tenga entradas (la página ya cargó) y las lee. */
const barEntries = async (page: Page) => {
  await waitUntil(async () => (await navEntries(page, DESKTOP_ASIDE)).length > 0);
  return navEntries(page, DESKTOP_ASIDE);
};

// --- Esquema 1: cada rol ve sus entradas y las que no ve son las de otros roles ----------------------------------------------

const sees: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const count = strict('cantidad', COUNT, cell(row, 'cantidad'));
  const hidden = strict('ocultas', HIDDEN, cell(row, 'ocultas'));
  const expected = `${cell(row, 'cantidad')} entradas en el orden de la lista; ocultas: ${cell(row, 'ocultas')}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, account.credentials, account.tenant);
  if (failure) return prepFailed(expected, failure);
  const titles = (await barEntries(page)).map((entry) => entry.title ?? '');
  const wanted = ENTRY_ORDER.filter((name) => !hidden.includes(name));
  const checks: Check[] = [
    check(titles.length === count, `${String(count)} entradas`, `${String(titles.length)} entradas`),
    check(sameList(titles, wanted), `en orden: ${wanted.join(', ')}`, `en orden: ${titles.join(', ') || '(ninguna)'}`),
    ...hidden.map((name) => check(!titles.includes(name), `no ve «${name}»`, titles.includes(name) ? `ve «${name}»` : `no ve «${name}»`)),
  ];
  return conclude(checks);
};

// --- Esquema 2: la entrada de la sección en la que está queda marcada como página actual ------------------------------------

const marked: BrowserRowHandler = async (row, { page }) => {
  const route = cell(row, 'ruta');
  const wanted = strict('entrada', CURRENT, cell(row, 'entrada'));
  const expected = `la única entrada marcada como página actual es ${cell(row, 'entrada')}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([[`abrir ${route}`, () => page.goto(route, { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la ruta no abre' });
  const current = (await barEntries(page)).filter((entry) => entry.current).map((entry) => entry.title ?? '');
  return conclude([check(sameList(current, wanted), `marcada: ${wanted.join(', ') || '(ninguna)'}`, `marcadas: ${current.join(', ') || '(ninguna)'}`)]);
};

// --- Esquema 3: la insignia de No conformidades cuenta las abiertas del tenant -----------------------------------------------

const badgeCount: BrowserRowHandler = async (row, { page }) => {
  const expectedBadge = strict('cifra', BADGE, cell(row, 'cifra'));
  const expected = `la insignia muestra ${expectedBadge}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const badge = page.getByTestId(MISION_DYNAMIC_TESTIDS.NAV_BADGE('nc'));
  await waitUntil(async () => (await textOf(badge)) === expectedBadge);
  const text = await textOf(badge);
  return conclude([check(text === expectedBadge, `insignia ${expectedBadge}`, text === undefined ? 'sin insignia' : `insignia ${text}`)]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(sees)],
    [2, noted(marked)],
    [3, noted(badgeCount)],
  ]),
});
