import { field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { ACCOUNT_CELLS, SEED_STATE, TENANT_A, actorOf, answerChecks, detailNc, fieldCheck, persistedState, resetTenants, showValue, stateOf, transitionNc, verdict, type Expect } from './common';

// US-NC-GESTION-005 — Cierre de una no conformidad por la API (POST /api/nc/:code/transition con {to: closed, comment}). Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; después la cuenta de la fila inicia sesión en alumno01. El orden de las
// comprobaciones (rol, paso de la máquina de estados, comentario) es el de la historia. El estado de cada NC se lee después con la
// cuenta administradora (persistedState), no con la respuesta.

const GESTOR = DEMO.gestor;
const GESTOR_EMAIL = 'gestor@sigpro.test';
const TWENTY = 'a'.repeat(20);

/** Comentario de cierre tal como lo escribe la celda (`undefined` = el campo `comment` no va en el cuerpo). */
const COMMENT_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(19 letras a)', 'a'.repeat(19)],
  ['(20 letras a)', TWENTY],
  ['(21 letras a)', 'a'.repeat(21)],
  ['(un espacio, 19 letras a y un espacio)', ` ${'a'.repeat(19)} `],
  ['(un espacio, 20 letras a y un espacio)', ` ${TWENTY} `],
  ['(3 espacios)', '   '],
  ['(vacío)', ''],
  ['(sin el campo)', undefined],
  ['(1000 letras a)', 'a'.repeat(1000)],
  ['(1001 letras a)', 'a'.repeat(1001)],
]);

const CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-003', 'NC-003'],
  ['NC-001', 'NC-001'],
  ['NC-002', 'NC-002'],
  ['NC-004', 'NC-004'],
]);

/** Respuesta del cierre: estado HTTP y código, el motivo de `comment` o, en un 200, el estado (`state`) de la no conformidad. */
interface CloseExpect extends Expect {
  readonly state?: string;
}

const CLOSE_RESPONSE_CELLS: ReadonlyMap<string, CloseExpect> = new Map<string, CloseExpect>([
  ['422 validation_failed con el motivo closureShort en comment', { status: 422, code: 'validation_failed', errorField: 'comment', errorKey: 'closureShort' }],
  ['200 con state closed', { status: 200, state: 'closed' }],
  ['422 validation_failed con el motivo closureRequired en comment', { status: 422, code: 'validation_failed', errorField: 'comment', errorKey: 'closureRequired' }],
  ['422 validation_failed con el motivo commentLong en comment', { status: 422, code: 'validation_failed', errorField: 'comment', errorKey: 'commentLong' }],
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['409 invalid_transition', { status: 409, code: 'invalid_transition' }],
]);

/** Estado que la historia pide a la no conformidad después (`closed` o `corrective_action`). */
const STATE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['closed', 'closed'],
  ['corrective_action', 'corrective_action'],
]);

/** Cierre con la cuenta de la fila: POST con el paso a closed y el comentario (sin el campo si `undefined`). */
const closeWith = (token: string | undefined, code: string, comment: string | undefined): Promise<ApiResult> =>
  transitionNc(token, code, comment === undefined ? { to: 'closed' } : { to: 'closed', comment });

/** Comprobaciones de la respuesta del cierre: estado, código o motivo, y el `state` (y `transitions` vacío) si la historia lo da. */
const closeChecks = (expect: CloseExpect, result: ApiResult): Check[] => {
  const checks = answerChecks(expect, result);
  if (expect.state === undefined) return checks;
  checks.push(fieldCheck('state', stateOf(result), expect.state));
  const transitions = field(result.body, 'transitions');
  checks.push(check(Array.isArray(transitions) && transitions.length === 0, 'transitions vacío', `transitions ${showValue(transitions)}`));
  return checks;
};

// --- Esquema 1: el comentario de cierre debe tener al menos 20 caracteres tras recortar los espacios ---------------------------

const minimumLength: ApiRowHandler = async (row: ManifestRow) => {
  const comment = strict('comentario', COMMENT_CELLS, cell(row, 'comentario'));
  const expect = strict('respuesta', CLOSE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc/NC-003/transition con el paso a closed y el comentario ${cell(row, 'comentario')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await closeWith(gestor.token, 'NC-003', comment);
  const stateNow = await persistedState('NC-003');
  const checks = closeChecks(expect, result);
  // Un rechazo no cierra la no conformidad: sigue en «Acción correctiva» (la historia dice que se rechaza)
  checks.push(fieldCheck('estado de NC-003 después', stateNow, expect.state ?? 'corrective_action'));
  return verdict(checks);
};

// --- Esquema 2: un comentario de cierre de hasta mil caracteres se acepta y uno mayor no ---------------------------------------

const maximumLength: ApiRowHandler = async (row: ManifestRow) => {
  const comment = strict('comentario', COMMENT_CELLS, cell(row, 'comentario'));
  const expect = strict('respuesta', CLOSE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const expected = `POST /api/nc/NC-003/transition con el paso a closed y el comentario ${cell(row, 'comentario')} → ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await closeWith(gestor.token, 'NC-003', comment);
  const stateNow = await persistedState('NC-003');
  return verdict(
    [...closeChecks(expect, result), fieldCheck('estado de NC-003 después', stateNow, expect.state ?? 'corrective_action')],
    'Sin fila para el orden 403 → 409 → 422 con cuerpo inválido de un rol sin permiso: el orden de la historia no se ejerce aquí (el rol de la fila es admin o gestor). Un consultor con más de 1000 caracteres recibiría 422 (la validación del cuerpo va antes que el rol).',
  );
};

// --- Esquema 3: solo admin y program_manager pueden cerrar --------------------------------------------------------------------

const onlyCloserRoles: ApiRowHandler = async (row: ManifestRow) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const expect = strict('respuesta', CLOSE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `${cell(row, 'correo')} pide el paso a closed de NC-003 con un comentario de 20 letras a → ${cell(row, 'respuesta')}; NC-003 queda en ${cell(row, 'estado')}`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);

  const result = await closeWith(actor.token, 'NC-003', TWENTY);
  return verdict([...closeChecks(expect, result), fieldCheck('estado de NC-003 después', await persistedState('NC-003'), state)]);
};

// --- Esquema 4: el orden de las comprobaciones es rol, paso y comentario ----------------------------------------------------------

const checkOrder: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('codigo', CODE_CELLS, cell(row, 'codigo'));
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const comment = strict('comentario', COMMENT_CELLS, cell(row, 'comentario'));
  const expect = strict('respuesta', CLOSE_RESPONSE_CELLS, cell(row, 'respuesta'));
  const seedState = SEED_STATE.get(code);
  const expected = `${cell(row, 'correo')} pide el paso a closed de ${code} con el comentario ${cell(row, 'comentario')} → ${cell(row, 'respuesta')}; ${code} sigue en «${seedState}»`;
  await resetTenants([TENANT_A]);
  const actor = await actorOf(account);
  if (actor.token === undefined) return preparationFailed(expected, `${cell(row, 'correo')} inicia sesión con POST /api/auth/login`, actor.last);

  const result = await closeWith(actor.token, code, comment);
  return verdict(
    [...closeChecks(expect, result), fieldCheck(`estado de ${code} después (seed)`, await persistedState(code), seedState)],
    'El orden 403 → 409 → 422 se ejerce solo con cuerpos válidos (comentario de 19, 20 o vacío). Sin fila con un rol sin permiso y un cuerpo inválido (p. ej. más de 1000 caracteres): ahí la validación del cuerpo responde antes que el rol.',
  );
};

// --- Esquema 5: el comentario de cierre queda guardado como comentario de cierre y recortado ----------------------------------

const closureSaved: ApiRowHandler = async (row: ManifestRow) => {
  const comment = strict('comentario', COMMENT_CELLS, cell(row, 'comentario'));
  const saved = strict('guardado', COMMENT_CELLS, cell(row, 'guardado'));
  const expected = `POST /api/nc/NC-003/transition con el comentario ${cell(row, 'comentario')} → 200 con state closed y transitions vacío; el último comentario de NC-003 tiene kind closure, body ${cell(row, 'guardado')} y authorName Javier Ortega`;
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(GESTOR);
  if (gestor.token === undefined) return preparationFailed(expected, `${GESTOR_EMAIL} inicia sesión con POST /api/auth/login`, gestor.last);

  const result = await closeWith(gestor.token, 'NC-003', comment);
  const detail = await detailNc(gestor.token, 'NC-003');
  const list = field(detail.body, 'comments');
  const last: unknown = Array.isArray(list) && list.length > 0 ? list[list.length - 1] : undefined;
  return verdict([
    ...closeChecks({ status: 200, state: 'closed' }, result),
    fieldCheck('kind del último comentario', field(last, 'kind'), 'closure'),
    fieldCheck('body del último comentario (recortado)', field(last, 'body'), saved),
    fieldCheck('authorName del último comentario', field(last, 'authorName'), 'Javier Ortega'),
  ]);
};

defineApiRows({
  story: 'US-NC-GESTION-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, minimumLength],
    [2, maximumLength],
    [3, onlyCloserRoles],
    [4, checkOrder],
    [5, closureSaved],
  ]),
});
