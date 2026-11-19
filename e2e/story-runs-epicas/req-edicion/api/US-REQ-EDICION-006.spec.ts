import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, expectChecks, loginAs, resetTenants, snapshotOf, unchangedCheck, verdict, type Expect } from './common';

// US-REQ-EDICION-006 — Permisos de alta, edición, reordenación y borrado por rol (API). Preparación de cada fila: reinicio de alumno01 y
// token de la cuenta de la fila (o ninguno, o uno inventado, según la celda «cabecera»). Un permiso denegado debe dejar el programa igual.

/** Petición de la celda: método, ruta y cuerpo (si lo lleva). */
interface Request {
  readonly method: 'POST' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly body?: Record<string, unknown>;
}

const PETICION_OF: ReadonlyMap<string, Request> = new Map<string, Request>([
  ['POST /api/requirements con programCode PRG-001 y title Requisito de prueba', { method: 'POST', path: '/requirements', body: { programCode: 'PRG-001', title: 'Requisito de prueba' } }],
  ['POST /api/requirements sin ningún campo', { method: 'POST', path: '/requirements', body: {} }],
  ['PATCH /api/requirements/REQ-001 con title Disponibilidad revisada', { method: 'PATCH', path: '/requirements/REQ-001', body: { title: 'Disponibilidad revisada' } }],
  ['POST /api/requirements/REQ-001/move con targetCode REQ-011 y placement after', { method: 'POST', path: '/requirements/REQ-001/move', body: { targetCode: 'REQ-011', placement: 'after' } }],
  ['DELETE /api/requirements/REQ-004', { method: 'DELETE', path: '/requirements/REQ-004' }],
]);

/** Respuesta de la celda; `403` es un permiso denegado (la fila comprueba que el programa no cambia). */
const RESPUESTA_E1: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['403 forbidden, antes de la validación', { status: 403, code: 'forbidden' }],
  ['201', { status: 201 }],
  ['200', { status: 200 }],
  ['204', { status: 204 }],
]);

/** Cuenta de la fila y su petición: un permiso concreto por fila. */
const perm: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta'));
  const expected = `${cell(row, 'peticion')} responde ${cell(row, 'respuesta')}`;
  const session = await loginAs(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01 y recibe accessToken`, session.last);
  const request = strict('petición', PETICION_OF, cell(row, 'peticion'));
  const expect = strict('respuesta', RESPUESTA_E1, cell(row, 'respuesta'));
  const before = expect.status === 403 ? await snapshotOf(session.token, 'PRG-001') : undefined;
  const result = await act(request.method, request.path, session.token, request.body);
  const checks: Check[] = expectChecks(expect, result);
  // Un permiso denegado no cambia nada: el programa de referencia queda igual
  if (expect.status === 403) checks.push(unchangedCheck(before, await snapshotOf(session.token, 'PRG-001'), 'la lista de PRG-001'));
  return verdict(checks);
};

/** Credencial de la fila: sin cabecera Authorization o con un token que la API no ha emitido. */
const CABECERA_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera Authorization)', undefined],
  ['(token inventado)', 'token-inventado-que-la-api-no-emitio'],
]);

const RESPUESTA_E2: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

/** Sin token válido la API no atiende la petición y el programa no cambia. Se lee el programa con el gestor. */
const withoutValidToken: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'peticion')} con ${cell(row, 'cabecera')} responde ${cell(row, 'respuesta')}`;
  const reader = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  if (reader.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 para leer PRG-001', reader.last);
  const request = strict('petición', PETICION_OF, cell(row, 'peticion'));
  const token = strict('cabecera', CABECERA_OF, cell(row, 'cabecera'));
  const before = await snapshotOf(reader.token, 'PRG-001');
  const result = await act(request.method, request.path, token, request.body);
  const after = await snapshotOf(reader.token, 'PRG-001');
  return verdict([...expectChecks(strict('respuesta', RESPUESTA_E2, cell(row, 'respuesta')), result), unchangedCheck(before, after, 'la lista de PRG-001')]);
};

defineApiRows({
  story: 'US-REQ-EDICION-006',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, perm],
    [2, withoutValidToken],
  ]),
});
