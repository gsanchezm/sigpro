import { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { DOCUMENTOS, LINEA, cuentaOf, documentOf, finish, intOf, loginAs, publish, responseChecks, tenantDe, thenOf, type Expected } from './common';

// US-DOC-VERSIONES-003 — Permiso para publicar, orden de las comprobaciones y aislamiento por tenant. Preparación de cada fila:
// reinicio de los tenants que usa la fila y, después, la cuenta de la fila con su token en su propio tenant. El cuerpo por defecto
// lleva una línea de texto y la nota «Revisión»; el de «lista sin líneas» lleva `lines` vacío.

const NOTA = 'Revisión';

/** Respuesta de la celda «respuesta». Todos los valores de la columna están aquí: una respuesta no listada LANZA. */
const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['201 con version 4', { status: 201, version: 4 }],
  ['201 con version 3', { status: 201, version: 3 }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['422 validation_failed', { status: 422, code: 'validation_failed' }],
  ['404 document_not_found', { status: 404, code: 'document_not_found' }],
]);

/** Cuerpo de la celda «cuerpo» del Esquema 2 (sin nota: la historia no la menciona en ese Esquema). */
const CUERPO: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['lines (lista sin líneas)', { lines: [] }],
  ['lines (una línea de texto)', { lines: [LINEA] }],
]);

/** Publica con la cuenta de la fila en alumno01 y comprueba la respuesta frente a la historia. */
const publishAs = async (expected: string, accountText: string, doc: string, body: unknown, want: Expected): Promise<Outcome> => {
  await resetTenants([TENANT_A]);
  const account = cuentaOf(accountText);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const sent = await publish(TENANT_A, login.token, doc, body);
  return finish(responseChecks(sent, want), { evidence: { cuerpoRespuesta: JSON.stringify(sent.body).slice(0, 300) } });
};

// --- Esquema 1: solo admin y gestor de programa publican una versión ---------------------------------------------------------------

const onlyPublishers: ApiRowHandler = async (row) =>
  publishAs(thenOf(row), cell(row, 'cuenta'), strict('documento', DOCUMENTOS, cell(row, 'documento')), { lines: [LINEA], note: NOTA }, strict('respuesta', RESPUESTA, cell(row, 'respuesta')));

// --- Esquema 2: el rol se comprueba antes que el cuerpo, y el cuerpo antes que el documento ----------------------------------------

const roleBodyDocumentOrder: ApiRowHandler = async (row) =>
  publishAs(thenOf(row), cell(row, 'cuenta'), strict('documento', DOCUMENTOS, cell(row, 'documento')), strict('cuerpo', CUERPO, cell(row, 'cuerpo')), strict('respuesta', RESPUESTA, cell(row, 'respuesta')));

// --- Esquema 3: publicar en un tenant no cambia el documento del otro --------------------------------------------------------------

const isolatedTenants: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const publisher = cuentaOf(cell(row, 'cuenta_publica'));
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const reader = cuentaOf(cell(row, 'cuenta_consulta'));
  const version = intOf(cell(row, 'version'));
  await resetTenants([TENANT_A, TENANT_B]);
  const pub = await loginAs(tenantDe(publisher), publisher);
  if (pub.token === undefined) return preparationFailed(expected, `${publisher.email} inicia sesión en ${tenantDe(publisher)}`, pub.last);
  const read = await loginAs(tenantDe(reader), reader);
  if (read.token === undefined) return preparationFailed(expected, `${reader.email} inicia sesión en ${tenantDe(reader)}`, read.last);
  // «Cuando»: la publicación de la fila tiene que salir bien; si no, la lectura de la otra cuenta no prueba nada
  const published = await publish(tenantDe(publisher), pub.token, doc, { lines: [LINEA] });
  const seen = await documentOf(tenantDe(reader), read.token, doc);
  return finish([
    check(published.status === 201, `${publisher.email} publica una versión en ${doc} (201)`, `${publisher.email} publica una versión en ${doc} (${published.status})`),
    check(seen.version === version, `${reader.email} ve ${doc} en la versión ${version}`, `${reader.email} ve ${doc} en la versión ${String(seen.version)}`),
  ]);
};

defineApiRows({
  story: 'US-DOC-VERSIONES-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, onlyPublishers],
    [2, roleBodyDocumentOrder],
    [3, isolatedTenants],
  ]),
});
