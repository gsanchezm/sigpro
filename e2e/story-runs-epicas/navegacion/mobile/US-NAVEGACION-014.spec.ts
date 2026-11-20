import type { Page } from '@playwright/test';
import { LEGAL_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, isVisible, pathOf, runSteps, textOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { prepareWeb } from '../web/common';
import { MOBILE, expo, signInMobile } from './common';

// US-NAVEGACION-014 — Raíz y pantallas privadas en la app móvil (Expo web, 390 × 844). Preparación de cada fila: reinicio de
// alumno01; las filas con sesión inician sesión con gestor@sigpro.test y «alumno01» en «Tenant de trabajo»; las filas sin sesión
// usan un navegador sin ninguna sesión guardada.

const LOGIN_HEADING = (page: Page) => page.getByRole('heading', { name: 'Iniciar sesión', level: 1, exact: true });
/** Título de las páginas legales: el texto de «Términos de uso» del catálogo (la historia no lo escribe; se anota). */
const TERMS_TITLE = 'Términos de uso';

const open = async (page: Page, address: string): Promise<string | undefined> => runSteps([[`abrir ${address}`, () => page.goto(address, { timeout: CEILING_MS })]]);

// --- Esquema 1: con sesión iniciada, la raíz y las páginas de Acceso llevan a Programas ------------------------------------

const withSession: BrowserRowHandler = async (row, { page }) => {
  const address = cell(row, 'direccion');
  const expected = `llega a /programs (desde ${address})`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const failure = await signInMobile(page, DEMO.gestor);
  if (failure) return outcome(false, expected, failure, { note: 'La preparación de sesión no se cumplió.' });
  const opened = await open(page, address);
  if (opened) return outcome(false, expected, opened, { note: `La dirección ${address} no abre.` });
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  return conclude([check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `llega a ${pathOf(page)}`)]);
};

// --- Esquema 2: sin sesión, las pantallas privadas llevan a Acceso y las páginas legales se leen -------------------------

/** Lo que cada destino exige: la ruta y lo que se ve (Acceso con su título, o la página legal con su título). */
const DESTINATIONS: ReadonlyMap<string, { readonly route: string; readonly seen: (page: Page) => Promise<boolean>; readonly label: string }> = new Map<
  string,
  { readonly route: string; readonly seen: (page: Page) => Promise<boolean>; readonly label: string }
>([
  ['/login', { route: '/login', seen: async (page) => (await waitUntil(() => isVisible(LOGIN_HEADING(page)))).reached, label: 'el formulario de Acceso' }],
  [
    '/legal/terms, que se lee sin sesión',
    {
      route: '/legal/terms',
      seen: async (page) => (await waitUntil(async () => (await textOf(page.getByTestId(LEGAL_TESTIDS.LEGAL_TITLE))) === TERMS_TITLE)).reached,
      label: `la página legal con el título «${TERMS_TITLE}»`,
    },
  ],
]);

const anonymous: BrowserRowHandler = async (row, { page }) => {
  const address = cell(row, 'direccion');
  const destination = strict('destino', DESTINATIONS, cell(row, 'destino'));
  const expected = `${address} llega a ${cell(row, 'destino')}`;
  await prepareWeb(page, MOBILE);
  await resetTenants([TENANT_A]);
  const opened = await open(page, address);
  if (opened) return outcome(false, expected, opened, { note: `La dirección ${address} no abre.` });
  const arrived = await waitUntil(async () => pathOf(page) === destination.route);
  const seen = await destination.seen(page);
  return conclude(
    [
      check(arrived.reached, `llega a ${destination.route}`, arrived.reached ? `llega a ${destination.route}` : `llega a ${pathOf(page)}`),
      check(seen, `ve ${destination.label}`, seen ? `ve ${destination.label}` : `no ve ${destination.label}`),
    ],
    destination.route === '/legal/terms' ? { note: 'El título de la página legal se toma del catálogo de textos (la historia no lo fija).' } : undefined,
  );
};

defineBrowserRows({
  story: 'US-NAVEGACION-014',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, expo(withSession, 'Regla sin fila (no comprobada): la app móvil no tiene pantalla propia para las direcciones desconocidas (decisión pendiente).')],
    [2, expo(anonymous, 'Decisión pendiente (no probada): qué ver ante una dirección que la app no tiene.')],
  ]),
});
