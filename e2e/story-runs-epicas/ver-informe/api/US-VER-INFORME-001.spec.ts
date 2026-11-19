import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict } from '../../support/checks';
import { DEMO, TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import {
  ACCOUNT_CELLS,
  PASSWORD_CELLS,
  TENANT_CELLS,
  adminToken,
  asApiResult,
  bearer,
  done,
  evidenceOf,
  lineCheck,
  noPdfCheck,
  numberOf,
  pdfCheck,
  postRun,
  reportReply,
  seedFailure,
  signedIn,
  signedInWith,
  type Account,
} from './common';

// US-VER-INFORME-001 — Descargar el informe solo con sesión y con los datos del tenant del token (API). Preparación de cada fila:
// reinicio de alumno01 (y de alumno02 en el Esquema 2) con el token de su administrador. Las cuentas inician sesión con su
// contraseña y el tenant de la fila; el informe lo pide cada cuenta con su accessToken.

/** Cabecera `Authorization` de la celda: ninguna, un token que la API no emitió, o el refreshToken de gestor@sigpro.test. */
type AuthKind = 'sin' | 'inventado' | 'refresh';

const AUTH_CELLS: ReadonlyMap<string, AuthKind> = new Map<string, AuthKind>([
  ['(sin cabecera Authorization)', 'sin'],
  ['Bearer con un token inventado', 'inventado'],
  ['Bearer con el refreshToken de gestor@sigpro.test', 'refresh'],
]);

/** Token que la API no emitió: una firma que no verifica. */
const INVENTED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJpbnZlbnRhZG8iLCJ0eXBlIjoiYWNjZXNzIn0.firma-inventada-por-la-prueba';

const GESTOR: Account = { credentials: DEMO.gestor, tenant: TENANT_A };

// --- Esquema 1: sin un accessToken válido no hay informe -------------------------------------------------------------------------

const withoutValidToken: ApiRowHandler = async (row) => {
  const kind = strict('cabecera', AUTH_CELLS, cell(row, 'cabecera'));
  const respuesta = cell(row, 'respuesta');
  const expected = parseResponse(respuesta);
  const expectedText = `respuesta ${respuesta} y ningún PDF`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expectedText, 25);
  if (prepared !== undefined) return prepared;
  // El refreshToken sale de un inicio de sesión real de gestor@sigpro.test (con «Mantener la sesión»): si no hay, no hay fila que juzgar
  let refreshToken: string | undefined;
  if (kind === 'refresh') {
    const session = await signedIn(GESTOR, true);
    if (session.refreshToken === undefined) return preparationFailed(expectedText, 'gestor@sigpro.test inicia sesión y obtiene su refreshToken', session.result);
    refreshToken = session.refreshToken;
  }
  const token = kind === 'inventado' ? INVENTED_TOKEN : refreshToken;
  const reply = await reportReply(bearer(kind === 'sin' ? undefined : token));
  return done([responseCheck(asApiResult(reply), expected), noPdfCheck(reply)], { evidence: evidenceOf(reply) });
};

// --- Esquema 2: el informe es el del tenant del accessToken -----------------------------------------------------------------------

const tenantOfToken: ApiRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const header = strict('cabecera', TENANT_CELLS, cell(row, 'cabecera'));
  const superados = numberOf(cell(row, 'superados'));
  const fallidos = numberOf(cell(row, 'fallidos'));
  const bloqueados = numberOf(cell(row, 'bloqueados'));
  const expectedLine = `Último resultado - Superados: ${superados} · Fallidos: ${fallidos} · Bloqueados: ${bloqueados}`;
  const expected = `respuesta 200 con un PDF y el PDF dice «${expectedLine}»`;
  // Las dos filas de alumno02 y el tenant de la cabecera: alumno02 registra una ejecución fallida de TC-001 (en su propio tenant)
  await resetTenants([TENANT_A, TENANT_B]);
  const posted = await postRun(TENANT_B, await adminToken(TENANT_B), 'TC-001', 'fail');
  if (posted.status < 200 || posted.status >= 300) return preparationFailed(expected, 'alumno02@sigpro.lab registra en alumno02 una ejecución fallida de TC-001 (POST /api/test-cases/TC-001/runs)', posted);
  // La ejecución es de alumno02: alumno01 sigue con sus 25 casos y sus 50 ejecuciones del seed
  const untouched = await seedFailure(TENANT_A, expected, 25, 50);
  if (untouched !== undefined) return untouched;
  const session = await signedIn(account);
  const reply = await reportReply({ ...bearer(session.accessToken), 'x-tenant': header });
  return done(
    [
      check(session.accessToken !== undefined, 'la cuenta obtiene su accessToken al iniciar sesión', session.accessToken !== undefined ? 'obtiene su accessToken' : `inicio de sesión ${session.result.status}`),
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, expectedLine, 'Último resultado - Superados:'),
    ],
    { evidence: evidenceOf(reply) },
  );
};

// --- Esquema 3: cualquier cuenta con sesión recibe el mismo informe ---------------------------------------------------------------

const anyAccount: ApiRowHandler = async (row) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const password = strict('contraseña', PASSWORD_CELLS, cell(row, 'contraseña'));
  const expectedLine = 'Último resultado - Superados: 14 · Fallidos: 5 · Bloqueados: 6';
  const expected = `inicio de sesión con la contraseña ${password}, respuesta 200 con un PDF y el PDF dice «${expectedLine}»`;
  await resetTenants([TENANT_A]);
  const prepared = await seedFailure(TENANT_A, expected, 25);
  if (prepared !== undefined) return prepared;
  // La contraseña es la de la celda (no la del seed): si no abre la sesión, la fila lo muestra como discrepancia
  const session = await signedInWith(account.tenant, account.credentials.email, password);
  const reply = await reportReply(bearer(session.accessToken));
  return done(
    [
      check(session.accessToken !== undefined, `inicio de sesión con la contraseña ${password} y accessToken`, session.accessToken !== undefined ? 'inicio de sesión con accessToken' : `inicio de sesión ${session.result.status}`),
      responseCheck(asApiResult(reply), { status: 200 }),
      pdfCheck(reply),
      lineCheck(reply.lines, expectedLine, 'Último resultado - Superados:'),
    ],
    { evidence: evidenceOf(reply) },
  );
};

defineApiRows({
  story: 'US-VER-INFORME-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, withoutValidToken],
    [2, tenantOfToken],
    [3, anyAccount],
  ]),
});
