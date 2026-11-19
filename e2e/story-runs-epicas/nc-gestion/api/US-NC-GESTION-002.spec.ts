import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { TENANT_A, actorOf, answerChecks, createNc, fieldCheck, fieldsOf, resetTenants, verdict, type Expect } from './common';

// US-NC-GESTION-002 — Rechazo del alta de una no conformidad por la API (POST /api/nc con motivos por campo). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después gestor@sigpro.test inicia sesión en alumno01. Los motivos son las claves
// del catálogo. La celda «(sin el campo)» de la severidad envía el cuerpo SIN esa clave.

const GESTOR = DEMO.gestor;
const TEN_A = 'a'.repeat(10);

const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['PRG-999', 'PRG-999'],
  ['PRG-001', 'PRG-001'],
]);

/** Severidad que se envía; `undefined` = el cuerpo no lleva el campo `severity`. */
const SEVERITY_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['major', 'major'],
  ['(vacío)', ''],
  ['enorme', 'enorme'],
  ['(sin el campo)', undefined],
]);

const FIELD_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['programCode', 'programCode'],
  ['severity', 'severity'],
]);

const REASON_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['programRequired', 'programRequired'],
  ['severityRequired', 'severityRequired'],
]);

const DESCRIPTION_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(9 letras a)', 'a'.repeat(9)],
  ['(12 espacios)', ' '.repeat(12)],
  ['(10 letras a)', 'a'.repeat(10)],
  ['(11 letras a)', 'a'.repeat(11)],
]);

/** Respuesta de la descripción: 422 con su motivo en `description`, o 201 con el código NC-013 (en la respuesta, `code` es el de la NC). */
const DESCRIPTION_RESPONSE_CELLS: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con el motivo descShort en description', { status: 422, code: 'validation_failed', errorField: 'description', errorKey: 'descShort' }],
  ['201 con el código NC-013', { status: 201, code: 'NC-013' }],
]);

const ASSIGNEE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['u99', 'u99'],
  ['u3', 'u3'],
]);

const ASSIGNEE_RESPONSE_CELLS: ReadonlyMap<string, Expect & { readonly assigneeName?: string }> = new Map<string, Expect & { readonly assigneeName?: string }>([
  ['422 validation_failed con el motivo badAssignee en assigneeId', { status: 422, code: 'validation_failed', errorField: 'assigneeId', errorKey: 'badAssignee' }],
  ['201 con el código NC-013 y assigneeName Lucía Fernández', { status: 201, code: 'NC-013', assigneeName: 'Lucía Fernández' }],
]);

const REJECTION_CELLS: ReadonlyMap<string, Readonly<Record<string, unknown>>> = new Map<string, Readonly<Record<string, unknown>>>([
  ['la severidad enorme', { severity: 'enorme' }],
  ['la descripción de 9 letras a', { description: 'a'.repeat(9) }],
  ['el programa PRG-999', { programCode: 'PRG-999' }],
]);

/** Cuerpo válido del alta (programa PRG-001, severidad minor, descripción de diez letras) salvo por lo que se indique. */
const validBody = (overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> => ({ programCode: 'PRG-001', severity: 'minor', description: TEN_A, ...overrides });

// --- Esquema 1: el programa y la severidad se validan antes de abrir la no conformidad -----------------------------------------

const programAndSeverity: ApiRowHandler = async (row: ManifestRow) => {
  const program = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const field = strict('campo', FIELD_CELLS, cell(row, 'campo'));
  const reason = strict('motivo', REASON_CELLS, cell(row, 'motivo'));
  const expected = `POST /api/nc con programa ${cell(row, 'programa')} y severidad ${cell(row, 'severidad')} → 422 validation_failed con el motivo ${reason} en ${field}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const base: Record<string, unknown> = { programCode: program, description: TEN_A };
  const payload = severity === undefined ? base : { ...base, severity };
  const result = await createNc(gestor.token, payload);
  return verdict(answerChecks({ status: 422, code: 'validation_failed', errorField: field, errorKey: reason }, result));
};

// --- Esquema 2: la descripción debe tener al menos 10 caracteres ---------------------------------------------------------------

const descriptionLength: ApiRowHandler = async (row: ManifestRow) => {
  const description = strict('descripcion', DESCRIPTION_CELLS, cell(row, 'descripcion'));
  const expect = strict('respuesta', DESCRIPTION_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc con la descripción ${cell(row, 'descripcion')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await createNc(gestor.token, validBody({ severity: 'major', description }));
  return verdict(answerChecks(expect, result));
};

// --- Esquema 3: la persona responsable debe existir en el tenant --------------------------------------------------------------

const assigneeMustExist: ApiRowHandler = async (row: ManifestRow) => {
  const assignee = strict('asignado', ASSIGNEE_CELLS, cell(row, 'asignado'));
  const expect = strict('respuesta', ASSIGNEE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc con la persona ${cell(row, 'asignado')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await createNc(gestor.token, validBody({ severity: 'major', assigneeId: assignee }));
  const checks = answerChecks(expect, result);
  if (expect.assigneeName !== undefined) checks.push(fieldCheck('assigneeName', fieldsOf(result)?.assigneeName, expect.assigneeName));
  return verdict(checks);
};

// --- Esquema 4: una petición rechazada no gasta código -------------------------------------------------------------------------

const rejectedKeepsCode: ApiRowHandler = async (row: ManifestRow) => {
  const rejection = strict('rechazo', REJECTION_CELLS, cell(row, 'rechazo'));
  const expected = `tras la petición rechazada (${cell(row, 'rechazo')}), la siguiente alta válida (severidad minor, descripción de 10 letras a) obtiene NC-013`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const first = await createNc(gestor.token, validBody(rejection));
  const second = await createNc(gestor.token, validBody());
  return verdict([
    ...answerChecks({ status: 422, code: 'validation_failed' }, first),
    check(second.status === 201, 'respuesta a la segunda 201', `respuesta a la segunda ${second.status}`),
    fieldCheck('código de la segunda', fieldsOf(second)?.code, 'NC-013'),
  ]);
};

defineApiRows({
  story: 'US-NC-GESTION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, programAndSeverity],
    [2, descriptionLength],
    [3, assigneeMustExist],
    [4, rejectedKeepsCode],
  ]),
});
