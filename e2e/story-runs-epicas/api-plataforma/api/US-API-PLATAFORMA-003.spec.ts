import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { ENV_NOTE, prepareAlumno, raw, show, statusCheck, judge } from './common';

// US-API-PLATAFORMA-003 — Listar los tenants y los usuarios de prueba. Preparación de cada fila: alumno01 reiniciado y caos apagado.
// El número de tenants (26) depende del seed por defecto que lanza env.sh (SEED_STUDENT_TENANTS=25): se mide y se compara con la historia.
// Los seis usuarios de prueba y sus datos salen de la tabla de la historia (no de la API).

const LIST_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/config/tenants', '/api/config/tenants'],
  ['/api/config/test-users', '/api/config/test-users'],
]);

const TENANT_HEADERS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno02', 'alumno02'],
  ['noexiste', 'noexiste'],
]);

const COUNTS: ReadonlyMap<string, number> = new Map<string, number>([
  ['26 elementos', 26],
  ['6 cuentas de demostración', 6],
]);

// --- Esquema 1: la lista de tenants va ordenada por identificador ------------------------------------------------------------

/** Posición de la historia (1-based) → índice en la lista de la API. */
const POSITIONS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 0],
  ['25', 24],
  ['26', 25],
]);

const tenantAtPosition: ApiRowHandler = async (row) => {
  const index = strict('posicion', POSITIONS, cell(row, 'posicion'));
  const id = cell(row, 'id');
  const name = cell(row, 'nombre');
  await prepareAlumno();
  const res = await raw('GET', '/api/config/tenants');
  const list: readonly unknown[] = Array.isArray(res.body) ? res.body : [];
  const item = list[index];
  const keys = item !== null && typeof item === 'object' ? Object.keys(item).sort() : [];
  return judge([
    statusCheck(res, 200),
    check(Array.isArray(res.body), 'una lista (no un objeto)', Array.isArray(res.body) ? 'es una lista' : 'no es una lista'),
    check(list.length === 26, '26 elementos', `${list.length} elementos`),
    check(field(item, 'id') === id && field(item, 'name') === name, `el elemento ${cell(row, 'posicion')} tiene id ${id} y name ${name}`, `el elemento ${cell(row, 'posicion')} tiene id ${show(field(item, 'id'))} y name ${show(field(item, 'name'))}`),
    // Regla de la historia: cada elemento trae solo id y name
    check(JSON.stringify(keys) === JSON.stringify(['id', 'name']), 'cada elemento trae solo id y name', `campos ${JSON.stringify(keys)}`),
  ]);
};

// --- Esquema 2: las dos listas no dependen de la cabecera x-tenant -----------------------------------------------------------

const listIgnoresTenant: ApiRowHandler = async (row) => {
  const route = strict('ruta', LIST_ROUTES, cell(row, 'ruta'));
  const tenant = strict('cabecera', TENANT_HEADERS, cell(row, 'cabecera'));
  const count = strict('cantidad', COUNTS, cell(row, 'cantidad'));
  await prepareAlumno();
  const withHeader = await raw('GET', route, { headers: { 'x-tenant': tenant } });
  const baseline = await raw('GET', route);
  const list: readonly unknown[] = Array.isArray(withHeader.body) ? withHeader.body : [];
  return judge([
    statusCheck(withHeader, 200),
    check(Array.isArray(withHeader.body), 'una lista (no un objeto)', Array.isArray(withHeader.body) ? 'es una lista' : 'no es una lista'),
    check(list.length === count, cell(row, 'cantidad'), `${list.length} en la lista`),
    check(
      JSON.stringify(withHeader.body) === JSON.stringify(baseline.body),
      'la misma respuesta que sin la cabecera x-tenant',
      `${JSON.stringify(withHeader.body) === JSON.stringify(baseline.body) ? 'idéntica' : 'distinta'} a la respuesta sin cabecera (${withHeader.text.length} y ${baseline.text.length} caracteres)`,
    ),
  ]);
};

// --- Esquema 3: las seis cuentas de demostración con sus datos ---------------------------------------------------------------

const BOOLEAN_TEXT: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['true', true],
  ['false', false],
]);
const STATUSES: ReadonlyMap<string, string> = new Map<string, string>([
  ['active', 'active'],
  ['locked', 'locked'],
  ['pending', 'pending'],
]);
const ROLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['admin', 'admin'],
  ['program_manager', 'program_manager'],
  ['consultant', 'consultant'],
  ['auditor', 'auditor'],
]);

/** Las seis cuentas de la tabla de la historia, en su orden: el mismo orden debe tener la lista de la API. */
const SIX_EMAILS: readonly string[] = ['admin@sigpro.test', 'gestor@sigpro.test', 'consultor@sigpro.test', 'auditor@sigpro.test', 'bloqueado@sigpro.test', 'pendiente@sigpro.test'];

const accountById: ApiRowHandler = async (row) => {
  const id = cell(row, 'id');
  const mfa = strict('mfa', BOOLEAN_TEXT, cell(row, 'mfa'));
  const estado = strict('estado', STATUSES, cell(row, 'estado'));
  const rol = strict('rol', ROLES, cell(row, 'rol'));
  await prepareAlumno();
  const res = await raw('GET', '/api/config/test-users');
  const list: readonly unknown[] = Array.isArray(res.body) ? res.body : [];
  const item = list.find((entry) => field(entry, 'id') === id);
  const position = list.findIndex((entry) => field(entry, 'id') === id);
  return judge([
    statusCheck(res, 200),
    check(field(item, 'name') === cell(row, 'nombre'), `name ${cell(row, 'nombre')}`, `name ${show(field(item, 'name'))}`),
    check(field(item, 'email') === cell(row, 'correo'), `email ${cell(row, 'correo')}`, `email ${show(field(item, 'email'))}`),
    check(field(item, 'password') === cell(row, 'contraseña'), `password ${cell(row, 'contraseña')}`, `password ${show(field(item, 'password'))}`),
    check(field(item, 'role') === rol, `role ${rol}`, `role ${show(field(item, 'role'))}`),
    check(field(item, 'mfa') === mfa, `mfa ${String(mfa)}`, `mfa ${show(field(item, 'mfa'))}`),
    check(field(item, 'status') === estado, `status ${estado}`, `status ${show(field(item, 'status'))}`),
    // Regla de la historia: la lista sigue el orden de la tabla (u1 a u6)
    check(position === row.rowIndex - 1, `la cuenta ${id} ocupa el puesto ${row.rowIndex}`, position === -1 ? `la cuenta ${id} no aparece` : `la cuenta ${id} ocupa el puesto ${position + 1}`),
  ]);
};

// --- Esquema 4: con la API en producción la lista de usuarios de prueba está vacía -------------------------------------------

const RESULTS: ReadonlyMap<string, 'seis' | 'vacia'> = new Map<string, 'seis' | 'vacia'>([
  ['una lista con las seis cuentas de demostración', 'seis'],
  ['una lista vacía', 'vacia'],
]);
const ENVIRONMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['dev', 'dev'],
  ['staging', 'staging'],
  ['production', 'production'],
]);

const testUsersByEnvironment: ApiRowHandler = async (row) => {
  const entorno = strict('entorno', ENVIRONMENTS, cell(row, 'entorno'));
  const resultado = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `200 con ${cell(row, 'resultado')}`;
  // Solo la instancia con APP_ENV=dev existe en la pila aislada: staging y production no se pueden fijar
  if (entorno !== 'dev') return notExecutable(expected, ENV_NOTE(entorno));
  await prepareAlumno();
  const res = await raw('GET', '/api/config/test-users');
  const list: readonly unknown[] = Array.isArray(res.body) ? res.body : [];
  const emails = list.map((entry) => field(entry, 'email'));
  const sameSix = JSON.stringify(emails) === JSON.stringify(SIX_EMAILS);
  return judge([
    statusCheck(res, 200),
    resultado === 'seis'
      ? check(sameSix, 'una lista con las seis cuentas de demostración (en el orden de la tabla)', `lista de ${list.length} cuentas: ${show(emails)}`)
      : check(list.length === 0, 'una lista vacía', `${list.length} cuentas`),
  ]);
};

defineApiRows({
  story: 'US-API-PLATAFORMA-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, tenantAtPosition],
    [2, listIgnoresTenant],
    [3, accountById],
    [4, testUsersByEnvironment],
  ]),
});
