import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, runSteps, textOf, waitUntil } from '../../support/browser';

import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  afterListResponse,
  cardCount,
  codesOf,
  countCheck,
  delayPrograms,
  DIRECT_APPROXIMATION,
  emptyBlock,
  errorAlert,
  failPrograms,
  listCheck,
  listedCodes,
  loadingState,
  loadMoreButton,
  onExpoWeb,
  PROGRAMS_PATH,
  searchBox,
  seenCheck,
  signIn,
  statusChoice,
  strictSeen,
  waitForList,
} from './common';

// US-PROG-LISTA-010 — Estados de carga, vacío y error de la lista de programas en la app móvil (web de Expo a 390 px). Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador; gestor@sigpro.test inicia sesión en la app y llega a /programs.
// La demora y los errores de GET /api/programs los provoca la prueba DESPUÉS de entrar y ANTES de abrir la lista. El veredicto vale
// para Expo web, no para iOS ni Android nativo.

const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** La respuesta que la historia hace fallar: solo «un error 500» (la prueba responde 500 a la petición). */
const FAILED_RESPONSE: ReadonlyMap<string, number> = new Map<string, number>([['un error 500', 500]]);

/** Filtros de la historia que dejan la lista sin coincidencias (un texto, o un estado y un texto). */
const EMPTY_FILTERS: ReadonlyMap<string, (page: Page) => Promise<void>> = new Map<string, (page: Page) => Promise<void>>([
  ['escribe zzzz-no-existe en «Buscar programas»', (page) => afterListResponse(page, () => searchBox(page).fill('zzzz-no-existe', ACTION))],
  [
    'elige «Cancelado» en el grupo «Estado» y escribe radar en «Buscar programas»',
    async (page) => {
      await afterListResponse(page, () => statusChoice(page, 'Cancelado').click(ACTION));
      await afterListResponse(page, () => searchBox(page).fill('radar', ACTION));
    },
  ],
]);

const FIRST_TEN = codesOf('PRG-001 a PRG-010');
const FIRST_TWENTY = codesOf('PRG-001 a PRG-020');

// --- Esquema 1: mientras llega la respuesta se ve «Cargando…» y después los programas ----------------------------------------

const loadingFirst: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const ms = strict('espera', ESPERA, cell(row, 'espera'));
  const expected = 've «Cargando…» y ninguna tarjeta, y al llegar la respuesta ve los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  await delayPrograms(page, ms);
  // Se vuelve a abrir /programs con la respuesta retrasada. Se mira durante la espera (con el techo por defecto): se anota si se vio
  // «Cargando…» y cuántas tarjetas había en ese momento. Si los datos llegaron antes de verlo, la comprobación no se cumple.
  await page.goto(PROGRAMS_PATH, { timeout: 10_000 });
  const seen: { loading: boolean; cards?: number; text?: string } = { loading: false };
  await waitUntil(async () => {
    if (await strictSeen(loadingState(page))) {
      seen.loading = true;
      seen.cards ??= await cardCount(page);
      seen.text ??= await textOf(loadingState(page));
    }
    return seen.loading || (await cardCount(page)) > 0;
  });
  const shown = await waitForList(page, FIRST_TEN, '1–10 de 24');
  return conclude(
    [
      check(seen.loading && seen.text?.includes('Cargando…') === true, 've «Cargando…» mientras espera', `${seen.loading ? 'se ve' : 'no se ve'} «Cargando…» (texto «${seen.text ?? '(sin leer)'}»)`),
      check(seen.cards === 0, 'ninguna tarjeta mientras espera', `${seen.cards ?? '(sin leer)'} tarjetas mientras espera`),
      listCheck(shown.codes, FIRST_TEN),
      countCheck(shown.count, '1–10 de 24'),
    ],
    { note: DIRECT_APPROXIMATION },
  );
};

// --- Esquema 2: un filtro sin coincidencias muestra el bloque vacío con la opción de limpiar ----------------------------

const emptyFilter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const apply = strict('filtro', EMPTY_FILTERS, cell(row, 'filtro'));
  const expected = 've el título «Sin programas», el mensaje «Ningún programa coincide con los filtros aplicados.» y el botón «Limpiar filtros»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const applied = await runSteps([[`aplicar ${cell(row, 'filtro')}`, () => apply(page)]]);
  if (applied) return actionMissing(expected, applied);
  await waitUntil(() => isVisible(emptyBlock(page)));
  const block = emptyBlock(page);
  return conclude([
    await seenCheck(block.getByText('Sin programas', { exact: true }), 'el título «Sin programas»', 'el título'),
    await seenCheck(block.getByText('Ningún programa coincide con los filtros aplicados.', { exact: true }), 'el mensaje «Ningún programa coincide con los filtros aplicados.»', 'el mensaje'),
    await seenCheck(block.getByRole('button', { name: 'Limpiar filtros', exact: true }), 'el botón «Limpiar filtros»', 'el botón'),
  ]);
};

// --- Esquema 3: un fallo de la primera carga muestra el aviso con reintento ------------------------------------------------

const failedFirst: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  strict('respuesta_fallida', FAILED_RESPONSE, cell(row, 'respuesta_fallida'));
  const expected = 've el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y ninguna tarjeta; al pulsar «Reintentar» ve los programas PRG-001 a PRG-010 con el recuento «1–10 de 24»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  // La primera respuesta de la lista es el 500; las siguientes responden bien
  await failPrograms(page, 1);
  await page.goto(PROGRAMS_PATH, { timeout: 10_000 });
  const alert = errorAlert(page);
  await waitUntil(() => isVisible(alert));
  const seenAlert = await seenCheck(alert, 'el aviso «No se pudieron cargar los programas»', 'el aviso');
  const seenRetry = await seenCheck(alert.getByRole('button', { name: 'Reintentar', exact: true }), 'el botón «Reintentar»', 'el botón');
  const cardsBefore = await cardCount(page);
  const pressed = await runSteps([['pulsar «Reintentar»', () => afterListResponse(page, () => alert.getByRole('button', { name: 'Reintentar', exact: true }).click(ACTION))]]);
  if (pressed) return actionMissing(expected, pressed);
  const shown = await waitForList(page, FIRST_TEN, '1–10 de 24');
  return conclude([
    seenAlert,
    seenRetry,
    check(cardsBefore === 0, 'ninguna tarjeta', `${cardsBefore} tarjetas`),
    listCheck(shown.codes, FIRST_TEN),
    countCheck(shown.count, '1–10 de 24'),
  ], { note: DIRECT_APPROXIMATION });
};

// --- Esquema 4: un fallo al pedir más programas conserva los vistos y ofrece reintentar ----------------------------------

const failedMore: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  strict('respuesta_fallida', FAILED_RESPONSE, cell(row, 'respuesta_fallida'));
  const expected = 'siguen viéndose los programas PRG-001 a PRG-010, aparece el aviso «No se pudieron cargar los programas» con el botón «Reintentar» y «Cargar más» no aparece; al pulsar «Reintentar» ve los programas PRG-001 a PRG-020 con el recuento «1–20 de 24»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  // La página 2 falla la primera vez; la página 1 ya está cargada
  await failPrograms(page, 1, (url) => url.searchParams.get('page') === '2');
  const pressedMore = await runSteps([['pulsar «Cargar más»', () => afterListResponse(page, () => loadMoreButton(page).click(ACTION))]]);
  if (pressedMore) return actionMissing(expected, pressedMore);
  const alert = errorAlert(page);
  await waitUntil(() => isVisible(alert));
  const keptCodes = await listedCodes(page);
  const seenAlert = await seenCheck(alert, 'el aviso «No se pudieron cargar los programas»', 'el aviso');
  const seenRetry = await seenCheck(alert.getByRole('button', { name: 'Reintentar', exact: true }), 'el botón «Reintentar»', 'el botón');
  const moreShown = await strictSeen(loadMoreButton(page));
  const moreHidden = check(!moreShown, '«Cargar más» no aparece', moreShown ? '«Cargar más» aparece' : '«Cargar más» no aparece');
  const pressedRetry = await runSteps([['pulsar «Reintentar»', () => afterListResponse(page, () => alert.getByRole('button', { name: 'Reintentar', exact: true }).click(ACTION))]]);
  if (pressedRetry) return actionMissing(expected, pressedRetry);
  const shown = await waitForList(page, FIRST_TWENTY, '1–20 de 24');
  return conclude([
    listCheck(keptCodes, FIRST_TEN),
    seenAlert,
    seenRetry,
    moreHidden,
    listCheck(shown.codes, FIRST_TWENTY),
    countCheck(shown.count, '1–20 de 24'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-LISTA-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(loadingFirst)],
    [2, onExpoWeb(emptyFilter)],
    [3, onExpoWeb(failedFirst)],
    [4, onExpoWeb(failedMore)],
  ]),
});
