import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { judge, prepareAlumno, raw, show, statusCheck, type Raw } from './common';
import { prepareAux, withAuxApi, type AuxClient } from './aux-api';

// US-API-PLATAFORMA-003 — Listar los tenants y los usuarios de prueba. Preparación de cada fila: alumno01 reiniciado y caos apagado.
// El número de tenants (26) depende del seed por defecto que lanza env.sh (SEED_STUDENT_TENANTS=25): se mide y se compara con la historia.
// Los seis usuarios de prueba y sus datos salen de la tabla de la historia (no de la API).
// Esquema 4 (staging y production): la pila principal es APP_ENV=dev, así que esas filas arrancan una segunda instancia de la API
// (mismo dist, misma base aislada) con su APP_ENV (aux-api.ts). Si no arranca, la fila es notExecutable con el motivo.

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

/** Regla de la historia: cada elemento de la lista trae solo `id` y `name`. */
const onlyIdAndName = (item: unknown): boolean =>
  item !== null && typeof item === 'object' && JSON.stringify(Object.keys(item).sort()) === JSON.stringify(['id', 'name']);

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
  const extra = list.filter((entry) => !onlyIdAndName(entry)).length;
  return judge([
    statusCheck(res, 200),
    check(Array.isArray(res.body), 'una lista (no un objeto)', Array.isArray(res.body) ? 'es una lista' : 'no es una lista'),
    check(list.length === 26, '26 elementos', `${list.length} elementos`),
    check(field(item, 'id') === id && field(item, 'name') === name, `el elemento ${cell(row, 'posicion')} tiene id ${id} y name ${name}`, `el elemento ${cell(row, 'posicion')} tiene id ${show(field(item, 'id'))} y name ${show(field(item, 'name'))}`),
    // Regla de la historia: cada elemento trae solo id y name; se comprueba en TODOS los elementos, no solo en el de la fila
    check(extra === 0, 'cada elemento trae solo id y name (los 26)', `${extra} elementos con otros campos`),
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
  const same = JSON.stringify(withHeader.body) === JSON.stringify(baseline.body);
  return judge([
    statusCheck(withHeader, 200),
    check(Array.isArray(withHeader.body), 'una lista (no un objeto)', Array.isArray(withHeader.body) ? 'es una lista' : 'no es una lista'),
    check(list.length === count, cell(row, 'cantidad'), `${list.length} en la lista`),
    check(same, 'la misma respuesta que sin la cabecera x-tenant', `${same ? 'idéntica' : 'distinta'} a la respuesta sin cabecera (${withHeader.text.length} y ${baseline.text.length} caracteres)`),
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

/**
 * Regla sin comprobación posible aquí: el `status` de la lista es el de fábrica del seed y no cambia al bloquear o aprobar una cuenta
 * (historia, regla 3). Comprobarlo exige cambiar una cuenta en el tenant; la lista sale de DEMO_USERS, estático (apps/api/src/seed/data.ts:71).
 */
const STATUS_NOTE =
  'No comprobado: que el status siga siendo el de fábrica tras bloquear o aprobar una cuenta exige cambiar una cuenta del tenant; la lista sale de DEMO_USERS, estático (apps/api/src/seed/data.ts:71).';

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
  return judge(
    [
      statusCheck(res, 200),
      check(field(item, 'name') === cell(row, 'nombre'), `name ${cell(row, 'nombre')}`, `name ${show(field(item, 'name'))}`),
      check(field(item, 'email') === cell(row, 'correo'), `email ${cell(row, 'correo')}`, `email ${show(field(item, 'email'))}`),
      check(field(item, 'password') === cell(row, 'contraseña'), `password ${cell(row, 'contraseña')}`, `password ${show(field(item, 'password'))}`),
      check(field(item, 'role') === rol, `role ${rol}`, `role ${show(field(item, 'role'))}`),
      check(field(item, 'mfa') === mfa, `mfa ${String(mfa)}`, `mfa ${show(field(item, 'mfa'))}`),
      check(field(item, 'status') === estado, `status ${estado}`, `status ${show(field(item, 'status'))}`),
      // Regla de la historia: la lista sigue el orden de la tabla (u1 a u6)
      check(position === row.rowIndex - 1, `la cuenta ${id} ocupa el puesto ${row.rowIndex}`, position === -1 ? `la cuenta ${id} no aparece` : `la cuenta ${id} ocupa el puesto ${position + 1}`),
    ],
    { note: STATUS_NOTE },
  );
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

/** Comprobaciones del Esquema 4 sobre la lista de usuarios de prueba de una instancia. */
const testUsersChecks = (res: Raw, resultado: 'seis' | 'vacia'): Check[] => {
  const list: readonly unknown[] = Array.isArray(res.body) ? res.body : [];
  const emails = list.map((entry) => field(entry, 'email'));
  return [
    statusCheck(res, 200),
    resultado === 'seis'
      ? check(JSON.stringify(emails) === JSON.stringify(SIX_EMAILS), 'una lista con las seis cuentas de demostración (en el orden de la tabla)', `lista de ${list.length} cuentas: ${show(emails)}`)
      : check(list.length === 0, 'una lista vacía', `${list.length} cuentas`),
  ];
};

const testUsersByEnvironment: ApiRowHandler = async (row) => {
  const entorno = strict('entorno', ENVIRONMENTS, cell(row, 'entorno'));
  const resultado = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `200 con ${cell(row, 'resultado')}`;
  if (entorno === 'dev') {
    await prepareAlumno();
    const res = await raw('GET', '/api/config/test-users');
    return judge(testUsersChecks(res, resultado));
  }
  // staging y production: segunda instancia con ese APP_ENV; la principal no se toca
  return withAuxApi({ label: `003 E4 ${entorno}`, env: { APP_ENV: entorno }, expected }, async (aux: AuxClient) => {
    const prep = await prepareAux(aux);
    if (prep !== undefined) return preparationFailedWeb(expected, prep);
    const res = await aux.http('GET', '/api/config/test-users');
    return judge(testUsersChecks(res, resultado));
  });
};

defineApiRows({
  story: 'US-API-PLATAFORMA-003',
  surface: 'api',
  tenants: [TENANT_A],
  // Las filas de instancia auxiliar arrancan y paran una API: su plazo es mayor que el de las demás
  rowTimeoutMs: (row) => (row.esquemaIndex === 4 ? 180_000 : 120_000),
  handlers: new Map<number, ApiRowHandler>([
    [1, tenantAtPosition],
    [2, listIgnoresTenant],
    [3, accountById],
    [4, testUsersByEnvironment],
  ]),
});
