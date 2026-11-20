import { field } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, WRONG_PASSWORD, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { noSessionTokens, signIn, statusCheck, type Expect } from '../api/common';

// US-ADMIN-USUARIOS-012 — Aprobar una cuenta pendiente de aprobación desde la tabla de usuarios (`no-implementada`).
// Esquema 1 (capacidad futura: la app no tiene control ni endpoint para aprobar): `notExecutable` en cada fila, con su motivo.
// Esquema 2 (conducta que existe hoy: el inicio de sesión de una cuenta pendiente): se ejecuta por la API, como fila de API, sin navegador.
// La historia dice que hoy existe, así que la fila se ejecuta; el aviso de la pantalla de acceso no se comprueba aquí.

const FUTURE_NOTE = 'capacidad futura, no se prueba contra la app: la tabla no tiene control para aprobar y la historia lo deja en «Decisiones pendientes».';

/** Texto esperado de la fila: sus celdas tal como las escribe la historia. */
const expectedOf = (row: ManifestRow): string => Object.entries(row.cells).map(([key, value]) => `${key} ${value}`).join('; ');

const futureRow: ApiRowHandler = async (row) => notExecutable(expectedOf(row), FUTURE_NOTE);

// --- Esquema 2: el inicio de sesión de una cuenta pendiente ----------------------------------------------------------------

const PASSWORD_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Pend1234!', DEMO.pendiente.password],
  ['incorrecta', WRONG_PASSWORD],
]);

interface PendingAnswer {
  readonly expect: Expect;
  /** Número de intento que debe traer la respuesta (solo con contraseña incorrecta). */
  readonly attempts?: number;
}

const ANSWER_CELLS: ReadonlyMap<string, PendingAnswer> = new Map<string, PendingAnswer>([
  ['403 pending_approval', { expect: { status: 403, code: 'pending_approval' } }],
  ['401 invalid_credentials con attempts 1', { expect: { status: 401, code: 'invalid_credentials' }, attempts: 1 }],
]);

const pendingLogin: ApiRowHandler = async (row) => {
  const password = strict('contraseña', PASSWORD_CELLS, cell(row, 'contraseña'));
  const answer = strict('respuesta', ANSWER_CELLS, cell(row, 'respuesta'));
  // Dado: alumno01 recién reiniciado y pendiente@sigpro.test pendiente de aprobación (seed); el reinicio deja los intentos en cero
  await resetTenants([TENANT_A]);
  const login = await signIn({ email: DEMO.pendiente.email, password }, TENANT_A);
  const attempts = field(login.body, 'attempts');
  return conclude(
    [
      statusCheck(login, answer.expect),
      // Regla: mientras la cuenta está pendiente no abre sesión, aunque la contraseña sea la correcta
      noSessionTokens(login),
      ...(answer.attempts === undefined ? [] : [check(attempts === answer.attempts, `attempts ${answer.attempts}`, `attempts ${String(attempts ?? '(ausente)')}`)]),
    ],
    { note: 'La historia enlaza el aviso de la pantalla de acceso («Cuenta pendiente de aprobación. Revisa tu correo.»): esta fila es de API y no lo mira.' },
  );
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-012',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, futureRow],
    [2, pendingLogin],
  ]),
});
