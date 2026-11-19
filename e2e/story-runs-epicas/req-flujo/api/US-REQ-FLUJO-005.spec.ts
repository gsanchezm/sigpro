import { field } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  ACCOUNT_CELLS,
  ALUMNO01,
  EXPECTATION_CELLS,
  REQUIREMENT_CELLS,
  STATE_CELLS,
  TENANT_A,
  TENANT_B,
  TENANT_CELLS,
  adminToken,
  compareRequirements,
  describeState,
  latestEventFor,
  loginAs,
  premiseFailed,
  readAudit,
  readRequirement,
  resetTenants,
  responseChecks,
  sameAudit,
  stateOf,
  transition,
  unchangedCheck,
  verdictOf,
  type SessionOf,
} from './common';

// US-REQ-FLUJO-005 — Auditoría y efectos de un paso. Cada paso aceptado escribe un evento `requirement.state_changed` con el autor; un paso
// rechazado no escribe nada; un paso cambia solo el estado; el paso solo afecta al tenant del token. Preparación: reinicio de alumno01 (y de
// alumno02 en el Esquema 4), inicio de sesión de las cuentas de la fila; la auditoría se lee con el token de alumno01 (rol admin).

/** Autor del evento: el nombre de la cuenta del seed (`Alumno 01` es el de alumno01@sigpro.lab). */
const AUTHOR_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Alumno 01', 'Alumno 01'],
]);

/** Cuerpo literal de cada celda «cuerpo» (un JSON de la historia). */
const BODY_CELLS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['{"to": "approved"}', { to: 'approved' }],
  ['{"to": "done"}', { to: 'done' }],
]);

const recordOf = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {});

/** El evento guarda la hora del paso: un instante legible (`at`). */
const hasTime = (event: unknown): boolean => {
  const at = field(event, 'at');
  return typeof at === 'string' && !Number.isNaN(Date.parse(at));
};

/** Esquema 1: un paso aceptado deja en la auditoría el evento con el cambio y su autor. */
const auditedStep: ApiRowHandler = async (row) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const fromState = strict('desde', STATE_CELLS, cell(row, 'desde'));
  const toState = strict('hasta', STATE_CELLS, cell(row, 'hasta'));
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const author = strict('autor', AUTHOR_CELLS, cell(row, 'autor'));
  const expected = `la respuesta es 200 y el evento más reciente de la auditoría sobre ${requirementCode} es requirement.state_changed de ${fromState} a ${toState}, con autor ${author}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(account, TENANT_A);
  const owner = await loginAs(ALUMNO01, TENANT_A);
  if (actor.token === undefined || owner.token === undefined) return premiseFailed(expected, `inicio de sesión de ${account.email} y de alumno01 en alumno01`, actor.token === undefined ? actor.result : owner.result);
  const before = await readRequirement(TENANT_A, admin, requirementCode);
  if (stateOf(before) !== fromState) return premiseFailed(expected, `lectura de ${requirementCode} tras el reinicio: estado ${describeState(stateOf(before))} en lugar de ${fromState}`, before);
  const baseline = await readAudit(TENANT_A, admin);

  const result = await transition(requirementCode, TENANT_A, actor.token, { to: toState });
  const view = await readAudit(TENANT_A, admin);
  const event = latestEventFor(view, requirementCode);
  const diff = recordOf(field(event, 'diff'));
  const isNew = event !== undefined && !(baseline?.ids ?? []).includes(String(field(event, 'id')));

  return verdictOf([
    check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
    check(
      field(event, 'action') === 'requirement.state_changed',
      'acción requirement.state_changed',
      `acción ${typeof field(event, 'action') === 'string' ? String(field(event, 'action')) : '(sin evento sobre el requisito)'}`,
    ),
    check(
      field(event, 'entity') === 'requirement' && field(event, 'entityId') === requirementCode,
      `entidad requirement con identificador ${requirementCode}`,
      `entidad ${String(field(event, 'entity'))} con identificador ${String(field(event, 'entityId'))}`,
    ),
    check(diff.from === fromState && diff.to === toState, `cambio de ${fromState} a ${toState}`, `cambio de ${String(diff.from)} a ${String(diff.to)}`),
    check(isNew, 'el evento es nuevo (no estaba antes del paso)', isNew ? 'el evento es nuevo' : 'el evento ya estaba antes del paso o no existe'),
    check(field(event, 'actorName') === author, `autor ${author}`, `autor ${String(field(event, 'actorName') ?? '(sin autor)')}`),
    check(hasTime(event), 'la hora del paso queda en el evento', hasTime(event) ? 'la hora del paso queda en el evento' : 'el evento no trae hora válida'),
  ]);
};

/** Esquema 2: un paso rechazado no añade ningún evento (ni cambia el total ni la lista de eventos). */
const rejectedStep: ApiRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const requestBody = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const expectation = strict('respuesta', EXPECTATION_CELLS, cell(row, 'respuesta'));
  const expected = `responde ${cell(row, 'respuesta')} y el total de eventos de la auditoría sigue igual`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(account, TENANT_A);
  const owner = await loginAs(ALUMNO01, TENANT_A);
  if (actor.token === undefined || owner.token === undefined) return premiseFailed(expected, `inicio de sesión de ${account.email} y de alumno01 en alumno01`, actor.token === undefined ? actor.result : owner.result);
  const baseline = await readAudit(TENANT_A, admin);

  const result = await transition(requirementCode, TENANT_A, actor.token, requestBody);
  const after = await readAudit(TENANT_A, admin);

  return verdictOf([...responseChecks(result, expectation, cell(row, 'respuesta')), sameAudit(baseline, after)]);
};

/** Esquema 3: un paso cambia solo el estado; el gestor lee el requisito antes y compara después. */
const onlyState: ApiRowHandler = async (row) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const fromState = strict('desde', STATE_CELLS, cell(row, 'desde'));
  const toState = strict('hasta', STATE_CELLS, cell(row, 'hasta'));
  const expected = `responde 200 y todos los campos de ${requirementCode} son iguales a la lectura anterior salvo state; el estado pasa de ${fromState} a ${toState}`;

  await resetTenants([TENANT_A]);
  const admin = await adminToken(TENANT_A);
  const actor = await loginAs(DEMO.gestor, TENANT_A);
  if (actor.token === undefined) return premiseFailed(expected, 'inicio de sesión de gestor@sigpro.test en alumno01', actor.result);
  const before = await readRequirement(TENANT_A, actor.token, requirementCode);
  if (stateOf(before) !== fromState) return premiseFailed(expected, `lectura de ${requirementCode} tras el reinicio: estado ${describeState(stateOf(before))} en lugar de ${fromState}`, before);

  const result = await transition(requirementCode, TENANT_A, actor.token, { to: toState });
  const after = await readRequirement(TENANT_A, admin, requirementCode);

  return verdictOf([
    check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
    unchangedCheck(compareRequirements(before.body, result.body, ['state']), 'todos los campos iguales a la lectura anterior salvo state'),
    check(stateOf(after) === toState, `el estado pasa de ${fromState} a ${toState}`, `el estado pasa de ${fromState} a ${describeState(stateOf(after))}`),
  ]);
};

/** Esquema 4: el paso solo afecta al tenant del token que lo envía; el otro tenant conserva el estado. */
const tenantScope: ApiRowHandler = async (row) => {
  const tenant = strict('tenant', TENANT_CELLS, cell(row, 'tenant'));
  const other = strict('otro', TENANT_CELLS, cell(row, 'otro'));
  const expected = `responde 200 y REQ-017 queda en approved en ${tenant}; en ${other} sigue en draft`;

  await resetTenants([TENANT_A, TENANT_B]);
  const gestorA: SessionOf = await loginAs(DEMO.gestor, TENANT_A);
  const gestorB: SessionOf = await loginAs(DEMO.gestor, TENANT_B);
  const sessions: ReadonlyMap<string, SessionOf> = new Map([
    [TENANT_A, gestorA],
    [TENANT_B, gestorB],
  ]);
  const sessionOfTenant = sessions.get(tenant);
  if (gestorA.token === undefined || gestorB.token === undefined || sessionOfTenant?.token === undefined) {
    return premiseFailed(expected, 'inicio de sesión de gestor@sigpro.test en alumno01 y en alumno02', gestorA.token === undefined ? gestorA.result : gestorB.result);
  }
  const adminA = await adminToken(TENANT_A);
  const adminB = await adminToken(TENANT_B);
  const beforeA = await readRequirement(TENANT_A, adminA, 'REQ-017');
  const beforeB = await readRequirement(TENANT_B, adminB, 'REQ-017');
  if (stateOf(beforeA) !== 'draft' || stateOf(beforeB) !== 'draft') {
    return premiseFailed(expected, `lectura de REQ-017 tras el reinicio: alumno01 en ${describeState(stateOf(beforeA))} y alumno02 en ${describeState(stateOf(beforeB))}`, beforeA);
  }

  const result = await transition('REQ-017', tenant, sessionOfTenant.token, { to: 'approved' });
  const afterOwn = await readRequirement(tenant, await adminToken(tenant), 'REQ-017');
  const afterOther = await readRequirement(other, await adminToken(other), 'REQ-017');

  return verdictOf([
    check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
    check(stateOf(afterOwn) === 'approved', `REQ-017 queda en approved en ${tenant}`, `REQ-017 queda en ${describeState(stateOf(afterOwn))} en ${tenant}`),
    check(stateOf(afterOther) === 'draft', `REQ-017 sigue en draft en ${other}`, `REQ-017 está en ${describeState(stateOf(afterOther))} en ${other}`),
  ]);
};

defineApiRows({
  story: 'US-REQ-FLUJO-005',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, auditedStep],
    [2, rejectedStep],
    [3, onlyState],
    [4, tenantScope],
  ]),
});
