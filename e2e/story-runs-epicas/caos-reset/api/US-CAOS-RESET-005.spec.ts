import { type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { AUDITOR, CONSULTOR, GESTOR, adminAccess, chaosIs, expectCheck, prepareTenant, rowOutcome, sessionOfAccount, studentAdmin, withRestore, withToken, type Expect } from './common';

// US-CAOS-RESET-005 — Solo el administrador del tenant reinicia o gestiona el modo caos (API). Cada fila reinicia alumno01 antes de
// actuar y, al terminar, `withRestore` lo vuelve a reiniciar y le apaga el caos.

/** Peticiones de permiso: método, ruta y cuerpo (si lo lleva). */
interface Request {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly body?: unknown;
}
const REQUESTS: ReadonlyMap<string, Request> = new Map<string, Request>([
  ['POST /api/admin/reset', { method: 'POST', path: '/admin/reset' }],
  ['GET /api/admin/chaos', { method: 'GET', path: '/admin/chaos' }],
  ['PATCH /api/admin/chaos con el cuerpo { "errorRate": 0.5 }', { method: 'PATCH', path: '/admin/chaos', body: { errorRate: 0.5 } }],
  ['PATCH /api/admin/chaos con el cuerpo { "latencyMs": -1 }', { method: 'PATCH', path: '/admin/chaos', body: { latencyMs: -1 } }],
]);

/** Cuentas que no son administradores del tenant (Esquema 1). */
const NON_ADMIN_ACCOUNTS: ReadonlyMap<string, { readonly email: string; readonly password: string }> = new Map([
  ['gestor@sigpro.test', GESTOR],
  ['consultor@sigpro.test', CONSULTOR],
  ['auditor@sigpro.test', AUDITOR],
]);

/** Credencial de la petición del Esquema 2: sin cabecera, un texto que no es token o el refreshToken de la cuenta de alumno01. */
type Credential = { readonly kind: 'ninguna' } | { readonly kind: 'texto'; readonly token: string } | { readonly kind: 'refresh' };
const CREDENTIALS: ReadonlyMap<string, Credential> = new Map<string, Credential>([
  ['(sin cabecera Authorization)', { kind: 'ninguna' }],
  ['un texto que no es un token', { kind: 'texto', token: 'texto-que-no-es-un-token' }],
  ['el refreshToken de alumno01@sigpro.lab', { kind: 'refresh' }],
]);

/** Respuestas de rechazo del Esquema 2. */
const REJECTIONS: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

/** Respuesta de rechazo por permiso del Esquema 1. */
const FORBIDDEN: Expect = { status: 403, code: 'forbidden' };

// --- Esquema 1: un rol que no es admin recibe 403 y el modo caos no cambia ------------------------------------------------------

const rejectsNonAdmin: ApiRowHandler = async (row) => {
  const account = strict('cuenta', NON_ADMIN_ACCOUNTS, cell(row, 'cuenta'));
  const request = strict('peticion', REQUESTS, cell(row, 'peticion'));
  const expected = `la respuesta es 403 forbidden (${cell(row, 'cuenta')} con ${cell(row, 'peticion')}) y el modo caos no cambia`;
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    const session = await sessionOfAccount(TENANT_A, account);
    if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.result);
    const rejected = await withToken(request.method, request.path, TENANT_A, session.token, request.body);
    const admin = await adminAccess(TENANT_A);
    const chaos = await withToken('GET', '/admin/chaos', TENANT_A, admin);
    return rowOutcome([
      expectCheck(rejected, 'la respuesta es 403 forbidden', FORBIDDEN),
      expectCheck(chaos, 'GET /api/admin/chaos con el token de alumno01@sigpro.lab responde 200', { status: 200 }),
      chaosIs(chaos.body, { latencyMs: 0, errorRate: 0, flakyLabels: false }, 'GET /api/admin/chaos con el token de alumno01@sigpro.lab devuelve'),
    ]);
  });
};

// --- Esquema 2: sin un token válido la petición no se ejecuta ---------------------------------------------------------------------

const rejectsWithoutValidToken: ApiRowHandler = async (row) => {
  const request = strict('peticion', REQUESTS, cell(row, 'peticion'));
  const credential = strict('credencial', CREDENTIALS, cell(row, 'credencial'));
  const expectedText = cell(row, 'respuesta');
  const expect = strict('respuesta', REJECTIONS, expectedText);
  return withRestore([TENANT_A], async () => {
    await prepareTenant(TENANT_A);
    let token: string | undefined;
    if (credential.kind === 'texto') token = credential.token;
    if (credential.kind === 'refresh') {
      // El refreshToken de la cuenta de administración: vale para renovar, no para autorizar
      const session = await sessionOfAccount(TENANT_A, studentAdmin(TENANT_A), true);
      if (session.refreshToken === undefined) return preparationFailed(expectedText, 'alumno01@sigpro.lab inicia sesión y obtiene su refreshToken', session.result);
      token = session.refreshToken;
    }
    const result: ApiResult = await withToken(request.method, request.path, TENANT_A, token, request.body);
    // Tras el rechazo, el caos sigue en reposo (un PATCH que hubiera pasado el filtro lo habría cambiado)
    const admin = await adminAccess(TENANT_A);
    const chaos = await withToken('GET', '/admin/chaos', TENANT_A, admin);
    return rowOutcome([
      expectCheck(result, `la respuesta es ${expectedText}`, expect),
      chaosIs(chaos.body, { latencyMs: 0, errorRate: 0, flakyLabels: false }, 'GET /api/admin/chaos con el token de alumno01@sigpro.lab devuelve'),
    ]);
  });
};

defineApiRows({
  story: 'US-CAOS-RESET-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, rejectsNonAdmin],
    [2, rejectsWithoutValidToken],
  ]),
});
