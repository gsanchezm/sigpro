import type { Page } from '@playwright/test';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { cell, check, strict, type Check } from '../../support/checks';
import { adminAccess, createNc, intOf, resetTenants, tickOf, TENANT_A, isOk } from '../api/common';
import {
  conclude,
  cutLink,
  cutNote,
  describeRow,
  feedTexts,
  installRealtimeLink,
  prepFailed,
  prepFailedReason,
  readConnectionText,
  readWeb,
  restoreLink,
  rowHas,
  settle,
  textCheck,
  waitAccepted,
  waitView,
  withNoteWeb,
  type Cut,
  type RealtimeLink,
  type WebView,
} from '../web/common';
import { onExpoWeb, readMobileExplanation, retryButton, startMobile, valueCheck } from './common';

// US-MISION-FEED-011 — Indicador de conexión, «Reintentar» y resumen tras una caída en /mission (app móvil, web de Expo a 390 px).
// Preparación: alumno01 reiniciado; el gestor abre «Panel de misión» con la conexión en vivo. El corte es el del navegador («sin
// conexión») con su control (ver web/common.ts); si el navegador no corta en 5 s, la fila lo declara como aproximación en su nota.
// La pantalla NO se recarga.

const TIP_LIVE = 'Conectado por WebSocket: los eventos llegan solos.';
const TIP_OFFLINE = 'Sin conexión en tiempo real. Se reintentará automáticamente.';
const TEXTO_NC_NUEVA = 'NC-013 abierta (Menor) en PRG-002';
const TEXTO_TELEMETRIA = 'Telemetría PRG-013: 766 paquetes/s';
/** Ventana en la que la historia habla de permanencia («sigue en Sin conexión»). */
const PERMANENCIA_MS = 3_000;
/** Tiempo que se observa, tras cortar, a que el botón «Reintentar» siga ofreciéndose sin que la API responda (la historia no fija plazo). */
const SONDEO_MS = 30_000;
const SONDEO_PASO_MS = 50;

/** Situación de la fila del Esquema 1 (celda «situacion»). */
const SITUACION: ReadonlyMap<string, 'live' | 'offline'> = new Map<string, 'live' | 'offline'>([
  ['la conexión en tiempo real está abierta', 'live'],
  ['la prueba corta la conexión con la API y no la restablece', 'offline'],
]);

/** Texto del indicador (celdas «texto»). */
const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«En vivo»', 'En vivo'],
  ['«Sin conexión»', 'Sin conexión'],
]);

/** Si el botón «Reintentar» aparece (celdas «boton»: aparece / no aparece / desaparece / sigue). */
const BOTON_VISIBLE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
  ['desaparece', false],
  ['sigue', true],
]);

/** Situación de la fila del Esquema 2 (celda «situacion»): la API vuelve antes de pulsar, o sigue caída al pulsar. */
const SITUACION_REINTENTAR: ReadonlyMap<string, 'restablece' | 'sigue'> = new Map<string, 'restablece' | 'sigue'>([
  ['la prueba restablece la conexión con la API antes de pulsar', 'restablece'],
  ['la API sigue sin responder al pulsar', 'sigue'],
]);

/** Lo que pasa mientras se cae la conexión (celda «accion_durante_caida»). */
const ACCION_CAIDA: ReadonlyMap<string, 'nada' | 'nc' | 'tick'> = new Map<string, 'nada' | 'nc' | 'tick'>([
  ['no ocurre ninguna acción', 'nada'],
  ['alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`', 'nc'],
  ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
]);

/** Lo que la historia dice que incluye la lista tras la caída (celda «lista»); `null` = ningún evento nuevo. */
const LISTA: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['no incluye ningún evento nuevo', null],
  ['incluye el texto «NC-013 abierta (Menor) en PRG-002»', TEXTO_NC_NUEVA],
  ['incluye el texto «Telemetría PRG-013: 766 paquetes/s»', TEXTO_TELEMETRIA],
]);

/** Lectura del botón «Reintentar» (`undefined` = no legible: NO cuenta como «desapareció»). */
const readRetry = async (page: Page): Promise<boolean | undefined> => (await readWeb(page))?.retryPresent;

/** ¿Permanece «Sin conexión» con el botón durante la ventana? Nunca vuelve a «En vivo»; al final dice «Sin conexión» y hay botón. */
const permanence = async (page: Page): Promise<{ readonly held: boolean; readonly liveSeen: boolean; readonly endText?: string; readonly endRetry?: boolean }> => {
  let liveSeen = false;
  const started = Date.now();
  while (Date.now() - started < PERMANENCIA_MS) {
    if ((await readConnectionText(page)) === 'En vivo') liveSeen = true;
    await settle(250);
  }
  const end = await readWeb(page);
  return { held: !liveSeen && end?.connectionText === 'Sin conexión' && end.retryPresent === true, liveSeen, endText: end?.connectionText, endRetry: end?.retryPresent };
};

/** Pulsa «Reintentar». Devuelve el motivo (primera línea del error) si el clic no se pudo hacer; `undefined` si se pulsó. */
const pressRetry = async (page: Page): Promise<string | undefined> => {
  try {
    await retryButton(page).click({ timeout: 5_000 });
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message.split('\n')[0] : String(error);
  }
};

// --- Esquema 1: el indicador dice si la conexión está abierta y muestra «Reintentar» solo sin conexión -----------------

const indicador: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const situacion = strict('situacion', SITUACION, cell(row, 'situacion'));
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const boton = strict('boton', BOTON_VISIBLE, cell(row, 'boton'));
  const expected = `el indicador dice «${texto}» y el botón «Reintentar» ${cell(row, 'boton')}`;
  await resetTenants([TENANT_A]);
  const link: RealtimeLink = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const checks: Check[] = [];
  let note: string | undefined;
  if (situacion === 'offline') {
    const cut: Cut = await cutLink(page, link);
    note = cutNote(cut);
    const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
    checks.push(check(down.reached, 'el indicador dice «Sin conexión»', `el indicador dice «${down.view?.connectionText ?? '(sin leer)'}»`));
    const held = await permanence(page);
    checks.push(
      check(held.held, `el indicador se mantiene en «Sin conexión» con el botón durante ${PERMANENCIA_MS / 1000} s`, `${held.liveSeen ? 'vuelve a «En vivo» durante la ventana' : 'no vuelve a «En vivo»'}; al final dice «${held.endText ?? '(sin leer)'}» y el botón ${held.endRetry === undefined ? '(sin leer)' : held.endRetry ? 'aparece' : 'no aparece'}`),
    );
  } else {
    checks.push(textCheck(await readConnectionText(page), texto, 'el indicador dice'));
  }
  // Una sola lectura: la explicación bajo el título «Eventos en directo» y el botón debajo de la explicación (Reglas 18 y 19)
  const geometry = await readMobileExplanation(page);
  const explanation = situacion === 'live' ? TIP_LIVE : TIP_OFFLINE;
  const below = geometry?.explanationTop !== undefined && geometry.titleBottom !== undefined && geometry.explanationTop >= geometry.titleBottom;
  const buttonBelow = geometry?.retryTop !== undefined && geometry.explanationBottom !== undefined && geometry.retryTop >= geometry.explanationBottom;
  checks.push(
    check(geometry?.explanation === explanation, `la explicación dice «${explanation}»`, `la explicación dice «${geometry?.explanation ?? '(sin leer)'}»`),
    check(below, 'la explicación va bajo el título «Eventos en directo»', `la explicación ${below ? 'va' : 'no va'} bajo el título (título ${String(geometry?.titleBottom ?? '(sin leer)')}, explicación ${String(geometry?.explanationTop ?? '(sin leer)')})`),
  );
  if (boton) checks.push(check(buttonBelow, 'el botón «Reintentar» va debajo de la explicación', `el botón ${buttonBelow ? 'va' : 'no va'} debajo de la explicación (explicación ${String(geometry?.explanationBottom ?? '(sin leer)')}, botón ${String(geometry?.retryTop ?? '(sin leer)')})`));
  const visible = await readRetry(page);
  checks.push(check(visible === boton, `el botón «Reintentar» ${cell(row, 'boton')}`, `el botón «Reintentar» ${visible === undefined ? '(sin leer)' : visible ? 'aparece' : 'no aparece'}`));
  return conclude(checks, { ...(note === undefined ? {} : { note }), evidence: { indicadorExplicacion: geometry?.explanation } });
});

// --- Esquema 2: «Reintentar» vuelve a conectar solo si la API responde -------------------------------------------------

const reintentar: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const situacion = strict('situacion', SITUACION_REINTENTAR, cell(row, 'situacion'));
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const boton = strict('boton', BOTON_VISIBLE, cell(row, 'boton'));
  const expected = `tras pulsar «Reintentar» el indicador dice «${texto}» y el botón «Reintentar» ${cell(row, 'boton')}`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const cut = await cutLink(page, link);
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const shownBefore = await readRetry(page);
  if (shownBefore !== true) return prepFailedReason(expected, `el botón «Reintentar» no se ve con «Sin conexión» (${shownBefore === undefined ? 'no legible' : 'no aparece'})`);

  const timeline: { readonly ms: number; readonly text?: string; readonly retry?: boolean }[] = [];
  const checks: Check[] = [];
  let evidence: Readonly<Record<string, unknown>> = {};

  if (situacion === 'restablece') {
    // Se restablece y se pulsa en el mismo instante: si el botón ya no está, no se puede pulsar y la fila NO es coincide
    const before = link.accepted();
    await restoreLink(page, link, cut);
    const stillThere = await readRetry(page);
    if (stillThere !== true) {
      return notExecutable(expected,`El botón «Reintentar» ${stillThere === undefined ? 'no es legible' : 'desapareció antes de pulsarlo'} (la conexión se restableció sola): la historia exige la pulsación, así que la fila no se puede evaluar tal como está escrita.`);
    }
    const clicked = await pressRetry(page);
    if (clicked) return conclude([check(false, 'se pulsa «Reintentar»', `no se pudo pulsar «Reintentar»: ${clicked}`)]);
    const back = await waitAccepted(link, before, cut.reconnectMs);
    const { view } = await waitView(page, (current) => current.connectionText === texto, cut.reconnectMs);
    const visible = await readRetry(page);
    checks.push(
      check(back, 'la conexión vuelve a establecerse', back ? 'la conexión vuelve a establecerse' : 'la conexión no vuelve a establecerse'),
      textCheck(view?.connectionText, texto, 'el indicador dice'),
      check(visible === boton, `el botón «Reintentar» ${cell(row, 'boton')}`, `el botón «Reintentar» ${visible === undefined ? '(sin leer)' : visible ? 'aparece' : 'no aparece'}`),
    );
    evidence = { metodo: cut.method, pulsado: true };
  } else {
    // La API sigue caída: se pulsa y se sondea (sin plazo que la historia fije) hasta ver «Sin conexión» con el botón, con marcas de tiempo
    const clicked = await pressRetry(page);
    if (clicked) return conclude([check(false, 'se pulsa «Reintentar»', `no se pudo pulsar «Reintentar»: ${clicked}`)]);
    const started = Date.now();
    let hit = false;
    let last: WebView | undefined;
    let lastKey = '';
    while (Date.now() - started < SONDEO_MS && !hit) {
      const view = await readWeb(page);
      last = view;
      const key = `${String(view?.connectionText)}|${String(view?.retryPresent)}`;
      if (key !== lastKey) {
        timeline.push({ ms: Date.now() - started, text: view?.connectionText, retry: view?.retryPresent });
        lastKey = key;
      }
      hit = view?.connectionText === texto && view.retryPresent === true;
      if (!hit) await settle(SONDEO_PASO_MS);
    }
    checks.push(
      check(hit, `en algún instante el indicador dice «${texto}» y el botón «Reintentar» sigue`, hit ? `sí, a los ${timeline[timeline.length - 1]?.ms ?? '?'} ms` : `no en ${SONDEO_MS / 1000} s; último: «${last?.connectionText ?? '(sin leer)'}», botón ${last?.retryPresent === undefined ? '(sin leer)' : last.retryPresent ? 'aparece' : 'no aparece'}`),
    );
    evidence = { cronologia: timeline.slice(0, 40).map((entry) => `${entry.ms} ms: «${entry.text ?? '(sin leer)'}» botón ${entry.retry === undefined ? '(sin leer)' : entry.retry ? 'sí' : 'no'}`) };
  }
  return conclude(checks, { ...(cutNote(cut) === undefined ? {} : { note: cutNote(cut) }), evidence });
});

// --- Esquema 3: lo que ocurre durante la caída aparece al volver la conexión -------------------------------------------

const duranteLaCaida: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const accion = strict('accion_durante_caida', ACCION_CAIDA, cell(row, 'accion_durante_caida'));
  const ncEsperada = intOf(cell(row, 'nc_abiertas'));
  const textoLista = strict('lista', LISTA, cell(row, 'lista'));
  const expected = `la tarjeta «NC abiertas» muestra ${ncEsperada} y la lista ${cell(row, 'lista')} al volver la conexión`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.ncValue === '8' && current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `antes de la caída no se ve «NC abiertas» 8 con 6 filas (ve ${initial.view?.ncValue ?? '(sin leer)'} y ${feedTexts(initial.view).length} filas)`);
  const cut = await cutLink(page, link);
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  if (accion === 'nc') {
    const created = await createNc(admin.token, TENANT_A, 'minor');
    if (!isOk(created)) return prepFailed(expected, { message: `POST /api/nc respondió ${created.status} durante la caída`, callLog: [] });
  }
  if (accion === 'tick') {
    const ticked = await tickOf(admin.token, TENANT_A);
    if (!isOk(ticked)) return prepFailed(expected, { message: `POST /api/mission/tick respondió ${ticked.status} durante la caída`, callLog: [] });
  }
  if (accion === 'nada') await settle(1_000);
  const before = link.accepted();
  await restoreLink(page, link, cut);
  const back = await waitAccepted(link, before, cut.reconnectMs);
  const { view } = await waitView(page, (current) => current.ncValue === String(ncEsperada) && (textoLista === null || feedTexts(current).some((item) => rowHas(item, textoLista))), cut.reconnectMs);
  const checks: Check[] = [
    check(back, 'la conexión vuelve a abrirse', back ? 'la conexión vuelve a abrirse' : 'la conexión no vuelve a abrirse'),
    valueCheck(view?.ncValue, String(ncEsperada), 'la tarjeta «NC abiertas» muestra'),
  ];
  if (textoLista === null) {
    checks.push(check(feedTexts(view).length === 6, 'la lista no incluye ningún evento nuevo', `la lista tiene ${feedTexts(view).length} filas`));
  } else {
    const present = feedTexts(view).some((item) => rowHas(item, textoLista));
    checks.push(check(present, `la lista incluye el texto «${textoLista}»`, `la lista ${present ? 'incluye' : 'no incluye'} el texto «${textoLista}» (primera fila ${describeRow(feedTexts(view)[0])})`));
  }
  return conclude(checks, { ...(cutNote(cut) === undefined ? {} : { note: cutNote(cut) }), evidence: { indicadorAlVolver: view?.connectionText } });
});

defineBrowserRows({
  story: 'US-MISION-FEED-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNoteWeb(indicador, 'La regla de «Conectando…» (con su explicación) no tiene fila: el estado transitorio no se mide aquí.')],
    [2, withNoteWeb(reintentar, 'La regla de «Conectando…» tras pulsar no tiene fila: el estado transitorio no se mide aquí; la regla de renovación del token caducado no tiene fila.')],
    [3, withNoteWeb(duranteLaCaida, 'La regla de renovación del token caducado al volver la conexión no tiene fila.')],
  ]),
});
