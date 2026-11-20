import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { bodyOf, errorChecks, judge, prepareAlumno, raw, sameMap, show } from './common';

// US-API-PLATAFORMA-004 — Responder los errores con código, mensaje, traza y errores por campo. Preparación de cada fila: alumno01
// reiniciado y caos apagado. Cada fila comprueba el formato común (statusCode, error, message, traceId y la ausencia de `errors` salvo
// en 422) además de lo que su Esquema dice.

// --- Esquema 1: una ruta que no existe responde 404 con el formato común ----------------------------------------------------

const METHODS: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET', 'GET'],
  ['POST', 'POST'],
]);
const MISSING_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/ruta-que-no-existe', '/api/ruta-que-no-existe'],
  ['/api/health', '/api/health'],
]);

const notFound: ApiRowHandler = async (row) => {
  const method = strict('metodo', METHODS, cell(row, 'metodo'));
  const route = strict('ruta', MISSING_ROUTES, cell(row, 'ruta'));
  const message = cell(row, 'mensaje');
  await prepareAlumno();
  const res = await raw(method, route);
  const body = bodyOf(res);
  return judge([
    ...errorChecks(res, 404, 'Not Found'),
    check(body.message === message, `message ${message}`, `message ${show(body.message)}`),
    check(!('code' in body), 'sin el campo code', `code ${show(body.code)}`),
  ]);
};

// --- Esquema 2: una ruta protegida sin un token válido responde 401 con su código ---------------------------------------------

const AUTHORIZATIONS: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(sin cabecera Authorization)', {}],
  ['Authorization Bearer token-inventado', { authorization: 'Bearer token-inventado' }],
]);

const unauthorized: ApiRowHandler = async (row) => {
  const auth = strict('autorizacion', AUTHORIZATIONS, cell(row, 'autorizacion'));
  const code = cell(row, 'codigo');
  await prepareAlumno();
  const res = await raw('GET', '/api/auth/me', { headers: { 'x-tenant': TENANT_A, ...auth } });
  const body = bodyOf(res);
  return judge([
    ...errorChecks(res, 401, 'Unauthorized'),
    check(body.code === code, `code ${code}`, `code ${show(body.code)}`),
    check(body.message === code, `message ${code}`, `message ${show(body.message)}`),
  ]);
};

// --- Esquema 3: un cuerpo no válido responde 422 con el motivo de cada campo -------------------------------------------------

const BODIES: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['(email y contraseña vacíos)', { email: '', password: '' }],
  ['email ana@sigpro y password Gestor1234!', { email: 'ana@sigpro', password: 'Gestor1234!' }],
]);
const ERRORS: ReadonlyMap<string, Readonly<Record<string, string>>> = new Map<string, Readonly<Record<string, string>>>([
  ['email required y password required', { email: 'required', password: 'required' }],
  ['email badEmail', { email: 'badEmail' }],
]);

const validation: ApiRowHandler = async (row) => {
  const body = strict('cuerpo', BODIES, cell(row, 'cuerpo'));
  const errors = strict('errores', ERRORS, cell(row, 'errores'));
  await prepareAlumno();
  const res = await raw('POST', '/api/auth/login', { headers: { 'x-tenant': TENANT_A }, body });
  const found = bodyOf(res);
  return judge([
    ...errorChecks(res, 422, 'Unprocessable Entity'),
    check(found.code === 'validation_failed', 'code validation_failed', `code ${show(found.code)}`),
    check(found.message === 'validation_failed', 'message validation_failed', `message ${show(found.message)}`),
    check(sameMap(found.errors, errors), `errors ${cell(row, 'errores')}`, `errors ${show(found.errors)}`),
  ]);
};

// --- Esquema 4: cada respuesta de error trae una traza propia ----------------------------------------------------------------

/** Ruta del Esquema → error que devuelve (estado, texto del estado HTTP). Cada una se pide sin credenciales. */
const TRACED_ROUTES: ReadonlyMap<string, { readonly status: number; readonly error: string }> = new Map<string, { readonly status: number; readonly error: string }>([
  ['/api/ruta-que-no-existe', { status: 404, error: 'Not Found' }],
  ['/api/auth/me', { status: 401, error: 'Unauthorized' }],
]);

/** Regla de la historia sin Esquema: el 500 con `internal_error` no se provoca aquí; no tiene comprobación en esta épica. */
const NO_500_NOTE = 'Regla sin ejemplo: el 500 con message internal_error y sin code no se provoca en la pila; no se comprueba.';

const ownTrace: ApiRowHandler = async (row) => {
  const expected = strict('ruta', TRACED_ROUTES, cell(row, 'ruta'));
  const route = cell(row, 'ruta');
  await prepareAlumno();
  const first = await raw('GET', route);
  const second = await raw('GET', route);
  const firstTrace = field(first.body, 'traceId');
  const secondTrace = field(second.body, 'traceId');
  return judge(
    [
      // errorChecks ya comprueba la forma de cada traceId (cuatro hexadecimales, guion, cuatro) y el resto del formato común
      ...errorChecks(first, expected.status, expected.error).map((entry) => ({ ...entry, expected: `primera respuesta: ${entry.expected}` })),
      ...errorChecks(second, expected.status, expected.error).map((entry) => ({ ...entry, expected: `segunda respuesta: ${entry.expected}` })),
      check(firstTrace !== secondTrace, 'los dos traceId son distintos', `traceId ${show(firstTrace)} y ${show(secondTrace)}`),
    ],
    { note: NO_500_NOTE },
  );
};

defineApiRows({
  story: 'US-API-PLATAFORMA-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, notFound],
    [2, unauthorized],
    [3, validation],
    [4, ownTrace],
  ]),
});
