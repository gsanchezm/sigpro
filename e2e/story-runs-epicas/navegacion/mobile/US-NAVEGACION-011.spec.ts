import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { attrOf, isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS } from '../api/common';
import { actionFailed, clickAction, prepareWeb } from '../web/common';
import { MORE, MOBILE, TABS, expo, moreReached, moreRow, moreSequence, openFromMore, signInMobile, tabActive, tabOf, type TabInfo } from './common';

// US-NAVEGACION-011 — Pestañas inferiores y menú «Más» según el rol (app móvil, Expo web a 390 × 844). Preparación de cada fila:
// reinicio de alumno01 y, después, inicio de sesión en la app con la cuenta de la fila y «alumno01» en «Tenant de trabajo».

/** La pestaña «Programas» (su nombre completo y su ruta). */
const PROGRAMS: TabInfo = { key: 'programs', full: 'Programas', route: '/programs' };

/** Filas que ve cada rol (la columna «filas»); el orden es el de la historia y el del DOM. */
const VISIBLE: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['Búsqueda global, Documentos, Auditoría, Administración, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Auditoría', 'Administración', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
  ['Búsqueda global, Documentos, Auditoría, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Auditoría', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
  ['Búsqueda global, Documentos, Perfil, Ayuda, Condiciones y Privacidad', ['Búsqueda global', 'Documentos', 'Perfil', 'Ayuda', 'Condiciones', 'Privacidad']],
]);

/** Filas que NO ve cada rol (la columna «ocultas»). */
const HIDDEN: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['(ninguna)', []],
  ['«Administración»', ['Administración']],
  ['«Auditoría» y «Administración»', ['Auditoría', 'Administración']],
]);

/** Reglas de la historia que ninguna fila comprueba (se anotan). */
const RULES = 'Regla sin fila (no comprobada): las cinco pestañas aparecen para todos los roles; «Requisitos» no está en la barra (decisión pendiente).';

const sameList = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && left.every((value, index) => value === right[index]);

// --- Esquema 1: la pantalla «Más» muestra las filas que corresponden al rol --------------------------------------------------

const moreRows: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const visible = strict('filas', VISIBLE, cell(row, 'filas'));
  const hidden = strict('ocultas', HIDDEN, cell(row, 'ocultas'));
  const expected = `ve las filas ${cell(row, 'filas')}; no ve ${cell(row, 'ocultas')}`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, account.credentials);
  if (failure) return preparationFailedWeb(expected, failure);
  const opened = await clickAction(page, tabOf(page, MORE), 'tocar la pestaña «Más»');
  if (opened) return actionFailed(expected, opened);
  // Antes de leer: la pantalla «Más» debe estar alcanzada (contenedor visible y pestaña «Más» seleccionada). Si no, la fila no
  // llegó a lo que mide: notExecutable con el diagnóstico, nunca discrepa.
  const reached = await waitUntil(() => moreReached(page), 5_000);
  if (!reached.reached)
    return actionFailed(expected, {
      message: 'la prueba no llegó a la pantalla «Más»',
      note: `el contenedor de «Más» no se ve o la pestaña «Más» no queda seleccionada (ruta ${pathOf(page)})`,
      kind: 'not-rendered',
      evidence: { ruta: pathOf(page) },
    });
  // La secuencia se lee solo dentro de la pantalla «Más» (su orden en el DOM) y se compara entera, no solo por presencia
  const sequence = await moreSequence(page);
  const checks: Check[] = [
    check(sameList(sequence, visible), `filas en orden: ${visible.join(', ')}`, `filas en pantalla: ${sequence.join(', ') || '(ninguna)'}`),
    ...hidden.map((label) => check(!sequence.includes(label), `no ve «${label}»`, sequence.includes(label) ? `ve «${label}»` : `no ve «${label}»`)),
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
  if (failure) return preparationFailedWeb(expected, failure);
  const tapped = await clickAction(page, tabOf(page, tab), `tocar la pestaña ${label}`);
  if (tapped) return actionFailed(expected, tapped);
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const active = await waitUntil(() => tabActive(page, tab), 2_000);
  // La fila de «Programas» parte ya de /programs: su llegada no prueba nada, solo la marca activa
  const extra = tab.key === 'programs' ? { note: 'La fila parte ya de /programs: solo prueba la marca activa, no la llegada.' } : {};
  return conclude(
    [
      check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `llega a ${pathOf(page)}`),
      check(active.reached, `la pestaña ${label} queda marcada como activa`, active.reached ? `la pestaña ${label} queda marcada como activa` : `la pestaña ${label} no queda marcada (visible y aria-selected)`),
    ],
    extra,
  );
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
  const label = quoted(cell(row, 'fila'));
  const target = strict('fila', ROUTE_OF_ROW, label);
  const route = cell(row, 'ruta');
  const expected = `toca «${label}»: llega a ${route}; la barra inferior sigue visible con «Más» marcada`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, account.credentials);
  if (failure) return preparationFailedWeb(expected, failure);
  const opened = await clickAction(page, tabOf(page, MORE), 'tocar la pestaña «Más»');
  if (opened) return actionFailed(expected, opened);
  const reachedMore = await waitUntil(() => moreReached(page), 5_000);
  if (!reachedMore.reached)
    return actionFailed(expected, { message: 'la prueba no llegó a la pantalla «Más»', note: `la pantalla «Más» no está alcanzada antes de tocar «${label}» (ruta ${pathOf(page)})`, kind: 'not-rendered' });
  const tapped = await clickAction(page, moreRow(page, target.key), `tocar «${label}»`);
  if (tapped) return actionFailed(expected, tapped);
  const arrived = await waitUntil(async () => pathOf(page) === route);
  const bar = await waitUntil(() => isVisible(tabOf(page, MORE)));
  // Si la barra no se ve, la pestaña «Más» puede seguir en el DOM: se anota su estado para que el veredicto sea legible
  const hiddenState = bar.reached ? undefined : `pestaña «Más» en el DOM con aria-selected=${String(await attrOf(tabOf(page, MORE), 'aria-selected'))}`;
  const active = await waitUntil(() => tabActive(page, MORE), 2_000);
  return conclude([
    check(arrived.reached, `llega a ${route}`, arrived.reached ? `llega a ${route}` : `llega a ${pathOf(page)}`),
    check(bar.reached, 'la barra inferior sigue visible', bar.reached ? 'la barra inferior sigue visible' : `la barra inferior no se ve en esta página (${hiddenState ?? ''})`),
    check(active.reached, 'la pestaña «Más» marcada', active.reached ? 'la pestaña «Más» marcada' : `la pestaña «Más» no queda marcada (visible: ${bar.reached ? 'sí' : 'no'})`),
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
  if (failure) return preparationFailedWeb(expected, failure);
  const opened = await openFromMore(page, target.key, section);
  if (opened) return actionFailed(expected, { message: opened, note: 'No se abre la sección desde «Más».' });
  const back = await clickAction(page, tabOf(page, PROGRAMS), 'tocar la pestaña «Programas»');
  if (back) return actionFailed(expected, back);
  // Estado previo que la historia da por hecho: la fila debe estar en /programs antes de volver a tocar «Más»
  const onPrograms = await waitUntil(async () => pathOf(page) === PROGRAMS.route);
  if (!onPrograms.reached) return preparationFailedWeb(expected, `tocar «Programas» no lleva a /programs (ruta ${pathOf(page)})`);
  const again = await clickAction(page, tabOf(page, MORE), 'tocar la pestaña «Más»');
  if (again) return actionFailed(expected, again);
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
    [1, expo(moreRows, RULES)],
    [2, expo(tabs, RULES)],
    [3, expo(insideMore, RULES)],
    [4, expo(backToMore, RULES)],
  ]),
});
