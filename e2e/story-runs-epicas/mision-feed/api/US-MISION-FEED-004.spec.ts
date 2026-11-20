import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { quoted } from '../../support/browser';
import { cell, check, sleep, strict, type Check } from '../../support/checks';
import {
  TENANT_A,
  adminAccess,
  conclude,
  describeEvent,
  describeHandshake,
  eventFieldCheck,
  gestorSession,
  intOf,
  ncOpenOf,
  openRealtime,
  prepFailure,
  prepFailureReason,
  programOf,
  recentOf,
  renderEventText,
  resetTenants,
  simulatorMsOutcome,
  summaryOf,
  tickMany,
  type RealtimeClient,
} from './common';

// US-MISION-FEED-004 — Simulador de misión: apagado, encendido solo con conexiones abiertas y secuencia fija (API).
// Cada Esquema dice con qué SIMULATOR_MS arranca la API. El arnés no cambia esa configuración: se LEE del resumen (`simulatorMs`)
// y, si no es la que dice la historia, la fila no se prepara (preparationFailed). Por eso el Esquema 2 necesita una pila distinta.

/** Lo que una fila de observación mide: cuánto se espera sin acciones (ms), con el simulador apagado o encendido. */
const WINDOW_OFF_MS = 5_000;
const WINDOW_ON_MS = 12_000;

/** Gravedad de cada tipo del ciclo fijo del simulador (Regla 19 de la historia). */
const GRAVEDAD_DEL_TIPO: ReadonlyMap<string, string> = new Map<string, string>([
  ['link', 'info'],
  ['telemetry', 'info'],
  ['heartbeat', 'info'],
  ['milestone', 'ok'],
  ['test_pass', 'ok'],
  ['thermal', 'warn'],
  ['link_lost', 'danger'],
]);

/** Último `seq` del historial (el más reciente), o `undefined` si el resumen no lo trae. */
const lastSeqOf = (summary: Awaited<ReturnType<typeof summaryOf>>): number | undefined => recentOf(summary)?.[0]?.seq;

// --- Esquema 1: con el simulador apagado no llega ningún evento sin una acción -----------------------------------------------

const SITUACION_APAGADO: ReadonlyMap<string, 'con-conexion' | 'sin-conexion'> = new Map<string, 'con-conexion' | 'sin-conexion'>([
  ['gestor@sigpro.test tiene una conexión abierta', 'con-conexion'],
  ['no hay ninguna conexión abierta en alumno01', 'sin-conexion'],
]);

const RESULTADO_APAGADO: ReadonlyMap<string, 'con-conexion' | 'sin-conexion'> = new Map<string, 'con-conexion' | 'sin-conexion'>([
  ['la conexión no recibe ningún evento y el último seq del historial sigue en 6', 'con-conexion'],
  ['el último seq del historial sigue en 6', 'sin-conexion'],
]);

const apagado: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situacion = strict('situacion', SITUACION_APAGADO, cell(row, 'situacion'));
  const resultado = strict('resultado', RESULTADO_APAGADO, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
  const before = await summaryOf(gestor.session.accessToken, TENANT_A);
  const notOff = await simulatorMsOutcome(expected, 0);
  if (notOff) return notOff;
  if (lastSeqOf(before) !== 6) return prepFailureReason(expected, `el historial recién reiniciado no empieza en seq 6 (último: ${String(lastSeqOf(before) ?? '(sin leer)')})`);
  let client: RealtimeClient | undefined;
  if (situacion === 'con-conexion') {
    client = await openRealtime({ token: gestor.session.accessToken });
    if (client.handshake.status !== 'accepted') {
      await client.close();
      return prepFailure(expected, 'la conexión del gestor se abre', { status: 0, body: client.handshake, ms: 0 });
    }
  }
  try {
    await sleep(WINDOW_OFF_MS);
    const after = await summaryOf(gestor.session.accessToken, TENANT_A);
    const checks: Check[] = [];
    if (resultado === 'con-conexion') {
      const events = client?.events() ?? [];
      checks.push(check(events.length === 0, 'la conexión no recibe ningún evento', `la conexión recibe ${events.length} evento(s)${events[0] === undefined ? '' : `: ${describeEvent(events[0])}`}`));
    }
    checks.push(check(lastSeqOf(after) === 6, 'el último seq del historial sigue en 6', `el último seq del historial es ${String(lastSeqOf(after) ?? '(sin leer)')}`));
    return conclude(checks, { evidence: { saludo: client === undefined ? '(sin conexión)' : describeHandshake(client.handshake) } });
  } finally {
    await client?.close();
  }
};

// --- Esquema 2: con el simulador encendido solo reciben eventos los tenants con una conexión abierta -------------------------

const SITUACION_ENCENDIDO: ReadonlyMap<string, 'con-conexion' | 'sin-conexion'> = new Map<string, 'con-conexion' | 'sin-conexion'>([
  ['gestor@sigpro.test tiene una conexión abierta', 'con-conexion'],
  ['no hay ninguna conexión abierta en alumno01', 'sin-conexion'],
]);

const RESULTADO_ENCENDIDO: ReadonlyMap<string, 'con-conexion' | 'sin-conexion'> = new Map<string, 'con-conexion' | 'sin-conexion'>([
  ['la conexión recibe al menos un evento de origen simulator antes de agotar la espera de la prueba, el último seq sube por encima de 6 y el número de NC abiertas del resumen sigue en 8', 'con-conexion'],
  ['el último seq sigue en 6', 'sin-conexion'],
]);

const encendido: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situacion = strict('situacion', SITUACION_ENCENDIDO, cell(row, 'situacion'));
  const resultado = strict('resultado', RESULTADO_ENCENDIDO, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
  const before = await summaryOf(gestor.session.accessToken, TENANT_A);
  // Esta fila necesita una pila con SIMULATOR_MS=4000; con otra configuración no es ejecutable (no es un fallo de la app)
  const notFourThousand = await simulatorMsOutcome(expected, 4000);
  if (notFourThousand) return notFourThousand;
  if (lastSeqOf(before) !== 6) return prepFailureReason(expected, `el historial recién reiniciado no empieza en seq 6 (último: ${String(lastSeqOf(before) ?? '(sin leer)')})`);
  let client: RealtimeClient | undefined;
  if (situacion === 'con-conexion') {
    client = await openRealtime({ token: gestor.session.accessToken });
    if (client.handshake.status !== 'accepted') {
      await client.close();
      return prepFailure(expected, 'la conexión del gestor se abre', { status: 0, body: client.handshake, ms: 0 });
    }
  }
  try {
    if (resultado === 'con-conexion') {
      // Espera con techo: la historia no fija plazo; la prueba observa hasta tres intervalos del simulador
      const event = await client?.waitEvent((item) => item.origin === 'simulator', WINDOW_ON_MS);
      const after = await summaryOf(gestor.session.accessToken, TENANT_A);
      const last = lastSeqOf(after);
      return conclude(
        [
          check(event !== undefined, 'la conexión recibe al menos un evento de origen simulator', event === undefined ? `ningún evento de origen simulator en ${WINDOW_ON_MS / 1000} s` : describeEvent(event)),
          check(last !== undefined && last > 6, 'el último seq sube por encima de 6', `el último seq es ${String(last ?? '(sin leer)')}`),
          check(ncOpenOf(after) === 8, 'el número de NC abiertas del resumen sigue en 8', `NC abiertas del resumen ${String(ncOpenOf(after) ?? '(sin leer)')}`),
        ],
        { evidence: { eventoRecibido: describeEvent(event), saludo: describeHandshake(client?.handshake ?? { status: 'sin-respuesta', detail: 'sin conexión' }) } },
      );
    }
    await sleep(WINDOW_ON_MS);
    const after = await summaryOf(gestor.session.accessToken, TENANT_A);
    return conclude([check(lastSeqOf(after) === 6, 'el último seq sigue en 6', `el último seq es ${String(lastSeqOf(after) ?? '(sin leer)')}`)]);
  } finally {
    await client?.close();
  }
};

// --- Esquema 3: la secuencia del simulador es fija (eventos provocados con POST /api/mission/tick) -----------------------

const secuenciaFija: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const n = intOf(cell(row, 'n'));
  const seq = intOf(cell(row, 'seq'));
  const tipo = cell(row, 'tipo');
  const programa = programOf(cell(row, 'programa'));
  const texto = quoted(cell(row, 'texto'));
  const expected = `el último evento provocado tiene seq ${seq}, tipo ${tipo}, programCode ${cell(row, 'programa')} y el texto «${texto}»`;
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
  const notOff = await simulatorMsOutcome(expected, 0);
  if (notOff) return notOff;
  const before = await summaryOf(gestor.session.accessToken, TENANT_A);
  // Antes de provocar: el último seq del historial es 6 (la historia inicial); si no, la secuencia no empieza donde la historia dice
  const seqAntes = lastSeqOf(before);
  const ticks = await tickMany(admin.token, TENANT_A, n);
  if (ticks.failed) return conclude([check(false, 'POST /api/mission/tick responde 200', `POST /api/mission/tick respondió ${ticks.failed.result.status}`)], { evidence: { paso: ticks.failed.step } });
  const last = ticks.last;
  return conclude(
    [
      check(seqAntes === 6, 'antes de provocar, el último seq del historial es 6', `antes de provocar, el último seq es ${String(seqAntes ?? '(sin leer)')}`),
      eventFieldCheck(last, 'seq', seq),
      eventFieldCheck(last, 'type', tipo),
      eventFieldCheck(last, 'origin', 'simulator'),
      // Regla 19: la gravedad de cada tipo del ciclo fijo
      eventFieldCheck(last, 'severity', strict('tipo', GRAVEDAD_DEL_TIPO, tipo)),
      eventFieldCheck(last, 'programCode', programa),
      check(last !== undefined && renderEventText(last) === texto, `el texto «${texto}»`, `el texto «${last === undefined ? '(sin evento)' : renderEventText(last)}»`),
    ],
    { evidence: { eventoProvocado: describeEvent(last) } },
  );
};

defineApiRows({
  story: 'US-MISION-FEED-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, apagado],
    [2, encendido],
    [3, secuenciaFija],
  ]),
});
