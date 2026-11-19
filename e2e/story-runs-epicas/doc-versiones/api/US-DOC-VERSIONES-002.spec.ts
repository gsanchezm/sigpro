import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { LINEA, cuentaOf, documentOf, finish, intOf, letras, lineas, loginAs, publish, reasonPresent, responseChecks, thenOf, versionMismatch, type Expected } from './common';

// US-DOC-VERSIONES-002 — Límites del contenido y de la nota de una versión nueva por la API. Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test y lectura de la versión de partida del documento de la fila. Una petición
// rechazada no cambia la última versión: se vuelve a leer la ficha tras cada envío.

const GESTOR = 'gestor@sigpro.test';
const NOTA = 'Revisión';

/** Cuerpo del contenido de la celda «contenido»: la lista de líneas que envía la fila. */
const CONTENIDO: ReadonlyMap<string, () => string[]> = new Map<string, () => string[]>([
  ['lines (lista sin líneas)', () => []],
  ['lines (una línea de texto)', () => [LINEA]],
  ['lines (80 líneas de texto)', () => lineas(80)],
  ['lines (81 líneas de texto)', () => lineas(81)],
  ['lines (una línea de 199 letras a)', () => [letras(199)]],
  ['lines (una línea de 200 letras a)', () => [letras(200)]],
  ['lines (una línea de 201 letras a)', () => [letras(201)]],
  ['lines (tres líneas: la segunda de 201 letras a)', () => ['Línea 1', letras(201), 'Línea 3']],
]);

/**
 * Respuesta de la celda «respuesta». Un 201 trae la versión nueva; un 422 trae el motivo y la clave de `errors`. Todos los valores de
 * la columna están aquí: una respuesta no listada LANZA.
 */
const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['422 validation_failed con el motivo linesRequired en la clave lines', { status: 422, code: 'validation_failed', motivo: 'linesRequired', clave: 'lines' }],
  ['201 con version 4', { status: 201, version: 4 }],
  ['422 validation_failed con el motivo linesMax en la clave lines', { status: 422, code: 'validation_failed', motivo: 'linesMax', clave: 'lines' }],
  ['201 con version 2', { status: 201, version: 2 }],
  ['422 validation_failed con el motivo lineLong en la clave lines.0', { status: 422, code: 'validation_failed', motivo: 'lineLong', clave: 'lines.0' }],
  ['422 validation_failed con el motivo lineLong en la clave lines.1', { status: 422, code: 'validation_failed', motivo: 'lineLong', clave: 'lines.1' }],
  ['422 validation_failed con el motivo noteLong en la clave note', { status: 422, code: 'validation_failed', motivo: 'noteLong', clave: 'note' }],
]);

/** Nota de la celda «nota» del Esquema 3: el número de letras que indica la celda. */
const NOTA_LARGA: ReadonlyMap<string, string> = new Map<string, string>([
  ['(199 letras a)', letras(199)],
  ['(200 letras a)', letras(200)],
  ['(201 letras a)', letras(201)],
]);

/** Cuerpo de la celda «cuerpo» del Esquema 4: campos del tipo equivocado. */
const CUERPO_TIPO: ReadonlyMap<string, Record<string, unknown>> = new Map<string, Record<string, unknown>>([
  ['lines es el texto «Una línea»', { lines: 'Una línea', note: NOTA }],
  ['lines es una lista con «Línea 1» y el número 5', { lines: ['Línea 1', 5], note: NOTA }],
  ['note es el número 5', { lines: [LINEA], note: 5 }],
  ['falta el campo lines', { note: NOTA }],
]);

/**
 * Publica con gestor@sigpro.test en alumno01 desde la versión `before` y comprueba la respuesta y la última versión después. Si la
 * respuesta es un 422, la clave de `errors` debe traer el motivo de la historia (lo exige `responseChecks`).
 */
const publicarYVerificar = async (expected: string, doc: string, before: number, body: unknown, want: Expected, last: number): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const start = await documentOf(TENANT_A, login.token, doc);
  const mismatch = versionMismatch(doc, before, start);
  if (mismatch !== undefined) return preparationFailed(expected, mismatch, start.result);
  const sent = await publish(TENANT_A, login.token, doc, body);
  const after = await documentOf(TENANT_A, login.token, doc);
  return finish(
    [
      ...responseChecks(sent, want),
      check(after.version === last, `la última versión de ${doc} es la ${last}`, `la última versión de ${doc} es la ${String(after.version)}`),
    ],
    { evidence: { cuerpoRespuesta: JSON.stringify(sent.body).slice(0, 300) } },
  );
};

// --- Esquema 1: el contenido admite de 1 a 80 líneas ------------------------------------------------------------------------------

const linesCount: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const lines = strict('contenido', CONTENIDO, cell(row, 'contenido'))();
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const last = intOf(cell(row, 'version_final'));
  return publicarYVerificar(expected, 'DOC-001', 3, { lines, note: NOTA }, want, last);
};

// --- Esquema 2: cada línea admite hasta 200 caracteres -----------------------------------------------------------------------------

const lineLength: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const lines = strict('contenido', CONTENIDO, cell(row, 'contenido'))();
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const last = intOf(cell(row, 'version_final'));
  return publicarYVerificar(expected, 'DOC-002', 1, { lines, note: NOTA }, want, last);
};

// --- Esquema 3: la nota admite hasta 200 caracteres sin contar los espacios de los extremos ----------------------------------------

const noteLength: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const note = strict('nota', NOTA_LARGA, cell(row, 'nota'));
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const last = intOf(cell(row, 'version_final'));
  return publicarYVerificar(expected, 'DOC-002', 1, { lines: [LINEA], note }, want, last);
};

// --- Esquema 4: un campo de otro tipo responde 422 con ese campo -------------------------------------------------------------------

const wrongType: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const body = strict('cuerpo', CUERPO_TIPO, cell(row, 'cuerpo'));
  const campo = cell(row, 'campo');
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const start = await documentOf(TENANT_A, login.token, 'DOC-001');
  const mismatch = versionMismatch('DOC-001', 3, start);
  if (mismatch !== undefined) return preparationFailed(expected, mismatch, start.result);
  const sent = await publish(TENANT_A, login.token, 'DOC-001', body);
  const after = await documentOf(TENANT_A, login.token, 'DOC-001');
  return finish(
    [
      ...responseChecks(sent, { status: 422, code: 'validation_failed' }),
      reasonPresent(sent, campo),
      check(after.version === 3, 'la última versión de DOC-001 sigue siendo la 3', `la última versión de DOC-001 es la ${String(after.version)}`),
    ],
    { evidence: { errors: JSON.stringify(sent.body).slice(0, 300) } },
  );
};

defineApiRows({
  story: 'US-DOC-VERSIONES-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, linesCount],
    [2, lineLength],
    [3, noteLength],
    [4, wrongType],
  ]),
});
