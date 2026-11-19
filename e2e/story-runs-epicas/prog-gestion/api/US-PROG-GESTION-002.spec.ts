import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, conclude, preparationFailed, strict } from '../../support/checks';
import { ACCOUNT_OF, CREDENTIAL_OF, TENANT_A, act, answerChecks, fieldChecks, resetTenants, sessionFor, tokenOf, totalCheck, totalOf } from './common';

// US-PROG-GESTION-002 — Duplicar un programa como borrador por la API. Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor).
// Las comprobaciones de la copia se hacen sobre la respuesta 201 y, después, sobre el original con GET /api/programs/PRG-001.

// --- Esquema 1: la copia recibe el código siguiente, el nombre con (copia) y los datos del original ----------------------------

const copyOfPrg001: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected =
    'respuesta 201 con code PRG-025 y status draft; nombre Sistema de mando táctico Ártemis (copia); priority medium, classified true, ownerName Marta Ruiz, startDate 2023-01-01, endDate 2024-07-01, budgetEur 450000; progress 0, milestonesTotal 0; PRG-001 sigue en active con progress 11';
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  // «PRG-001 tiene el estado active, con 1 de 9 hitos cumplidos» (seed)
  const origin = await act('GET', '/programs/PRG-001', actor.token);
  if (field(origin.body, 'status') !== 'active' || field(origin.body, 'milestonesDone') !== 1 || field(origin.body, 'milestonesTotal') !== 9) {
    return preparationFailed(expected, 'PRG-001 tiene el estado active con 1 de 9 hitos cumplidos', origin);
  }
  const result = await act('POST', '/programs/PRG-001/duplicate', actor.token);
  const after = await act('GET', '/programs/PRG-001', actor.token);
  return conclude([
    ...answerChecks('201 con code PRG-025 y status draft', result),
    ...fieldChecks(result.body, [
      ['name', 'Sistema de mando táctico Ártemis (copia)'],
      ['priority', 'medium'],
      ['classified', 'true'],
      ['ownerName', 'Marta Ruiz'],
      ['startDate', '2023-01-01'],
      ['endDate', '2024-07-01'],
      ['budgetEur', '450000'],
      ['progress', '0'],
      ['milestonesTotal', '0'],
      // La regla de la historia (no el paso) dice que la copia no tiene hitos cumplidos
      ['milestonesDone', '0'],
    ]),
    ...fieldChecks(after.body, [
      ['status', 'active'],
      ['progress', '11'],
    ]),
  ]);
};

// --- Esquema 2: la copia es siempre borrador, aunque el original esté en pausa o cancelado ----------------------------------

const copyIsDraft: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'codigo');
  const expected = `respuesta 201 con code PRG-025 y status draft; nombre ${cell(row, 'nombre_copia')}`;
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const origin = await act('GET', `/programs/${code}`, gestor.token);
  if (field(origin.body, 'status') !== cell(row, 'estado_original')) {
    return preparationFailed(expected, `${code} tiene el estado ${cell(row, 'estado_original')} (la lectura da ${String(field(origin.body, 'status'))})`, origin);
  }
  const result = await act('POST', `/programs/${code}/duplicate`, gestor.token);
  return conclude([...answerChecks('201 con code PRG-025 y status draft', result), ...fieldChecks(result.body, [['name', cell(row, 'nombre_copia')]])]);
};

// --- Esquema 3: solo el administrador y el gestor pueden duplicar -------------------------------------------------------------

const onlyAdminAndManager: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene ${cell(row, 'total')} programas`;
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const before = await totalOf(actor.token);
  if (before !== 24) return preparationFailed(expected, `el tenant tiene 24 programas (lectura: ${String(before)})`, actor.last);
  const result = await act('POST', '/programs/PRG-001/duplicate', actor.token);
  const total = await totalOf(actor.token);
  return conclude([...answerChecks(cell(row, 'respuesta'), result), totalCheck(total, Number(cell(row, 'total')))]);
};

// --- Esquema 4: sin sesión válida o con un código inexistente no se crea ninguna copia ----------------------------------------

const withoutValidSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene 24 programas`;
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  const result = await act('POST', `/programs/${cell(row, 'codigo')}/duplicate`, actor.token);
  const reader = await sessionFor('gestor');
  if (reader.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión para contar los programas', reader.last);
  const total = await totalOf(reader.token);
  return conclude([...answerChecks(cell(row, 'respuesta'), result), totalCheck(total, 24)]);
};

defineApiRows({
  story: 'US-PROG-GESTION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, copyOfPrg001],
    [2, copyIsDraft],
    [3, onlyAdminAndManager],
    [4, withoutValidSession],
  ]),
});
