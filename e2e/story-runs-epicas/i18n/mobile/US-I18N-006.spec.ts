import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, quoted } from '../../support/browser';
import { cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { conclude, ACCESS, MOBILE_NOTE, actionMissing, callLogOf, oneVisibleCheck, runStepsLogged, textCheck, titleCheck, valueCheck, withNote } from '../web/common';
import { button, combo, enterAccessMobile, pickLangMobile, textbox } from './common';

// US-I18N-006 — Elegir el idioma en la pantalla de Acceso y conservarlo (app móvil como web de Expo a 390 × 844; NO nativa). Preparación
// de cada fila: reinicio de alumno01 y /login con «alumno01» en «Tenant de trabajo», sin sesión ni elección de idioma guardada.

const REOPEN_NOTE = 'Expo web no es la app nativa: «cierra la app y la vuelve a abrir» se aproxima cerrando la página y abriendo otra en el mismo contexto (el almacenamiento se conserva).';

// --- Esquema 1: elegir inglés cambia todos los textos de la pantalla de acceso -----------------------------------------------

const chooseEnglish: BrowserRowHandler = async (row, { page }) => {
  const titulo = quoted(cell(row, 'titulo'));
  const pista = quoted(cell(row, 'pista'));
  const correo = quoted(cell(row, 'correo'));
  const contrasena = quoted(cell(row, 'contrasena'));
  const tenant = quoted(cell(row, 'tenant'));
  const boton = quoted(cell(row, 'boton'));
  const enlace = quoted(cell(row, 'enlace'));
  const selector = quoted(cell(row, 'nombre_selector'));
  const expected = `título «${titulo}», pista «${pista}», etiquetas «${correo}», «${contrasena}» y «${tenant}», botón «${boton}», enlace «${enlace}» y selector «${selector}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessMobile(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const acted = await runStepsLogged(pickLangMobile(page, ACCESS.es.language, 'en'));
  if (acted) return actionMissing(expected, acted);
  return withNote(
    conclude([
      await titleCheck(page, titulo),
      await textCheck(page.getByText(pista, { exact: true }), 'pista', pista),
      await oneVisibleCheck(textbox(page, correo), `etiqueta «${correo}»`),
      await oneVisibleCheck(textbox(page, contrasena), `etiqueta «${contrasena}»`),
      await oneVisibleCheck(textbox(page, tenant), `etiqueta «${tenant}»`),
      await oneVisibleCheck(button(page, boton), `botón «${boton}»`),
      await oneVisibleCheck(button(page, enlace), `enlace «${enlace}»`),
      await oneVisibleCheck(combo(page, selector), `selector «${selector}»`),
    ]),
    MOBILE_NOTE,
  );
};

// --- Esquema 2: volver al español devuelve los textos de la pantalla de acceso -----------------------------------------------

const backToSpanish: BrowserRowHandler = async (row, { page }) => {
  const titulo = quoted(cell(row, 'titulo'));
  const boton = quoted(cell(row, 'boton'));
  const selector = quoted(cell(row, 'nombre_selector'));
  const expected = `título «${titulo}», botón «${boton}» y selector «${selector}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([...enterAccessMobile(page), ...pickLangMobile(page, ACCESS.es.language, 'en')]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const acted = await runStepsLogged(pickLangMobile(page, ACCESS.en.language, 'es'));
  if (acted) return actionMissing(expected, acted);
  return withNote(
    conclude([
      await titleCheck(page, titulo),
      await oneVisibleCheck(button(page, boton), `botón «${boton}»`),
      await oneVisibleCheck(combo(page, selector), `selector «${selector}»`),
    ]),
    MOBILE_NOTE,
  );
};

// --- Esquema 3: la elección se conserva al reabrir la app y al pasar a las otras pantallas de Acceso -------------------------

/** Lo que la historia espera ver tras la acción (texto exacto del título de la pantalla de llegada). */
const ARRIVAL_TITLE: ReadonlyMap<string, string> = new Map<string, string>([
  ['el título «Sign in» en la pantalla de acceso', 'Sign in'],
  ['el título «Reset password» en la pantalla de recuperación', 'Reset password'],
  ['el título «Request access» en la pantalla de solicitud de acceso', 'Request access'],
]);

/** Cada acción devuelve la página en la que queda la persona (la de «reabrir» es otra página del mismo contexto). */
const ACTIONS: ReadonlyMap<string, (page: Page) => Promise<Page>> = new Map<string, (page: Page) => Promise<Page>>([
  [
    'cierra la app y la vuelve a abrir en /login',
    async (page) => {
      const reopened = await page.context().newPage();
      await page.close();
      await reopened.goto('/login', ACTION);
      return reopened;
    },
  ],
  [
    'pulsa «Forgot password?»',
    async (page) => {
      await button(page, ACCESS.en.forgot).click(ACTION);
      await page.waitForURL(/\/forgot/, ACTION);
      return page;
    },
  ],
  [
    'pulsa «Request access»',
    async (page) => {
      await button(page, 'Request access').click(ACTION);
      await page.waitForURL(/\/register/, ACTION);
      return page;
    },
  ],
]);

const keepsOnReturn: BrowserRowHandler = async (row, { page }) => {
  const accion = cell(row, 'accion');
  const resultado = cell(row, 'resultado');
  const expected = resultado;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([...enterAccessMobile(page), ...pickLangMobile(page, ACCESS.es.language, 'en')]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const act = strict('accion', ACTIONS, accion);
  let current = page;
  try {
    current = await act(page);
  } catch (error) {
    return actionMissing(expected, `no se pudo ${accion}: ${callLogOf(error)}`);
  }
  const title = strict('resultado', ARRIVAL_TITLE, resultado);
  const notes = accion.startsWith('cierra la app') ? `${MOBILE_NOTE} ${REOPEN_NOTE}` : MOBILE_NOTE;
  return withNote(conclude([await titleCheck(current, title)]), notes);
};

// --- Esquema 4: lo escrito en el formulario se conserva al cambiar de idioma -------------------------------------------------

const keepsForm: BrowserRowHandler = async (row, { page }) => {
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contrasena');
  const expected = `el campo «Email» contiene ${correo}, el campo «Password» contiene ${contrasena} y el tenant de trabajo sigue en ${TENANT_A}`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([
    ...enterAccessMobile(page),
    [`escribir «${ACCESS.es.email}»`, () => textbox(page, ACCESS.es.email).fill(correo, ACTION)],
    [`escribir «${ACCESS.es.password}»`, () => textbox(page, ACCESS.es.password).fill(contrasena, ACTION)],
  ]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const acted = await runStepsLogged(pickLangMobile(page, ACCESS.es.language, 'en'));
  if (acted) return actionMissing(expected, acted);
  // La regla de la historia incluye el tenant de trabajo entre lo que se conserva: se comprueba junto a los campos de la fila
  return withNote(
    conclude([
      await valueCheck(textbox(page, ACCESS.en.email), 'el campo «Email» contiene', correo),
      await valueCheck(textbox(page, ACCESS.en.password), 'el campo «Password» contiene', contrasena),
      await valueCheck(textbox(page, ACCESS.en.tenant), '[regla] el campo «Working tenant» contiene', TENANT_A),
    ]),
    MOBILE_NOTE,
  );
};

defineBrowserRows({
  story: 'US-I18N-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, chooseEnglish],
    [2, backToSpanish],
    [3, keepsOnReturn],
    [4, keepsForm],
  ]),
});
