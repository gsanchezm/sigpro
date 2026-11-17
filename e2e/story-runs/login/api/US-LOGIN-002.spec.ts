import type { ApiResult } from '../../support/api';
import { TENANT_A, TENANT_B, WRONG_PASSWORD, failedLogins, resetTenants } from '../../support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../support/rows';
import { bodyOf, cell, emailOf, finish, fromSteps, passwordOf, postLogin, premise, requirePreparation, statuses, tenantHeaderOf } from './common';

// US-LOGIN-002 — Rechazar credenciales incorrectas y bloquear la cuenta en el 5.º intento fallido. Las expectativas salen de
// los pasos «Entonces/Y» de cada fila; los fallos previos se envían DESPUÉS del reinicio y con el mismo correo que la fila.

const previousFailures = (row: ManifestRow): number => {
  const text = cell(row, 'fallos_previos');
  const count = Number(text);
  if (!Number.isInteger(count) || count < 0) throw new Error(`celda sin interpretación: fallos_previos «${text}»`);
  return count;
};

const history = (count: number, results: readonly ApiResult[]): string => `Previos: ${count} fallos${count === 0 ? '' : ` (HTTP ${statuses(results)})`}`;

/** Esquemas 1 y 2: N fallos previos con el correo de la fila y después una petición con la contraseña de la fila (o la incorrecta). */
const afterFailures =
  (passwordColumn: string | undefined): ApiRowHandler =>
  async (row) => {
    await resetTenants([TENANT_A]);
    const email = emailOf(cell(row, 'correo'));
    if (email === undefined) throw new Error('celda sin interpretación: el correo de la fila no puede faltar');
    const count = previousFailures(row);
    const prior = await failedLogins(TENANT_A, email, count);
    const password = passwordColumn === undefined ? WRONG_PASSWORD : passwordOf(cell(row, passwordColumn));
    const result = await postLogin(TENANT_A, bodyOf({ email, password }));
    // La regla «Gestor@SIGPRO.test y gestor@sigpro.test comparten contador» no se puede ejercitar con una fila que no mezcle las dos formas
    const mixedCase = email !== email.toLowerCase();
    return finish(row, result, {
      history: history(count, prior),
      ...(mixedCase ? { note: `La regla de que ${email} y ${email.toLowerCase()} comparten contador no se ejercita en esta fila: todos los intentos, previos y final, se envían con ${email}, como dice la Preparación; ninguna fila de la historia mezcla las dos formas` } : {}),
    });
  };

/** Esquema 3: la cuenta bloqueada del seed no abre sesión ni con su contraseña. */
const lockedAccount: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const result = await postLogin(TENANT_A, bodyOf({ email: emailOf(cell(row, 'correo')), password: passwordOf(cell(row, 'contraseña')) }));
  return finish(row, result);
};

/** Esquema 4: tras un acceso correcto el contador vuelve a cero. */
const counterResets: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, /^Dado .*, (\S+@\S+) acumula/);
  const password = fromSteps(row, /con la contraseña correcta (\S+) y recibe 200/);
  const count = previousFailures(row);
  const prior = await failedLogins(TENANT_A, email, count);
  const correct = await postLogin(TENANT_A, { email, password });
  // «Y después entra con la contraseña correcta y recibe 200» es preparación: sin él no hay contador que reiniciar
  const premises = requirePreparation(row, [premise('entra con la contraseña correcta y recibe 200', correct.status === 200, `HTTP ${correct.status}`)]);
  const result = await postLogin(TENANT_A, { email, password: WRONG_PASSWORD });
  return finish(row, result, { history: history(count, prior), premises });
};

/** Esquema 5: el contador es de cada correo en cada tenant. */
const counterPerEmailAndTenant: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const email = fromSteps(row, /y (\S+@\S+) acumula \d+ intentos fallidos en alumno01/);
  const count = Number(fromSteps(row, /acumula (\d+) intentos fallidos en alumno01/));
  const prior = await failedLogins(TENANT_A, email, count);
  const tenant = tenantHeaderOf(cell(row, 'tenant'));
  const result = await postLogin(tenant, bodyOf({ email: emailOf(cell(row, 'correo')), password: WRONG_PASSWORD }));
  return finish(row, result, { history: `Previos: ${count} fallos de ${email} en ${TENANT_A} (HTTP ${statuses(prior)})` });
};

defineApiRows({
  story: 'US-LOGIN-002',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, afterFailures(undefined)],
    [2, afterFailures('contraseña')],
    [3, lockedAccount],
    [4, counterResets],
    [5, counterPerEmailAndTenant],
  ]),
});
