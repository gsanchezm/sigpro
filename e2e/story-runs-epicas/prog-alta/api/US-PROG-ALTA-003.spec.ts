import { field, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { credentialsOf, EDITABLE_KEYS, fieldCheck, getProgram, resetTenants, seedPrg001Check, seedReady, sessionFor, snapshotOf, TENANT_A, updateProgram, API_FIELD } from './common';

// US-PROG-ALTA-003 — Editar un programa enviando solo los campos que cambian (API). Preparación de cada fila: reinicio de alumno01,
// inicio de sesión de gestor@sigpro.test y PRG-001 con los datos de la semilla. Antes de editar se guarda una foto de PRG-001: el
// resto de campos debe seguir igual que esa foto (que la preparación ya comprobó contra lo que dice la historia).

const GESTOR = 'gestor@sigpro.test';

// --- Esquema 1: un campo enviado cambia y el resto del programa no cambia -------------------------------------------------------

/** Valor de la celda → valor del cuerpo JSON (los booleanos y los importes no viajan como texto). */
const VALUE_OF: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['Radar nuevo de prueba', 'Radar nuevo de prueba'],
  ['Descripción nueva', 'Descripción nueva'],
  ['u3', 'u3'],
  ['on_hold', 'on_hold'],
  ['high', 'high'],
  ['false', false],
  ['500000', 500000],
]);

/** Campos del programa que cambian al editar cada campo de la tabla, con el valor que la historia dice que quedan. */
const CHANGED: ReadonlyMap<string, readonly (readonly [key: string, expected: unknown])[]> = new Map<string, readonly (readonly [string, unknown])[]>([
  ['nombre', [['name', 'Radar nuevo de prueba']]],
  ['descripción', [['description', 'Descripción nueva']]],
  ['propietario', [['ownerId', 'u3'], ['ownerName', 'Lucía Fernández']]],
  ['estado', [['status', 'on_hold']]],
  ['prioridad', [['priority', 'high']]],
  ['clasificado', [['classified', false]]],
  ['presupuesto', [['budgetEur', 500000]]],
]);

const editOneField: ApiRowHandler = async (row) => {
  const expected = `respuesta 200 con el campo ${cell(row, 'campo')} como ${cell(row, 'resultado')}; el resto de PRG-001 igual que la semilla`;
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last);
  const token = session.token;
  const before = await getProgram(token, 'PRG-001');
  if (before.status !== 200) return preparationFailed(expected, 'PRG-001 existe tras el reinicio', before);
  const seedCheck = seedPrg001Check(before.body);
  if (!seedCheck.ok) return preparationFailed(expected, 'PRG-001 tiene los datos de la semilla', before);

  const campo = cell(row, 'campo');
  const apiKey = strict('campo', API_FIELD, campo);
  const value = strict('valor', VALUE_OF, cell(row, 'valor'));
  const changes = strict('campo', CHANGED, campo);
  const result: ApiResult = await updateProgram(token, 'PRG-001', { [apiKey]: value });

  const changedKeys = changes.map(([key]) => key);
  const restKeys = EDITABLE_KEYS.filter((key) => !changedKeys.includes(key));
  const snapshot = snapshotOf(before.body);
  const restChecks: Check[] = restKeys.map((key) => {
    const observed = field(result.body, key);
    return check(observed === snapshot[key], `${key} sin cambios`, `${key} ${String(observed)} (antes ${String(snapshot[key])})`);
  });

  return conclude([
    responseCheck(result, { status: 200 }),
    ...changes.map(([key, wanted]) => fieldCheck(result.body, key, wanted, key)),
    ...restChecks,
  ]);
};

// --- Esquema 2: solo un programa existente en el tenant se edita ----------------------------------------------------------------

const ANSWERS: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['200 con el nombre Radar nuevo de prueba', (result) => [responseCheck(result, { status: 200 }), fieldCheck(result.body, 'name', 'Radar nuevo de prueba', 'nombre')]],
  ['404 program_not_found', (result) => [responseCheck(result, { status: 404, code: 'program_not_found' })]],
]);

const onlyExisting: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last);
  const seed = await seedReady(session.token);
  if (!seed.ok) return preparationFailed(expected, 'el tenant tiene la semilla (PRG-001 a PRG-024) tras el reinicio', seed.result);
  const answer = strict('respuesta', ANSWERS, cell(row, 'respuesta'));
  const result = await updateProgram(session.token, cell(row, 'codigo'), { name: 'Radar nuevo de prueba' });
  return conclude(answer(result));
};

defineApiRows({
  story: 'US-PROG-ALTA-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, editOneField],
    [2, onlyExisting],
  ]),
});
