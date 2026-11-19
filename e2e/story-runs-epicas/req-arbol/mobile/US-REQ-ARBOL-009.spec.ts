import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS, MOVIL_REQUIREMENTS_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, countText, eq, foldButton, interact, levelOfRow, listOf, norm, onExpoWeb, openButton, openMobile, prepareMobile, quotedOr, REACTION, rowCodes, rowOf, searchField, textOf , boxOf } from './common';
import { sameSet } from '../web/common';

// US-REQ-ARBOL-009 — Ver el árbol de requisitos: sangría, plegado, búsqueda y contador (app móvil, Expo web a 390 px). Preparación de cada fila:
// reinicio de alumno01 con su administrador; la app en /login sin sesión, con alumno01 en «Tenant de trabajo», gestor@sigpro.test y Entrar.

const prepare = (page: Page): Promise<string | undefined> => prepareMobile(page);

const ROW_ESTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Aprobado»', 'Aprobado'],
  ['«Validado»', 'Validado'],
  ['«Borrador»', 'Borrador'],
]);

/** Lo que muestra la línea de etiquetas: su texto, o «sin línea» si la fila no la tiene. */
const LINEA_ETIQUETAS: ReadonlyMap<string, string | 'sin-linea'> = new Map<string, string | 'sin-linea'>([
  ['«Ciberseguridad»', 'Ciberseguridad'],
  ['(sin línea de etiquetas)', 'sin-linea'],
  ['«Normativo»', 'Normativo'],
  ['«Mantenibilidad · Seguridad operacional»', 'Mantenibilidad · Seguridad operacional'],
]);

// --- Esquema 1: la fila de un requisito muestra su estado, su prioridad y sus etiquetas ------------------------------------------------

const rowFields: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const estado = strict('estado', ROW_ESTADO, cell(row, 'estado'));
  const prioridad = quotedOr(cell(row, 'prioridad'));
  const etiquetas = strict('etiquetas', LINEA_ETIQUETAS, cell(row, 'etiquetas'));
  const expected = `la fila de ${codigo} muestra el estado ${estado}, la línea ${prioridad} y la línea de etiquetas ${cell(row, 'etiquetas')}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes(codigo));
  const badge = await textOf(rowOf(page, codigo).getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_STATE(codigo)));
  const priority = await textOf(rowOf(page, codigo).getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_PRIORITY(codigo)));
  const tags = await textOf(rowOf(page, codigo).getByTestId(MOVIL_REQUIREMENTS_DYNAMIC_TESTIDS.ROW_TAGS(codigo)));
  const tagsCheck =
    etiquetas === 'sin-linea'
      ? check(tags === undefined, 'sin línea de etiquetas', tags === undefined ? 'sin línea de etiquetas' : `línea de etiquetas «${tags}»`)
      : eq('la línea de etiquetas', tags, etiquetas);
  return conclude([eq(`el estado de ${codigo}`, badge, estado), eq(`la línea de prioridad de ${codigo}`, priority, prioridad), tagsCheck]);
};

// --- Esquema 2: cada requisito aparece bajo su padre, sangrado un nivel más que él -------------------------------------------------------

interface Place {
  readonly above: string;
  readonly ref: string;
  readonly relation: 'hijo' | 'hermano';
}
const PLACES: ReadonlyMap<string, Place> = new Map<string, Place>([
  ['justo debajo de REQ-003, sangrado un nivel más que REQ-003', { above: 'REQ-003', ref: 'REQ-003', relation: 'hijo' }],
  ['justo debajo de REQ-004, al mismo nivel que REQ-003', { above: 'REQ-004', ref: 'REQ-003', relation: 'hermano' }],
  ['justo debajo de REQ-013, sangrado un nivel más que REQ-013', { above: 'REQ-013', ref: 'REQ-013', relation: 'hijo' }],
]);

const nesting: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const lugar = cell(row, 'lugar');
  const place = strict('lugar', PLACES, lugar);
  const expected = `ve el requisito ${codigo} ${lugar}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes(codigo));
  const codes = await rowCodes(page);
  const above = codes[codes.indexOf(codigo) - 1];
  const levelNow = await levelOfRow(page, codigo);
  const levelRef = await levelOfRow(page, place.ref);
  const xNow = (await boxOf(openButton(page, codigo)))?.x ?? Number.NaN;
  const xRef = (await boxOf(openButton(page, place.ref)))?.x ?? Number.NaN;
  const measured = `nivel ${levelNow} frente a ${levelRef} y sangría ${Math.round(xNow)} px frente a ${Math.round(xRef)} px`;
  const indent =
    place.relation === 'hijo'
      ? check(levelNow === levelRef + 1 && xNow > xRef + 4, `sangrado un nivel más que ${place.ref}`, `sangrado: ${measured}`)
      : check(levelNow === levelRef && Math.abs(xNow - xRef) < 2, `al mismo nivel que ${place.ref}`, `al mismo nivel: ${measured}`);
  return conclude([check(above === place.above, `justo debajo de ${place.above}`, `justo debajo de ${above ?? '(ninguno)'}`), indent]);
};

// --- Esquema 3: plegar una rama oculta sus descendientes y desplegarla los devuelve --------------------------------------------------

const FOLD: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Contraer REQ-003»', 'Contraer REQ-003'],
  ['«Contraer REQ-001»', 'Contraer REQ-001'],
]);
const UNFOLD: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Expandir REQ-003»', 'Expandir REQ-003'],
  ['«Expandir REQ-001»', 'Expandir REQ-001'],
]);

const foldAndUnfold: BrowserRowHandler = async (row, { page }) => {
  const contraer = cell(row, 'contraer');
  const expandir = cell(row, 'expandir');
  const ocultos = listOf(cell(row, 'ocultos'));
  const visibles = listOf(cell(row, 'visibles'));
  const expected = `pliega ${contraer}: deja de ver ${ocultos.join(', ')} y sigue viendo ${visibles.join(', ')}; al desplegar ${expandir} vuelve a ver ${ocultos.join(', ')}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  await waitUntil(async () => (await rowCodes(page)).includes('REQ-001'));
  const folded = await interact(foldButton(page, strict('contraer', FOLD, contraer)), `pulsar ${contraer}`, (el) => el.click(ACTION));
  if (folded) return actionFailed(expected, folded);
  await REACTION();
  const after = await rowCodes(page);
  const checks = [
    ...ocultos.map((code) => check(!after.includes(code), `deja de ver ${code}`, `${after.includes(code) ? 'sigue viendo' : 'no ve'} ${code}`)),
    ...visibles.map((code) => check(after.includes(code), `sigue viendo ${code}`, `${after.includes(code) ? 'sigue viendo' : 'no ve'} ${code}`)),
  ];
  const unfolded = await interact(foldButton(page, strict('expandir', UNFOLD, expandir)), `pulsar ${expandir}`, (el) => el.click(ACTION));
  if (unfolded) return actionFailed(expected, unfolded);
  await waitUntil(async () => (await rowCodes(page)).some((code) => ocultos.includes(code)));
  const back = await rowCodes(page);
  checks.push(...ocultos.map((code) => check(back.includes(code), `vuelve a ver ${code}`, `${back.includes(code) ? 'vuelve a ver' : 'no ve'} ${code}`)));
  return conclude(checks);
};

// --- Esquema 4: la búsqueda por código o título muestra las coincidencias con su camino ----------------------------------------------

const SEARCH: ReadonlyMap<string, string> = new Map<string, string>([
  ['005', '005'],
  ['disponibilidad', 'disponibilidad'],
]);

const searchMatches: BrowserRowHandler = async (row, { page }) => {
  const texto = strict('texto', SEARCH, cell(row, 'texto'));
  const visibles = listOf(cell(row, 'visibles'));
  const contador = quotedOr(cell(row, 'contador'));
  const expected = `ve ${visibles.join(', ')} y el contador dice «${contador}»`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  const typed = await interact(searchField(page), `escribir ${texto} en «Buscar requisitos»`, (el) => el.fill(texto, ACTION));
  if (typed) return actionFailed(expected, typed);
  await waitUntil(async () => sameSet(await rowCodes(page), visibles));
  const shown = await rowCodes(page);
  return conclude([check(sameSet(shown, visibles), `ve ${visibles.join(', ')}`, `ve ${shown.join(', ') || '(ninguno)'}`), eq('el contador', await countText(page), contador)]);
};

// --- Esquema 5: una búsqueda sin coincidencias muestra el aviso correspondiente -------------------------------------------------------

const NO_MATCH_TEXT: ReadonlyMap<string, string> = new Map<string, string>([
  ['nominales', 'nominales'],
  ['REQ-099', 'REQ-099'],
]);

const noMatches: BrowserRowHandler = async (row, { page }) => {
  const texto = strict('texto', NO_MATCH_TEXT, cell(row, 'texto'));
  const expected = 've el aviso «Sin coincidencias» con el texto «Ningún requisito coincide con la búsqueda.»';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-001/requirements');
  const typed = await interact(searchField(page), `escribir ${texto} en «Buscar requisitos»`, (el) => el.fill(texto, ACTION));
  if (typed) return actionFailed(expected, typed);
  const block = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_NO_MATCH);
  await waitUntil(async () => (await block.count()) > 0);
  const lines = ((await textOf(block)) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');
  return conclude([check(lines[0] === 'Sin coincidencias' && lines[1] === 'Ningún requisito coincide con la búsqueda.', 'el aviso «Sin coincidencias» con su texto', `el aviso «${lines.join(' · ')}»`)]);
};

// --- Esquema 6: el enlace de la cabecera lleva de vuelta a la ficha del programa -----------------------------------------------------

const backLink: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `pulsa «Volver al detalle» y llega a /programs/${programa}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/${programa}/requirements`);
  const link = page.getByTestId(MOVIL_REQUIREMENTS_TESTIDS.BACK_TO_PROGRAM);
  const pressed = await interact(link, 'pulsar «Volver al detalle»', (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === `/programs/${programa}`);
  return conclude([check(arrived.reached, `llega a /programs/${programa}`, `llega a ${new URL(page.url()).pathname}`)]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(rowFields)],
    [2, onExpoWeb(nesting)],
    [3, onExpoWeb(foldAndUnfold)],
    [4, onExpoWeb(searchMatches)],
    [5, onExpoWeb(noMatches)],
    [6, onExpoWeb(backLink)],
  ]),
});
