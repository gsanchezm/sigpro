import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, conclude, parseResponse, preparationFailed, responseCheck, strict } from '../../support/checks';
import {
  ACCOUNTS,
  NC_CHANGES,
  PROGRAM_CHANGES,
  TENANT_A,
  TENANT_B,
  adminSession,
  isOk,
  kpiChecksOf,
  kpiCheck,
  kpiTextOf,
  resetTenants,
  sessionAs,
  summaryOf,
  type Change,
} from './common';

// US-PROG-METRICAS-001 — Indicadores de programas en el resumen de misión (API). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador (alumno01@sigpro.lab); las cuentas de la fila inician sesión en alumno01 y piden el resumen con
// la cabecera x-tenant de la fila. Los cambios de la fila se hacen con el token de alumno01@sigpro.lab (o alumno02@sigpro.lab en
// el Esquema 4). Las cifras se comparan con lo que dice la historia, nunca con lo que devuelve la app.

// --- Esquema 1: cualquier rol autenticado recibe las mismas cifras del tenant --------------------------------------------------

const eachRole: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta 200 con ${kpiTextOf(row)}`;
  const email = cell(row, 'cuenta');
  strict('cuenta', ACCOUNTS, email);
  const session = await sessionAs(TENANT_A, { email, password: cell(row, 'contraseña') });
  if (session.token === undefined) return preparationFailed(expected, `${email} inicia sesión en alumno01 con la contraseña de la fila`, session.last);
  const result = await summaryOf(session.token);
  return conclude([responseCheck(result, { status: 200 }), ...kpiChecksOf(result, row)]);
};

// --- Esquema 2: cada cambio en los programas mueve solo las cifras que le corresponden ----------------------------------------

const afterProgramChange: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = kpiTextOf(row);
  const change: Change = strict('cambio', PROGRAM_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const result = await summaryOf(admin.token);
  return conclude(kpiChecksOf(result, row));
};

// --- Esquema 3: el resumen exige un accessToken válido ------------------------------------------------------------------------

/** Cabecera Authorization de la fila: sin cabecera, o un token que la API no ha emitido (con forma de JWT). */
const CREDENTIALS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(token inventado)', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJpbnZlbnRhZG8iLCJ0ZW5hbnQiOiJhbHVtbm8wMSJ9.firma-no-emitida'],
]);

const requiresToken: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = `respuesta ${cell(row, 'respuesta')}`;
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  // «Existen los 24 programas del seed»: se comprueba antes de pedir el resumen
  const seeded = await call('GET', '/programs', { tenant: TENANT_A, token: admin.token, query: 'pageSize=1' });
  const totalAll = field(seeded.body, 'totalAll');
  if (!isOk(seeded) || totalAll !== 24) return preparationFailed(expected, `existen 24 programas (totalAll ${String(totalAll)})`, seeded);
  const header = strict('cabecera', CREDENTIALS, cell(row, 'cabecera'));
  const result = await summaryOf(header);
  return conclude([responseCheck(result, parseResponse(cell(row, 'respuesta')))]);
};

// --- Esquema 4: el resumen cuenta solo los programas del tenant del token -----------------------------------------------------

const TENANT_OF_HEADER: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

const tenantOfToken: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A, TENANT_B]);
  const expected = 'respuesta 200 con activePrograms 12 y programsTotal 24';
  const other = await adminSession(TENANT_B);
  if (other.token === undefined) return preparationFailed(expected, 'alumno02@sigpro.lab inicia sesión', other.last);
  const archived: ApiResult = await call('POST', '/programs/PRG-001/archive', { tenant: TENANT_B, token: other.token });
  if (!isOk(archived)) return preparationFailed(expected, 'alumno02@sigpro.lab archiva PRG-001 en alumno02 con POST /api/programs/PRG-001/archive', archived);
  const mine = await adminSession(TENANT_A);
  if (mine.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', mine.last);
  const tenant = strict('cabecera', TENANT_OF_HEADER, cell(row, 'cabecera'));
  const result = await summaryOf(mine.token, tenant);
  return conclude([responseCheck(result, { status: 200 }), kpiCheck(result, 'activePrograms', 12), kpiCheck(result, 'programsTotal', 24)]);
};

// --- Esquema 5: una transición de una NC cambia ncOpen solo si deja de estar abierta ----------------------------------------

const afterNcChange: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = kpiTextOf(row);
  const change: Change = strict('cambio', NC_CHANGES, cell(row, 'cambio'));
  const admin = await adminSession(TENANT_A);
  if (admin.token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const done = await change(admin.token);
  if (done !== undefined && !isOk(done)) return preparationFailed(expected, cell(row, 'cambio'), done);
  const result = await summaryOf(admin.token);
  return conclude(kpiChecksOf(result, row));
};

defineApiRows({
  story: 'US-PROG-METRICAS-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, eachRole],
    [2, afterProgramChange],
    [3, requiresToken],
    [4, tenantOfToken],
    [5, afterNcChange],
  ]),
});
