import type { ApiResult } from '../../../story-runs/support/api';
import { cell, conclude, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { EMPTY_MARKERS, TENANT_A, bodyValue, motiveCheck, newAccountEmail, noRequestIdCheck, pendingCheck, postRegister, resetTenants, roleEchoCheck, validBody } from './common';

// US-REGISTRO-004 — Exigir la aceptación de las condiciones y un rol solicitable. Preparación de cada fila: reinicio de alumno01
// con su administrador; correo nuevo por fila.

// --- Esquema 1: las condiciones deben aceptarse -------------------------------------------------------------------------------

const TERMS: ReadonlyMap<string, boolean | string | undefined> = new Map<string, boolean | string | undefined>([
  ['true', true],
  ['false', false],
  ['(sin el campo)', undefined],
  ['(el texto si)', 'si'],
]);

const TERMS_RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['201 con status pending_approval', (result) => [responseCheck(result, { status: 201 }), pendingCheck(result)]],
  ['422 validation_failed con motivo termsReq para terms', (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'terms', 'termsReq'), noRequestIdCheck(result)]],
  ['422 validation_failed con un motivo para terms', (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'terms'), noRequestIdCheck(result)]],
]);

const acceptTerms: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const terms = strict('condiciones', TERMS, cell(row, 'condiciones'));
  const checks = strict('respuesta', TERMS_RESPONSES, cell(row, 'respuesta'));
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), terms });
  return conclude(checks(result));
};

// --- Esquema 2: solo se pueden pedir los roles de la lista ---------------------------------------------------------------------

const REQUESTABLE: ReadonlySet<string> = new Set(['consultant', 'program_manager', 'auditor']);

const ROLE_RESPONSES: ReadonlyMap<string, 'accepted' | 'rejected'> = new Map<string, 'accepted' | 'rejected'>([
  ['201 con status pending_approval y role consultant', 'accepted'],
  ['201 con status pending_approval y role program_manager', 'accepted'],
  ['201 con status pending_approval y role auditor', 'accepted'],
  ['422 validation_failed con un motivo para role y no trae requestId', 'rejected'],
]);

const requestableRole: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const role = bodyValue(cell(row, 'rol'), EMPTY_MARKERS);
  const expected = cell(row, 'respuesta');
  const kind = strict('respuesta', ROLE_RESPONSES, expected);
  // Un rol de la lista debe corresponder a una respuesta aceptada, y el resto a un rechazo: si no, la fila no se entiende
  if ((role !== undefined && REQUESTABLE.has(role)) !== (kind === 'accepted')) throw new Error(`fila incoherente: rol «${String(role)}» con respuesta «${expected}»`);
  const result = await postRegister(TENANT_A, { ...validBody(newAccountEmail()), role });
  if (kind === 'accepted') {
    return conclude([responseCheck(result, { status: 201 }), pendingCheck(result), roleEchoCheck(result, String(role))]);
  }
  return conclude([responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'role'), noRequestIdCheck(result)]);
};

defineApiRows({
  story: 'US-REGISTRO-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, acceptTerms],
    [2, requestableRole],
  ]),
});
