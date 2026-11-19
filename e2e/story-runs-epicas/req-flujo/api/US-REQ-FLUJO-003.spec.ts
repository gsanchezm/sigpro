import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, REQUIREMENT_CELLS, STATE_CELLS, TENANT_A, adminToken, compareRequirements, describeState, loginAs, premiseFailed, readRequirement, resetTenants, responseChecks, stateOf, transition, unchangedCheck, verdictOf, type Expectation } from './common';

// US-REQ-FLUJO-003 — Un rol sin el permiso del paso válido recibe 403 forbidden y el requisito no cambia. Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de la cuenta de la fila en alumno01 y lectura del requisito (estado de partida y cuerpo) antes del intento.

const FORBIDDEN: Expectation = { status: 403, code: 'forbidden' };

const withoutPermission: ApiRowHandler = async (row) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const fromState = strict('desde', STATE_CELLS, cell(row, 'desde'));
  const toState = strict('hasta', STATE_CELLS, cell(row, 'hasta'));
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const expected = `responde 403 con el código forbidden y ${requirementCode} sigue en ${fromState}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(account, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, `inicio de sesión de ${account.email} en alumno01`, actor.result);
  const before = await readRequirement(TENANT_A, admin, requirementCode);
  if (stateOf(before) !== fromState) return premiseFailed(expected, `lectura de ${requirementCode} tras el reinicio: estado ${describeState(stateOf(before))} en lugar de ${fromState}`, before);

  const result = await transition(requirementCode, TENANT_A, actor.token, { to: toState });
  const after = await readRequirement(TENANT_A, admin, requirementCode);

  return verdictOf([
    ...responseChecks(result, FORBIDDEN, '403 con el código forbidden'),
    check(stateOf(after) === fromState, `una lectura posterior devuelve ${fromState}`, `una lectura posterior devuelve ${describeState(stateOf(after))}`),
    unchangedCheck(compareRequirements(before.body, after.body), 'el requisito no cambia (ningún campo, state incluido)'),
  ]);
};

defineApiRows({
  story: 'US-REQ-FLUJO-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, withoutPermission]]),
});
