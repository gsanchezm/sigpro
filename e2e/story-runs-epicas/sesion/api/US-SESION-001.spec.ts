import { field, sessionOf, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';
import { ACCESS_TTL_S, hasTokens, issuedSince, loginAs, noMfaCheck, patchUser, refresh, shortText, userOf, userShapeOk } from './common';

// US-SESION-001 — Renovar la sesión con el refreshToken (API). Preparación de cada fila: reinicio de alumno01 y, en la propia fila,
// gestor@sigpro.test (u otra cuenta) inicia sesión y guarda su refreshToken. Las filas que cambian el rol lo hacen con
// PATCH /api/admin/users/u2 antes de renovar. Cada Entonces, y cada regla que la fila da por hecho, tiene su comprobación.

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Modo de inicio de sesión: `undefined` es el campo `remember` ausente en el cuerpo. */
const LOGIN_MODES: ReadonlyMap<string, boolean | undefined> = new Map<string, boolean | undefined>([
  ['con remember true', true],
  ['con remember false', false],
  ['sin el campo remember', undefined],
]);

const ROLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['program_manager', 'program_manager'],
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
]);

/** Cabecera `x-tenant` de la renovación: el valor, o `undefined` para «(sin cabecera)». */
const HEADER_TENANTS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['x-tenant alumno01', TENANT_A],
  ['x-tenant alumno02', TENANT_B],
  ['(sin cabecera)', undefined],
]);

// --- Esquema 1: un refreshToken vigente devuelve una sesión nueva -----------------------------------------------------------

const renewsSession: ApiRowHandler = async (row) => {
  const account = cell(row, 'cuenta');
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const mode = cell(row, 'inicio');
  const expected = `200 con el usuario ${account} con el rol ${role} y el tenant alumno01; accessToken, refreshToken y expiresIn ${ACCESS_TTL_S}`;
  await resetTenants([TENANT_A]);
  const started = await loginAs(strict('cuenta', ACCOUNTS, account), strict('inicio', LOGIN_MODES, mode));
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, `${account} inicia sesión ${mode}`, started);
  const sinceMs = Date.now();
  const renewed = await refresh(session.refreshToken, TENANT_A);
  const user = userOf(renewed.body);
  return conclude([
    responseCheck(renewed, { status: 200 }),
    check(user.email === account && user.role === role && user.tenant === TENANT_A, `trae el usuario ${account} con el rol ${role} y el tenant alumno01`, `trae el usuario ${shortText(user.email)} con el rol ${shortText(user.role)} y el tenant ${shortText(user.tenant)}`),
    check(hasTokens(renewed.body), 'trae un accessToken y un refreshToken', hasTokens(renewed.body) ? 'trae accessToken y refreshToken' : 'falta accessToken o refreshToken'),
    check(field(renewed.body, 'expiresIn') === ACCESS_TTL_S, `expiresIn ${ACCESS_TTL_S}`, `expiresIn ${shortText(field(renewed.body, 'expiresIn'))}`),
    // Reglas que la fila da por hechas: los seis campos de `user`, tokens emitidos en esta renovación y ninguna petición de segundo paso
    check(userShapeOk(user), 'user con id, name, email, role, mfa y tenant', userShapeOk(user) ? 'user con los seis campos' : 'user incompleto'),
    check(issuedSince(field(renewed.body, 'accessToken'), sinceMs), 'el accessToken se emitió en esta renovación', 'el accessToken no es de esta renovación'),
    noMfaCheck(renewed.body),
  ]);
};

// --- Esquema 2: la renovación devuelve el rol actual de la cuenta -----------------------------------------------------------

const returnsCurrentRole: ApiRowHandler = async (row) => {
  const role = strict('rol', ROLES, cell(row, 'rol'));
  const expected = `200 con el usuario gestor@sigpro.test y el rol ${role}`;
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  const changed: ApiResult = await patchUser('u2', { role });
  if (changed.status !== 200) return preparationFailed(expected, `alumno01@sigpro.lab cambia el rol de gestor@sigpro.test a ${role} con PATCH /api/admin/users/u2`, changed);
  const renewed = await refresh(session.refreshToken, TENANT_A);
  const user = userOf(renewed.body);
  return conclude([
    responseCheck(renewed, { status: 200 }),
    check(user.email === DEMO.gestor.email && user.role === role, `trae el usuario gestor@sigpro.test con el rol ${role}`, `trae el usuario ${shortText(user.email)} con el rol ${shortText(user.role)}`),
  ]);
};

// --- Esquema 3: el refreshToken sigue renovando después de haber renovado ----------------------------------------------------

const RENEWALS: ReadonlyMap<string, number> = new Map<string, number>([
  ['una vez', 1],
  ['dos veces', 2],
]);

const keepsRenewing: ApiRowHandler = async (row) => {
  const earlier = strict('renovaciones', RENEWALS, cell(row, 'renovaciones'));
  const expected = '200 con un accessToken y un refreshToken';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  // Las renovaciones previas (una o dos) son parte del estado que la fila da por hecho: si no responden 200, la preparación no se cumple
  for (let turn = 1; turn <= earlier; turn += 1) {
    const previous = await refresh(session.refreshToken, TENANT_A);
    if (previous.status !== 200) return preparationFailed(expected, `la renovación previa nº ${turn} con ese mismo refreshToken`, previous);
  }
  const renewed = await refresh(session.refreshToken, TENANT_A);
  return conclude([responseCheck(renewed, { status: 200 }), check(hasTokens(renewed.body), 'trae un accessToken y un refreshToken', hasTokens(renewed.body) ? 'trae accessToken y refreshToken' : 'falta accessToken o refreshToken')]);
};

// --- Esquema 4: el tenant de la renovación lo fija el refreshToken ----------------------------------------------------------

const tenantFromToken: ApiRowHandler = async (row) => {
  const header = cell(row, 'cabecera');
  const tenant = strict('cabecera', HEADER_TENANTS, header);
  const expected = '200 con el usuario gestor@sigpro.test del tenant alumno01';
  await resetTenants([TENANT_A]);
  const started = await loginAs(DEMO.gestor, true);
  const session = sessionOf(started);
  if (!session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión con remember true', started);
  const renewed = await refresh(session.refreshToken, tenant);
  const user = userOf(renewed.body);
  const observedTenant: Check = check(user.tenant === TENANT_A && user.email === DEMO.gestor.email, 'el usuario gestor@sigpro.test del tenant alumno01', `usuario ${shortText(user.email)} del tenant ${shortText(user.tenant)}`);
  return conclude([responseCheck(renewed, { status: 200 }), observedTenant]);
};

defineApiRows({
  story: 'US-SESION-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, renewsSession],
    [2, returnsCurrentRole],
    [3, keepsRenewing],
    [4, tenantFromToken],
  ]),
});
