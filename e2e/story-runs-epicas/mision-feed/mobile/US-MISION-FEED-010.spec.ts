import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { adminAccess, deleteProgram, gestorSession, intOf, ncOpenOf, patchMilestone, resetTenants, summaryOf, TENANT_A } from '../api/common';
import { ACCION_NC, actionCheck, performNc, type NcAct } from '../web/nc-actions';
import {
  actionFailed,
  conclude,
  describeRow,
  feedTexts,
  installRealtimeLink,
  markNoReload,
  prepFailed,
  prepFailedReason,
  readWeb,
  rowHas,
  settle,
  SHOW_CEILING_MS,
  textCheck,
  waitView,
  type RealtimeLink,
  type StepFailure,
  type WebView,
} from '../web/common';
import { mobileMilestoneRow, mobileNcCounts, onExpoWeb, startMobile, toggleMobileTable, valueCheck } from './common';

// US-MISION-FEED-010 — Actualizar en vivo «NC abiertas», su gráfica por severidad y «Hitos cumplidos» sin recargar (app móvil).
// Preparación: alumno01 reiniciado; el gestor abre «Panel de misión» en la app. Seed: 8 NC abiertas (2 menores, 2 mayores, 4 críticas);
// 175 hitos, 86 cumplidos; PRG-001 tiene 9 hitos y 1 cumplido (su M02, «PDR», está pendiente). Cifras calculadas con la fórmula del
// seed (apps/api/src/seed/data.ts), no leídas de la app.

const HITOS_CUMPLIDOS_SEED = 86;
const HITOS_TOTAL_SEED = 175;
const PRG001_CUMPLIDOS_SEED = 1;
const TEXTO_HITO = 'Hito «PDR» de PRG-001 cumplido';

const feedHas = (view: WebView | undefined, text: string): boolean => feedTexts(view).some((item) => rowHas(item, text));

// --- Esquema 1: cada cambio de NC actualiza «NC abiertas» sin recargar la pantalla ---------------------------------------

const tarjetaNc: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const act = strict('cambio', ACCION_NC, cell(row, 'cambio'));
  const cifra = intOf(cell(row, 'cifra'));
  const expected = `la tarjeta «NC abiertas» muestra ${cifra} sin recargar la pantalla`;
  await resetTenants([TENANT_A]);
  const link: RealtimeLink = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `la tarjeta «NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del cambio, no 8`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const reloads = await markNoReload(page);
  const { result, arrived } = await performNc(link, act, admin.token);
  const view = act.eventType === undefined ? await readWeb(page) : (await waitView(page, (current) => current.ncValue === String(cifra))).view;
  const reload = await reloads();
  return conclude(
    [
      actionCheck(result, act, 'la operación'),
      check(act.eventType === undefined || arrived, `llega el evento ${act.eventType ?? '(ninguno)'} a la conexión`, `${arrived ? 'llega' : 'no llega'} el evento ${act.eventType ?? '(ninguno)'} a la conexión`),
      textCheck(view?.ncValue, String(cifra), 'la tarjeta «NC abiertas» muestra'),
      check(reload.marker && reload.loads === 0, 'la pantalla no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
    ],
    { evidence: { tiposRecibidos: link.eventTypes(), respuesta: result.status } },
  );
});

// --- Esquema 2: la gráfica «NC abiertas por severidad» en su vista de tabla sigue a los cambios -----------------------

const ACCION_TABLA: ReadonlyMap<string, NcAct | undefined> = new Map<string, NcAct | undefined>([
  ['no se hace ningún cambio', undefined],
  ['alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', ACCION_NC.get('alumno01@sigpro.lab cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001')],
  [
    'alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción `Desviación de prueba en la ejecución`',
    ACCION_NC.get('alumno01@sigpro.lab crea con POST /api/nc una no conformidad en PRG-002 con severidad major y la descripción `Desviación de prueba en la ejecución`'),
  ],
]);

const TITULO_NC = 'NC abiertas por severidad';

const tablaSeveridad: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const act = strict('cambio', ACCION_TABLA, cell(row, 'cambio'));
  const menor = intOf(cell(row, 'menor'));
  const mayor = intOf(cell(row, 'mayor'));
  const critica = intOf(cell(row, 'critica'));
  const expected = `la tabla de «${TITULO_NC}» muestra «Menor» ${menor}, «Mayor» ${mayor} y «Crítica» ${critica}`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `la tarjeta «NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del cambio, no 8`);
  const toggled: StepFailure | undefined = await toggleMobileTable(page, TITULO_NC);
  if (toggled) return actionFailed(expected, toggled);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const performed = act === undefined ? undefined : await performNc(link, act, admin.token);
  if (act === undefined) await settle();
  const want = { Menor: String(menor), Mayor: String(mayor), Crítica: String(critica) };
  await waitUntil(async () => {
    const current = await mobileNcCounts(page);
    return current.Menor === want.Menor && current.Mayor === want.Mayor && current.Crítica === want.Crítica;
  }, SHOW_CEILING_MS);
  const counts = await mobileNcCounts(page);
  return conclude([
    ...(performed === undefined || act === undefined ? [] : [actionCheck(performed.result, act, 'la operación')]),
    valueCheck(counts.Menor, String(menor), '«Menor»'),
    valueCheck(counts.Mayor, String(mayor), '«Mayor»'),
    valueCheck(counts.Crítica, String(critica), '«Crítica»'),
  ]);
});

// --- Esquema 3: un hito que pasa a cumplido actualiza «Hitos cumplidos» y su gráfica sin recargar la pantalla ----------

const AVANCE: ReadonlyMap<string, { readonly progress: number; readonly cumple: boolean }> = new Map<string, { readonly progress: number; readonly cumple: boolean }>([
  ['99', { progress: 99, cumple: false }],
  ['100', { progress: 100, cumple: true }],
]);

const hitoCumplido: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const avance = strict('avance', AVANCE, cell(row, 'avance'));
  const sigue = `${HITOS_CUMPLIDOS_SEED} de ${HITOS_TOTAL_SEED} hitos`;
  const pasa = `${HITOS_CUMPLIDOS_SEED + 1} de ${HITOS_TOTAL_SEED} hitos`;
  const expected = avance.cumple
    ? `«Hitos cumplidos» pasa a ${pasa} y la gráfica de PRG-001 sube en 1; aparece el texto «${TEXTO_HITO}»`
    : `«Hitos cumplidos» sigue en ${sigue} y la gráfica de PRG-001 no cambia; no aparece ningún evento de hito`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.milestonesSub === sigue);
  if (!initial.reached) return prepFailedReason(expected, `«Hitos cumplidos» dice «${initial.view?.milestonesSub ?? '(sin leer)'}» antes del cambio, no «${sigue}»`);
  const toggled = await toggleMobileTable(page, 'Hitos cumplidos por programa');
  if (toggled) return actionFailed(expected, toggled);
  const before = await mobileMilestoneRow(page, 'PRG-001');
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const eventsBefore = link.eventTypes().length;
  const patched = await patchMilestone(admin.token, TENANT_A, 'PRG-001-M02', avance.progress);
  if (avance.cumple) {
    await waitUntil(async () => link.eventTypes().slice(eventsBefore).includes('milestone'), SHOW_CEILING_MS);
    await waitView(page, (view) => feedHas(view, TEXTO_HITO));
    await waitView(page, (view) => view.milestonesSub === pasa);
  } else {
    await settle();
  }
  const view = await readWeb(page);
  const after = await mobileMilestoneRow(page, 'PRG-001');
  const milestoneArrived = link.eventTypes().slice(eventsBefore).includes('milestone');
  const checks: Check[] = [
    check(patched.status >= 200 && patched.status < 300, 'el avance se registra (2xx)', `PATCH /api/milestones/PRG-001-M02 responde ${patched.status}`),
    check(avance.cumple ? milestoneArrived : !milestoneArrived, avance.cumple ? 'llega un evento de hito a la conexión' : 'no llega ningún evento de hito', `${milestoneArrived ? 'llega' : 'no llega'} un evento de hito`),
    valueCheck(view?.milestonesSub, avance.cumple ? pasa : sigue, '«Hitos cumplidos» dice'),
    valueCheck(after?.done, String(avance.cumple ? PRG001_CUMPLIDOS_SEED + 1 : PRG001_CUMPLIDOS_SEED), 'la gráfica de PRG-001 tiene cumplidos'),
    check(avance.cumple ? feedHas(view, TEXTO_HITO) : !feedHas(view, TEXTO_HITO), avance.cumple ? `aparece el texto «${TEXTO_HITO}»` : 'no aparece ningún evento de hito', `${feedHas(view, TEXTO_HITO) ? 'aparece' : 'no aparece'} el texto «${TEXTO_HITO}»`),
  ];
  return conclude(checks, { evidence: { gráficaAntes: before?.done ?? '(sin leer)', filaPrimera: describeRow(feedTexts(view)[0]) } });
});

// --- Esquema 4: eliminar un programa baja «NC abiertas» a las que quedan en el tenant --------------------------------

const borrarPrograma: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const code = cell(row, 'programa').split(' ')[0] ?? '';
  const nc = intOf(cell(row, 'nc_abiertas'));
  const expected = `la tarjeta «NC abiertas» muestra ${nc} sin recargar la pantalla`;
  await resetTenants([TENANT_A]);
  const link = await installRealtimeLink(page);
  const failure = await startMobile(page, link);
  if (failure) return prepFailed(expected, failure);
  const initial = await waitView(page, (view) => view.ncValue === '8');
  if (!initial.reached) return prepFailedReason(expected, `la tarjeta «NC abiertas» muestra ${initial.view?.ncValue ?? '(sin leer)'} antes del borrado, no 8`);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailed(expected, { message: 'alumno01@sigpro.lab no inicia sesión', callLog: [] });
  const reloads = await markNoReload(page);
  const removed = await deleteProgram(admin.token, TENANT_A, code);
  const { view } = await waitView(page, (current) => current.ncValue === String(nc));
  const reload = await reloads();
  const gestor = await gestorSession(TENANT_A);
  const apiNc = gestor.session === undefined ? undefined : ncOpenOf(await summaryOf(gestor.session.accessToken, TENANT_A));
  const shown = view?.ncValue ?? '(sin leer)';
  const note =
    view?.ncValue === String(nc)
      ? undefined
      : `La pantalla sigue en ${shown} y la historia pide ${nc} sin recargar. Tras el borrado, la API tiene ${apiNc === undefined ? '(sin leer)' : apiNc} NC abiertas, pero el panel solo recalcula «NC abiertas» con un evento nc_* y el borrado no emite ninguno (decisión pendiente de US-MISION-FEED-003).`;
  return conclude(
    [
      check(removed.status >= 200 && removed.status < 300, `${code} se elimina (2xx)`, `DELETE /api/programs/${code} responde ${removed.status}`),
      textCheck(view?.ncValue, String(nc), 'la tarjeta «NC abiertas» muestra'),
      check(reload.marker && reload.loads === 0, 'la pantalla no se recarga', `marcador ${String(reload.marker)}, cargas de página ${reload.loads}`),
    ],
    { ...(note === undefined ? {} : { note }), evidence: { ncAbiertasEnApi: apiNc === undefined ? '(sin leer)' : String(apiNc), ncAbiertasEnPantalla: shown, tiposRecibidos: link.eventTypes() } },
  );
});

defineBrowserRows({
  story: 'US-MISION-FEED-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, tarjetaNc],
    [2, tablaSeveridad],
    [3, hitoCumplido],
    [4, borrarPrograma],
  ]),
});
