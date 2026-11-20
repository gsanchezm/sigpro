import { defineApiRows, type ApiRowHandler, type Outcome } from '../../core/framework';
import { cell, check, parseResponse, responseCheck, strict, type Check } from '../../support/checks';
import type { ApiResult } from '../../../story-runs/support/api';
import {
  OBSERVE_MS,
  TENANT_A,
  adminAccess,
  commentNc,
  conclude,
  countsOf,
  createNc,
  describeEvent,
  describeHandshake,
  eventFieldCheck,
  gestorSession,
  intOf,
  isOk,
  openRealtime,
  pairsOf,
  patchNcSeverity,
  positiveControl,
  prepFailure,
  prepFailureReason,
  quietWindow,
  resetTenants,
  simulatorMsOf,
  summaryOf,
  transitionNc,
  varCheck,
  type RealtimeClient,
} from './common';

// US-MISION-FEED-003 — Forma, gravedad y cifras de cada evento de misión (API).
// Preparación: alumno01 reiniciado; una conexión abierta con el accessToken de gestor@sigpro.test. Las NC del seed son NC-001 a NC-012,
// con 8 abiertas (2 menores, 2 mayores y 4 críticas). La API se arranca con SIMULATOR_MS=0.

/** Gravedad de la no conformidad que se da de alta (celda «gravedad»). */
const GRAVEDAD: ReadonlyMap<string, 'minor' | 'major' | 'critical'> = new Map<string, 'minor' | 'major' | 'critical'>([
  ['minor', 'minor'],
  ['major', 'major'],
  ['critical', 'critical'],
]);

/** Gravedad del evento que la historia espera (celda «severidad_evento»). */
const SEVERIDAD_EVENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['info', 'info'],
  ['warn', 'warn'],
  ['danger', 'danger'],
  ['ok', 'ok'],
]);

/** Tipo de evento que la historia espera para cada cambio (celda «tipo»). */
const TIPO_EVENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['nc_moved', 'nc_moved'],
  ['nc_closed', 'nc_closed'],
  ['nc_updated', 'nc_updated'],
  ['nc_commented', 'nc_commented'],
]);

/** Cambios de una NC existente (celda «cambio»), cada uno con la llamada exacta de la historia. */
const CAMBIO: ReadonlyMap<string, (token: string) => Promise<ApiResult>> = new Map<string, (token: string) => Promise<ApiResult>>([
  ['pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition', (token) => transitionNc(token, TENANT_A, 'NC-001', 'in_analysis')],
  ['pasa NC-002 a rejected con POST /api/nc/NC-002/transition', (token) => transitionNc(token, TENANT_A, 'NC-002', 'rejected')],
  [
    'cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad`',
    (token) => transitionNc(token, TENANT_A, 'NC-003', 'closed', 'Acción correctiva verificada por calidad'),
  ],
  ['cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', (token) => patchNcSeverity(token, TENANT_A, 'NC-001', 'critical')],
  ['añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments', (token) => commentNc(token, TENANT_A, 'NC-006', 'Seguimiento de prueba')],
]);

/**
 * Lo que dan por hecho la historia y el seed para cada cambio (celda «cambio»): el programa de la NC y las cifras por severidad tras el
 * cambio (NC abiertas del seed: NC-001 y NC-007 menores; NC-002 y NC-008 mayores; NC-003, NC-006, NC-009 y NC-012 críticas).
 */
const CAMBIO_ESPERADO: ReadonlyMap<string, { readonly programCode: string; readonly counts: string }> = new Map<string, { readonly programCode: string; readonly counts: string }>([
  ['pasa NC-001 a in_analysis con POST /api/nc/NC-001/transition', { programCode: 'PRG-001', counts: 'minor 2, major 2, critical 4' }],
  ['pasa NC-002 a rejected con POST /api/nc/NC-002/transition', { programCode: 'PRG-001', counts: 'minor 2, major 1, critical 4' }],
  [
    'cierra NC-003 con POST /api/nc/NC-003/transition, to closed y el comentario `Acción correctiva verificada por calidad`',
    { programCode: 'PRG-001', counts: 'minor 2, major 2, critical 3' },
  ],
  ['cambia la gravedad de NC-001 a critical con PATCH /api/nc/NC-001', { programCode: 'PRG-001', counts: 'minor 1, major 2, critical 5' }],
  ['añade a NC-006 el comentario `Seguimiento de prueba` con POST /api/nc/NC-006/comments', { programCode: 'PRG-002', counts: 'minor 2, major 2, critical 4' }],
]);

/** Formato del identificador (`EV-` y cuatro cifras) y de la fecha (ISO 8601, como la emite `toISOString`). */
const ID_EV = /^EV-\d{4}$/;
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Operaciones que la API rechaza (celda «operacion»). */
const RECHAZADA: ReadonlyMap<string, (token: string) => Promise<ApiResult>> = new Map<string, (token: string) => Promise<ApiResult>>([
  ['pide pasar NC-001 a rejected desde open con POST /api/nc/NC-001/transition', (token) => transitionNc(token, TENANT_A, 'NC-001', 'rejected')],
  ['pide pasar NC-004, que está cerrada, a open con POST /api/nc/NC-004/transition', (token) => transitionNc(token, TENANT_A, 'NC-004', 'open')],
]);

/** Descripciones de la historia (celda «descripcion»): el texto que se envía y el número de caracteres que la historia dice. */
const DESCRIPCION: ReadonlyMap<string, { readonly text: string; readonly length: number }> = new Map<string, { readonly text: string; readonly length: number }>([
  ['`Desviació` (9 caracteres)', { text: 'Desviació', length: 9 }],
  ['`Desviación` (10 caracteres)', { text: 'Desviación', length: 10 }],
]);

/** Lo que la historia dice que recibe la conexión tras la alta de la fila 4 (celda «evento»). */
const EVENTO_ALTA: ReadonlyMap<string, 'nc_created_7' | 'ninguno'> = new Map<string, 'nc_created_7' | 'ninguno'>([
  ['recibe el evento nc_created con seq 7', 'nc_created_7'],
  ['no recibe ningún evento durante la observación', 'ninguno'],
]);

/** Abre la preparación común: alumno01 reiniciado, admin y gestor con sesión, la API con SIMULATOR_MS 0 y la conexión del gestor abierta. */
const prepare = async (expected: string): Promise<{ readonly failed: Outcome } | { readonly adminToken: string; readonly client: RealtimeClient }> => {
  await resetTenants([TENANT_A]);
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return { failed: prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result) } as const;
  const summary = await summaryOf(gestor.session.accessToken, TENANT_A);
  if (simulatorMsOf(summary) !== 0) return { failed: prepFailureReason(expected, `la API no arrancó con SIMULATOR_MS 0 (resumen: ${String(simulatorMsOf(summary) ?? '(sin leer)')})`) } as const;
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return { failed: prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', admin.last) } as const;
  const client = await openRealtime({ token: gestor.session.accessToken });
  if (client.handshake.status !== 'accepted') {
    await client.close();
    return { failed: prepFailure(expected, 'la conexión se abre con el accessToken de gestor', { status: 0, body: client.handshake, ms: 0 }) } as const;
  }
  return { adminToken: admin.token, client } as const;
};

// --- Esquema 1: una NC nueva emite un evento con su gravedad y las cifras tras el alta --------------------------------------

const altaConGravedad: ApiRowHandler = async (row) => {
  const expected = `la conexión recibe un evento nc_created con seq 7, origen system y programCode PRG-002, con severity ${cell(row, 'severidad_evento')}, vars.code NC-013, vars.severity ${cell(row, 'gravedad')} y vars.program PRG-002; ncOpen 9 y ncBySeverity ${cell(row, 'conteo')}`;
  const severidad = strict('severidad_evento', SEVERIDAD_EVENTO, cell(row, 'severidad_evento'));
  const gravedad = strict('gravedad', GRAVEDAD, cell(row, 'gravedad'));
  const esperado = countsOf(cell(row, 'conteo'));
  const prep = await prepare(expected);
  if ('failed' in prep) return prep.failed;
  try {
    const created = await createNc(prep.adminToken, TENANT_A, gravedad);
    const event = await prep.client.waitEvent((item) => item.type === 'nc_created');
    const counts = event?.ncBySeverity;
    return conclude(
      [
        check(created.status === 201, 'alumno01@sigpro.lab crea la NC con POST /api/nc (201)', `POST /api/nc respondió ${created.status}`),
        eventFieldCheck(event, 'type', 'nc_created'),
        eventFieldCheck(event, 'seq', 7),
        eventFieldCheck(event, 'origin', 'system'),
        eventFieldCheck(event, 'programCode', 'PRG-002'),
        check(event !== undefined && ID_EV.test(event.id) && event.id === 'EV-0007', 'id EV-0007', `id ${String(event?.id ?? '(sin leer)')}`),
        check(event !== undefined && ISO_8601.test(event.at), 'at en ISO 8601', `at ${String(event?.at ?? '(sin leer)')}`),
        eventFieldCheck(event, 'severity', severidad),
        varCheck(event, 'code', 'NC-013'),
        varCheck(event, 'severity', gravedad),
        varCheck(event, 'program', 'PRG-002'),
        check(event?.ncOpen === 9, 'ncOpen 9', `ncOpen ${String(event?.ncOpen ?? '(sin leer)')}`),
        check(
          counts !== undefined && counts.minor === esperado.minor && counts.major === esperado.major && counts.critical === esperado.critical,
          `ncBySeverity minor ${esperado.minor}, major ${esperado.major}, critical ${esperado.critical}`,
          counts === undefined ? 'ncBySeverity (sin leer)' : `ncBySeverity minor ${counts.minor}, major ${counts.major}, critical ${counts.critical}`,
        ),
      ],
      { evidence: { eventoRecibido: describeEvent(event), saludo: describeHandshake(prep.client.handshake) } },
    );
  } finally {
    await prep.client.close();
  }
};

// --- Esquema 2: cada cambio de una NC existente emite su tipo y sus cifras tras el cambio ----------------------------------

const cambioEmiteTipo: ApiRowHandler = async (row) => {
  const expected = `la conexión recibe un evento ${cell(row, 'tipo')} con severity ${cell(row, 'severidad_evento')}, vars ${cell(row, 'variables')} y ncOpen ${cell(row, 'ncOpen')}`;
  const change = strict('cambio', CAMBIO, cell(row, 'cambio'));
  const tipo = strict('tipo', TIPO_EVENTO, cell(row, 'tipo'));
  const severidad = strict('severidad_evento', SEVERIDAD_EVENTO, cell(row, 'severidad_evento'));
  const variables = pairsOf(cell(row, 'variables'));
  const ncOpen = intOf(cell(row, 'ncOpen'));
  const prep = await prepare(expected);
  if ('failed' in prep) return prep.failed;
  try {
    const result = await change(prep.adminToken);
    const event = await prep.client.waitEvent((item) => item.type === tipo);
    const esperado = strict('cambio', CAMBIO_ESPERADO, cell(row, 'cambio'));
    const wanted = countsOf(esperado.counts);
    const observed = event?.ncBySeverity;
    const checks: Check[] = [
      check(isOk(result), 'la operación se acepta (2xx)', `la operación responde ${result.status}`),
      eventFieldCheck(event, 'type', tipo),
      eventFieldCheck(event, 'severity', severidad),
      check(event?.ncOpen === ncOpen, `ncOpen ${ncOpen}`, `ncOpen ${String(event?.ncOpen ?? '(sin leer)')}`),
      // Regla 1 (forma del evento) y Regla 2 (origen system, programCode) y Regla 3 (cifras tras el cambio, por severidad)
      eventFieldCheck(event, 'origin', 'system'),
      eventFieldCheck(event, 'programCode', esperado.programCode),
      eventFieldCheck(event, 'seq', 7),
      check(event !== undefined && ID_EV.test(event.id) && event.id === 'EV-0007', 'id EV-0007', `id ${String(event?.id ?? '(sin leer)')}`),
      check(event !== undefined && ISO_8601.test(event.at), 'at en ISO 8601', `at ${String(event?.at ?? '(sin leer)')}`),
      check(
        observed !== undefined && observed.minor === wanted.minor && observed.major === wanted.major && observed.critical === wanted.critical,
        `ncBySeverity ${esperado.counts}`,
        observed === undefined ? 'ncBySeverity (sin leer)' : `ncBySeverity minor ${observed.minor}, major ${observed.major}, critical ${observed.critical}`,
      ),
    ];
    for (const [key, value] of Object.entries(variables)) checks.push(varCheck(event, key, value));
    return conclude(checks, { evidence: { eventoRecibido: describeEvent(event), respuesta: result.status } });
  } finally {
    await prep.client.close();
  }
};

// --- Esquema 3: una operación rechazada no emite ningún evento -----------------------------------------------------------------

const rechazadaSinEvento: ApiRowHandler = async (row) => {
  const expected = `la API responde ${cell(row, 'respuesta')} y la conexión no recibe ningún evento durante la observación`;
  const operation = strict('operacion', RECHAZADA, cell(row, 'operacion'));
  const respuesta = parseResponse(cell(row, 'respuesta'));
  const prep = await prepare(expected);
  if ('failed' in prep) return prep.failed;
  try {
    const result = await operation(prep.adminToken);
    const received = await quietWindow(prep.client, OBSERVE_MS);
    return conclude(
      [
        responseCheck(result, respuesta),
        check(received === 0, 'la conexión no recibe ningún evento durante la observación', `la conexión recibe ${received} evento(s)`),
        await positiveControl(prep.client, prep.adminToken, TENANT_A),
      ],
      { evidence: { respuesta: result.status } },
    );
  } finally {
    await prep.client.close();
  }
};

// --- Esquema 4: la descripción necesita 10 caracteres para emitir el evento ----------------------------------------------------

const descripcionMinima: ApiRowHandler = async (row) => {
  const expected = `la API responde ${cell(row, 'respuesta')} y la conexión ${cell(row, 'evento')}`;
  const descripcion = strict('descripcion', DESCRIPCION, cell(row, 'descripcion'));
  const respuesta = parseResponse(cell(row, 'respuesta'));
  const evento = strict('evento', EVENTO_ALTA, cell(row, 'evento'));
  const prep = await prepare(expected);
  if ('failed' in prep) return prep.failed;
  try {
    const result = await createNc(prep.adminToken, TENANT_A, 'minor', descripcion.text);
    const checks: Check[] = [responseCheck(result, respuesta)];
    if (evento === 'nc_created_7') {
      const event = await prep.client.waitEvent((item) => item.type === 'nc_created');
      checks.push(eventFieldCheck(event, 'seq', 7), check(event?.type === 'nc_created', 'la conexión recibe el evento nc_created', describeEvent(event)));
    } else {
      const received = await quietWindow(prep.client, OBSERVE_MS);
      checks.push(check(received === 0, 'la conexión no recibe ningún evento durante la observación', `la conexión recibe ${received} evento(s)`));
      checks.push(await positiveControl(prep.client, prep.adminToken, TENANT_A));
    }
    return conclude(checks, { evidence: { respuesta: result.status, longitudEnviada: descripcion.text.length } });
  } finally {
    await prep.client.close();
  }
};

defineApiRows({
  story: 'US-MISION-FEED-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, altaConGravedad],
    [2, cambioEmiteTipo],
    [3, rechazadaSinEvento],
    [4, descripcionMinima],
  ]),
});
