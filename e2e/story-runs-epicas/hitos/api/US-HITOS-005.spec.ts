import { field } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  CREDENTIAL_OF,
  TENANT_A,
  TENANT_B,
  countOf,
  itemsOf,
  listMilestones,
  milestoneOf,
  prepareM10InB,
  rechazoCheck,
  request,
  resetTenants,
  sentTokenOf,
  tokenFor,
  type Rechazo,
} from './common';

// US-HITOS-005 — Eliminar un hito del programa (API). Preparación de cada fila: reinicio de alumno01 con el token de su administrador;
// después, inicio de sesión de la cuenta de la fila en alumno01 (x-tenant: alumno01). La fila del hito de otro tenant crea PRG-001-M10
// en alumno02 y reinicia alumno02 al terminar.

// --- Esquema 1: eliminar un hito responde 204 y lo quita de la lista -----------------------------------------------------------

const deleteRemoves: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const expected = `respuesta 204 y la lista de PRG-001 tiene 8 hitos sin ${hito}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const borrado = await request('DELETE', TENANT_A, `/milestones/${hito}`, gestor.token);
  const lista = await listMilestones(gestor.token, 'PRG-001');
  const items = itemsOf(lista);
  return conclude([
    responseCheck(borrado, { status: 204 }),
    check(items.length === 8, '8 hitos en la lista', `${items.length} hitos en la lista`),
    check(milestoneOf(items, hito) === undefined, `${hito} fuera de la lista`, milestoneOf(items, hito) === undefined ? `${hito} fuera de la lista` : `${hito} sigue en la lista`),
  ]);
};

// --- Esquema 2: el avance del programa se calcula sin el hito eliminado --------------------------------------------------------

const programAfterDelete: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const programa = cell(row, 'programa');
  const progreso = countOf(cell(row, 'progreso'));
  const cumplidos = countOf(cell(row, 'cumplidos'));
  const expected = `respuesta 204 y el programa ${programa} con progress ${progreso}, milestonesDone ${cumplidos} y milestonesTotal 8`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const borrado = await request('DELETE', TENANT_A, `/milestones/${hito}`, gestor.token);
  const ficha = await request('GET', TENANT_A, `/programs/${programa}`, gestor.token);
  return conclude([
    responseCheck(borrado, { status: 204 }),
    responseCheck(ficha, { status: 200 }),
    check(field(ficha.body, 'progress') === progreso, `progress ${progreso}`, `progress ${String(field(ficha.body, 'progress'))}`),
    check(field(ficha.body, 'milestonesDone') === cumplidos, `milestonesDone ${cumplidos}`, `milestonesDone ${String(field(ficha.body, 'milestonesDone'))}`),
    check(field(ficha.body, 'milestonesTotal') === 8, 'milestonesTotal 8', `milestonesTotal ${String(field(ficha.body, 'milestonesTotal'))}`),
  ]);
};

// --- Esquema 3: un hito que no existe en el tenant responde 404 ----------------------------------------------------------------

const SITUACION: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no existe ningún hito con ese id', false],
  ['en alumno02 se ha creado ese hito durante la preparación y en alumno01 no existe', true],
]);

const unknownMilestone: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const enOtroTenant = strict('situacion', SITUACION, cell(row, 'situacion'));
  const expected = 'respuesta 404 milestone_not_found y la lista de PRG-001 sigue con 9 hitos';
  try {
    await resetTenants([TENANT_A]);
    if (enOtroTenant) {
      const creado = await prepareM10InB();
      if (creado !== undefined) return preparationFailed(expected, creado.step, creado.result);
    }
    const gestor = await tokenFor('gestor');
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
    const borrado = await request('DELETE', TENANT_A, `/milestones/${hito}`, gestor.token);
    const lista = await listMilestones(gestor.token, 'PRG-001');
    return conclude([
      responseCheck(borrado, { status: 404, code: 'milestone_not_found' }),
      check(itemsOf(lista).length === 9, 'la lista de PRG-001 sigue con 9 hitos', `la lista de PRG-001 tiene ${itemsOf(lista).length} hitos`),
    ]);
  } finally {
    if (enOtroTenant) await resetTenants([TENANT_B]);
  }
};

// --- Esquema 4: solo admin y program_manager eliminan hitos --------------------------------------------------------------------

const RESPUESTA_BORRADO: ReadonlyMap<string, Rechazo | { readonly status: 204 }> = new Map<string, Rechazo | { readonly status: 204 }>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['204', { status: 204 }],
]);

const permissions: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const hito = cell(row, 'hito');
  const esperada = strict('respuesta', RESPUESTA_BORRADO, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const sent = await sentTokenOf(credential);
  if (sent.failed !== undefined) return preparationFailed(expected, 'la cuenta de la fila inicia sesión en alumno01 y recibe accessToken', sent.failed.last);
  const result = await request('DELETE', TENANT_A, `/milestones/${hito}`, sent.token);
  const checks: Check[] = 'code' in esperada ? [rechazoCheck(result, esperada)] : [responseCheck(result, { status: esperada.status })];
  return conclude(checks);
};

defineApiRows({
  story: 'US-HITOS-005',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, deleteRemoves],
    [2, programAfterDelete],
    [3, unknownMilestone],
    [4, permissions],
  ]),
});
