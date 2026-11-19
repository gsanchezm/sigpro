import type { Locator } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A, DEMO } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, HOLD_MS, holdsFor, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { ADMIN_ALUMNO01, adminSession, isOk } from '../api/common';
import {
  actionMissing,
  afterListResponse,
  globalSearch,
  jsonBodyOf,
  ncCodeOf,
  prepFailed,
  prepFailedReason,
  progCodeOf,
  readCard,
  reloadCheck,
  reloadGuard,
  rowAction,
  runSteps,
  signIn,
  summaryBlock,
  tapLive,
  valueCheck,
  withNote,
  type LiveTap,
  type ReloadGuard,
  type SummaryReply,
} from './common';

// US-PROG-METRICAS-004 — NC abiertas al día en la lista de programas (web). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador; gestor@sigpro.test (o alumno01@sigpro.lab en el Esquema 3) entra y tiene la lista abierta con 8 NC
// abiertas; los cambios de NC se hacen con el token de alumno01@sigpro.lab, sin recargar la página del gestor. Como la lista no tiene
// indicador de conexión, la conexión en vivo y los eventos `mission:event` se observan en el WebSocket de la página.
// Las peticiones de NC (registrar, cambiar la gravedad, cambiar de estado) son el disparador que cada Esquema da por hecho: si la API
// no las acepta, la fila no llega a su estado y se registra como fallo de preparación, con la respuesta de la API en la evidencia.

const NC_LABEL = 'NC abiertas';
/** Gravedades válidas de una NC: el texto de la celda es también el valor que la API espera (`minor`, `major`, `critical`). */
const SEVERITIES: ReadonlyMap<string, string> = new Map<string, string>([
  ['minor', 'minor'],
  ['major', 'major'],
  ['critical', 'critical'],
]);

/**
 * Antes de cada cambio en vivo: la tarjeta muestra 8 y la conexión en vivo está abierta. Si no, la fila no se puede preparar tal
 * como dice la historia (es un fallo de la preparación, no un veredicto sobre el cambio).
 */
const liveReady = async (block: Locator, live: LiveTap, expected: string): Promise<Outcome | undefined> => {
  const at8 = await waitUntil(async () => (await readCard(block, NC_LABEL)).value === '8', CEILING_MS);
  if (!at8.reached) {
    const seen = (await readCard(block, NC_LABEL)).value ?? '(sin leer)';
    return prepFailedReason(expected, `la tarjeta «NC abiertas» muestra ${seen} antes del cambio, y la historia dice 8`);
  }
  const connected = await waitUntil(async () => live.connected(), CEILING_MS);
  if (!connected.reached) return prepFailedReason(expected, 'la conexión en vivo de la lista no se abre (no llega el acuse de Socket.IO)');
  return undefined;
};

/** Eventos de misión recibidos desde `before`. */
const eventsSince = (live: LiveTap, before: number): readonly string[] => live.events().slice(before);

/**
 * Espera (con techo) a un evento DEL TIPO que la acción provoca, no a cualquier evento. Devuelve si llegó y todos los tipos recibidos
 * tras la acción, para la evidencia.
 */
const eventOfType = async (live: LiveTap, before: number, type: string): Promise<{ readonly reached: boolean; readonly types: readonly string[] }> => {
  const waited = await waitUntil(async () => eventsSince(live, before).includes(type), CEILING_MS);
  return { reached: waited.reached, types: eventsSince(live, before) };
};

/** Evidencia del evento esperado: el tipo que se esperaba, el que llegó (si llegó) y todos los tipos recibidos. */
const eventEvidence = (type: string, event: { readonly reached: boolean; readonly types: readonly string[] }): Readonly<Record<string, unknown>> => ({
  tipoEsperado: type,
  tipoRecibido: event.reached ? type : undefined,
  tiposTrasAccion: event.types,
});

/** Armado del marcador «sin recargar»: si no se puede poner, la fila no puede juzgar la recarga. */
const armGuard = async (guard: ReloadGuard, expected: string): Promise<Outcome | undefined> => ((await guard.arm()) ? undefined : prepFailedReason(expected, 'no se pudo poner el marcador «sin recargar» en la página'));

/** Nota de la fila de NC abiertas tras eliminar: la cifra observada y los eventos recibidos (en la evidencia). */
const summaryEvidence = (reply: SummaryReply | undefined): Readonly<Record<string, unknown>> =>
  reply === undefined ? { respuestaResumenTrasAccion: '(no llegó la respuesta del resumen)' } : { respuestaResumenTrasAccion: { status: reply.status, ncOpen: reply.ncOpen, ncTotal: reply.ncTotal } };

// --- Esquema 1: una NC nueva en el tenant sube la cifra sin recargar la página ----------------------------------------------

const newNc: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const severity = strict('gravedad', SEVERITIES, cell(row, 'gravedad'));
  const expected = 'sin recargar la página, la tarjeta «NC abiertas» muestra 9';
  const live = tapLive(page);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  const ready = await liveReady(block, live, expected);
  if (ready) return ready;
  const guard = reloadGuard(page);
  const armed = await armGuard(guard, expected);
  if (armed) return armed;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const before = live.events().length;
  const created = await call('POST', '/nc', {
    tenant: TENANT_A,
    token: admin.token,
    body: { programCode: 'PRG-002', severity, description: 'Desviación de prueba en la ejecución' },
  });
  if (!isOk(created)) return preparationFailed(expected, `POST /api/nc registra una NC en PRG-002 con severidad ${cell(row, 'gravedad')}`, created);
  const event = await eventOfType(live, before, 'nc_created');
  await waitUntil(async () => (await readCard(block, NC_LABEL)).value === '9', CEILING_MS);
  const reading = await readCard(block, NC_LABEL);
  const recarga = await guard.verdict();
  return conclude([valueCheck(reading, '9'), reloadCheck(recarga)], {
    evidence: { ...eventEvidence('nc_created', event), lineaAuxiliar: reading.aux ?? '(sin leer)', recarga },
  });
};

// --- Esquema 2: cambiar la gravedad de una NC abierta no cambia la cifra ----------------------------------------------------

const severityChange: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = ncCodeOf(cell(row, 'nc'));
  const severity = strict('gravedad', SEVERITIES, cell(row, 'gravedad'));
  const expected = 'sin recargar la página, la tarjeta «NC abiertas» sigue mostrando 8';
  const live = tapLive(page);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  const ready = await liveReady(block, live, expected);
  if (ready) return ready;
  const guard = reloadGuard(page);
  const armed = await armGuard(guard, expected);
  if (armed) return armed;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const before = live.events().length;
  const patched = await call('PATCH', `/nc/${code}`, { tenant: TENANT_A, token: admin.token, body: { severity } });
  if (!isOk(patched)) return preparationFailed(expected, `PATCH /api/nc/${code} cambia la gravedad a ${cell(row, 'gravedad')}`, patched);
  const event = await eventOfType(live, before, 'nc_updated');
  // Tras el evento (si llega), la cifra se observa durante un tiempo fijo: «sigue mostrando 8»
  const held = await holdsFor(async () => (await readCard(block, NC_LABEL)).value === '8', HOLD_MS);
  const reading = await readCard(block, NC_LABEL);
  const recarga = await guard.verdict();
  return conclude([valueCheck(reading, '8'), check(held.held, `la cifra sigue en 8 durante ${HOLD_MS / 1000} s`, held.held ? 'la cifra sigue en 8' : 'la cifra cambió'), reloadCheck(recarga)], {
    evidence: { ...eventEvidence('nc_updated', event), recarga },
  });
};

// --- Esquema 3: eliminar un programa quita sus NC abiertas de la cifra -------------------------------------------------------

const deleteProgram: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = progCodeOf(cell(row, 'programa'));
  const shown = cell(row, 'nc_abiertas');
  const expected = `sin recargar la página, la tarjeta «NC abiertas» muestra ${shown} y su línea auxiliar dice «de 8 registradas»`;
  const live = tapLive(page);
  const opened = await signIn(page, ADMIN_ALUMNO01);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  // Dado: la tarjeta muestra 8 NC abiertas antes de eliminar (solo la cifra: la historia no exige la conexión en vivo aquí)
  const at8 = await waitUntil(async () => (await readCard(block, NC_LABEL)).value === '8', CEILING_MS);
  if (!at8.reached) return prepFailedReason(expected, `la tarjeta «NC abiertas» no muestra 8 antes de eliminar (muestra ${(await readCard(block, NC_LABEL)).value ?? '(sin leer)'})`);
  const guard = reloadGuard(page);
  await guard.arm();
  let listReplied = false;
  const searched = await runSteps([[`escribir ${code} en «Búsqueda global»`, async () => { listReplied = await afterListResponse(page, () => globalSearch(page).fill(code, ACTION)); }]]);
  if (searched) return actionMissing(expected, searched);
  if (!listReplied) return prepFailedReason(expected, `la lista no pidió datos (GET /api/programs) tras escribir ${code} en «Búsqueda global»`);
  const eventsBefore = live.events().length;
  // Se asigna dentro de la acción: el `as` evita que TypeScript lo estreche a `undefined` antes de leerlo
  let reply = undefined as SummaryReply | undefined;
  const removed = await runSteps([[`eliminar ${code} desde su menú de acciones`, async () => { reply = await rowAction(page, code, 'Eliminar', true); }]]);
  if (removed) return actionMissing(expected, removed);
  // La cifra puede tardar en reflejar la eliminación: se espera (con techo de 5 s) al valor de la historia antes de leerla
  await waitUntil(async () => (await readCard(block, NC_LABEL)).value === shown, 5_000);
  const reading = await readCard(block, NC_LABEL);
  const eventsAfter = live.events().length - eventsBefore;
  const lineCheck: Check = check(reading.aux === 'de 8 registradas', 'la línea auxiliar dice «de 8 registradas»', `la línea auxiliar dice «${reading.aux ?? '(sin leer)'}»`);
  const outcome = conclude([valueCheck(reading, shown), lineCheck], {
    evidence: { eventosDeMisionTrasEliminar: eventsAfter, ...summaryEvidence(reply), recargaObservada: await guard.verdict() },
  });
  if (outcome.verdict === 'coincide') return outcome;
  return withNote(
    outcome,
    `La historia pide que la tarjeta baje a ${shown} sin recargar. Observado: la tarjeta muestra ${reading.value ?? '(sin leer)'} y llegaron ${eventsAfter} eventos de misión tras la eliminación. La respuesta del resumen tras el borrado trae ncOpen ${String(reply?.ncOpen ?? '(sin respuesta)')} (ver la evidencia). Posible causa (hipótesis por lectura del código, sin confirmar): ProgramsMetrics.tsx usa el valor en vivo de la sesión cuando existe (ncOpen ?? kpis.ncOpen) y programs.service.ts (remove) no emite evento.`,
  );
};

// --- Esquema 4: cerrar o rechazar una NC abierta baja la cifra sin recargar la página ----------------------------------------

const transitionNc: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = ncCodeOf(cell(row, 'nc'));
  const body = jsonBodyOf(cell(row, 'cuerpo'));
  const expected = 'sin recargar la página, la tarjeta «NC abiertas» muestra 7';
  const live = tapLive(page);
  const opened = await signIn(page, DEMO.gestor);
  if (opened) return prepFailed(expected, opened);
  const block = summaryBlock(page);
  const ready = await liveReady(block, live, expected);
  if (ready) return ready;
  const guard = reloadGuard(page);
  const armed = await armGuard(guard, expected);
  if (armed) return armed;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return prepFailedReason(expected, 'alumno01@sigpro.lab no inicia sesión (administración)');
  const before = live.events().length;
  const sent = await call('POST', `/nc/${code}/transition`, { tenant: TENANT_A, token: admin.token, body });
  if (!isOk(sent)) return preparationFailed(expected, `POST /api/nc/${code}/transition con el cuerpo de la fila`, sent);
  // Cerrar emite `nc_closed`; rechazar emite `nc_moved` (el tipo lo fija la API según el destino)
  const type = typeof body === 'object' && body !== null && (body as { readonly to?: unknown }).to === 'closed' ? 'nc_closed' : 'nc_moved';
  const event = await eventOfType(live, before, type);
  await waitUntil(async () => (await readCard(block, NC_LABEL)).value === '7', CEILING_MS);
  const reading = await readCard(block, NC_LABEL);
  const recarga = await guard.verdict();
  return conclude([valueCheck(reading, '7'), reloadCheck(recarga)], { evidence: { ...eventEvidence(type, event), recarga } });
};

defineBrowserRows({
  story: 'US-PROG-METRICAS-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, newNc],
    [2, severityChange],
    [3, deleteProgram],
    [4, transitionNc],
  ]),
});
