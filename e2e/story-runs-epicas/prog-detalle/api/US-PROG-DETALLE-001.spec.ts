import { adminCredentials, call, field, type ApiResult } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, conclude, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, outcome, type ApiRowHandler } from '../../core/framework';
import {
  CODES_NOT_A_PROGRAM,
  ACCOUNTS,
  fieldCheck,
  getProgram,
  notFoundCheck,
  PROGRAM_FIELDS,
  resetTenants,
  roleOf,
  sessionOfAccount,
  shapeChecks,
  noProgramData,
} from './common';

// US-PROG-DETALLE-001 — Consultar el detalle de un programa del tenant (API). Preparación de cada fila: reinicio de alumno01 con el token de
// su administrador y, después, inicio de sesión de la cuenta de la fila en alumno01. Las filas de aislamiento reinician también alumno02 y
// crean allí el programa PRG-025 («Programa de aislamiento»). El reinicio no apaga el caos: el marco lo comprueba antes de cada fila.

const FIELD_NAMES: ReadonlyMap<string, string> = new Map<string, string>(PROGRAM_FIELDS.map((key) => [key, key]));
const LAST_PROGRAM: ReadonlyMap<string, string> = new Map<string, string>([['PRG-024', 'PRG-024']]);

// --- Esquema 1: el detalle de PRG-001 trae los datos del seed ------------------------------------------------------------------------------

const seedDetail: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const campo = strict('campo', FIELD_NAMES, cell(row, 'campo'));
  const valor = cell(row, 'valor');
  const expected = `respuesta 200 y el campo ${campo} vale ${valor}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getProgram('PRG-001', session.accessToken);
  return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, campo, valor), ...shapeChecks(result.body)]);
};

// --- Esquema 2: cualquier rol del tenant recibe el mismo detalle ---------------------------------------------------------------------------

const anyRole: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const rol = cell(row, 'rol');
  const expected = `respuesta 200 con el código PRG-001 y el responsable Marta Ruiz (rol ${rol})`;
  const session = await sessionOfAccount(TENANT_A, credentials);
  if (session.accessToken === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión y recibe accessToken`, session.last);
  // La precondición es «con el rol …»: si el token de la cuenta lleva otro rol, la fila no parte del estado que la historia da por hecho
  const role = roleOf(session.accessToken);
  if (role !== rol) {
    return outcome(false, expected, `la preparación no se cumplió: ${cell(row, 'cuenta')} tiene el rol ${String(role)}`, {
      note: 'El rol de la cuenta en el seed no es el que da la historia.',
    });
  }
  const result = await getProgram('PRG-001', session.accessToken);
  return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, 'code', 'PRG-001'), fieldCheck(result.body, 'ownerName', 'Marta Ruiz'), ...shapeChecks(result.body)]);
};

// --- Esquema 3: un código que no es un programa del tenant responde 404 --------------------------------------------------------------------

const notAProgram: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('código', CODES_NOT_A_PROGRAM, cell(row, 'codigo'));
  const expected = `respuesta 404 con el código program_not_found para ${codigo}, sin datos de programa`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getProgram(codigo, session.accessToken);
  return conclude([notFoundCheck(result), noProgramData(result)]);
};

// --- Esquema 4: el último programa del seed se devuelve -----------------------------------------------------------------------------------

const lastProgram: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const codigo = strict('código', LAST_PROGRAM, cell(row, 'codigo'));
  const nombre = cell(row, 'nombre');
  const expected = `respuesta 200 con el nombre ${nombre}`;
  const session = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (session.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken', session.last);
  const result = await getProgram(codigo, session.accessToken);
  return conclude([responseCheck(result, { status: 200 }), fieldCheck(result.body, 'name', nombre), ...shapeChecks(result.body)]);
};

// --- Esquema 5: un programa de otro tenant responde igual que un código que no existe ------------------------------------------------------

/** Cuenta de la fila: el gestor de alumno01, o la administradora de alumno02, que es la dueña de PRG-025. */
const ISOLATION_ACCOUNT: ReadonlyMap<string, 'gestor' | 'alumno02'> = new Map<string, 'gestor' | 'alumno02'>([
  ['gestor@sigpro.test del tenant alumno01', 'gestor'],
  ['alumno02@sigpro.lab del tenant alumno02', 'alumno02'],
]);
/** Cabecera x-tenant de la fila (`undefined`: la fila no la envía). */
const ISOLATION_HEADER: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['sin cabecera x-tenant', undefined],
  ['con la cabecera x-tenant: alumno02', TENANT_B],
]);

/** Respuesta esperada de la fila: 404 con su código, o 200 con el nombre del programa de aislamiento. */
interface IsolationExpectation {
  readonly status: number;
  readonly code?: string;
  readonly name?: string;
}
const ISOLATION_RESPONSE: ReadonlyMap<string, IsolationExpectation> = new Map<string, IsolationExpectation>([
  ['404 program_not_found', { status: 404, code: 'program_not_found' }],
  ['200 con el nombre Programa de aislamiento', { status: 200, name: 'Programa de aislamiento' }],
]);

/** `POST /api/programs` de alumno02 con los datos de la historia (responsable u1, 2025-01-01 a 2025-12-31, 100000 €). */
const createIsolationProgram = (token: string): Promise<ApiResult> =>
  call('POST', '/programs', {
    tenant: TENANT_B,
    token,
    body: { name: 'Programa de aislamiento', ownerId: 'u1', startDate: '2025-01-01', endDate: '2025-12-31', budget: 100000 },
  });

const isolation: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  // Preparación de la historia: alumno02@sigpro.lab crea «Programa de aislamiento» (PRG-025) y gestor@sigpro.test entra en alumno01
  const admin02 = await sessionOfAccount(TENANT_B, adminCredentials(TENANT_B));
  if (admin02.accessToken === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión en alumno02 y recibe accessToken', admin02.last);
  const created = await createIsolationProgram(admin02.accessToken);
  if (created.status < 200 || created.status > 299 || field(created.body, 'code') !== 'PRG-025') {
    return preparationFailed(expected, 'alumno02@sigpro.lab crea «Programa de aislamiento» y recibe el código PRG-025', created);
  }
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  if (gestor.accessToken === undefined) return preparationFailed(expected, 'gestor@sigpro.test inicia sesión en alumno01 y recibe accessToken', gestor.last);

  const who = strict('cuenta', ISOLATION_ACCOUNT, cell(row, 'cuenta'));
  const token = who === 'gestor' ? gestor.accessToken : admin02.accessToken;
  const header = strict('cabecera', ISOLATION_HEADER, cell(row, 'cabecera'));
  const wanted = strict('respuesta', ISOLATION_RESPONSE, cell(row, 'respuesta'));
  const result = await getProgram('PRG-025', token, header);
  // 404: estado, código y mensaje (con la ausencia de datos); 200: estado, nombre y forma de la respuesta
  const checks: Check[] = [];
  if (wanted.status === 404) checks.push(notFoundCheck(result), noProgramData(result));
  else checks.push(responseCheck(result, { status: wanted.status }));
  if (wanted.name !== undefined) checks.push(fieldCheck(result.body, 'name', wanted.name), ...shapeChecks(result.body));
  return conclude(checks);
};

// --- Esquema 6: sin una sesión de acceso válida no se devuelve el programa ----------------------------------------------------------------

/** Credencial de la fila: sin cabecera, un texto que no es JWT, el refreshToken de gestor o el mfaToken de admin. */
const CREDENTIAL: ReadonlyMap<string, 'ninguna' | 'texto' | 'refresh' | 'mfa'> = new Map<string, 'ninguna' | 'texto' | 'refresh' | 'mfa'>([
  ['(sin cabecera Authorization)', 'ninguna'],
  ['una cabecera Bearer con un texto que no es JWT', 'texto'],
  ['una cabecera Bearer con el refreshToken de gestor@sigpro.test', 'refresh'],
  ['una cabecera Bearer con el mfaToken de admin@sigpro.test', 'mfa'],
]);

const noSession: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${cell(row, 'respuesta')} y el cuerpo sin datos del programa`;
  const gestor = await sessionOfAccount(TENANT_A, DEMO.gestor);
  const refresh = gestor.refreshToken;
  if (gestor.accessToken === undefined || refresh === undefined) {
    return preparationFailed(expected, 'gestor@sigpro.test inicia sesión y recibe accessToken y refreshToken', gestor.last);
  }
  const admin = await sessionOfAccount(TENANT_A, DEMO.admin);
  const mfa = admin.mfaToken;
  if (mfa === undefined) return preparationFailed(expected, 'admin@sigpro.test inicia sesión y recibe mfaToken', admin.last);

  const credential = strict('credencial', CREDENTIAL, cell(row, 'credencial'));
  const token = credential === 'ninguna' ? undefined : credential === 'texto' ? 'texto-que-no-es-jwt' : credential === 'refresh' ? refresh : mfa;
  const result = await getProgram('PRG-001', token);
  return conclude([responseCheck(result, parseResponse(cell(row, 'respuesta'))), noProgramData(result)]);
};

defineApiRows({
  story: 'US-PROG-DETALLE-001',
  surface: 'api',
  // alumno02 también: las filas de aislamiento lo reinician y crean allí PRG-025 (y su caos debe estar apagado)
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, seedDetail],
    [2, anyRole],
    [3, notAProgram],
    [4, lastProgram],
    [5, isolation],
    [6, noSession],
  ]),
});
