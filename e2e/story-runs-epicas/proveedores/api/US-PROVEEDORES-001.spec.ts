import { adminToken, call, field, type ApiResult } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, conclude, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import {
  ACCOUNTS,
  describeNames,
  type Expected,
  GESTOR,
  idsOf,
  isListCheck,
  namesCheck,
  namesOf,
  PROGRAMAS,
  QUERIES,
  RESULTADOS,
  SIX,
  SIX_IDS,
  sameList,
  sessionFor,
  suppliersCall,
  suppliersOf,
  textOf,
} from './common';

// US-PROVEEDORES-001 — Listar los proveedores del tenant con sus contratos y filtrarlos (API). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; las cuentas inician sesión en su tenant y usan su accessToken como Bearer. Las filas de
// aislamiento (Esquema 8) reinician también alumno02 y borran PRG-003 en alumno01 antes de consultar.
//
// Notas de la prueba:
//  - «(vacío)» en una columna de filtro se envía como parámetro VACÍO (`q=`, `program=`): la regla dice que un valor vacío no filtra;
//  - «(tres espacios)» y «(s.l. …)» se envían con sus espacios reales: la regla dice que los espacios de los extremos no cuentan.

// --- Esquema 1: sin una sesión válida la API no entrega la lista ---------------------------------------------------------------

/** Cabecera Authorization de la fila → token que se envía (`null` = sin cabecera). */
const CABECERAS: ReadonlyMap<string, string | null> = new Map<string, string | null>([
  ['(sin cabecera)', null],
  ['(Bearer con un texto que no es un token)', 'un texto que no es un token'],
]);

const withoutValidSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const token = strict('cabecera_authorization', CABECERAS, cell(row, 'cabecera_authorization'));
  const result = await suppliersCall(TENANT_A, token ?? undefined, {});
  return conclude([
    responseCheck(result, parseResponse(cell(row, 'respuesta'))),
    check(!Array.isArray(result.body), 'no entrega ninguna lista de proveedores', Array.isArray(result.body) ? 'entrega una lista de proveedores' : 'no entrega ninguna lista de proveedores'),
  ]);
};

// --- Esquema 2: la lista trae los seis proveedores del seed ordenados por nombre -----------------------------------------------

/** Lugar de la lista (texto de la historia) → posición en el array (0 = primero). */
const POSICIONES: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 0],
  ['2', 1],
  ['3', 2],
  ['4', 3],
  ['5', 4],
  ['6', 5],
]);

/** Columna «aprobado» → booleano exacto que debe traer la API (`true` o `false`, no su texto). */
const APROBADO: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

const sixInOrder: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const position = strict('lugar', POSICIONES, cell(row, 'lugar'));
  const approved = strict('aprobado', APROBADO, cell(row, 'aprobado'));
  const expected = `respuesta 200 con seis proveedores; en el lugar ${cell(row, 'lugar')} ${cell(row, 'nombre')}, con id ${cell(row, 'id')}, NIF ${cell(row, 'nif')} y aprobado ${cell(row, 'aprobado')}`;
  const session = await sessionFor(GESTOR);
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await suppliersCall(TENANT_A, session.token, {});
  const items = suppliersOf(result);
  const item: unknown = items[position];
  const contactEmail = field(item, 'contactEmail');
  return conclude([
    responseCheck(result, { status: 200 }),
    check(items.length === 6, 'seis proveedores', `${items.length} proveedores`),
    check(textOf(item, 'name') === cell(row, 'nombre'), `en el lugar ${cell(row, 'lugar')} ${cell(row, 'nombre')}`, `en el lugar ${cell(row, 'lugar')} ${item === undefined ? '(ninguno)' : textOf(item, 'name')}`),
    check(textOf(item, 'id') === cell(row, 'id'), `con id ${cell(row, 'id')}`, `con id ${textOf(item, 'id')}`),
    check(textOf(item, 'nif') === cell(row, 'nif'), `con NIF ${cell(row, 'nif')}`, `con NIF ${textOf(item, 'nif')}`),
    // El booleano exacto: `approved` debe ser `true` o `false`, no su texto
    check(field(item, 'approved') === approved, `aprobado ${cell(row, 'aprobado')} (booleano)`, `aprobado ${JSON.stringify(field(item, 'approved'))}`),
    // La regla nombra también el correo de contacto (presente y texto no vacío) y la lista de contratos de cada proveedor
    check(contactEmail !== undefined, 'trae contactEmail', `contactEmail ${contactEmail === undefined ? 'ausente' : 'presente'}`),
    check(typeof contactEmail === 'string' && contactEmail.trim() !== '', 'contactEmail es texto no vacío', `contactEmail ${JSON.stringify(contactEmail)}`),
    check(Array.isArray(field(item, 'contracts')), 'trae contracts', `contracts ${Array.isArray(field(item, 'contracts')) ? 'presente' : 'ausente'}`),
  ]);
};

// --- Esquema 3: cada proveedor trae sus contratos con su programa, su importe y su fecha de firma ----------------------------

/** Proveedores que citan contratos concretos en la historia. */
const CONTRATADOS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Aeronáutica Levante S.L.', 'Aeronáutica Levante S.L.'],
  ['Cibertáctica Norte', 'Cibertáctica Norte'],
  ['Logística Marítima Atlas', 'Logística Marítima Atlas'],
]);

const contractOfSupplier: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const supplierName = strict('proveedor', CONTRATADOS, cell(row, 'proveedor'));
  const expected = `el proveedor ${supplierName} tiene el contrato con ${cell(row, 'programa')}, con el nombre de programa ${cell(row, 'nombre_programa')}, importe ${cell(row, 'importe')} y fecha de firma ${cell(row, 'fecha')}`;
  const session = await sessionFor(GESTOR);
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await suppliersCall(TENANT_A, session.token, {});
  const supplier: unknown = suppliersOf(result).find((item) => textOf(item, 'name') === supplierName);
  const contracts = contractsOf(supplier);
  const contract: unknown = contracts.find((item) => textOf(item, 'programCode') === cell(row, 'programa'));
  return conclude([
    check(supplier !== undefined, `el proveedor ${supplierName}`, supplier === undefined ? `no está ${supplierName}` : `el proveedor ${supplierName}`),
    check(contract !== undefined, `un contrato con ${cell(row, 'programa')}`, contract === undefined ? `sin contrato con ${cell(row, 'programa')}` : `un contrato con ${cell(row, 'programa')}`),
    check(textOf(contract, 'programName') === cell(row, 'nombre_programa'), `el nombre de programa ${cell(row, 'nombre_programa')}`, `el nombre de programa ${textOf(contract, 'programName')}`),
    check(textOf(contract, 'amountEur') === cell(row, 'importe'), `importe ${cell(row, 'importe')}`, `importe ${textOf(contract, 'amountEur')}`),
    // La regla dice que el importe es un número entero (no solo un texto igual)
    check(Number.isInteger(field(contract, 'amountEur')), 'importe como número entero', `importe de tipo ${typeof field(contract, 'amountEur')}`),
    check(textOf(contract, 'signedAt') === cell(row, 'fecha'), `fecha de firma ${cell(row, 'fecha')}`, `fecha de firma ${textOf(contract, 'signedAt')}`),
  ]);
};

/** Contratos de un proveedor (vacío si no hay un proveedor o no trae la lista). */
const contractsOf = (supplier: unknown): readonly unknown[] => {
  const contracts = field(supplier, 'contracts');
  return Array.isArray(contracts) ? (contracts as readonly unknown[]) : [];
};

// --- Esquema 4: cualquier rol autenticado recibe la misma lista ----------------------------------------------------------------

const anyRole: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const who = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = `la cuenta ${cell(row, 'cuenta')} con el rol ${cell(row, 'rol')} recibe 200 con seis proveedores, y el primero es Aeronáutica Levante S.L.`;
  const session = await sessionFor(who);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  if (session.role !== cell(row, 'rol')) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión con el rol ${cell(row, 'rol')}`, session.last);
  const result = await suppliersCall(who.tenant, session.token, {});
  const items = suppliersOf(result);
  // Referencia de la misma fila: la lista que recibe el gestor (la historia dice «la misma lista» para todos los roles)
  const reference = await sessionFor(GESTOR);
  const referenceIds = reference.token === undefined ? [] : idsOf(suppliersOf(await suppliersCall(TENANT_A, reference.token, {})));
  return conclude([
    responseCheck(result, { status: 200 }),
    check(sameList(idsOf(items), SIX_IDS), 'los seis proveedores con los ids s1, s5, s3, s6, s4, s2 en ese orden', `ids ${idsOf(items).join(', ') || '(ninguno)'}`),
    namesCheck(namesOf(items), SIX),
    check(referenceIds.length === 6 && sameList(idsOf(items), referenceIds), 'la misma lista que recibe el gestor (mismos ids y orden)', `ids ${idsOf(items).join(', ') || '(ninguno)'} frente a ${referenceIds.join(', ') || '(sin lista del gestor)'}`),
  ]);
};

// --- Esquema 5: el filtro q busca en el nombre o en el NIF ----------------------------------------------------------------------

/** Comprobaciones de una lista filtrada: 200, nombres exactos en orden y, si la historia lo dice, el NIF por el que se encuentra. */
const resultChecks = (result: ApiResult, expected: Expected): readonly Check[] => {
  const items = suppliersOf(result);
  const checks: Check[] = [responseCheck(result, { status: 200 }), isListCheck(result.body), namesCheck(namesOf(items), expected.names)];
  const nif = expected.nif;
  if (nif !== undefined) {
    const found = items.find((item) => textOf(item, 'nif') === nif);
    checks.push(check(found !== undefined, `encontrado por su NIF ${nif}`, found === undefined ? `ningún proveedor con NIF ${nif}` : `encontrado por su NIF ${nif}`));
  }
  return checks;
};

const textFilter: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const query = strict('texto', QUERIES, cell(row, 'texto'));
  const expected = strict('resultado', RESULTADOS, cell(row, 'resultado'));
  const session = await sessionFor(GESTOR);
  if (session.token === undefined) return preparationFailed(`respuesta 200 con ${cell(row, 'resultado')}`, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await suppliersCall(TENANT_A, session.token, { q: query });
  return conclude(resultChecks(result, expected));
};

// --- Esquema 6: el filtro program deja los proveedores con contrato en ese programa ----------------------------------------

const programFilter: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const program = strict('programa', PROGRAMAS, cell(row, 'programa'));
  const query = strict('texto', QUERIES, cell(row, 'texto'));
  const expected = strict('resultado', RESULTADOS, cell(row, 'resultado'));
  const session = await sessionFor(GESTOR);
  if (session.token === undefined) return preparationFailed(`respuesta 200 con ${cell(row, 'resultado')}`, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await suppliersCall(TENANT_A, session.token, { program, q: query });
  return conclude(resultChecks(result, expected));
};

// --- Esquema 7: el filtro por programa no recorta los contratos del proveedor -----------------------------------------------

/** Pares de contratos de la historia → códigos de programa en el orden en que llegan. */
const CONTRATOS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['PRG-001 y PRG-002', ['PRG-001', 'PRG-002']],
  ['PRG-009 y PRG-010', ['PRG-009', 'PRG-010']],
]);

const contractsNotCut: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const program = strict('programa', PROGRAMAS, cell(row, 'programa'));
  const supplierName = strict('proveedor', CONTRATADOS, cell(row, 'proveedor'));
  const codes = strict('contratos', CONTRATOS, cell(row, 'contratos'));
  const expected = `el proveedor ${supplierName} trae sus dos contratos, con los programas ${cell(row, 'contratos')}`;
  const session = await sessionFor(GESTOR);
  if (session.token === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await suppliersCall(TENANT_A, session.token, { program });
  const supplier: unknown = suppliersOf(result).find((item) => textOf(item, 'name') === supplierName);
  const got = contractsOf(supplier).map((contract) => textOf(contract, 'programCode'));
  return conclude([
    responseCheck(result, { status: 200 }),
    check(supplier !== undefined, `el proveedor ${supplierName} en la lista`, supplier === undefined ? `no está ${supplierName}` : `el proveedor ${supplierName} en la lista`),
    check(got.length === codes.length && got.every((code, index) => code === codes[index]), `contratos ${cell(row, 'contratos')}`, `contratos ${describeNames(got)}`),
  ]);
};

// --- Esquema 8: la lista sale del tenant del token y no de la cabecera x-tenant ----------------------------------------------

/** Cabecera x-tenant de la historia → tenant que se envía. */
const TENANTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

const tenantFromToken: ApiRowHandler = async (row) => {
  const who = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const headerTenant = strict('cabecera', TENANTS, cell(row, 'cabecera'));
  const expectedResult = strict('resultado', RESULTADOS, cell(row, 'resultado'));
  const expected = `la cuenta ${cell(row, 'cuenta')} con la cabecera x-tenant ${cell(row, 'cabecera')} recibe 200 con ${cell(row, 'resultado')}`;
  await resetTenants([TENANT_A, TENANT_B]);
  // Se borra PRG-003 solo en alumno01 (con su administrador); en alumno02 no se borra nada
  const deleted = await call('DELETE', '/programs/PRG-003', { tenant: TENANT_A, token: await adminToken(TENANT_A) });
  if (deleted.status !== 204) return preparationFailed(expected, 'alumno01@sigpro.lab borra PRG-003 en alumno01 (DELETE, 204)', deleted);
  const session = await sessionFor(who);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en su tenant y recibe accessToken`, session.last);
  const result = await suppliersCall(headerTenant, session.token, { program: 'PRG-003' });
  return conclude(resultChecks(result, expectedResult));
};

defineApiRows({
  story: 'US-PROVEEDORES-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, withoutValidSession],
    [2, sixInOrder],
    [3, contractOfSupplier],
    [4, anyRole],
    [5, textFilter],
    [6, programFilter],
    [7, contractsNotCut],
    [8, tenantFromToken],
  ]),
});
