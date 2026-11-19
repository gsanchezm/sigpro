import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, bearer, caseOf, expectChecks, loginAs, runCountOf, sendRun, verdict, type Expect } from './common';

// US-VER-EJECUCION-001 — Permiso y orden de los rechazos al registrar una ejecución (API). Preparación de cada fila: reinicio de
// alumno01 con su administrador y la cuenta de la fila con x-tenant alumno01. El orden que la historia fija: rol (403), luego
// resultado (422), luego caso (404). Los archivos (última comprobación) los prueba la historia 003.

/** Respuesta de las E1 y E3: 201 (una ejecución del caso TC-001), 403, 404 o 422 por el motivo del resultado. */
const RESPUESTA: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['201 con una ejecución del caso TC-001', { status: 201, caso: 'TC-001' }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['404 test_case_not_found', { status: 404, code: 'test_case_not_found' }],
  ['422 validation_failed con el motivo resultRequired en result', { status: 422, code: 'validation_failed', errors: { result: 'resultRequired' } }],
]);

/** Cabecera `Authorization` de la E2: ninguna, o un «Bearer» con un texto que no es un token. */
const CABECERA: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(sin cabecera)', {}],
  ['(Bearer con un texto que no es un token)', { authorization: 'Bearer texto-que-no-es-un-token' }],
]);

/** Respuesta de la E2: 401 con el código de la sesión. */
const RESPUESTA_E2: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

/** Caso de la E3: el del seed o uno que no existe. */
const CASO: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-999', 'TC-999'],
  ['TC-001', 'TC-001'],
]);

/** Cuerpo de la E3: el campo `result` con «pass», o sin ningún campo. */
const CUERPO: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['el campo result pass', { result: 'pass' }],
  ['(sin el campo result)', {}],
]);

/** E1: cada cuenta inicia sesión en alumno01 y registra una ejecución sin archivos (el rol decide). */
const permiso: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const expect = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const session = await loginAs(account);
  if (session.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} inicia sesión en alumno01`, `${cell(row, 'cuenta')} no obtiene accessToken en alumno01`, session.last);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, headers: bearer(session.token) });
  return verdict(expectChecks(expect, answer));
};

/** E2: sin sesión válida no se registra nada; el caso TC-001 sigue con sus 2 ejecuciones. */
const sinSesion: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const headers = strict('cabecera', CABECERA, cell(row, 'cabecera_authorization'));
  const expect = strict('respuesta', RESPUESTA_E2, cell(row, 'respuesta'));
  const admin = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (admin.token === undefined) return preparationFailed('alumno01 inicia sesión en alumno01', 'alumno01 no obtiene accessToken en alumno01', admin.last);
  const before = await caseOf(admin.token);
  if (runCountOf(before) !== 2) return preparationFailed('el caso TC-001 tiene 2 ejecuciones', `TC-001 con ${String(runCountOf(before))} ejecuciones`, before);
  const answer = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'pass' }, headers });
  const after = await caseOf(admin.token);
  const kept: Check = check(runCountOf(after) === 2, 'el caso TC-001 sigue con 2 ejecuciones', `el caso TC-001 con ${String(runCountOf(after))} ejecuciones`);
  return verdict([...expectChecks(expect, answer), kept]);
};

/** E3: el rol se comprueba antes que el caso y que el cuerpo (auditor con TC-999 da 403; alumno01 con TC-999 o sin resultado da 404 o 422). */
const orden: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const expect = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const fields = strict('cuerpo', CUERPO, cell(row, 'cuerpo'));
  const code = strict('caso', CASO, cell(row, 'caso'));
  const session = await loginAs(account);
  if (session.token === undefined) return preparationFailed(`${cell(row, 'cuenta')} inicia sesión en alumno01`, `${cell(row, 'cuenta')} no obtiene accessToken en alumno01`, session.last);
  const answer = await sendRun({ tenant: TENANT_A, code, fields, headers: bearer(session.token) });
  return verdict(expectChecks(expect, answer));
};

defineApiRows({
  story: 'US-VER-EJECUCION-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, permiso],
    [2, sinSesion],
    [3, orden],
  ]),
});
