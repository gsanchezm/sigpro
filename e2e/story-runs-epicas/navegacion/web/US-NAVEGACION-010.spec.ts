import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, isVisible, noSessionCheck, pathOf, runSteps, waitUntil } from '../../support/browser';
import { cell, check, conclude } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { DESKTOP, actionFailed, historyCheck, historyLength, noted, prepFailed, prepareWeb, signIn } from './common';

const LOGIN_TENANT_URL = `/login?tenant=${TENANT_A}`;

// US-NAVEGACION-010 — Raíz, direcciones desconocidas y pantallas privadas en la web. Preparación de cada fila: reinicio de alumno01;
// las filas con sesión inician sesión con gestor@sigpro.test; las filas sin sesión usan un navegador sin ninguna sesión guardada.
// Cada redirección se comprueba también en el historial: la navegación pedida gana una sola entrada (la de la redirección la
// sustituye), así que volver atrás no lleva a la dirección que no existía.

const onLoginForm = (page: Page): Promise<boolean> => (pathOf(page) === '/login' ? isVisible(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })) : Promise.resolve(false));
const onPrograms = (page: Page): Promise<boolean> => (pathOf(page) === '/programs' ? isVisible(page.getByRole('heading', { name: 'Programas', exact: true })) : Promise.resolve(false));

/** Abre la dirección y espera a la ruta de destino; devuelve el fallo de la navegación o `undefined`. */
const open = async (page: Page, address: string): Promise<string | undefined> => runSteps([[`abrir ${address}`, () => page.goto(address, { timeout: CEILING_MS })]]);

// --- Esquema 1: con sesión, la raíz y las direcciones desconocidas llevan a Programas --------------------------------------

const withSession: BrowserRowHandler = async (row, { page }) => {
  const address = cell(row, 'direccion');
  const destination = cell(row, 'destino');
  const expected = `llega a ${destination}`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const before = await historyLength(page);
  const opened = await open(page, address);
  if (opened) return actionFailed(expected, { message: opened, note: `la dirección ${address} no abre` });
  const arrived = await waitUntil(async () => pathOf(page) === destination);
  const after = await historyLength(page);
  return conclude([
    check(arrived.reached, `llega a ${destination}`, arrived.reached ? `llega a ${destination}` : `llega a ${pathOf(page)}`),
    historyCheck(before, after),
  ]);
};

// --- Esquema 2: sin sesión, las pantallas privadas y las direcciones desconocidas llevan a Acceso ---------------------------

const withoutSession: BrowserRowHandler = async (row, { page }) => {
  const address = cell(row, 'direccion');
  const expected = `llega a /login y no tiene sesión iniciada (desde ${address})`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const base = await runSteps([['abrir /login', () => page.goto(LOGIN_TENANT_URL, { timeout: CEILING_MS })]]);
  if (base) return prepFailed(expected, base);
  const before = await historyLength(page);
  const opened = await open(page, address);
  if (opened) return actionFailed(expected, { message: opened, note: `la dirección ${address} no abre` });
  const arrived = await waitUntil(() => onLoginForm(page));
  const after = await historyLength(page);
  // Al final: abrir /programs sin sesión debe seguir en /login (la comprobación navega, por eso va la última)
  const noSession = await noSessionCheck(page, onLoginForm, onPrograms);
  return conclude([
    check(arrived.reached, 'llega a /login', arrived.reached ? 'llega a /login' : `llega a ${pathOf(page)}`),
    historyCheck(before, after),
    noSession,
  ]);
};

// --- Esquema 3: con sesión, las páginas de Acceso llevan a Programas --------------------------------------------------------

const accessPages: BrowserRowHandler = async (row, { page }) => {
  const address = cell(row, 'direccion');
  const expected = `llega a /programs (desde ${address})`;
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const before = await historyLength(page);
  const opened = await open(page, address);
  if (opened) return actionFailed(expected, { message: opened, note: `la dirección ${address} no abre` });
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  const after = await historyLength(page);
  return conclude([
    check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `llega a ${pathOf(page)}`),
    historyCheck(before, after),
  ]);
};

defineBrowserRows({
  story: 'US-NAVEGACION-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(withSession)],
    [2, noted(withoutSession)],
    [3, noted(accessPages)],
  ]),
});
