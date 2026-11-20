import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { isVisible, quoted, waitUntil } from '../../support/browser';
import { cell, conclude, strict } from '../../support/checks';
import { defineBrowserRows, pending, type BrowserRowHandler } from '../../core/framework';
import {
  type Blocked,
  HELP_TITLE,
  PERSONAS,
  ROUTES,
  actionFailed,
  backLinkOutcome,
  describedNote,
  footerClick,
  introChecks,
  labLinkCheck,
  openRoute,
  prepFailed,
  reachedRoute,
  sectionChecks,
  sectionHeading,
  stayCheck,
  titleCheck,
  titleIs,
  withAlumno,
} from '../web/common';
import {
  DECISION_REGISTER,
  DECISION_SHORTCUTS,
  onExpoWeb,
  openMore,
  moreItemClick,
  prepareMobile,
  registerTermsTap,
} from './common';

// US-LEGAL-AYUDA-003 — Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno (app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01; sin sesión, /login con alumno01 en «Tenant de trabajo»; con sesión, inicio de sesión
// de la cuenta de la fila. Las páginas se abren con una dirección (carga completa) o desde otra pantalla de la app.

/** Secciones con decisión pendiente en la app móvil: la historia no fija si deben mostrarse (la fila se anota sin juzgarla). */
const DECISION_SECTIONS: ReadonlyMap<string, string> = new Map<string, string>([['«Atajos de teclado»', DECISION_SHORTCUTS]]);
/** Llegadas con decisión pendiente: el destino de «Volver al acceso» tras el formulario de solicitud. */
const DECISION_ARRIVALS: ReadonlyMap<string, string> = new Map<string, string>([['pulsa «condiciones de uso» en el formulario de /register', DECISION_REGISTER]]);

// --- Esquema 1: las páginas se leen con y sin sesión iniciada, sin redirigir ------------------------------------------------

const readsWithoutRedirect: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const persona = strict('persona', PERSONAS, cell(row, 'persona'));
    const route = strict('ruta', ROUTES, cell(row, 'ruta'));
    const title = quoted(cell(row, 'titulo'));
    const expected = `ve el título «${title}» y sigue en ${route}, sin llegar a /login ni a /programs`;
    const prepared = await prepareMobile(page, persona);
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openRoute(page, route);
    if (opened) return actionFailed(expected, opened);
    await waitUntil(() => titleIs(page, title));
    return conclude([await titleCheck(page, title), await stayCheck(page, route)]);
  }),
);

// --- Esquema 2: cada página muestra su título y su introducción --------------------------------------------------------------

const titleAndIntro: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const route = strict('ruta', ROUTES, cell(row, 'ruta'));
    const title = quoted(cell(row, 'titulo'));
    const introCell = cell(row, 'introduccion');
    const expected = `ve el título «${title}» y, debajo, la introducción ${introCell}; y la línea «Última actualización: 1 de noviembre de 2026»`;
    const prepared = await prepareMobile(page, { signedIn: false });
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openRoute(page, route);
    if (opened) return actionFailed(expected, opened);
    await waitUntil(() => titleIs(page, title));
    return conclude(await introChecks(page, title, introCell), describedNote([introCell]));
  }),
);

// --- Esquema 3: cada página muestra sus secciones con su título y su texto ---------------------------------------------------

const sectionText: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const route = strict('ruta', ROUTES, cell(row, 'ruta'));
    const sectionCell = cell(row, 'seccion');
    const section = quoted(sectionCell);
    const bodyCell = cell(row, 'texto');
    const expected = `ve la sección «${section}» con el texto ${bodyCell}, y las secciones de la página en orden`;
    const prepared = await prepareMobile(page, { signedIn: false });
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openRoute(page, route);
    if (opened) return actionFailed(expected, opened);
    await waitUntil(() => isVisible(sectionHeading(page, section)));
    const result = conclude(await sectionChecks(page, route, section, bodyCell), describedNote([bodyCell]));
    const decision = DECISION_SECTIONS.get(sectionCell);
    if (decision === undefined) return result;
    return pending(result.expected, result.observed, result.note === undefined ? decision : `${decision} ${result.note}`);
  }),
);

// --- Esquema 4: la ayuda no ofrece ningún enlace a la página del laboratorio -----------------------------------------------

const noLabLink: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const persona = strict('persona', PERSONAS, cell(row, 'persona'));
    const expected = 'no aparece ningún enlace a /lab, ni «Ir a /lab» ni otro';
    const prepared = await prepareMobile(page, persona);
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openRoute(page, '/help');
    if (opened) return actionFailed(expected, opened);
    await waitUntil(() => titleIs(page, HELP_TITLE));
    return conclude([await labLinkCheck(page, false)]);
  }),
);

// --- Esquema 5: el enlace de retorno vuelve a la pantalla anterior o, sin ella, a la de acceso o a Programas -------------

/** Cómo llega la persona a la página de la fila. Cada llegada termina con la página legal o la ayuda cargada (o con el destino). */
const ARRIVALS: ReadonlyMap<string, (page: Page) => Promise<Blocked | undefined>> = new Map<string, (page: Page) => Promise<Blocked | undefined>>([
  ['abre /legal/terms directamente, sin pantalla anterior en la app', async (page) => (await openRoute(page, '/legal/terms')) ?? (await reachedRoute(page, '/legal/terms'))],
  ['abre /help directamente, sin pantalla anterior en la app', async (page) => (await openRoute(page, '/help')) ?? (await reachedRoute(page, '/help'))],
  ['pulsa «Condiciones» en el pie de /login', async (page) => (await footerClick(page, 'Condiciones')) ?? (await reachedRoute(page, '/legal/terms'))],
  ['pulsa «condiciones de uso» en el formulario de /register', registerTermsTap],
  ['abre /legal/privacy directamente, sin pantalla anterior en la app', async (page) => (await openRoute(page, '/legal/privacy')) ?? (await reachedRoute(page, '/legal/privacy'))],
  ['abre «Más» y pulsa «Privacidad»', async (page) => (await openMore(page)) ?? (await moreItemClick(page, 'Privacidad')) ?? (await reachedRoute(page, '/legal/privacy'))],
]);

const backLink: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const persona = strict('persona', PERSONAS, cell(row, 'persona'));
    const llegada = cell(row, 'llegada');
    const arrival = strict('llegada', ARRIVALS, llegada);
    const label = quoted(cell(row, 'enlace'));
    const destination = strict('destino', ROUTES, cell(row, 'destino'));
    const expected = `pulsa «${label}» y llega a ${destination}`;
    const prepared = await prepareMobile(page, persona);
    if (prepared) return prepFailed(expected, prepared);
    const arrived = await arrival(page);
    if (arrived) return actionFailed(expected, arrived);
    return backLinkOutcome(page, expected, label, destination, DECISION_ARRIVALS.get(llegada));
  }),
);

defineBrowserRows({
  story: 'US-LEGAL-AYUDA-003',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, readsWithoutRedirect],
    [2, titleAndIntro],
    [3, sectionText],
    [4, noLabLink],
    [5, backLink],
  ]),
});
