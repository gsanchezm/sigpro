import { adminCredentials, call, field, usersByEmail, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, requestAccount, type Credentials } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { runWrite, type AuditEvent, type WriteSpec } from './common';

// US-AUDITORIA-005 — Eventos de no conformidades, hitos, usuarios, modo caos y registro, y ninguno en las operaciones rechazadas
// (API). Preparación de cada fila: la de US-AUDITORIA-004 (alumno01 reiniciado; la cuenta que actúa inicia sesión y
// auditor@sigpro.test lee el registro después).

type Send = (token: string | undefined) => Promise<ApiResult>;

/** Una operación de la tabla: la cuenta que la envía (`undefined` si nadie), su petición y, si la historia la deja sin decidir, la nota. */
interface Operation {
  readonly actor: Credentials | undefined;
  readonly send: Send;
  readonly pendingNote?: string;
}

const api =
  (method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Send =>
  (token) =>
    call(method, path, { tenant: TENANT_A, token, ...(body === undefined ? {} : { body }) });

const GESTOR = DEMO.gestor;
const CONSULTOR = DEMO.consultor;
const AUDITOR = DEMO.auditor;
const ALUMNO = adminCredentials(TENANT_A);

/** La solicitud de acceso de la fila: su correo y el id de la cuenta nueva los fija el envío y los lee el evento (una fila a la vez). */
const registry: { email?: string; id?: string } = {};

/** `POST /api/auth/register` con el cuerpo de las Reglas, en alumno01, con un correo nuevo; cruza el id con `usersByEmail`. */
const registerAccount: Send = async () => {
  registry.email = undefined;
  registry.id = undefined;
  const registered = await requestAccount(TENANT_A);
  registry.email = registered.email;
  const users = await usersByEmail(TENANT_A);
  const id = users.get(registered.email)?.id;
  registry.id = typeof id === 'string' ? id : undefined;
  return registered.result;
};

/** Columna «operacion» del Esquema 1: operaciones aceptadas que dejan su evento. */
const ACCEPTED: ReadonlyMap<string, Operation> = new Map<string, Operation>([
  ['consultor@sigpro.test envía POST /api/nc con programa PRG-001, severidad minor y descripción «Desviación de prueba para la auditoría»', { actor: CONSULTOR, send: api('POST', '/nc', { programCode: 'PRG-001', severity: 'minor', description: 'Desviación de prueba para la auditoría' }) }],
  ['consultor@sigpro.test envía PATCH /api/nc/NC-001 con severidad critical', { actor: CONSULTOR, send: api('PATCH', '/nc/NC-001', { severity: 'critical' }) }],
  ['consultor@sigpro.test envía POST /api/nc/NC-001/transition con to in_analysis', { actor: CONSULTOR, send: api('POST', '/nc/NC-001/transition', { to: 'in_analysis' }) }],
  ['auditor@sigpro.test envía POST /api/nc/NC-001/comments con el texto «Revisión de auditoría»', { actor: AUDITOR, send: api('POST', '/nc/NC-001/comments', { body: 'Revisión de auditoría' }) }],
  ['gestor@sigpro.test envía POST /api/programs/PRG-001/milestones con nombre «Hito de auditoría» y fecha límite 2026-06-30', { actor: GESTOR, send: api('POST', '/programs/PRG-001/milestones', { name: 'Hito de auditoría', dueDate: '2026-06-30' }) }],
  ['gestor@sigpro.test envía PATCH /api/milestones/PRG-001-M01 con nombre «Revisión de sistemas»', { actor: GESTOR, send: api('PATCH', '/milestones/PRG-001-M01', { name: 'Revisión de sistemas' }) }],
  ['gestor@sigpro.test envía DELETE /api/milestones/PRG-001-M01', { actor: GESTOR, send: api('DELETE', '/milestones/PRG-001-M01') }],
  ['alumno01@sigpro.lab envía PATCH /api/admin/users/u3 con active false', { actor: ALUMNO, send: api('PATCH', '/admin/users/u3', { active: false }) }],
  [
    'alumno01@sigpro.lab envía PATCH /api/admin/chaos con latencyMs 0, errorRate 0 y flakyLabels false',
    {
      actor: ALUMNO,
      send: api('PATCH', '/admin/chaos', { latencyMs: 0, errorRate: 0, flakyLabels: false }),
      pendingNote:
        'La preparación deja el caos apagado (latencia 0, tasa 0, sin etiquetas variables), así que este PATCH no cambia nada. La historia deja sin decidir si un PATCH del modo caos sin cambio debe dejar evento («Decisiones pendientes») y dice que ninguna fila lo ejercita sin cambio: la fila contradice esa frase. Se mide lo que la app hace y no se da veredicto.',
    },
  ],
  ['sin cuenta, envía POST /api/auth/register con x-tenant alumno01 y el cuerpo de las Reglas, con el correo (correo nuevo)', { actor: undefined, send: registerAccount }],
]);

/** Columna «operacion» del Esquema 2: operaciones rechazadas o lecturas, que no dejan evento. */
const REJECTED: ReadonlyMap<string, Operation> = new Map<string, Operation>([
  ['consultor@sigpro.test envía POST /api/programs con nombre «Programa de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000', { actor: CONSULTOR, send: api('POST', '/programs', { name: 'Programa de auditoría', ownerId: 'u2', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 }) }],
  ['gestor@sigpro.test envía POST /api/programs con nombre «Programa duplicado de auditoría», responsable u2, inicio 2026-03-01, fin 2026-12-31 y presupuesto 150000', { actor: GESTOR, send: api('POST', '/programs', { name: 'Programa duplicado de auditoría', ownerId: 'u2', startDate: '2026-03-01', endDate: '2026-12-31', budget: 150000 }) }],
  ['alumno01@sigpro.lab envía PATCH /api/admin/users/u7 con active false', { actor: ALUMNO, send: api('PATCH', '/admin/users/u7', { active: false }) }],
  ['consultor@sigpro.test envía PATCH /api/nc/NC-001 con la severidad que ya tiene, minor', { actor: CONSULTOR, send: api('PATCH', '/nc/NC-001', { severity: 'minor' }) }],
  [
    'gestor@sigpro.test inicia sesión con POST /api/auth/login, su correo y la contraseña correcta',
    { actor: undefined, send: () => call('POST', '/auth/login', { tenant: TENANT_A, body: { email: GESTOR.email, password: GESTOR.password } }) },
  ],
]);

/** Columna «actor»: nombre de la cuenta del seed en el tenant, o `null` si ninguna (la solicitud de acceso). */
const ACTOR_NAMES: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Lucía Fernández', 'Lucía Fernández'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Alumno 01', 'Alumno 01'],
  ['(ninguno)', null],
]);

const CREATED_FIELD: ReadonlyMap<string, string> = new Map<string, string>([
  ['(código de la respuesta)', 'code'],
  ['(id de la respuesta)', 'id'],
]);

/** Valor esperado de «codigo»: el literal; el campo de la respuesta; o el id de la cuenta nueva (`(identificador que empieza por r)`). */
const codeExpected = (text: string, result: ApiResult): string | undefined => {
  if (text === '(identificador que empieza por r)') return registry.id;
  if (!text.startsWith('(')) return text;
  const value = field(result.body, strict('codigo', CREATED_FIELD, text));
  return typeof value === 'string' ? value : undefined;
};

type Diff = Readonly<Record<string, unknown>> | null | undefined;

const shown = (value: unknown): string => (value === undefined ? '(ausente)' : typeof value === 'string' ? value : JSON.stringify(value));
/** El detalle contiene `key` con exactamente `value` (el tipo cuenta: `false` no es «false»). */
const is = (diff: Diff, key: string, value: unknown): Check => {
  const observed = diff === null || diff === undefined ? undefined : diff[key];
  return check(diff !== null && diff !== undefined && observed === value, `detalle ${key} ${shown(value)}`, `detalle ${key} ${shown(observed)}`);
};

/** Columna «detalle». El correo del registro sale de la solicitud que hizo la fila (no de la app). */
const DETAIL: ReadonlyMap<string, (diff: Diff) => readonly Check[]> = new Map<string, (diff: Diff) => readonly Check[]>([
  ['contiene program PRG-001 y severity minor', (diff) => [is(diff, 'program', 'PRG-001'), is(diff, 'severity', 'minor')]],
  ['contiene severity critical', (diff) => [is(diff, 'severity', 'critical')]],
  ['contiene from open y to in_analysis', (diff) => [is(diff, 'from', 'open'), is(diff, 'to', 'in_analysis')]],
  ['contiene kind comment', (diff) => [is(diff, 'kind', 'comment')]],
  ['contiene program PRG-001 y name «Hito de auditoría»', (diff) => [is(diff, 'program', 'PRG-001'), is(diff, 'name', 'Hito de auditoría')]],
  ['contiene name «Revisión de sistemas»', (diff) => [is(diff, 'name', 'Revisión de sistemas')]],
  ['contiene program PRG-001 y name SRR', (diff) => [is(diff, 'program', 'PRG-001'), is(diff, 'name', 'SRR')]],
  ['contiene active false', (diff) => [is(diff, 'active', false)]],
  ['contiene latencyMs 0, errorRate 0 y flakyLabels false', (diff) => [is(diff, 'latencyMs', 0), is(diff, 'errorRate', 0), is(diff, 'flakyLabels', false)]],
  [
    'contiene email (correo nuevo en minúsculas) y role consultant',
    (diff) => [check(registry.email !== undefined && diff !== null && diff !== undefined && diff.email === registry.email, `detalle email ${shown(registry.email)}`, `detalle email ${shown(diff === null || diff === undefined ? undefined : diff.email)}`), is(diff, 'role', 'consultant')],
  ],
]);

/** Esquema 1: cada operación aceptada deja su evento como primer elemento del registro. */
const acceptedOperation: ApiRowHandler = async (row) => {
  const operation = strict('operacion', ACCEPTED, cell(row, 'operacion'));
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
    ...(operation.pendingNote === undefined ? {} : { pendingNote: operation.pendingNote }),
    eventChecks: (event: AuditEvent | undefined, result: ApiResult) => {
      const wanted = codeExpected(codigo, result);
      const sinActor = actor === null;
      return [
        check(event?.action === accion, `acción ${accion}`, `acción ${event?.action ?? '(sin evento nuevo)'}`),
        check(event?.entity === entidad, `entidad ${entidad}`, `entidad ${event?.entity ?? '(sin evento nuevo)'}`),
        check(event !== undefined && wanted !== undefined && event.entityId === wanted, `entityId ${wanted ?? '(sin código en la respuesta)'}`, `entityId ${event?.entityId ?? '(sin evento nuevo)'}`),
        check(event !== undefined && event.actorName === actor, `actor ${actor ?? '(ninguno)'}`, `actor ${event === undefined ? '(sin evento nuevo)' : (event.actorName ?? '(ninguno)')}`),
        ...(sinActor ? [check(event?.actorId === null, 'actorId null', `actorId ${event?.actorId === null ? 'null' : String(event?.actorId)}`)] : []),
        ...(codigo === '(identificador que empieza por r)'
          ? [check(/^r[0-9a-f]{8}$/.test(event?.entityId ?? ''), 'entityId empieza por r y sigue con ocho hexadecimales', `entityId ${event?.entityId ?? '(sin evento nuevo)'}`)]
          : []),
        ...detalle(event?.diff),
      ];
    },
  };
  return runWrite(spec);
};

/** Esquema 2: una operación rechazada o una lectura no deja ningún evento (total 130, primero AL-130). */
const rejectedOperation: ApiRowHandler = async (row) => {
  const operation = strict('operacion', REJECTED, cell(row, 'operacion'));
  const respuesta = parseResponse(cell(row, 'respuesta'));
  const spec: WriteSpec = {
    actor: operation.actor,
    expected: `${cell(row, 'respuesta')} y ningún evento nuevo (total 130, primero AL-130)`,
    send: operation.send,
    responseChecks: (result) => [responseCheck(result, respuesta)],
    accepted: false,
    eventChecks: () => [],
  };
  return runWrite(spec);
};

defineApiRows({
  story: 'US-AUDITORIA-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, acceptedOperation],
    [2, rejectedOperation],
  ]),
});
