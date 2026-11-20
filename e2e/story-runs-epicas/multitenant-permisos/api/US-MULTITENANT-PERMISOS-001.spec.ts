import { field, login, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, noTokensCheck, parseResponse, responseCheck, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ALUMNO_25, conclude, restoring } from './common';

// US-MULTITENANT-PERMISOS-001: las cuentas de demostración existen en cada tenant y la de alumnoNN solo en el suyo. Preparación de
// cada fila: se reinician los tenants que el Dado nombra (Esquema 1: alumno01, alumno02 y alumno25; Esquema 2: alumno01 y alumno02)
// con el token de SU administrador, y después se envía el POST /api/auth/login con la cabecera x-tenant de la fila. Las filas
// usan las cuentas del seed; no crean ni cambian ninguna cuenta.

/** Lo que una respuesta de login debe mostrar del usuario: correo, tenant y rol. */
type Expect = (result: ApiResult, email: string) => readonly Check[];

const userIs = (tenant: string, role: string): Expect => {
  return (result, email) => {
    const user = field(result.body, 'user');
    const found = typeof user === 'object' && user !== null ? (user as Record<string, unknown>) : {};
    const ok = result.status === 200 && found.email === email && found.tenant === tenant && found.role === role;
    return [
      check(
        ok,
        `respuesta 200 con el usuario ${email} del tenant ${tenant} y el rol ${role}`,
        `respuesta ${result.status} con el usuario ${String(found.email)} del tenant ${String(found.tenant)} y el rol ${String(found.role)}`,
      ),
    ];
  };
};

/** Segundo factor: 200 con `mfaRequired` verdadero y un `mfaToken`, sin tokens de sesión. */
const mfaStarted: Expect = (result) => {
  const mfaToken = field(result.body, 'mfaToken');
  return [
    check(
      result.status === 200 && field(result.body, 'mfaRequired') === true && typeof mfaToken === 'string' && field(result.body, 'accessToken') === undefined,
      'respuesta 200 con mfaRequired verdadero y un mfaToken, sin accessToken',
      `respuesta ${result.status} con mfaRequired ${String(field(result.body, 'mfaRequired'))}, ${typeof mfaToken === 'string' ? 'con' : 'sin'} mfaToken y ${field(result.body, 'accessToken') === undefined ? 'sin' : 'con'} accessToken`,
    ),
  ];
};

/** Una celda de respuesta del Esquema 1 o 2 a su comprobación. Lo que no se reconoce lanza (`parseResponse` o el error de abajo). */
const expectOf = (text: string): Expect => {
  const user = /^200 con el usuario del tenant (alumno\d{2}) y el rol (\w+)$/.exec(text);
  if (user?.[1] !== undefined && user[2] !== undefined) return userIs(user[1], user[2]);
  if (text === '200 con mfaRequired verdadero y un mfaToken, sin accessToken') return mfaStarted;
  const withoutTokens = /^(.+), sin tokens de sesión$/.exec(text);
  if (withoutTokens?.[1] !== undefined) {
    const response = parseResponse(withoutTokens[1]);
    return (result) => [responseCheck(result, response), noTokensCheck(result)];
  }
  const response = parseResponse(text);
  return (result) => [responseCheck(result, response)];
};

const resetAll = (): Promise<void> => resetTenants([TENANT_A, TENANT_B, ALUMNO_25]);

// --- Esquema 1: una cuenta de demostración entra en el tenant que indica la cabecera ----------------------------------------

const demoAccount: ApiRowHandler = async (row) => {
  await resetAll();
  const tenant = cell(row, 'tenant');
  const email = cell(row, 'correo');
  const expect = expectOf(cell(row, 'respuesta'));
  const result = await login({ tenant, email, password: cell(row, 'contraseña') });
  return conclude(expect(result, email), { evidence: { tenant, email } });
};

// --- Esquema 2: la cuenta de administración de un alumno solo entra en su tenant ---------------------------------------------

const ownAdminOnly: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const tenant = cell(row, 'tenant');
  const email = cell(row, 'correo');
  const expect = expectOf(cell(row, 'respuesta'));
  const result = await login({ tenant, email, password: 'Alumno1234!' });
  return conclude(expect(result, email), { evidence: { tenant, email } });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B, ALUMNO_25],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoring(demoAccount, [TENANT_A, TENANT_B, ALUMNO_25])],
    [2, restoring(ownAdminOnly)],
  ]),
});
