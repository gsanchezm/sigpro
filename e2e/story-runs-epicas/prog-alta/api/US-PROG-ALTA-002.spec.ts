import { field, type ApiResult } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { API_FIELD, baseBody, createProgram, fieldCheck, noProgramCreated, reasonCheck, resetTenants, seedReady, sessionFor, TENANT_A, credentialsOf } from './common';

// US-PROG-ALTA-002 — Rechazar el alta con un motivo por cada dato no válido (API). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador; después gestor@sigpro.test inicia sesión. Un 422 no crea nada: se comprueba que el tenant sigue
// con la semilla y que PRG-025 no existe.

const GESTOR = 'gestor@sigpro.test';

/** Estado inicial de cada fila: el token de gestor, o el fallo de preparación que impide empezar. */
type Prepared = { readonly token: string } | { readonly failed: Outcome };

/** Inicio de sesión de gestor y semilla; si falla, la fila no empieza (preparationFailed). */
const preparedToken = async (expected: string): Promise<Prepared> => {
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return { failed: preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last) };
  const seed = await seedReady(session.token);
  if (!seed.ok) return { failed: preparationFailed(expected, 'el tenant tiene la semilla (PRG-001 a PRG-024) tras el reinicio', seed.result) };
  return { token: session.token };
};

/** Un 422 de validación sin programa creado: la respuesta y que no se creó nada (la historia lo da por hecho en cada rechazo). */
const rejectedWithoutProgram = async (token: string, result: ApiResult, motive: { readonly key: string; readonly motive?: string }, expectedCode = 'validation_failed') => [
  responseCheck(result, { status: 422, code: expectedCode }),
  reasonCheck(result, motive.key, motive.motive),
  ...(await noProgramCreated(token)),
];

// --- Esquema 1: un cuerpo al que le falta un campo obligatorio no crea el programa -----------------------------------------------

const missingField: ApiRowHandler = async (row) => {
  const expected = `respuesta 422 validation_failed con un motivo para ${cell(row, 'campo')} y no se crea ningún programa`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const key = strict('campo', API_FIELD, cell(row, 'campo'));
  const body = baseBody();
  delete body[key];
  const result = await createProgram(prepared.token, body);
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key }));
};

// --- Esquema 2: el nombre tiene al menos tres caracteres sin contar los espacios de los extremos -------------------------------

const NAME_VALUE: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['(vacío)', ''],
  ['ab', 'ab'],
  ['abc', 'abc'],
  ['(abc con espacios delante y detrás)', '   abc   '],
]);

/** Respuestas posibles del Esquema 2 (la tabla): el alta crea o el 422 rechaza. Otro texto lanza. */
const NAME_ANSWER: ReadonlyMap<string, 'created' | 'rejected'> = new Map<string, 'created' | 'rejected'>([
  ['422 validation_failed con motivo requiredName en nombre', 'rejected'],
  ['201 con el nombre abc', 'created'],
]);

const nameLength: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const value = strict('nombre', NAME_VALUE, cell(row, 'nombre'));
  const result = await createProgram(prepared.token, { ...baseBody(), name: value });
  if (strict('respuesta', NAME_ANSWER, cell(row, 'respuesta')) === 'created') {
    return conclude([responseCheck(result, { status: 201 }), fieldCheck(result.body, 'name', 'abc', 'nombre')]);
  }
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'name', motive: 'requiredName' }));
};

// --- Esquema 3: el propietario debe ser una persona del tenant -----------------------------------------------------------------

const OWNER_VALUE: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['(vacío)', ''],
  ['u99', 'u99'],
  ['u7', 'u7'],
]);

const OWNER_ANSWER: ReadonlyMap<string, 'created' | 'rejected'> = new Map<string, 'created' | 'rejected'>([
  ['422 validation_failed con motivo requiredOwner en propietario', 'rejected'],
  ['201 con ownerName Alumno 01', 'created'],
]);

const ownerRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const value = strict('propietario', OWNER_VALUE, cell(row, 'propietario'));
  const result = await createProgram(prepared.token, { ...baseBody(), ownerId: value });
  if (strict('respuesta', OWNER_ANSWER, cell(row, 'respuesta')) === 'created') {
    return conclude([responseCheck(result, { status: 201 }), fieldCheck(result.body, 'ownerName', 'Alumno 01', 'ownerName')]);
  }
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'ownerId', motive: 'requiredOwner' }));
};

// --- Esquema 4: fechas con formato AAAA-MM-DD y fin posterior al inicio -------------------------------------------------------

const DATE_VALUE: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['(vacío)', ''],
  ['01/03/2027', '01/03/2027'],
  ['2027-3-1', '2027-3-1'],
  ['2027-03-01', '2027-03-01'],
  ['2027-03-02', '2027-03-02'],
]);

/** Respuestas del Esquema 4: el alta crea, o el 422 se debe al fin (`en fin`) o al inicio (`en inicio`). */
const DATE_ANSWER: ReadonlyMap<string, 'created' | 'endAfterStart' | 'requiredStart'> = new Map<string, 'created' | 'endAfterStart' | 'requiredStart'>([
  ['201 con startDate 2027-03-01 y endDate 2027-03-02', 'created'],
  ['422 validation_failed con motivo endAfterStart en fin', 'endAfterStart'],
  ['422 validation_failed con motivo requiredStart en inicio', 'requiredStart'],
]);

const dateRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const start = strict('inicio', DATE_VALUE, cell(row, 'inicio'));
  const end = strict('fin', DATE_VALUE, cell(row, 'fin'));
  const result = await createProgram(prepared.token, { ...baseBody(), startDate: start, endDate: end });
  const answer = strict('respuesta', DATE_ANSWER, cell(row, 'respuesta'));
  if (answer === 'created') {
    return conclude([responseCheck(result, { status: 201 }), fieldCheck(result.body, 'startDate', '2027-03-01', 'inicio'), fieldCheck(result.body, 'endDate', '2027-03-02', 'fin')]);
  }
  if (answer === 'endAfterStart') return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'endDate', motive: 'endAfterStart' }));
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'startDate', motive: 'requiredStart' }));
};

// --- Esquema 5: el presupuesto debe ser mayor que cero ------------------------------------------------------------------------

const BUDGET_VALUE: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['0', 0],
  ['-1', -1],
  ['(900000 como texto)', '900000'],
  ['(vacío)', ''],
  ['1', 1],
]);

const BUDGET_ANSWER: ReadonlyMap<string, 'created' | 'rejected'> = new Map<string, 'created' | 'rejected'>([
  ['422 validation_failed con motivo budgetPositive en presupuesto', 'rejected'],
  ['201 con budgetEur 1', 'created'],
]);

const budgetRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const value = strict('presupuesto', BUDGET_VALUE, cell(row, 'presupuesto'));
  const result = await createProgram(prepared.token, { ...baseBody(), budget: value });
  if (strict('respuesta', BUDGET_ANSWER, cell(row, 'respuesta')) === 'created') {
    return conclude([responseCheck(result, { status: 201 }), fieldCheck(result.body, 'budgetEur', 1, 'budgetEur')]);
  }
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'budget', motive: 'budgetPositive' }));
};

// --- Esquema 6: prioridad, clasificación, estado y descripción admiten solo sus valores -----------------------------------

/** Valor de la celda: «(sin el campo)» no envía el campo; el resto de textos tienen su valor del cuerpo. */
const RULE_VALUE: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ['(sin el campo)', undefined],
  ['high', 'high'],
  ['urgente', 'urgente'],
  ['true', true],
  ['sí', 'sí'],
  ['finalizado', 'finalizado'],
  ['(2000 caracteres)', 'a'.repeat(2000)],
  ['(2001 caracteres)', 'a'.repeat(2001)],
]);

/** Respuesta del Esquema 6: el alta crea con un valor (o con el valor por defecto que la historia nombra), o el 422 de ese campo. */
type OptionAnswer =
  | { readonly created: true; readonly key?: string; readonly value?: unknown; readonly described?: number }
  | { readonly created: false };

const OPTION_ANSWER: ReadonlyMap<string, OptionAnswer> = new Map<string, OptionAnswer>([
  ['201 con priority medium', { created: true, key: 'priority', value: 'medium' }],
  ['201 con priority high', { created: true, key: 'priority', value: 'high' }],
  ['422 validation_failed con un motivo para priority', { created: false }],
  ['201 con classified false', { created: true, key: 'classified', value: false }],
  ['201 con classified true', { created: true, key: 'classified', value: true }],
  ['422 validation_failed con un motivo para classified', { created: false }],
  ['201 con status draft', { created: true, key: 'status', value: 'draft' }],
  ['422 validation_failed con un motivo para status', { created: false }],
  ['201 con la descripción de 2000 caracteres', { created: true, described: 2000 }],
  ['422 validation_failed con un motivo para description', { created: false }],
]);

const optionRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const apiKey = strict('campo', API_FIELD, cell(row, 'campo'));
  const body = baseBody();
  const value = strict('valor', RULE_VALUE, cell(row, 'valor'));
  if (value !== undefined) body[apiKey] = value;
  const result = await createProgram(prepared.token, body);
  const answer = strict('respuesta', OPTION_ANSWER, cell(row, 'respuesta'));
  if (!answer.created) return conclude(await rejectedWithoutProgram(prepared.token, result, { key: apiKey }));
  const checks: Check[] = [responseCheck(result, { status: 201 })];
  // «con priority medium», «con classified false»…: el valor por defecto que la historia nombra
  if (answer.key !== undefined) checks.push(fieldCheck(result.body, answer.key, answer.value, answer.key));
  if (answer.described !== undefined) {
    const described = field(result.body, 'description');
    checks.push(check(typeof described === 'string' && described.length === answer.described, `la descripción de ${answer.described} caracteres`, `la descripción de ${typeof described === 'string' ? described.length : '(sin texto)'} caracteres`));
  }
  return conclude(checks);
};

// --- Esquema 7: un nombre repetido o con «duplicado» no crea el programa -----------------------------------------------------

const duplicateName: ApiRowHandler = async (row) => {
  const expected = `respuesta 422 duplicate_name con motivo dupName en nombre y no se crea ningún programa (nombre ${cell(row, 'nombre')})`;
  const prepared = await preparedToken(expected);
  if ('failed' in prepared) return prepared.failed;
  const result = await createProgram(prepared.token, { ...baseBody(), name: cell(row, 'nombre') });
  return conclude(await rejectedWithoutProgram(prepared.token, result, { key: 'name', motive: 'dupName' }, 'duplicate_name'));
};

defineApiRows({
  story: 'US-PROG-ALTA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, missingField],
    [2, nameLength],
    [3, ownerRule],
    [4, dateRule],
    [5, budgetRule],
    [6, optionRule],
    [7, duplicateName],
  ]),
});
