import { field } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_CELLS, ROLE_CELLS, TENANT_A, actorOf, answerChecks, createNc, fieldCheck, fieldsOf, itemsOf, listNc, resetTenants, showValue, verdict, type Expect } from './common';

// US-NC-GESTION-001 — Alta de una no conformidad por la API (POST /api/nc). Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador; después, la cuenta de la fila inicia sesión en alumno01. Las altas previas de una fila van con el token de
// gestor@sigpro.test. Las celdas se traducen con mapas estrictos; el texto (10 letras a) se escribe como diez letras «a».

const TEN_A = 'a'.repeat(10);

const SEVERITY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['minor', 'minor'],
  ['major', 'major'],
  ['critical', 'critical'],
]);

/** Persona que se envía: `undefined` cuando la celda dice «(sin el campo)» (el cuerpo no lleva `assigneeId`). */
const ASSIGNEE_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin el campo)', undefined],
  ['u3', 'u3'],
  ['u4', 'u4'],
]);

/** Lo que la historia espera de la persona responsable en la respuesta 201 (`null` = sin asignar). */
interface AssigneeExpect {
  readonly status: number;
  readonly assigneeId: string | null;
  readonly assigneeName: string | null;
}

const ASSIGNEE_RESPONSE_CELLS: ReadonlyMap<string, AssigneeExpect> = new Map<string, AssigneeExpect>([
  ['201 con assigneeId null y assigneeName null', { status: 201, assigneeId: null, assigneeName: null }],
  ['201 con assigneeId u3 y assigneeName Lucía Fernández', { status: 201, assigneeId: 'u3', assigneeName: 'Lucía Fernández' }],
  ['201 con assigneeId u4 y assigneeName Andrés Molina', { status: 201, assigneeId: 'u4', assigneeName: 'Andrés Molina' }],
]);

const CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-013', 'NC-013'],
  ['NC-014', 'NC-014'],
  ['NC-015', 'NC-015'],
]);

const ALTAS_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['1', 1],
  ['2', 2],
]);

/** Cabecera Authorization de la celda: sin cabecera, o el token inventado que se envía con `Bearer`. */
const AUTH_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera Authorization)', undefined],
  ['Bearer token-inventado', 'token-inventado'],
]);

const RESPONSE_CELLS: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
]);

const GESTOR = DEMO.gestor;

/** Cuerpo válido del alta (programa PRG-001, descripción de diez letras). La severidad y la persona se pasan aparte. */
const body = (severity: string, assigneeId?: string): Record<string, unknown> => ({
  programCode: 'PRG-001',
  severity,
  description: TEN_A,
  ...(assigneeId === undefined ? {} : { assigneeId }),
});

// --- Esquema 1: cada rol del tenant abre una no conformidad ---------------------------------------------------------------------

const eachRole: ApiRowHandler = async (row: ManifestRow) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const role = strict('rol', ROLE_CELLS, cell(row, 'rol'));
  const expected = `en alumno01, recién reiniciado, ${cell(row, 'correo')} con el rol ${cell(row, 'rol')} inicia sesión; POST /api/nc → 201 con código NC-013, estado open y programa PRG-001`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);

  const created = await createNc(actor.token, body('major'));
  const fields = fieldsOf(created);
  const checks: Check[] = [
    check(actor.role === role, `rol ${role} en la respuesta del login`, `rol ${showValue(actor.role)} en la respuesta del login`),
    check(created.status === 201, 'respuesta 201', `respuesta ${created.status}`),
    fieldCheck('código', fields?.code, 'NC-013'),
    fieldCheck('estado', fields?.state, 'open'),
    fieldCheck('programa', fields?.programCode, 'PRG-001'),
    fieldCheck('commentCount', fields?.commentCount, 0),
    fieldCheck('testRunId', fields?.testRunId, null),
    fieldCheck('assigneeId', fields?.assigneeId, null),
    check(typeof fields?.programName === 'string' && fields.programName !== '', 'programName con el nombre del programa', `programName ${showValue(fields?.programName)}`),
  ];
  return verdict(checks);
};

// --- Esquema 2: la severidad y la persona responsable iniciales se guardan como se envían --------------------------------------

const initialSeverityAndAssignee: ApiRowHandler = async (row: ManifestRow) => {
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const assigneeSent = strict('asignado', ASSIGNEE_CELLS, cell(row, 'asignado'));
  const expect = strict('respuesta', ASSIGNEE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc con severidad ${severity} y persona ${cell(row, 'asignado')} → ${cell(row, 'respuesta')}; la severidad se guarda como se envía`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);

  const payload = assigneeSent === undefined ? body(severity) : body(severity, assigneeSent);
  const created = await createNc(gestor.token, payload);
  const fields = fieldsOf(created);
  return verdict([
    check(created.status === expect.status, `respuesta ${expect.status}`, `respuesta ${created.status}`),
    fieldCheck('severity', fields?.severity, severity),
    fieldCheck('assigneeId', fields?.assigneeId, expect.assigneeId),
    fieldCheck('assigneeName', fields?.assigneeName, expect.assigneeName),
  ]);
};

// --- Esquema 3: cada alta toma el código siguiente al último del tenant -------------------------------------------------------

const nextCode: ApiRowHandler = async (row: ManifestRow) => {
  const previous = strict('altas_previas', ALTAS_CELLS, cell(row, 'altas_previas'));
  const code = strict('codigo', CODE_CELLS, cell(row, 'codigo'));
  const expected = `tras ${cell(row, 'altas_previas')} altas previas, POST /api/nc → 201 con el código ${cell(row, 'codigo')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR.email} inicia sesión con POST /api/auth/login`, gestor.last);
  for (let index = 0; index < previous; index += 1) {
    const prior = await createNc(gestor.token, body('minor'));
    if (prior.status !== 201) return preparationFailed(expected, `alta previa ${index + 1} con POST /api/nc`, prior);
  }

  const created = await createNc(gestor.token, body('minor'));
  return verdict([check(created.status === 201, 'respuesta 201', `respuesta ${created.status}`), fieldCheck('código', fieldsOf(created)?.code, code)]);
};

// --- Esquema 4: sin un token válido no se abre ninguna no conformidad --------------------------------------------------------

const withoutValidToken: ApiRowHandler = async (row: ManifestRow) => {
  const token = strict('autorizacion', AUTH_CELLS, cell(row, 'autorizacion'));
  const expect = strict('respuesta', RESPONSE_CELLS, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const created = await createNc(token, body('minor'));
  const gestor = await actorOf(GESTOR);
  const listed = gestor.token === undefined ? undefined : await listNc(gestor.token);
  const items = listed === undefined ? undefined : itemsOf(listed.body).length;
  const totalAll = listed === undefined ? undefined : field(listed.body, 'totalAll');
  return verdict([
    ...answerChecks(expect, created),
    check(listed !== undefined && listed.status === 200, 'GET /api/nc responde 200 con el token del gestor', listed === undefined ? '(sin token de gestor)' : `GET /api/nc responde ${listed.status}`),
    check(items === 12, 'GET /api/nc con 12 no conformidades en items', `items: ${showValue(items)}`),
    check(totalAll === 12, 'GET /api/nc con totalAll 12', `totalAll: ${showValue(totalAll)}`),
  ]);
};

defineApiRows({
  story: 'US-NC-GESTION-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachRole],
    [2, initialSeverityAndAssignee],
    [3, nextCode],
    [4, withoutValidToken],
  ]),
});

