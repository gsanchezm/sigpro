import { field } from '../../../story-runs/support/api';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, REQUIREMENT_CELLS, STATE_CELLS, TENANT_A, adminToken, compareRequirements, describeState, loginAs, premiseFailed, readRequirement, resetTenants, stateOf, transition, unchangedCheck, verdictOf } from './common';

// US-REQ-FLUJO-001 — Un paso válido cambia el estado con el rol que lo puede dar (200). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador; después la cuenta de la fila inicia sesión en alumno01 (x-tenant). Antes del paso se lee el requisito (estado de
// partida y cuerpo completo); tras el paso se compara el cuerpo de la respuesta con esa lectura y se hace una lectura posterior.

const validStep: ApiRowHandler = async (row) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const fromState = strict('desde', STATE_CELLS, cell(row, 'desde'));
  const toState = strict('hasta', STATE_CELLS, cell(row, 'hasta'));
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const expected = `la respuesta es 200 y trae el requisito ${requirementCode} con el estado ${toState}; una lectura posterior devuelve ${toState}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(account, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, `inicio de sesión de ${account.email} en alumno01`, actor.result);
  const before = await readRequirement(TENANT_A, admin, requirementCode);
  if (stateOf(before) !== fromState) return premiseFailed(expected, `lectura de ${requirementCode} tras el reinicio: estado ${describeState(stateOf(before))} en lugar de ${fromState}`, before);

  const result = await transition(requirementCode, TENANT_A, actor.token, { to: toState });
  const after = await readRequirement(TENANT_A, admin, requirementCode);
  const sameFields = compareRequirements(before.body, result.body, ['state']);
  const codeOfBody = field(result.body, 'code');

  return verdictOf([
    check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
    check(
      result.status === 200 && codeOfBody === requirementCode && stateOf(result) === toState,
      `trae ${requirementCode} con el estado ${toState}`,
      `trae ${typeof codeOfBody === 'string' ? codeOfBody : '(sin código)'} con el estado ${describeState(stateOf(result))}`,
    ),
    unchangedCheck(sameFields, 'todos los campos del requisito iguales a la lectura anterior salvo state'),
    check(stateOf(after) === toState, `una lectura posterior devuelve ${toState}`, `una lectura posterior devuelve ${describeState(stateOf(after))}`),
  ]);
};

defineApiRows({
  story: 'US-REQ-FLUJO-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, validStep]]),
});
