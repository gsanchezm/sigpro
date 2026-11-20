import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, strict, type Check } from '../../support/checks';
import type { ApiResult } from '../../../story-runs/support/api';
import {
  OBSERVE_MS,
  TENANT_A,
  TENANT_B,
  adminAccess,
  conclude,
  createNc,
  describeEvent,
  describeHandshake,
  eventFieldCheck,
  gestorSession,
  openRealtime,
  prepFailure,
  prepFailureReason,
  quietWindow,
  resetTenants,
  simulatorMsOf,
  summaryOf,
  tickOf,
  varCheck,
  type RealtimeClient,
} from './common';

// US-MISION-FEED-002 — Entregar cada evento solo a las conexiones de su tenant (API).
// Preparación: se reinician alumno01 y alumno02; los gestores abren una conexión en cada tenant con su accessToken.
// Lo que una conexión recibe se mira en la conexión de SU tenant y en la del otro: la del otro no debe recibir nada.

/** Una acción de la historia: la hace el administrador del tenant que la nombra (ya con su token). */
interface Action {
  readonly tenant: string;
  readonly perform: (token: string) => Promise<ApiResult>;
  /** `nc`: alta de NC (201); `tick`: evento del simulador (200). */
  readonly kind: 'nc' | 'tick';
}

const ACTION_OF_CELL: ReadonlyMap<string, Action> = new Map<string, Action>([
  [
    'alumno01@sigpro.lab crea con POST /api/nc una no conformidad en alumno01 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`',
    { tenant: TENANT_A, kind: 'nc', perform: (token) => createNc(token, TENANT_A, 'minor') },
  ],
  [
    'alumno02@sigpro.lab crea con POST /api/nc una no conformidad en alumno02 en PRG-002 con severidad minor y la descripción `Desviación de prueba en la ejecución`',
    { tenant: TENANT_B, kind: 'nc', perform: (token) => createNc(token, TENANT_B, 'minor') },
  ],
  [
    'alumno01@sigpro.lab provoca un evento en alumno01 con POST /api/mission/tick',
    { tenant: TENANT_A, kind: 'tick', perform: (token) => tickOf(token, TENANT_A) },
  ],
]);

/** Qué escucha la fila: la conexión de alumno01 o la de alumno02. */
const LISTENER_OF_CELL: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Lo que la historia dice que recibe la conexión escuchada. */
type Expect = { readonly kind: 'nc_created' } | { readonly kind: 'simulator' } | { readonly kind: 'ninguno' };
const RESULT_OF_CELL: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['recibe el evento nc_created con seq 7 y el código NC-013', { kind: 'nc_created' }],
  ['recibe el evento de origen simulator con seq 7', { kind: 'simulator' }],
  ['no recibe ningún evento durante la observación', { kind: 'ninguno' }],
]);

const aislamiento: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = `la conexión de ${cell(row, 'escucha')} ${cell(row, 'resultado')}`;
  const action = strict('accion', ACTION_OF_CELL, cell(row, 'accion'));
  const listenTenant = strict('escucha', LISTENER_OF_CELL, cell(row, 'escucha'));
  const expectation = strict('resultado', RESULT_OF_CELL, cell(row, 'resultado'));

  const gestorA = await gestorSession(TENANT_A);
  if (gestorA.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestorA.result);
  const gestorB = await gestorSession(TENANT_B);
  if (gestorB.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno02', gestorB.result);
  const summaryA = await summaryOf(gestorA.session.accessToken, TENANT_A);
  if (simulatorMsOf(summaryA) !== 0) return prepFailureReason(expected, `la API no arrancó con SIMULATOR_MS 0 (resumen: ${String(simulatorMsOf(summaryA) ?? '(sin leer)')})`);
  const adminA = await adminAccess(TENANT_A);
  if (adminA.token === undefined) return prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', adminA.last);
  const adminB = await adminAccess(TENANT_B);
  if (adminB.token === undefined) return prepFailure(expected, 'alumno02@sigpro.lab inicia sesión', adminB.last);

  const clientA: RealtimeClient = await openRealtime({ token: gestorA.session.accessToken });
  const clientB: RealtimeClient = await openRealtime({ token: gestorB.session.accessToken });
  try {
    if (clientA.handshake.status !== 'accepted') return prepFailure(expected, 'la conexión de alumno01 se abre con el accessToken de gestor', { status: 0, body: clientA.handshake, ms: 0 });
    if (clientB.handshake.status !== 'accepted') return prepFailure(expected, 'la conexión de alumno02 se abre con el accessToken de gestor', { status: 0, body: clientB.handshake, ms: 0 });

    const listened = listenTenant === TENANT_A ? clientA : clientB;
    const actingToken = action.tenant === TENANT_A ? adminA.token : adminB.token;
    const result = await action.perform(actingToken);
    const expectedStatus = action.kind === 'nc' ? 201 : 200;
    const checks: Check[] = [check(result.status === expectedStatus, `la acción responde ${expectedStatus}`, `la acción responde ${result.status}`)];

    if (expectation.kind === 'ninguno') {
      const received = await quietWindow(listened, OBSERVE_MS);
      checks.push(check(received === 0, 'no recibe ningún evento durante la observación', `recibe ${received} evento(s)`));
      return conclude(checks, { evidence: { acciones: cell(row, 'accion'), escucha: listenTenant, saludoEscucha: describeHandshake(listened.handshake) } });
    }

    const event = await listened.waitEvent((item) => (expectation.kind === 'nc_created' ? item.type === 'nc_created' : item.origin === 'simulator'));
    checks.push(eventFieldCheck(event, 'seq', 7));
    if (expectation.kind === 'nc_created') {
      checks.push(check(event?.type === 'nc_created', 'recibe el evento nc_created', describeEvent(event)), varCheck(event, 'code', 'NC-013'));
    } else {
      checks.push(eventFieldCheck(event, 'origin', 'simulator'));
    }
    return conclude(checks, { evidence: { eventoRecibido: describeEvent(event), escucha: listenTenant, saludoEscucha: describeHandshake(listened.handshake) } });
  } finally {
    await clientA.close();
    await clientB.close();
  }
};

defineApiRows({
  story: 'US-MISION-FEED-002',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([[1, aislamiento]]),
});
