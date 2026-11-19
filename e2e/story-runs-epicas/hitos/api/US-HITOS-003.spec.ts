import { field } from '../../../story-runs/support/api';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  CREDENTIAL_OF,
  TENANT_A,
  TENANT_B,
  VALOR_TEXTO,
  echoChecks,
  itemsOf,
  listMilestones,
  milestoneOf,
  nothingToUpdateCheck,
  prepareM10InB,
  programOf,
  rechazoCheck,
  request,
  resetTenants,
  sentTokenOf,
  textField,
  tokenFor,
  type Rechazo,
} from './common';

// US-HITOS-003 — Editar el nombre y la fecha límite de un hito (API). Preparación de cada fila: reinicio de alumno01 con el token de
// su administrador; después, inicio de sesión de la cuenta de la fila (gestor por defecto) en alumno01 (x-tenant: alumno01). La fila
// del hito de otro tenant crea PRG-001-M10 en alumno02 y lo reinicia al terminar.

// --- Esquema 1: un cambio guarda solo los campos enviados ---------------------------------------------------------------------

/** Lo que se envía y lo que la historia espera de la respuesta 200 («antes» = la fecha que tenía PRG-001-M01 antes del cambio). */
interface Cambio {
  readonly body: Readonly<Record<string, string>>;
  readonly nombre: string;
  readonly fecha: string | 'antes';
  /** El cambio no altera nada: progress y done siguen como estaban. */
  readonly sinCambios: boolean;
  /** Cuerpo sin ningún campo: 422 nothingToUpdate. */
  readonly sinCampos: boolean;
}

const CAMBIOS: ReadonlyMap<string, Cambio> = new Map<string, Cambio>([
  ['solo el nombre (espacios delante y detrás de Revisión PDR)', { body: { name: '   Revisión PDR   ' }, nombre: 'Revisión PDR', fecha: 'antes', sinCambios: false, sinCampos: false }],
  ['solo la fecha límite 2027-03-15', { body: { dueDate: '2027-03-15' }, nombre: 'SRR', fecha: '2027-03-15', sinCambios: false, sinCampos: false }],
  ['el nombre Revisión PDR y la fecha límite 2027-03-15', { body: { name: 'Revisión PDR', dueDate: '2027-03-15' }, nombre: 'Revisión PDR', fecha: '2027-03-15', sinCambios: false, sinCampos: false }],
  ['el nombre SRR, que ya tiene', { body: { name: 'SRR' }, nombre: 'SRR', fecha: 'antes', sinCambios: true, sinCampos: false }],
  ['(sin campos)', { body: {}, nombre: 'SRR', fecha: 'antes', sinCambios: true, sinCampos: true }],
]);

const changeFields: ApiRowHandler = async (row) => {
  const cambio = strict('cambio', CAMBIOS, cell(row, 'cambio'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const antes = await listMilestones(gestor.token, 'PRG-001');
  const before = milestoneOf(itemsOf(antes), 'PRG-001-M01');
  if (before === undefined) return preparationFailed(expected, 'GET /api/programs/PRG-001/milestones lista PRG-001-M01', antes);
  const result = await request('PATCH', TENANT_A, '/milestones/PRG-001-M01', gestor.token, cambio.body);
  if (cambio.sinCampos) return conclude([nothingToUpdateCheck(result)]);
  const fecha = cambio.fecha === 'antes' ? (textField(before, 'dueDate') ?? '') : cambio.fecha;
  const checks: Check[] = [
    responseCheck(result, { status: 200 }),
    check(textField(result.body, 'id') === 'PRG-001-M01', 'el id no cambia (PRG-001-M01)', `id ${String(textField(result.body, 'id'))}`),
    ...echoChecks(result, { name: cambio.nombre, dueDate: fecha }),
  ];
  if (cambio.sinCambios) {
    const same = field(result.body, 'progress') === field(before, 'progress') && field(result.body, 'done') === field(before, 'done');
    checks.push(check(same, 'sin cambios: progress y done como antes', `progress ${String(field(result.body, 'progress'))}, done ${String(field(result.body, 'done'))}`));
  }
  return conclude(checks);
};

// --- Esquema 2: cambiar la fecha límite reordena la lista del programa ---------------------------------------------------------

const FECHA_LIMITE: ReadonlyMap<string, string> = new Map<string, string>([
  ['2027-03-15', '2027-03-15'],
  ['2022-12-31', '2022-12-31'],
]);

const POSICION: ReadonlyMap<string, 'primero' | 'ultimo'> = new Map<string, 'primero' | 'ultimo'>([
  ['el último', 'ultimo'],
  ['el primero', 'primero'],
]);

const reorder: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const fecha = strict('fecha', FECHA_LIMITE, cell(row, 'fecha'));
  const posicion = strict('posicion', POSICION, cell(row, 'posicion'));
  const expected = `PATCH 200 y ${hito} es ${cell(row, 'posicion')} de la lista`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const patch = await request('PATCH', TENANT_A, `/milestones/${hito}`, gestor.token, { dueDate: fecha });
  const lista = await listMilestones(gestor.token, programOf(hito));
  const items = itemsOf(lista);
  const index = items.findIndex((item) => field(item, 'id') === hito);
  const esperado = posicion === 'primero' ? 0 : items.length - 1;
  return conclude([
    responseCheck(patch, { status: 200 }),
    check(index === esperado && index !== -1, `${hito} es ${cell(row, 'posicion')} de la lista`, `${hito} ocupa la posición ${index + 1} de ${items.length}`),
  ]);
};

// --- Esquema 3: el nombre y la fecha límite se validan como en el alta --------------------------------------------------------

/** Respuesta de una edición aceptada: 200 y el campo editado igual que lo enviado. */
const ACEPTADA = 'aceptada';

const CAMPO: ReadonlyMap<string, string> = new Map<string, string>([
  ['name', 'name'],
  ['dueDate', 'dueDate'],
]);

const RESPUESTA_VALIDACION: ReadonlyMap<string, Rechazo | typeof ACEPTADA> = new Map<string, Rechazo | typeof ACEPTADA>([
  ['422 validation_failed con el motivo nameShort en name', { status: 422, code: 'validation_failed', campo: 'name', motivo: 'nameShort' }],
  ['422 validation_failed con el motivo nameLong en name', { status: 422, code: 'validation_failed', campo: 'name', motivo: 'nameLong' }],
  ['200 con ese nombre', ACEPTADA],
  ['200 con name Ab', ACEPTADA],
  ['422 validation_failed con el motivo dateInvalid en dueDate', { status: 422, code: 'validation_failed', campo: 'dueDate', motivo: 'dateInvalid' }],
  ['200 con dueDate 2028-02-29', ACEPTADA],
]);

const validation: ApiRowHandler = async (row) => {
  const campo = strict('campo', CAMPO, cell(row, 'campo'));
  const valor = strict('valor', VALOR_TEXTO, cell(row, 'valor'));
  const esperada = strict('respuesta', RESPUESTA_VALIDACION, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const gestor = await tokenFor('gestor');
  if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
  const result = await request('PATCH', TENANT_A, '/milestones/PRG-001-M01', gestor.token, { [campo]: valor });
  const enviado = valor ?? '';
  const checks: Check[] =
    esperada === ACEPTADA
      ? [responseCheck(result, { status: 200 }), ...echoChecks(result, { [campo]: campo === 'name' ? enviado.trim() : enviado })]
      : [rechazoCheck(result, esperada)];
  return conclude(checks);
};

// --- Esquema 4: solo admin y program_manager editan hitos ----------------------------------------------------------------------

const RESPUESTA_PERMISO: ReadonlyMap<string, Rechazo | typeof ACEPTADA> = new Map<string, Rechazo | typeof ACEPTADA>([
  ['403 forbidden', { status: 403, code: 'forbidden' }],
  ['200 con name Revisión PDR', ACEPTADA],
]);

const NOMBRE_EDICION: ReadonlyMap<string, string> = new Map<string, string>([
  ['Revisión PDR', 'Revisión PDR'],
  ['(tres espacios)', '   '],
]);

const permissions: ApiRowHandler = async (row) => {
  const credential = strict('credencial', CREDENTIAL_OF, cell(row, 'credencial'));
  const nombre = strict('nombre', NOMBRE_EDICION, cell(row, 'nombre'));
  const esperada = strict('respuesta', RESPUESTA_PERMISO, cell(row, 'respuesta'));
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  await resetTenants([TENANT_A]);
  const sent = await sentTokenOf(credential);
  if (sent.failed !== undefined) return preparationFailed(expected, 'la cuenta de la fila inicia sesión en alumno01 y recibe accessToken', sent.failed.last);
  const result = await request('PATCH', TENANT_A, '/milestones/PRG-001-M01', sent.token, { name: nombre });
  const checks: Check[] =
    esperada === ACEPTADA
      ? [responseCheck(result, { status: 200 }), ...echoChecks(result, { name: nombre.trim() })]
      : [rechazoCheck(result, esperada)];
  // Tras un 403 el hito no cambia: se relee la lista con la misma cuenta y el nombre sigue siendo el del seed
  if (esperada !== ACEPTADA) {
    const despues = await listMilestones(sent.token, 'PRG-001');
    const hito = milestoneOf(itemsOf(despues), 'PRG-001-M01');
    checks.push(check(textField(hito, 'name') === 'SRR', 'el nombre de PRG-001-M01 sigue siendo SRR', `el nombre es ${String(textField(hito, 'name'))}`));
  }
  return conclude(checks);
};

// --- Esquema 5: un hito que no existe en el tenant responde 404 ----------------------------------------------------------------

const SITUACION: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no existe ningún hito con ese id', false],
  ['en alumno02 se ha creado ese hito durante la preparación y en alumno01 no existe', true],
]);

const unknownMilestone: ApiRowHandler = async (row) => {
  const hito = cell(row, 'hito');
  const enOtroTenant = strict('situacion', SITUACION, cell(row, 'situacion'));
  const expected = 'respuesta 404 milestone_not_found';
  try {
    await resetTenants([TENANT_A]);
    if (enOtroTenant) {
      const creado = await prepareM10InB();
      if (creado !== undefined) return preparationFailed(expected, creado.step, creado.result);
    }
    const gestor = await tokenFor('gestor');
    if (gestor.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', gestor.last);
    const result = await request('PATCH', TENANT_A, `/milestones/${hito}`, gestor.token, { name: 'Revisión PDR' });
    return conclude([responseCheck(result, { status: 404, code: 'milestone_not_found' })]);
  } finally {
    if (enOtroTenant) await resetTenants([TENANT_B]);
  }
};

defineApiRows({
  story: 'US-HITOS-003',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, changeFields],
    [2, reorder],
    [3, validation],
    [4, permissions],
    [5, unknownMilestone],
  ]),
});
