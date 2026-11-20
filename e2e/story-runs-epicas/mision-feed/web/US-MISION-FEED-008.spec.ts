import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { quoted, waitUntil } from '../../support/browser';
import { check, cell, strict, type Check } from '../../support/checks';
import { adminAccess, createNc, intOf, resetTenants, tickOf, TENANT_A } from '../api/common';
import {
  conclude,
  describeRow,
  feedTexts,
  hoverText,
  installRealtimeLink,
  onWeb,
  prepFailed,
  prepFailedReason,
  readWeb,
  rowHas,
  settle,
  SHOW_CEILING_MS,
  startWeb,
  textCheck,
  waitAccepted,
  waitView,
  type RealtimeLink,
} from './common';

/** Espera del restablecimiento: el socket reintenta con un retardo creciente (hasta ~5 s) más el arranque de la conexión. */
const RECONNECT_CEILING_MS = 12_000;

// US-MISION-FEED-008 — Indicador de conexión en /mission: en vivo, sin conexión y vuelta al panel (web).
// Preparación: alumno01 reiniciado; gestor abre /mission con la conexión en vivo. El corte lo provoca la prueba cerrando la conexión en
// tiempo real de la página (y no la deja pasar hasta el restablecimiento). La página NO se recarga en ningún paso.

const TIP_LIVE = 'Conectado por WebSocket: los eventos llegan solos.';
const TIP_OFFLINE = 'Sin conexión en tiempo real. Se reintentará automáticamente.';
const TEXTO_NC_NUEVA = 'NC-013 abierta (Menor) en PRG-002';
const TEXTO_TELEMETRIA = 'Telemetría PRG-013: 766 paquetes/s';

/** Explicación que la historia dice que se lee al pasar el cursor por el icono, según el estado (celda «explicacion»). */
const EXPLICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Conectado por WebSocket: los eventos llegan solos.»', TIP_LIVE],
  ['«Sin conexión en tiempo real. Se reintentará automáticamente.»', TIP_OFFLINE],
]);

/** Situación de la fila del Esquema 1 (celda «situacion»): conexión abierta, o cortada y sin restablecer. */
const SITUACION: ReadonlyMap<string, 'live' | 'offline'> = new Map<string, 'live' | 'offline'>([
  ['la conexión en tiempo real está abierta', 'live'],
  ['la prueba corta la conexión con la API y no la restablece', 'offline'],
]);

/** Texto del indicador (celda «texto»). */
const TEXTO_INDICADOR: ReadonlyMap<string, string> = new Map<string, string>([
  ['«En vivo»', 'En vivo'],
  ['«Sin conexión»', 'Sin conexión'],
]);

/** Acción que ocurre durante el corte (celda «accion_durante_corte»). */
const ACCION_CORTE: ReadonlyMap<string, 'nada' | 'nc' | 'tick'> = new Map<string, 'nada' | 'nc' | 'tick'>([
  ['no ocurre ninguna acción', 'nada'],
  ['alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`', 'nc'],
  ['alumno01@sigpro.lab provoca un evento con POST /api/mission/tick', 'tick'],
]);

/** Lo que la historia dice que incluye la lista tras el restablecimiento (celda «lista»). */
const LISTA: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['no incluye ningún evento nuevo', null],
  ['incluye el texto «NC-013 abierta (Menor) en PRG-002»', TEXTO_NC_NUEVA],
  ['incluye el texto «Telemetría PRG-013: 766 paquetes/s»', TEXTO_TELEMETRIA],
]);

/** Lee el indicador y su explicación al pasar el cursor, repitiendo hasta que coincide (el estado puede oscilar durante el corte). */
const explainedAs = async (page: Page, expected: string): Promise<{ readonly reached: boolean; readonly text?: string }> => {
  let text: string | undefined;
  const reached = await waitUntil(async () => {
    const hovered = await hoverText(page, page.getByTestId(MISION_TESTIDS.MISSION_CONNECTION).getByRole('button'), MISION_TESTIDS.MISSION_CONNECTION_TOOLTIP);
    text = hovered.text;
    return text === expected;
  }, SHOW_CEILING_MS);
  return { reached: reached.reached, text };
};

/** Corta la conexión y espera a que el indicador diga «Sin conexión»; devuelve el fallo de la preparación si no lo dice. */
const cutAndWait = async (page: Page, link: RealtimeLink): Promise<{ readonly ok: boolean; readonly text?: string }> => {
  await link.cut();
  const down = await waitView(page, (view) => view.connection === 'offline');
  return { ok: down.reached, text: down.view?.connectionText };
};

// --- Esquema 1: el indicador dice si la conexión en tiempo real está abierta ------------------------------------------

const indicador: BrowserRowHandler = onWeb(async (row, { page }) => {
  const situacion = strict('situacion', SITUACION, cell(row, 'situacion'));
  const texto = strict('texto', TEXTO_INDICADOR, cell(row, 'texto'));
  const explicacion = strict('explicacion', EXPLICACION, cell(row, 'explicacion'));
  const expected = `el indicador dice «${texto}» y al pasar el cursor por su icono se lee «${explicacion}»`;
  await resetTenants([TENANT_A]);
  const link: RealtimeLink = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  if (situacion === 'offline') {
    const cut = await cutAndWait(page, link);
    if (!cut.ok) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${cut.text ?? '(sin leer)'}»)`);
  }
  const view = await readWeb(page);
  const explained = await explainedAs(page, explicacion);
  return conclude(
    [textCheck(view?.connectionText, texto, 'el indicador dice'), check(explained.reached, `al pasar el cursor se lee «${explicacion}»`, `al pasar el cursor se lee «${explained.text ?? '(sin tooltip)'}»`)],
    { evidence: { indicador: view?.connection, tooltipUltimo: explained.text } },
  );
});

// --- Esquema 2: al restablecerse la conexión vuelven el indicador «En vivo» y los eventos nuevos -----------------------

const vuelveEnVivo: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const texto = quoted(cell(row, 'texto_primero'));
  const expected = `el indicador dice «En vivo» y la primera fila dice «${texto}»`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const cut = await cutAndWait(page, link);
  if (!cut.ok) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${cut.text ?? '(sin leer)'}»)`);
  const before = link.accepted();
  link.restore();
  const back = await waitAccepted(link, before, RECONNECT_CEILING_MS);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  for (let index = 0; index < n; index += 1) await tickOf(admin.token, TENANT_A);
  const { view } = await waitView(page, (current) => current.feed.length === 6 + n);
  const first = feedTexts(view)[0];
  return conclude([
    check(back, 'la conexión vuelve a establecerse', back ? 'la conexión vuelve a establecerse' : 'la conexión no vuelve a establecerse'),
    textCheck(view?.connectionText, 'En vivo', 'el indicador dice'),
    check(rowHas(first, texto), `la primera fila dice «${texto}»`, `la primera fila dice ${describeRow(first)}`),
  ]);
});

// --- Esquema 3: lo que ocurre durante el corte aparece al restablecerse la conexión -------------------------------------

const duranteElCorte: BrowserRowHandler = onWeb(async (row, { page }) => {
  const accion = strict('accion_durante_corte', ACCION_CORTE, cell(row, 'accion_durante_corte'));
  const ncEsperada = intOf(cell(row, 'nc_abiertas'));
  const textoLista = strict('lista', LISTA, cell(row, 'lista'));
  const expected = `tras el restablecimiento «NC abiertas» muestra ${ncEsperada} y la lista ${cell(row, 'lista')}`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (current) => current.ncValue === '8' && current.feed.length === 6);
  if (!initial.reached) return prepFailedReason(expected, `antes del corte no se ve «NC abiertas» 8 con 6 filas (ve ${initial.view?.ncValue ?? '(sin leer)'} y ${feedTexts(initial.view).length} filas)`);
  const cut = await cutAndWait(page, link);
  if (!cut.ok) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${cut.text ?? '(sin leer)'}»)`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  if (accion === 'nc') await createNc(admin.token, TENANT_A, 'minor');
  if (accion === 'tick') await tickOf(admin.token, TENANT_A);
  if (accion === 'nada') await settle(1_000);
  const before = link.accepted();
  link.restore();
  const back = await waitAccepted(link, before, RECONNECT_CEILING_MS);
  // Tras el restablecimiento se espera lo que la historia dice; el techo mide cuánto espera la prueba antes de juzgar
  const { view } = await waitView(page, (current) => current.ncValue === String(ncEsperada) && (textoLista === null || feedTexts(current).some((item) => rowHas(item, textoLista))));
  const checks: Check[] = [
    check(back, 'la conexión vuelve a establecerse', back ? 'la conexión vuelve a establecerse' : 'la conexión no vuelve a establecerse'),
    textCheck(view?.ncValue, String(ncEsperada), '«NC abiertas» muestra'),
  ];
  if (textoLista === null) {
    checks.push(check(feedTexts(view).length === 6, 'la lista no incluye ningún evento nuevo', `la lista tiene ${feedTexts(view).length} filas`));
  } else {
    const present = feedTexts(view).some((item) => rowHas(item, textoLista));
    checks.push(check(present, `la lista incluye el texto «${textoLista}»`, `la lista ${present ? 'incluye' : 'no incluye'} el texto «${textoLista}» (${feedTexts(view).length} filas)`));
  }
  return conclude(checks, { evidence: { indicadorTrasRestablecer: view?.connection, filas: feedTexts(view).length } });
});

defineBrowserRows({
  story: 'US-MISION-FEED-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, indicador],
    [2, vuelveEnVivo],
    [3, duranteElCorte],
  ]),
});
