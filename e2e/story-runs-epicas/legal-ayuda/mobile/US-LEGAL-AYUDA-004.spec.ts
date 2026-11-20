import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  FOOTER_TEXT,
  PERSONAS,
  ROUTES,
  actionFailed,
  footerCheck,
  footerClick,
  footerOf,
  openRoute,
  prepFailed,
  sameList,
  screenNotReached,
  titleCheck,
  titleIs,
  withAlumno,
} from '../web/common';
import { moreItemClick, moreItem, moreNames, onExpoWeb, openMore, prepareLogin, prepareMobile, signInMobile } from './common';

// US-LEGAL-AYUDA-004 — Llegar a las páginas legales y a la ayuda desde el pie de Acceso y desde «Más» (app móvil, Expo web a 390 px).
// Preparación de cada fila: reinicio de alumno01; sin sesión, /login con alumno01 en «Tenant de trabajo»; con sesión, inicio de sesión
// de la cuenta de la fila en /login. Las filas con sesión abren «Más» desde la pestaña de la barra inferior.

/** Los tres elementos finales de «Más», en orden (Regla de la historia: para cualquier rol, al final de la lista). */
const MORE_TAIL: readonly string[] = ['Ayuda', 'Condiciones', 'Privacidad'];

// --- Esquema 1: el pie de la pantalla de acceso lleva a cada página ----------------------------------------------------------

const footerLinks: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const enlace = quoted(cell(row, 'enlace'));
    const route = strict('ruta', ROUTES, cell(row, 'ruta'));
    const title = quoted(cell(row, 'titulo'));
    const expected = `pulsa «${enlace}» en el pie de /login y llega a ${route}, con el título «${title}»`;
    const prepared = await prepareLogin(page);
    if (prepared) return prepFailed(expected, prepared);
    const clicked = await footerClick(page, enlace);
    if (clicked) return actionFailed(expected, clicked);
    const landed = await waitUntil(async () => pathOf(page) === route);
    await waitUntil(() => titleIs(page, title));
    return conclude([check(landed.reached, `llega a ${route}`, `llega a ${pathOf(page)}`), await titleCheck(page, title)]);
  }),
);

// --- Esquema 2: el pie aparece en cada pantalla de acceso sin sesión iniciada -----------------------------------------------

const footerOnScreen: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const pantalla = strict('pantalla', ROUTES, cell(row, 'pantalla'));
    const expected = `ve el pie de ${pantalla} con el texto «${FOOTER_TEXT}» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden`;
    const prepared = await prepareLogin(page);
    if (prepared) return prepFailed(expected, prepared);
    if (pantalla !== '/login') {
      const opened = await openRoute(page, pantalla);
      if (opened) return actionFailed(expected, opened);
    }
    const shown = await waitUntil(() => isVisible(footerOf(page)));
    if (!shown.reached) return actionFailed(expected, screenNotReached(`el pie de ${pantalla}`));
    return conclude([await footerCheck(page)]);
  }),
);

// --- Esquema 3: con sesión iniciada, «Más» ofrece las tres páginas al final de su lista --------------------------------------

const moreList: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const persona = strict('persona', PERSONAS, cell(row, 'persona'));
    const expected = 'al final de su lista, ve «Ayuda», «Condiciones» y «Privacidad», en ese orden';
    const prepared = await prepareMobile(page, persona);
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openMore(page);
    if (opened) return actionFailed(expected, opened);
    await waitUntil(() => isVisible(moreItem(page, 'Privacidad')));
    const names = await moreNames(page);
    const tail = names.slice(-3);
    const observed = names.length === 0 ? '(lista no legible)' : `la lista termina con ${tail.map((name) => `«${name}»`).join(', ')} (lista completa: ${names.join(', ')})`;
    return conclude([check(sameList(tail, MORE_TAIL), expected, observed)]);
  }),
);

// --- Esquema 4: cada elemento de «Más» lleva a su página ---------------------------------------------------------------------

const moreClick: BrowserRowHandler = onExpoWeb(
  withAlumno(async (row, { page }) => {
    const elemento = quoted(cell(row, 'elemento'));
    const route = strict('ruta', ROUTES, cell(row, 'ruta'));
    const title = quoted(cell(row, 'titulo'));
    const expected = `pulsa «${elemento}» en «Más» y llega a ${route}, con el título «${title}»`;
    const prepared = await signInMobile(page, DEMO.gestor);
    if (prepared) return prepFailed(expected, prepared);
    const opened = await openMore(page);
    if (opened) return actionFailed(expected, opened);
    const clicked = await moreItemClick(page, elemento);
    if (clicked) return actionFailed(expected, clicked);
    const landed = await waitUntil(async () => pathOf(page) === route);
    await waitUntil(() => titleIs(page, title));
    return conclude([check(landed.reached, `llega a ${route}`, `llega a ${pathOf(page)}`), await titleCheck(page, title)]);
  }),
);

defineBrowserRows({
  story: 'US-LEGAL-AYUDA-004',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, footerLinks],
    [2, footerOnScreen],
    [3, moreList],
    [4, moreClick],
  ]),
});
