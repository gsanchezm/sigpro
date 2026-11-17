import { NEW_ACCOUNT_PASSWORD, TENANT_A, TENANT_B, WRONG_PASSWORD, failedLogins, requestAccount, resetTenants } from '../../support/prepare';
import { defineApiRows, type ApiRowHandler } from '../../support/rows';
import { bodyOf, cell, emailOf, finish, fromSteps, passwordOf, postLogin, premise, reasonOf, rememberOf, requirePreparation, statuses, tenantHeaderOf } from './common';

// US-LOGIN-001 — Iniciar sesión con correo y contraseña en un tenant. Las expectativas salen de los pasos «Entonces/Y» de cada
// fila (`finish` los lee del manifiesto); aquí solo se prepara el estado y se traduce cada celda a la petición.

const NO_FAILED_ATTEMPTS = /(\S+@\S+) no tiene intentos fallidos/;

/** Esquemas 1 y 3: correo y contraseña salen de dos columnas; el correo puede ser un marcador («(vacío)», «(sin el campo)»…). */
const credentialsFrom =
  (emailColumn: string, passwordColumn: string): ApiRowHandler =>
  async (row) => {
    await resetTenants([TENANT_A]);
    const result = await postLogin(TENANT_A, bodyOf({ email: emailOf(cell(row, emailColumn)), password: passwordOf(cell(row, passwordColumn)) }));
    return finish(row, result);
  };

/** Esquema 2: el correo es el de «gestor@sigpro.test no tiene intentos fallidos» y la contraseña sale de la columna. */
const exactPassword: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const result = await postLogin(TENANT_A, bodyOf({ email: fromSteps(row, NO_FAILED_ATTEMPTS), password: passwordOf(cell(row, 'contraseña_enviada')) }));
  return finish(row, result);
};

/**
 * Esquema 4: N peticiones con contraseña vacía (rechazadas por validación) y después una con contraseña incorrecta. Que las N
 * peticiones se rechacen con 422 es justo lo que evalúa la fila, así que esa premisa NO es preparación: si falla, la fila discrepa.
 */
const rejectedDoNotCount: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const email = fromSteps(row, NO_FAILED_ATTEMPTS);
  const count = Number(cell(row, 'rechazadas'));
  if (!Number.isInteger(count) || count < 1) throw new Error(`celda sin interpretación: rechazadas «${cell(row, 'rechazadas')}»`);
  const rejected = await failedLogins(TENANT_A, email, count, '');
  const last = await postLogin(TENANT_A, { email, password: WRONG_PASSWORD });
  return finish(row, last, {
    premises: [premise(`${count} petición(es) con la contraseña (vacío) se rechaza(n) por validación (422)`, rejected.every((result) => result.status === 422), `HTTP ${statuses(rejected)}`)],
  });
};

/** Esquema 5: `remember` se envía como booleano, como texto o no se envía. */
const rememberFlag: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const body = bodyOf({ email: fromSteps(row, NO_FAILED_ATTEMPTS), password: fromSteps(row, /la contraseña (\S+) y remember/), remember: rememberOf(cell(row, 'remember')) });
  const result = await postLogin(TENANT_A, body);
  const reason = reasonOf(result, 'remember');
  // La fila solo pide «un motivo para remember»: se anota el que da la app porque no es de los que enumeran las Reglas
  return finish(row, result, reason === undefined ? {} : { note: `El motivo observado para remember es «${reason}», que no es uno de los enumerados en las Reglas (required, badEmail); la fila solo pide un motivo` });
};

/** Esquema 6: la cabecera x-tenant decide el tenant (o no hay cabecera y se deduce del correo). */
const tenantHeader: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const result = await postLogin(tenantHeaderOf(cell(row, 'cabecera')), bodyOf({ email: emailOf(cell(row, 'correo')), password: passwordOf(cell(row, 'contraseña')) }));
  return finish(row, result);
};

/** Esquema 7: una cuenta recién solicitada en alumno01 no existe en alumno02. */
const accountOnlyInItsTenant: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const account = await requestAccount(TENANT_A);
  const premises = requirePreparation(row, [premise('la cuenta se solicita en alumno01 con POST /api/auth/register', account.result.status >= 200 && account.result.status < 300, `HTTP ${account.result.status}`)]);
  const result = await postLogin(tenantHeaderOf(cell(row, 'cabecera')), { email: account.email, password: NEW_ACCOUNT_PASSWORD });
  return finish(row, result, { premises });
};

defineApiRows({
  story: 'US-LOGIN-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, credentialsFrom('correo_enviado', 'contraseña')],
    [2, exactPassword],
    [3, credentialsFrom('correo', 'contraseña')],
    [4, rejectedDoNotCount],
    [5, rememberFlag],
    [6, tenantHeader],
    [7, accountOnlyInItsTenant],
  ]),
});
