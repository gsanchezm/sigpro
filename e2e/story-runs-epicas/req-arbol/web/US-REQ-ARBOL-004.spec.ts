import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, countText, eq, interact, listOf, onWeb, openPath, quotedOr, sameSet, signIn, textOf, toggleOf, visibleCodes } from './common';

// US-REQ-ARBOL-004 — Buscar en el árbol por código o título y filtrar por estado (web). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador, inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 (contexto sin sesión) y llegada a Programas.

const prepare = async (page: Page, width = '1440 px'): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, DEMO.gestor, width);
};

/** Campo «Buscar requisitos» (rol de búsqueda con su nombre accesible). */
const search = (page: Page) => page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true });
/** Filtro «Estado» (selección única con su etiqueta). */
const stateFilter = (page: Page) => page.getByLabel('Estado', { exact: true });
/** Aviso de «Sin coincidencias» (su bloque de id de prueba: el aviso no tiene otro rastro propio). */
const noMatch = (page: Page) => page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NO_MATCH);

/** Texto de búsqueda: exacto, sin normalizar (la historia escribe lo que escribe). */
const TEXTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['005', '005'],
  ['req-012', 'req-012'],
  ['disponibilidad', 'disponibilidad'],
  ['nominales', 'nominales'],
  ['REQ-099', 'REQ-099'],
  ['017', '017'],
]);

/** Estado elegido en «Estado» (texto de la interfaz entre «…»). */
const STATES: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Validado»', 'Validado'],
  ['«Borrador»', 'Borrador'],
]);

/** Lo que muestra el árbol al terminar la búsqueda: códigos visibles y recuento, o el aviso de sin coincidencias. */
const showsCodes = async (page: Page, expected: readonly string[], counter: string | undefined): Promise<Check[]> => {
  await waitUntil(async () => sameSet(await visibleCodes(page), expected));
  const shown = await visibleCodes(page);
  const checks: Check[] = [check(sameSet(shown, expected), `ve ${expected.join(', ')}`, `ve ${shown.length === 0 ? '(ninguno)' : shown.join(', ')}`)];
  if (counter !== undefined) checks.push(eq('el contador', await countText(page), counter));
  return checks;
};

// --- Esquema 1: la búsqueda por código o título muestra las coincidencias con su camino ----------------------------------------------------

const searchMatches: BrowserRowHandler = async (row, { page }) => {
  const texto = strict('texto', TEXTS, cell(row, 'texto'));
  const visibles = listOf(cell(row, 'visibles'));
  const contador = quotedOr(cell(row, 'contador'));
  const expected = `ve ${visibles.join(', ')} y el contador dice «${contador}»`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const typed = await interact(search(page), `escribir ${texto} en «Buscar requisitos»`, (el) => el.fill(texto, ACTION));
  if (typed) return actionFailed(expected, typed);
  return conclude([...(await showsCodes(page, visibles, contador)), check((await search(page).inputValue({ timeout: 2000 })) === texto, `el campo contiene ${texto}`, `el campo contiene «${await search(page).inputValue({ timeout: 2000 })}»`)]);
};

// --- Esquema 2: una búsqueda sin coincidencias muestra el aviso de sin coincidencias ----------------------------------------------------

const noMatches: BrowserRowHandler = async (row, { page }) => {
  const texto = strict('texto', TEXTS, cell(row, 'texto'));
  const expected = 've el aviso «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.» y el contador dice «0 de 14 requisitos»';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const typed = await interact(search(page), `escribir ${texto} en «Buscar requisitos»`, (el) => el.fill(texto, ACTION));
  if (typed) return actionFailed(expected, typed);
  await waitUntil(async () => (await noMatch(page).count()) > 0);
  const block = (await textOf(noMatch(page))) ?? '';
  const lines = block.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  return conclude([
    check(lines[0] === 'Sin coincidencias' && lines[1] === 'Ningún requisito coincide con la búsqueda.', 'el aviso «Sin coincidencias» con «Ningún requisito coincide con la búsqueda.»', `el aviso «${lines.join(' · ')}»`),
    eq('el contador', await countText(page), '0 de 14 requisitos'),
  ]);
};

// --- Esquema 3: el filtro por estado muestra solo los requisitos de ese estado y sus ancestros ------------------------------------------

const stateFilterShows: BrowserRowHandler = async (row, { page }) => {
  const estado = strict('estado', STATES, cell(row, 'estado'));
  const visibles = listOf(cell(row, 'visibles'));
  const contador = quotedOr(cell(row, 'contador'));
  const expected = `ve ${visibles.join(', ')} y el contador dice «${contador}»`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const picked = await interact(stateFilter(page), `elegir «${estado}» en el filtro «Estado»`, (el) => el.selectOption({ label: estado }, ACTION));
  if (picked) return actionFailed(expected, picked);
  return conclude(await showsCodes(page, visibles, contador));
};

// --- Esquema 4: la búsqueda y el filtro de estado se combinan ---------------------------------------------------------------------------

const RESULT: ReadonlyMap<string, { readonly visibles: readonly string[]; readonly contador: string } | 'sin coincidencias'> = new Map<
  string,
  { readonly visibles: readonly string[]; readonly contador: string } | 'sin coincidencias'
>([
  ['ve REQ-015 y REQ-017, y el contador dice «2 de 14 requisitos»', { visibles: ['REQ-015', 'REQ-017'], contador: '2 de 14 requisitos' }],
  ['ve el aviso «Sin coincidencias»', 'sin coincidencias'],
]);

const combined: BrowserRowHandler = async (row, { page }) => {
  const estado = strict('estado', STATES, cell(row, 'estado'));
  const resultado = cell(row, 'resultado');
  const wanted = strict('resultado', RESULT, resultado);
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(resultado, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const typed = await interact(search(page), 'escribir «017» en «Buscar requisitos»', (el) => el.fill('017', ACTION));
  if (typed) return actionFailed(resultado, typed);
  const picked = await interact(stateFilter(page), `elegir «${estado}» en el filtro «Estado»`, (el) => el.selectOption({ label: estado }, ACTION));
  if (picked) return actionFailed(resultado, picked);
  if (wanted === 'sin coincidencias') {
    await waitUntil(async () => (await noMatch(page).count()) > 0);
    return conclude([check((await noMatch(page).count()) > 0, 've el aviso «Sin coincidencias»', (await noMatch(page).count()) > 0 ? 've el aviso «Sin coincidencias»' : 'no ve el aviso «Sin coincidencias»')]);
  }
  return conclude(await showsCodes(page, wanted.visibles, wanted.contador));
};

// --- Esquema 5: con un filtro activo el árbol se muestra desplegado ----------------------------------------------------------------------

const expandedUnderFilter: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `ve REQ-001 y REQ-005 con todas sus ramas desplegadas (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const collapsed = await interact(toggleOf(page, 'Contraer REQ-001'), 'pulsar «Contraer REQ-001»', (el) => el.click(ACTION));
  if (collapsed) return actionFailed(expected, collapsed);
  await waitUntil(async () => !(await visibleCodes(page)).includes('REQ-005'));
  if ((await visibleCodes(page)).includes('REQ-005')) return preparationFailedWeb(expected, 'tras «Contraer REQ-001» sigue viendo REQ-005');
  const typed = await interact(search(page), 'escribir 005 en «Buscar requisitos»', (el) => el.fill('005', ACTION));
  if (typed) return actionFailed(expected, typed);
  await waitUntil(async () => sameSet(await visibleCodes(page), ['REQ-001', 'REQ-005']));
  const shown = await visibleCodes(page);
  const expandedState = await page.getByRole('treeitem', { name: /^REQ-001 / }).getAttribute('aria-expanded', { timeout: 2000 }).catch(() => null);
  return conclude([
    check(sameSet(shown, ['REQ-001', 'REQ-005']), 've REQ-001 y REQ-005', `ve ${shown.join(', ')}`),
    check(expandedState === 'true', 'REQ-001 desplegado (todas sus ramas)', `REQ-001 con aria-expanded ${String(expandedState)}`),
  ]);
};

// --- Esquema 6: limpiar filtros vacía la búsqueda y el estado ------------------------------------------------------------------------

const clearFilters: BrowserRowHandler = async (row, { page }) => {
  const texto = strict('texto', TEXTS, cell(row, 'texto'));
  const estado = strict('estado', STATES, cell(row, 'estado'));
  const expected = 'el campo «Buscar requisitos» está vacío, el filtro «Estado» sin opción elegida, el contador dice «14 de 14 requisitos» y «Limpiar filtros» ya no aparece';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const typed = await interact(search(page), `escribir ${texto} en «Buscar requisitos»`, (el) => el.fill(texto, ACTION));
  if (typed) return actionFailed(expected, typed);
  const picked = await interact(stateFilter(page), `elegir «${estado}» en el filtro «Estado»`, (el) => el.selectOption({ label: estado }, ACTION));
  if (picked) return actionFailed(expected, picked);
  const cleared = await interact(page.getByRole('button', { name: 'Limpiar filtros', exact: true }), 'pulsar «Limpiar filtros»', (el) => el.click(ACTION));
  if (cleared) return actionFailed(expected, cleared);
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  const value = await search(page).inputValue({ timeout: 2000 });
  const chosen = await stateFilter(page).inputValue({ timeout: 2000 });
  const clearVisible = (await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).count()) > 0;
  return conclude([
    check(value === '', 'el campo «Buscar requisitos» está vacío', `el campo «Buscar requisitos» contiene «${value}»`),
    check(chosen === '', 'el filtro «Estado» sin opción elegida', `el filtro «Estado» tiene la opción «${chosen}»`),
    eq('el contador', await countText(page), '14 de 14 requisitos'),
    check(!clearVisible, '«Limpiar filtros» ya no aparece', clearVisible ? '«Limpiar filtros» sigue visible' : '«Limpiar filtros» ya no aparece'),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(searchMatches)],
    [2, onWeb(noMatches)],
    [3, onWeb(stateFilterShows)],
    [4, onWeb(combined)],
    [5, onWeb(expandedUnderFilter)],
    [6, onWeb(clearFilters)],
  ]),
});
