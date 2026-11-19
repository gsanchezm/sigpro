import type { Page } from '@playwright/test';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, CEILING_MS, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { MOVIL_VERIFICATION_TESTIDS, VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';
import { codesOf, codesShown, describeCodes, oneText, sameCodes, waitForList, SETTLE_MS, type SortKey } from '../web/common';
import {
  addressOf,
  chipLabelOf,
  chipOf,
  DIRECT_APPROXIMATION,
  countText,
  emptyClearOf,
  emptyOf,
  filtersClearOf,
  mobileSettled,
  onExpoWeb,
  openFromTab,
  optionOf,
  searchBox,
  selectOf,
  signIn,
  startsWithCodes,
  concluded } from './common';

// US-VER-CASOS-008 — Buscar, filtrar y ordenar la lista de casos (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; la app en /login sin sesión guardada; gestor@sigpro.test inicia sesión, llega a /programs
// y abre la sección «Verificación».

/** Celda «programa» → valor de la opción del selector (la opción «todos» se llama `all`). */
const PROGRAM_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Todos los programas»', 'all'],
  ['PRG-001', 'PRG-001'],
  ['PRG-003', 'PRG-003'],
]);

/** Celda «resultado» → valor de la opción del selector «Último resultado». */
const RESULT_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Todos los resultados»', 'all'],
  ['«Fallido»', 'fail'],
  ['«Bloqueado»', 'blocked'],
  ['«Superado»', 'pass'],
]);

/** Celda «resultado» de la limpieza → valor del parámetro `result` de la dirección. */
const RESULT_PARAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Superado»', 'pass'],
  ['«Fallido»', 'fail'],
]);

/** Celda «orden» → columna del chip. */
const COLUMN: ReadonlyMap<string, SortKey> = new Map<string, SortKey>([
  ['«Código»', 'code'],
  ['«Título»', 'title'],
  ['«Último resultado»', 'result'],
  ['«Ejecuciones»', 'runs'],
]);

/** Celda «chip» → texto del chip elegido (con su flecha). */
const CHIP_TEXT: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Código ↓»', 'Código ↓'],
  ['«Título ↑»', 'Título ↑'],
  ['«Último resultado ↑»', 'Último resultado ↑'],
  ['«Último resultado ↓»', 'Último resultado ↓'],
  ['«Ejecuciones ↑»', 'Ejecuciones ↑'],
  ['«Ejecuciones ↓»', 'Ejecuciones ↓'],
]);

/** Celda «veces» → pulsaciones del orden. */
const TIMES: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
]);

const CASES_ADDRESS = /^\/verification(\?[a-zA-Z0-9=&]+)?$/;

/** Primera línea de un texto de selector (el valor elegido, sin el indicador ▾). */
const firstLine = (text: string | undefined): string | undefined => text?.split('\n')[0]?.trim();

/** Valor del buscador (o `undefined` si no se puede leer). */
const searchValue = (page: Page): Promise<string | undefined> => safe(() => searchBox(page).inputValue({ timeout: 2000 }), undefined);

/** Preparación común: reinicio de alumno01, inicio de sesión y sección «Verificación». Devuelve el fallo o `undefined`. */
const prepared = async (page: Page, expected: string, openList = true): Promise<ReturnType<typeof preparationFailedWeb> | undefined> => {
  await resetTenants([TENANT_A]);
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  if (!openList) return undefined;
  const reached = await openFromTab(page);
  return reached ? preparationFailedWeb(expected, reached) : undefined;
};

// --- Esquema 1: el buscador compara el código y el título sin distinguir mayúsculas -----------------------------------------

const search: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const typed = await runSteps([['escribir en «Buscar casos de prueba»', () => searchBox(page).fill(cell(row, 'texto'), ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  const shown = await waitForList(page, codesOf(cell(row, 'codigos')), quoted(cell(row, 'recuento')), SETTLE_MS);
  return concluded([
    check(sameCodes(shown.codes, codesOf(cell(row, 'codigos'))), `ve ${cell(row, 'codigos')}`, `ve ${describeCodes(shown.codes)}`),
    check(shown.count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${shown.count ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 2: el programa y el último resultado filtran la lista -----------------------------------------------------------

const filters: BrowserRowHandler = async (row, { page }) => {
  const program = strict('programa', PROGRAM_VALUE, cell(row, 'programa'));
  const result = strict('resultado', RESULT_VALUE, cell(row, 'resultado'));
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const chosen = await runSteps([
    ['abrir «Programa»', () => selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_PROGRAM).click(ACTION)],
    [`elegir la opción ${cell(row, 'programa')}`, () => optionOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_PROGRAM, program).click(ACTION)],
    ['abrir «Último resultado»', () => selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT).click(ACTION)],
    [`elegir la opción ${cell(row, 'resultado')}`, () => optionOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT, result).click(ACTION)],
  ]);
  if (chosen) return preparationFailedWeb(expected, chosen);
  const shown = await waitForList(page, codesOf(cell(row, 'codigos')), quoted(cell(row, 'recuento')), SETTLE_MS);
  return concluded([
    check(sameCodes(shown.codes, codesOf(cell(row, 'codigos'))), `ve ${cell(row, 'codigos')}`, `ve ${describeCodes(shown.codes)}`),
    check(shown.count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${shown.count ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 3: tocar un orden lo elige o invierte su sentido ----------------------------------------------------------------

const sortChip: BrowserRowHandler = async (row, { page }) => {
  const key = strict('orden', COLUMN, cell(row, 'orden'));
  const chip = strict('chip', CHIP_TEXT, cell(row, 'chip'));
  const times = strict('veces', TIMES, cell(row, 'veces'));
  const primeros = codesOf(cell(row, 'primeros'));
  const expected = `el orden elegido muestra ${cell(row, 'chip')} y los tres primeros casos son ${cell(row, 'primeros')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  for (let tap = 1; tap <= times; tap += 1) {
    // Cada toque cambia la etiqueta del chip (la flecha): se espera ese cambio antes del siguiente
    const before = await chipLabelOf(page, key);
    const pressed = await runSteps([[`tocar «${cell(row, 'orden')}»`, () => chipOf(page, key).click(ACTION)]]);
    if (pressed) return preparationFailedWeb(expected, pressed);
    await waitUntil(async () => (await chipLabelOf(page, key)) !== before, SETTLE_MS);
  }
  await waitUntil(async () => startsWithCodes(await codesShown(page), primeros), SETTLE_MS);
  const checkedChips = await safe(() => page.getByTestId(MOVIL_VERIFICATION_TESTIDS.SORT_GROUP).locator('[aria-checked="true"]').count(), -1);
  const label = await safe(() => chipOf(page, key).getAttribute('aria-label', { timeout: 2000 }), undefined);
  const selected = await safe(() => chipOf(page, key).getAttribute('aria-checked', { timeout: 2000 }), undefined);
  const first = (await codesShown(page))?.slice(0, primeros.length);
  return concluded([
    check(label === chip && selected === 'true', `el orden elegido «${chip}»`, `el orden «${label ?? '(sin leer)'}», elegido ${selected ?? '(sin leer)'}`),
    check(first !== undefined && first.join(', ') === primeros.join(', '), `los tres primeros casos ${cell(row, 'primeros')}`, `los tres primeros casos ${first === undefined ? '(sin leer)' : first.join(', ')}`),
    check(checkedChips === 1, 'un solo orden elegido', `órdenes elegidos: ${checkedChips}`),
  ]);
};

// --- Esquema 4: «Limpiar filtros» quita el texto y los filtros, y conserva el orden elegido ----------------------------

const clearAll: BrowserRowHandler = async (row, { page }) => {
  const result = strict('resultado', RESULT_VALUE, cell(row, 'resultado'));
  const resultKey = strict('resultado', RESULT_PARAM, cell(row, 'resultado'));
  const primeros = codesOf(cell(row, 'primeros'));
  const expected = `tras «Limpiar filtros»: campo vacío, «Último resultado» en «Todos los resultados», recuento «1–10 de 25», primeros casos ${cell(row, 'primeros')} y el orden «Título ↑»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const set = await runSteps([
    ['escribir en «Buscar casos de prueba»', () => searchBox(page).fill(cell(row, 'texto'), ACTION)],
    ['abrir «Último resultado»', () => selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT).click(ACTION)],
    [`elegir la opción ${cell(row, 'resultado')}`, () => optionOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT, result).click(ACTION)],
    ['tocar «Título»', () => chipOf(page, 'title').click(ACTION)],
  ]);
  if (set) return preparationFailedWeb(expected, set);
  const reflected = await waitUntil(async () => {
    const address = addressOf(page.url());
    return address.includes(`q=${cell(row, 'texto')}`) && address.includes(`result=${resultKey}`) && address.includes('sort=title');
  }, SETTLE_MS);
  if (!reflected.reached) return preparationFailedWeb(expected, `la dirección no reflejó el texto, el filtro y el orden (${addressOf(page.url())})`);
  const cleared = await runSteps([['tocar «Limpiar filtros»', () => filtersClearOf(page).click(ACTION)]]);
  if (cleared) return preparationFailedWeb(expected, cleared);
  await waitUntil(async () => startsWithCodes(await codesShown(page), primeros) && (await countText(page)) === '1–10 de 25', SETTLE_MS);
  const first = (await codesShown(page))?.slice(0, primeros.length);
  const resultLabel = firstLine(await oneText(selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT)));
  const chipLabel = await safe(() => chipOf(page, 'title').getAttribute('aria-label', { timeout: 2000 }), undefined);
  return concluded([
    check((await searchValue(page)) === '', 'el campo «Buscar casos de prueba» vacío', `el campo tiene «${(await searchValue(page)) ?? '(sin leer)'}»`),
    check(resultLabel === 'Todos los resultados', '«Último resultado» en «Todos los resultados»', `«Último resultado» en «${resultLabel ?? '(sin leer)'}»`),
    check((await countText(page)) === '1–10 de 25', 'el recuento «1–10 de 25»', `el recuento «${(await countText(page)) ?? '(sin leer)'}»`),
    check(first !== undefined && first.join(', ') === primeros.join(', '), `los primeros casos ${cell(row, 'primeros')}`, `los primeros casos ${first === undefined ? '(sin leer)' : first.join(', ')}`),
    check(chipLabel === 'Título ↑', 'el orden elegido «Título ↑»', `el orden elegido «${chipLabel ?? '(sin leer)'}»`),
  ], { note: 'La visibilidad de «Limpiar filtros» antes de pulsarlo no tiene fila propia: solo se usa como acción (la regla de aparición de 008 no se comprueba aquí).' });
};

// --- Esquema 5: un filtro sin coincidencias muestra el aviso de lista vacía con la opción de limpiar filtros -------------

const emptyFilter: BrowserRowHandler = async (row, { page }) => {
  const result = strict('resultado', RESULT_VALUE, cell(row, 'resultado'));
  const expected = 'el aviso «Sin casos de prueba» con el texto «Ningún caso coincide con los filtros aplicados.» y el botón «Limpiar filtros»';
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const typed = await runSteps([
    ['escribir en «Buscar casos de prueba»', () => searchBox(page).fill(cell(row, 'texto'), ACTION)],
    ['abrir «Último resultado»', () => selectOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT).click(ACTION)],
    [`elegir la opción ${cell(row, 'resultado')}`, () => optionOf(page, VERIFICACION_TESTIDS.VERIFICATION_FILTER_RESULT, result).click(ACTION)],
  ]);
  if (typed) return preparationFailedWeb(expected, typed);
  await waitUntil(async () => (await emptyOf(page).count()) === 1, SETTLE_MS);
  const leaves = await safe(() => emptyOf(page).evaluate((element: Element) => Array.from(element.querySelectorAll('*')).filter((node) => node.children.length === 0).map((node) => (node.textContent ?? '').trim()).filter((text) => text !== ''), undefined, { timeout: 2000 }), undefined);
  const clear = await safe(() => emptyClearOf(page).count(), -1);
  return concluded([
    check(leaves?.includes('Sin casos de prueba') === true, 'el aviso «Sin casos de prueba»', `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(leaves?.includes('Ningún caso coincide con los filtros aplicados.') === true, 'el texto «Ningún caso coincide con los filtros aplicados.»', `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(clear === 1, 'el botón «Limpiar filtros» dentro del aviso', `botones «Limpiar filtros» en el aviso: ${clear}`),
  ]);
};

// --- Esquema 6: la dirección de la pantalla lleva el texto, los filtros y el orden --------------------------------------------

const address: BrowserRowHandler = async (row, { page }) => {
  if (!CASES_ADDRESS.test(cell(row, 'direccion'))) throw new Error(`celda sin interpretación: dirección «${cell(row, 'direccion')}»`);
  const expected = `recuento ${cell(row, 'recuento')} y primer caso ${cell(row, 'primero')} en ${cell(row, 'direccion')}`;
  const failed = await prepared(page, expected, false);
  if (failed) return failed;
  const opened = await runSteps([['abrir la dirección', () => page.goto(cell(row, 'direccion'), { timeout: CEILING_MS })]]);
  if (opened) return preparationFailedWeb(expected, opened);
  await mobileSettled(page);
  await waitUntil(async () => (await countText(page)) === quoted(cell(row, 'recuento')), SETTLE_MS);
  const count = await countText(page);
  const first = (await codesShown(page))?.[0];
  return concluded([
    check(count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${count ?? '(sin leer)'}»`),
    check(first === cell(row, 'primero'), `el primer caso ${cell(row, 'primero')}`, `el primer caso ${first ?? '(ninguno)'}`),
    check(addressOf(page.url()) === cell(row, 'direccion'), `la dirección ${cell(row, 'direccion')} (ruta y query tal cual)`, `la dirección ${addressOf(page.url())}`),
  ], { note: DIRECT_APPROXIMATION });
};

defineBrowserRows({
  story: 'US-VER-CASOS-008',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(search)],
    [2, onExpoWeb(filters)],
    [3, onExpoWeb(sortChip)],
    [4, onExpoWeb(clearAll)],
    [5, onExpoWeb(emptyFilter)],
    [6, onExpoWeb(address)],
  ]),
});

