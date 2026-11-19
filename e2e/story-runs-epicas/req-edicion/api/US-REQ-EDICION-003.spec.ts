import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, codeCell, expectChecks, loginAs, resetTenants, snapshotOf, unchangedCheck, verdict, type Expect } from './common';
import { field } from '../../../story-runs/support/api';

// US-REQ-EDICION-003 — Editar un requisito y devolverlo a borrador al cambiar el texto (API). Preparación de cada fila: reinicio de
// alumno01 y token de gestor@sigpro.test; el estado inicial de la historia se lee antes de actuar (si no se da, la fila no se juzga).

const letters = (count: number): string => 'a'.repeat(count);

/** Cuerpo de la celda del Esquema 1 (`cuerpo`): `{}` para el cuerpo vacío. */
const BODY_OF: ReadonlyMap<string, Record<string, unknown>> = new Map<string, Record<string, unknown>>([
  ['(cuerpo vacío)', {}],
  ['title ab', { title: 'ab' }],
  ['title (121 letras a)', { title: letters(121) }],
  ['description (4001 letras a)', { description: letters(4001) }],
  ['priority urgent', { priority: 'urgent' }],
  ['tags nope', { tags: ['nope'] }],
  ['priority low', { priority: 'low' }],
  ['tags security, regulatory', { tags: ['security', 'regulatory'] }],
]);

/** Cuerpo de la celda del Esquema 2 (`cuerpo`): el campo que cambia (o el mismo valor que ya tiene, en un caso). */
const CHANGE_OF: ReadonlyMap<string, Record<string, unknown>> = new Map<string, Record<string, unknown>>([
  ['title Disponibilidad revisada del subsistema 001', { title: 'Disponibilidad revisada del subsistema 001' }],
  ['description Texto revisado del requisito', { description: 'Texto revisado del requisito' }],
  ['title Cifrado del subsistema 003', { title: 'Cifrado del subsistema 003' }],
  ['priority low', { priority: 'low' }],
  ['title Trazabilidad revisada del subsistema 004', { title: 'Trazabilidad revisada del subsistema 004' }],
]);

/** Estados del requisito (texto de la celda = valor de la API). */
const STATE_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['approved', 'approved'],
  ['verified', 'verified'],
  ['validated', 'validated'],
  ['draft', 'draft'],
]);

/** Inicia sesión como gestor en alumno01 tras reiniciarlo. Devuelve el token, o la preparación fallida. */
const gestorToken = async (expected: string): Promise<string | Outcome> => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token ?? preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', session.last);
};

/** Estado de un requisito leído por la API. */
const stateOf = async (token: string, code: string): Promise<unknown> => field((await act('GET', `/requirements/${code}`, token)).body, 'state');

// --- Esquema 1: cada campo que se edita se valida con su motivo -----------------------------------------------------------------

const RESPUESTA_E1: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con errors igual a nothingToUpdate', { status: 422, code: 'validation_failed', errors: { '': 'nothingToUpdate' }, onlyErrors: true }],
  ['422 validation_failed con errors.title igual a titleShort', { status: 422, code: 'validation_failed', errors: { title: 'titleShort' } }],
  ['422 validation_failed con errors.title igual a titleLong', { status: 422, code: 'validation_failed', errors: { title: 'titleLong' } }],
  ['422 validation_failed con errors.description igual a descLong', { status: 422, code: 'validation_failed', errors: { description: 'descLong' } }],
  ['422 validation_failed con un motivo para priority', { status: 422, code: 'validation_failed', motiveFor: 'priority' }],
  ['422 validation_failed con un motivo para tags', { status: 422, code: 'validation_failed', motiveFor: 'tags' }],
  ['200 con priority low y state approved', { status: 200, fields: { priority: 'low', state: 'approved' } }],
  ['200 con tags security y regulatory y state approved', { status: 200, fields: { tags: ['security', 'regulatory'], state: 'approved' } }],
]);

const editFieldsValidated: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  // Estado inicial que da por hecho la fila: REQ-001 está en approved
  const initial = await stateOf(token, 'REQ-001');
  if (initial !== 'approved') return preparationFailed(expected, `REQ-001 tiene state approved (la lectura da ${String(initial)})`, await act('GET', '/requirements/REQ-001', token));
  const body = strict('cuerpo', BODY_OF, cell(row, 'cuerpo'));
  const result = await act('PATCH', '/requirements/REQ-001', token, body);
  return verdict(expectChecks(strict('respuesta', RESPUESTA_E1, cell(row, 'respuesta')), result));
};

// --- Esquema 2: cambiar el texto devuelve el requisito a borrador y cambiar otros campos no -------------------------------

const changeReverts: ApiRowHandler = async (row) => {
  const code = codeCell(cell(row, 'codigo'));
  const expected = `${code} pasa de ${cell(row, 'estado_inicial')} a ${cell(row, 'estado_final')} (respuesta 200)`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const initial = strict('estado_inicial', STATE_OF, cell(row, 'estado_inicial'));
  const final = strict('estado_final', STATE_OF, cell(row, 'estado_final'));
  const before = await stateOf(token, code);
  if (before !== initial) return preparationFailed(expected, `${code} tiene state ${initial} (la lectura da ${String(before)})`, await act('GET', `/requirements/${code}`, token));
  const result = await act('PATCH', `/requirements/${code}`, token, strict('cuerpo', CHANGE_OF, cell(row, 'cuerpo')));
  const checks: Check[] = expectChecks({ status: 200, fields: { state: final } }, result);
  // La respuesta debe coincidir con lo que la API guarda: se vuelve a leer el requisito
  const stored = await stateOf(token, code);
  checks.push(check(stored === final, `${code} guarda state ${final}`, `${code} guarda state ${String(stored)}`));
  return verdict(checks);
};

// --- Esquema 3: un código que no existe en el tenant responde 404 y no cambia nada --------------------------------------------

const RESPUESTA_E3: Expect = { status: 404, code: 'requirement_not_found' };

const unknownCode: ApiRowHandler = async (row) => {
  const code = cell(row, 'codigo');
  const expected = `respuesta 404 requirement_not_found; PRG-001 no cambia`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const before = await snapshotOf(token, 'PRG-001');
  const result = await act('PATCH', `/requirements/${codeCell(code)}`, token, { title: 'Título nuevo de prueba' });
  const after = await snapshotOf(token, 'PRG-001');
  return verdict([...expectChecks(RESPUESTA_E3, result), unchangedCheck(before, after, 'la lista de PRG-001')]);
};

defineApiRows({
  story: 'US-REQ-EDICION-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, editFieldsValidated],
    [2, changeReverts],
    [3, unknownCode],
  ]),
});
