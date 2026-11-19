import { field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { ACCOUNT_CELLS, TENANT_A, actorOf, answerChecks, commentNc, detailNc, fieldCheck, fieldsOf, resetTenants, sameFields, showValue, verdict, type Expect } from './common';

// US-NC-GESTION-004 — Comentarios de una no conformidad por la API (POST /api/nc/:code/comments). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; después la cuenta de la fila inicia sesión en alumno01. El texto se recorta de los espacios
// de los extremos; «(N letras a)» son N letras «a» seguidas. El conteo de comentarios se lee del detalle con gestor@sigpro.test.

const GESTOR = DEMO.gestor;
const GESTOR_EMAIL = 'gestor@sigpro.test';
const COMMENT_BODY = 'Revisión pendiente de la acción correctiva';

const AUTHOR_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Alumno 01', 'Alumno 01'],
  ['Javier Ortega', 'Javier Ortega'],
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Andrés Molina', 'Andrés Molina'],
]);

/** Texto del comentario tal como lo escribe la celda (sin las comillas de la celda). */
const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(3 espacios)', '   '],
  ['(1 letra a)', 'a'],
  ['(999 letras a)', 'a'.repeat(999)],
  ['(1000 letras a)', 'a'.repeat(1000)],
  ['(1001 letras a)', 'a'.repeat(1001)],
]);

/** Respuesta de la celda de texto: 201 (y, si la historia lo nombra, el cuerpo guardado) o 422 con su motivo en `body`. */
const TEXT_RESPONSE_CELLS: ReadonlyMap<string, Expect & { readonly body?: string }> = new Map<string, Expect & { readonly body?: string }>([
  ['422 validation_failed con el motivo commentRequired en body', { status: 422, code: 'validation_failed', errorField: 'body', errorKey: 'commentRequired' }],
  ['201 con body a', { status: 201, body: 'a' }],
  ['201', { status: 201 }],
  ['422 validation_failed con el motivo commentLong en body', { status: 422, code: 'validation_failed', errorField: 'body', errorKey: 'commentLong' }],
]);

/** Cuerpos JSON de la celda «cuerpo» (el literal de la historia). */
const BODY_CELLS: ReadonlyMap<string, Readonly<Record<string, unknown>>> = new Map<string, Readonly<Record<string, unknown>>>([
  ['{"body": "Comentario rápido de prueba"}', { body: 'Comentario rápido de prueba' }],
  ['{"body": "Comentario rápido de prueba", "kind": "quick"}', { body: 'Comentario rápido de prueba', kind: 'quick' }],
]);

const KIND_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['comment', 'comment'],
  ['quick', 'quick'],
]);

const MISSING_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([['NC-999', 'NC-999']]);

/** Número de comentarios de una no conformidad leído del detalle; `undefined` si la lectura no llega. */
const commentCountOf = async (token: string | undefined, code: string): Promise<number | undefined> => {
  if (token === undefined) return undefined;
  const count = field((await detailNc(token, code)).body, 'commentCount');
  return typeof count === 'number' ? count : undefined;
};

// --- Esquema 1: cada rol añade un comentario con su nombre -------------------------------------------------------------------

const eachRoleComments: ApiRowHandler = async (row: ManifestRow) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const author = strict('autor', AUTHOR_CELLS, cell(row, 'autor'));
  const expected = `${cell(row, 'correo')} añade un comentario a NC-003 → 201 con authorName ${cell(row, 'autor')} y kind comment; NC-003 pasa a tener 4 comentarios`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);

  // La lectura de la NC antes y después (con gestor@sigpro.test): el comentario no cambia ni el estado ni la severidad
  const gestor = await actorOf(GESTOR);
  const before = gestor.token === undefined ? undefined : fieldsOf(await detailNc(gestor.token, 'NC-003'));
  const created = await commentNc(actor.token, 'NC-003', { body: COMMENT_BODY });
  const after = gestor.token === undefined ? undefined : fieldsOf(await detailNc(gestor.token, 'NC-003'));
  const total = await commentCountOf(gestor.token, 'NC-003');
  const unchanged = ['severity', 'state', 'assigneeId', 'assigneeName', 'description'] as const;
  const createdAt = field(created.body, 'createdAt');
  return verdict([
    check(created.status === 201, 'respuesta 201', `respuesta ${created.status}`),
    fieldCheck('authorName', field(created.body, 'authorName'), author),
    fieldCheck('kind', field(created.body, 'kind'), 'comment'),
    fieldCheck('commentCount de NC-003 después', total, 4),
    check(typeof field(created.body, 'id') === 'string' && field(created.body, 'id') !== '', 'id del comentario', `id ${showValue(field(created.body, 'id'))}`),
    fieldCheck('authorId del comentario (la persona que inicia sesión)', field(created.body, 'authorId'), actor.id),
    check(typeof createdAt === 'string' && !Number.isNaN(Date.parse(createdAt)), 'createdAt del comentario como fecha ISO', `createdAt ${showValue(createdAt)}`),
    check(sameFields(before, after, unchanged), 'NC-003 sin cambios en severidad, estado, asignado y descripción', unchanged.map((key) => `${key} ${showValue(before?.[key])}→${showValue(after?.[key])}`).join('; ')),
    fieldCheck('severity de NC-003 después', after?.severity, 'critical'),
    fieldCheck('state de NC-003 después', after?.state, 'corrective_action'),
  ]);
};

// --- Esquema 2: el texto del comentario tiene entre uno y mil caracteres tras recortar los espacios ----------------------

const textLength: ApiRowHandler = async (row: ManifestRow) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const expect = strict('respuesta', TEXT_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc/NC-003/comments con el texto ${cell(row, 'texto')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const result: ApiResult = await commentNc(gestor.token, 'NC-003', { body: text });
  const checks = answerChecks(expect, result);
  // Un comentario aceptado guarda el texto recortado de los espacios de los extremos
  if (expect.status === 201) checks.push(fieldCheck('body guardado (recortado)', field(result.body, 'body'), text.trim()));
  if (expect.body !== undefined) checks.push(fieldCheck('body', field(result.body, 'body'), expect.body));
  return verdict(checks);
};

// --- Esquema 3: el comentario rápido se registra como tal ----------------------------------------------------------------------

const quickKind: ApiRowHandler = async (row: ManifestRow) => {
  const body = strict('cuerpo', BODY_CELLS, cell(row, 'cuerpo'));
  const kind = strict('tipo', KIND_CELLS, cell(row, 'tipo'));
  const expected = `POST /api/nc/NC-003/comments con ${cell(row, 'cuerpo')} → 201 con kind ${kind}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const created = await commentNc(gestor.token, 'NC-003', body);
  return verdict([check(created.status === 201, 'respuesta 201', `respuesta ${created.status}`), fieldCheck('kind', field(created.body, 'kind'), kind)]);
};

// --- Esquema 4: una no conformidad inexistente no admite comentarios -----------------------------------------------------------

const missingNc: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('codigo', MISSING_CODE_CELLS, cell(row, 'codigo'));
  const expected = `POST /api/nc/${code}/comments → 404 nc_not_found`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const created = await commentNc(gestor.token, code, { body: 'Comentario de prueba' });
  return verdict(answerChecks({ status: 404, code: 'nc_not_found' }, created));
};

defineApiRows({
  story: 'US-NC-GESTION-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachRoleComments],
    [2, textLength],
    [3, quickKind],
    [4, missingNc],
  ]),
});
