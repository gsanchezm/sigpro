import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude } from './common';
import { cell, check, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import {
  NC_CHANGES,
  PROGRAM_CHANGES,
  TENANT_A,
  adminSession,
  call,
  failedPreparation,
  field,
  fieldCheck,
  integerOf,
  isOk,
  listOf,
  kpisOf,
  notOkEvidence,
  resetTenants,
  seedPresent,
  summaryOf,
} from './common';

// US-MISION-KPI-002 — Datos de las gráficas de misión en el resumen (API): hitos por programa activo y NC abiertas por severidad.
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador, comprobación de los 24 programas del seed y, si
// la historia lo nombra, el cambio (programas o NC) con ese mismo token. Lo esperado sale de la historia, nunca de la API.

/** Estado de un programa tal como lo nombra la historia y como lo devuelve la API. */
const STATUS_OF_STATE: ReadonlyMap<string, string> = new Map<string, string>([
  ['borrador', 'draft'],
  ['cerrado', 'closed'],
]);

const SEVERITY_KEYS: readonly string[] = ['minor', 'major', 'critical'];
/** Los ocho primeros programas activos con hitos del seed (la tabla de la historia, Esquema 1), en orden de código. */
const SEED_FIRST_EIGHT: readonly string[] = ['PRG-001', 'PRG-002', 'PRG-005', 'PRG-007', 'PRG-009', 'PRG-010', 'PRG-013', 'PRG-015'];

// --- Esquema 1: los ocho primeros programas activos con hitos, en orden de código -------------------------------------------

const topEight: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const position = integerOf(row, 'posicion');
  const expected = `el elemento ${position} de milestonesByProgram tiene programCode ${cell(row, 'programa')}, programName ${cell(row, 'nombre')}, done ${cell(row, 'cumplidos')} y total ${cell(row, 'total')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const result = await summaryOf(admin.token);
  const bars = listOf(result.body, 'milestonesByProgram');
  const item = bars?.[position - 1];
  const present = check(item !== undefined, `el elemento ${position} existe`, item === undefined ? `la lista tiene ${bars?.length ?? '(sin lista)'} elementos` : `el elemento ${position} existe`);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      present,
      fieldCheck('programCode', item, 'programCode', cell(row, 'programa')),
      fieldCheck('programName', item, 'programName', cell(row, 'nombre')),
      fieldCheck('done', item, 'done', integerOf(row, 'cumplidos')),
      fieldCheck('total', item, 'total', integerOf(row, 'total')),
    ],
    { evidence: notOkEvidence(result) },
  );
};

// --- Esquema 2: un programa que deja de estar activo sale de la gráfica y entra el siguiente ------------------------------

const afterProgramChange: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `milestonesByProgram tiene ${cell(row, 'elementos')} elementos, el primero es ${cell(row, 'primero')} y el último es ${cell(row, 'ultimo')} con done ${cell(row, 'cumplidos_ultimo')} y total ${cell(row, 'total_ultimo')}`;
  const change = strict('cambio', PROGRAM_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const result = await summaryOf(admin.token);
  const bars = listOf(result.body, 'milestonesByProgram');
  const last = bars === undefined || bars.length === 0 ? undefined : bars[bars.length - 1];
  const count: Check = check(bars !== undefined && bars.length === integerOf(row, 'elementos'), `milestonesByProgram tiene ${cell(row, 'elementos')} elementos`, bars === undefined ? '(sin lista)' : `${bars.length} elementos`);
  const first = check(field(bars?.[0], 'programCode') === cell(row, 'primero'), `el primero es ${cell(row, 'primero')}`, `el primero es ${String(field(bars?.[0], 'programCode') ?? '(sin leer)')}`);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      count,
      first,
      fieldCheck('el último programCode', last, 'programCode', cell(row, 'ultimo')),
      fieldCheck('done del último', last, 'done', integerOf(row, 'cumplidos_ultimo')),
      fieldCheck('total del último', last, 'total', integerOf(row, 'total_ultimo')),
    ],
    { evidence: notOkEvidence(result) },
  );
};

// --- Esquema 3: un programa que no está activo no aparece en la gráfica, aunque tenga hitos ---------------------------------

const notListed: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const code = cell(row, 'programa');
  const expected = `${code} no aparece en milestonesByProgram`;
  const status = strict('estado', STATUS_OF_STATE, cell(row, 'estado'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const program = await call('GET', `/programs/${code}`, { tenant: TENANT_A, token: admin.token });
  if (!isOk(program) || field(program.body, 'status') !== status) return preparationFailed(expected, `${code} tiene el estado ${cell(row, 'estado')} (status ${status})`, program);
  const milestones = await call('GET', `/programs/${code}/milestones`, { tenant: TENANT_A, token: admin.token });
  const hasMilestones = Array.isArray(milestones.body) && milestones.body.length > 0;
  if (!isOk(milestones) || !hasMilestones) return preparationFailed(expected, `${code} tiene hitos`, milestones);
  const result = await summaryOf(admin.token);
  const bars = listOf(result.body, 'milestonesByProgram');
  const listed = bars?.some((bar) => field(bar, 'programCode') === code) ?? false;
  // La comprobación de «no aparece» no vale sola: la lista debe ser la del seed (así no es vacía por accidente)
  const codes = (bars ?? []).map((bar) => String(field(bar, 'programCode')));
  const seedList = codes.length === SEED_FIRST_EIGHT.length && codes.every((item, index) => item === SEED_FIRST_EIGHT[index]);
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      check(bars !== undefined && !listed, `${code} no aparece en milestonesByProgram`, bars === undefined ? '(sin lista)' : listed ? `${code} aparece en milestonesByProgram` : `${code} no aparece (${bars.length} elementos)`),
      check(seedList, `la lista es la del seed: ${SEED_FIRST_EIGHT.join(', ')}`, `la lista trae ${codes.join(', ') || '(ninguno)'}`),
    ],
    { evidence: notOkEvidence(result) },
  );
};

// --- Esquema 4: las no conformidades abiertas se reparten por severidad -------------------------------------------------------

const ncBySeverity: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `ncBySeverity tiene minor ${cell(row, 'menor')}, major ${cell(row, 'mayor')} y critical ${cell(row, 'critica')}, y su suma es igual a kpis.ncOpen`;
  const change = strict('cambio', NC_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const seeded = await seedPresent(admin.token);
  if (seeded !== undefined) return failedPreparation(expected, seeded);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const result = await summaryOf(admin.token);
  const bySeverity = field(result.body, 'ncBySeverity');
  const sum = SEVERITY_KEYS.reduce((total, key) => total + Number(field(bySeverity, key) ?? Number.NaN), 0);
  const ncOpen = field(kpisOf(result.body), 'ncOpen');
  return conclude(
    [
      responseCheck(result, { status: 200 }),
      fieldCheck('minor', bySeverity, 'minor', integerOf(row, 'menor')),
      fieldCheck('major', bySeverity, 'major', integerOf(row, 'mayor')),
      fieldCheck('critical', bySeverity, 'critical', integerOf(row, 'critica')),
      check(Number.isInteger(ncOpen) && sum === ncOpen, 'la suma de minor, major y critical es igual a kpis.ncOpen', `suma ${Number.isNaN(sum) ? '(sin leer)' : String(sum)} y kpis.ncOpen ${String(ncOpen ?? '(sin leer)')}`),
    ],
    { evidence: notOkEvidence(result) },
  );
};

defineApiRows({
  story: 'US-MISION-KPI-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, topEight],
    [2, afterProgramChange],
    [3, notListed],
    [4, ncBySeverity],
  ]),
});
