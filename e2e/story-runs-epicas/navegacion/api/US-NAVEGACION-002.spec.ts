import type { ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants, startSession } from '../../../story-runs/support/prepare';
import { cell, check, conclude, errorsOf, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { emptyGroupsCheck, searchAs, statusCheck, textField } from './common';

// US-NAVEGACION-002 — Mínimo de dos caracteres en la búsqueda. Preparación de cada fila: reinicio de alumno01 y acceso de
// gestor@sigpro.test con x-tenant alumno01 (la búsqueda exige acceso; la historia 003 lo cubre aparte).

// Cómo llega el parámetro `q` en cada fila (la columna «q_enviada» de la historia).
const SENT: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin el parámetro)', undefined],
  ['(vacío)', ''],
  ['a', 'a'],
  ['(un espacio, a, un espacio)', ' a '],
  ['ab', 'ab'],
  ['(un espacio, ab, un espacio)', ' ab '],
  ['zz', 'zz'],
]);

// Lo que dice cada fila de la columna «respuesta», en comprobaciones separadas (estado, código, campo y lista).
const RESPONSES: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  [
    '422 validation_failed con errors.q minChars',
    (result) => {
      const reason = errorsOf(result).q;
      return [responseCheck(result, { status: 422, code: 'validation_failed' }), check(reason === 'minChars', 'errors.q minChars', `errors.q ${String(reason)}`)];
    },
  ],
  [
    '200 con query ab',
    (result) => {
      const query = textField(result.body, 'query');
      return [statusCheck(result, 200, 'respuesta 200'), check(query === 'ab', 'query ab', `query ${query ?? '(ausente)'}`)];
    },
  ],
  [
    '200 con query zz y groups vacío',
    (result) => {
      const query = textField(result.body, 'query');
      return [statusCheck(result, 200, 'respuesta 200'), check(query === 'zz', 'query zz', `query ${query ?? '(ausente)'}`), emptyGroupsCheck(result)];
    },
  ],
]);

const minChars: ApiRowHandler = async (row) => {
  const expected = cell(row, 'respuesta');
  const sent = strict('q_enviada', SENT, cell(row, 'q_enviada'));
  const checks = strict('respuesta', RESPONSES, expected);
  await resetTenants([TENANT_A]);
  const started = await startSession(TENANT_A, DEMO.gestor);
  if (!started.session) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión', started.result);
  const result = await searchAs(TENANT_A, started.session.accessToken, sent);
  return conclude(checks(result));
};

defineApiRows({
  story: 'US-NAVEGACION-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([[1, minChars]]),
});
