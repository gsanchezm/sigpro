import type { BrowserContext, Page } from '@playwright/test';
import { resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
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
  permissionCheck,
  permissionOrder,
  readPermission,
} from '../web/common';
import { openProfileMobile, signInMobile, withExpoNote } from './common';

// US-PERFIL-003 — Ver la cuenta y lo que permite el rol en el perfil (app móvil servida como web de Expo, 390 × 844). Preparación de
// cada fila: caos del tenant apagado (lo comprueba el marco), reinicio de alumno01 con su administrador, la app abierta sin sesión
// con «alumno01» en «Tenant de trabajo», inicio de sesión de la fila con su contraseña (admin@sigpro.test completa el segundo paso
// con 123456) y «Más» → «Perfil».

/** Prepara la fila: scripts del contexto, reinicio del tenant, inicio de sesión de la fila y «Perfil» desde «Más». */
const arrive = async (page: Page, context: BrowserContext, correo: string, password: string, mfa: boolean): Promise<Outcome | undefined> => {
  const expected = `llega a «Perfil» desde «Más» con la sesión de ${correo}`;
  await installInitScripts(context);
  await resetTenants([TENANT]);
  return (await signInMobile(page, expected, correo, password, mfa)) ?? (await openProfileMobile(page, expected));
};

// --- Esquema 1: desde «Más» se abre «Perfil» con los datos de la cuenta de la sesión ---------------------------------------

const accountRow: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const account = strict('cuenta', ACCOUNTS, correo);
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const nombre = cell(row, 'nombre');
  const rol = quoted(cell(row, 'rol'));
  const arrival = await arrive(page, context, correo, password, account.mfa);
  if (arrival) return arrival;
  const checks: Check[] = await arrivalChecks(page, SECTIONS);
  checks.push(...(await accountChecks(page, correo, nombre, rol)));
  return concluded(checks);
};

// --- Esquema 2: cada rol ve sus seis permisos como permitidos o no permitidos ----------------------------------------------

const permissionsRow: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const account = strict('cuenta', ACCOUNTS, correo);
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const arrival = await arrive(page, context, correo, password, account.mfa);
  if (arrival) return arrival;
  const checks: Check[] = await arrivalChecks(page, SECTIONS);
  for (const [column, label] of PERMISSION_COLUMNS) {
    const cellText = cell(row, column);
    const want = strict('permiso', PERMISSION_CELLS, cellText);
    checks.push(permissionCheck(label, cellText, want, await readPermission(page, label)));
  }
  const order = await permissionOrder(page);
  checks.push(check(JSON.stringify(order) === JSON.stringify(PERMISSION_ORDER), 'los seis permisos aparecen en el orden de la historia', order === undefined ? 'orden no legible' : order.join(' · ')));
  return concluded(checks);
};

defineBrowserRows({
  story: 'US-PERFIL-003',
  surface: 'expo-web',
  tenants: [TENANT],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withExpoNote(accountRow)],
    [2, withExpoNote(permissionsRow)],
  ]),
});
