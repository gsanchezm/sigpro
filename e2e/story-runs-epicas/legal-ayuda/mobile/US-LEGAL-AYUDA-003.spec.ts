import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, conclude, strict } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import {
  ATAJOS,
  HELP_TITLE,
  PERSONAS,
  ROUTES,
  type Arrival,
  actionFailed,
  arrivedAt,
  backLabelCheck,
  backLabelFor,
  backLinkOutcome,
  decided,
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
  withNote,
} from '../web/common';
import { DECISION_REGISTER, DECISION_SHORTCUTS, NOT_DISTINGUISHED, directFirst, moreItemClick, onExpoWeb, openMore, prepareMobile, registerTermsTap } from './common';

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
    return conclude([await titleCheck(page, title), await stayCheck(page, route), await backLabelCheck(page, backLabelFor(persona))]);
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
    // «Atajos de teclado» no entra en el orden de las secciones (su presencia es decisión pendiente): se comprueba aparte, en su fila
    const result = conclude(await sectionChecks(page, route, section, bodyCell, ATAJOS), describedNote([bodyCell]));
    return decided(result, DECISION_SECTIONS.get(sectionCell));
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
    // El encabezado va antes que la ausencia de enlaces: una redirección a otra pantalla no puede dar «no aparece»
    return conclude([await titleCheck(page, HELP_TITLE), await labLinkCheck(page, false), await backLabelCheck(page, backLabelFor(persona))]);
  }),
);

// --- Esquema 5: el enlace de retorno vuelve a la pantalla anterior o, sin ella, a la de acceso o a Programas -------------

/**
 * Cómo llega la persona a la página de la fila. `run` devuelve la pestaña donde queda la persona; `lands` es la página legal o la
 * ayuda donde debe quedar antes de pulsar. Las llegadas «directamente» abren una pestaña nueva como primera navegación.
 */
interface Way {
  readonly run: (page: Page) => Promise<Arrival>;
  readonly lands: string;
  readonly note?: string;
}

const WAYS: ReadonlyMap<string, Way> = new Map<string, Way>([
  ['abre /legal/terms directamente, sin pantalla anterior en la app', { run: (page) => directFirst(page, '/legal/terms'), lands: '/legal/terms' }],
  ['abre /help directamente, sin pantalla anterior en la app', { run: (page) => directFirst(page, '/help'), lands: '/help' }],
  [
    'pulsa «Condiciones» en el pie de /login',
    {
      run: async (page) => arrivedAt(page, (await footerClick(page, 'Condiciones')) ?? (await reachedRoute(page, '/legal/terms'))),
      lands: '/legal/terms',
      note: NOT_DISTINGUISHED,
    },
  ],
  ['pulsa «condiciones de uso» en el formulario de /register', { run: async (page) => arrivedAt(page, await registerTermsTap(page)), lands: '/legal/terms' }],
  ['abre /legal/privacy directamente, sin pantalla anterior en la app', { run: (page) => directFirst(page, '/legal/privacy'), lands: '/legal/privacy' }],
  [
    'abre «Más» y pulsa «Privacidad»',
    {
      run: async (page) => arrivedAt(page, (await openMore(page)) ?? (await moreItemClick(page, 'Privacidad')) ?? (await reachedRoute(page, '/legal/privacy'))),
      lands: '/legal/privacy',
    },
  ],
]);

const backLink: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const persona = strict('persona', PERSONAS, cell(row, 'persona'));
    const llegada = cell(row, 'llegada');
    const way = strict('llegada', WAYS, llegada);
    const label = quoted(cell(row, 'enlace'));
    const destination = strict('destino', ROUTES, cell(row, 'destino'));
    const expected = `pulsa «${label}» y llega a ${destination}`;
    const prepared = await prepareMobile(page, persona);
    if (prepared) return prepFailed(expected, prepared);
    const arrived = await way.run(page);
    if (arrived.blocked) return actionFailed(expected, arrived.blocked);
    const onWay = await waitUntil(async () => pathOf(arrived.page) === way.lands);
    if (!onWay.reached) {
      return outcome(false, expected, `la página abierta está en ${pathOf(arrived.page)}, no en ${way.lands}`, {
        note: 'La página de partida de la fila no se abre como la historia la da por hecha.',
      });
    }
    const result = await backLinkOutcome(arrived.page, expected, label, destination, { webLink: false, decision: DECISION_ARRIVALS.get(llegada) });
    return way.note === undefined ? result : withNote(result, way.note);
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
