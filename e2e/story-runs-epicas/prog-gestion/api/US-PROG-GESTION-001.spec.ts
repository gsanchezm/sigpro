import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_OF, CREDENTIAL_OF, TENANT_A, act, answerChecks, auditCount, fieldChecks, photoCheck, resetTenants, sessionFor, tokenOf, type SessionOf } from './common';

// US-PROG-GESTION-001 — Archivar un programa por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, según la fila, inicio de sesión de la cuenta de la fila en alumno01 (el administrador completa el segundo
// factor). Todas las peticiones llevan x-tenant: alumno01. Se comprueba la ficha antes y después (solo el estado puede cambiar) y
// los eventos de auditoría program.archived que lee el administrador.

/** Comprueba que la auditoría de `action` sobre `code` creció exactamente en `delta`. */
const auditDelta = (before: number | undefined, after: number | undefined, delta: number, label: string): Check =>
  check(
    before !== undefined && after !== undefined && after - before === delta,
    `${label}: la auditoría crece en ${delta}`,
    before === undefined || after === undefined ? `${label}: auditoría no legible` : `${label}: la auditoría crece en ${after - before}`,
  );

interface ArchiveCase {
  readonly code: string;
  readonly account: string;
  readonly initial: string;
  readonly answer: string;
  readonly finalStatus: string;
}

const archiveCase = async (kase: ArchiveCase): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${kase.answer}; ${kase.code} queda en ${kase.finalStatus}; la ficha no cambia; auditoría program.archived`;
  const actor: SessionOf = await sessionFor(strict('cuenta', ACCOUNT_OF, kase.account));
  if (actor.token === undefined) return preparationFailed(expected, `${kase.account} inicia sesión y recibe accessToken`, actor.last);
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor (lectura de auditoría)', admin.last);
  // El estado inicial que da por hecha la fila: si no se produce, la fila no se juzga
  const before = await act('GET', `/programs/${kase.code}`, actor.token);
  if (field(before.body, 'status') !== kase.initial) {
    return preparationFailed(expected, `${kase.code} tiene el estado ${kase.initial} (la lectura da ${String(field(before.body, 'status'))})`, before);
  }
  const auditBefore = await auditCount(admin.token, kase.code, 'program.archived');
  const result = await act('POST', `/programs/${kase.code}/archive`, actor.token);
  const after = await act('GET', `/programs/${kase.code}`, actor.token);
  const auditAfter = await auditCount(admin.token, kase.code, 'program.archived');
  const delta = kase.answer.startsWith('200') ? 1 : 0;
  return conclude([
    ...answerChecks(kase.answer, result),
    ...fieldChecks(after.body, [['status', kase.finalStatus]]),
    photoCheck(before.body, after.body, `la ficha de ${kase.code}`),
    auditDelta(auditBefore, auditAfter, delta, `program.archived de ${kase.code}`),
  ]);
};

// --- Esquema 1: el archivado pasa el programa a closed (la respuesta se lee de su celda) -------------------------------------

const archivesToClosed: ApiRowHandler = (row) =>
  archiveCase({ code: cell(row, 'codigo'), account: cell(row, 'cuenta'), initial: cell(row, 'estado_inicial'), answer: cell(row, 'respuesta'), finalStatus: cell(row, 'estado_final') });

// --- Esquema 2: solo el administrador y el gestor pueden archivar -------------------------------------------------------------

const onlyAdminAndManager: ApiRowHandler = (row) =>
  archiveCase({ code: 'PRG-001', account: cell(row, 'cuenta'), initial: 'active', answer: cell(row, 'respuesta'), finalStatus: cell(row, 'estado_final') });

// --- Esquema 3: sin sesión válida o con un código inexistente no se archiva nada ----------------------------------------------

const withoutValidSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${cell(row, 'respuesta')}; PRG-001 sigue en active con la misma ficha y sin auditoría nueva`;
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  // Lecturas de PRG-001 con la cuenta gestor y de la auditoría con el administrador
  const reader = await sessionFor('gestor');
  if (reader.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión para leer PRG-001', reader.last);
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor (lectura de auditoría)', admin.last);
  const before = await act('GET', '/programs/PRG-001', reader.token);
  const auditBefore = await auditCount(admin.token, 'PRG-001', 'program.archived');
  const result = await act('POST', `/programs/${cell(row, 'codigo')}/archive`, actor.token);
  const after = await act('GET', '/programs/PRG-001', reader.token);
  const auditAfter = await auditCount(admin.token, 'PRG-001', 'program.archived');
  return conclude([
    ...answerChecks(cell(row, 'respuesta'), result),
    ...fieldChecks(after.body, [['status', 'active']]),
    photoCheck(before.body, after.body, 'la ficha de PRG-001'),
    auditDelta(auditBefore, auditAfter, 0, 'program.archived de PRG-001'),
  ]);
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
