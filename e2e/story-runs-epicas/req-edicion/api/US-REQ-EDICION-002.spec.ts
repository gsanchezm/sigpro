import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, preparationFailed, strict } from '../../support/checks';
import { ACCOUNT_OF, TENANT_A, act, codeCell, expectChecks, loginAs, resetTenants, verdict, type Expect } from './common';

// US-REQ-EDICION-002 — Rechazar un alta con sus motivos (API). Preparación de cada fila: reinicio de alumno01 y token de
// gestor@sigpro.test. Cada celda se traduce con un mapa estricto; «(sin el campo)» es que la clave no se envía.

const letters = (count: number): string => 'a'.repeat(count);

/** Título de la celda: `undefined` si no se envía el campo. */
const TITLE_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['ab', 'ab'],
  ['(dos espacios, abc y un espacio)', '  abc '],
  ['(120 letras a)', letters(120)],
  ['(121 letras a)', letters(121)],
  ['(sin el campo)', undefined],
  ['Requisito de prueba', 'Requisito de prueba'],
]);

/** Programa de la celda: `undefined` si no se envía. */
const PROGRAM_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['PRG-001', 'PRG-001'],
  ['(sin el campo)', undefined],
]);

/** Prioridad de la celda: `undefined` si no se envía. */
const PRIORITY_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['urgent', 'urgent'],
  ['high', 'high'],
  ['(sin el campo)', undefined],
]);

/** Etiquetas de la celda: una lista separada por comas; `undefined` si no se envía. */
const TAGS_OF: ReadonlyMap<string, readonly string[] | undefined> = new Map<string, readonly string[] | undefined>([
  ['(sin el campo)', undefined],
  ['nope', ['nope']],
  ['security, security', ['security', 'security']],
]);

/** Descripción de la celda (HTML o texto): `undefined` si no se envía. */
const DESCRIPTION_OF: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin el campo)', undefined],
  ['(4000 letras a)', letters(4000)],
  ['(4001 letras a)', letters(4001)],
  ['(párrafo con un script)', '<p>Hola<script>alert(1)</script></p>'],
]);

/** Nota de las filas con «required»: la historia pide la clave del catálogo; el esquema devuelve el mensaje por defecto de Zod. */
const REQUIRED_NOTE = 'la historia pide la clave «required»; la API devuelve el mensaje por defecto de Zod para un campo ausente (packages/shared/src/schemas.ts: title y programCode)';

/** Alta con el token dado (gestor en alumno01). */
const create = (token: string, body: Record<string, unknown>) => act('POST', '/requirements', token, body);

/** Inicia sesión como gestor en alumno01 tras reiniciarlo. Devuelve el token, o el resultado de la preparación fallida. */
const gestorToken = async (expected: string): Promise<string | Outcome> => {
  await resetTenants([TENANT_A]);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'gestor@sigpro.test'));
  return session.token ?? preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', session.last);
};

// --- Esquema 1: el título se valida después de recortar sus espacios -----------------------------------------------------------

const RESPUESTA_E1: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con errors.title igual a titleShort', { status: 422, code: 'validation_failed', errors: { title: 'titleShort' } }],
  ['201 con title abc', { status: 201, fields: { title: 'abc' } }],
  ['201 con un título de 120 caracteres', { status: 201, lengths: { title: 120 } }],
  ['422 validation_failed con errors.title igual a titleLong', { status: 422, code: 'validation_failed', errors: { title: 'titleLong' } }],
]);

const titleChecked: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const title = strict('título', TITLE_OF, cell(row, 'titulo'));
  const result = await create(token, { programCode: 'PRG-001', title });
  return verdict(expectChecks(strict('respuesta', RESPUESTA_E1, cell(row, 'respuesta')), result));
};

// --- Esquema 2: un campo obligatorio que falta devuelve el motivo required ------------------------------------------------------

const RESPUESTA_E2: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con errors.title igual a required', { status: 422, code: 'validation_failed', errors: { title: 'required' } }],
  ['422 validation_failed con errors.programCode igual a required', { status: 422, code: 'validation_failed', errors: { programCode: 'required' } }],
]);

const requiredField: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const programa = strict('programa', PROGRAM_OF, cell(row, 'programa'));
  const title = strict('título', TITLE_OF, cell(row, 'titulo'));
  const result = await create(token, { programCode: programa === undefined ? undefined : codeCell(programa), title });
  const checks = expectChecks(strict('respuesta', RESPUESTA_E2, cell(row, 'respuesta')), result);
  return verdict(checks, checks.some((entry) => !entry.ok) ? REQUIRED_NOTE : undefined);
};

// --- Esquema 3: la prioridad, las etiquetas y la descripción se validan o se sanean ----------------------------------------------

const RESPUESTA_E3: ReadonlyMap<string, Expect> = new Map<string, Expect>([
  ['422 validation_failed con un motivo para priority', { status: 422, code: 'validation_failed', motiveFor: 'priority' }],
  ['201 con priority medium, tags vacías y description vacía', { status: 201, fields: { priority: 'medium', tags: [], description: '' } }],
  ['201 con priority high', { status: 201, fields: { priority: 'high' } }],
  ['422 validation_failed con un motivo para tags', { status: 422, code: 'validation_failed', motiveFor: 'tags' }],
  ['201 con tags igual a security', { status: 201, fields: { tags: ['security'] } }],
  ['201 con la descripción recibida', { status: 201, lengths: { description: 4000 } }],
  ['422 validation_failed con errors.description igual a descLong', { status: 422, code: 'validation_failed', errors: { description: 'descLong' } }],
  ['201 con description igual a <p>Hola</p>', { status: 201, fields: { description: '<p>Hola</p>' } }],
]);

const optionalFields: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const token = await gestorToken(expected);
  if (typeof token !== 'string') return token;
  const priority = strict('prioridad', PRIORITY_OF, cell(row, 'prioridad'));
  const tags = strict('etiquetas', TAGS_OF, cell(row, 'etiquetas'));
  const description = strict('descripción', DESCRIPTION_OF, cell(row, 'descripcion'));
  const result = await create(token, { programCode: 'PRG-001', title: 'Requisito de prueba', priority, tags, description });
  return verdict(expectChecks(strict('respuesta', RESPUESTA_E3, cell(row, 'respuesta')), result));
};

defineApiRows({
  story: 'US-REQ-EDICION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, titleChecked],
    [2, requiredField],
    [3, optionalFields],
  ]),
});
