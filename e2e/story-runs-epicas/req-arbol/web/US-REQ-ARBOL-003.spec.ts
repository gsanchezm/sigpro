import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNTS, actionFailed, boxOf, countText, describe, eq, interact, listOf, onWeb, openPath, sameList, sameSet, seenStrict, signIn, textOf, titleButtonOf, toggleOf, treeItem, treeRows, visibleCodes } from './common';

// US-REQ-ARBOL-003 — Ver el árbol de requisitos: jerarquía, orden, plegar y desplegar (web). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador, inicio de sesión de la cuenta de la fila en /login?tenant=alumno01 (contexto sin sesión) y llegada a Programas.

interface Credentials {
  readonly email: string;
  readonly password: string;
}

/** Prepara la fila: reinicia alumno01 e inicia sesión con la cuenta dada en la ventana de la historia. Devuelve por qué no llegó, si no llegó. */
const prepare = async (page: Page, credentials: Credentials, width: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, credentials, width);
};

const GESTOR = DEMO.gestor;

/** Ventanas de la historia (texto de la celda → texto de la ventana que se fija). */
const WIDTHS: ReadonlyMap<string, string> = new Map<string, string>([
  ['1440 px', '1440 px'],
  ['390 px', '390 px'],
]);
const ALL_PRG001 = Array.from({ length: 14 }, (_, index) => `REQ-${String(index + 1).padStart(3, '0')}`);

/** Lugar de la fila en el árbol: la fila de arriba, el requisito de referencia (padre o hermano) y la relación. */
interface Place {
  readonly above: string;
  readonly ref: string;
  readonly relation: 'hijo' | 'hermano';
}
const PLACES: ReadonlyMap<string, Place> = new Map<string, Place>([
  ['justo debajo de REQ-015, sangrado un nivel más que REQ-015', { above: 'REQ-015', ref: 'REQ-015', relation: 'hijo' }],
  ['justo debajo de REQ-016, al mismo nivel que REQ-016', { above: 'REQ-016', ref: 'REQ-016', relation: 'hermano' }],
  ['justo debajo de REQ-017, sangrado un nivel más que REQ-017', { above: 'REQ-017', ref: 'REQ-017', relation: 'hijo' }],
  ['justo debajo de REQ-018, al mismo nivel que REQ-017', { above: 'REQ-018', ref: 'REQ-017', relation: 'hermano' }],
  ['justo debajo de REQ-027, sangrado un nivel más que REQ-027', { above: 'REQ-027', ref: 'REQ-027', relation: 'hijo' }],
]);

/** Sangría visual de la fila (x del título en píxeles), o `undefined` si no se puede medir. */
const indentOf = async (page: Page, code: string): Promise<number | undefined> => {
  const box = await boxOf(titleButtonOf(page, code));
  return box === null ? undefined : Math.round(box.x);
};

/** Nivel ARIA (`aria-level`) de una fila visible, o `NaN` si no está. */
const levelOf = async (page: Page, code: string): Promise<number> => Number((await treeRows(page)).find((row) => row.code === code)?.level);

// --- Esquema 1: cada requisito aparece bajo su padre y en el orden de su posición -------------------------------------------------------------

const underParent: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const lugar = cell(row, 'lugar');
  const place = strict('lugar', PLACES, lugar);
  const expected = `ve el requisito ${codigo} ${lugar}`;
  const failure = await prepare(page, GESTOR, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const codes = await visibleCodes(page);
  const above = codes[codes.indexOf(codigo) - 1];
  const levelNow = await levelOf(page, codigo);
  const levelRef = await levelOf(page, place.ref);
  const xNow = (await indentOf(page, codigo)) ?? Number.NaN;
  const xRef = (await indentOf(page, place.ref)) ?? Number.NaN;
  const measured = `nivel ${levelNow} frente a ${levelRef} y sangría ${xNow} px frente a ${xRef} px`;
  const indent =
    place.relation === 'hijo'
      ? check(levelNow === levelRef + 1 && xNow > xRef + 4, `sangrado un nivel más que ${place.ref}`, `sangrado: ${measured}`)
      : check(levelNow === levelRef && Math.abs(xNow - xRef) < 2, `al mismo nivel que ${place.ref}`, `al mismo nivel: ${measured}`);
  return conclude([
    await seenStrict(treeItem(page, codigo), `el requisito ${codigo}`),
    check(above === place.above, `justo debajo de ${place.above}`, `justo debajo de ${above ?? '(ninguno)'}`),
    indent,
  ]);
};

// --- Esquema 2: plegar un requisito oculta a sus descendientes y desplegarlo los devuelve ------------------------------------------------

const FOLD: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Contraer REQ-015»', 'Contraer REQ-015'],
  ['«Contraer REQ-017»', 'Contraer REQ-017'],
  ['«Contraer REQ-027»', 'Contraer REQ-027'],
]);
const UNFOLD: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Expandir REQ-015»', 'Expandir REQ-015'],
  ['«Expandir REQ-017»', 'Expandir REQ-017'],
  ['«Expandir REQ-027»', 'Expandir REQ-027'],
]);

const foldAndUnfold: BrowserRowHandler = async (row, { page }) => {
  const contraer = cell(row, 'contraer');
  const expandir = cell(row, 'expandir');
  const ocultos = listOf(cell(row, 'ocultos'));
  const visibles = listOf(cell(row, 'visibles'));
  const expected = `pliega ${contraer}: deja de ver ${describe(ocultos)} y sigue viendo ${describe(visibles)}; al desplegar ${expandir} vuelve a ver ${describe(ocultos)}`;
  const failure = await prepare(page, GESTOR, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const blockedFold = await interact(toggleOf(page, strict('contraer', FOLD, contraer)), `pulsar ${contraer}`, (el) => el.click(ACTION));
  if (blockedFold) return actionFailed(expected, blockedFold);
  await waitUntil(async () => !(await visibleCodes(page)).some((code) => ocultos.includes(code)));
  const folded = await visibleCodes(page);
  const checks: Check[] = [
    ...ocultos.map((code) => check(!folded.includes(code), `deja de ver ${code}`, `${folded.includes(code) ? 'sigue viendo' : 'no ve'} ${code}`)),
    ...visibles.map((code) => check(folded.includes(code), `sigue viendo ${code}`, `${folded.includes(code) ? 'sigue viendo' : 'no ve'} ${code}`)),
  ];
  const blockedUnfold = await interact(toggleOf(page, strict('expandir', UNFOLD, expandir)), `pulsar ${expandir}`, (el) => el.click(ACTION));
  if (blockedUnfold) return actionFailed(expected, blockedUnfold);
  await waitUntil(async () => {
    const now = await visibleCodes(page);
    return ocultos.every((code) => now.includes(code));
  });
  const unfolded = await visibleCodes(page);
  checks.push(...ocultos.map((code) => check(unfolded.includes(code), `vuelve a ver ${code}`, `${unfolded.includes(code) ? 'vuelve a ver' : 'no ve'} ${code}`)));
  return conclude(checks);
};

// --- Esquema 3: contraer todo deja visibles solo los requisitos raíz ---------------------------------------------------------------------

const collapseAll: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const visibles = listOf(cell(row, 'visibles'));
  const expected = `ve solo ${describe(visibles)} y el contador dice «14 de 14 requisitos»`;
  const failure = await prepare(page, GESTOR, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `${programa}/requirements`);
  const blocked = await interact(page.getByRole('button', { name: 'Contraer todo', exact: true }), 'pulsar «Contraer todo»', (el) => el.click(ACTION));
  if (blocked) return actionFailed(expected, blocked);
  await waitUntil(async () => sameSet(await visibleCodes(page), visibles));
  const shown = await visibleCodes(page);
  return conclude([check(sameSet(shown, visibles), `ve solo ${describe(visibles)}`, `ve ${describe(shown)}`), eq('el contador', await countText(page), '14 de 14 requisitos')]);
};

// --- Esquema 4: expandir todo despliega todas las ramas de nuevo ------------------------------------------------------------------------

const expandAll: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = 've los catorce requisitos, de REQ-001 a REQ-014, y el contador dice «14 de 14 requisitos»';
  const failure = await prepare(page, GESTOR, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const collapsed = await interact(page.getByRole('button', { name: 'Contraer todo', exact: true }), 'pulsar «Contraer todo»', (el) => el.click(ACTION));
  if (collapsed) return actionFailed(expected, collapsed);
  await waitUntil(async () => sameSet(await visibleCodes(page), ['REQ-001', 'REQ-006', 'REQ-011']));
  const expanded = await interact(page.getByRole('button', { name: 'Expandir todo', exact: true }), 'pulsar «Expandir todo»', (el) => el.click(ACTION));
  if (expanded) return actionFailed(expected, expanded);
  await waitUntil(async () => sameList(await visibleCodes(page), ALL_PRG001));
  const shown = await visibleCodes(page);
  return conclude([check(sameList(shown, ALL_PRG001), 've los catorce requisitos, de REQ-001 a REQ-014', `ve ${shown.length} requisitos: ${shown.join(', ')}`), eq('el contador', await countText(page), '14 de 14 requisitos')]);
};

// --- Esquema 5: las filas muestran etiquetas, pruebas y no conformidades en escritorio, y no en 390 px ------------------------------------

/** Lo que cada texto de la celda exige: «escritorio» (≥ 1024 px, con etiquetas y columnas) o «responsive» (sin ellas). */
const LAYOUT_OF: ReadonlyMap<string, 'escritorio' | 'responsive'> = new Map<string, 'escritorio' | 'responsive'>([
  ['ve la etiqueta «Ciberseguridad», la cabecera de columnas con «Pruebas» y «NC», y en la fila las columnas «Pruebas» y «NC»', 'escritorio'],
  ['no ve ninguna etiqueta, ni las columnas «Pruebas» y «NC», ni la cabecera de columnas', 'responsive'],
]);

const columnsByWidth: BrowserRowHandler = async (row, { page }) => {
  const ancho = cell(row, 'ancho');
  const columnas = cell(row, 'columnas');
  const layout = strict('columnas', LAYOUT_OF, columnas);
  const expected = `ve REQ-001 «Aprobado» y ${columnas}`;
  const failure = await prepare(page, GESTOR, strict('ancho', WIDTHS, ancho));
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const item = treeItem(page, 'REQ-001');
  const want = layout === 'escritorio';
  const tag = item.getByText('Ciberseguridad', { exact: true });
  const tagShown = (await tag.count()) > 0 && (await tag.first().isVisible());
  const header = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENTS_TREE_HEADER);
  const headerShown = (await header.count()) > 0;
  const headerWords = ((await textOf(header)) ?? '').split('\n').map((line) => line.trim());
  const testsShown = (await page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW_TESTS('REQ-001')).count()) > 0;
  const ncShown = (await page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_ROW_NC('REQ-001')).count()) > 0;
  return conclude(
    [
      await seenStrict(item, 'la fila de REQ-001'),
      eq('el título de REQ-001', await textOf(titleButtonOf(page, 'REQ-001')), 'Disponibilidad del subsistema 001'),
      eq('el estado de REQ-001', await textOf(item.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_STATE_BADGE)), 'Aprobado'),
      check(tagShown === want, want ? 've la etiqueta «Ciberseguridad»' : 'no ve ninguna etiqueta', tagShown ? 've la etiqueta «Ciberseguridad»' : 'no ve la etiqueta «Ciberseguridad»'),
      check(
        headerShown === want && (!want || (headerWords.includes('Pruebas') && headerWords.includes('NC'))),
        want ? 'la cabecera de columnas con «Pruebas» y «NC»' : 'sin cabecera de columnas',
        headerShown ? `cabecera con ${headerWords.filter((word) => word !== '').join(' · ')}` : 'sin cabecera de columnas',
      ),
      check(testsShown === want && ncShown === want, want ? 'las columnas «Pruebas» y «NC» en la fila' : 'sin las columnas «Pruebas» y «NC»', `columna Pruebas ${testsShown ? 'visible' : 'no visible'} y NC ${ncShown ? 'visible' : 'no visible'}`),
    ],
    { evidence: { ancho } },
  );
};

// --- Esquema 6: cambiar de programa en el desplegable muestra el árbol del programa elegido ----------------------------------------------

const switchProgram: BrowserRowHandler = async (row, { page }) => {
  const cuenta = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = 'llega a /programs/PRG-002/requirements, con la búsqueda vacía, el contador «14 de 14 requisitos» y REQ-015 con el título Registro de eventos del subsistema 015';
  const failure = await prepare(page, cuenta, '1440 px');
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const search = page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true });
  const typed = await interact(search, 'escribir «005» en «Buscar requisitos»', (el) => el.fill('005', ACTION));
  if (typed) return actionFailed(expected, typed);
  const picked = await interact(page.getByLabel('Programa', { exact: true }), 'elegir «PRG-002 · Radar de vigilancia costera RVC-2» en «Programa»', (el) =>
    el.selectOption({ label: 'PRG-002 · Radar de vigilancia costera RVC-2' }, ACTION),
  );
  if (picked) return actionFailed(expected, picked);
  const arrived = await waitUntil(async () => new URL(page.url()).pathname === '/programs/PRG-002/requirements');
  await waitUntil(async () => (await countText(page)) === '14 de 14 requisitos');
  const value = await search.inputValue({ timeout: 2000 }).catch(() => undefined);
  return conclude([
    check(arrived.reached, 'llega a /programs/PRG-002/requirements', `llega a ${new URL(page.url()).pathname}`),
    check(value === '', 'el campo «Buscar requisitos» está vacío', `el campo «Buscar requisitos» contiene «${value ?? '(no legible)'}»`),
    eq('el contador', await countText(page), '14 de 14 requisitos'),
    eq('el título de REQ-015', await textOf(titleButtonOf(page, 'REQ-015')), 'Registro de eventos del subsistema 015'),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(underParent)],
    [2, onWeb(foldAndUnfold)],
    [3, onWeb(collapseAll)],
    [4, onWeb(expandAll)],
    [5, onWeb(columnsByWidth)],
    [6, onWeb(switchProgram)],
  ]),
});
