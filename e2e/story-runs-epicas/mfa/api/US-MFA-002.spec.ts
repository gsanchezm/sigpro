import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, failedLogins, patchAccountById, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, noTokensCheck, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../support/framework';

// US-MFA-002 — Impedir el canje si la cuenta quedó bloqueada o desactivada. Preparación de cada fila: reinicio del tenant alumno01,
// mfaToken de admin@sigpro.test (POST /api/auth/login) y, ANTES del canje, el cambio de estado: PATCH /api/admin/users/u1 hecho por
// alumno01@sigpro.lab para desactivar o reactivar, y cinco inicios de sesión con contraseña incorrecta para bloquear. Cada paso
// previo se comprueba: si el estado que la historia da por hecho no se produce, la fila discrepa con ese motivo.

const ADMIN_ID = 'u1';
const CODE = '123456';
const WRONG_CODE = '000000';

type Step = (token: string) => Promise<ApiResult | undefined>;

/** Desactiva la cuenta (`active: false`) o la reactiva; devuelve la respuesta solo si no fue 200. */
const setActive = (active: boolean): Step => async () => {
  const result = await patchAccountById(TENANT_A, ADMIN_ID, active);
  return result.status === 200 ? undefined : result;
};

/** Cinco inicios de sesión con contraseña incorrecta; el quinto debe bloquear la cuenta (423). Devuelve la respuesta solo si no fue así. */
const lockByWrongPasswords: Step = async () => {
  const attempts = await failedLogins(TENANT_A, DEMO.admin.email, 5);
  const fifth = attempts[4];
  return fifth !== undefined && fifth.status === 423 ? undefined : (fifth ?? attempts[attempts.length - 1]);
};

const STATES: ReadonlyMap<string, readonly { readonly name: string; readonly step: Step }[]> = new Map([
  ['bloqueada tras cinco contraseñas incorrectas', [{ name: 'cinco contraseñas incorrectas bloquean la cuenta (423 en la quinta)', step: lockByWrongPasswords }]],
  ['desactivada por el administrador del tenant', [{ name: 'alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH, 200)', step: setActive(false) }]],
  [
    'desactivada y después bloqueada tras cinco contraseñas incorrectas',
    [
      { name: 'alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH, 200)', step: setActive(false) },
      { name: 'cinco contraseñas incorrectas bloquean la cuenta (423 en la quinta)', step: lockByWrongPasswords },
    ],
  ],
]);

const redeem = (mfaToken: string, code: string): Promise<ApiResult> => call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code } });

/** Reinicia el tenant y obtiene el mfaToken de admin@sigpro.test; devuelve el motivo si el login no dio un token temporal. */
const freshToken = async (): Promise<string | ApiResult> => {
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.admin);
  const token = field(started.result.body, 'mfaToken');
  return typeof token === 'string' && started.session === undefined ? token : started.result;
};

const stateChange: ApiRowHandler = async (row) => {
  const expected = `${cell(row, 'respuesta')}; sin tokens de sesión`;
  const token = await freshToken();
  if (typeof token !== 'string') return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', token);
  const steps = strict('estado', STATES, cell(row, 'estado'));
  for (const { name, step } of steps) {
    const failed = await step(token);
    if (failed) return preparationFailed(expected, name, failed);
  }
  const result = await redeem(token, strict('codigo', new Map([[CODE, CODE], [WRONG_CODE, WRONG_CODE]]), cell(row, 'codigo')));
  return conclude([responseCheck(result, parseResponse(cell(row, 'respuesta'))), noTokensCheck(result)]);
};

const SUCCESS: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  [
    '200 con accessToken, refreshToken y el usuario admin del tenant alumno01',
    (result) => {
      const user = typeof field(result.body, 'user') === 'object' && field(result.body, 'user') !== null ? (field(result.body, 'user') as Record<string, unknown>) : {};
      return [
        responseCheck(result, { status: 200 }),
        check(typeof field(result.body, 'accessToken') === 'string' && typeof field(result.body, 'refreshToken') === 'string', 'trae accessToken y refreshToken', `${typeof field(result.body, 'accessToken') === 'string' ? 'trae' : 'no trae'} accessToken y ${typeof field(result.body, 'refreshToken') === 'string' ? 'trae' : 'no trae'} refreshToken`),
        check(user.role === 'admin' && user.tenant === TENANT_A, 'usuario con rol admin y tenant alumno01', `usuario con rol ${String(user.role)} y tenant ${String(user.tenant)}`),
      ];
    },
  ],
  ['401 invalid_mfa sin tokens de sesión', (result) => [responseCheck(result, { status: 401, code: 'invalid_mfa' }), noTokensCheck(result)]],
]);

const reactivated: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  const token = await freshToken();
  if (typeof token !== 'string') return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', token);
  for (const [name, step] of [['alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH, 200)', setActive(false)], ['alumno01@sigpro.lab reactiva a admin@sigpro.test (PATCH, 200)', setActive(true)]] as const) {
    const failed = await step(token);
    if (failed) return preparationFailed(expected, name, failed);
  }
  const result = await redeem(token, cell(row, 'codigo'));
  return conclude(strict('respuesta', SUCCESS, expected)(result));
};

defineApiRows({
  story: 'US-MFA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, stateChange],
    [2, reactivated],
  ]),
});
