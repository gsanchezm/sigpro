import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, pathOf, quoted, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { prepareWeb } from '../web/common';
import { MORE, MOBILE, moreRow, expo, openFromMore, signInMobile, tabActive, tabOf, tapTab, TABS, type TabInfo } from './common';

/** La pestaña «Programas» (su nombre completo y su ruta). */
const PROGRAMS: TabInfo = { key: 'programs', full: 'Programas', route: '/programs' };

// US-NAVEGACION-011 — Pestañas inferiores y menú «Más» según el rol (app móvil, Expo web a 390 × 844). Preparación de cada fila:
// reinicio de alumno01 y, después, inicio de sesión en la app con la cuenta de la fila y «alumno01» en «Tenant de trabajo».

/** Filas de «Más» por rol: su texto (en el orden de la historia) y las claves de cada fila. */
const ROWS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Búsqueda global', 'search'],
  ['Documentos', 'documents'],
  ['Auditoría', 'audit'],
  ['Administración', 'admin'],
  ['Perfil', 'profile'],
  ['Ayuda', 'help'],
  ['Condiciones', 'terms'],
  ['Privacidad', 'privacy'],
]);

const VISIBLE: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['Búsqueda global, Documentos, Auditoría, Administración, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Auditoría', 'Administración', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
  ['Búsqueda global, Documentos, Auditoría, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Auditoría', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
  ['Búsqueda global, Documentos, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
]);

const HIDDEN: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['(ninguna)', []],
  ['«Administración»', ['Administración']],
  ['«Auditoría» y «Administración»', ['Auditoría', 'Administración']],
]);

const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);

/** Filas de «Más» que se ven ahora, en el orden de la historia. */
const rowsShown = async (page: Page): Promise<readonly string[]> => {
  const shown: string[] = [];
  for (const [label, key] of ROWS) {
    if ((await moreRow(page, key).count()) === 1) shown.push(label);
  }
  return shown;
};

// --- Esquema 1: la pantalla «Más» muestra las filas que corresponden al rol --------------------------------------------------

const moreRows: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const visible = strict('filas', VISIBLE, cell(row, 'filas'));
  const hidden = strict('ocultas', HIDDEN, cell(row, 'ocultas'));
  const expected = `ve las filas ${cell(row, 'filas')}; no ve ${cell(row, 'ocultas')}`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, account.credentials);
  if (failure) return outcome(false, expected, failure, { note: 'La preparación de sesión no se cumplió.' });
  const opened = await runSteps([tapTab(page, MORE)]);
  if (opened) return outcome(false, expected, opened, { note: 'La historia nombra la pestaña «Más» y la app no la ofrece.' });
  await waitUntil(() => isVisible(moreRow(page, 'search')));
  const shown = await rowsShown(page);
  const checks: Check[] = [
    check(sameList(shown, visible), `filas: ${visible.join(', ')}`, `filas: ${shown.join(', ') || '(ninguna)'}`),
    ...hidden.map((label) => check(!shown.includes(label), `no ve «${label}»`, shown.includes(label) ? `ve «${label}»` : `no ve «${label}»`)),
  ];
  return conclude(checks);
};

// --- Esquema 2: cada pestaña lleva a su sección y queda marcada como activa ------------------------------------------------

const tabs: BrowserRowHandler = async (row, { page }) => {
  const tab: TabInfo = strict('pestana', TABS, quoted(cell(row, 'pestana')));
  const route = cell(row, 'ruta');
  const label = cell(row, 'pestana');
  const expected = `llega a ${route} y la pestaña ${label} queda marcada como activa`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, DEMO.gestor);
  if (failure) return outcome(false, expected, failure, { note: 'La preparación de sesión no se cumplió.' });
  const tapped = await runSteps([tapTab(page, tab)]);
  if (tapped) return outcome(false, expected, tapped, { note: 'La historia nombra una pestaña que la app no ofrece.' });
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const active = await waitUntil(() => tabActive(page, tab), 2_000);
  return conclude([
    check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `llega a ${pathOf(page)}`),
    check(active.reached, `la pestaña ${label} queda marcada como activa`, active.reached ? `la pestaña ${label} queda marcada como activa` : `la pestaña ${label} no queda marcada (aria-selected)`),
  ]);
};

// --- Esquema 3: tocar una fila de «Más» abre su página dentro de «Más» ------------------------------------------------------

const ROUTE_OF_ROW: ReadonlyMap<string, { readonly key: string; readonly route: string }> = new Map<string, { readonly key: string; readonly route: string }>([
  ['Documentos', { key: 'documents', route: '/documents' }],
  ['Perfil', { key: 'profile', route: '/profile' }],
  ['Ayuda', { key: 'help', route: '/help' }],
  ['Privacidad', { key: 'privacy', route: '/legal/privacy' }],
  ['Auditoría', { key: 'audit', route: '/audit' }],
  ['Administración', { key: 'admin', route: '/admin' }],
]);

const insideMore: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const target = strict('fila', ROUTE_OF_ROW, quoted(cell(row, 'fila')));
  const route = cell(row, 'ruta');
  const expected = `toca «${quoted(cell(row, 'fila'))}»: llega a ${route}; la barra inferior sigue visible con «Más» marcada`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, account.credentials);
  if (failure) return outcome(false, expected, failure, { note: 'La preparación de sesión no se cumplió.' });
  const opened = await runSteps([tapTab(page, MORE)]);
  if (opened) return outcome(false, expected, opened, { note: 'La pestaña «Más» no se abre.' });
  await waitUntil(() => isVisible(moreRow(page, 'search')));
  const tapped = await runSteps([[`tocar «${quoted(cell(row, 'fila'))}»`, () => moreRow(page, target.key).click(ACTION)]]);
  if (tapped) return outcome(false, expected, tapped, { note: 'La historia nombra una fila de «Más» que la app no ofrece.' });
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const bar = await waitUntil(() => isVisible(tabOf(page, MORE)));
  const active = await waitUntil(() => tabActive(page, MORE), 2_000);
  return conclude([
    check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `llega a ${pathOf(page)}`),
    check(bar.reached, 'la barra inferior sigue visible', bar.reached ? 'la barra inferior sigue visible' : 'la barra inferior no se ve en esta página'),
    check(active.reached, 'la pestaña «Más» marcada', active.reached ? 'la pestaña «Más» marcada' : 'la pestaña «Más» no queda marcada'),
  ]);
};

// --- Esquema 4: tocar «Más» desde otra pestaña muestra el menú y no la última página abierta -----------------------------

const backToMore: BrowserRowHandler = async (row, { page }) => {
  const section = quoted(cell(row, 'seccion'));
  const target = strict('seccion', ROUTE_OF_ROW, section);
  const route = cell(row, 'ruta');
  const expected = `toca «Más»: llega a ${route} y ve la pantalla «Más» con sus filas`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, DEMO.gestor);
  if (failure) return outcome(false, expected, failure, { note: 'La preparación de sesión no se cumplió.' });
  const opened = await openFromMore(page, target.key, section);
  if (opened) return outcome(false, expected, opened, { note: 'No se abre la sección desde «Más».' });
  const back = await runSteps([tapTab(page, PROGRAMS)]);
  if (back) return outcome(false, expected, back, { note: 'La pestaña «Programas» no se toca.' });
  await waitUntil(async () => pathOf(page) === PROGRAMS.route);
  const again = await runSteps([tapTab(page, MORE)]);
  if (again) return outcome(false, expected, again, { note: 'La pestaña «Más» no se toca.' });
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const rows = await waitUntil(() => isVisible(moreRow(page, 'search')));
  return conclude([
    check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `llega a ${pathOf(page)}`),
    check(rows.reached, 've la pantalla «Más» con sus filas', rows.reached ? 've la pantalla «Más» con sus filas' : 'no ve las filas de «Más»'),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, expo(moreRows)],
    [2, expo(tabs)],
    [3, expo(insideMore)],
    [4, expo(backToMore)],
  ]),
});
