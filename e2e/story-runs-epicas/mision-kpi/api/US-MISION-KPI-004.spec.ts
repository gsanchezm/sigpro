import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude } from './common';
import { cell, check, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import type { Credentials } from '../../../story-runs/support/prepare';
import {
  ADMIN_ALUMNO02,
  TENANT_A,
  TENANT_B,
  TENANT_OF_HEADER,
  adminSession,
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

// --- Esquema 1: tras reiniciar, la actividad reciente trae la historia inicial -------------------------------------------------

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
    ],
    { evidence: notOkEvidence(result) },
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
    { evidence: notOkEvidence(result) },
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

const simulatorInterval: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `simulatorMs vale ${cell(row, 'valor')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const result = await summaryOf(admin.token);
  return conclude([responseCheck(result, { status: 200 }), fieldCheck('simulatorMs', result.body, 'simulatorMs', integerOf(row, 'valor'))], { evidence: notOkEvidence(result) });
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
