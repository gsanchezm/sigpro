import { DEMO, TENANT_A, WRONG_PASSWORD, resetTenants } from '../../../story-runs/support/prepare';
import { cell, conclude, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { noSessionTokens, signIn, statusCheck, type Expect } from '../api/common';

// US-ADMIN-USUARIOS-013 — Desbloquear una cuenta bloqueada tras cinco intentos fallidos (`no-implementada`).
// Esquema 1 (capacidad futura: la app no tiene control ni endpoint para desbloquear): `notExecutable` en cada fila, con su motivo.
// Esquema 2 (conducta que existe hoy: una cuenta bloqueada no abre sesión): se ejecuta por la API, como fila de API, sin navegador.

const FUTURE_NOTE = 'capacidad futura, no se prueba contra la app: la tabla no tiene control para desbloquear y la historia lo deja en «Decisiones pendientes».';

/** Texto esperado de la fila: sus celdas tal como las escribe la historia. */
const expectedOf = (row: ManifestRow): string => Object.entries(row.cells).map(([key, value]) => `${key} ${value}`).join('; ');

const futureRow: ApiRowHandler = async (row) => notExecutable(expectedOf(row), FUTURE_NOTE);

// --- Esquema 2: la cuenta bloqueada no abre sesión, ni con su contraseña correcta --------------------------------------------

const PASSWORD_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Block1234!', DEMO.bloqueado.password],
  ['incorrecta', WRONG_PASSWORD],
]);

const LOCKED: Expect = { status: 423, code: 'account_locked' };

const lockedLogin: ApiRowHandler = async (row) => {
  const password = strict('contraseña', PASSWORD_CELLS, cell(row, 'contraseña'));
  // Dado: alumno01 recién reiniciado y bloqueado@sigpro.test bloqueada (seed; el reinicio deja los intentos a cinco)
  await resetTenants([TENANT_A]);
  const login = await signIn({ email: DEMO.bloqueado.email, password }, TENANT_A);
  return conclude([statusCheck(login, LOCKED), noSessionTokens(login)], { note: 'El aviso de la pantalla de acceso («Cuenta bloqueada tras varios intentos fallidos. Contacta con un administrador.») no se comprueba: esta fila es de API.' });
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-013',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, futureRow],
    [2, lockedLogin],
  ]),
});
