import { cell, conclude, responseCheck, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { EMPTY_MARKERS, TENANT_A, bodyValue, motiveCheck, newAccountEmail, noRequestIdCheck, postRegister, resetTenants, validBody } from './common';

// US-REGISTRO-002 — Rechazar una solicitud con campos obligatorios vacíos o un correo sin forma de dirección. Preparación de cada
// fila: reinicio de alumno01 con su administrador. Las filas de «sin el campo» esperan el motivo `required` que dice la historia.

const FIELDS: ReadonlyMap<string, string> = new Map([
  ['first', 'first'],
  ['last', 'last'],
  ['org', 'org'],
  ['email', 'email'],
]);

const BAD_EMAILS: ReadonlyMap<string, string> = new Map([
  ['no-es-un-correo', 'no-es-un-correo'],
  ['ana@sigpro', 'ana@sigpro'],
  ['@sigpro.test', '@sigpro.test'],
  ['ana@@sigpro.test', 'ana@@sigpro.test'],
  ['ana@sigpro.', 'ana@sigpro.'],
  ['(ana @sigpro.test, con un espacio antes de la arroba)', 'ana @sigpro.test'],
]);

// --- Esquema 1: un campo obligatorio vacío o con solo espacios responde required ----------------------------------------------

const requiredField: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const fieldName = strict('campo', FIELDS, cell(row, 'campo'));
  const value = bodyValue(cell(row, 'valor'), EMPTY_MARKERS);
  // El cuerpo es válido salvo el campo de la fila; «(sin el campo)» deja la clave fuera del cuerpo
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), [fieldName]: value });
  return conclude([
    responseCheck(result, { status: 422, code: 'validation_failed' }),
    motiveCheck(result, fieldName, 'required'),
    noRequestIdCheck(result),
  ]);
};

// --- Esquema 2: un correo que no tiene forma de dirección responde badEmail ---------------------------------------------------

const badEmail: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = strict('correo', BAD_EMAILS, cell(row, 'correo'));
  const result = await postRegister(TENANT_A, validBody(email));
  return conclude([responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'email', 'badEmail'), noRequestIdCheck(result)]);
};

defineApiRows({
  story: 'US-REGISTRO-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, requiredField],
    [2, badEmail],
  ]),
});
