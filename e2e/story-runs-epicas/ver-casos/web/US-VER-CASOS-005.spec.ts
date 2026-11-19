import type { Page } from '@playwright/test';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, attrOf, quoted, runSteps, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import {
  buttonReach,
  codesOf,
  codesShown,
  countOf,
  describeCodes,
  emptyOf,
  filtersClearOf,
  nextOf,
  oneText,
  onWeb,
  pageOf,
  programSelectOf,
  resultSelectOf,
  sameCodes,
  searchOf,
  SETTLE_MS,
  signIn,
  sortOf,
  openVerification,
  waitForList,
  type SortKey, concluded } from './common';

// US-VER-CASOS-005 — Buscar, filtrar, ordenar y paginar la lista de casos con la dirección de la página (web). Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; después gestor@sigpro.test entra desde /login?tenant=alumno01 y llega
// a /programs. Escritorio 1440 px (la historia pide 1024 px o más).

const PROGRAM_CHOICE: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Todos los programas»', 'Todos los programas'],
  ['PRG-001', 'PRG-001'],
  ['PRG-003', 'PRG-003'],
]);

const RESULT_CHOICE: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Todos los resultados»', 'Todos los resultados'],
  ['«Superado»', 'Superado'],
  ['«Fallido»', 'Fallido'],
  ['«Bloqueado»', 'Bloqueado'],
]);

/** Celda «resultado» de los Esquemas de limpiar filtros → valor del parámetro `result` de la dirección. */
const RESULT_PARAM: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Superado»', 'pass'],
  ['«Fallido»', 'fail'],
]);

const COLUMN_KEY: ReadonlyMap<string, SortKey> = new Map<string, SortKey>([
  ['«Código»', 'code'],
  ['«Título»', 'title'],
  ['«Último resultado»', 'result'],
  ['«Ejecuciones»', 'runs'],
]);

/** Celda «direccion» de la historia: una dirección de la pantalla (ruta y query), sin nada más. */
const addressOf = (text: string): string => {
  if (!/^\/verification(\?[a-zA-Z0-9=&]+)?$/.test(text)) throw new Error(`celda sin interpretación: dirección «${text}»`);
  return text;
};

/** Ruta y query de la página actual (lo que la historia llama «la dirección»). */
const currentAddress = (url: string): string => {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
};

/** Los primeros `prefix.length` códigos que se ven son exactamente `prefix`. */
const startsWith = (codes: readonly string[] | undefined, prefix: readonly string[]): boolean => codes !== undefined && codes.length >= prefix.length && prefix.every((code, index) => codes[index] === code);

/** Valor escrito en el buscador (o `undefined` si no se puede leer). */
const searchValue = (page: Page): Promise<string | undefined> => safe(() => searchOf(page).inputValue({ timeout: 2000 }), undefined);

/** Texto de la opción elegida en «Último resultado» (o `undefined`). */
const resultChoice = (page: Page): Promise<string | undefined> =>
  safe(() => resultSelectOf(page).evaluate((element: Element) => (element as HTMLSelectElement).selectedOptions[0]?.textContent?.trim() ?? '', undefined, { timeout: 2000 }), undefined);

/** Preparación común: reinicio de alumno01, inicio de sesión de gestor (1440 px) y apertura de /verification. */
const prepared = async (page: Page, expected: string): Promise<ReturnType<typeof preparationFailedWeb> | undefined> => {
  await resetTenants([TENANT_A]);
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await openVerification(page);
  if (loaded) return preparationFailedWeb(expected, loaded);
  return undefined;
};

// --- Esquema 1: el buscador compara el código y el título sin distinguir mayúsculas ------------------------------------

const search: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve ${cell(row, 'codigos')} y el recuento ${cell(row, 'recuento')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const typed = await runSteps([['escribir en «Buscar casos de prueba»', () => searchOf(page).fill(cell(row, 'texto'), ACTION)]]);
  if (typed) return preparationFailedWeb(expected, typed);
  const shown = await waitForList(page, codesOf(cell(row, 'codigos')), quoted(cell(row, 'recuento')), SETTLE_MS);
  return concluded([
    check(sameCodes(shown.codes, codesOf(cell(row, 'codigos'))), `ve ${cell(row, 'codigos')}`, `ve ${describeCodes(shown.codes)}`),
    check(shown.count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${shown.count ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 2: el programa y el último resultado filtran la lista y se combinan con el texto ---------------------------

const filters: BrowserRowHandler = async (row, { page }) => {
  const program = strict('programa', PROGRAM_CHOICE, cell(row, 'programa'));
  const result = strict('resultado', RESULT_CHOICE, cell(row, 'resultado'));
  const expected = `ve ${cell(row, 'codigos')}, el recuento ${cell(row, 'recuento')} y el resumen ${cell(row, 'resumen')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const chosen = await runSteps([
    [`elegir «${program}» en «Programa»`, () => programSelectOf(page).selectOption({ label: program }, ACTION)],
    [`elegir «${result}» en «Último resultado»`, () => resultSelectOf(page).selectOption({ label: result }, ACTION)],
  ]);
  if (chosen) return preparationFailedWeb(expected, chosen);
  const shown = await waitForList(page, codesOf(cell(row, 'codigos')), quoted(cell(row, 'recuento')), SETTLE_MS);
  const subtitle = await oneText(pageOf(page).locator('p[aria-live="polite"]'));
  return concluded([
    check(sameCodes(shown.codes, codesOf(cell(row, 'codigos'))), `ve ${cell(row, 'codigos')}`, `ve ${describeCodes(shown.codes)}`),
    check(shown.count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${shown.count ?? '(sin leer)'}»`),
    check(subtitle === quoted(cell(row, 'resumen')), `el resumen ${cell(row, 'resumen')}`, `el resumen «${subtitle ?? '(sin leer)'}»`),
  ]);
};

// --- Esquema 3: pulsar una cabecera ordena la lista por esa columna -----------------------------------------------------

const headerSort: BrowserRowHandler = async (row, { page }) => {
  const key = strict('columna', COLUMN_KEY, cell(row, 'columna'));
  const times = Number(cell(row, 'veces'));
  const primeros = codesOf(cell(row, 'primeros'));
  const expected = `pulsar la cabecera ${cell(row, 'columna')} ${times} ${times === 1 ? 'vez' : 'veces'} y que los tres primeros casos sean ${cell(row, 'primeros')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const trail: string[] = [];
  const initialSort = await attrOf(sortOf(page, key).locator('xpath=..'), 'aria-sort');
  for (let click = 1; click <= times; click += 1) {
    // Cada clic cambia la dirección (sort/dir): se espera a ese cambio antes del siguiente, aunque el orden vuelva al inicial
    const before = page.url();
    const pressed = await runSteps([[`pulsar la cabecera ${cell(row, 'columna')}`, () => sortOf(page, key).click(ACTION)]]);
    if (pressed) return preparationFailedWeb(expected, pressed);
    await waitUntil(async () => page.url() !== before, SETTLE_MS);
    const ariaSort = await attrOf(sortOf(page, key).locator('xpath=..'), 'aria-sort');
    trail.push(`clic ${click}: aria-sort ${ariaSort ?? '(sin leer)'} · ${currentAddress(page.url())}`);
  }
  await waitUntil(async () => startsWith(await codesShown(page), primeros), SETTLE_MS);
  const first = (await codesShown(page))?.slice(0, primeros.length);
  const sameAsStart = times === 2 && initialSort === 'ascending' && key === 'code';
  return concluded(
    [
      check(first !== undefined && first.join(', ') === primeros.join(', '), `los tres primeros casos ${cell(row, 'primeros')}`, `los tres primeros casos ${first === undefined ? '(sin leer)' : first.join(', ')}`),
    ],
    {
      note: `${trail.join(' · ')}${sameAsStart ? ' · la fila no distingue un clic sin efecto: «Código» ya ordena ascendente y dos pulsaciones dejan el orden inicial' : ''}`,
    },
  );
};

// --- Esquema 4: un filtro sin coincidencias muestra el aviso de lista vacía con la opción de limpiar filtros ------------

const emptyFilter: BrowserRowHandler = async (row, { page }) => {
  const result = strict('resultado', RESULT_CHOICE, cell(row, 'resultado'));
  const expected = `el aviso «Sin casos de prueba» con el texto «Ningún caso coincide con los filtros aplicados.» y el botón «Limpiar filtros»`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const typed = await runSteps([
    ['escribir en «Buscar casos de prueba»', () => searchOf(page).fill(cell(row, 'texto'), ACTION)],
    [`elegir «${result}» en «Último resultado»`, () => resultSelectOf(page).selectOption({ label: result }, ACTION)],
  ]);
  if (typed) return preparationFailedWeb(expected, typed);
  const block = emptyOf(page);
  await waitUntil(async () => (await block.count()) === 1 && (await block.isVisible()), SETTLE_MS);
  const leaves = await safe(() => block.evaluate((element: Element) => Array.from(element.querySelectorAll('*')).filter((node) => node.children.length === 0).map((node) => (node.textContent ?? '').trim()).filter((text) => text !== ''), undefined, { timeout: 2000 }), undefined);
  const clear = await safe(() => block.getByRole('button', { name: 'Limpiar filtros', exact: true }).count(), -1);
  return concluded([
    check(leaves?.includes('Sin casos de prueba') === true, 'el aviso «Sin casos de prueba»', `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(leaves?.includes('Ningún caso coincide con los filtros aplicados.') === true, 'el texto «Ningún caso coincide con los filtros aplicados.»', `fragmentos ${leaves?.join(' · ') ?? '(sin leer)'}`),
    check(clear === 1, 'el botón «Limpiar filtros» dentro del aviso', `botones «Limpiar filtros» en el aviso: ${clear}`),
  ]);
};

// --- Esquema 5: «Limpiar filtros» quita el texto y los filtros, y conserva el orden -------------------------------------

const clearAll: BrowserRowHandler = async (row, { page }) => {
  const result = strict('resultado', RESULT_CHOICE, cell(row, 'resultado'));
  const resultKey = strict('resultado', RESULT_PARAM, cell(row, 'resultado'));
  const primeros = codesOf(cell(row, 'primeros'));
  const expected = `tras «Limpiar filtros»: campo de búsqueda vacío, «Último resultado» en «Todos los resultados», recuento «1–10 de 25» y primeros casos ${cell(row, 'primeros')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  const set = await runSteps([
    ['escribir en «Buscar casos de prueba»', () => searchOf(page).fill(cell(row, 'texto'), ACTION)],
    [`elegir «${result}» en «Último resultado»`, () => resultSelectOf(page).selectOption({ label: result }, ACTION)],
    ['pulsar la cabecera «Título»', () => sortOf(page, 'title').click(ACTION)],
  ]);
  if (set) return preparationFailedWeb(expected, set);
  // Antes de «Limpiar filtros», la dirección debe reflejar el texto, el resultado y el orden (el buscador se aplica con 250 ms de retardo)
  const reflected = await waitUntil(async () => {
    const address = currentAddress(page.url());
    return address.includes(`q=${cell(row, 'texto')}`) && address.includes(`result=${resultKey}`) && address.includes('sort=title');
  }, SETTLE_MS);
  if (!reflected.reached) return preparationFailedWeb(expected, `la dirección no reflejó el texto, el filtro y el orden (${currentAddress(page.url())})`);
  const cleared = await runSteps([['pulsar «Limpiar filtros»', () => filtersClearOf(page).click(ACTION)]]);
  if (cleared) return preparationFailedWeb(expected, cleared);
  await waitUntil(async () => startsWith(await codesShown(page), primeros) && (await oneText(countOf(page))) === '1–10 de 25', SETTLE_MS);
  const first = (await codesShown(page))?.slice(0, primeros.length);
  return concluded([
    check((await searchValue(page)) === '', 'el campo «Buscar casos de prueba» vacío', `el campo tiene «${(await searchValue(page)) ?? '(sin leer)'}»`),
    check((await resultChoice(page)) === 'Todos los resultados', '«Último resultado» en «Todos los resultados»', `«Último resultado» en «${(await resultChoice(page)) ?? '(sin leer)'}»`),
    check((await oneText(countOf(page))) === '1–10 de 25', 'el recuento «1–10 de 25»', `el recuento «${(await oneText(countOf(page))) ?? '(sin leer)'}»`),
    check(first !== undefined && first.join(', ') === primeros.join(', '), `los primeros casos ${cell(row, 'primeros')}`, `los primeros casos ${first === undefined ? '(sin leer)' : first.join(', ')}`),
  ]);
};

// --- Esquema 6: la paginación muestra 10 casos por página -----------------------------------------------------------------

const pagination: BrowserRowHandler = async (row, { page }) => {
  const times = Number(cell(row, 'veces'));
  const expected = `tras ${times} «Página siguiente»: recuento ${cell(row, 'recuento')}, primer caso ${cell(row, 'primero')} y «Página siguiente» ${cell(row, 'siguiente')}`;
  const failed = await prepared(page, expected);
  if (failed) return failed;
  for (let click = 1; click <= times; click += 1) {
    const before = await oneText(countOf(page));
    const pressed = await runSteps([['pulsar «Página siguiente»', () => nextOf(page).click(ACTION)]]);
    if (pressed) return preparationFailedWeb(expected, pressed);
    await waitUntil(async () => (await oneText(countOf(page))) !== before, SETTLE_MS);
  }
  const count = await oneText(countOf(page));
  const first = (await codesShown(page))?.[0];
  const reach = await buttonReach(nextOf(page));
  return concluded([
    check(count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${count ?? '(sin leer)'}»`),
    check(first === cell(row, 'primero'), `el primer caso ${cell(row, 'primero')}`, `el primer caso ${first ?? '(ninguno)'}`),
    check(reach === cell(row, 'siguiente'), `«Página siguiente» ${cell(row, 'siguiente')}`, `«Página siguiente» ${reach ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 7: la dirección de la página lleva los filtros, el orden y la página ----------------------------------------

const address: BrowserRowHandler = async (row, { page }) => {
  const target = addressOf(cell(row, 'direccion'));
  const expected = `recuento ${cell(row, 'recuento')}, primer caso ${cell(row, 'primero')} y la dirección ${cell(row, 'direccion_final')}`;
  await resetTenants([TENANT_A]);
  const opened = await signIn(page, 1440);
  if (opened) return preparationFailedWeb(expected, opened);
  const loaded = await runSteps([['abrir la dirección', () => page.goto(target, { timeout: 10_000 })]]);
  if (loaded) return preparationFailedWeb(expected, loaded);
  await waitUntil(async () => (await oneText(countOf(page))) === quoted(cell(row, 'recuento')) && currentAddress(page.url()) === cell(row, 'direccion_final'), SETTLE_MS);
  const count = await oneText(countOf(page));
  const first = (await codesShown(page))?.[0];
  const final = currentAddress(page.url());
  return concluded([
    check(count === quoted(cell(row, 'recuento')), `el recuento ${cell(row, 'recuento')}`, `el recuento «${count ?? '(sin leer)'}»`),
    check(first === cell(row, 'primero'), `el primer caso ${cell(row, 'primero')}`, `el primer caso ${first ?? '(ninguno)'}`),
    check(final === cell(row, 'direccion_final'), `la dirección ${cell(row, 'direccion_final')}`, `la dirección ${final}`),
  ]);
};

defineBrowserRows({
  story: 'US-VER-CASOS-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(search)],
    [2, onWeb(filters)],
    [3, onWeb(headerSort)],
    [4, onWeb(emptyFilter)],
    [5, onWeb(clearAll)],
    [6, onWeb(pagination)],
    [7, onWeb(address)],
  ]),
});
