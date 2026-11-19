import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude } from './common';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check, type ExpectedResponse } from '../../support/checks';
import {
  ACCOUNTS,
  INVENTED_TOKEN,
  TENANT_A,
  adminSession,
  eventOf,
  failedPreparation,
  field,
  fieldCheck,
  integerOf,
  kpisOf,
  listOf,
  notOkEvidence,
  programOf,
  resetTenants,
  sessionAs,
  showValue,
  summaryOf,
  tickMany,
  tickOf,
  varsCheck,
  varsOf,
} from './common';

// US-MISION-KPI-005 — Emitir el siguiente evento del simulador con POST /api/mission/tick (API, solo administrador). Preparación de
// cada fila: reinicio de alumno01 con el token de su administrador; las cuentas de la fila inician sesión en alumno01. Lo que la
// historia espera (respuesta, identificador, gravedad, programa y valores del evento) sale de su texto, nunca de la API.

/** Respuesta de la celda `respuesta` de la historia: 200 con un evento, o un código y estado de error. */
const ANSWERS: ReadonlyMap<string, ExpectedResponse & { readonly event: boolean }> = new Map<string, ExpectedResponse & { readonly event: boolean }>([
  ['200 con un evento', { status: 200, event: true }],
  ['403 forbidden', { status: 403, code: 'forbidden', event: false }],
]);

/** Cabecera `Authorization` de la celda del Esquema 2: sin cabecera, o un token que la API no ha emitido. */
const HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(token inventado)', INVENTED_TOKEN],
]);

// --- Esquema 1: solo el administrador del tenant puede emitir un evento -----------------------------------------------------

const onlyAdmin: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const answer = strict('respuesta', ANSWERS, cell(row, 'respuesta'));
  const expected = `la respuesta de POST /api/mission/tick es ${cell(row, 'respuesta')}`;
  const email = cell(row, 'cuenta');
  strict('cuenta', ACCOUNTS, email);
  const session = await sessionAs(TENANT_A, { email, password: cell(row, 'contraseña') });
  if (session.token === undefined) return preparationFailed(expected, `${email} inicia sesión en alumno01 con la contraseña de la fila`, session.last);
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const before = await summaryOf(admin.token);
  const tick = await tickOf(session.token);
  const checks: Check[] = [responseCheck(tick, answer)];
  if (answer.event) {
    const event = eventOf(tick);
    checks.push(check(event !== undefined && typeof field(event, 'id') === 'string', 'la respuesta trae un objeto event con su identificador', event === undefined ? 'sin objeto event' : `event con id ${showValue(field(event, 'id'))}`));
    checks.push(check(field(event, 'origin') === 'simulator', 'el evento tiene origin simulator', `origin ${showValue(field(event, 'origin'))}`));
    const after = await summaryOf(admin.token);
    const first = listOf(after.body, 'recent')?.[0];
    checks.push(check(event !== undefined && field(first, 'id') === field(event, 'id'), 'el evento emitido es el primero de la actividad reciente', `el primero es ${showValue(field(first, 'id'))}`));
    checks.push(check(JSON.stringify(kpisOf(before.body)) === JSON.stringify(kpisOf(after.body)), 'emitir el evento no cambia las cifras de kpis', JSON.stringify(kpisOf(after.body)) === JSON.stringify(kpisOf(before.body)) ? 'kpis sin cambios' : 'kpis cambian al emitir'));
  }
  return conclude(checks, { evidence: notOkEvidence(tick) });
};

// --- Esquema 2: sin una sesión válida no se emite ningún evento -------------------------------------------------------------

const noSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `la respuesta de POST /api/mission/tick es ${cell(row, 'respuesta')}; al pedir el resumen, recent tiene 6 elementos`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const tick = await tickOf(strict('cabecera', HEADERS, cell(row, 'cabecera')));
  const after = await summaryOf(admin.token);
  const recent = listOf(after.body, 'recent');
  return conclude(
    [
      responseCheck(tick, parseResponse(cell(row, 'respuesta'))),
      check(recent?.length === 6, 'al pedir el resumen, recent tiene 6 elementos (no se emitió ninguno)', recent === undefined ? '(sin lista)' : `recent tiene ${recent.length} elementos`),
    ],
    { evidence: notOkEvidence(tick) },
  );
};

// --- Esquema 3: cada emisión produce el siguiente evento de la secuencia ----------------------------------------------------

const nextInSequence: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const emitted = integerOf(row, 'emitidos');
  const expected = `el evento tiene el identificador ${cell(row, 'id')}, tipo ${cell(row, 'tipo')}, gravedad ${cell(row, 'gravedad')}, programCode ${cell(row, 'programa')} y vars con ${cell(row, 'valor')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const previous = await tickMany(admin.token, emitted);
  if (previous !== undefined) return failedPreparation(expected, previous);
  const tick = await tickOf(admin.token);
  const event = eventOf(tick);
  return conclude(
    [
      responseCheck(tick, { status: 200 }),
      fieldCheck('id', event, 'id', cell(row, 'id')),
      fieldCheck('tipo', event, 'type', cell(row, 'tipo')),
      fieldCheck('gravedad', event, 'severity', cell(row, 'gravedad')),
      fieldCheck('programCode', event, 'programCode', programOf(cell(row, 'programa'))),
      varsCheck(event, varsOf(cell(row, 'valor'))),
    ],
    { evidence: notOkEvidence(tick) },
  );
};

defineApiRows({
  story: 'US-MISION-KPI-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyAdmin],
    [2, noSession],
    [3, nextInSequence],
  ]),
});
