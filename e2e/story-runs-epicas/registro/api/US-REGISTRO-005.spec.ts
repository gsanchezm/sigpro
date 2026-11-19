import { usersByEmail, type ApiResult } from '../../../story-runs/support/api';
import { cell, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler } from '../../support/framework';
import { TENANT_02, TENANT_A, noRequestIdCheck, pendingCheck, postRegister, requestAccount, resetTenants, validBody } from './common';

// US-REGISTRO-005 — Responder 409 si el correo ya tiene cuenta en el tenant. Preparación: reinicio de alumno01 (y de alumno02 en
// el Esquema 2) con sus administradores. Las cuentas del seed se comprueban en el listado de usuarios antes de enviar.

// --- Esquema 1: un correo de una cuenta que ya existe en el tenant responde 409 ----------------------------------------------

/** Cuentas del seed que la historia nombra (cada una existe en alumno01 tras el reinicio). */
const ACCOUNTS: ReadonlyMap<string, string> = new Map([
  ['admin@sigpro.test', 'admin@sigpro.test'],
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['pendiente@sigpro.test', 'pendiente@sigpro.test'],
  ['alumno01@sigpro.lab', 'alumno01@sigpro.lab'],
]);

/** Texto del correo que la fila envía: el de la historia, o la versión con mayúsculas y espacios de «(GESTOR…)». */
const SENT: ReadonlyMap<string, string> = new Map([
  ['admin@sigpro.test', 'admin@sigpro.test'],
  ['(GESTOR@sigpro.test con un espacio delante y otro detrás)', ' GESTOR@sigpro.test '],
  ['pendiente@sigpro.test', 'pendiente@sigpro.test'],
  ['alumno01@sigpro.lab', 'alumno01@sigpro.lab'],
]);

const existingAccount: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const sent = strict('correo', SENT, cell(row, 'correo'));
  // La fila debe escribir la misma cuenta, sin mayúsculas ni espacios de los extremos
  if (sent.trim().toLowerCase() !== account) throw new Error(`fila incoherente: correo «${sent}» no es la cuenta «${account}»`);
  const expected = `cuenta ${account} existe en alumno01; respuesta 409 email_exists; no trae requestId`;
  // «Dado que … existe la cuenta»: se comprueba en el listado del tenant antes de enviar
  const users = await usersByEmail(TENANT_A);
  if (!users.has(account)) return outcome(false, expected, `la preparación no se cumplió: ${account} no está en el listado de alumno01`, { note: 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.' });
  const result = await postRegister(TENANT_A, validBody(sent));
  return conclude([responseCheck(result, { status: 409, code: 'email_exists' }), noRequestIdCheck(result)]);
};

// --- Esquema 2: una solicitud anterior cuenta en su tenant y no en otro -----------------------------------------------------

const ANOTHER_TENANT_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['409 email_exists', (result) => [responseCheck(result, { status: 409, code: 'email_exists' })]],
  ['201 con status pending_approval', (result) => [responseCheck(result, { status: 201 }), pendingCheck(result)]],
]);

const TENANT_HEADERS: ReadonlyMap<string, string> = new Map([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_02],
]);

const previousRequest: ApiRowHandler = async (row) => {
  // El «Dado» reinicia alumno01 y alumno02 y crea la solicitud anterior en alumno01 (correo nuevo y Abcdefghij1!)
  await resetTenants([TENANT_A, TENANT_02]);
  const expected = cell(row, 'respuesta');
  const checks = strict('respuesta', ANOTHER_TENANT_RESPONSES, expected);
  const tenant = strict('cabecera', TENANT_HEADERS, cell(row, 'cabecera'));
  const requested = await requestAccount(TENANT_A);
  if (requested.result.status !== 201) {
    return preparationFailed(expected, 'alumno01 recibe la solicitud previa de la fila (201)', requested.result);
  }
  const result = await postRegister(tenant, validBody(requested.email));
  return conclude(checks(result));
};

defineApiRows({
  story: 'US-REGISTRO-005',
  surface: 'api',
  tenants: [TENANT_A, TENANT_02],
  handlers: new Map<number, ApiRowHandler>([
    [1, existingAccount],
    [2, previousRequest],
  ]),
});
