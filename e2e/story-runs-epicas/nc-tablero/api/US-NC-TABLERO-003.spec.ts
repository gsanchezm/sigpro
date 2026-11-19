import { adminCredentials, field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import {
  MACHINE,
  NC_CODE_CELLS,
  STATE_CELLS,
  TENANT_A,
  TENANT_B,
  TO_CELLS,
  actorOf,
  answerChecks,
  detailNc,
  diffStates,
  listNc,
  resetTenants,
  sameStates,
  stateMap,
  stateOfBody,
  stringsOf,
  transitionNc,
  verdict,
  withoutCode,
} from './common';

// US-NC-TABLERO-003 — Pasos de estado por la API. Preparación de cada fila: reinicio de alumno01 (y de alumno02 en la fila de
// aislamiento) con el token de su administrador; después, alumno01@sigpro.lab (rol admin, sin segundo factor) inicia sesión en
// alumno01 y usa su accessToken en todas las peticiones. Cada fila compara la lista completa (código → estado) antes y después
// para comprobar que solo cambia la no conformidad de la ruta.

const ADMIN_ALUMNO01 = adminCredentials(TENANT_A);
const ADMIN_ALUMNO02 = adminCredentials(TENANT_B);

/** Lista completa de estados del tenant (código → estado), con el token dado. `ok` es falso si la lista no se pudo leer. */
const snapshot = async (tenant: string, token: string): Promise<{ readonly ok: boolean; readonly states: ReadonlyMap<string, string> }> => {
  const listed = await listNc(tenant, token);
  return { ok: listed.status === 200, states: stateMap(listed.body) };
};

/** Los pasos de la respuesta son los que la máquina da desde el estado de destino (mismos pasos, en cualquier orden). */
const sameSteps = (observed: readonly string[] | undefined, expected: readonly string[]): boolean =>
  observed !== undefined && observed.length === expected.length && expected.every((step) => observed.includes(step));

// --- Esquema 1: un paso admitido cambia el estado (y solo el de la ruta) ----------------------------------------------------

const admittedStep: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const initial = strict('estado_inicial', STATE_CELLS, cell(row, 'estado_inicial'));
  const to = strict('destino', TO_CELLS, cell(row, 'destino'));
  const expected = `respuesta 200 con state ${to}; GET de ${code} devuelve state ${to}; ninguna otra no conformidad cambia`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const before = await snapshot(TENANT_A, admin.token);
  const initialRead = await detailNc(TENANT_A, admin.token, code);
  if (stateOfBody(initialRead) !== initial) {
    return preparationFailed(expected, `${code} está en ${initial} (la lectura da ${stateOfBody(initialRead) ?? '(sin state)'})`, initialRead);
  }

  const acted = await transitionNc(TENANT_A, admin.token, code, { to });
  const after = await detailNc(TENANT_A, admin.token, code);
  const listedAfter = await snapshot(TENANT_A, admin.token);
  const steps = stringsOf(field(acted.body, 'transitions'));
  const expectedSteps = MACHINE.get(to) ?? [];
  const others = { before: withoutCode(before.states, code), after: withoutCode(listedAfter.states, code) };
  const checks: Check[] = [
    ...answerChecks({ status: 200, state: to }, acted),
    check(sameSteps(steps, expectedSteps), `transitions desde ${to}: ${expectedSteps.join(', ') || '(ninguno)'}`, `transitions ${steps === undefined ? '(sin transitions)' : steps.join(', ') || '(ninguno)'}`),
    check(stateOfBody(after) === to, `GET ${code} devuelve state ${to}`, `GET ${code} devuelve state ${stateOfBody(after) ?? '(sin state)'}`),
    check(before.ok && listedAfter.ok, 'la lista se lee antes y después (200)', `lista antes ${before.ok ? '200' : 'no legible'}, después ${listedAfter.ok ? '200' : 'no legible'}`),
    check(sameStates(others.before, others.after), 'ninguna otra no conformidad cambia', `cambios en las demás: ${diffStates(others.before, others.after)}`),
  ];
  return verdict(checks);
};

// --- Esquema 2: un paso no admitido responde 409 y no cambia nada -----------------------------------------------------------

const rejectedStep: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const initial = strict('estado_inicial', STATE_CELLS, cell(row, 'estado_inicial'));
  const to = strict('destino', TO_CELLS, cell(row, 'destino'));
  const expected = `respuesta 409 invalid_transition; GET de ${code} sigue con state ${initial}; ninguna no conformidad cambia`;

  await resetTenants([TENANT_A]);
  const admin = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  const before = await snapshot(TENANT_A, admin.token);
  const initialRead = await detailNc(TENANT_A, admin.token, code);
  if (stateOfBody(initialRead) !== initial) {
    return preparationFailed(expected, `${code} está en ${initial} (la lectura da ${stateOfBody(initialRead) ?? '(sin state)'})`, initialRead);
  }

  const acted = await transitionNc(TENANT_A, admin.token, code, { to });
  const after = await detailNc(TENANT_A, admin.token, code);
  const listedAfter = await snapshot(TENANT_A, admin.token);
  return verdict([
    ...answerChecks({ status: 409, code: 'invalid_transition' }, acted),
    check(stateOfBody(after) === initial, `GET ${code} sigue con state ${initial}`, `GET ${code} da state ${stateOfBody(after) ?? '(sin state)'}`),
    check(before.ok && listedAfter.ok, 'la lista se lee antes y después (200)', `lista antes ${before.ok ? '200' : 'no legible'}, después ${listedAfter.ok ? '200' : 'no legible'}`),
    check(sameStates(before.states, listedAfter.states), 'ninguna no conformidad cambia', `cambios: ${diffStates(before.states, listedAfter.states)}`),
  ]);
};

// --- Esquema 3: un paso en alumno01 no cambia la no conformidad de alumno02 -------------------------------------------------

const otherTenantUntouched: ApiRowHandler = async (row: ManifestRow) => {
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `GET /api/nc/NC-001 con x-tenant alumno02 y el accessToken de alumno02 devuelve state ${expectedState}`;

  // Preparación: los dos tenants recién reiniciados y los tokens de sus administradores
  await resetTenants([TENANT_A, TENANT_B]);
  const owner = await actorOf(TENANT_B, ADMIN_ALUMNO02);
  if (owner.token === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02', owner.last);
  const actor = await actorOf(TENANT_A, ADMIN_ALUMNO01);
  if (actor.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión en alumno01', actor.last);
  const otherBefore = await snapshot(TENANT_B, owner.token);

  // La acción de la fila: alumno01 pasa NC-001 a in_analysis en SU tenant. Si no responde 200 no hay nada que comparar.
  const acted = await transitionNc(TENANT_A, actor.token, 'NC-001', { to: 'in_analysis' });
  if (acted.status !== 200) {
    return verdict(
      [check(false, 'la acción de la fila (alumno01 pasa NC-001 a in_analysis) responde 200', `la acción responde ${acted.status}`)],
      'Fallo de la propia acción de la fila (POST de alumno01 en su tenant), no de la preparación: sin respuesta 200 no hay efecto que comparar.',
    );
  }

  const read = await detailNc(TENANT_B, owner.token, 'NC-001');
  const otherAfter = await snapshot(TENANT_B, owner.token);
  return verdict([
    check(stateOfBody(read) === expectedState, `NC-001 de alumno02 da state ${expectedState}`, `NC-001 de alumno02 da state ${stateOfBody(read) ?? '(sin state)'}`),
    check(otherBefore.ok && otherAfter.ok, 'la lista de alumno02 se lee antes y después (200)', `lista antes ${otherBefore.ok ? '200' : 'no legible'}, después ${otherAfter.ok ? '200' : 'no legible'}`),
    check(sameStates(otherBefore.states, otherAfter.states), 'la lista de alumno02 no cambia', `cambios en alumno02: ${diffStates(otherBefore.states, otherAfter.states)}`),
  ]);
};

defineApiRows({
  story: 'US-NC-TABLERO-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, admittedStep],
    [2, rejectedStep],
    [3, otherTenantUntouched],
  ]),
});
