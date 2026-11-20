import { call, field, usersByEmail, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, failedLogins, patchAccountById, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, describeResponse, noTokensCheck, preparationFailed, responseCheck, strict, type Check, type ExpectedResponse } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler, type Outcome } from '../../support/framework';

// US-MFA-002 — Impedir el canje si la cuenta quedó bloqueada o desactivada. Preparación de cada fila: reinicio del tenant alumno01,
// mfaToken de admin@sigpro.test (POST /api/auth/login) y, ANTES del canje, el cambio de estado: PATCH /api/admin/users/u1 hecho por
// alumno01@sigpro.lab para desactivar o reactivar, y cinco inicios de sesión con contraseña incorrecta para bloquear. Cada paso
// previo se comprueba: si el PATCH no responde 200 o el listado no muestra el `active` pedido, o si la quinta contraseña no bloquea,
// la fila NO prueba lo que la historia da por hecho y se devuelve como preparación no cumplida.

const ADMIN_ID = 'u1';
const CODE = '123456';
const WRONG_CODE = '000000';
const NOT_PREPARED = 'No se pudo reproducir el estado inicial que da por hecha la historia; la app no hace lo que la preparación describe.';

const CODES: ReadonlyMap<string, string> = new Map<string, string>([
  [CODE, CODE],
  [WRONG_CODE, WRONG_CODE],
]);

/** Respuestas que la columna «respuesta» admite en el Esquema 1. */
const RESPONSES: ReadonlyMap<string, ExpectedResponse> = new Map<string, ExpectedResponse>([
  ['423 account_locked', { status: 423, code: 'account_locked' }],
  ['403 account_disabled', { status: 403, code: 'account_disabled' }],
  ['401 invalid_mfa', { status: 401, code: 'invalid_mfa' }],
]);

/** Un paso de preparación: devuelve el motivo si no se cumplió, o `undefined` si sí. */
type Step = () => Promise<string | undefined>;

const notPrepared = (expected: string, reason: string): Outcome => outcome(false, expected, `la preparación no se cumplió: ${reason}`, { note: NOT_PREPARED });

/** Desactiva (`active: false`) o reactiva la cuenta por el PATCH y LEE el listado: el `active` de la cuenta debe ser el pedido. */
const setActive = (active: boolean): Step => async () => {
  const result = await patchAccountById(TENANT_A, ADMIN_ID, active);
  if (result.status !== 200) return `el PATCH respondió ${describeResponse(result)}`;
  const after = (await usersByEmail(TENANT_A)).get(DEMO.admin.email)?.active;
  return after === active ? undefined : `tras el PATCH, el listado muestra active ${String(after)} (se pidió ${String(active)})`;
};

/** Cinco inicios de sesión con contraseña incorrecta; el quinto debe bloquear la cuenta (423). Devuelve el motivo si no fue así. */
const lockByWrongPasswords: Step = async () => {
  const attempts = await failedLogins(TENANT_A, DEMO.admin.email, 5);
  const fifth = attempts[4];
  if (fifth === undefined) return 'no se enviaron cinco inicios de sesión';
  return fifth.status === 423 ? undefined : `el quinto inicio de sesión con contraseña incorrecta respondió ${describeResponse(fifth)}`;
};

const STATES: ReadonlyMap<string, readonly { readonly name: string; readonly step: Step }[]> = new Map<string, readonly { readonly name: string; readonly step: Step }[]>([
  ['bloqueada tras cinco contraseñas incorrectas', [{ name: 'cinco contraseñas incorrectas bloquean la cuenta (423 en la quinta)', step: lockByWrongPasswords }]],
  ['desactivada por el administrador del tenant', [{ name: 'alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH 200 y active false en el listado)', step: setActive(false) }]],
  [
    'desactivada y después bloqueada tras cinco contraseñas incorrectas',
    [
      { name: 'alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH 200 y active false en el listado)', step: setActive(false) },
      { name: 'cinco contraseñas incorrectas bloquean la cuenta (423 en la quinta)', step: lockByWrongPasswords },
    ],
  ],
]);

/** Reactivación del Esquema 2: desactivar y volver a activar, cada paso comprobado igual que los del Esquema 1. */
const REACTIVATION: readonly { readonly name: string; readonly step: Step }[] = [
  { name: 'alumno01@sigpro.lab desactiva a admin@sigpro.test (PATCH 200 y active false en el listado)', step: setActive(false) },
  { name: 'alumno01@sigpro.lab reactiva a admin@sigpro.test (PATCH 200 y active true en el listado)', step: setActive(true) },
];

const redeem = (mfaToken: string, code: string): Promise<ApiResult> => call('POST', '/auth/mfa', { tenant: TENANT_A, body: { mfaToken, code } });

/** Reinicia el tenant y obtiene el mfaToken de admin@sigpro.test; devuelve el motivo si el login no dio un token temporal. */
const freshToken = async (): Promise<string | ApiResult> => {
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.admin);
  const token = field(started.result.body, 'mfaToken');
  return typeof token === 'string' && started.session === undefined ? token : started.result;
};

const stateChange: ApiRowHandler = async (row) => {
  const expectedResponse = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const steps = strict('estado', STATES, cell(row, 'estado'));
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const expected = `${cell(row, 'respuesta')}; sin tokens de sesión`;
  const token = await freshToken();
  if (typeof token !== 'string') return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', token);
  for (const { name, step } of steps) {
    const reason = await step();
    if (reason) return notPrepared(expected, `${name}: ${reason}`);
  }
  const result = await redeem(token, code);
  return conclude([responseCheck(result, expectedResponse), noTokensCheck(result)]);
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
  const expectation = strict('respuesta', SUCCESS, expected);
  const code = strict('codigo', CODES, cell(row, 'codigo'));
  const token = await freshToken();
  if (typeof token !== 'string') return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', token);
  for (const { name, step } of REACTIVATION) {
    const reason = await step();
    if (reason) return notPrepared(expected, `${name}: ${reason}`);
  }
  const result = await redeem(token, code);
  return conclude(expectation(result));
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
