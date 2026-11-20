import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { MISION_TESTIDS } from '../../../../packages/shared/src/testids';
import { waitUntil } from '../../support/browser';
import { check, cell, parseResponse, responseCheck, strict, type Check } from '../../support/checks';
import type { ApiResult } from '../../../story-runs/support/api';
import {
  adminAccess,
  commentNc,
  createNc,
  deleteProgram,
  gestorSession,
  intOf,
  ncOpenOf,
  patchMilestone,
  patchNcSeverity,
  resetTenants,
  summaryOf,
  transitionNc,
  TENANT_A,
} from '../api/common';
import {
  actionFailed,
  conclude,
  describeRow,
  feedTexts,
  installRealtimeLink,
  markNoReload,
  onWeb,
  prepFailed,
  prepFailedReason,
  readTable,
  readWeb,
  rowHas,
  settle,
  SHOW_CEILING_MS,
  startWeb,
  textCheck,
  toggleChartTable,
  waitView,
  type RealtimeLink,
  type StepFailure,
  type WebView,
} from './common';

// US-MISION-FEED-007 — Actualizar en vivo «NC abiertas», su gráfica por severidad y «Hitos cumplidos» sin recargar (web).
// Preparación: alumno01 reiniciado; gestor abre /mission (NC abiertas = 8). Seed: NC-001 a NC-012 con 8 abiertas (2 menores, 2 mayores y 4
// críticas). Hitos del seed (apps/api/src/seed/data.ts, milestoneSplit y targetProgress): 175 en total, 86 cumplidos; PRG-001 tiene
// 9 hitos, 1 cumplido, y su M02 («PDR») está pendiente (avance 10 %).

/** Cifras de hitos del seed, calculadas con la fórmula del seed (no leídas de la app). */
const HITOS_CUMPLIDOS_SEED = 86;
const HITOS_TOTAL_SEED = 175;
const PRG001_CUMPLIDOS_SEED = 1;

/** Un cambio de NC de la historia: la llamada exacta, el evento que emite (si lo emite) y el estado HTTP que devuelve. */
interface NcAct {
  readonly run: (token: string) => Promise<ApiResult>;
  /** Tipo del evento que la historia dice que llega; `undefined` si la operación no emite ninguno. */
  readonly eventType?: string;
  /** Estado HTTP que la historia dice que responde la operación (la rechazada, 409). */
  readonly status?: number;
}

const TENANT = TENANT_A;
const DESC = 'Desviación de prueba en la ejecución';

const ACCION_NC: ReadonlyMap<string, NcAct> = new Map<string, NcAct>([
  [`alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad minor y la descripción \`${DESC}\``, { run: (token) => createNc(token, TENANT, 'minor', DESC), eventType: 'nc_created' }],
  [`alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción \`${DESC}\``, { run: (token) => createNc(token, TENANT, 'major', DESC), eventType: 'nc_created' }],
  [`alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad critical y la descripción \`${DESC}\``, { run: (token) => createNc(token, TENANT, 'critical', DESC), eventType: 'nc_created' }],
  ['alumno01@sigpro.lab pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition', { run: (token) => transitionNc(token, TENANT, 'NC-001', 'in_analysis'), eventType: 'nc_moved' }],
  ['alumno01@sigpro.lab pasa NC-002 a rejected con POST /api/nc/NC-002/transition', { run: (token) => transitionNc(token, TENANT, 'NC-002', 'rejected'), eventType: 'nc_moved' }],
  [
    'alumno01@sigpro.lab cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad`',
    { run: (token) => transitionNc(token, TENANT, 'NC-003', 'closed', 'Acción correctiva verificada por calidad'), eventType: 'nc_closed' },
  ],
  [
    'alumno01@sigpro.lab pide pasar NC-001 a rejected desde open con POST /api/nc/NC-001/transition, que la API rechaza',
    { run: (token) => transitionNc(token, TENANT, 'NC-001', 'rejected'), status: 409 },
  ],
  ['alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', { run: (token) => patchNcSeverity(token, TENANT, 'NC-001', 'critical'), eventType: 'nc_updated' }],
  ['alumno01@sigpro.lab añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments', { run: (token) => commentNc(token, TENANT, 'NC-006', 'Seguimiento de prueba'), eventType: 'nc_commented' }],
]);

/** Ejecuta el cambio de NC: espera (con techo) el evento que la historia dice que llega, o observa una ventana si no debe llegar ninguno. */
const performNc = async (link: RealtimeLink, act: NcAct, token: string): Promise<{ readonly result: ApiResult; readonly arrived: boolean }> => {
  const before = link.eventTypes().length;
  const result = await act.run(token);
  if (act.eventType === undefined) {
    await settle();
    return { result, arrived: false };
  }
  const wanted = act.eventType;
  const arrived = await waitUntil(async () => link.eventTypes().slice(before).includes(wanted), SHOW_CEILING_MS);
  return { result, arrived: arrived.reached };
};

/** Respuesta del cambio que la historia da por hecha: 2xx, o el estado de la operación rechazada. */
const actionCheck = (result: ApiResult, act: NcAct, nombre: string): Check =>
  act.status === undefined
    ? check(result.status >= 200 && result.status < 300, `${nombre} se acepta (2xx)`, `${nombre} responde ${result.status}`)
    : responseCheck(result, parseResponse(`${act.status} invalid_transition`));

// --- Esquema 1: cada cambio de NC actualiza «NC abiertas» sin recargar -------------------------------------------------------

const ncAbiertasCambia: BrowserRowHandler = onWeb(async (row, { page }) => {
  const act = strict('cambio', ACCION_NC, cell(row, 'cambio'));
  const cifra = intOf(cell(row, 'cifra'));
  const expected = `«NC abiertas» muestra ${cifra} sin recargar la página`;
  await resetTenants([TENANT]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `«NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del cambio, no 8`);
  const admin = await adminAccess(TENANT);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] } satisfies StepFailure);
  const reloads = await markNoReload(page);
  const { result, arrived } = await performNc(link, act, admin.token);
  const view: WebView | undefined = act.eventType === undefined ? await readWeb(page) : (await waitView(page, (current) => current.ncValue === String(cifra))).view;
  const reload = await reloads();
  return conclude(
    [
      actionCheck(result, act, 'la operación'),
      check(act.eventType === undefined || arrived, `llega el evento ${act.eventType ?? '(ninguno)'} a la conexión`, `${arrived ? 'llega' : 'no llega'} el evento ${act.eventType ?? '(ninguno)'} a la conexión`),
      textCheck(view?.ncValue, String(cifra), '«NC abiertas» muestra'),
      check(reload.marker && reload.loads === 0, 'la página no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
    ],
    { evidence: { tiposRecibidos: link.eventTypes(), respuesta: result.status } },
  );
});

// --- Esquema 2: la gráfica «NC abiertas por severidad» en su vista de tabla sigue a los cambios -------------------------

const ACCION_TABLA: ReadonlyMap<string, NcAct | undefined> = new Map<string, NcAct | undefined>([
  ['no se hace ningún cambio', undefined],
  ['alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', ACCION_NC.get('alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001')],
  [
    `alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción \`${DESC}\``,
    ACCION_NC.get(`alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción \`${DESC}\``),
  ],
]);

/** Filas de la tabla de NC por severidad: el número de la celda «NC abiertas» de cada etiqueta. */
const tablaNc = async (page: Page): Promise<Readonly<Record<string, string | undefined>>> => {
  const rows = (await readTable(page, MISION_TESTIDS.MISSION_CHART_NC_TABLE)) ?? [];
  const valueOf = (label: string): string | undefined => rows.find((item) => item.key === label)?.cells[0];
  return { Menor: valueOf('Menor'), Mayor: valueOf('Mayor'), Crítica: valueOf('Crítica') };
};

const tablaSeveridad: BrowserRowHandler = onWeb(async (row, { page }) => {
  const act = strict('cambio', ACCION_TABLA, cell(row, 'cambio'));
  const menor = intOf(cell(row, 'menor'));
  const mayor = intOf(cell(row, 'mayor'));
  const critica = intOf(cell(row, 'critica'));
  const expected = `la tabla muestra «Menor» ${menor}, «Mayor» ${mayor} y «Crítica» ${critica}`;
  await resetTenants([TENANT]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `«NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del cambio, no 8`);
  const toggled: StepFailure | undefined = await toggleChartTable(page, MISION_TESTIDS.MISSION_CHART_NC_TOGGLE);
  if (toggled) return actionFailed(expected, toggled);
  const admin = await adminAccess(TENANT);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] } satisfies StepFailure);
  let result: ApiResult | undefined;
  if (act !== undefined) {
    const performed = await performNc(link, act, admin.token);
    result = performed.result;
  } else {
    await settle();
  }
  // Tras el cambio, la tabla se lee hasta que coincide o se agota el techo (la llegada del evento ya se comprobó)
  const want = { Menor: String(menor), Mayor: String(mayor), Crítica: String(critica) };
  await waitUntil(async () => {
    const current = await tablaNc(page);
    return current.Menor === want.Menor && current.Mayor === want.Mayor && current.Crítica === want.Crítica;
  }, SHOW_CEILING_MS);
  const counts = await tablaNc(page);
  return conclude([
    ...(result === undefined || act === undefined ? [] : [actionCheck(result, act, 'la operación')]),
    check(counts.Menor === want.Menor, `«Menor» ${menor}`, `«Menor» ${counts.Menor ?? '(sin leer)'}`),
    check(counts.Mayor === want.Mayor, `«Mayor» ${mayor}`, `«Mayor» ${counts.Mayor ?? '(sin leer)'}`),
    check(counts.Crítica === want.Crítica, `«Crítica» ${critica}`, `«Crítica» ${counts.Crítica ?? '(sin leer)'}`),
  ]);
});

// --- Esquema 3: un hito que pasa a cumplido actualiza «Hitos cumplidos» y su gráfica sin recargar ------------------------

/** Lo que la historia dice para cada avance (celda «avance»): si cumple (100 %) o no (99 %). */
const AVANCE: ReadonlyMap<string, { readonly progress: number; readonly cumple: boolean }> = new Map<string, { readonly progress: number; readonly cumple: boolean }>([
  ['99', { progress: 99, cumple: false }],
  ['100', { progress: 100, cumple: true }],
]);

const TEXTO_HITO = 'Hito «PDR» de PRG-001 cumplido';

const hitoCumplido: BrowserRowHandler = onWeb(async (row, { page }) => {
  const avance = strict('avance', AVANCE, cell(row, 'avance'));
  const expected = `«Hitos cumplidos» ${avance.cumple ? `pasa a ${HITOS_CUMPLIDOS_SEED + 1} de ${HITOS_TOTAL_SEED} hitos y la gráfica de PRG-001 sube en 1` : `sigue en ${HITOS_CUMPLIDOS_SEED} de ${HITOS_TOTAL_SEED} hitos y la gráfica de PRG-001 no cambia`}; ${avance.cumple ? `aparece el texto «${TEXTO_HITO}»` : 'no aparece ningún evento de hito'}`;
  await resetTenants([TENANT]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.milestonesSub === `${HITOS_CUMPLIDOS_SEED} de ${HITOS_TOTAL_SEED} hitos`);
  if (!initial.reached) return prepFailedReason(expected, `«Hitos cumplidos» dice «${initial.view?.milestonesSub ?? '(sin leer)'}» antes del cambio, no ${HITOS_CUMPLIDOS_SEED} de ${HITOS_TOTAL_SEED} hitos`);
  const admin = await adminAccess(TENANT);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const before = link.eventTypes().length;
  const patched = await patchMilestone(admin.token, TENANT, 'PRG-001-M02', avance.progress);
  let arrivedMilestone = false;
  if (avance.cumple) {
    const arrived = await waitUntil(async () => link.eventTypes().slice(before).includes('milestone'), SHOW_CEILING_MS);
    arrivedMilestone = arrived.reached;
    await waitView(page, (view) => rowHasText(view, TEXTO_HITO));
  } else {
    await settle();
    arrivedMilestone = link.eventTypes().slice(before).includes('milestone');
  }
  const view = await readWeb(page);
  const pr001 = view?.milestoneBars.find((bar) => bar.code === 'PRG-001');
  const checks: Check[] = [
    check(patched.status >= 200 && patched.status < 300, 'el avance se registra (2xx)', `PATCH /api/milestones/PRG-001-M02 responde ${patched.status}`),
    check(avance.cumple ? arrivedMilestone : !arrivedMilestone, avance.cumple ? 'llega un evento de hito a la conexión' : 'no llega ningún evento de hito', `${arrivedMilestone ? 'llega' : 'no llega'} un evento de hito`),
    textCheck(view?.milestonesSub, avance.cumple ? `${HITOS_CUMPLIDOS_SEED + 1} de ${HITOS_TOTAL_SEED} hitos` : `${HITOS_CUMPLIDOS_SEED} de ${HITOS_TOTAL_SEED} hitos`, '«Hitos cumplidos» dice'),
    check(pr001?.done === (avance.cumple ? PRG001_CUMPLIDOS_SEED + 1 : PRG001_CUMPLIDOS_SEED), `la gráfica de PRG-001 tiene ${avance.cumple ? PRG001_CUMPLIDOS_SEED + 1 : PRG001_CUMPLIDOS_SEED} cumplido(s)`, `la gráfica de PRG-001 tiene ${pr001?.done ?? '(sin leer)'} cumplido(s)`),
    check(
      avance.cumple ? rowHasText(view, TEXTO_HITO) : !rowHasText(view, TEXTO_HITO),
      avance.cumple ? `aparece el texto «${TEXTO_HITO}»` : 'no aparece ningún evento de hito',
      avance.cumple ? `${rowHasText(view, TEXTO_HITO) ? 'aparece' : 'no aparece'} el texto «${TEXTO_HITO}»` : `${rowHasText(view, TEXTO_HITO) ? 'aparece' : 'no aparece'} el texto «${TEXTO_HITO}»`,
    ),
  ];
  return conclude(checks, { evidence: { tiposRecibidos: link.eventTypes(), filaPrimera: describeRow(feedTexts(view)[0]) } });
});

/** ¿Alguna fila del feed contiene exactamente el texto? */
const rowHasText = (view: WebView | undefined, text: string): boolean => feedTexts(view).some((item) => rowHas(item, text));

// --- Esquema 4: eliminar un programa baja «NC abiertas» a las que quedan en el tenant -----------------------------------

const borrarPrograma: BrowserRowHandler = onWeb(async (row, { page }) => {
  const code = cell(row, 'programa').split(' ')[0] ?? '';
  const nc = intOf(cell(row, 'nc_abiertas'));
  const expected = `«NC abiertas» muestra ${nc} sin recargar la página`;
  await resetTenants([TENANT]);
  const link = await installRealtimeLink(page);
  const failure = await startWeb(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `«NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del borrado, no 8`);
  const admin = await adminAccess(TENANT);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const reloads = await markNoReload(page);
  const removed = await deleteProgram(admin.token, TENANT, code);
  const { view } = await waitView(page, (current) => current.ncValue === String(nc));
  const reload = await reloads();
  // Contraste con la API (no decide el veredicto): ¿qué dice el resumen del tenant tras el borrado?
  const gestor = await gestorSession(TENANT);
  const apiNc = gestor.session === undefined ? undefined : ncOpenOf(await summaryOf(gestor.session.accessToken, TENANT));
  const shown = view?.ncValue ?? '(sin leer)';
  const note =
    view?.ncValue === String(nc)
      ? undefined
      : `La pantalla sigue en ${shown} y la historia pide ${nc} sin recargar. Tras el borrado, la API tiene ${apiNc === undefined ? '(sin leer)' : apiNc} NC abiertas, pero el panel solo recalcula «NC abiertas» con un evento nc_* y el borrado no emite ninguno (decisión pendiente de US-MISION-FEED-003).`;
  return conclude(
    [
      check(removed.status >= 200 && removed.status < 300, `${code} se elimina (2xx)`, `DELETE /api/programs/${code} responde ${removed.status}`),
      textCheck(view?.ncValue, String(nc), '«NC abiertas» muestra'),
      check(reload.marker && reload.loads === 0, 'la página no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
    ],
    { ...(note === undefined ? {} : { note }), evidence: { ncAbiertasEnApi: apiNc === undefined ? '(sin leer)' : String(apiNc), ncAbiertasEnPantalla: shown, tiposRecibidos: link.eventTypes() } },
  );
});

defineBrowserRows({
  story: 'US-MISION-FEED-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, ncAbiertasCambia],
    [2, tablaSeveridad],
    [3, hitoCumplido],
    [4, borrarPrograma],
  ]),
});
