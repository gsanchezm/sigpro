import { cell, check, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { TENANT_A, freshAuditor, intCell, itemsOf, joinQuery, nextCursorOf, readAudit, totalOf } from './common';
import { verdictOf, shownTotal } from '../verdict';

// US-AUDITORIA-002 — Filtros del registro por entidad, por rango de días y por texto (API). Preparación de cada fila: la de
// US-AUDITORIA-001 (alumno01 reiniciado y auditor@sigpro.test con su accessToken). Los totales de la semilla salen de la historia
// y se contrastan con apps/api/src/seed/data.ts en el informe; aquí se comparan con lo que devuelve la API.

/** Fechas de la semilla que cita la historia: su primer y su último evento (contraste de la nota de la fila 4). */
const FILTER_NOTE_DATES = 'Fechas de la semilla: AL-001 es 2026-01-06T11:30:00.000Z y AL-130 es 2026-01-19T22:00:00.000Z.';

/** Entidad de cada consulta de la columna «consulta» del Esquema 1. */
const ENTITY_QUERIES: ReadonlyMap<string, { readonly query: string; readonly entity: string }> = new Map([
  ['entity=program', { query: 'entity=program', entity: 'program' }],
  ['entity=requirement', { query: 'entity=requirement', entity: 'requirement' }],
  ['entity=nc', { query: 'entity=nc', entity: 'nc' }],
]);

/** Esquema 1: el filtro de entidad deja solo los eventos de esa entidad (y su total). */
const entityFilter: ApiRowHandler = async (row) => {
  const { query, entity } = strict('consulta', ENTITY_QUERIES, cell(row, 'consulta'));
  const eventos = intCell(cell(row, 'eventos'));
  const total = intCell(cell(row, 'total'));
  const expected = `200 con ${eventos} eventos en items; total ${total}; todos de la entidad ${entity}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const items = itemsOf(result) ?? [];
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(items.length === eventos, `${eventos} eventos en items`, `${items.length} eventos en items`),
    check(totalOf(result) === total, `total vale ${total}`, `total vale ${shownTotal(totalOf(result))}`),
    check(items.every((item) => item.entity === entity), `todos los eventos son de la entidad ${entity}`, `entidades de items: ${[...new Set(items.map((item) => item.entity))].join(', ') || '(ninguna)'}`),
  ]);
};

/** Esquema 2: el límite de la página y el cursor respetan el total del filtro (`entity=testrun`). */
const LIMITS: ReadonlyMap<string, string> = new Map([
  ['12', '12'],
  ['13', '13'],
  ['14', '14'],
]);
const CURSOR: ReadonlyMap<string, (cursor: string | null | undefined) => boolean> = new Map([
  ['un texto no vacío', (cursor: string | null | undefined) => typeof cursor === 'string' && cursor !== ''],
  ['null', (cursor: string | null | undefined) => cursor === null],
]);

const pageLimit: ApiRowHandler = async (row) => {
  const limit = strict('limite', LIMITS, cell(row, 'limite'));
  const eventos = intCell(cell(row, 'eventos'));
  const cursorIs = strict('nextCursor', CURSOR, cell(row, 'nextCursor'));
  const expected = `entity=testrun con limit ${limit}: ${eventos} eventos en items; nextCursor ${cell(row, 'nextCursor')}; total 13`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, joinQuery('entity=testrun', `limit=${limit}`));
  const items = itemsOf(result) ?? [];
  const cursor = nextCursorOf(result);
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(items.length === eventos, `${eventos} eventos en items`, `${items.length} eventos en items`),
    check(cursorIs(cursor), `nextCursor ${cell(row, 'nextCursor')}`, cursor === null ? 'nextCursor es null' : `nextCursor vale «${String(cursor)}»`),
    check(totalOf(result) === 13, 'total vale 13', `total vale ${shownTotal(totalOf(result))}`),
  ]);
};

/** Esquema 3: el rango de días incluye los dos extremos del día (UTC). */
const DAY_RANGES: ReadonlyMap<string, string> = new Map([
  ['from=2026-01-19&to=2026-01-19', 'from=2026-01-19&to=2026-01-19'],
  ['from=2026-01-07&to=2026-01-07', 'from=2026-01-07&to=2026-01-07'],
  ['to=2026-01-06', 'to=2026-01-06'],
  ['from=2026-01-19&to=2026-01-06', 'from=2026-01-19&to=2026-01-06'],
]);

const dayRange: ApiRowHandler = async (row) => {
  const query = strict('consulta', DAY_RANGES, cell(row, 'consulta'));
  const total = intCell(cell(row, 'total'));
  const ultimo = cell(row, 'ultimo');
  const expected = `total ${total}; el último de items es ${ultimo}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const items = itemsOf(result) ?? [];
  const last = items[items.length - 1];
  const lastCheck: Check = ultimo === '(ninguno)' ? check(items.length === 0, 'items vacío', `items con ${items.length} eventos`) : check(last?.id === ultimo, `el último de items es ${ultimo}`, `el último de items es ${last?.id ?? '(ninguno)'}`);
  return verdictOf([responseCheck(result, { status: 200 }), check(totalOf(result) === total, `total vale ${total}`, `total vale ${shownTotal(totalOf(result))}`), lastCheck]);
};

/** Esquema 4: una fecha que no tiene la forma AAAA-MM-DD o no existe se ignora (la respuesta es la de 130 eventos). */
const INVALID_DATES: ReadonlyMap<string, string> = new Map([
  ['from=2026-1-5', 'from=2026-1-5'],
  ['from=2026-13-01', 'from=2026-13-01'],
  ['from=2026-02-30', 'from=2026-02-30'],
]);

const ignoredDate: ApiRowHandler = async (row) => {
  const query = strict('consulta', INVALID_DATES, cell(row, 'consulta'));
  const expected = '200; total 130 (la fecha se ignora)';
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const total = totalOf(result);
  const outcomeChecks = [responseCheck(result, { status: 200 }), check(total === 130, 'total vale 130', `total vale ${shownTotal(total)}`)];
  // Mecanismo (apps/api/src/audit/audit-cursor.ts:27-28): dayRange solo comprueba la forma AAAA-MM-DD; la fecha inexistente no se
  // descarta, así que la lectura cambia. La nota cita lo medido en esta fila (estado y total), no un valor fijo.
  const measured = `la API responde ${result.status}${result.status === 200 ? ` con total ${shownTotal(total)}` : ''} (medido)`;
  const mechanism = `Mecanismo en apps/api/src/audit/audit-cursor.ts:27-28: dayRange solo comprueba la forma AAAA-MM-DD; una fecha inexistente llega a Date (Invalid Date o un día distinto) y el filtro no se ignora; ${measured}. ${FILTER_NOTE_DATES}`;
  // La fila «from=2026-1-5» no distingue: todos los eventos son posteriores al 5 de enero, así que aunque se aplicara daría 130
  const note = query === 'from=2026-1-5' ? 'Esta fila no distingue si la fecha se ignora: todos los eventos de la semilla son posteriores al 5 de enero, así que aplicarla también daría 130.' : undefined;
  const verdict = verdictOf(outcomeChecks);
  if (verdict.verdict !== 'discrepa') return note === undefined ? verdict : { ...verdict, note };
  return { ...verdict, note: [note, mechanism, verdict.note].filter((part): part is string => part !== undefined).join(' ') };
};

/** Esquema 5: el texto busca en la acción y en el código de la entidad, sin distinguir mayúsculas. */
const TEXTS: ReadonlyMap<string, string> = new Map([
  ['q=STATE_CHANGED', 'q=STATE_CHANGED'],
  ['q=REQ-011', 'q=REQ-011'],
  ['q=Javier', 'q=Javier'],
]);

const textSearch: ApiRowHandler = async (row) => {
  const query = strict('consulta', TEXTS, cell(row, 'consulta'));
  const total = intCell(cell(row, 'total'));
  const expected = `total ${total}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  // El texto va en la acción o en el código de la entidad, sin distinguir mayúsculas: cada evento devuelto debe cumplirlo
  const term = query.slice('q='.length).toLowerCase();
  const items = itemsOf(result) ?? [];
  const everyMatches = items.every((event) => event.action.toLowerCase().includes(term) || event.entityId.toLowerCase().includes(term));
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(totalOf(result) === total, `total vale ${total}`, `total vale ${shownTotal(totalOf(result))}`),
    check(everyMatches, `todos los eventos contienen «${term}» en la acción o en el código`, `${items.filter((event) => !(event.action.toLowerCase().includes(term) || event.entityId.toLowerCase().includes(term))).length} eventos sin el texto`),
  ]);
};

/** Esquema 6: los filtros se combinan (entidad y rango de un mismo día). */
const combined: ApiRowHandler = async (row) => {
  const query = strict('consulta', new Map([['entity=requirement&from=2026-01-19&to=2026-01-19', 'entity=requirement&from=2026-01-19&to=2026-01-19']]), cell(row, 'consulta'));
  const total = intCell(cell(row, 'total'));
  const primero = cell(row, 'primero');
  const ultimo = cell(row, 'ultimo');
  const expected = `total ${total}; primero ${primero}; último ${ultimo}`;
  const login = await freshAuditor();
  if (login.token === undefined) return preparationFailed(expected, 'auditor@sigpro.test inicia sesión y recibe accessToken', login.result);
  const result = await readAudit(login.token, query);
  const items = itemsOf(result) ?? [];
  return verdictOf([
    responseCheck(result, { status: 200 }),
    check(totalOf(result) === total, `total vale ${total}`, `total vale ${shownTotal(totalOf(result))}`),
    check(items[0]?.id === primero, `el primer evento es ${primero}`, `el primer evento es ${items[0]?.id ?? '(ninguno)'}`),
    check(items[items.length - 1]?.id === ultimo, `el último evento de items es ${ultimo}`, `el último evento de items es ${items[items.length - 1]?.id ?? '(ninguno)'}`),
  ]);
};

defineApiRows({
  story: 'US-AUDITORIA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, entityFilter],
    [2, pageLimit],
    [3, dayRange],
    [4, ignoredDate],
    [5, textSearch],
    [6, combined],
  ]),
});
