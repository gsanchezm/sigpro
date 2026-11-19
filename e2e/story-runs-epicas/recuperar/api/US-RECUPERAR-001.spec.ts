import type { ApiResult } from '../../../story-runs/support/api';
import { cell, conclude, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { TENANT_A, emptyBodyCheck, motiveCheck, noMotiveCheck, postForgot, preparationMissed, resetTenants, stateOfAccount, unknownEmail, type AccountState } from './common';

// US-RECUPERAR-001 — Responder 202 con cuerpo vacío a la recuperación, exista o no la cuenta. Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador (POST /api/admin/reset) y la petición con x-tenant alumno01 y sin Authorization. En el
// Esquema 1, antes de enviar, se comprueba con GET /api/admin/users que la cuenta del Dado está como dice la historia: si no, la
// preparación no se cumple y la fila discrepa con ese motivo.

const ACCEPTED = '202 con el cuerpo vacío {}';

/** Lo que el Dado da por hecho: la cuenta que hay que mirar (sin correo, la que se envía) y su estado. */
interface Situation {
  readonly email?: string;
  readonly wanted: AccountState;
}

const SITUATIONS: ReadonlyMap<string, Situation> = new Map<string, Situation>([
  ['la cuenta gestor@sigpro.test está activa', { email: 'gestor@sigpro.test', wanted: 'activa' }],
  ['la cuenta bloqueado@sigpro.test está bloqueada', { email: 'bloqueado@sigpro.test', wanted: 'bloqueada' }],
  ['la cuenta pendiente@sigpro.test está pendiente de aprobación', { email: 'pendiente@sigpro.test', wanted: 'pendiente de aprobación' }],
  ['no existe ninguna cuenta con ese correo', { wanted: 'sin cuenta' }],
]);

/** El correo que se envía. «(correo sin cuenta)» da uno nuevo en cada fila. */
const SENT: ReadonlyMap<string, () => string> = new Map<string, () => string>([
  ['gestor@sigpro.test', () => 'gestor@sigpro.test'],
  // Espacios delante y detrás: la validación los recorta, así que la cuenta es la misma
  ['(GESTOR@sigpro.test con un espacio delante y otro detrás)', () => ' GESTOR@sigpro.test '],
  ['bloqueado@sigpro.test', () => 'bloqueado@sigpro.test'],
  ['pendiente@sigpro.test', () => 'pendiente@sigpro.test'],
  ['(correo sin cuenta)', () => unknownEmail()],
  ['a@b.c', () => 'a@b.c'],
]);

// --- Esquema 1: la petición con un correo con forma de dirección responde 202 con cuerpo vacío -----------------------------

const accepted: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situation = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const sent = strict('correo', SENT, cell(row, 'correo'))();
  const subject = situation.email ?? sent.trim();
  const actual = await stateOfAccount(TENANT_A, subject);
  if (actual !== situation.wanted) return preparationMissed(ACCEPTED, `${subject} está ${actual} y la situación pide ${situation.wanted}`);
  const result = await postForgot(TENANT_A, { email: sent });
  return conclude([responseCheck(result, { status: 202 }), emptyBodyCheck(result)]);
};

// --- Esquema 2: un cuerpo no válido responde 422 con el motivo del correo ----------------------------------------------------

/** Valor de `email` en el cuerpo; `undefined` significa «sin el campo». */
const EMAIL_BODY: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', ''],
  ['(sin el campo)', undefined],
  ['(tres espacios)', '   '],
  ['no-es-un-correo', 'no-es-un-correo'],
  ['ana@sigpro', 'ana@sigpro'],
  ['@sigpro.test', '@sigpro.test'],
  ['(ana @sigpro.test, con un espacio antes de la arroba)', 'ana @sigpro.test'],
  ['a@b', 'a@b'],
  ['a@b.c', 'a@b.c'],
]);

const RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['422 validation_failed', (result) => [responseCheck(result, { status: 422, code: 'validation_failed' })]],
  ['202 con el cuerpo vacío {}', (result) => [responseCheck(result, { status: 202 }), emptyBodyCheck(result)]],
]);

const MOTIVES: ReadonlyMap<string, (result: ApiResult) => Check> = new Map<string, (result: ApiResult) => Check>([
  ['required', (result) => motiveCheck(result, 'required')],
  ['badEmail', (result) => motiveCheck(result, 'badEmail')],
  ['(ninguno)', (result) => noMotiveCheck(result)],
]);

const invalidBody: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = strict('email', EMAIL_BODY, cell(row, 'email'));
  const responseOf = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const motiveOf = strict('motivo', MOTIVES, cell(row, 'motivo'));
  const result = await postForgot(TENANT_A, email === undefined ? {} : { email });
  return conclude([...responseOf(result), motiveOf(result)]);
};

defineApiRows({
  story: 'US-RECUPERAR-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, accepted],
    [2, invalidBody],
  ]),
});
