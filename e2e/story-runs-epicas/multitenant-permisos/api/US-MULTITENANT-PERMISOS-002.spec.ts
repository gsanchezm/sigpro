import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { codesOf, conclude, itemsOf, prepareTenants, restoring, statusCheck, valueCheck, type Isolation } from './common';

// US-MULTITENANT-PERMISOS-002: un token lee solo los datos de su tenant. Preparación de cada fila (la de la regla): se reinician
// alumno01 y alumno02 con el token de su administrador, cada administrador inicia sesión y alumno02 aplica sus pasos (perfil
// «completo»: renombra PRG-001, crea PRG-025, REQ-041, NC-013, el hito PRG-025-M01, una ejecución de TC-001 y la versión 4 de
// DOC-001). La cuenta del tenant de la fila lee con su accessToken y la cabecera x-tenant de ese tenant.

type Expect = (result: ApiResult, run: Isolation['run']) => readonly Check[];

const only = (text: string): Expect => {
  const response = parseResponse(text);
  return (result) => [responseCheck(result, response)];
};

const named = (key: 'name' | 'title' | 'code', value: string, label: string): Expect => (result) => [statusCheck(result, 200), valueCheck(result, key, value, label)];

const version = (value: number): Expect => (result) => [statusCheck(result, 200), valueCheck(result, 'version', value, 'última versión')];

const milestoneOnly: Expect = (result) => {
  const list = itemsOf(result.body);
  const ids = list.map((milestone) => String(milestone.id));
  return [statusCheck(result, 200), check(ids.length === 1 && ids[0] === 'PRG-025-M01', 'un único hito, PRG-025-M01', `${ids.length} hitos: ${ids.join(', ') || '(ninguno)'}`)];
};

// --- Esquema 1: cada tenant lee sus propios recursos y no los de otro ---------------------------------------------------------

const READ_OWN = new Map<string, Expect>([
  ['200 con el nombre «Sistema de mando táctico Ártemis»', named('name', 'Sistema de mando táctico Ártemis', 'nombre')],
  ['200 con el nombre «Programa de aislamiento»', named('name', 'Programa de aislamiento', 'nombre')],
  ['404 program_not_found', only('404 program_not_found')],
  ['200 con el nombre «Programa de aislamiento nuevo»', named('name', 'Programa de aislamiento nuevo', 'nombre')],
  ['404 requirement_not_found', only('404 requirement_not_found')],
  ['200 con el título «Requisito solo de alumno02»', named('title', 'Requisito solo de alumno02', 'título')],
  ['404 nc_not_found', only('404 nc_not_found')],
  ['200 con el código NC-013', named('code', 'NC-013', 'código')],
  ['200 con un único hito, PRG-025-M01', milestoneOnly],
  ['200 con la última versión 3', version(3)],
  ['200 con la última versión 4', version(4)],
]);

const readOwn: ApiRowHandler = async (row) => {
  const expect = strict('respuesta', READ_OWN, cell(row, 'respuesta'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const tenant = cell(row, 'tenant');
  const token = strict('cuenta', new Map([[TENANT_A, prepared.ok.token01], [TENANT_B, prepared.ok.token02]]), tenant);
  const result = await call('GET', cell(row, 'ruta').replace(/^\/api/, ''), { tenant, token });
  return conclude(expect(result, prepared.ok.run), { evidence: { ruta: cell(row, 'ruta'), tenant } });
};

// --- Esquema 2: las listas y las fichas con varios elementos cuentan solo el tenant del token -------------------------------

const total = (count: number): Expect => (result) => [statusCheck(result, 200), valueCheck(result, 'total', count, 'total')];

const totalWithoutItems: Expect = (result) => [
  statusCheck(result, 200),
  valueCheck(result, 'total', 0, 'total'),
  check(itemsOf(result.body).length === 0, 'ningún programa en la lista', `${itemsOf(result.body).length} programas en la lista`),
];

const programsAislamiento: Expect = (result) => {
  const codes = codesOf(result.body).slice().sort();
  return [
    statusCheck(result, 200),
    valueCheck(result, 'total', 2, 'total'),
    check(codes.join(',') === 'PRG-001,PRG-025', 'PRG-001 y PRG-025', codes.join(' y ') || '(ninguno)'),
  ];
};

const requirementsOf = (count: number, includesReq41: boolean): Expect => (result) => {
  const codes = codesOf(result.body);
  const has = codes.includes('REQ-041');
  return [
    statusCheck(result, 200),
    check(codes.length === count, `${count} requisitos`, `${codes.length} requisitos`),
    check(has === includesReq41, includesReq41 ? 'incluido REQ-041' : 'sin REQ-041', has ? 'incluye REQ-041' : 'sin REQ-041'),
  ];
};

const runsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const runs = field(body, 'runs');
  return Array.isArray(runs) ? (runs as Record<string, unknown>[]) : [];
};

/** ¿Trae la ficha la ejecución que registró alumno02? Se identifica por id y fecha (los ids de ejecución se repiten entre tenants). */
const runsWithAlumno02: (includes: boolean) => Expect = (includes) => (result, run) => {
  const list = runsOf(result.body);
  const hit = run !== undefined && list.some((item) => item.id === run.id && item.executedAt === run.executedAt);
  return [
    statusCheck(result, 200),
    check(list.length > 0, 'sus ejecuciones', `${list.length} ejecuciones`),
    check(hit === includes, includes ? 'incluida la ejecución de alumno02' : 'sin la ejecución de alumno02', hit ? 'incluye la ejecución de alumno02' : 'sin la ejecución de alumno02'),
  ];
};

const supplierWithProgram = (programName: string): Expect => (result) => {
  const suppliers = itemsOf(result.body);
  const levante = suppliers.find((supplier) => supplier.name === 'Aeronáutica Levante S.L.');
  const contracts = Array.isArray(levante?.contracts) ? (levante?.contracts as Record<string, unknown>[]) : [];
  const contract = contracts.find((item) => item.programCode === 'PRG-001');
  return [
    statusCheck(result, 200),
    check(suppliers.length === 6, '6 proveedores', `${suppliers.length} proveedores`),
    check(
      contract?.programName === programName,
      `contrato de «Aeronáutica Levante S.L.» con PRG-001 indica «${programName}»`,
      `contrato con PRG-001 indica «${String(contract?.programName ?? '(sin contrato)')}»`,
    ),
  ];
};

const auditOf2: Expect = (result) => {
  const entityIds = itemsOf(result.body).map((event) => String(event.entityId)).sort();
  return [
    statusCheck(result, 200),
    valueCheck(result, 'total', 2, 'total'),
    check(entityIds.join(',') === 'PRG-025,PRG-025-M01', 'creación de PRG-025 y del hito PRG-025-M01', entityIds.join(', ') || '(ningún evento)'),
  ];
};

const READ_LIST = new Map<string, Expect>([
  ['200 con total 0 y ningún programa en la lista', totalWithoutItems],
  ['200 con total 2: PRG-001 y PRG-025', programsAislamiento],
  ['200 con total 0', total(0)],
  ['200 con 14 requisitos y sin REQ-041', requirementsOf(14, false)],
  ['200 con 15 requisitos, incluido REQ-041', requirementsOf(15, true)],
  ['200 con sus ejecuciones y sin la ejecución de alumno02', runsWithAlumno02(false)],
  ['200 con sus ejecuciones, incluida la ejecución de alumno02', runsWithAlumno02(true)],
  ['200 con 6 proveedores; el contrato de «Aeronáutica Levante S.L.» con PRG-001 indica el programa «Sistema de mando táctico Ártemis»', supplierWithProgram('Sistema de mando táctico Ártemis')],
  ['200 con 6 proveedores; el contrato de «Aeronáutica Levante S.L.» con PRG-001 indica el programa «Programa de aislamiento»', supplierWithProgram('Programa de aislamiento')],
  ['200 con total 2: la creación de PRG-025 y la del hito PRG-025-M01', auditOf2],
]);

const readList: ApiRowHandler = async (row) => {
  const expect = strict('respuesta', READ_LIST, cell(row, 'respuesta'));
  const prepared = await prepareTenants('completo');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const tenant = cell(row, 'tenant');
  const token = strict('cuenta', new Map([[TENANT_A, prepared.ok.token01], [TENANT_B, prepared.ok.token02]]), tenant);
  const result = await call('GET', cell(row, 'ruta').replace(/^\/api/, ''), { tenant, token });
  return conclude(expect(result, prepared.ok.run), { evidence: { ruta: cell(row, 'ruta'), tenant } });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-002',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoring(readOwn)],
    [2, restoring(readList)],
  ]),
});
