import { usersByEmail } from '../../../story-runs/support/api';
import { cell, conclude, responseCheck, strict } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler } from '../../support/framework';
import { EMPTY_MARKERS, TENANT_A, bodyValue, emptyAcceptedCheck, motiveCheck, postResend, requestAccount, resetTenants, unknownEmail } from './common';

// US-REGISTRO-006 — Responder 202 al reenvío de la verificación sin revelar si hay una solicitud. Preparación de cada fila:
// reinicio de alumno01 con su administrador. Las cuentas del seed («pendiente», «activa») se comprueban en el listado del tenant.

const EXPECTED_202 = '202 con el cuerpo vacío {}';
const PREPARATION_NOTE = 'No se pudo reproducir el estado inicial que da por hecho la historia; la app no hace lo que la preparación describe.';

/** Cuenta del seed en el listado de usuarios de alumno01; devuelve el motivo si su estado no es el que dice la historia. */
const accountState = async (email: string, key: 'pending' | 'active', value: boolean): Promise<string | undefined> => {
  const user = (await usersByEmail(TENANT_A)).get(email);
  if (user === undefined) return `${email} no está en el listado de alumno01`;
  return user[key] === value ? undefined : `${email} no tiene ${key} = ${String(value)}`;
};

// --- Esquema 1: con un correo no vacío la respuesta es 202 con cuerpo vacío, exista o no la solicitud ---------------------

type Situation = 'pendiente' | 'solicitada' | 'gestor' | 'sin-cuenta';

const SITUATIONS: ReadonlyMap<string, Situation> = new Map<string, Situation>([
  ['la cuenta pendiente@sigpro.test está pendiente de aprobación', 'pendiente'],
  ['existe (cuenta recién solicitada)', 'solicitada'],
  ['la cuenta gestor@sigpro.test está activa', 'gestor'],
  ['no existe ninguna cuenta con ese correo', 'sin-cuenta'],
]);

/** Correo que escribe cada fila, según su tipo: «solicitada» es el correo de la solicitud previa de la propia fila. */
const CORREO_KINDS: ReadonlyMap<string, Situation> = new Map<string, Situation>([
  ['pendiente@sigpro.test', 'pendiente'],
  ['(cuenta recién solicitada)', 'solicitada'],
  ['gestor@sigpro.test', 'gestor'],
  ['(correo sin cuenta)', 'sin-cuenta'],
]);

/** Cada situación prepara su correo; `failure` dice por qué el estado de partida no se produjo (si no se produjo). */
interface Setup {
  readonly email: string;
  readonly failure: string | undefined;
}

const SETUPS: ReadonlyMap<string, () => Promise<Setup>> = new Map<string, () => Promise<Setup>>([
  ['pendiente', async () => ({ email: 'pendiente@sigpro.test', failure: await accountState('pendiente@sigpro.test', 'pending', true) })],
  ['gestor', async () => ({ email: 'gestor@sigpro.test', failure: await accountState('gestor@sigpro.test', 'active', true) })],
  [
    'solicitada',
    async () => {
      const requested = await requestAccount(TENANT_A);
      return { email: requested.email, failure: requested.result.status === 201 ? undefined : `la solicitud previa responde ${requested.result.status}` };
    },
  ],
  ['sin-cuenta', async () => ({ email: unknownEmail(), failure: undefined })],
]);

const accepted: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const situation = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const kind = strict('correo', CORREO_KINDS, cell(row, 'correo'));
  if (kind !== situation) throw new Error(`fila incoherente: la situación «${situation}» lleva un correo de tipo «${kind}»`);
  const setup = await strict('situacion', SETUPS, situation)();
  if (setup.failure !== undefined) {
    return outcome(false, EXPECTED_202, `la preparación no se cumplió: ${setup.failure}`, { note: PREPARATION_NOTE });
  }
  const result = await postResend(TENANT_A, { email: setup.email });
  return conclude([responseCheck(result, { status: 202 }), emptyAcceptedCheck(result)]);
};

// --- Esquema 2: el correo es obligatorio --------------------------------------------------------------------------------------

const missingEmail: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = bodyValue(cell(row, 'email'), EMPTY_MARKERS);
  const result = await postResend(TENANT_A, { email });
  return conclude([responseCheck(result, { status: 422, code: 'validation_failed' }), motiveCheck(result, 'email')]);
};

defineApiRows({
  story: 'US-REGISTRO-006',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, accepted],
    [2, missingEmail],
  ]),
});
