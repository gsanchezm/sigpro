import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { quoted } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { adminAccess, createNc, intOf, resetTenants, tickMany, tickOf, TENANT_A } from '../api/common';
import {
  describeRow,
  failSummary,
  feedTexts,
  installRealtimeLink,
  markNoReload,
  onWeb,
  prepFailed,
  prepFailedReason,
  readWeb,
  rowHas,
  settle,
  startWeb,
  textCheck,
  togglePause,
  conclude,
  waitView,
  actionFailed,
  type RealtimeLink,
} from './common';

// US-MISION-FEED-006 — Ver los eventos en directo en /mission: historia inicial, orden, pausa y tope de 50 (web, 1440 px).
// Preparación: alumno01 reiniciado; gestor@sigpro.test inicia sesión en la web, abre /mission y la conexión en tiempo real queda
// establecida. Los eventos se provocan con POST /api/mission/tick y las NC con POST /api/nc (token de alumno01@sigpro.lab).

/** Texto de la historia inicial (posición 6 y posición 1 de la lista): se citan en las celdas, no se leen de la app. */
const TEXTO_PRG001_LATENCIA_20 = 'Enlace de datos PRG-001: latencia 20 ms';

// --- Esquema 1: al abrir /mission aparece la historia inicial, con el evento más reciente arriba --------------------------

const historiaInicial: BrowserRowHandler = onWeb(async (row, { page }) => {
  const posicion = intOf(cell(row, 'posicion'));
  const texto = quoted(cell(row, 'texto'));
  const expected = `en la posición ${posicion} de «Eventos en directo» aparece «${texto}» y el contador dice «6 eventos»`;
  await resetTenants([TENANT_A]);
  const link: RealtimeLink = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const { view } = await waitView(page, (current) => current.feed.length === 6);
  const item = feedTexts(view)[posicion - 1];
  return conclude([check(rowHas(item, texto), `la posición ${posicion} dice «${texto}»`, `la posición ${posicion} dice ${describeRow(item)}`), textCheck(view?.count, '6 eventos', 'el contador dice')], {
    evidence: { filas: feedTexts(view).length },
  });
});

// --- Esquema 2: un evento nuevo aparece arriba sin recargar la página -------------------------------------------------------

const eventoNuevoArriba: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const textoPrimero = quoted(cell(row, 'texto_primero'));
  const contador = quoted(cell(row, 'contador'));
  const expected = `la primera fila dice «${textoPrimero}», el contador dice «${contador}» y la página no se recarga`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `la historia inicial no tiene 6 eventos (hay ${feedTexts(initial.view).length})`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const reloads = await markNoReload(page);
  const ticks = await tickMany(admin.token, TENANT_A, n);
  if (ticks.failed) return actionFailed(expected, { message: `${ticks.failed.step} respondió ${ticks.failed.result.status}`, callLog: [] });
  const { view } = await waitView(page, (current) => current.feed.length === 6 + n);
  const reload = await reloads();
  const first = feedTexts(view)[0];
  return conclude(
    [
      check(rowHas(first, textoPrimero), `la primera fila dice «${textoPrimero}»`, `la primera fila dice ${describeRow(first)}`),
      textCheck(view?.count, contador, 'el contador dice'),
      check(reload.marker && reload.loads === 0, 'la página no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
    ],
    { evidence: { eventosProvocados: n } },
  );
});

// --- Esquema 3: con el feed en pausa, los eventos nuevos esperan fuera de la lista ----------------------------------------

const pausaRetiene: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const aviso = quoted(cell(row, 'aviso'));
  const expected = `la lista sigue con 6 filas y el contador dice «6 eventos»; el aviso de pausa dice «${aviso}» y el botón dice «Reanudar feed»`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `la historia inicial no tiene 6 eventos (hay ${feedTexts(initial.view).length})`);
  const paused = await togglePause(page);
  if (paused) return actionFailed(expected, paused);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  if (n > 0) {
    const ticks = await tickMany(admin.token, TENANT_A, n);
    if (ticks.failed) return actionFailed(expected, { message: `${ticks.failed.step} respondió ${ticks.failed.result.status}`, callLog: [] });
  }
  // Con eventos, se espera a que el aviso cuente los que llegaron (la llegada se ve); sin eventos, se observa una ventana
  if (n > 0) await waitView(page, (current) => current.pausedNote === aviso);
  else await settle();
  const view = await readWeb(page);
  return conclude([
    check(feedTexts(view).length === 6, 'la lista sigue con 6 filas', `la lista tiene ${feedTexts(view).length} filas`),
    textCheck(view?.count, '6 eventos', 'el contador dice'),
    textCheck(view?.pausedNote, aviso, 'el aviso de pausa dice'),
    textCheck(view?.pauseLabel, 'Reanudar feed', 'el botón dice'),
  ]);
});

// --- Esquema 4: al reanudar, la lista muestra lo que llegó durante la pausa -----------------------------------------------

const alReanudar: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const textoPrimero = quoted(cell(row, 'texto_primero'));
  const contador = quoted(cell(row, 'contador'));
  const expected = `al reanudar, la primera fila dice «${textoPrimero}», el contador dice «${contador}» y el aviso de pausa ya no aparece`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `la historia inicial no tiene 6 eventos (hay ${feedTexts(initial.view).length})`);
  const paused = await togglePause(page);
  if (paused) return actionFailed(expected, paused);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const ticks = await tickMany(admin.token, TENANT_A, n);
  if (ticks.failed) return actionFailed(expected, { message: `${ticks.failed.step} respondió ${ticks.failed.result.status}`, callLog: [] });
  await waitView(page, (current) => current.pausedNote?.endsWith(`${n} eventos nuevos en espera`) === true);
  const resumed = await togglePause(page);
  if (resumed) return actionFailed(expected, resumed);
  const { view } = await waitView(page, (current) => current.feed.length === 6 + n);
  const first = feedTexts(view)[0];
  return conclude([
    check(rowHas(first, textoPrimero), `la primera fila dice «${textoPrimero}»`, `la primera fila dice ${describeRow(first)}`),
    textCheck(view?.count, contador, 'el contador dice'),
    check(view?.pausedNote === undefined, 'el aviso de pausa ya no aparece', `el aviso de pausa ${view?.pausedNote === undefined ? 'no aparece' : `dice «${view.pausedNote}»`}`),
  ]);
});

// --- Esquema 5: la lista muestra como máximo 50 eventos -----------------------------------------------------------------------

/** Visibilidad del evento de la historia inicial («Enlace de datos PRG-001: latencia 20 ms») en la lista. */
const VISIBILIDAD: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['sigue', true],
  ['ya no aparece', false],
]);

const tope50: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const contador = quoted(cell(row, 'contador'));
  const visible = strict('visibilidad', VISIBILIDAD, cell(row, 'visibilidad'));
  const expected = `tras ${n} eventos el contador dice «${contador}» y el evento «${TEXTO_PRG001_LATENCIA_20}» ${visible ? 'sigue' : 'ya no aparece'} en la lista`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `la historia inicial no tiene 6 eventos (hay ${feedTexts(initial.view).length})`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const ticks = await tickMany(admin.token, TENANT_A, n);
  if (ticks.failed) return actionFailed(expected, { message: `${ticks.failed.step} respondió ${ticks.failed.result.status}`, callLog: [] });
  const { view } = await waitView(page, (current) => current.count === contador, 15_000);
  const present = feedTexts(view).some((item) => rowHas(item, TEXTO_PRG001_LATENCIA_20));
  const checks: Check[] = [
    textCheck(view?.count, contador, 'el contador dice'),
    check(present === visible, `el evento «${TEXTO_PRG001_LATENCIA_20}» ${visible ? 'sigue' : 'ya no aparece'} en la lista`, `el evento ${present ? 'sigue' : 'ya no aparece'} en la lista`),
  ];
  return conclude(checks, { evidence: { filasVisibles: feedTexts(view).length } });
});

// --- Esquema 6: cada evento nuevo muestra su origen en una pantalla de 640 px o más ------------------------------------

/** Evento que provoca la fila: una NC creada (origen Sistema) o un evento del simulador (origen Simulador). */
const EVENTO_ORIGEN: ReadonlyMap<string, 'nc' | 'tick'> = new Map<string, 'nc' | 'tick'>([
  ['alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`', 'nc'],
  ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
]);

const origenEnPantalla: BrowserRowHandler = onWeb(async (row, { page }) => {
  const evento = strict('evento', EVENTO_ORIGEN, cell(row, 'evento'));
  const origen = quoted(cell(row, 'origen'));
  const expected = `la fila nueva muestra el origen «${origen}»`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `la historia inicial no tiene 6 eventos (hay ${feedTexts(initial.view).length})`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const result = evento === 'nc' ? await createNc(admin.token, TENANT_A, 'minor') : await tickOf(admin.token, TENANT_A);
  const { view } = await waitView(page, (current) => current.feed.length === 7);
  const first = feedTexts(view)[0];
  return conclude([check(rowHas(first, origen), `la fila nueva muestra el origen «${origen}»`, `la fila nueva dice ${describeRow(first)}`)], {
    evidence: { respuesta: result.status, origenEtiquetaVisible: first?.origin },
  });
});

// --- Esquema 7: «Esperando eventos…» solo mientras la lista no tiene ningún evento ---------------------------------------

const ESPERANDO = 'Esperando eventos…';

const esperandoEventos: BrowserRowHandler = onWeb(async (row, { page }) => {
  const accion = strict('accion', new Map<string, 'silencio' | 'tick'>([
    ['la prueba no provoca ningún evento', 'silencio'],
    ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
  ]), cell(row, 'accion'));
  const resultado = cell(row, 'resultado');
  const expected = `${resultado} (con el resumen en 503)`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  await failSummary(page);
  const failure = await startWeb(page, link);
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
  const result = await tickOf(admin.token, TENANT_A);
  const { view } = await waitView(page, (current) => current.feed.length === 1);
  const first = feedTexts(view)[0];
  return conclude([
    check(rowHas(first, 'Telemetría PRG-013: 766 paquetes/s'), 'la lista muestra «Telemetría PRG-013: 766 paquetes/s»', `la lista muestra ${describeRow(first)}`),
    check(view?.empty === undefined, `ya no muestra «${ESPERANDO}»`, view?.empty === undefined ? `no muestra «${ESPERANDO}»` : `aún muestra «${view.empty}»`),
  ], { evidence: { respuestaTick: result.status } });
});

defineBrowserRows({
  story: 'US-MISION-FEED-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, historiaInicial],
    [2, eventoNuevoArriba],
    [3, pausaRetiene],
    [4, alReanudar],
    [5, tope50],
    [6, origenEnPantalla],
    [7, esperandoEventos],
  ]),
});
