import { adminCredentials, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { postForm, runWrite, type WriteSpec } from './common';

// US-AUDITORIA-004 — Qué evento deja cada operación de programas, requisitos, ejecuciones y documentos (API). Preparación de cada
// fila: alumno01 reiniciado; la cuenta que actúa inicia sesión en alumno01 y auditor@sigpro.test lee el registro después. El evento
// es el primero del registro (la operación es posterior a la semilla): además se exige que el total crezca exactamente en 1 y que
// su instante caiga dentro de la petición (lección 17), porque la semilla puede tener eventos gemelos.

type Send = (token: string | undefined) => Promise<ApiResult>;

/** Una operación de la tabla: la cuenta que la envía y la petición que hace con su token. */
interface Operation {
  readonly actor: Credentials;
  readonly send: Send;
}

/** Petición JSON al tenant de la fila, con el token del actor. */
const api =
  (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, body?: unknown): Send =>
  (token) =>
    call(method, path, { tenant: TENANT_A, token, ...(body === undefined ? {} : { body }) });

const GESTOR = DEMO.gestor;
const CONSULTOR = DEMO.consultor;
const ALUMNO = adminCredentials(TENANT_A);

/** Operación de la columna «operacion» (texto exacto de la celda). */
const OPERATIONS: ReadonlyMap<string, Operation> = new Map<string, Operation>([
  ['gestor@sigpro.test envía POST /api/programs con nombre «Programa de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000', { actor: GESTOR, send: api('POST', '/programs', { name: 'Programa de auditoría', ownerId: 'u2', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 }) }],
  ['gestor@sigpro.test envía PATCH /api/programs/PRG-001 con nombre «Programa de auditoría revisado»', { actor: GESTOR, send: api('PATCH', '/programs/PRG-001', { name: 'Programa de auditoría revisado' }) }],
  ['gestor@sigpro.test envía POST /api/programs/PRG-001/archive', { actor: GESTOR, send: api('POST', '/programs/PRG-001/archive') }],
  ['gestor@sigpro.test envía POST /api/programs/PRG-001/duplicate', { actor: GESTOR, send: api('POST', '/programs/PRG-001/duplicate') }],
  ['alumno01@sigpro.lab envía DELETE /api/programs/PRG-024', { actor: ALUMNO, send: api('DELETE', '/programs/PRG-024') }],
  ['consultor@sigpro.test envía POST /api/requirements con programa PRG-001 y título «Requisito de auditoría»', { actor: CONSULTOR, send: api('POST', '/requirements', { programCode: 'PRG-001', title: 'Requisito de auditoría' }) }],
  ['consultor@sigpro.test envía PATCH /api/requirements/REQ-001 con título «Disponibilidad revisada»', { actor: CONSULTOR, send: api('PATCH', '/requirements/REQ-001', { title: 'Disponibilidad revisada' }) }],
  ['gestor@sigpro.test envía POST /api/requirements/REQ-017/transition con to approved', { actor: GESTOR, send: api('POST', '/requirements/REQ-017/transition', { to: 'approved' }) }],
  ['gestor@sigpro.test envía POST /api/requirements/REQ-001/move con targetCode REQ-006 y placement after', { actor: GESTOR, send: api('POST', '/requirements/REQ-001/move', { targetCode: 'REQ-006', placement: 'after' }) }],
  ['gestor@sigpro.test envía DELETE /api/requirements/REQ-005', { actor: GESTOR, send: api('DELETE', '/requirements/REQ-005') }],
  ['consultor@sigpro.test envía PUT /api/requirements/REQ-002/tests/TC-001', { actor: CONSULTOR, send: api('PUT', '/requirements/REQ-002/tests/TC-001') }],
  ['consultor@sigpro.test envía DELETE /api/requirements/REQ-001/tests/TC-001', { actor: CONSULTOR, send: api('DELETE', '/requirements/REQ-001/tests/TC-001') }],
  ['consultor@sigpro.test envía POST /api/test-cases/TC-001/runs con resultado pass y sin archivos', { actor: CONSULTOR, send: (token) => postForm('/test-cases/TC-001/runs', token ?? '', TENANT_A, { result: 'pass' }) }],
  ['gestor@sigpro.test envía POST /api/documents/DOC-001/versions con la línea «Línea de auditoría» y la nota «Revisión de auditoría»', { actor: GESTOR, send: api('POST', '/documents/DOC-001/versions', { lines: ['Línea de auditoría'], note: 'Revisión de auditoría' }) }],
]);

/** Columna «actor»: el nombre de la cuenta del seed en el tenant (`null` si ninguna cuenta hizo el cambio). */
const ACTOR_NAMES: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Alumno 01', 'Alumno 01'],
  ['(ninguno)', null],
]);

/** Columna «codigo» cuando es un marcador: qué campo de la respuesta es el código del objeto creado. */
const CREATED_FIELD: ReadonlyMap<string, string> = new Map<string, string>([
  ['(código de la respuesta)', 'code'],
  ['(id de la respuesta)', 'id'],
]);

/** Valor esperado de «codigo»: el literal de la celda, o el campo que devuelve la propia respuesta (`undefined` si no lo trae). */
const codeExpected = (text: string, result: ApiResult): string | undefined => {
  if (!text.startsWith('(')) return text;
  const value = field(result.body, strict('codigo', CREATED_FIELD, text));
  return typeof value === 'string' ? value : undefined;
};

type Diff = Readonly<Record<string, unknown>> | null | undefined;

const shown = (value: unknown): string => (value === undefined ? '(ausente)' : typeof value === 'string' ? value : JSON.stringify(value));
/** El detalle contiene `key` con exactamente `value` (tipo incluido: 4 y «4» no valen igual). */
const is = (diff: Diff, key: string, value: unknown): Check => {
  const observed = diff === null || diff === undefined ? undefined : diff[key];
  return check(diff !== null && diff !== undefined && observed === value, `detalle ${key} ${shown(value)}`, `detalle ${key} ${shown(observed)}`);
};
/** El detalle lista el campo `name` en `fields`. */
const listsField = (diff: Diff, name: string): Check => {
  const fields = diff === null || diff === undefined ? undefined : diff.fields;
  return check(Array.isArray(fields) && fields.includes(name), `detalle fields incluye ${name}`, `detalle fields ${shown(fields)}`);
};

/** Columna «detalle»: lo que la tabla dice que contiene el `diff`, con su tipo. */
const DETAIL: ReadonlyMap<string, (diff: Diff) => readonly Check[]> = new Map<string, (diff: Diff) => readonly Check[]>([
  ['contiene name «Programa de auditoría»', (diff) => [is(diff, 'name', 'Programa de auditoría')]],
  ['contiene fields con name', (diff) => [listsField(diff, 'name')]],
  ['contiene status closed', (diff) => [is(diff, 'status', 'closed')]],
  ['contiene from PRG-001', (diff) => [is(diff, 'from', 'PRG-001')]],
  ['es null', (diff) => [check(diff === null, 'detalle null', `detalle ${diff === null ? 'null' : diff === undefined ? '(sin evento nuevo)' : 'con datos'}`)]],
  ['contiene title «Requisito de auditoría» y parent null', (diff) => [is(diff, 'title', 'Requisito de auditoría'), is(diff, 'parent', null)]],
  ['contiene fields con title y revertedFrom approved', (diff) => [listsField(diff, 'title'), is(diff, 'revertedFrom', 'approved')]],
  ['contiene from draft y to approved', (diff) => [is(diff, 'from', 'draft'), is(diff, 'to', 'approved')]],
  ['contiene target REQ-006 y placement after', (diff) => [is(diff, 'target', 'REQ-006'), is(diff, 'placement', 'after')]],
  ['contiene descendants 0', (diff) => [is(diff, 'descendants', 0)]],
  ['contiene testCase TC-001', (diff) => [is(diff, 'testCase', 'TC-001')]],
  ['contiene testCase TC-001, result pass y files 0', (diff) => [is(diff, 'testCase', 'TC-001'), is(diff, 'result', 'pass'), is(diff, 'files', 0)]],
  ['contiene version 4 y lines 1', (diff) => [is(diff, 'version', 4), is(diff, 'lines', 1)]],
]);

/** Esquema 1: cada operación deja su evento como primer elemento del registro. */
const eventOfOperation: ApiRowHandler = async (row) => {
  const operation = strict('operacion', OPERATIONS, cell(row, 'operacion'));
  const respuesta = parseResponse(cell(row, 'respuesta'));
  const accion = cell(row, 'accion');
  const entidad = cell(row, 'entidad');
  const codigo = cell(row, 'codigo');
  const actor = strict('actor', ACTOR_NAMES, cell(row, 'actor'));
  const detalle = strict('detalle', DETAIL, cell(row, 'detalle'));
  const spec: WriteSpec = {
    actor: operation.actor,
    expected: `${respuesta.status} y el primer evento: ${accion} sobre ${entidad}, código ${codigo}, actor ${actor ?? '(ninguno)'}`,
    send: operation.send,
    responseChecks: (result) => [responseCheck(result, respuesta)],
    accepted: true,
    eventChecks: (event, result) => {
      const wanted = codeExpected(codigo, result);
      return [
        check(event?.action === accion, `acción ${accion}`, `acción ${event?.action ?? '(sin evento nuevo)'}`),
        check(event?.entity === entidad, `entidad ${entidad}`, `entidad ${event?.entity ?? '(sin evento nuevo)'}`),
        check(event !== undefined && wanted !== undefined && event.entityId === wanted, `entityId ${wanted ?? '(sin código en la respuesta)'}`, `entityId ${event?.entityId ?? '(sin evento nuevo)'}`),
        check(event !== undefined && event.actorName === actor, `actor ${actor ?? '(ninguno)'}`, `actor ${event === undefined ? '(sin evento nuevo)' : (event.actorName ?? '(ninguno)')}`),
        ...detalle(event?.diff),
      ];
    },
  };
  return runWrite(spec);
};

defineApiRows({
  story: 'US-AUDITORIA-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, eventOfOperation]]),
});
