import { field } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler, type ManifestRow } from '../../core/framework';
import {
  AVANCE_TEXTO,
  BOOLEANO,
  TENANT_A,
  countOf,
  echoChecks,
  itemsOf,
  listMilestones,
  milestoneOf,
  programOf,
  rechazoCheck,
  request,
  resetTenants,
  tokenFor,
  type Rechazo,
} from './common';

// US-HITOS-004 — Registrar el avance de un hito: con el 100 % queda cumplido (API). Preparación de cada fila: reinicio de alumno01 con
// el token de su administrador; después, inicio de sesión de gestor@sigpro.test en alumno01 (x-tenant: alumno01). Las filas comprueban
// que el hito tiene el avance del seed antes de moverlo: si no lo tiene, la preparación no se cumple.

const PREPARA = 'gestor@sigpro.test inicia sesión y recibe accessToken';

/** Nota de la decisión abierta: el avance 99 no es múltiplo de 5 y la historia no lo afirma. */
const NOTA_99 = 'El avance 99 no es múltiplo de 5: la historia no afirma ese requisito (decisión pendiente «múltiplos de 5»), así que el valor se prueba tal cual.';

/** Total de hitos que la propia fila dice en su Entonces («milestonesTotal 9»): se lee de los pasos resueltos, no de una constante. */
const totalOf = (row: ManifestRow): number => {
  const match = /milestonesTotal (\d+)/.exec(row.resolvedSteps.join(' '));
  if (!match?.[1]) throw new Error(`celda sin interpretación: milestonesTotal no aparece en los pasos de ${row.rowId}`);
  return Number(match[1]);
};

// --- Esquema 1: el avance guardado marca el cumplido solo con el 100 % -------------------------------------------------------

const doneWithProgress: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const previo = countOf(cell(row, 'previo'));
  const avance = countOf(cell(row, 'avance'));
  const cumplido = strict('cumplido', BOOLEANO, cell(row, 'cumplido'));
  const expected = `respuesta 200 con progress ${avance} y done ${String(cumplido)}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, PREPARA, gestor.last);
  const antes = await listMilestones(gestor.token, programOf(hito));
  const before = milestoneOf(itemsOf(antes), hito);
  if (before === undefined || field(before, 'progress') !== previo) {
    return preparationFailed(expected, `${hito} tiene el avance del seed (${previo} %)`, antes);
  }
  const result = await request('PATCH', TENANT_A, `/milestones/${hito}`, gestor.token, { progress: avance });
  return conclude(
    [responseCheck(result, { status: 200 }), ...echoChecks(result, { progress: avance, done: cumplido })],
    avance === 99 ? { note: NOTA_99 } : {},
  );
};

// --- Esquema 2: el avance acepta solo enteros de 0 a 100 ----------------------------------------------------------------------

/** Respuesta esperada: rechazo por `progress`, o 200 con el avance y el cumplido que la historia cita. */
type AvanceEsperado = Rechazo | { readonly status: 200; readonly progress: number; readonly done: boolean };

const RESPUESTA_AVANCE: ReadonlyMap<string, AvanceEsperado> = new Map<string, AvanceEsperado>([
  ['422 validation_failed con el motivo progressInvalid en progress', { status: 422, code: 'validation_failed', campo: 'progress', motivo: 'progressInvalid' }],
  ['200 con progress 0 y done falso', { status: 200, progress: 0, done: false }],
  ['200 con progress 100 y done verdadero', { status: 200, progress: 100, done: true }],
]);

const progressRange: ApiRowHandler = async (row) => {
  const avance = strict('avance', AVANCE_TEXTO, cell(row, 'avance'));
  const esperada = strict('respuesta', RESPUESTA_AVANCE, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, PREPARA, gestor.last);
  const antes = await listMilestones(gestor.token, 'PRG-001');
  const before = milestoneOf(itemsOf(antes), 'PRG-001-M02');
  if (before === undefined || field(before, 'progress') !== 10) return preparationFailed(expected, 'PRG-001-M02 tiene el avance del seed (10 %)', antes);
  const result = await request('PATCH', TENANT_A, '/milestones/PRG-001-M02', gestor.token, { progress: avance });
  const nota = avance === 99 ? { note: NOTA_99 } : {};
  if ('progress' in esperada) {
    return conclude([responseCheck(result, { status: 200 }), ...echoChecks(result, { progress: esperada.progress, done: esperada.done })], nota);
  }
  // La regla dice «no cambia nada»: tras el rechazo, el hito sigue con su avance del seed
  const despues = await listMilestones(gestor.token, 'PRG-001');
  const after = milestoneOf(itemsOf(despues), 'PRG-001-M02');
  return conclude(
    [
      rechazoCheck(result, esperada),
      check(field(after, 'progress') === 10 && field(after, 'done') === false, 'el hito sigue con progress 10 y done falso', `progress ${String(field(after, 'progress'))} y done ${String(field(after, 'done'))}`),
    ],
    nota,
  );
};

// --- Esquema 3: el avance del programa refleja sus hitos cumplidos -------------------------------------------------------------

const programProgress: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const avance = countOf(cell(row, 'avance'));
  const programa = cell(row, 'programa');
  const progreso = countOf(cell(row, 'progreso'));
  const cumplidos = countOf(cell(row, 'cumplidos'));
  const total = totalOf(row);
  const expected = `PATCH 200 y el programa ${programa} con progress ${progreso}, milestonesDone ${cumplidos} y milestonesTotal ${total}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, PREPARA, gestor.last);
  const patch = await request('PATCH', TENANT_A, `/milestones/${hito}`, gestor.token, { progress: avance });
  const ficha = await request('GET', TENANT_A, `/programs/${programa}`, gestor.token);
  const checks: Check[] = [
    responseCheck(patch, { status: 200 }),
    responseCheck(ficha, { status: 200 }),
    check(field(ficha.body, 'progress') === progreso, `progress ${progreso}`, `progress ${String(field(ficha.body, 'progress'))}`),
    check(field(ficha.body, 'milestonesDone') === cumplidos, `milestonesDone ${cumplidos}`, `milestonesDone ${String(field(ficha.body, 'milestonesDone'))}`),
    check(field(ficha.body, 'milestonesTotal') === total, `milestonesTotal ${total}`, `milestonesTotal ${String(field(ficha.body, 'milestonesTotal'))}`),
  ];
  return conclude(checks, avance === 99 ? { note: NOTA_99 } : {});
};

defineApiRows({
  story: 'US-HITOS-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, doneWithProgress],
    [2, progressRange],
    [3, programProgress],
  ]),
});
