import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, eq, interact, onWeb, openPath, quotedOr, sameList, signIn, toggleOf, treeItem, treeRows, visibleCodes } from './common';

/** Ventana que se observa antes de juzgar que «no pasa nada» (tres segundos: más que cualquier reacción local de la pantalla). */
const REACTION_MS = 3000;

// US-REQ-ARBOL-006 — Recorrer el árbol y las pestañas con el teclado (web). Preparación de cada fila: reinicio de alumno01 con su administrador,
// inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 (contexto sin sesión) y llegada a Programas. El foco se pone con `focus()`
// sobre la fila o la pestaña de la historia, y las teclas se pulsan con el teclado de la página.

const prepare = async (page: Page, width = '1440 px'): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, DEMO.gestor, width);
};

/** Código de la fila que tiene el foco (su nombre accesible empieza por el código), o su etiqueta si no es una fila. */
const focusedCode = (page: Page): Promise<string> =>
  page
    .evaluate(() => {
      const element = document.activeElement;
      return element?.getAttribute('aria-label') ?? element?.getAttribute('role') ?? element?.tagName ?? '';
    })
    .then((label) => /^(REQ-\d{3})/.exec(label)?.[1] ?? label)
    .catch(() => '(sin foco legible)');

/** Espera a que la fila tenga el foco (el foco se mueve en el siguiente fotograma) y devuelve lo que tiene el foco. */
const settleFocus = async (page: Page, code: string): Promise<string> => {
  await waitUntil(async () => (await focusedCode(page)) === code);
  return focusedCode(page);
};

/** Teclas de la historia (texto de la celda → tecla de Playwright). */
const KEYS: ReadonlyMap<string, string> = new Map<string, string>([
  ['flecha abajo', 'ArrowDown'],
  ['flecha arriba', 'ArrowUp'],
  ['flecha izquierda', 'ArrowLeft'],
  ['flecha derecha', 'ArrowRight'],
  ['Fin', 'End'],
  ['Inicio', 'Home'],
]);

// --- Esquema 1: las flechas arriba y abajo y las teclas de inicio y fin recorren las filas visibles ----------------------------------------

const moveFocus: BrowserRowHandler = async (row, { page }) => {
  const desde = cell(row, 'desde');
  const tecla = cell(row, 'tecla');
  const hasta = cell(row, 'hasta');
  const expected = `el foco pasa de ${desde} a ${hasta} con ${tecla}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const focused = await interact(treeItem(page, desde), `poner el foco en la fila de ${desde}`, (el) => el.focus());
  if (focused) return actionFailed(expected, focused);
  const before = await settleFocus(page, desde);
  await page.keyboard.press(strict('tecla', KEYS, tecla));
  await sleep(REACTION_MS);
  const after = await settleFocus(page, hasta);
  return conclude([check(before === desde, `el foco está en ${desde} antes de la tecla`, `el foco está en ${before}`), check(after === hasta, `el foco está en la fila de ${hasta}`, `el foco está en ${after}`)]);
};

// --- Esquema 2: las flechas derecha e izquierda plegan, despliegan o llevan el foco al padre o al primer hijo ----------------------------

/** Estado inicial de la fila de la historia: «desplegada», «plegada» o «sin hijos» (la prueba pliega antes si hace falta). */
const START: ReadonlyMap<string, 'desplegada' | 'plegada' | 'sin hijos'> = new Map<string, 'desplegada' | 'plegada' | 'sin hijos'>([
  ['desplegada', 'desplegada'],
  ['plegada', 'plegada'],
  ['sin hijos', 'sin hijos'],
]);

/** Lo que cada resultado de la historia exige, como comprobaciones sobre lo medido. */
type Expectation = (before: readonly string[], after: readonly string[], focus: string, expandedOf: (code: string) => Promise<string | undefined>) => Promise<readonly Check[]>;

const RESULT_CHECKS: ReadonlyMap<string, Expectation> = new Map<string, Expectation>([
  [
    'REQ-003 se pliega, deja de verse REQ-004 y el foco sigue en REQ-003',
    async (_b, after, focus, expandedOf) => [
      check(!after.includes('REQ-004'), 'deja de verse REQ-004', after.includes('REQ-004') ? 'sigue viendo REQ-004' : 'no ve REQ-004'),
      check(focus === 'REQ-003', 'el foco sigue en REQ-003', `el foco está en ${focus}`),
      check((await expandedOf('REQ-003')) === 'false', 'REQ-003 plegado', `REQ-003 con aria-expanded ${String(await expandedOf('REQ-003'))}`),
    ],
  ],
  [
    'REQ-003 se despliega, vuelve a verse REQ-004 y el foco sigue en REQ-003',
    async (_b, after, focus, expandedOf) => [
      check(after.includes('REQ-004'), 'vuelve a verse REQ-004', after.includes('REQ-004') ? 've REQ-004' : 'no ve REQ-004'),
      check(focus === 'REQ-003', 'el foco sigue en REQ-003', `el foco está en ${focus}`),
      check((await expandedOf('REQ-003')) === 'true', 'REQ-003 desplegado', `REQ-003 con aria-expanded ${String(await expandedOf('REQ-003'))}`),
    ],
  ],
  ['el foco pasa a REQ-004', async (_b, _a, focus) => [check(focus === 'REQ-004', 'el foco pasa a REQ-004', `el foco está en ${focus}`)]],
  ['el foco pasa a REQ-003', async (_b, _a, focus) => [check(focus === 'REQ-003', 'el foco pasa a REQ-003', `el foco está en ${focus}`)]],
  [
    'no pasa nada y el foco sigue en REQ-002',
    async (before, after, focus) => [check(focus === 'REQ-002', 'el foco sigue en REQ-002', `el foco está en ${focus}`), check(sameList(before, after), 'la lista visible no cambia', `la lista visible: antes ${before.join(', ')}; después ${after.join(', ')}`)],
  ],
  [
    'no pasa nada y el foco sigue en REQ-001',
    async (before, after, focus) => [check(focus === 'REQ-001', 'el foco sigue en REQ-001', `el foco está en ${focus}`), check(sameList(before, after), 'la lista visible no cambia', `la lista visible: antes ${before.join(', ')}; después ${after.join(', ')}`)],
  ],
]);

const arrowAction: BrowserRowHandler = async (row, { page }) => {
  const fila = cell(row, 'fila');
  const estado = strict('estado', START, cell(row, 'estado'));
  const tecla = cell(row, 'tecla');
  const resultado = cell(row, 'resultado');
  const expected = `${fila} ${estado}, ${tecla}: ${resultado}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  if (estado === 'plegada') {
    const folded = await interact(toggleOf(page, `Contraer ${fila}`), `pulsar «Contraer ${fila}»`, (el) => el.click(ACTION));
    if (folded) return actionFailed(expected, folded);
    await waitUntil(async () => !(await visibleCodes(page)).includes('REQ-004') || fila !== 'REQ-003');
  }
  const focused = await interact(treeItem(page, fila), `poner el foco en la fila de ${fila}`, (el) => el.focus());
  if (focused) return actionFailed(expected, focused);
  const start = await settleFocus(page, fila);
  if (start !== fila) return preparationFailedWeb(expected, `el foco está en ${start} y no en ${fila} antes de la tecla`);
  const before = await visibleCodes(page);
  await page.keyboard.press(strict('tecla', KEYS, tecla));
  // Reacción local de la propia pantalla (~1 s): se observa esa ventana antes de juzgar «no pasa nada»
  await sleep(REACTION_MS);
  const after = await visibleCodes(page);
  const focus = await focusedCode(page);
  const expandedOf = async (code: string): Promise<string | undefined> => (await treeRows(page)).find((row) => row.code === code)?.expanded;
  const expectation = strict('resultado', RESULT_CHECKS, resultado);
  const checks = await expectation(before, after, focus, expandedOf);
  return conclude(checks, { note: estado === 'plegada' ? `La prueba pliega «${fila}» con su botón antes de pulsar la tecla (precondición «plegada»).` : undefined });
};

// --- Esquema 3: la tecla Intro abre el detalle del requisito con el foco ---------------------------------------------------------------

const enterOpens: BrowserRowHandler = async (row, { page }) => {
  const fila = cell(row, 'fila');
  const expected = `ve el detalle de ${fila} y el foco está en ese detalle`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const focused = await interact(treeItem(page, fila), `poner el foco en la fila de ${fila}`, (el) => el.focus());
  if (focused) return actionFailed(expected, focused);
  const start = await settleFocus(page, fila);
  if (start !== fila) return preparationFailedWeb(expected, `el foco está en ${start} y no en ${fila} antes de Intro`);
  await page.keyboard.press('Enter');
  const detail = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);
  await waitUntil(async () => (await detail.count()) > 0);
  const code = (await detail.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE).innerText({ timeout: 2000 }).catch(() => '')).trim();
  const inside = await detail.evaluate((node) => node.contains(document.activeElement), undefined, { timeout: 2000 }).catch(() => false);
  return conclude([eq('el código del detalle', code, fila), check(inside, 'el foco está en el detalle', inside ? 'el foco está en el detalle' : 'el foco no está en el detalle')]);
};

// --- Esquema 4: la tecla Esc quita el foco de un campo o cierra el detalle --------------------------------------------------------

const SITUATION: ReadonlyMap<string, 'en-campo' | 'fuera'> = new Map<string, 'en-campo' | 'fuera'>([
  ['el foco está en el campo «Título» del detalle', 'en-campo'],
  ['el foco está fuera de los campos de texto', 'fuera'],
]);
const STEP_RESULT: ReadonlyMap<string, 'sale-del-campo' | 'se-cierra' | 'nada'> = new Map<string, 'sale-del-campo' | 'se-cierra' | 'nada'>([
  ['el foco sale del campo y el detalle de REQ-017 sigue abierto', 'sale-del-campo'],
  ['el detalle de REQ-017 se cierra', 'se-cierra'],
  ['no pasa nada y no hay ningún detalle abierto', 'nada'],
]);

const escape: BrowserRowHandler = async (row, { page }) => {
  const situacion = strict('situacion', SITUATION, cell(row, 'situacion'));
  const primera = strict('primera', STEP_RESULT, cell(row, 'primera'));
  const segunda = strict('segunda', STEP_RESULT, cell(row, 'segunda'));
  const expected = `${cell(row, 'situacion')}: ${cell(row, 'primera')}; y luego ${cell(row, 'segunda')}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements?select=REQ-017');
  const detail = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);
  await waitUntil(async () => (await detail.count()) > 0);
  const title = page.getByLabel('Título', { exact: true });
  if (situacion === 'en-campo') {
    const focused = await interact(title, 'poner el foco en el campo «Título»', (el) => el.focus());
    if (focused) return actionFailed(expected, focused);
  }
  const fieldFocused = await title.evaluate((node) => node === document.activeElement, undefined, { timeout: 2000 }).catch(() => false);
  await page.keyboard.press('Escape');
  await sleep(REACTION_MS);
  const openAfterFirst = (await detail.count()) > 0;
  const fieldAfterFirst = await title.evaluate((node) => node === document.activeElement, undefined, { timeout: 2000 }).catch(() => false);
  const firstChecks: Check[] =
    primera === 'sale-del-campo'
      ? [check(!fieldAfterFirst, 'el foco sale del campo', fieldAfterFirst ? 'el foco sigue en el campo' : 'el foco sale del campo'), check(openAfterFirst, 'el detalle de REQ-017 sigue abierto', openAfterFirst ? 'el detalle sigue abierto' : 'el detalle se cerró')]
      : [check(!openAfterFirst, 'el detalle de REQ-017 se cierra', openAfterFirst ? 'el detalle sigue abierto' : 'el detalle se cerró')];
  await page.keyboard.press('Escape');
  await waitUntil(async () => (await detail.count()) === 0);
  const openAfterSecond = (await detail.count()) > 0;
  const secondChecks: Check[] =
    segunda === 'se-cierra'
      ? [check(!openAfterSecond, 'el detalle de REQ-017 se cierra', openAfterSecond ? 'el detalle sigue abierto' : 'el detalle se cerró')]
      : [check(!openAfterSecond, 'no hay ningún detalle abierto', openAfterSecond ? 'sigue abierto un detalle' : 'no hay ningún detalle abierto')];
  const precondition = situacion === 'en-campo' ? fieldFocused : !fieldFocused;
  return conclude([check(precondition, `precondición: ${cell(row, 'situacion')}`, precondition ? 'precondición cumplida' : 'el foco no está donde dice la historia'), ...firstChecks, ...secondChecks]);
};

// --- Esquema 5: la tecla barra pasa el foco al campo de búsqueda ----------------------------------------------------------------------

const slash: BrowserRowHandler = async (row, { page }) => {
  const expected = 'el foco está en el campo «Buscar requisitos» y puede escribir en él';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${cell(row, 'programa')}/requirements`);
  const focused = await interact(treeItem(page, 'REQ-001'), 'poner el foco en la fila de REQ-001', (el) => el.focus());
  if (focused) return actionFailed(expected, focused);
  const start = await settleFocus(page, 'REQ-001');
  if (start !== 'REQ-001') return preparationFailedWeb(expected, `el foco está en ${start} y no en REQ-001 antes de la barra`);
  await page.keyboard.press('/');
  const search: Locator = page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true });
  const onSearch = await search.evaluate((node) => node === document.activeElement, undefined, { timeout: 2000 }).catch(() => false);
  await page.keyboard.type('005');
  const value = await search.inputValue({ timeout: 2000 }).catch(() => '(no legible)');
  return conclude([check(onSearch, 'el foco está en «Buscar requisitos»', onSearch ? 'el foco está en «Buscar requisitos»' : 'el foco no está en «Buscar requisitos»'), eq('el texto escrito', value, '005')]);
};

// --- Esquema 6: las flechas izquierda y derecha cambian de pestaña y dan la vuelta en los extremos ---------------------------------------

const TAB: ReadonlyMap<string, string> = new Map<string, string>([
  ['flecha derecha', 'ArrowRight'],
  ['flecha izquierda', 'ArrowLeft'],
]);

const tabs: BrowserRowHandler = async (row, { page }) => {
  const desde = quotedOr(cell(row, 'desde'));
  const hasta = quotedOr(cell(row, 'hasta'));
  const expected = `la pestaña seleccionada es ${hasta} tras ${cell(row, 'tecla')}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-001/requirements');
  const from = page.getByRole('tab', { name: desde, exact: true });
  const focused = await interact(from, `situar el foco en la pestaña «${desde}» con el ratón`, (el) => el.click(ACTION));
  if (focused) return actionFailed(expected, focused);
  await page.keyboard.press(strict('tecla', TAB, cell(row, 'tecla')));
  const target = page.getByRole('tab', { name: hasta, exact: true });
  await waitUntil(async () => (await target.getAttribute('aria-selected', { timeout: 500 }).catch(() => null)) === 'true');
  const selected = await page
    .getByRole('tab')
    .evaluateAll((tabsNodes) => tabsNodes.filter((node) => node.getAttribute('aria-selected') === 'true').map((node) => node.textContent?.trim() ?? ''))
    .catch(() => [] as string[]);
  return conclude([eq('la pestaña seleccionada', selected[0], hasta), check(selected.length === 1, 'una sola pestaña seleccionada', `seleccionadas ${selected.length}`)], { note: 'Para situar el foco en la pestaña «desde» se pulsa con el ratón; a partir de ahí la prueba usa solo el teclado.' });
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(moveFocus)],
    [2, onWeb(arrowAction)],
    [3, onWeb(enterOpens)],
    [4, onWeb(escape)],
    [5, onWeb(slash)],
    [6, onWeb(tabs)],
  ]),
});
