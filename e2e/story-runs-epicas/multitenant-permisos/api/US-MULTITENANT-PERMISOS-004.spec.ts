import { call, field, type ApiResult } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { cell, check, parseResponse, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { conclude, itemsOf, prepareTenants, restoring, statusCheck, valueCheck } from './common';

// US-MULTITENANT-PERMISOS-004: la cabecera x-tenant no cambia el tenant de un token. Preparación de cada fila (la de la regla,
// perfil «basico» de alumno02: renombra PRG-001 y crea PRG-025): alumno01 y alumno02 se reinician con el token de su administrador,
// cada uno inicia sesión y alumno02 aplica sus dos pasos. Las filas envían el token de alumno01 con una cabecera distinta.

const expectName = (name: string): ((result: ApiResult) => readonly Check[]) => (result) => [statusCheck(result, 200), valueCheck(result, 'name', name, 'nombre')];

/** Cabeceras de las filas: un tenant real distinto, un valor desconocido o ninguna cabecera (`undefined`). */
const HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['alumno02', TENANT_B],
  ['noexiste', 'noexiste'],
  ['(sin cabecera)', undefined],
]);

// --- Esquema 1: con un token de alumno01, la cabecera x-tenant no cambia la lectura -----------------------------------------

const READ_RESPONSE: ReadonlyMap<string, (result: ApiResult) => readonly Check[]> = new Map<string, (result: ApiResult) => readonly Check[]>([
  ['404 program_not_found', (result) => [responseCheck(result, parseResponse('404 program_not_found'))]],
  ['200 con el nombre «Sistema de mando táctico Ártemis»', expectName('Sistema de mando táctico Ártemis')],
  [
    '200 con el correo alumno01@sigpro.lab y el tenant alumno01',
    (result) => [
      statusCheck(result, 200),
      valueCheck(result, 'email', 'alumno01@sigpro.lab', 'correo'),
      valueCheck(result, 'tenant', TENANT_A, 'tenant'),
    ],
  ],
  ['200 con total 0', (result) => [statusCheck(result, 200), valueCheck(result, 'total', 0, 'total'), check(itemsOf(result.body).length === 0, 'ningún elemento', `${itemsOf(result.body).length} elementos`)]],
]);

const headerDoesNotChangeRead: ApiRowHandler = async (row) => {
  const expect = strict('respuesta', READ_RESPONSE, cell(row, 'respuesta'));
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  const prepared = await prepareTenants('basico');
  if ('failed' in prepared) return preparationFailed(cell(row, 'respuesta'), prepared.failed.step, prepared.failed.result);
  const result = await call('GET', cell(row, 'ruta').replace(/^\/api/, ''), { ...(header === undefined ? {} : { tenant: header }), token: prepared.ok.token01 });
  return conclude(expect(result), { evidence: { cabecera: cell(row, 'cabecera') } });
};

// --- Esquema 2: sin token, la cabecera x-tenant no abre datos ----------------------------------------------------------------

const NO_TOKEN_OPS: ReadonlyMap<string, { readonly method: 'GET' | 'POST'; readonly path: string }> = new Map([
  ['GET /api/programs/PRG-025', { method: 'GET', path: '/programs/PRG-025' }],
  ['GET /api/audit', { method: 'GET', path: '/audit' }],
  ['POST /api/admin/reset', { method: 'POST', path: '/admin/reset' }],
]);

const noTokenNoData: ApiRowHandler = async (row) => {
  const op = strict('operación', NO_TOKEN_OPS, cell(row, 'operacion'));
  const prepared = await prepareTenants('basico');
  if ('failed' in prepared) return preparationFailed('401 missing_token', prepared.failed.step, prepared.failed.result);
  const result = await call(op.method, op.path, { tenant: TENANT_B });
  // «No se ha reiniciado»: PRG-025 sigue existiendo con su nombre en alumno02 (se lee con el token de alumno02)
  const still = await call('GET', '/programs/PRG-025', { tenant: TENANT_B, token: prepared.ok.token02 });
  return conclude([responseCheck(result, parseResponse('401 missing_token')), statusCheck(still, 200), valueCheck(still, 'name', 'Programa de aislamiento nuevo', 'nombre de PRG-025')], {
    note: 'la regla dice «con cualquier valor de la cabecera»: en esta familia sin token la fila solo usa la cabecera de alumno02; los demás valores no se prueban aquí',
  });
};

// --- Esquema 3: el reinicio con un token de alumno01 reinicia solo alumno01 ---------------------------------------------------

const resetWithHeader: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  const prepared = await prepareTenants('basico');
  if ('failed' in prepared) return preparationFailed('200 con el tenant alumno01', prepared.failed.step, prepared.failed.result);
  const reset = await call('POST', '/admin/reset', { ...(header === undefined ? {} : { tenant: header }), token: prepared.ok.token01 });
  const resetOk = reset.status === 200 && field(reset.body, 'tenant') === TENANT_A;

  // alumno01 se reinició: PRG-025 ya no existe y PRG-001 vuelve al seed (leído con el token de alumno01)
  const a25 = await call('GET', '/programs/PRG-025', { tenant: TENANT_A, token: prepared.ok.token01 });
  const a001 = await call('GET', '/programs/PRG-001', { tenant: TENANT_A, token: prepared.ok.token01 });
  // alumno02 no se tocó: PRG-025 con su nombre y PRG-001 renombrado (leído con el token de alumno02)
  const b25 = await call('GET', '/programs/PRG-025', { tenant: TENANT_B, token: prepared.ok.token02 });
  const b001 = await call('GET', '/programs/PRG-001', { tenant: TENANT_B, token: prepared.ok.token02 });

  return conclude([
    check(resetOk, 'respuesta 200 con el tenant alumno01', `respuesta ${reset.status} con el tenant ${String(field(reset.body, 'tenant'))}`),
    responseCheck(a25, parseResponse('404 program_not_found')),
    valueCheck(a001, 'name', 'Sistema de mando táctico Ártemis', 'PRG-001 de alumno01 con el nombre'),
    statusCheck(b25, 200),
    valueCheck(b25, 'name', 'Programa de aislamiento nuevo', 'PRG-025 de alumno02 con el nombre'),
    statusCheck(b001, 200),
    valueCheck(b001, 'name', 'Programa de aislamiento', 'PRG-001 de alumno02 con el nombre'),
  ], { evidence: { cabecera: cell(row, 'cabecera') } });
};

defineApiRows({
  story: 'US-MULTITENANT-PERMISOS-004',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, restoring(headerDoesNotChangeRead)],
    [2, restoring(noTokenNoData)],
    [3, restoring(resetWithHeader)],
  ]),
});
