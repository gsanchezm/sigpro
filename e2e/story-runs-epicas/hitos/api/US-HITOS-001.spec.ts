import { field } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  BOOLEANO,
  CREDENTIAL_OF,
  TENANT_A,
  TENANT_B,
  countOf,
  itemsOf,
  listMilestones,
  milestoneOf,
  orderCheck,
  prepareCopyInB,
  request,
  resetTenants,
  sentTokenOf,
  textField,
  tokenFor,
} from './common';

// US-HITOS-001 — Listar los hitos de un programa por fecha límite (API). Preparación de cada fila: reinicio de alumno01 con el token
// de su administrador y, después, inicio de sesión de la cuenta de la fila en alumno01 (x-tenant: alumno01). La fila de PRG-025
// necesita la copia de PRG-001 en alumno02: alumno02 se reinicia antes y después.

// --- Esquema 1: la lista trae los hitos del programa en orden de fecha límite ---------------------------------------------------

const listOrder: ApiRowHandler = async (row) => {
  const programa = cell(row, 'programa');
  const total = countOf(cell(row, 'total'));
  const primero = cell(row, 'primero');
  const ultimo = cell(row, 'ultimo');
  const cumplidos = countOf(cell(row, 'cumplidos'));
  const expected = `respuesta 200 con ${total} hitos, el primero ${primero}, el último ${ultimo} y ${cumplidos} con done verdadero`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const result = await listMilestones(gestor.token, programa);
  const items = itemsOf(result);
  const done = items.filter((item) => field(item, 'done') === true).length;
  return conclude([
    responseCheck(result, { status: 200 }),
    check(items.length === total, `${total} hitos`, `${items.length} hitos`),
    check(textField(items[0], 'id') === primero, `el primero es ${primero}`, `el primero es ${String(textField(items[0], 'id'))}`),
    check(textField(items[items.length - 1], 'id') === ultimo, `el último es ${ultimo}`, `el último es ${String(textField(items[items.length - 1], 'id'))}`),
    check(done === cumplidos, `${cumplidos} con done verdadero`, `${done} con done verdadero`),
    orderCheck(items),
  ]);
};

// --- Esquema 2: cada hito trae su nombre, su avance y si está cumplido ----------------------------------------------------------

const hitoDatos: ApiRowHandler = async (row) => {
  const programa = cell(row, 'programa');
  const id = cell(row, 'id');
  const nombre = cell(row, 'nombre');
  const avance = countOf(cell(row, 'avance'));
  const cumplido = strict('cumplido', BOOLEANO, cell(row, 'cumplido'));
  const expected = `el hito ${id} trae name ${nombre}, progress ${avance} y done ${String(cumplido)}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const result = await listMilestones(gestor.token, programa);
  const item = milestoneOf(itemsOf(result), id);
  return conclude([
    responseCheck(result, { status: 200 }),
    check(item !== undefined, `el hito ${id} está en la lista de ${programa}`, item === undefined ? `${id} no está en la lista` : `${id} está en la lista`),
    check(textField(item, 'name') === nombre, `name ${nombre}`, `name ${String(field(item, 'name'))}`),
    check(field(item, 'progress') === avance, `progress ${avance}`, `progress ${String(field(item, 'progress'))}`),
    check(field(item, 'done') === cumplido, `done ${String(cumplido)}`, `done ${String(field(item, 'done'))}`),
  ]);
};

// --- Esquema 3: un código que no es un programa del tenant responde 404 --------------------------------------------------------

/** Situación de la fila → si hay que crear antes la copia PRG-025 en alumno02. */
const SITUACION: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no existe ningún programa con ese código en ningún tenant', false],
  ['en alumno02 se ha duplicado PRG-001 durante la preparación y la copia tiene ese código', true],
]);

const notFound: ApiRowHandler = async (row) => {
  const programa = cell(row, 'programa');
  const duplica = strict('situacion', SITUACION, cell(row, 'situacion'));
  const expected = 'respuesta 404 program_not_found';
  try {
    await resetTenants([TENANT_A]);
    if (duplica) {
      const copy = await prepareCopyInB();
      if (copy !== undefined) return preparationFailed(expected, copy.step, copy.result);
    }
    const gestor = await tokenFor('gestor');
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
    const result = await request('GET', TENANT_A, `/programs/${programa}/milestones`, gestor.token);
    return conclude([responseCheck(result, { status: 404, code: 'program_not_found' })]);
  } finally {
    if (duplica) await resetTenants([TENANT_B]);
  }
};

// --- Esquema 4: solo entrega la lista quien tiene una sesión válida ------------------------------------------------------------

interface ListaEsperada {
  readonly status: number;
  readonly code?: string;
  /** Número de hitos que la historia cita para una respuesta 200. */
  readonly total?: number;
}

const RESPUESTA_LISTA: ReadonlyMap<string, ListaEsperada> = new Map<string, ListaEsperada>([
  ['401 missing_token', { status: 401, code: 'missing_token' }],
  ['401 invalid_token', { status: 401, code: 'invalid_token' }],
  ['200 con 9 hitos', { status: 200, total: 9 }],
]);

const auth: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const esperada = strict('respuesta', RESPUESTA_LISTA, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const sent = await sentTokenOf(credential);
  if (sent.failed !== undefined) return preparationFailed(expected, 'la cuenta de la fila inicia sesión en alumno01 y recibe accessToken', sent.failed.last);
  const result = await listMilestones(sent.token, 'PRG-001');
  const checks: Check[] = [responseCheck(result, { status: esperada.status, ...(esperada.code === undefined ? {} : { code: esperada.code }) })];
  if (esperada.total !== undefined) checks.push(check(itemsOf(result).length === esperada.total, `${esperada.total} hitos`, `${itemsOf(result).length} hitos`));
  return conclude(checks);
};

defineApiRows({
  story: 'US-HITOS-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, listOrder],
    [2, hitoDatos],
    [3, notFound],
    [4, auth],
  ]),
});
