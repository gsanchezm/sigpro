import { field } from '../../../story-runs/support/api';
import { cell, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { conclude } from './common';
import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { credentialsOf, fieldCheck, getProgram, reasonCheck, resetTenants, seedPrg001Check, sessionFor, snapshotOf, TENANT_A, unchangedChecks, updateProgram } from './common';

// US-PROG-ALTA-004 — Validar la edición: nombre, propietario, fechas y cuerpo vacío (API). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test, PRG-001 con la semilla y PRG-002 «Radar de vigilancia costera RVC-2». Cada
// edición rechazada se comprueba además contra la foto de PRG-001: la regla dice que un rechazo no cambia ningún campo.

const GESTOR = 'gestor@sigpro.test';

/** Estado inicial de cada fila: token y foto de PRG-001 (o el fallo de preparación). */
type Prepared = { readonly token: string; readonly before: Readonly<Record<string, unknown>> } | { readonly failed: Outcome };

const prepare = async (expected: string): Promise<Prepared> => {
  await resetTenants([TENANT_A]);
  const session = await sessionFor(credentialsOf(GESTOR));
  if (session.token === undefined) return { failed: preparationFailed(expected, `${GESTOR} inicia sesión y recibe accessToken`, session.last) };
  const first = await getProgram(session.token, 'PRG-001');
  if (first.status !== 200 || !seedPrg001Check(first.body).ok) return { failed: preparationFailed(expected, 'PRG-001 con los datos de la semilla', first) };
  const second = await getProgram(session.token, 'PRG-002');
  if (field(second.body, 'name') !== 'Radar de vigilancia costera RVC-2') return { failed: preparationFailed(expected, 'PRG-002 es «Radar de vigilancia costera RVC-2»', second) };
  return { token: session.token, before: snapshotOf(first.body) };
};

/** «El programa no cambia»: se lee PRG-001 tras el rechazo y se compara con la foto de antes de la edición. */
const keptChecks = async (token: string, before: Readonly<Record<string, unknown>>): Promise<readonly Check[]> => unchangedChecks(before, (await getProgram(token, 'PRG-001')).body);

// --- Esquema 1: el nombre que se envía debe ser válido y no repetido -------------------------------------------------------------

const NAME_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['ab', 'ab'],
  ['Radar de vigilancia costera RVC-2', 'Radar de vigilancia costera RVC-2'],
  ['radar de vigilancia costera rvc-2', 'radar de vigilancia costera rvc-2'],
  ['Programa DUPLICADO de prueba', 'Programa DUPLICADO de prueba'],
  ['sistema de mando táctico ártemis', 'sistema de mando táctico ártemis'],
]);

/** Respuesta de la tabla → lo que la historia espera: el nombre guardado, o el 422 con su código y su motivo. */
type NameAnswer = { readonly kind: 'ok' } | { readonly kind: 'rejected'; readonly code: string; readonly motive: string };
const NAME_ANSWER: ReadonlyMap<string, NameAnswer> = new Map<string, NameAnswer>([
  ['200 con el nombre sistema de mando táctico ártemis', { kind: 'ok' }],
  ['422 validation_failed con motivo requiredName en nombre', { kind: 'rejected', code: 'validation_failed', motive: 'requiredName' }],
  ['422 duplicate_name con motivo dupName en nombre', { kind: 'rejected', code: 'duplicate_name', motive: 'dupName' }],
]);

const nameRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await prepare(expected);
  if ('failed' in prepared) return prepared.failed;
  const value = strict('nombre', NAME_VALUE, cell(row, 'nombre'));
  const result = await updateProgram(prepared.token, 'PRG-001', { name: value });
  const answer = strict('respuesta', NAME_ANSWER, cell(row, 'respuesta'));
  if (answer.kind === 'ok') return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, 'name', value, 'nombre')]);
  return conclude([
    responseCheck(result, { status: 422, code: answer.code }),
    reasonCheck(result, 'name', answer.motive),
    ...(await keptChecks(prepared.token, prepared.before)),
  ]);
};

// --- Esquema 2: las fechas coherentes se comprueban con la fecha que no se envía -------------------------------------------

/** Fecha de la celda; «(sin el campo)» es que el cuerpo no trae ese campo (`undefined`). */
const DATE_VALUE: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['2024-07-01', '2024-07-01'],
  ['2024-06-30', '2024-06-30'],
  ['(sin el campo)', undefined],
  ['2023-01-01', '2023-01-01'],
  ['2023-01-02', '2023-01-02'],
  ['2025-01-01', '2025-01-01'],
  ['2024-12-31', '2024-12-31'],
  ['2023-03-01', '2023-03-01'],
  ['2023-03-02', '2023-03-02'],
]);

/** Respuesta de la tabla → 200 con las fechas guardadas, o el 422 por el fin. */
type DateAnswer = { readonly kind: 'ok'; readonly startDate: string; readonly endDate: string } | { readonly kind: 'endAfterStart' };
const DATE_ANSWER: ReadonlyMap<string, DateAnswer> = new Map<string, DateAnswer>([
  ['422 validation_failed con motivo endAfterStart en fin', { kind: 'endAfterStart' }],
  ['200 con startDate 2024-06-30 y endDate 2024-07-01', { kind: 'ok', startDate: '2024-06-30', endDate: '2024-07-01' }],
  ['200 con startDate 2023-01-01 y endDate 2023-01-02', { kind: 'ok', startDate: '2023-01-01', endDate: '2023-01-02' }],
  ['200 con startDate 2023-03-01 y endDate 2023-03-02', { kind: 'ok', startDate: '2023-03-01', endDate: '2023-03-02' }],
]);

const dateRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await prepare(expected);
  if ('failed' in prepared) return prepared.failed;
  const body: Record<string, string> = {};
  const start = strict('inicio', DATE_VALUE, cell(row, 'inicio'));
  const end = strict('fin', DATE_VALUE, cell(row, 'fin'));
  if (start !== undefined) body.startDate = start;
  if (end !== undefined) body.endDate = end;
  const result = await updateProgram(prepared.token, 'PRG-001', body);
  const answer = strict('respuesta', DATE_ANSWER, cell(row, 'respuesta'));
  if (answer.kind === 'ok') {
    return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, 'startDate', answer.startDate), fieldCheck(result.body, 'endDate', answer.endDate)]);
  }
  return conclude([
    responseCheck(result, { status: 422, code: 'validation_failed' }),
    reasonCheck(result, 'endDate', 'endAfterStart'),
    ...(await keptChecks(prepared.token, prepared.before)),
  ]);
};

// --- Esquema 3: el propietario, si se envía, debe ser una persona del tenant ------------------------------------------------

const OWNER_VALUE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['u99', 'u99'],
  ['u3', 'u3'],
]);

/** Respuesta de la tabla → 200 con el nombre del responsable nuevo, o el 422 por propietario. */
type OwnerAnswer = { readonly kind: 'ok' } | { readonly kind: 'requiredOwner' };
const OWNER_ANSWER: ReadonlyMap<string, OwnerAnswer> = new Map<string, OwnerAnswer>([
  ['200 con ownerName Lucía Fernández', { kind: 'ok' }],
  ['422 validation_failed con motivo requiredOwner en propietario', { kind: 'requiredOwner' }],
]);

const ownerRule: ApiRowHandler = async (row) => {
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const prepared = await prepare(expected);
  if ('failed' in prepared) return prepared.failed;
  const value = strict('propietario', OWNER_VALUE, cell(row, 'propietario'));
  const result = await updateProgram(prepared.token, 'PRG-001', { ownerId: value });
  const answer = strict('respuesta', OWNER_ANSWER, cell(row, 'respuesta'));
  if (answer.kind === 'ok') return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, 'ownerName', 'Lucía Fernández', 'ownerName')]);
  return conclude([
    responseCheck(result, { status: 422, code: 'validation_failed' }),
    reasonCheck(result, 'ownerId', 'requiredOwner'),
    ...(await keptChecks(prepared.token, prepared.before)),
  ]);
};

// --- Esquema 4: una edición sin campos no cambia el programa --------------------------------------------------------------

/** El cuerpo de la tabla: «(sin campos)» es un objeto vacío. Otro texto lanza. */
const BODY_OF: ReadonlyMap<string, Record<string, never>> = new Map<string, Record<string, never>>([['(sin campos)', {}]]);

const emptyBody: ApiRowHandler = async (row) => {
  const expected = 'respuesta 422 validation_failed y PRG-001 conserva todos sus valores de la semilla';
  const prepared = await prepare(expected);
  if ('failed' in prepared) return prepared.failed;
  const body = strict('cuerpo', BODY_OF, cell(row, 'cuerpo'));
  const result = await updateProgram(prepared.token, 'PRG-001', body);
  return conclude([responseCheck(result, { status: 422, code: 'validation_failed' }), ...(await keptChecks(prepared.token, prepared.before))]);
};

defineApiRows({
  story: 'US-PROG-ALTA-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, nameRule],
    [2, dateRule],
    [3, ownerRule],
    [4, emptyBody],
  ]),
});
