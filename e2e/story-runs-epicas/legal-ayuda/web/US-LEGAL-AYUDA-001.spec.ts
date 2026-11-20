import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import {
  type Arrival,
  GOTO_NOTE,
  HELP_TITLE,
  LAB_LINK,
  PAGE_TITLES,
  PERSONAS,
  ROUTES,
  UPDATED_LINE,
  actionFailed,
  arrivedAt,
  backLabelCheck,
  backLabelFor,
  backLinkOutcome,
  describedNote,
  enterAnonymous,
  footerClick,
  interact,
  introChecks,
  labBelowSectionsCheck,
  labLink,
  labLinkCheck,
  openRoute,
  pathCheck,
  prepare,
  prepFailed,
  reachedRoute,
  screenNotReached,
  sectionChecks,
  sectionHeading,
  stayCheck,
  titleCheck,
  titleHeading,
  titleIs,
  withAlumno,
  withNote,
} from './common';

// US-LEGAL-AYUDA-001 — Leer las páginas legales y la ayuda, con su contenido y su enlace de retorno (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 (`withAlumno`); sin sesión, entrada por /login?tenant=alumno01; con sesión, inicio de
// sesión de la cuenta de la fila por el formulario. Cada fila empieza en un contexto nuevo, sin sesión guardada.

/** Esquema 4: la columna «aparece» dice si el enlace «Ir a /lab» se ve o no se ve. */
const APPEARANCE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['aparece', true],
  ['no aparece', false],
]);

// --- Esquema 1: las páginas se leen con y sin sesión, sin redirigir -------------------------------------------------------

const readsWithoutRedirect: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const persona = strict('persona', PERSONAS, cell(row, 'persona'));
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const title = quoted(cell(row, 'titulo'));
  const expected = `ve el título «${title}» y sigue en ${route}, sin llegar a /login ni a /programs`;
  const prepared = await prepare(page, persona);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, route);
  if (opened) return actionFailed(expected, opened);
  await waitUntil(() => titleIs(page, title));
  // Con sesión, el enlace de retorno dice «Volver» (la regla exige sesión): así la fila no pasa con una página pública sin sesión
  return conclude([await titleCheck(page, title), await stayCheck(page, route), await backLabelCheck(page, backLabelFor(persona))]);
});

// --- Esquema 2: cada página muestra su título y su introducción ------------------------------------------------------------

const titleAndIntro: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const title = quoted(cell(row, 'titulo'));
  const introCell = cell(row, 'introduccion');
  const expected = `ve el título «${title}» y, debajo, la introducción ${introCell}; y la línea «${UPDATED_LINE}»`;
  const prepared = await enterAnonymous(page);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, route);
  if (opened) return actionFailed(expected, opened);
  await waitUntil(() => titleIs(page, title));
  return conclude(await introChecks(page, title, introCell), describedNote([introCell]));
});

// --- Esquema 3: cada página muestra sus secciones con su título y su texto -------------------------------------------------

const sectionText: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const section = quoted(cell(row, 'seccion'));
  const bodyCell = cell(row, 'texto');
  const expected = `ve la sección «${section}» con el texto ${bodyCell}, y las secciones de la página en orden`;
  const prepared = await enterAnonymous(page);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, route);
  if (opened) return actionFailed(expected, opened);
  await waitUntil(() => isVisible(sectionHeading(page, section)));
  return conclude(await sectionChecks(page, route, section, bodyCell), describedNote([bodyCell]));
});

// --- Esquema 4: el enlace «Ir a /lab» solo aparece en la ayuda -------------------------------------------------------------

const labLinkByPage: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const appears = strict('aparece', APPEARANCE, cell(row, 'aparece'));
  const title = strict('ruta', PAGE_TITLES, route);
  const expected = `${appears ? 'aparece' : 'no aparece'} el enlace «${LAB_LINK}» en ${route}`;
  const prepared = await enterAnonymous(page);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, route);
  if (opened) return actionFailed(expected, opened);
  const rendered = await waitUntil(() => titleIs(page, title));
  // Si la página no muestra su título y sigue en la ruta, la pantalla no se ha renderizado; si cambió de ruta, es una redirección
  if (!rendered.reached && pathOf(page) === route) return actionFailed(expected, screenNotReached(`la página ${route}`));
  const checks: Check[] = [pathCheck(page, route), await titleCheck(page, title), await labLinkCheck(page, appears)];
  if (appears) checks.push(await labBelowSectionsCheck(page));
  return conclude(checks);
});

// --- Esquema 5: pulsar «Ir a /lab» lleva a la página del laboratorio -------------------------------------------------------

const labNavigates: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const persona = strict('persona', PERSONAS, cell(row, 'persona'));
  const expected = `pulsa «${LAB_LINK}» y llega a /lab`;
  const prepared = await prepare(page, persona);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, '/help');
  if (opened) return actionFailed(expected, opened);
  const helpShown = await waitUntil(() => titleIs(page, HELP_TITLE));
  if (!helpShown.reached) return actionFailed(expected, screenNotReached('la ayuda'));
  const clicked = await interact(labLink(page), `el enlace «${LAB_LINK}»`, titleHeading(page), (element) => element.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  const landed = await waitUntil(async () => pathOf(page) === '/lab');
  return conclude([check(landed.reached, 'llega a /lab', `llega a ${pathOf(page)}`)]);
});

// --- Esquema 6: el enlace de retorno lleva a la pantalla de acceso o a Programas -------------------------------------------

/**
 * Cómo llega la persona a la página de la fila. `lands` es la página legal o la ayuda donde debe quedar antes de pulsar el enlace.
 * Las llegadas por el pie empiezan en la pantalla de acceso abierta con una carga directa: se anota en la nota de la fila.
 */
interface Way {
  readonly run: (page: Page) => Promise<Arrival>;
  readonly lands: string;
  readonly note?: string;
}

const WAYS: ReadonlyMap<string, Way> = new Map<string, Way>([
  ['abre /legal/terms directamente en el navegador', { run: async (page) => arrivedAt(page, await openRoute(page, '/legal/terms')), lands: '/legal/terms' }],
  ['abre /help directamente en el navegador', { run: async (page) => arrivedAt(page, await openRoute(page, '/help')), lands: '/help' }],
  [
    'pulsa «Condiciones» en el pie de /forgot',
    {
      run: async (page) => arrivedAt(page, (await openRoute(page, '/forgot')) ?? (await footerClick(page, 'Condiciones')) ?? (await reachedRoute(page, '/legal/terms'))),
      lands: '/legal/terms',
      note: GOTO_NOTE,
    },
  ],
  [
    'pulsa «Privacidad» en el pie de /register',
    {
      run: async (page) => arrivedAt(page, (await openRoute(page, '/register')) ?? (await footerClick(page, 'Privacidad')) ?? (await reachedRoute(page, '/legal/privacy'))),
      lands: '/legal/privacy',
      note: GOTO_NOTE,
    },
  ],
  ['abre /legal/privacy directamente en el navegador', { run: async (page) => arrivedAt(page, await openRoute(page, '/legal/privacy')), lands: '/legal/privacy' }],
]);

const backLink: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const persona = strict('persona', PERSONAS, cell(row, 'persona'));
  const way = strict('llegada', WAYS, cell(row, 'llegada'));
  const label = quoted(cell(row, 'enlace'));
  const destination = strict('destino', ROUTES, cell(row, 'destino'));
  const expected = `pulsa «${label}» y llega a ${destination}`;
  const prepared = await prepare(page, persona);
  if (prepared) return prepFailed(expected, prepared);
  const arrived = await way.run(page);
  if (arrived.blocked) return actionFailed(expected, arrived.blocked);
  const onWay = await waitUntil(async () => pathOf(arrived.page) === way.lands);
  if (!onWay.reached) {
    return outcome(false, expected, `la página abierta está en ${pathOf(arrived.page)}, no en ${way.lands}`, {
      note: 'La página de partida de la fila no se abre como la historia la da por hecha.',
    });
  }
  const result = await backLinkOutcome(arrived.page, expected, label, destination, { webLink: true });
  return way.note === undefined ? result : withNote(result, way.note);
});

defineBrowserRows({
  story: 'US-LEGAL-AYUDA-001',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, readsWithoutRedirect],
    [2, titleAndIntro],
    [3, sectionText],
    [4, labLinkByPage],
    [5, labNavigates],
    [6, backLink],
  ]),
});
