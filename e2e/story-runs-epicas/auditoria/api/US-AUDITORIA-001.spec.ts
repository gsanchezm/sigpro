import type { ApiResult } from '../../../story-runs/support/api';
import { cell, check, errorsOf, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { TENANT_A, freshAuditor, intCell, itemsOf, nextCursorOf, readAudit, totalOf, walkAll, type AuditEvent } from './common';
import { verdictOf, shownTotal } from '../verdict';

// US-AUDITORIA-001 — Listar el registro del más reciente al más antiguo, en páginas por cursor (API). Preparación de cada fila: el
// caos de alumno01 apagado (lo comprueba el marco), reinicio del tenant con el token de alumno01@sigpro.lab y auditor@sigpro.test
// con su accessToken. El total de la semilla es 130 y el primero, AL-130: se comprueba en cada respuesta, no se da por hecho.

const RECENT_FIRST = 'AL-001';
const SEED_TOTAL = 130;

/** Consultas de los Esquemas 1 y 2 (texto de la celda → parámetros de la petición; `''` = sin parámetros). */
const QUERIES: ReadonlyMap<string, string> = new Map<string, string>([
  ['(sin parámetros)', ''],
  ['limit=5', 'limit=5'],
  ['limit=0', 'limit=0'],
  ['limit=500', 'limit=500'],
  ['limit=20', 'limit=20'],
  ['limit=50', 'limit=50'],
  ['limit=100', 'limit=100'],
]);

/** «un texto no vacío»: el valor de `nextCursor` que la historia no fija más allá de no estar vacío. */
const NEXT_CURSOR: ReadonlyMap<string, (cursor: string | null | undefined) => boolean> = new Map([
  ['un texto no vacío', (cursor: string | null | undefined) => typeof cursor === 'string' && cursor !== ''],
]);

/** Esquema 1: la página trae los eventos que pide el límite, del más reciente al más antiguo. */
const firstPage: ApiRowHandler = async (row) => {
  const query = strict('consulta', QUERIES, cell(row, 'consulta'));
  const eventos = intCell(cell(row, 'eventos'));
  const ultimo = cell(row, 'ultimo');
  const cursorIsText = strict('nextCursor', NEXT_CURSOR, cell(row, 'nextCursor'));
  const expected = `200 con ${eventos} eventos en items; el último es ${ultimo}; total 130; nextCursor no vacío`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const items = itemsOf(result) ?? [];
  const last = items[items.length - 1];
  const cursor = nextCursorOf(result);
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(items.length === eventos, `${eventos} eventos en items`, `${items.length} eventos en items`),
    check(last?.id === ultimo, `el último evento de items es ${ultimo}`, `el último evento de items es ${last?.id ?? '(ninguno)'}`),
    check(totalOf(result) === SEED_TOTAL, 'total vale 130', `total vale ${shownTotal(totalOf(result))}`),
    check(cursorIsText(cursor), 'nextCursor es un texto no vacío', cursor === null ? 'nextCursor es null' : `nextCursor vale «${String(cursor)}»`),
  ]);
};

/** Esquema 2: recorrer las páginas con el cursor entrega cada evento una sola vez. */
const walkEvents: ApiRowHandler = async (row) => {
  const query = strict('consulta', QUERIES, cell(row, 'consulta'));
  const paginas = intCell(cell(row, 'paginas'));
  const eventos = intCell(cell(row, 'eventos'));
  const expected = `${paginas} páginas y ${eventos} eventos distintos; el último recibido es ${RECENT_FIRST}; total 130 en cada página`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const walk = await walkAll(login.token, query);
  const distinct = new Set(walk.received.map((event) => event.id)).size;
  const lastReceived = walk.received[walk.received.length - 1];
  return verdictOf([
    check(walk.ended, 'se llega a nextCursor null', walk.ended ? 'se llega a nextCursor null' : `no se llega a null (estados ${walk.statuses.join(', ')})`),
    check(walk.pages === paginas, `${paginas} páginas`, `${walk.pages} páginas`),
    check(distinct === eventos && walk.received.length === eventos, `${eventos} eventos distintos, sin repetidos`, `${distinct} eventos distintos entre ${walk.received.length} recibidos`),
    check(lastReceived?.id === RECENT_FIRST, `el último evento recibido es ${RECENT_FIRST}`, `el último evento recibido es ${lastReceived?.id ?? '(ninguno)'}`),
    check(walk.totals.length > 0 && walk.totals.every((total) => total === SEED_TOTAL), 'total vale 130 en cada página', `total por página: ${walk.totals.map((total) => String(total)).join(', ')}`),
  ]);
};

type Reading = (result: ApiResult) => readonly Check[];

/** Esquema 3, columna «respuesta»: la forma exacta de cada celda y lo que hay que comprobar en la respuesta. */
const CURSOR_RESPONSES: ReadonlyMap<string, Reading> = new Map<string, Reading>([
  [
    '422 validation_failed',
    (result) => [responseCheck(result, { status: 422, code: 'validation_failed' }), check((itemsOf(result)?.length ?? 0) === 0, 'no devuelve eventos', `devuelve ${itemsOf(result)?.length ?? 0} eventos`)],
  ],
  ['200 con 20 eventos en items', (result) => [responseCheck(result, { status: 200 }), check((itemsOf(result)?.length ?? 0) === 20, '20 eventos en items', `${itemsOf(result)?.length ?? 0} eventos en items`)]],
]);

/** Esquema 3, columna «motivo»: `badCursor` se lee de `errors.cursor`; «(ninguno)» no añade comprobación. */
const CURSOR_REASONS: ReadonlyMap<string, (result: ApiResult) => Check | undefined> = new Map<string, (result: ApiResult) => Check | undefined>([
  ['badCursor', (result) => check(errorsOf(result).cursor === 'badCursor', 'errors.cursor igual a badCursor', `errors.cursor vale ${String(errorsOf(result).cursor)}`)],
  ['(ninguno)', () => undefined],
]);

/** Esquema 3: un cursor que la API no ha devuelto no lista eventos. */
const badCursor: ApiRowHandler = async (row) => {
  const query = strict('consulta', new Map([['cursor=xyz', 'cursor=xyz'], ['cursor=', 'cursor=']]), cell(row, 'consulta'));
  const respuesta = cell(row, 'respuesta');
  const motivo = cell(row, 'motivo');
  const expected = `${respuesta}; motivo ${motivo}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const reasonCheck = strict('motivo', CURSOR_REASONS, motivo)(result);
  return verdictOf([...strict('respuesta', CURSOR_RESPONSES, respuesta)(result), ...(reasonCheck === undefined ? [] : [reasonCheck])]);
};

/** Esquema 4, columna «campo»: cómo se lee cada dato del primer evento. */
const FIELDS: ReadonlyMap<string, (event: AuditEvent) => unknown> = new Map<string, (event: AuditEvent) => unknown>([
  ['actorName', (event) => event.actorName],
  ['action', (event) => event.action],
  ['entityId', (event) => event.entityId],
  ['diff.title', (event) => event.diff?.title],
]);

/** Esquema 4: el primer evento trae sus datos. */
const firstEvent: ApiRowHandler = async (row) => {
  const campo = cell(row, 'campo');
  const valor = cell(row, 'valor');
  const expected = `el primer evento tiene ${campo} igual a ${valor}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token);
  const first = itemsOf(result)?.[0];
  if (first === undefined) return verdictOf([check(false, expected, 'sin primer evento en la respuesta')]);
  const read = strict('campo', FIELDS, campo)(first);
  const observed = read === null ? 'null' : read === undefined ? '(sin valor)' : String(read);
  return verdictOf([check(read !== undefined && read !== null && String(read) === valor, `${campo} igual a ${valor}`, `${campo} ${observed}`)]);
};

defineApiRows({
  story: 'US-AUDITORIA-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, firstPage],
    [2, walkEvents],
    [3, badCursor],
    [4, firstEvent],
  ]),
});
