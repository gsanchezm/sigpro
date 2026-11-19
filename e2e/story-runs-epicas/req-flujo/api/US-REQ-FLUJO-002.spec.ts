import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ALUMNO01, REQUIREMENT_CELLS, STATE_CELLS, TENANT_A, adminToken, compareRequirements, describeState, loginAs, premiseFailed, readRequirement, resetTenants, responseChecks, stateOf, transition, unchangedCheck, verdictOf, type Expectation } from './common';

// US-REQ-FLUJO-002 — Un par de estados que la máquina no tiene responde 409 invalid_transition (code y message) y el requisito no cambia.
// alumno01 (admin) tiene todos los permisos, así que aquí lo que falla es el paso. Preparación: reinicio de alumno01, inicio de sesión de
// alumno01 y lectura del requisito (estado de partida y cuerpo completo) antes del intento.

const INVALID: Expectation = { status: 409, code: 'invalid_transition', message: 'invalid_transition' };

const invalidPair: ApiRowHandler = async (row) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const fromState = strict('desde', STATE_CELLS, cell(row, 'desde'));
  const toState = strict('hasta', STATE_CELLS, cell(row, 'hasta'));
  const expected = `responde 409 con el código invalid_transition y ${requirementCode} sigue en ${fromState}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(ALUMNO01, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, 'inicio de sesión de alumno01@sigpro.lab en alumno01', actor.result);
  const before = await readRequirement(TENANT_A, admin, requirementCode);
  if (stateOf(before) !== fromState) return premiseFailed(expected, `lectura de ${requirementCode} tras el reinicio: estado ${describeState(stateOf(before))} en lugar de ${fromState}`, before);

  const result = await transition(requirementCode, TENANT_A, actor.token, { to: toState });
  const after = await readRequirement(TENANT_A, admin, requirementCode);

  return verdictOf([
    ...responseChecks(result, INVALID, '409 con el código invalid_transition y mensaje invalid_transition'),
    check(stateOf(after) === fromState, `una lectura posterior devuelve ${fromState}`, `una lectura posterior devuelve ${describeState(stateOf(after))}`),
    unchangedCheck(compareRequirements(before.body, after.body), 'el requisito no cambia (ningún campo, state incluido)'),
  ]);
};

defineApiRows({
  story: 'US-REQ-FLUJO-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, invalidPair]]),
});
