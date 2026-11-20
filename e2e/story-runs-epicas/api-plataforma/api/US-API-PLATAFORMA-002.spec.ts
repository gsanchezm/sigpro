import { NO_CHAOS, setChaos, type ChaosFlags } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailed, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler, type Outcome } from '../../core/framework';
import { ORIGIN, bodyOf, describeChaos, judge, prepareAlumno, raw, rawHttp, sameChaos, sentHeaderLine, show, statusCheck, withRestore, type Raw } from './common';
import { prepareAux, withAuxApi, type AuxClient } from './aux-api';

// US-API-PLATAFORMA-002 — Leer la configuración pública del tenant con la cabecera x-tenant. Preparación de cada fila: alumno01
// reiniciado y caos apagado. Las filas con caos fijan sus valores con PATCH /api/admin/chaos (alumno01@sigpro.lab) y, al terminar,
// vuelven a apagarlo y a reiniciar alumno01 (withRestore). alumno02 solo se lee por cabecera; nunca se escribe.
// Esquema 4 (staging y production): la pila principal es APP_ENV=dev, así que esas filas arrancan una segunda instancia de la API
// (mismo dist, misma base aislada) con su APP_ENV (aux-api.ts). Si no arranca, la fila es notExecutable con el motivo.

// --- Esquema 1: la configuración de un tenant sin caos -----------------------------------------------------------------------

const SPACED = '(alumno01 con un espacio delante y otro detrás)';
/** La fila con espacios se ejecuta con la línea que sale por el socket (lineaEnviada); el analizador del servidor la recorta después. */
const SPACED_NOTE =
  'El analizador HTTP del servidor elimina los espacios de los extremos del valor (RFC 7230 §3.2.4) antes de que la app lo lea: esta fila no distingue el .trim() de la app (config.controller.ts:25) del recorte del servidor. Mide lo que la API devuelve para esa petición, que es lo que dice la fila; la línea enviada está en la evidencia (lineaEnviada).';

const TENANT_HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['(cabecera vacía)', ''],
  ['alumno01', 'alumno01'],
  ['alumno02', 'alumno02'],
  [SPACED, ' alumno01 '],
  ['noexiste', 'noexiste'],
]);

/** Comprobaciones del Esquema 1 sobre una respuesta de /api/config. */
const tenantChecks = (res: Raw, expectedTenant: string): Check[] => {
  const body = bodyOf(res);
  return [
    statusCheck(res, 200),
    check(body.tenant === expectedTenant, `tenant ${expectedTenant}`, `tenant ${show(body.tenant)}`),
    check(body.env === 'dev', 'env «dev»', `env ${show(body.env)}`),
    check(body.version === '0.1.0', 'version «0.1.0»', `version ${show(body.version)}`),
    check(body.testUsers === true, 'testUsers true', `testUsers ${show(body.testUsers)}`),
  ];
};

/** Cabecera con espacios: se comprueba primero que la línea sale con sus espacios; si no, la fila no se puede ejecutar. */
const spacedRow = async (expectedTenant: string, header: string): Promise<Outcome> => {
  const expected = `200 con tenant ${expectedTenant}, env dev, version 0.1.0 y testUsers true`;
  const line = await sentHeaderLine(header);
  if (!(line.startsWith('x-tenant:  ') && line.endsWith(' alumno01 '))) {
    return notExecutable(expected, `la cabecera no sale con sus espacios (se envió ${show(line)}): el cliente la recorta antes de enviarla, así que esta fila no se puede ejecutar`);
  }
  await prepareAlumno();
  const res = await rawHttp(ORIGIN, '/api/config', { 'x-tenant': header });
  return judge(tenantChecks(res, expectedTenant), { note: SPACED_NOTE, evidence: { lineaEnviada: line } });
};

const tenantOfHeader: ApiRowHandler = async (row) => {
  const cabecera = cell(row, 'cabecera');
  const header = strict('cabecera', TENANT_HEADERS, cabecera);
  const expectedTenant = cell(row, 'tenant_devuelto');
  if (cabecera === SPACED && header !== undefined) return spacedRow(expectedTenant, header);
  await prepareAlumno();
  const res = await raw('GET', '/api/config', { headers: header === undefined ? {} : { 'x-tenant': header } });
  // Con cabecera vacía, la API responde demo igual que sin cabecera: la fila no distingue entre ambas (sí distingue el valor por defecto de un tenant vacío)
  const note =
    cabecera === '(cabecera vacía)'
      ? 'Con cabecera vacía la API responde demo, igual que sin cabecera: esta fila no distingue la cabecera vacía de la ausente; sí comprueba el valor por defecto frente a un tenant vacío.'
      : undefined;
  return judge(tenantChecks(res, expectedTenant), {
    ...(note === undefined ? {} : { note }),
    evidence: { celdaCabecera: cabecera, cabeceraEnviada: header === undefined ? '(sin cabecera)' : header },
  });
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

/** El caos exime /api/config y /api/health (chaos/chaos.ts:5) y errorRate solo afecta a escrituras (chaos/chaos.ts:20): «no retrasa ni falla» se mide como «no más lento». */
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

/** Comprobaciones del Esquema 4 sobre una respuesta de /api/config de una instancia con el APP_ENV de la fila. */
const envChecks = (res: Raw, entorno: string, testUsers: boolean): Check[] => {
  const body = bodyOf(res);
  return [
    statusCheck(res, 200),
    check(body.env === entorno, `env ${entorno}`, `env ${show(body.env)}`),
    check(body.testUsers === testUsers, `testUsers ${String(testUsers)}`, `testUsers ${show(body.testUsers)}`),
  ];
};

const envTestUsers: ApiRowHandler = async (row) => {
  const entorno = strict('entorno', ENVIRONMENTS, cell(row, 'entorno'));
  const testUsers = strict('testUsers', BOOLEAN_TEXT, cell(row, 'testUsers'));
  const expected = `200 con env ${entorno} y testUsers ${cell(row, 'testUsers')}`;
  if (entorno === 'dev') {
    await prepareAlumno();
    const res = await raw('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    return judge(envChecks(res, entorno, testUsers));
  }
  // staging y production: segunda instancia con ese APP_ENV; la principal no se toca
  return withAuxApi({ label: `002 E4 ${entorno}`, env: { APP_ENV: entorno }, expected }, async (aux: AuxClient) => {
    const prep = await prepareAux(aux);
    if (prep !== undefined) return preparationFailedWeb(expected, prep);
    const res = await aux.http('GET', '/api/config', { headers: { 'x-tenant': TENANT_A } });
    return judge(envChecks(res, entorno, testUsers));
  });
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
  // Las filas de instancia auxiliar arrancan y paran una API: su plazo es mayor que el de las demás
  rowTimeoutMs: (row) => (row.esquemaIndex === 4 ? 180_000 : 120_000),
  handlers: new Map<number, ApiRowHandler>([
    [1, tenantOfHeader],
    [2, chaosShown],
    [3, publicConfig],
    [4, envTestUsers],
    [5, unknownTenantChaos],
  ]),
});
