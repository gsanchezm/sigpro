import { field, type ApiResult } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import {
  ACCOUNT_OF,
  CREDENTIAL_OF,
  PHOTO_KEYS,
  TENANT_A,
  act,
  answerChecks,
  auditCount,
  fieldChecks,
  photoCheck,
  resetTenants,
  sessionFor,
  tokenOf,
  totalCheck,
  totalOf,
} from './common';

// US-PROG-GESTION-002 — Duplicar un programa como borrador por la API. Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador y, según la fila, inicio de sesión de la cuenta en alumno01 (el administrador completa el segundo factor).
// El original se compara con su ficha leída antes (incluido su estado); la descripción de la copia se compara con la del original
// leída antes de duplicar (la regla dice que la copia la recibe); la auditoría program.duplicated se lee con el administrador.

/** Auditoría de la copia: `program.duplicated` sobre el código nuevo (PRG-025) crece en uno cuando la copia se crea. */
const copyAudit = (before: number | undefined, after: number | undefined, created: boolean, label: string): Check =>
  check(
    before !== undefined && after !== undefined && after - before === (created ? 1 : 0),
    `${label}: auditoría program.duplicated de PRG-025 ${created ? '+1' : '+0'}`,
    before === undefined || after === undefined ? `${label}: auditoría no legible` : `${label}: auditoría program.duplicated de PRG-025 +${after - before}`,
  );

/** Lectura de un programa con el token dado. */
const readProgram = (token: string, code: string): Promise<ApiResult> => act('GET', `/programs/${code}`, token);

// --- Esquema 1: la copia recibe el código siguiente, el nombre con (copia) y los datos del original ----------------------------

const copyOfPrg001: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected =
    'respuesta 201 con code PRG-025 y status draft; nombre Sistema de mando táctico Ártemis (copia); priority medium, classified true, ownerName Marta Ruiz, startDate 2023-01-01, endDate 2024-07-01, budgetEur 450000; progress 0, milestonesTotal 0; PRG-001 sigue igual; auditoría program.duplicated de PRG-025';
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor (lectura de auditoría)', admin.last);
  // «PRG-001 tiene el estado active, con 1 de 9 hitos cumplidos» (seed)
  const origin = await readProgram(actor.token, 'PRG-001');
  if (field(origin.body, 'status') !== 'active' || field(origin.body, 'milestonesDone') !== 1 || field(origin.body, 'milestonesTotal') !== 9) {
    return preparationFailed(expected, 'PRG-001 tiene el estado active con 1 de 9 hitos cumplidos', origin);
  }
  const auditBefore = await auditCount(admin.token, 'PRG-025', 'program.duplicated');
  const result = await act('POST', '/programs/PRG-001/duplicate', actor.token);
  const after = await readProgram(actor.token, 'PRG-001');
  const auditAfter = await auditCount(admin.token, 'PRG-025', 'program.duplicated');
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
      // La regla dice que la copia recibe la descripción del original (leída antes de duplicar)
      ['description', String(field(origin.body, 'description'))],
    ]),
    photoCheck(origin.body, after.body, 'la ficha de PRG-001', [...PHOTO_KEYS, 'status']),
    copyAudit(auditBefore, auditAfter, true, 'PRG-025'),
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
  const expected = `respuesta 201 con code PRG-025 y status draft; nombre ${cell(row, 'nombre_copia')}; ${code} sigue en ${cell(row, 'estado_original')}`;
  const gestor = await sessionFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const admin = await sessionFor('admin');
  if (admin.token === undefined) return preparationFailed(expected, 'admin@sigpro.test completa el segundo factor (lectura de auditoría)', admin.last);
  const origin = await readProgram(gestor.token, code);
  if (field(origin.body, 'status') !== cell(row, 'estado_original')) {
    return preparationFailed(expected, `${code} tiene el estado ${cell(row, 'estado_original')} (la lectura da ${String(field(origin.body, 'status'))})`, origin);
  }
  const auditBefore = await auditCount(admin.token, 'PRG-025', 'program.duplicated');
  const result = await act('POST', `/programs/${code}/duplicate`, gestor.token);
  const after = await readProgram(gestor.token, code);
  const auditAfter = await auditCount(admin.token, 'PRG-025', 'program.duplicated');
  return conclude([
    ...answerChecks('201 con code PRG-025 y status draft', result),
    ...fieldChecks(result.body, [['name', cell(row, 'nombre_copia')]]),
    photoCheck(origin.body, after.body, `la ficha de ${code}`, [...PHOTO_KEYS, 'status']),
    copyAudit(auditBefore, auditAfter, true, 'PRG-025'),
  ]);
};

// --- Esquema 3: solo el administrador y el gestor pueden duplicar -------------------------------------------------------------

const onlyAdminAndManager: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene ${cell(row, 'total')} programas`;
  const actor = await sessionFor(strict('cuenta', ACCOUNT_OF, cell(row, 'cuenta')));
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, actor.last);
  const before = await totalOf(actor.token);
  if (before !== 24) return preparationFailed(expected, `el tenant tiene 24 programas (lectura: ${String(before)})`, actor.last);
  const origin = await readProgram(actor.token, 'PRG-001');
  const result = await act('POST', '/programs/PRG-001/duplicate', actor.token);
  const total = await totalOf(actor.token);
  const after = await readProgram(actor.token, 'PRG-001');
  return conclude([
    ...answerChecks(cell(row, 'respuesta'), result),
    totalCheck(total, Number(cell(row, 'total'))),
    photoCheck(origin.body, after.body, 'la ficha de PRG-001', [...PHOTO_KEYS, 'status']),
  ]);
};

// --- Esquema 4: sin sesión válida o con un código inexistente no se crea ninguna copia ----------------------------------------

const withoutValidSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'respuesta')}; el tenant tiene 24 programas`;
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const actor = await tokenOf(credential);
  if (credential.kind === 'account' && actor.token === undefined) return preparationFailed(expected, 'la cuenta de la credencial inicia sesión y recibe accessToken', actor.last);
  const reader = await sessionFor('gestor');
  if (reader.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión para contar los programas', reader.last);
  const result = await act('POST', `/programs/${cell(row, 'codigo')}/duplicate`, actor.token);
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

