import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { quoted } from '../../support/browser';
import { check, cell, strict } from '../../support/checks';
import { adminAccess, intOf, resetTenants, tickOf, TENANT_A } from '../api/common';
import {
  actionFailed,
  conclude,
  describeRow,
  failSummary,
  feedTexts,
  installRealtimeLink,
  markNoReload,
  prepFailed,
  prepFailedReason,
  readWeb,
  rowHas,
  settle,
  textCheck,
  togglePause,
  waitView,
  type RealtimeLink,
} from '../web/common';
import { onExpoWeb, startMobile, tickFeedFor } from './common';

// US-MISION-FEED-009 — Ver los eventos en directo en /mission: historia inicial, pausa y tope de 50 (app móvil, web de Expo a 390 px).
// Preparación: alumno01 reiniciado; el gestor inicia sesión en la app con «Tenant de trabajo» = alumno01, abre la pestaña «Panel de
// misión» y la conexión queda en vivo. Los eventos se provocan con POST /api/mission/tick (y las NC con POST /api/nc).

/** Lo que la historia da por hecho antes de cada pausa: la historia inicial (6 eventos) y, tras ella, un evento de la historia inicial. */
const INICIAL = 6;
const PRG001_LATENCIA_20 = 'Enlace de datos PRG-001: latencia 20 ms';

/** Prepara la fila: reinicio, conexión y lista con la historia inicial (6 eventos). Devuelve el fallo, si lo hay. */
const prepare = async (page: Page, expected: string): Promise<{ readonly link: RealtimeLink } | { readonly failed: ReturnType<typeof prepFailed> }> => {
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return { failed: prepFailed(expected, failure) };
  const initial = await waitView(page, (current) => current.feed.length === INICIAL);
  if (!initial.reached) return { failed: prepFailedReason(expected, `la historia inicial no tiene ${INICIAL} eventos (hay ${feedTexts(initial.view).length})`) };
  return { link };
};

// --- Esquema 1: al abrir /mission aparece la historia inicial, con el evento más reciente arriba --------------------------

const historiaInicial: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const posicion = intOf(cell(row, 'posicion'));
  const texto = quoted(cell(row, 'texto'));
  const expected = `en la posición ${posicion} de «Eventos en directo» aparece «${texto}» y el contador dice «6 eventos»`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const { view } = await waitView(page, (current) => current.feed.length === INICIAL);
  const item = feedTexts(view)[posicion - 1];
  return conclude([check(rowHas(item, texto), `la posición ${posicion} dice «${texto}»`, `la posición ${posicion} dice ${describeRow(item)}`), textCheck(view?.count, '6 eventos', 'el contador dice')]);
});

// --- Esquema 2: un evento nuevo aparece arriba sin recargar la pantalla --------------------------------------------------

const eventoNuevoArriba: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const textoPrimero = quoted(cell(row, 'texto_primero'));
  const contador = quoted(cell(row, 'contador'));
  const expected = `la primera fila dice «${textoPrimero}», el contador dice «${contador}» y la pantalla no se recarga`;
  const prep = await prepare(page, expected);
  if ('failed' in prep) return prep.failed;
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const reloads = await markNoReload(page);
  for (let index = 0; index < n; index += 1) await tickOf(admin.token, TENANT_A);
  const { view } = await waitView(page, (current) => current.feed.length === INICIAL + n);
  const reload = await reloads();
  const first = feedTexts(view)[0];
  return conclude([
    check(rowHas(first, textoPrimero), `la primera fila dice «${textoPrimero}»`, `la primera fila dice ${describeRow(first)}`),
    textCheck(view?.count, contador, 'el contador dice'),
    check(reload.marker && reload.loads === 0, 'la pantalla no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
  ]);
});

// --- Esquema 3: con la lista en pausa, los eventos nuevos esperan fuera de la lista ------------------------------------

const pausaRetiene: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `la lista sigue con 6 filas y el contador dice «6 eventos»; el aviso de pausa dice «${aviso}» y el botón dice «Reanudar feed»`;
  const prep = await prepare(page, expected);
  if ('failed' in prep) return prep.failed;
  const paused = await togglePause(page);
  if (paused) return actionFailed(expected, paused);
  if (n > 0) {
    const tick = await tickFeedFor(n);
    if (tick) return actionFailed(expected, tick);
    await waitView(page, (current) => current.pausedNote === aviso);
  } else {
    await settle();
  }
  const view = await readWeb(page);
  return conclude([
    check(feedTexts(view).length === 6, 'la lista sigue con 6 filas', `la lista tiene ${feedTexts(view).length} filas`),
    textCheck(view?.count, '6 eventos', 'el contador dice'),
    textCheck(view?.pausedNote, aviso, 'el aviso de pausa dice'),
    textCheck(view?.pauseLabel, 'Reanudar feed', 'el botón dice'),
  ]);
});

// --- Esquema 4: al reanudar, la lista muestra lo que llegó durante la pausa --------------------------------------------

const alReanudar: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const textoPrimero = quoted(cell(row, 'texto_primero'));
  const contador = quoted(cell(row, 'contador'));
  const expected = `al reanudar, la primera fila dice «${textoPrimero}», el contador dice «${contador}» y el aviso de pausa ya no aparece`;
  const prep = await prepare(page, expected);
  if ('failed' in prep) return prep.failed;
  const paused = await togglePause(page);
  if (paused) return actionFailed(expected, paused);
  const tick = await tickFeedFor(n);
  if (tick) return actionFailed(expected, tick);
  await waitView(page, (current) => current.pausedNote?.endsWith(`${n} eventos nuevos en espera`) === true);
  const resumed = await togglePause(page);
  if (resumed) return actionFailed(expected, resumed);
  const { view } = await waitView(page, (current) => current.feed.length === INICIAL + n);
  const first = feedTexts(view)[0];
  return conclude([
    check(rowHas(first, textoPrimero), `la primera fila dice «${textoPrimero}»`, `la primera fila dice ${describeRow(first)}`),
    textCheck(view?.count, contador, 'el contador dice'),
    check(view?.pausedNote === undefined, 'el aviso de pausa ya no aparece', `el aviso de pausa ${view?.pausedNote === undefined ? 'no aparece' : `dice «${view.pausedNote}»`}`),
  ]);
});

// --- Esquema 5: la lista muestra como máximo 50 eventos ----------------------------------------------------------------

const VISIBILIDAD: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['sigue', true],
  ['ya no aparece', false],
]);

const tope50: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const contador = quoted(cell(row, 'contador'));
  const visible = strict('visibilidad', VISIBILIDAD, cell(row, 'visibilidad'));
  const expected = `tras ${n} eventos el contador dice «${contador}» y el evento «${PRG001_LATENCIA_20}» ${visible ? 'sigue' : 'ya no aparece'} en la lista`;
  const prep = await prepare(page, expected);
  if ('failed' in prep) return prep.failed;
  const tick = await tickFeedFor(n);
  if (tick) return actionFailed(expected, tick);
  const { view } = await waitView(page, (current) => current.count === contador, 15_000);
  const present = feedTexts(view).some((item) => rowHas(item, PRG001_LATENCIA_20));
  return conclude([
    textCheck(view?.count, contador, 'el contador dice'),
    check(present === visible, `el evento «${PRG001_LATENCIA_20}» ${visible ? 'sigue' : 'ya no aparece'} en la lista`, `el evento ${present ? 'sigue' : 'ya no aparece'} en la lista`),
  ]);
});

// --- Esquema 6: «Esperando eventos…» solo mientras la lista no tiene ningún evento -----------------------------------

const ESPERANDO = 'Esperando eventos…';

const esperandoEventos: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const accion = strict('accion', new Map<string, 'silencio' | 'tick'>([
    ['la prueba no provoca ningún evento', 'silencio'],
    ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
  ]), cell(row, 'accion'));
  const resultado = cell(row, 'resultado');
  const expected = `${resultado} (con el resumen en 503)`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  await failSummary(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  if (accion === 'silencio') {
    await settle();
    const view = await readWeb(page);
    return conclude([
      check(feedTexts(view).length === 0, 'la lista está vacía', `la lista tiene ${feedTexts(view).length} filas`),
      textCheck(view?.empty, ESPERANDO, 'la lista muestra'),
    ]);
  }
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  await tickOf(admin.token, TENANT_A);
  const { view } = await waitView(page, (current) => current.feed.length === 1);
  const first = feedTexts(view)[0];
  return conclude([
    check(rowHas(first, 'Telemetría PRG-013: 766 paquetes/s'), 'la lista muestra «Telemetría PRG-013: 766 paquetes/s»', `la lista muestra ${describeRow(first)}`),
    check(view?.empty === undefined, `ya no muestra «${ESPERANDO}»`, view?.empty === undefined ? `no muestra «${ESPERANDO}»` : `aún muestra «${view.empty}»`),
  ]);
});

defineBrowserRows({
  story: 'US-MISION-FEED-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, historiaInicial],
    [2, eventoNuevoArriba],
    [3, pausaRetiene],
    [4, alReanudar],
    [5, tope50],
    [6, esperandoEventos],
  ]),
});
