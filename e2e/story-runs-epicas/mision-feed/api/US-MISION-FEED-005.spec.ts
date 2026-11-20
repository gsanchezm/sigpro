import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, strict, type Check } from '../../support/checks';
import {
  TENANT_A,
  adminAccess,
  conclude,
  createNc,
  describeEvent,
  eventFieldCheck,
  gestorSession,
  isOk,
  prepFailure,
  prepFailureReason,
  recentOf,
  resetTenant,
  resetTenants,
  simulatorMsOf,
  summaryOf,
  tickOf,
  tickEvent,
  type ApiResult,
} from './common';

// US-MISION-FEED-005 — Reiniciar el tenant devuelve el feed a su historia inicial (API).
// Preparación: alumno01 reiniciado; los eventos previos se provocan después con POST /api/nc y POST /api/mission/tick (admin); el
// historial se lee con GET /api/mission/summary (campo recent) y el token del gestor. La API se arranca con SIMULATOR_MS=0.

/** Eventos previos que la historia nombra (celda «previos»): cada paso con su respuesta esperada. */
type Previo = 'nc' | 'tick';
const PREVIOS: ReadonlyMap<string, readonly Previo[]> = new Map<string, readonly Previo[]>([
  ['ningún evento', []],
  ['una no conformidad creada con POST /api/nc (seq 7)', ['nc']],
  ['tres no conformidades creadas con POST /api/nc (seq 7 a 9) y un evento provocado con POST /api/mission/tick (seq 10)', ['nc', 'nc', 'nc', 'tick']],
]);

const reinicio: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const previos = strict('previos', PREVIOS, cell(row, 'previos'));
  const siguiente = Number(cell(row, 'siguiente_seq'));
  const expected = `el historial tiene 6 eventos, el más reciente con seq 6, ninguno de los eventos provocados antes aparece y el siguiente evento tiene seq ${siguiente}`;
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
  const before = await summaryOf(gestor.session.accessToken, TENANT_A);
  if (simulatorMsOf(before) !== 0) return prepFailureReason(expected, `la API no arrancó con SIMULATOR_MS 0 (resumen: ${String(simulatorMsOf(before) ?? '(sin leer)')})`);

  // Eventos previos, después del reinicio de la preparación: cada uno debe responder como dice la historia
  const provoked: string[] = [];
  for (const step of previos) {
    const result: ApiResult = step === 'nc' ? await createNc(admin.token, TENANT_A, 'minor') : await tickOf(admin.token, TENANT_A);
    const wanted = step === 'nc' ? 201 : 200;
    if (result.status !== wanted) return prepFailure(expected, `provocar un evento previo (${step})`, result);
    const seqOfStep = step === 'tick' ? tickEvent(result)?.seq : undefined;
    provoked.push(seqOfStep === undefined ? `${step} (201)` : `${step} seq ${seqOfStep}`);
  }

  // Cuándo: el reinicio con el token del administrador, y después la lectura del historial
  const reset = await resetTenant(TENANT_A);
  const after = await summaryOf(gestor.session.accessToken, TENANT_A);
  const recent = recentOf(after) ?? [];
  const newest = recent[0];

  // Y el siguiente evento que se genera
  const next = await tickOf(admin.token, TENANT_A);
  const nextEvent = tickEvent(next);

  const checks: Check[] = [
    check(isOk(reset), 'alumno01@sigpro.lab reinicia el tenant con POST /api/admin/reset (2xx)', `POST /api/admin/reset respondió ${reset.status}`),
    check(recent.length === 6, 'el historial tiene 6 eventos', `el historial tiene ${recent.length} eventos`),
    check(newest?.seq === 6, 'el más reciente tiene seq 6', `el más reciente tiene seq ${String(newest?.seq ?? '(sin leer)')}`),
    check(recent.every((event) => event.seq <= 6), 'ninguno de los eventos provocados antes aparece', `aparecen ${recent.filter((event) => event.seq > 6).length} evento(s) con seq mayor que 6`),
    check(!recent.some((event) => event.type === 'nc_created'), 'ninguna NC creada aparece en el historial', `aparecen ${recent.filter((event) => event.type === 'nc_created').length} evento(s) nc_created`),
    eventFieldCheck(nextEvent, 'seq', siguiente),
  ];
  return conclude(checks, { evidence: { previosProvocados: provoked, historialTrasReinicio: recent.map((event) => describeEvent(event)).slice(0, 6), siguiente: describeEvent(nextEvent) } });
};

defineApiRows({
  story: 'US-MISION-FEED-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, reinicio]]),
});
