import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, TENANT_B, act, codeCell, expectChecks, loginAs, resetTenants, snapshotOf, unchangedCheck, verdict, auditCount, auditDelta, type Expect } from './common';

// US-REQ-EDICION-001 — Dar de alta un requisito en borrador (API). Preparación de cada fila: reinicio de alumno01 (y de alumno02 en el
// Esquema 3) y, según la fila, inicio de sesión de la cuenta de la celda. Todas las peticiones llevan el tenant de su token.

/** Padre de la celda: «(ninguno)» es `null`; cualquier otro texto debe ser un código. */
const parentCell = (text: string): string | null => (text === '(ninguno)' ? null : codeCell(text));

/** Expectativa con la comprobación «el padre es de ese programa» (el porqué que da la celda). */
type WithParent = Expect & { readonly parentIn?: string };

// --- Esquema 1: el alta válida nace en borrador al final de sus hermanos -------------------------------------------------------

const RESPUESTA_E1: ReadonlyMap<string, WithParent> = new Map<string, WithParent>([
  ['201 con code REQ-041, state draft, parentCode null y position 3', { status: 201, fields: { code: 'REQ-041', state: 'draft', parentCode: null, position: 3 } }],
  ['201 con code REQ-041, state draft, parentCode REQ-001 y position 3', { status: 201, fields: { code: 'REQ-041', state: 'draft', parentCode: 'REQ-001', position: 3 } }],
  ['201 con code REQ-041, state draft, parentCode null y position 0', { status: 201, fields: { code: 'REQ-041', state: 'draft', parentCode: null, position: 0 } }],
]);

const createsAtEnd: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const session = await loginAs(account);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01 y recibe accessToken`, session.last);
  const expect = strict('respuesta', RESPUESTA_E1, cell(row, 'respuesta'));
  const auditBefore = await auditCount('REQ-041', 'requirement.created');
  const result = await act('POST', '/requirements', session.token, { programCode: codeCell(cell(row, 'programa')), parentCode: parentCell(cell(row, 'padre')), title: 'Requisito de prueba' });
  const auditAfter = await auditCount('REQ-041', 'requirement.created');
  // Un alta correcta deja un evento requirement.created con el código nuevo
  return verdict([...expectChecks(expect, result), auditDelta(auditBefore, auditAfter, result.status === 201 ? 1 : 0, 'requirement.created de REQ-041')]);
};

// --- Esquema 2: el alta no se crea si el programa no existe o el padre es de otro programa ---------------------------------

const RESPUESTA_E2: ReadonlyMap<string, WithParent> = new Map<string, WithParent>([
  ['404 program_not_found', { status: 404, code: 'program_not_found' }],
  [
    '422 validation_failed con errors.parentCode igual a badParent, porque REQ-015 es de PRG-002',
    { status: 422, code: 'validation_failed', errors: { parentCode: 'badParent' }, parentIn: 'PRG-002' },
  ],
  ['422 validation_failed con errors.parentCode igual a badParent', { status: 422, code: 'validation_failed', errors: { parentCode: 'badParent' } }],
]);

const createsNothing: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  const expected = `respuesta ${cell(row, 'respuesta')}; no se crea ningún requisito`;
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', session.last);
  const before = await snapshotOf(session.token, 'PRG-001');
  const expect = strict('respuesta', RESPUESTA_E2, cell(row, 'respuesta'));
  const auditBefore = await auditCount('REQ-041', 'requirement.created');
  const result = await act('POST', '/requirements', session.token, { programCode: codeCell(cell(row, 'programa')), parentCode: parentCell(cell(row, 'padre')), title: 'Requisito de prueba' });
  const checks: Check[] = expectChecks(expect, result);
  // «Porque» de la celda: el padre que se cita pertenece al programa que se dice
  if (expect.parentIn !== undefined) {
    const parent = codeCell(cell(row, 'padre'));
    const read = await act('GET', `/requirements/${parent}`, session.token);
    const program = field(read.body, 'programCode');
    checks.push(check(program === expect.parentIn, `${parent} es de ${expect.parentIn}`, `${parent} es de ${program === undefined ? '(sin leer)' : String(program)}`));
  }
  // El alta fallida no deja requisitos nuevos: el programa de referencia no cambia y el código siguiente sigue libre
  const after = await snapshotOf(session.token, 'PRG-001');
  checks.push(unchangedCheck(before, after, 'la lista de PRG-001'));
  // Un alta rechazada no deja evento de auditoría
  const auditAfter = await auditCount('REQ-041', 'requirement.created');
  checks.push(auditDelta(auditBefore, auditAfter, 0, 'requirement.created de REQ-041'));
  const created = await act('GET', '/requirements/REQ-041', session.token);
  checks.push(check(created.status === 404, 'REQ-041 no existe', `REQ-041 responde ${created.status}`));
  return verdict(checks);
};

// --- Esquema 3: un programa solo existe en el tenant donde no se ha borrado -----------------------------------------------------

const RESPUESTA_E3: ReadonlyMap<string, WithParent> = new Map<string, WithParent>([
  ['404 program_not_found', { status: 404, code: 'program_not_found' }],
  ['201 con code REQ-041, programCode PRG-024 y position 0', { status: 201, fields: { code: 'REQ-041', programCode: 'PRG-024', position: 0 } }],
]);

const deletedOnlyInOneTenant: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const admin = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión y recibe accessToken', admin.last);
  // Preparación: PRG-024 se borra solo en alumno01 (su administrador lo hace por la API)
  const removed = await act('DELETE', '/programs/PRG-024', admin.token);
  if (removed.status < 200 || removed.status >= 300) return preparationFailed(expected, 'alumno01 borra PRG-024 con DELETE /api/programs/PRG-024', removed);
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const session = await loginAs(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  const expect = strict('respuesta', RESPUESTA_E3, cell(row, 'respuesta'));
  const result = await act('POST', '/requirements', session.token, { programCode: 'PRG-024', parentCode: null, title: 'Requisito de prueba' }, account.tenant);
  return verdict(expectChecks(expect, result));
};

defineApiRows({
  story: 'US-REQ-EDICION-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, createsAtEnd],
    [2, createsNothing],
    [3, deletedOnlyInOneTenant],
  ]),
});
