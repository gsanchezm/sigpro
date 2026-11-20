import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import type { Credentials } from '../../../story-runs/support/prepare';
import {
  ADMIN_ALUMNO02,
  TENANT_A,
  TENANT_B,
  TENANT_OF_HEADER,
  adminSession,
  conclude,
  eventOf,
  failedPreparation,
  field,
  fieldCheck,
  integerOf,
  isOk,
  listOf,
  notOkEvidence,
  programOf,
  resetTenants,
  sessionAs,
  summaryOf,
  tickMany,
  tickOf,
  varsCheck,
  varsOf,
} from './common';

// US-MISION-KPI-004 — Actividad reciente y valor del simulador en el resumen (API). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador; las emisiones de una fila se hacen con POST /api/mission/tick y ese mismo token. La historia
// inicial (EV-0001 a EV-0006) se crea con el primer resumen o la primera emisión tras el reinicio: los valores salen de la historia.

/** Separación de la historia inicial: 45 s entre eventos consecutivos (Regla de la historia). */
const BOOTSTRAP_STEP_MS = 45_000;
/** Forma ISO 8601 con milisegundos y zona UTC, como la emite la API. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// --- Esquema 1: tras reiniciar, la actividad reciente trae la historia inicial -------------------------------------------------

/** Comprobaciones de forma de cada evento de la actividad reciente (Reglas: identificador, orden, instante, origen y separación). */
const eventShapeChecks = (recent: readonly unknown[] | undefined): Check[] => {
  const events = recent ?? [];
  const ids = events.every((event) => /^EV-\d{4}$/.test(String(field(event, 'id'))));
  const origins = events.every((event) => field(event, 'origin') === 'simulator');
  const instants = events.every((event) => ISO_INSTANT.test(String(field(event, 'at'))));
  const seqs = events.every((event, index) => index === 0 || Number(field(events[index - 1], 'seq')) - Number(field(event, 'seq')) === 1);
  const spacing = events.every((event, index) => index === 0 || Date.parse(String(field(events[index - 1], 'at'))) - Date.parse(String(field(event, 'at'))) === BOOTSTRAP_STEP_MS);
  return [
    check(ids, 'cada evento tiene un identificador EV- seguido de cuatro cifras', ids ? 'identificadores EV-dddd' : `identificadores: ${events.map((event) => String(field(event, 'id'))).join(', ')}`),
    check(origins, 'los eventos del simulador llevan origin simulator', origins ? 'origin simulator en todos' : 'hay eventos con otro origin'),
    check(instants, 'cada evento trae su instante en formato ISO 8601', instants ? 'instantes ISO 8601' : 'algún instante no es ISO 8601'),
    check(seqs, 'seq cuenta los eventos de uno en uno (el más reciente tiene el mayor)', seqs ? 'seq consecutivos' : `seq: ${events.map((event) => String(field(event, 'seq'))).join(', ')}`),
    check(spacing, 'la historia inicial tiene instantes separados 45 segundos entre sí', spacing ? 'separación de 45 s' : 'la separación entre instantes no es de 45 s'),
  ];
};

const initialHistory: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const position = integerOf(row, 'posicion');
  const expected = `recent tiene 6 eventos y el elemento ${position} es ${cell(row, 'id')}, de tipo ${cell(row, 'tipo')}, con gravedad ${cell(row, 'gravedad')}, programCode ${cell(row, 'programa')} y vars con ${cell(row, 'variables')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const result = await summaryOf(admin.token);
  const recent = listOf(result.body, 'recent');
  const event = recent?.[position - 1];
  const count = check(recent?.length === 6, 'recent tiene 6 eventos', recent === undefined ? '(sin lista)' : `recent tiene ${recent.length} eventos`);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      count,
      fieldCheck('id', event, 'id', cell(row, 'id')),
      fieldCheck('tipo', event, 'type', cell(row, 'tipo')),
      fieldCheck('gravedad', event, 'severity', cell(row, 'gravedad')),
      fieldCheck('programCode', event, 'programCode', programOf(cell(row, 'programa'))),
      varsCheck(event, varsOf(cell(row, 'variables'))),
      ...eventShapeChecks(recent),
    ],
    {
      evidence: notOkEvidence(result),
      note: 'No comprobado por esta fila: el tope de 50 eventos por tenant (Regla 17) no es observable con el resumen, que muestra 20.',
    },
  );
};

// --- Esquema 2: la actividad reciente muestra como mucho 20 eventos ---------------------------------------------------------

const activityCap: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const emitted = integerOf(row, 'emitidos');
  const expected = `recent tiene ${cell(row, 'elementos')} elementos, el primero es ${cell(row, 'primero')} y el último es ${cell(row, 'ultimo')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const emittedOk = await tickMany(admin.token, emitted);
  if (emittedOk !== undefined) return failedPreparation(expected, emittedOk);
  const result = await summaryOf(admin.token);
  const recent = listOf(result.body, 'recent');
  const count = check(recent !== undefined && recent.length === integerOf(row, 'elementos'), `recent tiene ${cell(row, 'elementos')} elementos`, recent === undefined ? '(sin lista)' : `recent tiene ${recent.length} elementos`);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      count,
      fieldCheck('el primero', recent?.[0], 'id', cell(row, 'primero')),
      fieldCheck('el último', recent === undefined || recent.length === 0 ? undefined : recent[recent.length - 1], 'id', cell(row, 'ultimo')),
    ],
    {
      evidence: notOkEvidence(result),
      // El tope de 50 eventos del tenant no es observable con el resumen, que muestra 20: no se afirma aquí
      note: 'No comprobado por esta fila: el tenant guarda hasta 50 eventos, pero el resumen solo muestra 20 y el tope de 50 no se ve desde la API.',
    },
  );
};

// --- Esquema 3: los eventos de un tenant no aparecen en otro -----------------------------------------------------------------

const TENANT_EVENT_ACCOUNT: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([['alumno02@sigpro.lab', ADMIN_ALUMNO02]]);

const tenantsIsolated: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = 'recent tiene 6 elementos y ninguno cita el programa PRG-013 ni tiene el identificador EV-0007';
  const credentials = strict('cuenta', TENANT_EVENT_ACCOUNT, cell(row, 'cuenta'));
  const tenant = strict('tenant', TENANT_OF_HEADER, cell(row, 'tenant'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  // La emisión de alumno01 debe existir (EV-0007 sobre PRG-013) para que la comprobación de alumno02 signifique algo
  const tick = await tickOf(admin.token);
  const event = eventOf(tick);
  if (!isOk(tick) || field(event, 'id') !== 'EV-0007' || field(event, 'programCode') !== 'PRG-013') {
    return preparationFailed(expected, 'alumno01@sigpro.lab emite EV-0007 sobre PRG-013 con POST /api/mission/tick', tick);
  }
  const other = await sessionAs(tenant, credentials);
  if (other.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en ${tenant}`, other.last);
  const result = await summaryOf(other.token, tenant);
  const recent = listOf(result.body, 'recent');
  const checks: Check[] = [
    responseCheck(result, { status: 200 }),
    check(recent?.length === 6, 'recent tiene 6 elementos', recent === undefined ? '(sin lista)' : `recent tiene ${recent.length} elementos`),
    check(recent !== undefined && !recent.some((item) => field(item, 'programCode') === 'PRG-013'), 'ninguno cita el programa PRG-013', recent?.some((item) => field(item, 'programCode') === 'PRG-013') ? 'alguno cita PRG-013' : 'ninguno cita PRG-013'),
    check(recent !== undefined && !recent.some((item) => field(item, 'id') === 'EV-0007'), 'ninguno tiene el identificador EV-0007', recent?.some((item) => field(item, 'id') === 'EV-0007') ? 'alguno tiene EV-0007' : 'ninguno tiene EV-0007'),
  ];
  return conclude(checks, { evidence: notOkEvidence(result) });
};

// --- Esquema 4: el intervalo del simulador es el del entorno de la prueba ------------------------------------------------------

/** Intervalo de la celda `intervalo` → valor de `simulatorMs` que la historia espera. */
const INTERVAL: ReadonlyMap<string, number> = new Map<string, number>([['SIMULATOR_MS=0 (apagado)', 0]]);

const simulatorInterval: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `simulatorMs vale ${cell(row, 'valor')}`;
  const intervalValue = strict('intervalo', INTERVAL, cell(row, 'intervalo'));
  if (integerOf(row, 'valor') !== intervalValue) throw new Error('la celda valor no corresponde al intervalo de la historia');
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const result = await summaryOf(admin.token);
  // El Dado (SIMULATOR_MS=0) solo se ve a través de simulatorMs: si no es 0, el entorno no cumple la precondición
  if (field(result.body, 'simulatorMs') !== intervalValue) {
    return preparationFailed(expected, `el entorno tiene el simulador apagado (SIMULATOR_MS=0), y simulatorMs no vale ${intervalValue}`, result);
  }
  return conclude([responseCheck(result, { status: 200 }), fieldCheck('simulatorMs', result.body, 'simulatorMs', intervalValue)], { evidence: notOkEvidence(result) });
};

defineApiRows({
  story: 'US-MISION-KPI-004',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, initialHistory],
    [2, activityCap],
    [3, tenantsIsolated],
    [4, simulatorInterval],
  ]),
});
