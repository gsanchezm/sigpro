import { field } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { CUENTA, TENANT_A, answerCheck, asApiResult, codeOf, codesCheck, docCodesOf, finish, idsOf, itemsOfList, jsonOf, listPresentCheck, rawGet, resetAlumno, sessionFor, thenOf, visibleFor } from './common';

// US-DOC-RESTRINGIDOS-001 — Lista de documentos por la API sin los restringidos para quien no tiene el permiso. Preparación de cada
// fila: reinicio de alumno01 con su administrador y, después, la cuenta de la fila inicia sesión en alumno01 (admin con el segundo
// factor). El aviso de ocultos (`hiddenCount`) se mide en la respuesta sin filtros: con filtros la historia no lo fija (decisión
// pendiente), así que las filas de filtro solo miran los códigos.

/** Total de documentos de la celda «total». */
const TOTAL: ReadonlyMap<string, number> = new Map<string, number>([
  ['12', 12],
  ['8', 8],
]);

/** Número de restringidos ocultos de la celda «oculto». */
const OCULTO: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['4', 4],
]);

/** Filtro de la celda «filtro» → cadena de consulta que envía la fila (sin «?»). */
const FILTRO: ReadonlyMap<string, string> = new Map<string, string>([
  ['?classification=restricted', 'classification=restricted'],
  ['?q=DOC-003', 'q=DOC-003'],
  ['?program=PRG-002', 'program=PRG-002'],
]);

/** Programa de la celda «programa» (los dos que la historia da por clasificados). */
const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-005', 'PRG-005'],
]);

// --- Esquema 1: cada rol recibe los documentos que su permiso permite y el número de los omitidos ----------------------------------

const listByRole: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const total = strict('total', TOTAL, cell(row, 'total'));
  const hidden = strict('oculto', OCULTO, cell(row, 'oculto'));
  const restricted = docCodesOf(cell(row, 'restringidos'));
  await resetAlumno();
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  const raw = await rawGet('/documents', session.token);
  const body = jsonOf(raw.bytes);
  const items = itemsOfList(body);
  const shownRestricted = (items ?? []).filter((item) => field(item, 'classification') === 'restricted').map((item) => String(field(item, 'id')));
  return finish(
    [
      answerCheck(raw.status, codeOf(body), { status: 200 }),
      listPresentCheck(body),
      check(items !== undefined && items.length === total, `la lista trae ${total} documentos`, `la lista trae ${items === undefined ? '(sin leer)' : items.length} documentos`),
      // El conjunto exacto de documentos que ve el rol (no solo su clasificación)
      codesCheck('la lista trae', idsOf(items), visibleFor(account)),
      check(field(body, 'hiddenCount') === hidden, `hiddenCount ${hidden}`, `hiddenCount ${String(field(body, 'hiddenCount'))}`),
      codesCheck('los restringidos que trae son', shownRestricted, restricted),
    ],
    { evidence: { cuenta: cell(row, 'cuenta'), documentosVistos: idsOf(items).length } },
  );
};

// --- Esquema 2: un filtro no devuelve un restringido a quien no puede verlo ------------------------------------------------------

const filteredList: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const query = strict('filtro', FILTRO, cell(row, 'filtro'));
  const codes = docCodesOf(cell(row, 'codigos'));
  await resetAlumno();
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  const raw = await rawGet('/documents', session.token, query);
  const body = jsonOf(raw.bytes);
  const items = itemsOfList(body);
  return finish(
    [answerCheck(raw.status, codeOf(body), { status: 200 }), listPresentCheck(body), codesCheck('la lista trae', idsOf(items), codes)],
    { evidence: { cuenta: cell(row, 'cuenta'), filtro: cell(row, 'filtro') } },
  );
};

// --- Esquema 3: la clasificación del programa no cambia qué documentos ve el consultor ------------------------------------------

const classifiedProgram: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const program = strict('programa', PROGRAMA, cell(row, 'programa'));
  const codes = docCodesOf(cell(row, 'codigos'));
  await resetAlumno();
  const session = await sessionFor('consultor');
  if (session.token === undefined) return preparationFailed(expected, 'consultor@sigpro.test inicia sesión en alumno01', session.last);
  // Precondición de la historia: el programa está marcado como clasificado (se lee por la API, no se da por hecho)
  const read = await rawGet(`/programs/${program}`, session.token);
  const classified = field(jsonOf(read.bytes), 'classified');
  if (classified !== true) {
    return preparationFailed(expected, `${program} está marcado como clasificado`, asApiResult(read));
  }
  const raw = await rawGet('/documents', session.token, `program=${program}`);
  const body = jsonOf(raw.bytes);
  const items = itemsOfList(body);
  return finish(
    [answerCheck(raw.status, codeOf(body), { status: 200 }), listPresentCheck(body), codesCheck('la lista trae', idsOf(items), codes)],
    { evidence: { programa: program, classified: String(classified), cuenta: 'consultor@sigpro.test' } },
  );
};

defineApiRows({
  story: 'US-DOC-RESTRINGIDOS-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, listByRole],
    [2, filteredList],
    [3, classifiedProgram],
  ]),
});
