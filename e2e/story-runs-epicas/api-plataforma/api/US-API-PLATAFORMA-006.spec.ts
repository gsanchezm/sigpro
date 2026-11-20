import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { prepareAlumno, raw, show, statusCheck, judge } from './common';

// US-API-PLATAFORMA-006 — Aceptar las peticiones de los orígenes permitidos del navegador. Preparación de cada fila: alumno01 reiniciado
// y caos apagado. La pila aislada usa los orígenes por defecto (docs/story-runs/entorno/env.sh fija CORS_ORIGIN=5173,8081), así que la
// comprobación de los orígenes permitidos es la de la historia. La app móvil nativa no usa CORS y no se describe aquí.

const ALLOWED_ORIGINS: ReadonlyMap<string, string> = new Map<string, string>([
  ['http://localhost:5173', 'http://localhost:5173'],
  ['http://localhost:8081', 'http://localhost:8081'],
]);
/** Origen permitido que sirve de control dentro de la fila de origen ajeno. */
const ALLOWED_CONTROL = 'http://localhost:5173';
const FOREIGN_ORIGINS: ReadonlyMap<string, string> = new Map<string, string>([
  ['http://otro-origen.test', 'http://otro-origen.test'],
  ['http://localhost:4000', 'http://localhost:4000'],
]);

/** Las listas de métodos y de cabeceras de la historia (sin distinguir mayúsculas en las cabeceras). */
const APP_METHODS: readonly string[] = ['GET', 'PUT', 'PATCH', 'POST', 'DELETE'];
const APP_HEADERS: readonly string[] = ['content-type', 'authorization', 'x-tenant', 'x-admin-key'];

/** Lista separada por comas de una cabecera CORS, en minúsculas y sin espacios. */
const listOf = (value: string | null): readonly string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item !== '');

// --- Esquema 1: un origen permitido recibe permiso para leer la respuesta ---------------------------------------------------

const allowedRead: ApiRowHandler = async (row) => {
  const origin = strict('origen', ALLOWED_ORIGINS, cell(row, 'origen'));
  await prepareAlumno();
  const res = await raw('GET', '/api/health', { headers: { origin } });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  const expose = res.headers.get('access-control-expose-headers');
  return judge([
    statusCheck(res, 200),
    check(allowOrigin === origin, `Access-Control-Allow-Origin ${origin}`, `Access-Control-Allow-Origin ${show(allowOrigin)}`),
    check(expose === 'Content-Disposition', 'Access-Control-Expose-Headers Content-Disposition', `Access-Control-Expose-Headers ${show(expose)}`),
  ], {
    // Regla 15 (orígenes por defecto de CORS_ORIGIN): env.sh fija justo esos dos valores; la variable en sí no se lee, solo sus efectos
    note: 'Regla de los orígenes por defecto: la pila lanza CORS_ORIGIN con los mismos dos valores (docs/story-runs/entorno/env.sh); la variable no se lee, se comprueban sus efectos.',
  });
};

// --- Esquema 2: un origen que no está en la lista no recibe permiso, pero la petición se atiende ---------------------------

const foreignNotAllowed: ApiRowHandler = async (row) => {
  const origin = strict('origen', FOREIGN_ORIGINS, cell(row, 'origen'));
  await prepareAlumno();
  // Control del propio recorrido: un origen permitido, en la misma fila, sí debe recibir la cabecera. Sin él, «no recibe permiso»
  // podría cumplirse porque la cabecera Origin nunca llegó a la API (o porque la API no responde la cabecera a nadie).
  const control = await raw('GET', '/api/health', { headers: { origin: ALLOWED_CONTROL } });
  const controlAllow = control.headers.get('access-control-allow-origin');
  const res = await raw('GET', '/api/health', { headers: { origin } });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  return judge([
    statusCheck(res, 200),
    check(allowOrigin === null, 'sin Access-Control-Allow-Origin', `Access-Control-Allow-Origin ${show(allowOrigin)}`),
    check(controlAllow === ALLOWED_CONTROL, `control: con ${ALLOWED_CONTROL} la respuesta sí trae Access-Control-Allow-Origin`, `control: Access-Control-Allow-Origin ${show(controlAllow)}`),
  ]);
};

// --- Esquema 3: la petición previa acepta las cabeceras y los métodos de la aplicación --------------------------------------

const REQUESTED_HEADERS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['authorization, content-type, x-tenant', ['authorization', 'content-type', 'x-tenant']],
  ['x-admin-key', ['x-admin-key']],
]);
const METHODS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PATCH', 'PATCH'],
  ['DELETE', 'DELETE'],
]);

const preflight: ApiRowHandler = async (row) => {
  const method = strict('metodo', METHODS, cell(row, 'metodo'));
  const headers = strict('cabeceras', REQUESTED_HEADERS, cell(row, 'cabeceras'));
  const origin = 'http://localhost:5173';
  await prepareAlumno();
  const res = await raw('OPTIONS', '/api/programs', {
    headers: { origin, 'access-control-request-method': method, 'access-control-request-headers': headers.join(', ') },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  const allowedMethods = listOf(res.headers.get('access-control-allow-methods'));
  const allowedHeaders = listOf(res.headers.get('access-control-allow-headers'));
  return judge([
    statusCheck(res, 204),
    check(allowOrigin === origin, `permite el origen ${origin}`, `Access-Control-Allow-Origin ${show(allowOrigin)}`),
    check(allowedMethods.includes(method.toLowerCase()), `permite el método ${method}`, `Access-Control-Allow-Methods ${show(res.headers.get('access-control-allow-methods'))}`),
    check(
      headers.every((header) => allowedHeaders.includes(header)),
      `permite las cabeceras ${cell(row, 'cabeceras')}`,
      `Access-Control-Allow-Headers ${show(res.headers.get('access-control-allow-headers'))}`,
    ),
    // La historia pide además los métodos y las cabeceras completos de la aplicación (título del Esquema)
    check(
      APP_METHODS.every((item) => allowedMethods.includes(item.toLowerCase())),
      'permite los métodos GET, PUT, PATCH, POST y DELETE',
      `métodos permitidos ${show(res.headers.get('access-control-allow-methods'))}`,
    ),
    check(
      APP_HEADERS.every((item) => allowedHeaders.includes(item)),
      'permite las cabeceras Content-Type, Authorization, x-tenant y x-admin-key',
      `cabeceras permitidas ${show(res.headers.get('access-control-allow-headers'))}`,
    ),
  ]);
};

defineApiRows({
  story: 'US-API-PLATAFORMA-006',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, allowedRead],
    [2, foreignNotAllowed],
    [3, preflight],
  ]),
});
