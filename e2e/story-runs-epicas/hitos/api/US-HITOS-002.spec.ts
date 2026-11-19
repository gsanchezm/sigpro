import { field } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  AVANCE_TEXTO,
  CREDENTIAL_OF,
  NOMBRE_TEXTO,
  TENANT_A,
  TENANT_B,
  VALOR_TEXTO,
  countMilestones,
  nothingCreatedCheck,
  prepareCopyInB,
  request,
  rechazoCheck,
  resetTenants,
  sentTokenOf,
  textField,
  tokenFor,
  type Rechazo,
} from './common';

// US-HITOS-002 — Crear un hito con nombre y fecha límite en un programa (API). Preparación de cada fila: reinicio de alumno01 con el token de
// su administrador; después, inicio de sesión de la cuenta de la fila (gestor por defecto) en alumno01 (x-tenant: alumno01). Si la fila dice
// que se ha borrado PRG-001-M03, la preparación lo borra con DELETE antes del alta. La fila PRG-025 usa la copia en alumno02.

const FECHA_NUEVA = '2027-03-15';
const NOMBRE_NUEVO = 'Revisión de diseño';

/** «creada» = 201 con los campos que la historia cita (el nombre recortado). */
const CREADA = 'creada';

// --- Esquema 1: alta válida sin avance y con el número siguiente del programa -------------------------------------------------

const PREPARACION: ReadonlyMap<string, 'ninguna' | 'borrarM03'> = new Map<string, 'ninguna' | 'borrarM03'>([
  ['no ha borrado ningún hito', 'ninguna'],
  ['ha borrado PRG-001-M03 con DELETE /api/milestones/PRG-001-M03', 'borrarM03'],
]);

const createValid: ApiRowHandler = async (row) => {
  const preparacion = strict('preparacion', PREPARACION, cell(row, 'preparacion'));
  const nombre = strict('nombre', NOMBRE_TEXTO, cell(row, 'nombre'));
  const id = cell(row, 'id');
  const guardado = cell(row, 'guardado');
  const expected = `respuesta 201 con id ${id}, name ${guardado}, dueDate ${FECHA_NUEVA}, progress 0 y done falso`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  if (preparacion === 'borrarM03') {
    const borrado = await request('DELETE', TENANT_A, '/milestones/PRG-001-M03', gestor.token);
    if (borrado.status !== 204) return preparationFailed(expected, 'DELETE /api/milestones/PRG-001-M03 con gestor@sigpro.test responde 204', borrado);
  }
  const result = await request('POST', TENANT_A, '/programs/PRG-001/milestones', gestor.token, { name: nombre, dueDate: FECHA_NUEVA });
  return conclude([
    responseCheck(result, { status: 201 }),
    check(textField(result.body, 'id') === id, `id ${id}`, `id ${String(textField(result.body, 'id'))}`),
    check(textField(result.body, 'name') === guardado, `name ${guardado}`, `name ${String(textField(result.body, 'name'))}`),
    check(textField(result.body, 'dueDate') === FECHA_NUEVA, `dueDate ${FECHA_NUEVA}`, `dueDate ${String(textField(result.body, 'dueDate'))}`),
    check(field(result.body, 'progress') === 0, 'progress 0', `progress ${String(field(result.body, 'progress'))}`),
    check(field(result.body, 'done') === false, 'done falso', `done ${String(field(result.body, 'done'))}`),
  ]);
};

// --- Esquema 2: el nombre se valida después de recortar los espacios y debe tener de 2 a 80 caracteres ----------------------

const RESPUESTA_NOMBRE: ReadonlyMap<string, Rechazo | typeof CREADA> = new Map<string, Rechazo | typeof CREADA>([
  ['422 validation_failed con el motivo nameShort en name', { status: 422, code: 'validation_failed', campo: 'name', motivo: 'nameShort' }],
  ['422 validation_failed con el motivo nameLong en name', { status: 422, code: 'validation_failed', campo: 'name', motivo: 'nameLong' }],
  ['201 con name Ab', CREADA],
  ['201 con ese nombre', CREADA],
]);

const nameRule: ApiRowHandler = async (row) => {
  const nombre = strict('nombre', NOMBRE_TEXTO, cell(row, 'nombre'));
  const esperada = strict('respuesta', RESPUESTA_NOMBRE, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const antes = await countMilestones(gestor.token, 'PRG-001');
  const result = await request('POST', TENANT_A, '/programs/PRG-001/milestones', gestor.token, { name: nombre, dueDate: FECHA_NUEVA });
  const despues = await countMilestones(gestor.token, 'PRG-001');
  const checks: Check[] =
    esperada === CREADA
      ? [responseCheck(result, { status: 201 }), check(textField(result.body, 'name') === nombre.trim(), `name ${nombre.trim()}`, `name ${String(textField(result.body, 'name'))}`)]
      : [rechazoCheck(result, esperada), nothingCreatedCheck(antes, despues)];
  return conclude(checks);
};

// --- Esquema 3: la fecha límite tiene la forma AAAA-MM-DD y debe existir en el calendario ------------------------------------

const RESPUESTA_FECHA: ReadonlyMap<string, Rechazo | typeof CREADA> = new Map<string, Rechazo | typeof CREADA>([
  ['422 validation_failed con el motivo dateInvalid en dueDate', { status: 422, code: 'validation_failed', campo: 'dueDate', motivo: 'dateInvalid' }],
  ['422 validation_failed con un motivo en dueDate', { status: 422, code: 'validation_failed', campo: 'dueDate' }],
  ['201 con dueDate 2028-02-29', CREADA],
]);

const dateRule: ApiRowHandler = async (row) => {
  const fecha = strict('fecha', VALOR_TEXTO, cell(row, 'fecha'));
  const esperada = strict('respuesta', RESPUESTA_FECHA, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  // «(sin el campo)» es un cuerpo sin dueDate: no es lo mismo que mandar un texto vacío
  const body = { name: NOMBRE_NUEVO, ...(fecha === undefined ? {} : { dueDate: fecha }) };
  const antes = await countMilestones(gestor.token, 'PRG-001');
  const result = await request('POST', TENANT_A, '/programs/PRG-001/milestones', gestor.token, body);
  const despues = await countMilestones(gestor.token, 'PRG-001');
  const checks: Check[] =
    esperada === CREADA
      ? [responseCheck(result, { status: 201 }), check(textField(result.body, 'dueDate') === fecha, `dueDate ${String(fecha)}`, `dueDate ${String(textField(result.body, 'dueDate'))}`)]
      : [rechazoCheck(result, esperada), nothingCreatedCheck(antes, despues)];
  return conclude(checks);
};

// --- Esquema 4: el avance que envía el cuerpo no cambia el avance inicial --------------------------------------------------------

const progressIgnored: ApiRowHandler = async (row) => {
  const avance = strict('avance', AVANCE_TEXTO, cell(row, 'avance'));
  const expected = 'respuesta 201 con progress 0 y done falso';
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const body = { name: NOMBRE_NUEVO, dueDate: FECHA_NUEVA, ...(avance === undefined ? {} : { progress: avance }) };
  const result = await request('POST', TENANT_A, '/programs/PRG-001/milestones', gestor.token, body);
  return conclude([
    responseCheck(result, { status: 201 }),
    check(field(result.body, 'progress') === 0, 'progress 0', `progress ${String(field(result.body, 'progress'))}`),
    check(field(result.body, 'done') === false, 'done falso', `done ${String(field(result.body, 'done'))}`),
  ]);
};

// --- Esquema 5: solo admin y program_manager crean hitos -----------------------------------------------------------------------

const RESPUESTA_PERMISO: ReadonlyMap<string, Rechazo | { readonly status: 201; readonly id: string }> = new Map<string, Rechazo | { readonly status: 201; readonly id: string }>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['201 con id PRG-001-M10', { status: 201, id: 'PRG-001-M10' }],
]);

const permissions: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const nombre = strict('nombre', NOMBRE_TEXTO, cell(row, 'nombre'));
  const esperada = strict('respuesta', RESPUESTA_PERMISO, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const sent = await sentTokenOf(credential);
  if (sent.failed !== undefined) return preparationFailed(expected, 'la cuenta de la fila inicia sesión en alumno01 y recibe accessToken', sent.failed.last);
  const antes = await countMilestones(sent.token, 'PRG-001');
  const result = await request('POST', TENANT_A, '/programs/PRG-001/milestones', sent.token, { name: nombre, dueDate: FECHA_NUEVA });
  const checks: Check[] =
    'id' in esperada
      ? [responseCheck(result, { status: esperada.status }), check(textField(result.body, 'id') === esperada.id, `id ${esperada.id}`, `id ${String(textField(result.body, 'id'))}`)]
      : [rechazoCheck(result, esperada), nothingCreatedCheck(antes, await countMilestones(sent.token, 'PRG-001'))];
  return conclude(checks);
};

// --- Esquema 6: un programa que no existe en el tenant no admite hitos nuevos -------------------------------------------------

const SITUACION: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no existe ningún programa con ese código en ningún tenant', false],
  ['en alumno02 se ha duplicado PRG-001 durante la preparación y la copia tiene ese código', true],
]);

const unknownProgram: ApiRowHandler = async (row) => {
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
    const result = await request('POST', TENANT_A, `/programs/${programa}/milestones`, gestor.token, { name: NOMBRE_NUEVO, dueDate: FECHA_NUEVA });
    return conclude([responseCheck(result, { status: 404, code: 'program_not_found' })]);
  } finally {
    if (duplica) await resetTenants([TENANT_B]);
  }
};

defineApiRows({
  story: 'US-HITOS-002',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, createValid],
    [2, nameRule],
    [3, dateRule],
    [4, progressIgnored],
    [5, permissions],
    [6, unknownProgram],
  ]),
});
