import { resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  ACCOUNTS,
  PASSWORDS,
  PERMISSION_CELLS,
  PERMISSION_COLUMNS,
  PERMISSION_ORDER,
  SECTIONS,
  TENANT,
  accountChecks,
  arrivalChecks,
  concluded,
  installInitScripts,
  openProfileWeb,
  permissionChecks,
  permissionOrder,
  readPermission,
  signInWeb,
  withCookieNote,
} from './common';

// US-PERFIL-001 — Ver la cuenta y lo que permite el rol en el perfil (web, 1440 px). Preparación de cada fila: caos del tenant
// apagado (lo comprueba el marco), reinicio de alumno01 con su administrador, /login?tenant=alumno01 en un contexto sin sesión,
// inicio de sesión con el formulario de la app (admin@sigpro.test completa el segundo paso con 123456) y «Menú de usuario» → «Perfil».

const ARRIVAL = (correo: string): string => `llega a /profile con la sesión de ${correo}`;

// --- Esquema 1: la sección «Cuenta» muestra los datos de la sesión -------------------------------------------------------

const accountRow: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const account = strict('cuenta', ACCOUNTS, correo);
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const nombre = cell(row, 'nombre');
  const rol = quoted(cell(row, 'rol'));
  await installInitScripts(context);
  await resetTenants([TENANT]);
  const arrival = (await signInWeb(page, ARRIVAL(correo), correo, password, account.mfa)) ?? (await openProfileWeb(page, ARRIVAL(correo)));
  if (arrival) return arrival;
  const checks: Check[] = await arrivalChecks(page, SECTIONS);
  checks.push(...(await accountChecks(page, correo, nombre, rol)));
  return concluded(checks);
};

// --- Esquema 2: cada rol ve sus seis permisos como permitidos o no permitidos --------------------------------------------

const permissionsRow: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const account = strict('cuenta', ACCOUNTS, correo);
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  await installInitScripts(context);
  await resetTenants([TENANT]);
  const arrival = (await signInWeb(page, ARRIVAL(correo), correo, password, account.mfa)) ?? (await openProfileWeb(page, ARRIVAL(correo)));
  if (arrival) return arrival;
  const checks: Check[] = await arrivalChecks(page, SECTIONS);
  for (const [column, label] of PERMISSION_COLUMNS) {
    const cellText = cell(row, column);
    const want = strict('permiso', PERMISSION_CELLS, cellText);
    checks.push(...permissionChecks(label, cellText, want, await readPermission(page, label), false));
  }
  const order = await permissionOrder(page);
  checks.push(check(JSON.stringify(order) === JSON.stringify(PERMISSION_ORDER), 'los seis permisos aparecen en el orden de la historia', order === undefined ? 'orden no legible' : order.join(' · ')));
  return concluded(checks, { note: 'En la web el texto «Permitido»/«No permitido» es de lector de pantalla (sr-only): se lee del nodo de la fila, no de lo que se ve.' });
};

defineBrowserRows({
  story: 'US-PERFIL-001',
  surface: 'web',
  tenants: [TENANT],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(accountRow)],
    [2, withCookieNote(permissionsRow)],
  ]),
});
