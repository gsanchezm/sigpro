import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, conclude, preparationFailed, strict } from '../../support/checks';
import { ACCOUNT_OF, CREDENTIAL_OF, TENANT_A, act, answerChecks, fieldChecks, resetTenants, sessionFor, tokenOf, type SessionOf } from './common';

// US-PROG-GESTION-001 — Archivar un programa por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta de la fila en alumno01 (el administrador completa el segundo
// factor). Todas las peticiones llevan x-tenant: alumno01. Los estados se leen con GET /api/programs/:code.

// --- Caso de archivado: la cuenta pide el archivado de un programa cuyo estado inicial se comprueba antes ----------------------

interface ArchiveCase {
  readonly code: string;
  readonly account: string;
  readonly initial: string;
  readonly answer: string;
  readonly finalStatus: string;
}

const archiveCase = async (kase: ArchiveCase): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${kase.answer}; ${kase.code} queda en ${kase.finalStatus}`;
  const actor: SessionOf = await sessionFor(strict('cuenta', ACCOUNT_OF, kase.account));
  if (actor.token === undefined) return preparationFailed(expected, `${kase.account} inicia sesión y recibe accessToken`, actor.last);
  // El estado inicial que da por hecha la fila: si no se produce, la fila no se juzga
  const before = await act('GET', `/programs/${kase.code}`, actor.token);
  if (field(before.body, 'status') !== kase.initial) {
    return preparationFailed(expected, `${kase.code} tiene el estado ${kase.initial} (la lectura da ${String(field(before.body, 'status'))})`, before);
  }
  const result = await act('POST', `/programs/${kase.code}/archive`, actor.token);
  const after = await act('GET', `/programs/${kase.code}`, actor.token);
  return conclude([...answerChecks(kase.answer, result), ...fieldChecks(after.body, [['status', kase.finalStatus]])]);
};

// --- Esquema 1: el archivado pasa el programa a closed ------------------------------------------------------------------------

const archivesToClosed: ApiRowHandler = (row) =>
  archiveCase({ code: cell(row, 'codigo'), account: cell(row, 'cuenta'), initial: cell(row, 'estado_inicial'), answer: '200 con status closed', finalStatus: cell(row, 'estado_final') });

// --- Esquema 2: solo el administrador y el gestor pueden archivar -------------------------------------------------------------

const onlyAdminAndManager: ApiRowHandler = (row) =>
  archiveCase({ code: 'PRG-001', account: cell(row, 'cuenta'), initial: 'active', answer: cell(row, 'respuesta'), finalStatus: cell(row, 'estado_final') });

// --- Esquema 3: sin sesión válida o con un código inexistente no se archiva nada ----------------------------------------------

const withoutValidSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${cell(row, 'respuesta')}; PRG-001 sigue en active`;
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  const result = await act('POST', `/programs/${cell(row, 'codigo')}/archive`, actor.token);
  // Lectura de PRG-001 con la cuenta gestor (la que no cambia nada): la fila dice que PRG-001 no se archiva
  const reader = await sessionFor('gestor');
  if (reader.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión para leer PRG-001', reader.last);
  const after = await act('GET', '/programs/PRG-001', reader.token);
  return conclude([...answerChecks(cell(row, 'respuesta'), result), ...fieldChecks(after.body, [['status', 'active']])]);
};

defineApiRows({
  story: 'US-PROG-GESTION-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, archivesToClosed],
    [2, onlyAdminAndManager],
    [3, withoutValidSession],
  ]),
});
