import type { Page } from '@playwright/test';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { quoted, waitUntil } from '../../support/browser';
import { check, cell, strict, type Check } from '../../support/checks';
import { adminAccess, createNc, intOf, resetTenants, tickOf, TENANT_A, isOk } from '../api/common';
import {
  CUT_NOTE,
  PERMANENCIA_MS,
  conclude,
  cutLink,
  cutNote,
  describeRow,
  describePermanence,
  feedTexts,
  installRealtimeLink,
  isStable,
  observePermanence,
  onWeb,
  prepFailed,
  prepFailedReason,
  readConnectionText,
  restoreLink,
  rowHas,
  runSteps,
  settle,
  SHOW_CEILING_MS,
  startWeb,
  textCheck,
  waitAccepted,
  waitView,
  withNoteWeb,
  type RealtimeLink,
} from './common';

// US-MISION-FEED-008 — Indicador de conexión en /mission: en vivo, sin conexión y vuelta al panel (web).
// Preparación: alumno01 reiniciado; gestor abre /mission con la conexión en vivo. El corte («el servidor no responde») se hace en la
// prueba y su control debe sacar el indicador de «En vivo» en 5 s; si no lo hace, la fila es no ejecutable con la lectura como evidencia.

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

/** Lo que la historia dice que incluye la lista tras el restablecimiento (celda «lista»); `null` = ningún evento nuevo. */
const LISTA: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['no incluye ningún evento nuevo', null],
  ['incluye el texto «NC-013 abierta (Menor) en PRG-002»', TEXTO_NC_NUEVA],
  ['incluye el texto «Telemetría PRG-013: 766 paquetes/s»', TEXTO_TELEMETRIA],
]);

/** Lectura atómica del indicador y de su explicación al pasar el cursor (una sola evaluación). */
interface HoverRead {
  readonly indicator?: string;
  readonly tooltip?: string;
}

const readHover = (page: Page): Promise<HoverRead | undefined> =>
  page
    .evaluate(
      (ids: { readonly connection: string; readonly tooltip: string }) => {
        const connection = document.querySelector<HTMLElement>(`[data-testid="${ids.connection}"]`);
        const tooltip = document.querySelector<HTMLElement>(`[data-testid="${ids.tooltip}"]`);
        const nbsp = new RegExp(String.fromCharCode(160), 'g');
        return {
          indicator: connection?.querySelector('button')?.getAttribute('aria-label') ?? undefined,
          tooltip: tooltip ? (tooltip.textContent ?? '').replace(nbsp, ' ').trim() : undefined,
        };
      },
      { connection: MISION_TESTIDS.MISSION_CONNECTION, tooltip: MISION_TESTIDS.MISSION_CONNECTION_TOOLTIP },
    )
    .catch(() => undefined);

/** Pasa el cursor por el icono y lee, en una sola evaluación, el indicador y su explicación; repite hasta que la explicación coincide. */
const explainedAs = async (page: Page, expected: string): Promise<{ readonly reached: boolean; readonly indicator?: string; readonly tooltip?: string }> => {
  let last: HoverRead | undefined;
  const reached = await waitUntil(async () => {
    await runSteps([['pasar el cursor por el icono', () => page.getByTestId(MISION_TESTIDS.MISSION_CONNECTION).getByRole('button').hover({ timeout: 5_000 })]]);
    last = await readHover(page);
    return last?.tooltip === expected;
  }, SHOW_CEILING_MS);
  return { reached: reached.reached, indicator: last?.indicator, tooltip: last?.tooltip };
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
  const checks: Check[] = [];
  let note: string | undefined;
  if (situacion === 'offline') {
    const cut = await cutLink(page, link);
    if (!cut.controlOk) return notExecutable(expected, `El corte no saca el indicador de «En vivo» (${cut.evidence}). ${CUT_NOTE}`);
    note = cutNote(cut);
    const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
    checks.push(check(down.reached, 'el indicador dice «Sin conexión»', `el indicador dice «${down.view?.connectionText ?? '(sin leer)'}»`));
    const perm = await observePermanence(page);
    if (!perm.liveSeen && !isStable(perm)) return notExecutable(expected, `El corte no es estable: ${describePermanence(perm)}. ${CUT_NOTE}`);
    checks.push(
      check(!perm.liveSeen, `el indicador no vuelve a «En vivo» durante ${PERMANENCIA_MS / 1000} s`, perm.liveSeen ? 'vuelve a «En vivo» durante la ventana' : 'no vuelve a «En vivo»'),
      check(isStable(perm), `la mayoría de las lecturas dice «Sin conexión» durante ${PERMANENCIA_MS / 1000} s`, describePermanence(perm)),
    );
  } else {
    checks.push(textCheck(await readConnectionText(page), texto, 'el indicador dice'));
  }
  const explained = await explainedAs(page, explicacion);
  // Lectura atómica: el indicador y su explicación al pasar el cursor, en el mismo instante
  checks.push(check(explained.reached, `al pasar el cursor por su icono se lee «${explicacion}»`, `al pasar el cursor se lee «${explained.tooltip ?? '(sin tooltip)'}» (indicador «${explained.indicator ?? '(sin leer)'}»)`));
  return conclude(checks, { ...(note === undefined ? {} : { note }), evidence: { tooltipUltimo: explained.tooltip, indicadorAlPasarElCursor: explained.indicator } });
});

// --- Esquema 2: al restablecerse la conexión vuelven el indicador «En vivo» y los eventos nuevos --------------------

const vuelveEnVivo: BrowserRowHandler = onWeb(async (row, { page }) => {
  const n = intOf(cell(row, 'n'));
  const texto = quoted(cell(row, 'texto_primero'));
  const expected = `el indicador dice «En vivo» y la primera fila dice «${texto}»`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const cut = await cutLink(page, link);
  if (!cut.controlOk) return notExecutable(expected, `El corte no saca el indicador de «En vivo» (${cut.evidence}). ${CUT_NOTE}`);
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const before = link.accepted();
  await restoreLink(page, link, cut);
  const back = await waitAccepted(link, before, cut.reconnectMs);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  // Los eventos de apoyo deben responder 2xx (si no, la fila no se puede ejecutar: no es un hallazgo de la app)
  for (let index = 0; index < n; index += 1) {
    const result = await tickOf(admin.token, TENANT_A);
    if (!isOk(result)) return prepFailed(expected, { message: `POST /api/mission/tick respondió ${result.status} al provocar el evento ${index + 1}`, callLog: [] });
  }
  const { view } = await waitView(page, (current) => current.feed.length === 6 + n);
  const first = feedTexts(view)[0];
  return conclude(
    [
      check(back, 'la conexión vuelve a establecerse', back ? 'la conexión vuelve a establecerse' : 'la conexión no vuelve a establecerse'),
      textCheck(view?.connectionText, 'En vivo', 'el indicador dice'),
      check(rowHas(first, texto), `la primera fila dice «${texto}»`, `la primera fila dice ${describeRow(first)}`),
    ],
    { note: cutNote(cut) },
  );
});

// --- Esquema 3: lo que ocurre durante el corte aparece al restablecerse la conexión -----------------------------------

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
  const cut = await cutLink(page, link);
  if (!cut.controlOk) return notExecutable(expected, `El corte no saca el indicador de «En vivo» (${cut.evidence}). ${CUT_NOTE}`);
  const down = await waitView(page, (view) => view.connectionText === 'Sin conexión', cut.reconnectMs);
  if (!down.reached) return prepFailedReason(expected, `el indicador no pasa a «Sin conexión» tras el corte (dice «${down.view?.connectionText ?? '(sin leer)'}»)`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  if (accion === 'nc') {
    const created = await createNc(admin.token, TENANT_A, 'minor');
    if (!isOk(created)) return prepFailed(expected, { message: `POST /api/nc respondió ${created.status} durante el corte`, callLog: [] });
  }
  if (accion === 'tick') {
    const ticked = await tickOf(admin.token, TENANT_A);
    if (!isOk(ticked)) return prepFailed(expected, { message: `POST /api/mission/tick respondió ${ticked.status} durante el corte`, callLog: [] });
  }
  if (accion === 'nada') await settle(1_000);
  const before = link.accepted();
  await restoreLink(page, link, cut);
  const back = await waitAccepted(link, before, cut.reconnectMs);
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
  return conclude(checks, { note: cutNote(cut), evidence: { filas: feedTexts(view).length } });
});

// Reglas de la historia sin fila que las pruebe (se anotan, no se juzgan):
const NOTA_CONECTANDO =
  'Regla «Conectando…» y su explicación («Abriendo la conexión en tiempo real…»): ningún Esquema la comprueba; el estado transitorio no se mide aquí.';
const NOTA_TOKEN =
  'Regla de renovación del token caducado cuando la conexión vuelve: ninguna fila lo provoca (el accessToken de la prueba sigue vigente); la renovación no se comprueba.';

defineBrowserRows({
  story: 'US-MISION-FEED-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNoteWeb(indicador, NOTA_CONECTANDO)],
    [2, withNoteWeb(vuelveEnVivo, `${NOTA_CONECTANDO} ${NOTA_TOKEN}`)],
    [3, withNoteWeb(duranteElCorte, `${NOTA_CONECTANDO} ${NOTA_TOKEN}`)],
  ]),
});
