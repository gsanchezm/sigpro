import { sessionOf } from '../../../story-runs/support/api';
import { TENANT_A, TENANT_B, resetTenants } from '../../../story-runs/support/prepare';
import { cell, check, conclude, preparationFailed, responseCheck, strict, type Check } from '../../support/checks';
import { defineApiRows, type ApiRowHandler } from '../../core/framework';
import { ACCOUNTS, ADMIN_A, BOOLEANS, ROLE_VALUES, hasUserShape, listUsers, listUsersWith, requestOrFail, signIn, stateOf, usersOf, userByEmail } from './common';

// US-ADMIN-USUARIOS-001 — Listar los usuarios del tenant con su rol y su estado (API).
// Preparación de cada fila: reinicio de alumno01 con su administrador; ese administrador inicia sesión y pide GET /api/admin/users con
// x-tenant alumno01 y su accessToken. Las filas de «cuenta recién solicitada» la crean con POST /api/auth/register antes de listar.

const SEED_IDS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7'].join(',');

// --- Esquema 1: cada cuenta del seed aparece con su rol y sus indicadores ---------------------------------------------------

const seedAccountShape: ApiRowHandler = async (row) => {
  const email = cell(row, 'correo');
  strict('correo', ACCOUNTS, email);
  const role = strict('rol', ROLE_VALUES, cell(row, 'rol'));
  const active = strict('activa', BOOLEANS, cell(row, 'activa'));
  const locked = strict('bloqueada', BOOLEANS, cell(row, 'bloqueada'));
  const pending = strict('pendiente', BOOLEANS, cell(row, 'pendiente'));
  const expected = `200; la cuenta ${email} aparece con el rol ${role}, active ${active}, locked ${locked} y pending ${pending}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  const list = await listUsers(token);
  const users = usersOf(list);
  const user = userByEmail(users, email);
  const matches = user !== undefined && user.role === role && user.active === active && user.locked === locked && user.pending === pending;
  return conclude([
    responseCheck(list, { status: 200 }),
    check(matches, `la cuenta ${email} aparece con el rol ${role}, active ${active}, locked ${locked} y pending ${pending}`, `la cuenta ${email} ${user === undefined ? 'no aparece en la lista' : `aparece con ${stateOf(user)}`}`),
    // Regla: cada elemento trae id, name, email, role, active, locked, pending y org, y ningún dato de contraseña ni de segundo factor
    check(
      users.length > 0 && users.every((entry) => hasUserShape(entry)),
      'cada elemento trae id, name, email, role, active, locked, pending y org, y nada más',
      users.every((entry) => hasUserShape(entry)) ? 'cada elemento trae esas ocho claves y nada más' : `algún elemento trae otras claves: ${JSON.stringify(users.find((entry) => !hasUserShape(entry)) ?? {})}`,
    ),
  ]);
};

// --- Esquema 2: la lista sigue el orden de alta y, con la misma fecha, el de id ------------------------------------------------

const POSITIONS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['6', 6],
  ['7', 7],
  ['8', 8],
]);

/** Quién ocupa el puesto: una cuenta del seed por su correo, o la cuenta recién solicitada en la fila. */
type Who = { readonly requested: true } | { readonly requested: false; readonly email: string };

const WHO: ReadonlyMap<string, Who> = new Map<string, Who>([
  ['admin@sigpro.test', { requested: false, email: 'admin@sigpro.test' }],
  ['pendiente@sigpro.test', { requested: false, email: 'pendiente@sigpro.test' }],
  ['alumno01@sigpro.lab', { requested: false, email: 'alumno01@sigpro.lab' }],
  ['(cuenta recién solicitada en alumno01)', { requested: true }],
]);

const orderByAlta: ApiRowHandler = async (row) => {
  const position = strict('puesto', POSITIONS, cell(row, 'puesto'));
  const who = strict('correo', WHO, cell(row, 'correo'));
  const expected = `200; el usuario que ocupa el puesto ${position} es ${who.requested ? '(cuenta recién solicitada en alumno01)' : who.email}`;
  await resetTenants([TENANT_A]);
  const admin = await signIn(ADMIN_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión', admin);
  // La cuenta recién solicitada existe en todas las filas: la Dado la da por hecha
  const requested = await requestOrFail(TENANT_A);
  if (requested.failed !== undefined || requested.account === undefined) return requested.failed ?? preparationFailed(expected, 'solicitar una cuenta en alumno01', admin);
  const list = await listUsers(token);
  const users = usersOf(list);
  const expectedEmail = who.requested ? requested.account.email : who.email;
  const actual = users[position - 1];
  const seedIds = users.slice(0, 7).map((entry) => String(entry.id)).join(',');
  const last = users[users.length - 1];
  return conclude([
    responseCheck(list, { status: 200 }),
    check(actual?.email === expectedEmail, `el puesto ${position} es ${expectedEmail}`, `el puesto ${position} es ${actual === undefined ? '(vacío)' : String(actual.email)}`),
    // Regla: las siete cuentas del seed salen en el orden u1…u7 (misma fecha, por id)
    check(seedIds === SEED_IDS, `las siete primeras cuentas del seed salen en el orden ${SEED_IDS}`, `las primeras cuentas salen en el orden ${seedIds}`),
    // Regla: las cuentas creadas después (por una solicitud de acceso) salen al final
    check(last?.email === requested.account.email, 'la cuenta solicitada sale al final de la lista', `el último de la lista es ${last === undefined ? '(vacío)' : String(last.email)}`),
  ]);
};

// --- Esquema 3: el tenant lo fija el token y no la cabecera x-tenant ---------------------------------------------------------

/** Cabecera `x-tenant` de la petición: el tenant de alumno02, o ninguna. */
const HEADERS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['alumno02', TENANT_B],
  ['(sin cabecera)', undefined],
]);

const tenantFromToken: ApiRowHandler = async (row) => {
  const header = strict('cabecera', HEADERS, cell(row, 'cabecera'));
  const expected = '200 con 7 usuarios; la lista no incluye la cuenta solicitada en alumno02';
  await resetTenants([TENANT_A, TENANT_B]);
  const admin = await signIn(ADMIN_A);
  const token = sessionOf(admin)?.accessToken;
  if (token === undefined) return preparationFailed(expected, 'alumno01@sigpro.lab inicia sesión en alumno01', admin);
  const requested = await requestOrFail(TENANT_B);
  if (requested.failed !== undefined || requested.account === undefined) return requested.failed ?? preparationFailed(expected, 'solicitar una cuenta en alumno02', admin);
  const list = await listUsersWith(token, header);
  const users = usersOf(list);
  const count: Check = check(users.length === 7, 'con 7 usuarios', `con ${users.length} usuarios`);
  const leaked = users.some((entry) => entry.email === requested.account?.email);
  return conclude([
    responseCheck(list, { status: 200 }),
    count,
    check(!leaked, 'la lista no incluye la cuenta solicitada en alumno02', `${users.length} cuentas en la lista; la cuenta de alumno02 ${leaked ? 'está' : 'no está'}`),
  ]);
};

defineApiRows({
  story: 'US-ADMIN-USUARIOS-001',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, seedAccountShape],
    [2, orderByAlta],
    [3, tenantFromToken],
  ]),
});
