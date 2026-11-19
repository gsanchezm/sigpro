import { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import {
  DOCUMENTOS,
  LINEA,
  compare,
  cuentaOf,
  diffRowAt,
  finish,
  intOf,
  lineOf,
  loginAs,
  publish,
  responseChecks,
  sideCheck,
  tenantDe,
  thenOf,
  type Expected,
  type Stats,
} from './common';

// US-DOC-VERSIONES-004 — Comparar dos versiones por la API: diff alineado y estadísticas. Preparación de cada fila: reinicio de
// alumno01 (y de alumno02 en el Esquema 6) y la cuenta de la fila con su token en su tenant. El diff se lee de la respuesta del
// servidor; el número de la fila es su posición (1 = primera) en `rows`.

const GESTOR = 'gestor@sigpro.test';

/** Estadísticas de la celda «stats» del Esquema 1. */
const STATS: ReadonlyMap<string, Stats> = new Map<string, Stats>([
  ['added 1, removed 0, changed 1, same 17', { added: 1, removed: 0, changed: 1, same: 17 }],
  ['added 3, removed 1, changed 1, same 17', { added: 3, removed: 1, changed: 1, same: 17 }],
  ['added 1, removed 3, changed 1, same 17', { added: 1, removed: 3, changed: 1, same: 17 }],
]);

/** Tipo de fila de la celda «tipo» del Esquema 2 (los valores de `kind` de la API). */
const TIPO: ReadonlyMap<string, string> = new Map<string, string>([
  ['changed', 'changed'],
  ['added', 'added'],
  ['removed', 'removed'],
]);

/** Cadena de consulta de la celda «consulta» del Esquema 3 (la que se envía tal cual). */
const CONSULTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['from=2&to=2', 'from=2&to=2'],
  ['from=2 y sin to', 'from=2'],
  ['from=abc&to=2', 'from=abc&to=2'],
  ['from=1.5&to=2', 'from=1.5&to=2'],
]);

/**
 * Respuesta de la celda «respuesta» de los Esquemas 3 a 6: todos los valores de la columna. Las estadísticas del 200 del Esquema 5
 * son las de la historia (`added 1, removed 0, changed 1, same 17`).
 */
const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['422 validation_failed con el motivo compareSame en la clave to', { status: 422, code: 'validation_failed', motivo: 'compareSame', clave: 'to' }],
  ['422 validation_failed', { status: 422, code: 'validation_failed' }],
  ['404 version_not_found', { status: 404, code: 'version_not_found' }],
  ['404 document_not_found', { status: 404, code: 'document_not_found' }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['200 con stats added 1, removed 0, changed 1, same 17', { status: 200, stats: { added: 1, removed: 0, changed: 1, same: 17 } }],
  ['200 con from 3 y to 4', { status: 200, from: 3, to: 4 }],
]);

// --- Esquema 1: comparar dos versiones devuelve sus estadísticas -------------------------------------------------------------------

const statsOfPair: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const from = intOf(cell(row, 'from'));
  const to = intOf(cell(row, 'to'));
  const stats = strict('stats', STATS, cell(row, 'stats'));
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const result = await compare(TENANT_A, login.token, doc, `from=${from}&to=${to}`);
  return finish(responseChecks(result, { status: 200, from, to, stats }));
};

// --- Esquema 2: una línea cambiada, añadida o eliminada aparece en su fila -------------------------------------------------------

const diffRowOf: ApiRowHandler = async (row): Promise<Outcome> => {
  const expected = thenOf(row);
  const from = intOf(cell(row, 'from'));
  const to = intOf(cell(row, 'to'));
  const position = intOf(cell(row, 'posicion'));
  const kind = strict('tipo', TIPO, cell(row, 'tipo'));
  const left = lineOf(cell(row, 'izquierda'));
  const right = lineOf(cell(row, 'derecha'));
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const result = await compare(TENANT_A, login.token, 'DOC-001', `from=${from}&to=${to}`);
  const at = diffRowAt(result.body, position);
  return finish([
    ...responseChecks(result, { status: 200 }),
    check(at !== undefined && at.kind === kind, `la fila ${position} es de tipo ${kind}`, `la fila ${position} es de tipo ${at?.kind ?? '(sin fila)'}`),
    sideCheck('a la izquierda', at?.left, left),
    sideCheck('a la derecha', at?.right, right),
  ]);
};

// --- Esquema 3: parámetros que faltan, no son enteros o son iguales responden 422 --------------------------------------------------

const invalidParameters: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const query = strict('consulta', CONSULTA, cell(row, 'consulta'));
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const result = await compare(TENANT_A, login.token, doc, query);
  return finish(responseChecks(result, want));
};

// --- Esquema 4: un documento o una versión que no existen responden 404 ----------------------------------------------------------

const missingDocumentOrVersion: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const doc = strict('documento', DOCUMENTOS, cell(row, 'documento'));
  const from = intOf(cell(row, 'from'));
  const to = intOf(cell(row, 'to'));
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const account = cuentaOf(GESTOR);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const result = await compare(TENANT_A, login.token, doc, `from=${from}&to=${to}`);
  return finish(responseChecks(result, want));
};

// --- Esquema 5: un documento restringido solo se compara con un rol que puede verlo -----------------------------------------------

const restrictedDocument: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const login = await loginAs(TENANT_A, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en alumno01`, login.last);
  const result = await compare(TENANT_A, login.token, 'DOC-003', 'from=1&to=2');
  return finish(responseChecks(result, want));
};

// --- Esquema 6: las versiones se buscan en el tenant del token -------------------------------------------------------------------

const versionsOfOwnTenant: ApiRowHandler = async (row) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const want = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A, TENANT_B]);
  // Dado: alumno01 ha publicado la versión 4 de DOC-001 con una línea de texto (la cuenta que publica no la nombra la historia)
  const publisher = cuentaOf('alumno01@sigpro.lab');
  const admin = await loginAs(TENANT_A, publisher);
  if (admin.token === undefined) return preparationFailed(expected, `${publisher.email} inicia sesión en alumno01`, admin.last);
  const published = await publish(TENANT_A, admin.token, 'DOC-001', { lines: [LINEA] });
  if (published.status !== 201) return preparationFailed(expected, 'alumno01 publica la versión 4 de DOC-001', published);
  const tenant = tenantDe(account);
  const login = await loginAs(tenant, account);
  if (login.token === undefined) return preparationFailed(expected, `${account.email} inicia sesión en ${tenant}`, login.last);
  const result = await compare(tenant, login.token, 'DOC-001', 'from=3&to=4');
  return finish(responseChecks(result, want));
};

defineApiRows({
  story: 'US-DOC-VERSIONES-004',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, statsOfPair],
    [2, diffRowOf],
    [3, invalidParameters],
    [4, missingDocumentOrVersion],
    [5, restrictedDocument],
    [6, versionsOfOwnTenant],
  ]),
});
