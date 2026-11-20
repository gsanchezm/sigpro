import { NO_CHAOS, setChaos, type ChaosFlags } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { ENV_NOTE, bodyOf, describeChaos, prepareAlumno, raw, sameChaos, show, statusCheck, withRestore, judge } from './common';

// US-API-PLATAFORMA-002 — Leer la configuración pública del tenant con la cabecera x-tenant. Preparación de cada fila: alumno01
// reiniciado y caos apagado. Las filas con caos fijan sus valores con PATCH /api/admin/chaos (alumno01@sigpro.lab) y, al terminar,
// vuelven a apagarlo y a reiniciar alumno01 (withRestore). alumno02 solo se lee por cabecera; nunca se escribe.

// --- Esquema 1: la configuración de un tenant sin caos -----------------------------------------------------------------------

const TENANT_HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(cabecera vacía)', ''],
  ['alumno01', 'alumno01'],
  ['alumno02', 'alumno02'],
  ['(alumno01 con un espacio delante y otro detrás)', ' alumno01 '],
  ['noexiste', 'noexiste'],
]);

const SPACED = '(alumno01 con un espacio delante y otro detrás)';

const tenantOfHeader: ApiRowHandler = async (row) => {
  const cabecera = cell(row, 'cabecera');
  const header = strict('cabecera', TENANT_HEADERS, cabecera);
  const expectedTenant = cell(row, 'tenant_devuelto');
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: header === undefined ? {} : { 'x-tenant': header } });
  const body = bodyOf(res);
  // Con espacios en los extremos, el cliente HTTP o el servidor pueden quitarlos antes que la API: la fila no distingue el recorte
  // Con espacios en los extremos, el cliente HTTP o el servidor pueden quitarlos antes que la API: la fila no prueba el recorte de la API.
  // Con cabecera vacía, la API responde lo mismo que sin cabecera (demo): la fila no distingue las dos.
  const note =
    cabecera === SPACED
      ? 'La cabecera llega con espacios en los extremos; el cliente HTTP o el servidor pueden quitarlos antes que la API, así que esta fila no prueba el recorte de la API (la evidencia guarda la cabecera enviada).'
      : cabecera === '(cabecera vacía)'
        ? 'Con cabecera vacía la API responde lo mismo que sin cabecera (demo): esta fila no distingue entre ambas.'
        : undefined;
  return judge(
    [
      statusCheck(res, 200),
      check(body.tenant === expectedTenant, `tenant ${expectedTenant}`, `tenant ${show(body.tenant)}`),
      check(body.env === 'dev', 'env «dev»', `env ${show(body.env)}`),
      check(body.version === '0.1.0', 'version «0.1.0»', `version ${show(body.version)}`),
      check(body.testUsers === true, 'testUsers true', `testUsers ${show(body.testUsers)}`),
    ],
    {
      ...(note === undefined ? {} : { note }),
      evidence: { cabeceraEnviada: header === undefined ? '(sin cabecera)' : header },
    },
  );
};

// --- Esquema 2: el caos del tenant aparece en la configuración ---------------------------------------------------------------

const LATENCIES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['1500', 1500],
  ['5000', 5000],
]);
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['0.25', 0.25],
  ['1', 1],
]);
const LABELS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['false', false],
  ['true', true],
]);

const chaosShown: ApiRowHandler = async (row) => {
  const flags: ChaosFlags = {
    latencyMs: strict('latencia', LATENCIES, cell(row, 'latencia')),
    errorRate: strict('tasa', RATES, cell(row, 'tasa')),
    flakyLabels: strict('etiquetas', LABELS, cell(row, 'etiquetas')),
  };
  const expected = `200 con chaos latencyMs ${cell(row, 'latencia')}, errorRate ${cell(row, 'tasa')} y flakyLabels ${cell(row, 'etiquetas')}`;
  return withRestore(async () => {
    await prepareAlumno();
    const set = await setChaos(TENANT_A, flags);
    if (set.status !== 200) return preparationFailed(expected, 'PATCH /api/admin/chaos con alumno01@sigpro.lab', set);
    const res = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    const chaos = bodyOf(res).chaos;
    return judge([statusCheck(res, 200), check(sameChaos(chaos, flags), expected, `200 con chaos ${describeChaos(chaos)}`)]);
  });
};

// --- Esquema 3: la configuración es pública (con o sin token) ----------------------------------------------------------------

const AUTHORIZATIONS: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(sin cabecera Authorization)', {}],
  ['Authorization Bearer token-inventado', { authorization: 'Bearer token-inventado' }],
]);

const publicConfig: ApiRowHandler = async (row) => {
  const auth = strict('autorizacion', AUTHORIZATIONS, cell(row, 'autorizacion'));
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A, ...auth } });
  const body = bodyOf(res);
  return judge([statusCheck(res, 200), check(body.tenant === TENANT_A, `tenant ${TENANT_A}`, `tenant ${show(body.tenant)}`)]);
};

// --- Esquema 4: el entorno decide si la configuración anuncia usuarios de prueba ---------------------------------------------

const ENVIRONMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['dev', 'dev'],
  ['staging', 'staging'],
  ['production', 'production'],
]);
const BOOLEAN_TEXT: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);

const envTestUsers: ApiRowHandler = async (row) => {
  const entorno = strict('entorno', ENVIRONMENTS, cell(row, 'entorno'));
  const testUsers = strict('testUsers', BOOLEAN_TEXT, cell(row, 'testUsers'));
  const expected = `200 con env ${entorno} y testUsers ${cell(row, 'testUsers')}`;
  // La pila aislada solo existe con APP_ENV=dev: las filas de staging y production no se pueden fijar aquí
  if (entorno !== 'dev') return notExecutable(expected, ENV_NOTE(entorno));
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
  const body = bodyOf(res);
  return judge([
    statusCheck(res, 200),
    check(body.env === entorno, `env ${entorno}`, `env ${show(body.env)}`),
    check(body.testUsers === testUsers, `testUsers ${String(testUsers)}`, `testUsers ${show(body.testUsers)}`),
  ]);
};

// --- Esquema 5: un tenant que no existe tiene el caos apagado ----------------------------------------------------------------

const unknownTenantChaos: ApiRowHandler = async (row) => {
  const tenant = strict('cabecera', new Map<string, string>([['noexiste', 'noexiste']]), cell(row, 'cabecera'));
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: { 'x-tenant': tenant } });
  const chaos = bodyOf(res).chaos;
  return judge([statusCheck(res, 200), check(sameChaos(chaos, NO_CHAOS), 'chaos latencyMs 0, errorRate 0 y flakyLabels false', `chaos ${describeChaos(chaos)}`)]);
};

defineApiRows({
  story: 'US-API-PLATAFORMA-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, tenantOfHeader],
    [2, chaosShown],
    [3, publicConfig],
    [4, envTestUsers],
    [5, unknownTenantChaos],
  ]),
});
