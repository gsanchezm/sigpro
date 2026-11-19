import { call, field } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, strict, type Check } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler } from '../../core/framework';
import {
  ACCOUNTS,
  CREDENTIAL,
  ISOLATION_ACCOUNT,
  ISOLATION_HEADER,
  ISOLATION_PROGRAM_BODY,
  codesOfObjects,
  expectedOf,
  getList,
  isolationAdmin,
  itemByCode,
  itemsOf,
  listShape,
  noRequirementData,
  notFoundCheck,
  resetTenants,
  roleOf,
  sameAs,
  sameValue,
  sessionOfAccount,
  shown,
  statusCheck,
  valueCheck,
} from './common';

// US-REQ-ARBOL-001 — Listar los requisitos de un programa del tenant con su padre y su posición (API). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador y, después, inicio de sesión de la cuenta de la fila en alumno01 con x-tenant: alumno01.
// Las filas de aislamiento (Esquema 9) reinician también alumno02 y crean allí PRG-025 («Programa de aislamiento»). El reinicio no apaga el
// caos: el marco lo comprueba antes de cada fila.

// --- Esquema 1: el listado de PRG-001 trae el programa y sus requisitos del seed -------------------------------------------------------

const FIELD_READERS: ReadonlyMap<string, (body: unknown) => unknown> = new Map<string, (body: unknown) => unknown>([
  ['program.code', (body) => field(field(body, 'program'), 'code')],
  ['program.name', (body) => field(field(body, 'program'), 'name')],
  ['items.length', (body) => itemsOf(body).length],
  ['items[0].code', (body) => itemsOf(body)[0]?.code],
  ['items[9].code', (body) => itemsOf(body)[9]?.code],
  ['items[13].code', (body) => itemsOf(body)[13]?.code],
]);

const seedList: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const campo = cell(row, 'campo');
  const read = strict('campo', FIELD_READERS, campo);
  const valor = cell(row, 'valor');
  const expected = `respuesta 200 y el campo ${campo} vale ${valor}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-001', session.accessToken);
  return conclude([statusCheck(result, { status: 200 }), valueCheck(campo, read(result.body), valor), ...listShape(result.body)]);
};

// --- Esquema 2: cada requisito trae su padre y su posición entre hermanos ---------------------------------------------------------------

const seedParent: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const padre = cell(row, 'padre');
  const posicion = cell(row, 'posicion');
  const expected = `el requisito ${codigo} tiene parentCode ${padre} y position ${posicion}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-001', session.accessToken);
  const item = itemByCode(result.body, codigo);
  return conclude([
    statusCheck(result, { status: 200 }),
    check(item !== undefined, `el requisito ${codigo} está en items`, item === undefined ? `no está ${codigo} en items` : `está ${codigo} en items`),
    valueCheck(`parentCode de ${codigo}`, item?.parentCode, padre),
    valueCheck(`position de ${codigo}`, item?.position, posicion),
    ...listShape(result.body),
  ]);
};

// --- Esquema 3: cada requisito trae su estado, su prioridad y sus etiquetas ----------------------------------------------------------------

const seedState: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const estado = cell(row, 'estado');
  const prioridad = cell(row, 'prioridad');
  const etiquetas = cell(row, 'etiquetas');
  const expected = `el requisito ${codigo} tiene state ${estado}, priority ${prioridad} y tags ${etiquetas}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-001', session.accessToken);
  const item = itemByCode(result.body, codigo);
  return conclude([
    statusCheck(result, { status: 200 }),
    valueCheck(`state de ${codigo}`, item?.state, estado),
    valueCheck(`priority de ${codigo}`, item?.priority, prioridad),
    valueCheck(`tags de ${codigo}`, item?.tags, etiquetas),
    ...listShape(result.body),
  ]);
};

// --- Esquema 4: los casos de prueba enlazados de cada requisito se listan por código ---------------------------------------------------

const seedLinks: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const casos = cell(row, 'casos');
  const expected = `el requisito ${codigo} tiene testCaseCodes ${casos}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-001', session.accessToken);
  const item = itemByCode(result.body, codigo);
  return conclude([statusCheck(result, { status: 200 }), valueCheck(`testCaseCodes de ${codigo}`, item?.testCaseCodes, casos), ...listShape(result.body)]);
};

// --- Esquema 5: los casos enlazados aparecen en testCaseCodes y en tests -------------------------------------------------------------------

const seedTests: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = cell(row, 'codigo');
  const casos = cell(row, 'casos');
  const codigos = cell(row, 'codigos');
  const expected = `el requisito ${codigo} tiene testCaseCodes ${casos} y en tests solo los códigos ${codigos}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-002', session.accessToken);
  const item = itemByCode(result.body, codigo);
  const testCodes = codesOfObjects(item?.tests);
  return conclude([
    statusCheck(result, { status: 200 }),
    valueCheck(`testCaseCodes de ${codigo}`, item?.testCaseCodes, casos),
    check(sameValue(testCodes, codigos), `en tests solo ${codigos}`, `en tests ${shown(testCodes)}`),
    ...listShape(result.body),
  ]);
};

// --- Esquema 6: los elementos del listado vienen en orden de código -------------------------------------------------------------------

const seedOrder: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const posicion = Number(cell(row, 'posicion'));
  const codigo = cell(row, 'codigo');
  const expected = `el elemento número ${posicion} de items tiene el código ${codigo}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList('PRG-002', session.accessToken);
  const actual = itemsOf(result.body)[posicion - 1]?.code;
  return conclude([statusCheck(result, { status: 200 }), check(actual === codigo, expected, `el elemento número ${posicion} de items tiene el código ${shown(actual)}`), ...listShape(result.body)]);
};

// --- Esquema 7: un programa sin requisitos responde con la lista vacía ----------------------------------------------------------------------

const EMPTY_PROGRAMS: ReadonlyMap<string, string> = new Map<string, string>([['PRG-004', 'PRG-004']]);

const emptyList: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('código', EMPTY_PROGRAMS, cell(row, 'codigo'));
  const nombre = cell(row, 'nombre');
  const expected = `respuesta 200 con items vacío y el programa ${codigo} con el nombre ${nombre}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getList(codigo, session.accessToken);
  return conclude([
    statusCheck(result, { status: 200 }),
    check(itemsOf(result.body).length === 0, 'items vacío', `items con ${itemsOf(result.body).length} elementos`),
    check(field(field(result.body, 'program'), 'code') === codigo, `el programa ${codigo}`, `el programa ${shown(field(field(result.body, 'program'), 'code'))}`),
    check(field(field(result.body, 'program'), 'name') === nombre, `con el nombre ${nombre}`, `con el nombre ${shown(field(field(result.body, 'program'), 'name'))}`),
    ...listShape(result.body),
  ]);
};

// --- Esquema 8: cualquier rol del tenant recibe el mismo listado ----------------------------------------------------------------------------

const anyRole: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const rol = cell(row, 'rol');
  const expected = `respuesta 200 con 14 requisitos en items, el primero REQ-015 (rol ${rol})`;
  const session = await sessionOfAccount(TENANT_A, credentials);
  if (session.accessToken === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  // La precondición es «con el rol …»: si el token de la cuenta lleva otro rol, la fila no parte del estado que la historia da por hecho
  const role = roleOf(session.accessToken);
  if (role !== rol) return outcome(false, expected, `la preparación no se cumplió: ${cell(row, 'cuenta')} tiene el rol ${String(role)}`, { note: 'El rol de la cuenta en el seed no es el que da la historia.' });
  const result = await getList('PRG-002', session.accessToken);
  const reference = await sessionOfAccount(TENANT_A, DEMO.gestor);
  const referenceResult = reference.accessToken === undefined ? undefined : await getList('PRG-002', reference.accessToken);
  const first = itemsOf(result.body)[0]?.code;
  return conclude([
    statusCheck(result, { status: 200 }),
    check(itemsOf(result.body).length === 14, '14 requisitos en items', `${itemsOf(result.body).length} requisitos en items`),
    check(first === 'REQ-015', 'el primero REQ-015', `el primero ${shown(first)}`),
    referenceResult === undefined ? check(false, 'la misma respuesta que gestor@sigpro.test', 'gestor@sigpro.test no pudo leer el listado') : sameAs(result, referenceResult, `misma respuesta que gestor@sigpro.test (rol ${rol})`),
    ...listShape(result.body),
  ]);
};

// --- Esquema 9: un programa que no es del tenant responde 404 -------------------------------------------------------------------------------

const ISOLATION_CODE: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-025', 'PRG-025'],
  ['PRG-000', 'PRG-000'],
  ['REQ-001', 'REQ-001'],
]);

/** Respuesta de la fila: 404 program_not_found, o 200 con items vacío (el programa de aislamiento sin requisitos). */
const ISOLATION_RESPONSE: ReadonlyMap<string, 'not-found' | 'empty'> = new Map<string, 'not-found' | 'empty'>([
  ['404 program_not_found', 'not-found'],
  ['200 con items vacío', 'empty'],
]);

const isolation: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  // Preparación: alumno02@sigpro.lab crea «Programa de aislamiento» (PRG-025) y gestor@sigpro.test inicia sesión en alumno01
  const admin02 = await isolationAdmin();
  if (admin02.accessToken === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02 y recibe accessToken', admin02.last);
  const created = await call('POST', '/programs', { tenant: TENANT_B, token: admin02.accessToken, body: ISOLATION_PROGRAM_BODY });
  if (created.status < 200 || created.status > 299 || field(created.body, 'code') !== 'PRG-025') {
    return preparationFailed(expected, 'alumno02@sigpro.lab crea «Programa de aislamiento» y recibe el código PRG-025', created);
  }
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (gestor.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', gestor.last);

  const who = strict('cuenta', ISOLATION_ACCOUNT, cell(row, 'cuenta'));
  const token = who === 'gestor' ? gestor.accessToken : admin02.accessToken;
  const header = strict('cabecera', ISOLATION_HEADER, cell(row, 'cabecera'));
  const codigo = strict('código', ISOLATION_CODE, cell(row, 'codigo'));
  const wanted = strict('respuesta', ISOLATION_RESPONSE, cell(row, 'respuesta'));
  const result = await getList(codigo, token, header);
  if (wanted === 'empty') {
    const program = field(result.body, 'program');
    return conclude([
      statusCheck(result, { status: 200 }),
      check(itemsOf(result.body).length === 0, 'items vacío', `items con ${itemsOf(result.body).length} elementos`),
      check(field(program, 'code') === 'PRG-025' && field(program, 'name') === 'Programa de aislamiento', 'el programa PRG-025 «Programa de aislamiento»', `el programa ${shown(field(program, 'code'))} «${shown(field(program, 'name'))}»`),
      ...listShape(result.body),
    ]);
  }
  // 404: estado, código y mensaje; sin datos de requisito; y el mismo cuerpo que un código que no existe (PRG-000, mismo token y cabecera)
  const missing = await getList('PRG-000', token, header);
  const checks: Check[] = [notFoundCheck(result, 'program_not_found'), noRequirementData(result), sameAs(result, missing, 'igual que un código que no existe (PRG-000)')];
  return conclude(checks, { evidence: { traceIdPrograma: String(field(result.body, 'traceId') ?? '(sin traceId)'), traceIdReferencia: String(field(missing.body, 'traceId') ?? '(sin traceId)') } });
};

// --- Esquema 10: sin una sesión de acceso válida no se devuelve ningún requisito -----------------------------------------------------------

const noSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const respuesta = cell(row, 'respuesta');
  const expected = `respuesta ${respuesta} y el cuerpo no trae ningún requisito`;
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  const refresh = gestor.refreshToken;
  if (gestor.accessToken === undefined || refresh === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken y refreshToken', gestor.last);
  const admin = await sessionOfAccount(TENANT_A, DEMO.admin);
  const mfa = admin.mfaToken;
  if (mfa === undefined) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', admin.last);

  const credential = strict('credencial', CREDENTIAL, cell(row, 'credencial'));
  const token = credential === 'ninguna' ? undefined : credential === 'texto' ? 'texto-que-no-es-jwt' : credential === 'refresh' ? refresh : mfa;
  const result = await getList('PRG-001', token);
  return conclude([statusCheck(result, expectedOf(respuesta)), noRequirementData(result)]);
};

defineApiRows({
  story: 'US-REQ-ARBOL-001',
  surface: 'api',
  // alumno02 también: las filas de aislamiento lo reinician y crean allí PRG-025 (y su caos debe estar apagado)
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, seedList],
    [2, seedParent],
    [3, seedState],
    [4, seedLinks],
    [5, seedTests],
    [6, seedOrder],
    [7, emptyList],
    [8, anyRole],
    [9, isolation],
    [10, noSession],
  ]),
});
