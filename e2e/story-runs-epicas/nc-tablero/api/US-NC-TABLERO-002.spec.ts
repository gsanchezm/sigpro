import { field } from '../../../story-runs/support/api';
import { DEMO } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { NC_CODE_CELLS, NUMBER_CELLS, STATE_CELLS, STEPS_CELLS, TENANT_A, actorOf, answerChecks, detailNc, resetTenants, sameOrder, stateOfBody, stringsOf, verdict } from './common';

// US-NC-TABLERO-002 — Detalle de una no conformidad por la API. Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador y, después, inicio de sesión de gestor@sigpro.test en alumno01 (la lectura del detalle la hace la fila con ese token).

/** Detalle de la celda: estado y pasos que la máquina admite, en el orden de la máquina. */
const detailSteps: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const state = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const steps = strict('pasos', STEPS_CELLS, cell(row, 'pasos'));
  const expected = `respuesta 200 con state ${state} y transitions ${cell(row, 'pasos')}`;

  await resetTenants([TENANT_A]);
  const gestor = await actorOf(TENANT_A, DEMO.gestor);
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);

  const result = await detailNc(TENANT_A, gestor.token, code);
  const observedSteps = stringsOf(field(result.body, 'transitions'));
  return verdict([
    check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
    check(stateOfBody(result) === state, `state ${state}`, `state ${stateOfBody(result) ?? '(sin state)'}`),
    check(sameOrder(observedSteps, steps), `transitions ${cell(row, 'pasos')}`, `transitions ${observedSteps === undefined ? '(sin transitions)' : observedSteps.length === 0 ? '(ninguno)' : observedSteps.join(', ')}`),
  ]);
};

/** Código que no existe en el tenant: 404 con `nc_not_found`. */
const unknownCode: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  await resetTenants([TENANT_A]);
  const gestor = await actorOf(TENANT_A, DEMO.gestor);
  if (gestor.token === undefined) return preparationFailed(`respuesta 404 nc_not_found para ${code}`, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const result = await detailNc(TENANT_A, gestor.token, code);
  return verdict(answerChecks({ status: 404, code: 'nc_not_found' }, result));
};

/** Comentarios: la lista tiene tantos elementos como `commentCount`, en orden del más antiguo al más reciente. */
const commentsOrder: ApiRowHandler = async (row: ManifestRow) => {
  const code = strict('código', NC_CODE_CELLS, cell(row, 'codigo'));
  const count = strict('comentarios', NUMBER_CELLS, cell(row, 'comentarios'));
  const expected = `respuesta 200 con commentCount ${count} y comments con ${count} elementos; los comentarios van del más antiguo al más reciente`;

  await resetTenants([TENANT_A]);
  const gestor = await actorOf(TENANT_A, DEMO.gestor);
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);

  const result = await detailNc(TENANT_A, gestor.token, code);
  const raw = field(result.body, 'comments');
  const comments: readonly Record<string, unknown>[] = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const dates = comments.map((entry) => String(field(entry, 'createdAt')));
  // Estricto: con dos o más comentarios las fechas deben ser distintas y crecer (en el seed, NC-003 tiene 3 con horas distintas)
  const ordered = dates.every((value, index) => index === 0 || (dates[index - 1] ?? '') < value);
  return verdict(
    [
      check(result.status === 200, 'respuesta 200', `respuesta ${result.status}`),
      check(field(result.body, 'commentCount') === count, `commentCount ${count}`, `commentCount ${String(field(result.body, 'commentCount'))}`),
      check(comments.length === count, `comments con ${count} elementos`, `comments con ${comments.length} elementos`),
      check(ordered, 'comentarios de más antiguo a más reciente', ordered ? `fechas en orden: ${dates.join(', ') || '(sin comentarios)'}` : `fechas fuera de orden: ${dates.join(', ')}`),
    ],
    count === 0 ? 'Con cero comentarios (NC-008) el orden se cumple en vacío: esa comprobación no distingue nada en esta fila.' : undefined,
  );
};

defineApiRows({
  story: 'US-NC-TABLERO-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, detailSteps],
    [2, unknownCode],
    [3, commentsOrder],
  ]),
});
