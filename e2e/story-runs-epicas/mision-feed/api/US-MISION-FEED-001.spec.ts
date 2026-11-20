import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { cell, check, sleep, strict, type Check } from '../../support/checks';
import type { ApiResult } from '../../../story-runs/support/api';
import {
  OBSERVE_MS,
  TENANT_A,
  TENANT_B,
  adminAccess,
  conclude,
  createNc,
  describeEvent,
  describeHandshake,
  eventFieldCheck,
  gestorSession,
  mfaTokenOf,
  openRealtime,
  prepFailure,
  quietWindow,
  resetTenants,
  simulatorOffOutcome,
  varCheck,
  withNote,
  type RealtimeClient,
} from './common';

// US-MISION-FEED-001 — Abrir la conexión en tiempo real solo con un token de acceso vigente (API).
// Preparación: reinicio de alumno01 con el token de su administrador; los tokens se obtienen con el inicio de sesión de la historia.

/** Un token emitido para la fila (o `undefined` si la fila no lo lleva: «(sin el campo)»), y la última respuesta para explicar un fallo. */
interface Issued {
  readonly token: string | undefined;
  readonly last?: ApiResult;
}

/** Cómo obtiene la fila su token: la función emite el token que la historia nombra en el tenant de la fila. */
interface TokenCase {
  readonly issue: (tenant: string) => Promise<Issued>;
  /** `true` si la fila NO lleva token (la historia dice «(sin el campo)»): entonces `undefined` es lo esperado. */
  readonly withoutField: boolean;
}

/** Altera la última letra del token (la firma queda inválida). */
const alterLast = (token: string): string => `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;

/** Texto de la celda «token» → cómo se obtiene el token que la historia nombra. */
const TOKEN_CASE_OF_CELL: ReadonlyMap<string, TokenCase> = new Map<string, TokenCase>([
  [
    'el accessToken de gestor@sigpro.test',
    {
      issue: async (tenant) => {
        const started = await gestorSession(tenant);
        return { token: started.session?.accessToken, last: started.result };
      },
      withoutField: false,
    },
  ],
  [
    'el accessToken de gestor@sigpro.test con la última letra cambiada',
    {
      issue: async (tenant) => {
        const started = await gestorSession(tenant);
        const token = started.session?.accessToken;
        return { token: token === undefined ? undefined : alterLast(token), last: started.result };
      },
      withoutField: false,
    },
  ],
  ['(sin el campo)', { issue: async () => ({ token: undefined }), withoutField: true }],
  ['un texto que no es un token', { issue: async () => ({ token: 'esto-no-es-un-token' }), withoutField: false }],
  [
    'el refreshToken de gestor@sigpro.test',
    {
      issue: async (tenant) => {
        const started = await gestorSession(tenant);
        return { token: started.session?.refreshToken, last: started.result };
      },
      withoutField: false,
    },
  ],
  [
    'el mfaToken de admin@sigpro.test',
    {
      issue: async (tenant) => {
        const issued = await mfaTokenOf(tenant);
        return { token: issued.token, last: issued.last };
      },
      withoutField: false,
    },
  ],
]);

/** Lo que dice la celda «resultado» del Esquema 1, como se comprueba. */
const RESULTADO_CONEXION: ReadonlyMap<string, 'abre' | 'rechaza'> = new Map<string, 'abre' | 'rechaza'>([
  ['la conexión se abre y queda a la espera de eventos', 'abre'],
  ['la API rechaza la conexión con el error invalid_token y no se abre', 'rechaza'],
]);

/** Medio segundo con la conexión abierta: «queda a la espera de eventos» se mide con la conexión viva, no al primer instante. */
const holdOpen = async (client: RealtimeClient): Promise<boolean> => {
  await sleep(500);
  return client.isOpen();
};

// --- Esquema 1: solo un token de acceso vigente abre la conexión ------------------------------------------------------------

const soloAccesoVigente: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const expected = cell(row, 'resultado');
  const notOff = await simulatorOffOutcome(expected);
  if (notOff) return notOff;
  const tokenCase = strict('token', TOKEN_CASE_OF_CELL, cell(row, 'token'));
  const resultado = strict('resultado', RESULTADO_CONEXION, expected);
  const issued = await tokenCase.issue(TENANT_A);
  if (issued.token === undefined && !tokenCase.withoutField) {
    return prepFailure(expected, `obtener ${cell(row, 'token')}`, issued.last ?? { status: 0, body: null, ms: 0 });
  }
  const client = await openRealtime(issued.token === undefined ? {} : { token: issued.token });
  try {
    const accepted = client.handshake.status === 'accepted';
    const stillOpen = accepted ? await holdOpen(client) : false;
    const checks: Check[] =
      resultado === 'abre'
        ? [check(accepted, 'la conexión se abre', describeHandshake(client.handshake)), check(stillOpen, 'queda a la espera de eventos', stillOpen ? 'queda a la espera de eventos' : 'la conexión se cierra al abrirse')]
        : [
            check(client.handshake.status === 'rejected' && client.handshake.message === 'invalid_token', 'la API rechaza la conexión con el error invalid_token', describeHandshake(client.handshake)),
            check(!accepted, 'no se abre', accepted ? 'se abre' : 'no se abre'),
          ];
    return conclude(checks, { evidence: { token: cell(row, 'token'), saludo: client.handshake.status } });
  } finally {
    await client.close();
  }
};

// --- Esquema 2: una conexión rechazada no recibe eventos de su tenant ------------------------------------------------------

const CONEXION_ESPERADA: ReadonlyMap<string, 'abierta' | 'cerrada'> = new Map<string, 'abierta' | 'cerrada'>([
  ['está abierta', 'abierta'],
  ['no se ha abierto', 'cerrada'],
]);

const EVENTO_ESPERADO: ReadonlyMap<string, 'nc_created_7' | 'ninguno'> = new Map<string, 'nc_created_7' | 'ninguno'>([
  ['recibe el evento nc_created con seq 7', 'nc_created_7'],
  ['no recibe ningún evento durante la observación', 'ninguno'],
]);

const rechazadaSinEventos: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const conexion = strict('resultado_conexion', CONEXION_ESPERADA, cell(row, 'resultado_conexion'));
  const evento = strict('resultado_evento', EVENTO_ESPERADO, cell(row, 'resultado_evento'));
  const tokenCase = strict('token', TOKEN_CASE_OF_CELL, cell(row, 'token'));
  const expected = `la conexión ${cell(row, 'resultado_conexion')} y ${cell(row, 'resultado_evento')}`;
  const notOff = await simulatorOffOutcome(expected);
  if (notOff) return notOff;
  const issued = await tokenCase.issue(TENANT_A);
  if (issued.token === undefined) return prepFailure(expected, `obtener ${cell(row, 'token')}`, issued.last ?? { status: 0, body: null, ms: 0 });
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  // La conexión se intenta ANTES de la acción: la historia dice «se ha intentado abrir una conexión con <token>»
  const client = await openRealtime({ token: issued.token });
  try {
    const created = await createNc(admin.token, TENANT_A, 'minor');
    const event = evento === 'nc_created_7' ? await client.waitEvent((item) => item.type === 'nc_created') : undefined;
    if (evento === 'ninguno') await quietWindow(client, OBSERVE_MS);
    const accepted = client.handshake.status === 'accepted';
    const checks: Check[] = [
      check(created.status === 201, 'alumno01@sigpro.lab crea la NC con POST /api/nc (201)', `POST /api/nc respondió ${created.status}`),
      conexion === 'abierta'
        ? check(accepted, 'la conexión está abierta', describeHandshake(client.handshake))
        : check(!accepted, 'la conexión no se ha abierto', accepted ? 'la conexión sí se abrió' : describeHandshake(client.handshake)),
    ];
    if (evento === 'nc_created_7') {
      checks.push(eventFieldCheck(event, 'seq', 7), varCheck(event, 'code', 'NC-013'), check(event?.type === 'nc_created', 'recibe el evento nc_created', describeEvent(event)));
    } else {
      checks.push(check(client.events().length === 0, 'no recibe ningún evento durante la observación', `recibe ${client.events().length} evento(s)`));
    }
    return conclude(checks, { evidence: { saludo: client.handshake.status, eventoRecibido: describeEvent(event) } });
  } finally {
    await client.close();
  }
};

// --- Esquema 3: la cabecera del tenant no cambia el tenant de la conexión --------------------------------------------------

const CABECERA: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['alumno01', { 'x-tenant': TENANT_A }],
  ['alumno02', { 'x-tenant': TENANT_B }],
  ['(sin cabecera)', {}],
]);

const cabeceraNoCambiaTenant: ApiRowHandler = async (row) => {
  await resetTenants([TENANT_A]);
  const headers = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const expected = 'la conexión recibe el evento nc_created con seq 7 y el código NC-013';
  const notOff = await simulatorOffOutcome(expected);
  if (notOff) return notOff;
  const gestor = await gestorSession(TENANT_A);
  if (gestor.session === undefined) return prepFailure(expected, 'gestor@sigpro.test inicia sesión en alumno01', gestor.result);
  const admin = await adminAccess(TENANT_A);
  if (admin.token === undefined) return prepFailure(expected, 'alumno01@sigpro.lab inicia sesión', admin.last);
  const client = await openRealtime({ token: gestor.session.accessToken }, headers);
  try {
    const created = await createNc(admin.token, TENANT_A, 'minor');
    const event = await client.waitEvent((item) => item.type === 'nc_created');
    return conclude(
      [
        check(client.handshake.status === 'accepted', 'la conexión se abre con esa cabecera', describeHandshake(client.handshake)),
        check(created.status === 201, 'alumno01@sigpro.lab crea la NC con POST /api/nc (201)', `POST /api/nc respondió ${created.status}`),
        eventFieldCheck(event, 'seq', 7),
        varCheck(event, 'code', 'NC-013'),
      ],
      { evidence: { cabecera: cell(row, 'cabecera'), eventoRecibido: describeEvent(event) } },
    );
  } finally {
    await client.close();
  }
};

// Reglas de la historia que ninguna fila puede comprobar (se anotan en la nota de cada fila, no se juzgan aquí):
const NOTA_CADUCIDAD =
  'Regla de caducidad (el accessToken caduca a los 900 s): ninguna fila la prueba; no se espera 15 minutos. Un token caducado no se ha probado.';
// La conexión rechazada nunca se une a la sala del tenant: «no recibe ningún evento» es verdadero por construcción en las filas 2 y 3.
const NOTA_RECHAZO =
  'Las filas con refreshToken o mfaToken (y la rechazada en general) no tienen conexión abierta: «no recibe ningún evento» es verdadero por construcción. El valor de la fila está en «no se abre».';
// El gateway solo lee `handshake.auth` (apps/api/src/mission/mission.gateway.ts): la cabecera `x-tenant` no entra en la decisión.
const NOTA_CABECERA =
  'El gateway no lee la cabecera x-tenant (solo handshake.auth): las filas alumno02 y (sin cabecera) son verdaderas por construcción; el upgrade no se inspecciona (la cabecera la pone el cliente de Node).';

/** La nota de rechazo solo vale para las filas en las que la conexión NO se abre (la fila con accessToken sí se abre). */
const rechazadaConNota: ApiRowHandler = async (row) => {
  const result = await rechazadaSinEventos(row);
  const extra = cell(row, 'resultado_conexion') === 'está abierta' ? NOTA_CADUCIDAD : `${NOTA_CADUCIDAD} ${NOTA_RECHAZO}`;
  return { ...result, note: result.note === undefined ? extra : `${result.note} ${extra}` };
};

defineApiRows({
  story: 'US-MISION-FEED-001',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, withNote(soloAccesoVigente, NOTA_CADUCIDAD)],
    [2, rechazadaConNota],
    [3, withNote(cabeceraNoCambiaTenant, `${NOTA_CADUCIDAD} ${NOTA_CABECERA}`)],
  ]),
});
