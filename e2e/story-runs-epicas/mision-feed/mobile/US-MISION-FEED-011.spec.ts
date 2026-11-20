import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { adminAccess, createNc, intOf, resetTenants, tickOf, TENANT_A } from '../api/common';
import { conclude, describeRow, feedTexts, installRealtimeLink, prepFailed, prepFailedReason, readWeb, rowHas, textCheck, waitAccepted, waitView, type RealtimeLink } from '../web/common';
import { onExpoWeb, retryButton, retryVisible, startMobile, valueCheck } from './common';

// US-MISION-FEED-011 — Indicador de conexión, «Reintentar» y resumen tras una caída en /mission (app móvil, web de Expo a 390 px).
// Preparación: alumno01 reiniciado; el gestor abre «Panel de misión» con la conexión en vivo. El corte lo provoca la prueba cerrando la
// conexión en tiempo real de la app (y no la deja pasar hasta que la prueba la restablece). La pantalla NO se recarga.

const TEXTO_NC_NUEVA = 'NC-013 abierta (Menor) en PRG-002';
const TEXTO_TELEMETRIA = 'Telemetría PRG-013: 766 paquetes/s';
const RECONNECT_CEILING_MS = 12_000;

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

/** Situación de la fila del Esquema 2 (celda «situacion»): la API vuelve antes de pulsar, o sigue caída al pulsar. */
const SITUACION_REINTENTAR: ReadonlyMap<string, 'restablece' | 'sigue'> = new Map<string, 'restablece' | 'sigue'>([
  ['la prueba restablece la conexión con la API antes de pulsar', 'restablece'],
  ['la API sigue sin responder al pulsar', 'sigue'],
]);

/** Si el botón «Reintentar» aparece (celdas «boton»: aparece / no aparece / desaparece / sigue). */
const BOTON_VISIBLE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
  ['desaparece', false],
  ['sigue', true],
]);

/** Lo que pasa mientras se cae la conexión (celda «accion_durante_caida» de la tercera tabla). */
const ACCION_CAIDA: ReadonlyMap<string, 'nada' | 'nc' | 'tick'> = new Map<string, 'nada' | 'nc' | 'tick'>([
  ['no ocurre ninguna acción', 'nada'],
  ['alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`', 'nc'],
  ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
]);

const LISTA: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['no incluye ningún evento nuevo', null],
  ['incluye el texto «NC-013 abierta (Menor) en PRG-002»', TEXTO_NC_NUEVA],
  ['incluye el texto «Telemetría PRG-013: 766 paquetes/s»', TEXTO_TELEMETRIA],
]);

/** Lee el botón «Reintentar» con su estado visible; `undefined` si la lectura falla. */
const readRetry = async (page: Page): Promise<boolean | undefined> => retryVisible(page);

// --- Esquema 1: el indicador dice si la conexión está abierta y muestra «Reintentar» solo sin conexión --------------------

const indicador: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const situacion = strict('situacion', SITUACION, cell(row, 'situacion'));
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const boton = strict('boton', BOTON_VISIBLE, cell(row, 'boton'));
  const expected = `el indicador dice «${texto}» y el botón «Reintentar» ${cell(row, 'boton')}`;
  await resetTenants([TENANT_A]);
  const link: RealtimeLink = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  if (situacion === 'offline') {
    await link.cut();
    const down = await waitView(page, (view) => view.connectionText === 'Sin conexión');
    if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  }
  const visible = await readRetry(page);
  return conclude([
    textCheck((await readWeb(page))?.connectionText, texto, 'el indicador dice'),
    check(visible === boton, `el botón «Reintentar» ${cell(row, 'boton')}`, `el botón «Reintentar» ${visible === undefined ? '(sin leer)' : visible ? 'aparece' : 'no aparece'}`),
  ]);
});

// --- Esquema 2: «Reintentar» vuelve a conectar solo si la API responde ----------------------------------------------------

const reintentar: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const restablece = strict('situacion', SITUACION_REINTENTAR, cell(row, 'situacion')) === 'restablece';
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const boton = strict('boton', BOTON_VISIBLE, cell(row, 'boton'));
  const expected = `tras pulsar «Reintentar» el indicador dice «${texto}» y el botón «Reintentar» ${cell(row, 'boton')}`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  await link.cut();
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión');
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const shownBefore = await readRetry(page);
  if (shownBefore !== true) return prepFailedReason(expected, `el botón «Reintentar» no aparece con «Sin conexión» (${shownBefore === undefined ? 'sin leer' : 'no aparece'})`);

  let note: string | undefined;
  let connectingSeen = false;
  if (restablece) {
    link.restore();
    // Con la API de nuevo disponible, el socket puede reconectarse solo: si el botón ya no está, no hace falta pulsarlo
    const stillThere = await waitUntil(async () => (await readRetry(page)) === true, 2_000);
    if (stillThere.reached) {
      const clicked = await retryButton(page).click({ timeout: 5_000 }).then(
        () => undefined,
        (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error)),
      );
      if (clicked) return conclude([check(false, 'se pulsa «Reintentar»', `no se pudo pulsar «Reintentar»: ${clicked}`)]);
    } else {
      note = 'El botón «Reintentar» desapareció antes de pulsarlo: la conexión se restableció sola con su reintento automático. El veredicto se da sobre el estado final.';
    }
  } else {
    const clicked = await retryButton(page).click({ timeout: 5_000 }).then(
      () => undefined,
      (error: unknown) => (error instanceof Error ? error.message.split('\n')[0] : String(error)),
    );
    if (clicked) return conclude([check(false, 'se pulsa «Reintentar»', `no se pudo pulsar «Reintentar»: ${clicked}`)]);
    // La pulsación debe llegar a un intento de conexión: se mira si el indicador pasa por «Conectando…» (transitorio: solo evidencia)
    connectingSeen = (await waitUntil(async () => (await readWeb(page))?.connectionText === 'Conectando…', 1_500)).reached;
  }
  const { view } = await waitView(page, (current) => current.connectionText === texto);
  const visible = await readRetry(page);
  const checks: Check[] = [
    textCheck(view?.connectionText, texto, 'el indicador dice'),
    check(visible === boton, `el botón «Reintentar» ${cell(row, 'boton')}`, `el botón «Reintentar» ${visible === undefined ? '(sin leer)' : visible ? 'aparece' : 'no aparece'}`),
  ];
  return conclude(checks, { ...(note === undefined ? {} : { note }), evidence: { conectandoVisto: connectingSeen } });
});

// --- Esquema 3: lo que ocurre durante la caída aparece al volver la conexión ----------------------------------------------

const duranteLaCaida: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const accion = strict('accion_durante_caida', ACCION_CAIDA, cell(row, 'accion_durante_caida'));
  const ncEsperada = intOf(cell(row, 'nc_abiertas'));
  const lista = strict('lista', LISTA, cell(row, 'lista'));
  const expected = `la tarjeta «NC abiertas» muestra ${ncEsperada} y la lista ${cell(row, 'lista')} al volver la conexión`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.ncValue === '8' && current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `antes de la caída no se ve «NC abiertas» 8 con 6 filas (ve ${initial.view?.ncValue ?? '(sin leer)'} y ${feedTexts(initial.view).length} filas)`);
  await link.cut();
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión');
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  if (accion === 'nc') await createNc(admin.token, TENANT_A, 'minor');
  if (accion === 'tick') await tickOf(admin.token, TENANT_A);
  const before = link.accepted();
  link.restore();
  const back = await waitAccepted(link, before, RECONNECT_CEILING_MS);
  const { view } = await waitView(page, (current) => current.ncValue === String(ncEsperada) && (lista === null || feedTexts(current).some((item) => rowHas(item, lista))), RECONNECT_CEILING_MS);
  const checks: Check[] = [
    check(back, 'la conexión vuelve a abrirse', back ? 'la conexión vuelve a abrirse' : 'la conexión no vuelve a abrirse'),
    valueCheck(view?.ncValue, String(ncEsperada), 'la tarjeta «NC abiertas» muestra'),
  ];
  if (lista === null) {
    checks.push(check(feedTexts(view).length === 6, 'la lista no incluye ningún evento nuevo', `la lista tiene ${feedTexts(view).length} filas`));
  } else {
    const present = feedTexts(view).some((item) => rowHas(item, lista));
    checks.push(check(present, `la lista incluye el texto «${lista}»`, `la lista ${present ? 'incluye' : 'no incluye'} el texto «${lista}» (primera fila ${describeRow(feedTexts(view)[0])})`));
  }
  return conclude(checks, { evidence: { indicadorAlVolver: view?.connectionText } });
});

defineBrowserRows({
  story: 'US-MISION-FEED-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, indicador],
    [2, reintentar],
    [3, duranteLaCaida],
  ]),
});
