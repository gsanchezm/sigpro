import { NO_CHAOS, setChaos, type ChaosFlags } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { ENV_NOTE, bodyOf, describeChaos, judge, prepareAlumno, raw, sameChaos, show, statusCheck, withRestore } from './common';

// US-API-PLATAFORMA-002 — Leer la configuración pública del tenant con la cabecera x-tenant. Preparación de cada fila: alumno01
// reiniciado y caos apagado. Las filas con caos fijan sus valores con PATCH /api/admin/chaos (alumno01@sigpro.lab) y, al terminar,
// vuelven a apagarlo y a reiniciar alumno01 (withRestore). alumno02 solo se lee por cabecera; nunca se escribe.

// --- Esquema 1: la configuración de un tenant sin caos -----------------------------------------------------------------------

const SPACED = '(alumno01 con un espacio delante y otro detrás)';
/** La fila con espacios no se puede observar por HTTP: el recorte ocurre antes de que la petición salga o llegue a la API. */
const SPACED_NOTE =
  'No observable por HTTP: fetch normaliza el valor de la cabecera y quita los espacios de los extremos antes de enviarla (WHATWG Fetch), y el analizador HTTP del servidor los quita también (RFC 7230 §3.2.4). La API recibe lo mismo que con «alumno01», así que el .trim() de config.controller.ts:25 no se distingue.';

const TENANT_HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(cabecera vacía)', ''],
  ['alumno01', 'alumno01'],
  ['alumno02', 'alumno02'],
  [SPACED, ' alumno01 '],
  ['noexiste', 'noexiste'],
]);

const tenantOfHeader: ApiRowHandler = async (row) => {
  const cabecera = cell(row, 'cabecera');
  const header = strict('cabecera', TENANT_HEADERS, cabecera);
  const expectedTenant = cell(row, 'tenant_devuelto');
  if (cabecera === SPACED) return notExecutable(`200 con tenant ${expectedTenant}`, SPACED_NOTE);
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: header === undefined ? {} : { 'x-tenant': header } });
  const body = bodyOf(res);
  // Con cabecera vacía, la API responde demo igual que sin cabecera: la fila no distingue entre ambas (sí distingue el valor por defecto de un tenant vacío)
  const note = cabecera === '(cabecera vacía)' ? 'Con cabecera vacía la API responde demo, igual que sin cabecera: esta fila no distingue la cabecera vacía de la ausente; sí comprueba el valor por defecto frente a un tenant vacío.' : undefined;
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
      evidence: { celdaCabecera: cabecera, cabeceraEnviada: header === undefined ? '(sin cabecera)' : header },
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

/** El caos exime /api/config (chaos.ts:5) y errorRate solo afecta a escrituras (chaos.ts:20): «no retrasa ni falla» se mide como «no más lento». */
const TIMING_NOTE =
  'El caos exime /api/config y /api/health (chaos/chaos.ts:5) y errorRate solo afecta a escrituras (chaos/chaos.ts:20): «no retrasa ni falla» se mide como «no más lento». Los milisegundos son un dato aparte, sin umbral (README, Tolerancias).';
/** Con todo a cero, la preparación ya deja el caos así: la fila no prueba que el PATCH surta efecto. */
const ZERO_NOTE = 'La preparación ya deja el caos a cero: esta fila no prueba que el PATCH surta efecto (sí comprueba que responde 200 y que la configuración sale a cero).';

const chaosShown: ApiRowHandler = async (row) => {
  const flags: ChaosFlags = {
    latencyMs: strict('latencia', LATENCIES, cell(row, 'latencia')),
    errorRate: strict('tasa', RATES, cell(row, 'tasa')),
    flakyLabels: strict('etiquetas', LABELS, cell(row, 'etiquetas')),
  };
  const expected = `200 con chaos latencyMs ${cell(row, 'latencia')}, errorRate ${cell(row, 'tasa')} y flakyLabels ${cell(row, 'etiquetas')}`;
  const isZero = flags.latencyMs === 0 && flags.errorRate === 0 && flags.flakyLabels === false;
  return withRestore(async () => {
    await prepareAlumno();
    // Medida de referencia: el mismo GET con el caos apagado
    const calm = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    const set = await setChaos(TENANT_A, flags);
    if (set.status !== 200) return preparationFailed(expected, 'PATCH /api/admin/chaos con alumno01@sigpro.lab', set);
    const under = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    const chaos = bodyOf(under).chaos;
    const note = isZero ? `${ZERO_NOTE} ${TIMING_NOTE}` : TIMING_NOTE;
    return judge([statusCheck(under, 200), check(sameChaos(chaos, flags), expected, `200 con chaos ${describeChaos(chaos)}`)], {
      note,
      evidence: { msCaosApagado: calm.ms, msConCaos: under.ms, diferenciaMs: under.ms - calm.ms },
    });
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

/** Caos fijado en alumno01 mientras se lee el tenant inexistente: si el caos se filtrara entre tenants, `noexiste` lo mostraría. */
const LEAK_PROBE: ChaosFlags = { latencyMs: 5000, errorRate: 1, flakyLabels: true };

const unknownTenantChaos: ApiRowHandler = async (row) => {
  const tenant = strict('cabecera', new Map<string, string>([['noexiste', 'noexiste']]), cell(row, 'cabecera'));
  return withRestore(async () => {
    await prepareAlumno();
    const set = await setChaos(TENANT_A, LEAK_PROBE);
    if (set.status !== 200) return preparationFailed('chaos de noexiste en cero', 'PATCH /api/admin/chaos con alumno01@sigpro.lab', set);
    // Control: alumno01 tiene el caos fijado ahora mismo (si no, la lectura de noexiste no probaría nada)
    const control = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    const res = await raw('GET', '/api/config', { headers: { 'x-tenant': tenant } });
    const chaos = bodyOf(res).chaos;
    return judge(
      [
        statusCheck(res, 200),
        check(sameChaos(chaos, NO_CHAOS), 'chaos latencyMs 0, errorRate 0 y flakyLabels false', `chaos ${describeChaos(chaos)}`),
        check(sameChaos(bodyOf(control).chaos, LEAK_PROBE), 'control: alumno01 tiene el caos fijado (5000, 1, true) mientras se lee noexiste', `control alumno01 ${describeChaos(bodyOf(control).chaos)}`),
      ],
      { note: 'Se fija el caos máximo en alumno01 durante la lectura de noexiste y se restaura al terminar (withRestore).' },
    );
  });
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
