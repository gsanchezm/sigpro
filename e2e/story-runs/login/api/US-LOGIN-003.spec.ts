import { errorCode, field, usersByEmail } from '../../support/api';
import { DEMO, TENANT_A, WRONG_PASSWORD, failedLogins, requestAccount, resetTenants, setAccountActive } from '../../support/prepare';
import { defineApiRows, type ApiRowHandler } from '../../support/rows';
import { cell, finish, fromSteps, passwordOf, postLogin, premise, requirePreparation, statuses, strict, type Premise } from './common';

// US-LOGIN-003 — Rechazar el inicio de sesión de una cuenta pendiente de aprobación o desactivada. Las expectativas salen de
// los pasos «Entonces/Y» de cada fila; la preparación (reinicio, fallos previos, desactivar o reactivar) va por HTTP y, si no deja
// el estado de partida que dan por hecho los pasos «Dado», lanza (`requirePreparation`): no es una discrepancia de la app.

/** Estado de una cuenta que la historia da por hecho; solo se comparan las claves indicadas. */
interface AccountState {
  readonly active?: boolean;
  readonly locked?: boolean;
  readonly pending?: boolean;
}

/** Lee la cuenta en `GET /api/admin/users` y comprueba que está en el estado que da por hecho la historia. */
const stateIs = async (label: string, email: string, expected: AccountState): Promise<Premise> => {
  const user = (await usersByEmail(TENANT_A)).get(email);
  const observed = user === undefined ? 'la cuenta no está en el listado de usuarios' : `active ${String(user.active)}, locked ${String(user.locked)}, pending ${String(user.pending)}`;
  return premise(label, user !== undefined && Object.entries(expected).every(([key, value]) => user[key] === value), observed);
};

interface Account {
  readonly email: string;
  readonly premises: readonly Premise[];
}

/** Cuentas pendientes de aprobación que citan los ejemplos: la del seed y una recién solicitada con POST /api/auth/register. */
const PENDING_ACCOUNTS: ReadonlyMap<string, () => Promise<Account>> = new Map<string, () => Promise<Account>>([
  ['pendiente@sigpro.test', async () => ({ email: DEMO.pendiente.email, premises: [] })],
  [
    '(cuenta recién solicitada)',
    async () => {
      const account = await requestAccount(TENANT_A);
      return { email: account.email, premises: [premise('la cuenta se solicita con POST /api/auth/register', account.result.status >= 200 && account.result.status < 300, `HTTP ${account.result.status}`)] };
    },
  ],
]);

/** Esquema 1: una cuenta pendiente (del seed o recién solicitada) entra con su contraseña o con una incorrecta. */
const pendingAccount: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const account = await strict('cuenta pendiente', PENDING_ACCOUNTS, cell(row, 'correo'))();
  const pending = await stateIs(`${cell(row, 'correo')} está pendiente de aprobación`, account.email, { pending: true });
  const premises = requirePreparation(row, [...account.premises, pending]);
  const result = await postLogin(TENANT_A, { email: account.email, password: passwordOf(cell(row, 'contraseña')) });
  return finish(row, result, { premises });
};

/** Acciones del administrador sobre la cuenta (`PATCH /api/admin/users/<id>` con `active`), en orden. */
const ADMIN_ACTIONS: ReadonlyMap<string, readonly boolean[]> = new Map<string, readonly boolean[]>([
  ['desactivado', [false]],
  ['desactivado y vuelto a activar', [false, true]],
]);

const applyActive = async (email: string, sequence: readonly boolean[]): Promise<readonly Premise[]> => {
  const premises: Premise[] = [];
  for (const active of sequence) {
    const patch = await setAccountActive(TENANT_A, email, active);
    premises.push(premise(`el administrador ${active ? 'reactiva' : 'desactiva'} ${email} con PATCH /api/admin/users/<id>`, patch.status === 200 && field(patch.body, 'active') === active, `HTTP ${patch.status}, active ${String(field(patch.body, 'active'))}`));
  }
  return premises;
};

/** Esquema 2: la cuenta desactivada no entra hasta que se reactiva. */
const disabledAccount: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /la cuenta (\S+@\S+)/);
  const sequence = strict('accion', ADMIN_ACTIONS, cell(row, 'accion'));
  const finalActive = sequence.at(-1) === true;
  const premises = requirePreparation(row, [...(await applyActive(email, sequence)), await stateIs(`${email} queda ${finalActive ? 'activa' : 'desactivada'}`, email, { active: finalActive })]);
  const result = await postLogin(TENANT_A, { email, password: passwordOf(cell(row, 'contraseña')) });
  return finish(row, result, { premises });
};

/**
 * Lo que la columna `otro_estado` dice de la cuenta desactivada, y solo eso: «pendiente de aprobación» no exige nada sobre el
 * bloqueo ni «bloqueada» sobre la aprobación (la historia no lo dice). Las tres banderas reales quedan en lo observado.
 */
const OTHER_STATES: ReadonlyMap<string, AccountState> = new Map<string, AccountState>([
  ['activa en lo demás', { locked: false, pending: false }],
  ['pendiente de aprobación', { pending: true }],
  ['bloqueada', { locked: true }],
]);

/** Esquema 3: orden de los estados (bloqueada, pendiente, desactivada) cuando una cuenta desactivada además tiene otro estado. */
const stateOrder: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = cell(row, 'correo');
  const otherState = cell(row, 'otro_estado');
  const flags = strict('otro_estado', OTHER_STATES, otherState);
  const premises = requirePreparation(row, [...(await applyActive(email, [false])), await stateIs(`${email} está desactivada y además ${otherState}`, email, { active: false, ...flags })]);
  const result = await postLogin(TENANT_A, { email, password: passwordOf(cell(row, 'contraseña')) });
  return finish(row, result, { premises });
};

/** Esquema 4: la contraseña correcta reinicia el contador aunque la respuesta sea 403. */
const counterResetsWhilePending: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /^Dado .*, (\S+@\S+) acumula/);
  const password = fromSteps(row, /su contraseña correcta (\S+) y recibe 403 pending_approval/);
  const count = Number(cell(row, 'fallos_previos'));
  if (!Number.isInteger(count) || count < 0) throw new Error(`celda sin interpretación: fallos_previos «${cell(row, 'fallos_previos')}»`);
  const pending = await stateIs(`${email} está pendiente de aprobación`, email, { pending: true });
  const prior = await failedLogins(TENANT_A, email, count);
  const correct = await postLogin(TENANT_A, { email, password });
  const code = errorCode(correct);
  const premises = requirePreparation(row, [
    pending,
    premise('envía su contraseña correcta y recibe 403 pending_approval', correct.status === 403 && code === 'pending_approval', `HTTP ${correct.status}${code === undefined ? '' : ` ${code}`}`),
  ]);
  const result = await postLogin(TENANT_A, { email, password: WRONG_PASSWORD });
  return finish(row, result, { history: `Previos: ${count} fallos (HTTP ${statuses(prior)})`, premises });
};

defineApiRows({
  story: 'US-LOGIN-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, pendingAccount],
    [2, disabledAccount],
    [3, stateOrder],
    [4, counterResetsWhilePending],
  ]),
});
