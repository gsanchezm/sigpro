import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { holdsFor, isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  FOOTER_TEXT,
  HOLD_MS,
  ROUTES,
  actionFailed,
  enterAnonymous,
  footerCheck,
  footerClick,
  footerOf,
  openRoute,
  prepFailed,
  screenNotReached,
  titleCheck,
  titleIs,
  withAlumno,
} from './common';

// US-LEGAL-AYUDA-002 — Llegar a las páginas legales y a la ayuda desde el pie de Acceso (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 y entrada por /login?tenant=alumno01 (sin sesión); la fila indica la pantalla de acceso.

// --- Esquema 1: cada enlace del pie lleva a su página en la misma pestaña -----------------------------------------------------

const footerNavigates: BrowserRowHandler = withAlumno(async (row, { page, context }) => {
  const enlace = quoted(cell(row, 'enlace'));
  const route = strict('ruta', ROUTES, cell(row, 'ruta'));
  const title = quoted(cell(row, 'titulo'));
  const expected = `pulsa «${enlace}» en el pie y llega a ${route} en la misma pestaña, sin abrir ninguna pestaña nueva, con el título «${title}»`;
  const prepared = await enterAnonymous(page);
  if (prepared) return prepFailed(expected, prepared);
  const pagesBefore = context.pages().length;
  // Se arma el registro de pestañas nuevas ANTES de pulsar: cualquier pestaña que se abra durante la acción queda registrada
  const opened: Page[] = [];
  const onNewPage = (created: Page): void => {
    opened.push(created);
  };
  context.on('page', onNewPage);
  try {
    const clicked = await footerClick(page, enlace);
    if (clicked) return actionFailed(expected, clicked);
    const landed = await waitUntil(async () => pathOf(page) === route);
    await waitUntil(() => titleIs(page, title));
    const tabs = await holdsFor(async () => opened.length === 0 && context.pages().length === pagesBefore, HOLD_MS);
    return conclude([
      check(landed.reached, `llega a ${route}`, `llega a ${pathOf(page)}`),
      await titleCheck(page, title),
      check(tabs.held, 'sin abrir ninguna pestaña nueva', tabs.held ? 'sin pestañas nuevas' : 'se abre una pestaña nueva'),
    ]);
  } finally {
    context.off('page', onNewPage);
  }
});

// --- Esquema 2: el pie aparece en cada pantalla de acceso sin sesión -----------------------------------------------------------

const footerOnScreen: BrowserRowHandler = withAlumno(async (row, { page }) => {
  const pantalla = strict('pantalla', ROUTES, cell(row, 'pantalla'));
  const expected = `ve el pie de ${pantalla} con el texto «${FOOTER_TEXT}» seguido de los enlaces «Privacidad», «Condiciones» y «Ayuda», en ese orden`;
  const prepared = await enterAnonymous(page);
  if (prepared) return prepFailed(expected, prepared);
  const opened = await openRoute(page, pantalla);
  if (opened) return actionFailed(expected, opened);
  const shown = await waitUntil(() => isVisible(footerOf(page)));
  if (!shown.reached) return actionFailed(expected, screenNotReached(`el pie de ${pantalla}`));
  return conclude([await footerCheck(page)]);
});

defineBrowserRows({
  story: 'US-LEGAL-AYUDA-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, footerNavigates],
    [2, footerOnScreen],
  ]),
});
