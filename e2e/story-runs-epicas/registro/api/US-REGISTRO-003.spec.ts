import type { ApiResult } from '../../../story-runs/support/api';
import { cell, conclude, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { TENANT_A, motiveCheck, newAccountEmail, noRequestIdCheck, pendingCheck, postRegister, resetTenants, validBody } from './common';

// US-REGISTRO-003 — Exigir una contraseña de diez caracteres con mayúscula, minúscula, número y símbolo, y su confirmación.
// Preparación de cada fila: reinicio de alumno01 con su administrador; correo nuevo por fila.

// --- Esquema 1: la longitud mínima son diez caracteres ------------------------------------------------------------------------

const LENGTH_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['422 validation_failed con motivo pwShort para password', (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'password', 'pwShort'), noRequestIdCheck(result)]],
  ['201 con status pending_approval', (result) => [responseCheck(result, { status: 201 }), pendingCheck(result)]],
]);

const minimumLength: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const password = cell(row, 'contraseña');
  const expected = cell(row, 'respuesta');
  const checks = strict('respuesta', LENGTH_RESPONSES, expected);
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), password, confirm: password });
  return conclude(checks(result));
};

// --- Esquema 2: cada regla de la contraseña es obligatoria --------------------------------------------------------------------

const RULES: ReadonlySet<string> = new Set(['una mayúscula', 'una minúscula', 'un número', 'un símbolo']);

const eachRule: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const password = cell(row, 'contraseña');
  const rule = cell(row, 'regla');
  if (!RULES.has(rule)) throw new Error(`celda sin interpretación: regla «${rule}»`);
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), password, confirm: password });
  return conclude([responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'password'), noRequestIdCheck(result)]);
};

// --- Esquema 3: la confirmación debe ser igual a la contraseña ----------------------------------------------------------------

const CONFIRMATIONS: ReadonlyMap<string, string> = new Map([
  ['Abcdefghij1!', 'Abcdefghij1!'],
  ['abcdefghij1!', 'abcdefghij1!'],
  ['Abcdefghij1', 'Abcdefghij1'],
  ['(Abcdefghij1! con un espacio detrás)', 'Abcdefghij1! '],
  ['(vacío)', ''],
]);

const CONFIRM_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['201 con status pending_approval', (result) => [responseCheck(result, { status: 201 }), pendingCheck(result)]],
  ['422 validation_failed con motivo pwMismatch para confirm', (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'confirm', 'pwMismatch'), noRequestIdCheck(result)]],
]);

const confirmation: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const confirm = strict('confirmacion', CONFIRMATIONS, cell(row, 'confirmacion'));
  const checks = strict('respuesta', CONFIRM_RESPONSES, cell(row, 'respuesta'));
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), password: 'Abcdefghij1!', confirm });
  return conclude(checks(result));
};

defineApiRows({
  story: 'US-REGISTRO-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, minimumLength],
    [2, eachRule],
    [3, confirmation],
  ]),
});
