import { call } from '../../../story-runs/support/api';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, ALUMNO01, EXPECTATION_CELLS, TENANT_A, adminToken, compareRequirements, describeState, loginAs, premiseFailed, readRequirement, resetTenants, responseChecks, stateOf, transition, unchangedCheck, verdictOf, type Expectation } from './common';

// US-REQ-FLUJO-004 — Errores de la petición (422, 404 y 401) sin cambio de estado, en el orden 401 → 422 → 404. Cuerpos y cabeceras se toman
// literalmente de las celdas (un «(vacío)» es sin cuerpo; «(sin cabecera Authorization)» es sin token).

/** Cuerpo literal de cada celda «cuerpo»: el JSON de la historia (un «(vacío)» no envía cuerpo). */
const BODY_CELLS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"to": "done"}', { to: 'done' }],
  ['{"to": "Approved"}', { to: 'Approved' }],
  ['{"to": ""}', { to: '' }],
  ['{"to": 5}', { to: 5 }],
  ['{}', {}],
  ['{"to": "approved"}', { to: 'approved' }],
  ['(vacío)', undefined],
]);

/** Token de cada celda «cabecera»: `undefined` no envía `Authorization`; el texto va como `Bearer <texto>`. */
const HEADER_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera Authorization)', undefined],
  ['Authorization con Bearer seguido de (texto que no es un token)', 'no-es-un-token'],
]);

/** Requisitos que no existen en el tenant: se comprueba antes de cada fila con una lectura real (404). */
const REQUIREMENT_ABSENT = 'REQ-041';

/** Esquema 1: cuerpo sin un estado válido. 422 validation_failed con badState en `to`; el requisito sigue en draft. */
const badBody: ApiRowHandler = async (row) => {
  const expected = 'responde 422 con el código validation_failed y el motivo badState en el campo to; REQ-017 sigue en draft';
  const requestBody = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const expectation = strict('respuesta', EXPECTATION_CELLS, '422 con el código validation_failed y el motivo badState en el campo to');

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(ALUMNO01, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, 'inicio de sesión de alumno01@sigpro.lab en alumno01', actor.result);
  const before = await readRequirement(TENANT_A, admin, 'REQ-017');
  if (stateOf(before) !== 'draft') return premiseFailed(expected, `lectura de REQ-017 tras el reinicio: estado ${describeState(stateOf(before))} en lugar de draft`, before);

  const result = await transition('REQ-017', TENANT_A, actor.token, requestBody);
  const after = await readRequirement(TENANT_A, admin, 'REQ-017');

  return verdictOf([
    ...responseChecks(result, expectation, '422 con el código validation_failed y el motivo badState en el campo to'),
    check(stateOf(after) === 'draft', 'una lectura posterior devuelve draft', `una lectura posterior devuelve ${describeState(stateOf(after))}`),
    unchangedCheck(compareRequirements(before.body, after.body), 'el requisito no cambia (ningún campo, state incluido)'),
  ]);
};

/** Esquema 2: un código que no es un requisito del tenant. 404 requirement_not_found, o 422 si el cuerpo es inválido (el cuerpo va antes). */
const unknownRequirement: ApiRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requestBody = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const expectation: Expectation = strict('respuesta', EXPECTATION_CELLS, cell(row, 'respuesta'));
  const expected = `REQ-041 no existe y responde ${cell(row, 'respuesta')}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(account, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, `inicio de sesión de ${account.email} en alumno01`, actor.result);
  const absent = await call('GET', `/requirements/${REQUIREMENT_ABSENT}`, { tenant: TENANT_A, token: admin });
  if (absent.status !== 404) return premiseFailed(expected, 'lectura de REQ-041 tras el reinicio (debe responder 404)', absent);

  const result = await transition(REQUIREMENT_ABSENT, TENANT_A, actor.token, requestBody);
  return verdictOf(responseChecks(result, expectation, cell(row, 'respuesta')));
};

/** Esquema 3: sin una sesión válida. 401 con missing_token o invalid_token; REQ-017 sigue en draft. */
const badSession: ApiRowHandler = async (row) => {
  const authHeader = strict('cabecera', HEADER_CELLS, cell(row, 'cabecera'));
  const expectation = strict('respuesta', EXPECTATION_CELLS, cell(row, 'respuesta'));
  const expected = `responde ${cell(row, 'respuesta')} y REQ-017 sigue en draft`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(ALUMNO01, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, 'inicio de sesión de alumno01@sigpro.lab en alumno01', actor.result);
  const before = await readRequirement(TENANT_A, admin, 'REQ-017');
  if (stateOf(before) !== 'draft') return premiseFailed(expected, `lectura de REQ-017 tras el reinicio: estado ${describeState(stateOf(before))} en lugar de draft`, before);

  const result = await transition('REQ-017', TENANT_A, authHeader, { to: 'approved' });
  const after = await readRequirement(TENANT_A, admin, 'REQ-017');

  return verdictOf([
    ...responseChecks(result, expectation, cell(row, 'respuesta')),
    check(stateOf(after) === 'draft', 'una lectura posterior devuelve draft', `una lectura posterior devuelve ${describeState(stateOf(after))}`),
    unchangedCheck(compareRequirements(before.body, after.body), 'el requisito no cambia (ningún campo, state incluido)'),
  ]);
};

defineApiRows({
  story: 'US-REQ-FLUJO-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, badBody],
    [2, unknownRequirement],
    [3, badSession],
  ]),
});
