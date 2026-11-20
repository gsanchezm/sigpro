import type { Locator, Page } from '@playwright/test';
import { BUSQUEDA_DYNAMIC_TESTIDS, BUSQUEDA_TESTIDS, REQUISITOS_TESTIDS, RESPONSIVE_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, holdsFor, isVisible, pathOf, quoted, runSteps, safe, textOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  DESKTOP,
  RESPONSIVE,
  actionFailed,
  activeOption,
  clickAction,
  fieldValue,
  headerSearch,
  isAscending,
  noted,
  optionOf,
  prepFailed,
  prepareWeb,
  signIn,
  topsOf,
  type Diagnosed,
} from './common';

// US-NAVEGACION-007 — Búsqueda de la cabecera: resultados agrupados, teclado, pantalla completa en responsive. Preparación de cada
// fila: reinicio de alumno01 e inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 (navegador sin sesión), y la página
// de la fila. Las esperas («retrasa 3 segundos», «hace fallar») se hacen interceptando GET /api/search en la propia prueba.

const SEARCH_ROUTE = '**/api/search**';
const TWO_CHARS = 'Escribe al menos 2 caracteres';
const SUMMARY_PRG_001 = '3 resultados en 2 grupos';

/** Identificadores de las dos variantes de la búsqueda (escritorio y pantalla completa responsive), tomados de testids.ts. */
interface Ids {
  readonly group: (kind: string) => Locator;
  readonly total: (kind: string) => Locator;
  readonly item: (kind: string, id: string) => Locator;
  readonly status: Locator;
  readonly list: Locator;
}

const desktopIds = (page: Page): Ids => ({
  group: (kind) => page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP(kind)),
  total: (kind) => page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL(kind)),
  item: (kind, id) => page.getByTestId(BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM(kind, id)),
  status: page.getByTestId(BUSQUEDA_TESTIDS.GLOBAL_SEARCH_STATUS),
  list: page.getByTestId(BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LIST),
});

const allKinds = ['program', 'requirement', 'testcase', 'nc', 'document'] as const;

/** Escribe en el cuadro como una persona (clic y tecla a tecla); devuelve el fallo del paso o `undefined`. */
const typeInto = (text: string, field: Locator): Promise<string | undefined> =>
  runSteps([
    ['pulsar el cuadro «Búsqueda global»', () => field.click(ACTION)],
    [`escribir ${text} en «Búsqueda global»`, () => field.pressSequentially(text, { delay: 0 })],
  ]);

/** Texto del aviso de estado (la región `status`), con plazo. */
const statusOf = (ids: Ids): Promise<string | undefined> => textOf(ids.status);

/** Posiciones verticales medidas de los grupos (el observado de la comprobación de orden), o un aviso si alguno no se lee. */
const orderText = (tops: readonly number[] | undefined): string => (tops === undefined ? 'algún grupo no se lee' : `posiciones verticales ${tops.map((top) => String(Math.round(top))).join(' y ')}`);

// --- Esquema 1: escribir en el cuadro de escritorio muestra los resultados agrupados o el aviso ------------------------------

type Scene = (page: Page) => Promise<readonly Check[]>;

const SEARCH_RESULTS: ReadonlyMap<string, Scene> = new Map<string, Scene>([
  [
    'el aviso «Escribe al menos 2 caracteres» y ningún grupo',
    async (page) => {
      const ids = desktopIds(page);
      const status = await waitUntil(async () => (await statusOf(ids)) === TWO_CHARS);
      const groups = await Promise.all(allKinds.map((kind) => isVisible(ids.group(kind))));
      return [
        check(status.reached, `ve «${TWO_CHARS}»`, status.reached ? `ve «${TWO_CHARS}»` : `ve «${(await statusOf(ids)) ?? '(sin aviso)'}»`),
        check(groups.every((visible) => !visible), 'ningún grupo', `${String(groups.filter(Boolean).length)} grupos visibles`),
      ];
    },
  ],
  [
    'el grupo «Programas» con total 1 y el grupo «Documentos» con total 2, en ese orden, y el aviso «3 resultados en 2 grupos»',
    async (page) => {
      const ids = desktopIds(page);
      const summary = await waitUntil(async () => (await statusOf(ids)) === SUMMARY_PRG_001);
      const programTotal = (await textOf(ids.total('program'))) ?? '(sin total)';
      const documentTotal = (await textOf(ids.total('document'))) ?? '(sin total)';
      const tops = await topsOf([ids.group('program'), ids.group('document')]);
      return [
        check(summary.reached, `aviso «${SUMMARY_PRG_001}»`, `aviso «${(await statusOf(ids)) ?? '(sin aviso)'}»`),
        check(programTotal === '1' && documentTotal === '2', 'Programas con total 1 y Documentos con total 2', `Programas total ${programTotal}; Documentos total ${documentTotal}`),
        check(isAscending(tops), 'Programas antes que Documentos', orderText(tops)),
      ];
    },
  ],
  [
    'el grupo «Requisitos» con el total «5 / 40» y, dentro, los resultados REQ-001 a REQ-005',
    async (page) => {
      const ids = desktopIds(page);
      const total = await waitUntil(async () => (await textOf(ids.total('requirement'))) === '5 / 40');
      const shown = await Promise.all(['REQ-001', 'REQ-002', 'REQ-003', 'REQ-004', 'REQ-005'].map((id) => isVisible(ids.item('requirement', id))));
      return [
        check(total.reached, 'Requisitos con total «5 / 40»', `Requisitos con total «${(await textOf(ids.total('requirement'))) ?? '(sin total)'}»`),
        check(shown.every(Boolean), 'dentro, REQ-001 a REQ-005', `visibles ${String(shown.filter(Boolean).length)} de 5`),
      ];
    },
  ],
  [
    'el aviso «Sin resultados para «zz»» y ningún grupo',
    async (page) => {
      const ids = desktopIds(page);
      const empty = await waitUntil(async () => (await statusOf(ids)) === 'Sin resultados para «zz»');
      const groups = await Promise.all(allKinds.map((kind) => isVisible(ids.group(kind))));
      return [
        check(empty.reached, 'aviso «Sin resultados para «zz»»', `aviso «${(await statusOf(ids)) ?? '(sin aviso)'}»`),
        check(groups.every((visible) => !visible), 'ningún grupo', `${String(groups.filter(Boolean).length)} grupos visibles`),
      ];
    },
  ],
]);

const typed: BrowserRowHandler = async (row, { page }) => {
  const text = cell(row, 'texto');
  const expected = cell(row, 'resultado');
  const scene = strict('resultado', SEARCH_RESULTS, expected);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  const typing = await typeInto(text, headerSearch(page));
  if (typing) return actionFailed(expected, { message: typing, note: 'el cuadro no recibe el texto' });
  return conclude(await scene(page));
};

// --- Esquema 2: el teclado recorre los resultados, abre el activo y cierra la lista ------------------------------------------

const KEYS: ReadonlyMap<string, (page: Page) => Promise<unknown>> = new Map<string, (page: Page) => Promise<unknown>>([
  ['la flecha de abajo', (page) => page.keyboard.press('ArrowDown')],
  [
    'la flecha de abajo y después la de arriba',
    async (page) => {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowUp');
    },
  ],
  ['Intro', (page) => page.keyboard.press('Enter')],
  ['Esc', (page) => page.keyboard.press('Escape')],
]);

const KEY_RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    'queda marcado como activo el segundo resultado, DOC-001',
    async (page) => {
      const active = await waitUntil(async () => ((await activeOption(page)) ?? '').startsWith('DOC-001'));
      return [check(active.reached, 'activo DOC-001 (segundo resultado)', `activo ${(await activeOption(page)) ?? '(ninguno)'}`)];
    },
  ],
  [
    'queda marcado como activo el primer resultado, PRG-001',
    async (page) => {
      const active = await waitUntil(async () => ((await activeOption(page)) ?? '').startsWith('PRG-001'));
      return [check(active.reached, 'activo PRG-001 (primer resultado)', `activo ${(await activeOption(page)) ?? '(ninguno)'}`)];
    },
  ],
  [
    'se abre /programs/PRG-001 y el cuadro «Búsqueda global» queda vacío',
    async (page) => {
      const arrived = await waitUntil(async () => pathOf(page) === '/programs/PRG-001');
      const value = await fieldValue(headerSearch(page));
      return [
        check(arrived.reached, 'se abre /programs/PRG-001', arrived.reached ? 'se abre /programs/PRG-001' : `ruta ${pathOf(page)}`),
        check(value === '', 'el cuadro vacío', `el cuadro contiene ${value === undefined ? '(no legible)' : `«${value}»`}`),
      ];
    },
  ],
  [
    'la lista se cierra, el cuadro conserva PRG-001 y la página sigue en /nc',
    async (page) => {
      const closed = await waitUntil(async () => !(await isVisible(desktopIds(page).list)));
      const value = await fieldValue(headerSearch(page));
      return [
        check(closed.reached, 'la lista se cierra', closed.reached ? 'la lista se cierra' : 'la lista sigue abierta'),
        check(value === 'PRG-001', 'el cuadro conserva PRG-001', `el cuadro contiene ${value === undefined ? '(no legible)' : `«${value}»`}`),
        check(pathOf(page) === '/nc', 'la página sigue en /nc', `ruta ${pathOf(page)}`),
      ];
    },
  ],
]);

const keyboard: BrowserRowHandler = async (row, { page }) => {
  const press = strict('tecla', KEYS, cell(row, 'tecla'));
  const expected = cell(row, 'resultado');
  const scene = strict('resultado', KEY_RESULTS, expected);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  const typing = await typeInto('PRG-001', headerSearch(page));
  if (typing) return actionFailed(expected, { message: typing, note: 'el cuadro no recibe el texto' });
  const summary = await waitUntil(async () => (await statusOf(desktopIds(page))) === SUMMARY_PRG_001);
  if (!summary.reached) return prepFailed(expected, `no llegan los resultados de PRG-001 (aviso ${(await statusOf(desktopIds(page))) ?? '(sin aviso)'})`);
  const pressed = await runSteps([[`pulsar ${cell(row, 'tecla')}`, () => press(page)]]);
  if (pressed) return actionFailed(expected, { message: pressed, note: 'la tecla no llega al cuadro' });
  return conclude(await scene(page));
};

// --- Esquema 3: pulsar un resultado lleva a su página y vacía el cuadro -----------------------------------------------------

/** Destino de cada fila de la columna «destino» (requisito con su selección, o la página del resultado). */
const DESTINATION: ReadonlyMap<string, string> = new Map<string, string>([
  ['/programs/PRG-001/requirements, con REQ-001 seleccionado', '/programs/PRG-001/requirements'],
  ['/verification/TC-001', '/verification/TC-001'],
  ['/nc/NC-001', '/nc/NC-001'],
  ['/documents/DOC-001', '/documents/DOC-001'],
]);

const picked: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'destino');
  const path = strict('destino', DESTINATION, expected);
  const code = cell(row, 'codigo');
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  const typing = await typeInto(cell(row, 'texto'), headerSearch(page));
  if (typing) return actionFailed(expected, { message: typing, note: 'el cuadro no recibe el texto' });
  const shown = await waitUntil(() => isVisible(optionOf(page, code)));
  if (!shown.reached) return prepFailed(expected, `no aparece el resultado ${code} tras escribir ${cell(row, 'texto')}`);
  const clicked: Diagnosed | undefined = await clickAction(page, optionOf(page, code), `pulsar el resultado ${code}`);
  if (clicked) return actionFailed(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === path);
  const value = await fieldValue(headerSearch(page));
  const selected = expected.includes('REQ-001') ? await requirementSelected(page) : undefined;
  return conclude([
    check(arrived.reached, `llega a ${path}`, arrived.reached ? `llega a ${path}` : `ruta ${pathOf(page)}`),
    ...(selected === undefined ? [] : [check(selected === 'REQ-001', 'con REQ-001 seleccionado', `seleccionado ${selected}`)]),
    check(value === '', 'el cuadro «Búsqueda global» vacío', `el cuadro contiene ${value === undefined ? '(no legible)' : `«${value}»`}`),
  ]);
};

/** Código del requisito abierto en su detalle (la pantalla de requisitos lo muestra al seleccionarlo); `undefined` si no se lee. */
const requirementSelected = (page: Page): Promise<string | undefined> => safe(() => textOf(page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE)), undefined);

// --- Esquema 4: mientras la búsqueda espera la respuesta o falla, el aviso lo dice ------------------------------------------

type Mode = 'delay' | 'fail';
const MODES: ReadonlyMap<string, Mode> = new Map<string, Mode>([
  ['retrasa 3 segundos', 'delay'],
  ['hace fallar', 'fail'],
]);

const waitingAndFailing: BrowserRowHandler = async (row, { page }) => {
  const mode = strict('condicion', MODES, cell(row, 'condicion'));
  const notice = quoted(cell(row, 'aviso'));
  const expected = `ve el aviso «${notice}» y después: ${cell(row, 'despues')}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la página /nc no abre' });
  // La intercepción se instala ANTES de escribir: así la respuesta llega (o falla) con el retraso o el error de la fila
  await page.route(SEARCH_ROUTE, async (route) => {
    if (mode === 'delay') {
      await sleep(3_000);
      await route.continue();
      return;
    }
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', message: 'prueba' }) });
  });
  const typing = await typeInto('PRG-001', headerSearch(page));
  if (typing) return actionFailed(expected, { message: typing, note: 'el cuadro no recibe el texto' });
  const ids = desktopIds(page);
  const notified = await waitUntil(async () => (await statusOf(ids)) === notice, 2_500);
  const checks: Check[] = [check(notified.reached, `ve el aviso «${notice}»`, notified.reached ? `ve el aviso «${notice}»` : `aviso «${(await statusOf(ids)) ?? '(sin aviso)'}»`)];
  if (mode === 'delay') {
    const answered = await waitUntil(async () => (await textOf(ids.total('program'))) === '1' && (await textOf(ids.total('document'))) === '2');
    checks.push(check(answered.reached, 've los grupos Programas y Documentos', answered.reached ? 've los grupos Programas y Documentos' : `aviso ${(await statusOf(ids)) ?? '(sin aviso)'}`));
  } else {
    const groups = await Promise.all(allKinds.map((kind) => isVisible(ids.group(kind))));
    checks.push(check(groups.every((visible) => !visible), 'ningún grupo', `${String(groups.filter(Boolean).length)} grupos visibles`));
  }
  return conclude(checks);
};

// --- Esquema 5: en responsive la búsqueda se abre a pantalla completa, con el campo y los mismos resultados ------------------

const SCREEN_ICON = (page: Page): Locator => page.getByRole('button', { name: 'Búsqueda global', exact: true });
const SCREEN = (page: Page): Locator => page.getByTestId(RESPONSIVE_TESTIDS.LAYOUT_SEARCH_SCREEN);
const SCREEN_FIELD = (page: Page): Locator => page.getByRole('combobox', { name: 'Búsqueda global', exact: true });

const SCREEN_ACTIONS: ReadonlyMap<string, (page: Page) => Promise<Diagnosed | undefined>> = new Map<string, (page: Page) => Promise<Diagnosed | undefined>>([
  ['pulsa el icono «Búsqueda global» de la cabecera', (page) => clickAction(page, SCREEN_ICON(page), 'pulsar el icono «Búsqueda global»')],
  [
    'pulsa el icono «Búsqueda global», escribe PRG-001 y pulsa el resultado PRG-001',
    async (page) => {
      const opened = await clickAction(page, SCREEN_ICON(page), 'pulsar el icono «Búsqueda global»');
      if (opened) return opened;
      const typing = await typeInto('PRG-001', SCREEN_FIELD(page));
      if (typing) return { message: typing, note: 'el campo de la pantalla no recibe el texto' };
      await waitUntil(() => isVisible(optionOf(page, 'PRG-001')));
      return clickAction(page, optionOf(page, 'PRG-001'), 'pulsar el resultado PRG-001');
    },
  ],
  [
    'pulsa el icono «Búsqueda global» y después «Cerrar»',
    async (page) => {
      const opened = await clickAction(page, SCREEN_ICON(page), 'pulsar el icono «Búsqueda global»');
      if (opened) return opened;
      await waitUntil(() => isVisible(SCREEN(page)));
      return clickAction(page, SCREEN(page).getByRole('button', { name: 'Cerrar', exact: true }), 'pulsar «Cerrar»');
    },
  ],
  ['mira la cabecera', async () => undefined],
]);

const SCREEN_RESULTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    've la pantalla de búsqueda con el campo «Búsqueda global» y el aviso «Escribe al menos 2 caracteres»',
    async (page) => {
      const screen = await waitUntil(() => isVisible(SCREEN(page)));
      const field = await isVisible(SCREEN_FIELD(page));
      const hint = await seenHint(page);
      return [
        check(screen.reached && field, 've la pantalla con el campo «Búsqueda global»', screen.reached && field ? 've la pantalla con el campo «Búsqueda global»' : 'no ve la pantalla con el campo'),
        check(hint, `ve «${TWO_CHARS}»`, hint ? `ve «${TWO_CHARS}»` : `no ve «${TWO_CHARS}»`),
      ];
    },
  ],
  [
    'llega a /programs/PRG-001 y la pantalla de búsqueda se ha cerrado',
    async (page) => {
      const arrived = await waitUntil(async () => pathOf(page) === '/programs/PRG-001');
      const closed = await waitUntil(async () => !(await isVisible(SCREEN(page))));
      return [
        check(arrived.reached, 'llega a /programs/PRG-001', arrived.reached ? 'llega a /programs/PRG-001' : `ruta ${pathOf(page)}`),
        check(closed.reached, 'la pantalla de búsqueda se ha cerrado', closed.reached ? 'la pantalla de búsqueda se ha cerrado' : 'la pantalla sigue abierta'),
      ];
    },
  ],
  [
    'vuelve a ver el icono «Búsqueda global» en la cabecera y sigue en /nc',
    async (page) => {
      const closed = await waitUntil(async () => !(await isVisible(SCREEN(page))));
      const icon = await waitUntil(() => isVisible(SCREEN_ICON(page)));
      return [
        check(closed.reached, 'la pantalla se cierra', closed.reached ? 'la pantalla se cierra' : 'la pantalla sigue abierta'),
        check(icon.reached && pathOf(page) === '/nc', 've el icono «Búsqueda global» y sigue en /nc', `icono ${icon.reached ? 'visible' : 'ausente'}; ruta ${pathOf(page)}`),
      ];
    },
  ],
  [
    'no ve el icono «Búsqueda global», porque la página trae su propio buscador',
    async (page) => {
      await waitUntil(() => isVisible(page.getByRole('heading', { name: 'Programas', exact: true })));
      const absent = await holdsFor(async () => !(await isVisible(SCREEN_ICON(page))), 1_500);
      return [check(absent.held, 'no ve el icono «Búsqueda global»', absent.held ? 'no ve el icono «Búsqueda global»' : 'el icono está en la cabecera')];
    },
  ],
]);

/** El aviso de mínimo de caracteres, visible en la pantalla completa (el texto aparece con el campo vacío o con una letra). */
const seenHint = async (page: Page): Promise<boolean> => {
  const hint = page.getByText(TWO_CHARS, { exact: true });
  return (await safe(() => hint.count(), 0)) === 1 && (await safe(() => hint.first().isVisible(), false));
};

const fullScreen: BrowserRowHandler = async (row, { page }) => {
  const route = cell(row, 'ruta');
  const act = strict('accion', SCREEN_ACTIONS, cell(row, 'accion'));
  const expected = cell(row, 'resultado');
  const scene = strict('resultado', SCREEN_RESULTS, expected);
  await prepareWeb(page, RESPONSIVE);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const opened = await runSteps([[`abrir ${route}`, () => page.goto(route, { timeout: CEILING_MS })]]);
  if (opened) return actionFailed(expected, { message: opened, note: 'la ruta no abre' });
  const acted = await act(page);
  if (acted) return actionFailed(expected, acted);
  return conclude(await scene(page));
};

// --- Esquema 6: en Programas el cuadro filtra la tabla y no abre resultados --------------------------------------------------

const programsFilter: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'direccion');
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const typing = await typeInto(cell(row, 'texto'), headerSearch(page));
  if (typing) return actionFailed(expected, { message: typing, note: 'el cuadro no recibe el texto' });
  const address = async (): Promise<string | undefined> => safe(async () => `${new URL(page.url()).pathname}${new URL(page.url()).search}`, undefined);
  const moved = await waitUntil(async () => (await address()) === expected);
  const list = await holdsFor(async () => !(await isVisible(desktopIds(page).list)), 1_000);
  return conclude([
    check(moved.reached, `la dirección pasa a ser ${expected}`, `la dirección es ${(await address()) ?? '(no legible)'}`),
    check(list.held, 'no ve ninguna lista de resultados', list.held ? 'no ve ninguna lista de resultados' : 'aparece una lista de resultados'),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(typed)],
    [2, noted(keyboard)],
    [3, noted(picked)],
    [4, noted(waitingAndFailing)],
    [5, noted(fullScreen)],
    [6, noted(programsFilter)],
  ]),
});
