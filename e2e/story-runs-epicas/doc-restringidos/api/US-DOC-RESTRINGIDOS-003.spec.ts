import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { CUENTA, TENANT_A, answerCheck, codeOf, expectationChecks, finish, idsOf, itemsOfList, jsonOf, listPresentCheck, rawGet, resetTenants, sessionFor, thenOf, type Expected } from './common';

// US-DOC-RESTRINGIDOS-003 — Publicar una versión de un restringido no cambia su clasificación ni su visibilidad. Preparación de cada
// fila: reinicio de alumno01 (DOC-003 vuelve a la versión 2) y, después, admin@sigpro.test (con el segundo factor) publica la versión
// nueva de DOC-003 con el cuerpo de la historia. La publicación debe responder 201 con `version` 3; si no, la fila es preparación fallida.

/** Cuerpo de la publicación que describe la historia: una línea «Contenido de prueba» y la nota «Prueba». */
const PUBLICACION = { lines: ['Contenido de prueba'], note: 'Prueba' };

/** Respuesta esperada de la primera tabla (la ficha de DOC-003 tras publicar). */
const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['200 con classification restricted y version 3', { status: 200, classification: 'restricted', version: 3 }],
  ['403 forbidden, sin datos del documento', { status: 403, code: 'forbidden', sinDatos: true }],
]);

/** Filtro de la segunda tabla → cadena de consulta y lo que la historia exige de la lista (los códigos o el recuento). */
interface Listado {
  readonly query: string;
  readonly count?: number;
  readonly codes?: readonly string[];
  readonly absent?: readonly string[];
}

const FILTRO: ReadonlyMap<string, Listado> = new Map<string, Listado>([
  ['?classification=public', { query: 'classification=public', count: 8, absent: ['DOC-003'] }],
  ['?q=DOC-003', { query: 'q=DOC-003', count: 0 }],
  ['?program=PRG-002', { query: 'program=PRG-002', codes: ['DOC-004'] }],
]);

/**
 * Preparación común: reinicia alumno01 y publica la versión nueva de DOC-003 con admin. Devuelve el fallo si la publicación no
 * responde 201 con `version` 3, o `undefined` si todo sale bien.
 */
const publishVersionOfDoc3 = async (): Promise<{ readonly step: string; readonly result: ApiResult } | undefined> => {
  await resetTenants([TENANT_A]);
  const publisher = await sessionFor('admin');
  if (publisher.token === undefined) return { step: 'admin@sigpro.test inicia sesión en alumno01 (segundo factor)', result: publisher.last };
  const published = await call('POST', '/documents/DOC-003/versions', { tenant: TENANT_A, token: publisher.token, body: PUBLICACION });
  if (published.status !== 201 || field(published.body, 'version') !== 3) {
    return { step: `admin publica una versión nueva de DOC-003 (da ${published.status}, version ${String(field(published.body, 'version'))})`, result: published };
  }
  return undefined;
};

// --- Esquema 1: la ficha del restringido sigue igual de restringida tras publicar ---------------------------------------------

const detailAfterPublish: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const respuesta = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const failure = await publishVersionOfDoc3();
  if (failure !== undefined) return preparationFailed(expected, failure.step, failure.result);
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  const raw = await rawGet('/documents/DOC-003', session.token);
  const checks: Check[] = expectationChecks(raw, respuesta);
  // Regla de la historia: el consultor sigue sin verlo, y su lista no lo incluye (la fila del consultor lo comprueba también)
  if (account === 'consultor') {
    const listed = await rawGet('/documents', session.token);
    const items = itemsOfList(jsonOf(listed.bytes));
    checks.push(listPresentCheck(jsonOf(listed.bytes)));
    checks.push(check(items !== undefined && !idsOf(items).includes('DOC-003'), 'su lista no incluye DOC-003', items === undefined ? 'su lista no se pudo leer' : idsOf(items).includes('DOC-003') ? 'su lista incluye DOC-003' : 'su lista no incluye DOC-003'));
  }
  return finish(checks, { evidence: { cuenta: cell(row, 'cuenta'), estado: raw.status, publicacion: 'versión 3 publicada por admin@sigpro.test' } });
};

// --- Esquema 2: la lista del consultor no incluye el restringido publicado ----------------------------------------------------

const consultorListAfterPublish: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const listing = strict('filtro', FILTRO, cell(row, 'filtro'));
  const failure = await publishVersionOfDoc3();
  if (failure !== undefined) return preparationFailed(expected, failure.step, failure.result);
  const session = await sessionFor('consultor');
  if (session.token === undefined) return preparationFailed(expected, 'consultor@sigpro.test inicia sesión en alumno01', session.last);
  const raw = await rawGet('/documents', session.token, listing.query);
  const body = jsonOf(raw.bytes);
  const items = itemsOfList(body);
  const ids = idsOf(items);
  const conditions = [
    items !== undefined,
    listing.count === undefined || items?.length === listing.count,
    listing.codes === undefined || (ids.length === listing.codes.length && listing.codes.every((code, index) => ids[index] === code)),
    listing.absent === undefined || listing.absent.every((code) => !ids.includes(code)),
    raw.status === 200,
  ];
  const observed = `la lista trae ${items === undefined ? '(sin leer)' : items.length} documentos (${ids.length === 0 ? '(ninguno)' : ids.join(', ')})`;
  return finish(
    [check(conditions.every((ok) => ok), cell(row, 'resultado'), observed), answerCheck(raw.status, codeOf(body), { status: 200 })],
    { evidence: { cuenta: 'consultor@sigpro.test', filtro: cell(row, 'filtro'), estado: raw.status } },
  );
};

defineApiRows({
  story: 'US-DOC-RESTRINGIDOS-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, detailAfterPublish],
    [2, consultorListAfterPublish],
  ]),
});
