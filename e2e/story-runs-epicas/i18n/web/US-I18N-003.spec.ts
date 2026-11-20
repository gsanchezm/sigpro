import type { Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, quoted, safe, type Step } from '../../support/browser';
import { cell, preparationFailedWeb, strict, check, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  conclude,
  ACCESS,
  LANG_OPTION,
  actionMissing,
  enterAccessWeb,
  langCheck,
  oneVisibleCheck,
  pickLangWeb,
  runStepsLogged,
  textCheck,
  titleCheck,
  valueCheck,
  type Lang,
} from './common';

// US-I18N-003 — Elegir el idioma en la pantalla de Acceso y conservarlo (web, 1440 px). Preparación de cada fila: reinicio de
// alumno01 y /login?tenant=alumno01 en un contexto nuevo (sin sesión ni elección de idioma guardada). Las Reglas «sin recargar la
// pantalla» y «la elección se guarda en el navegador» se comprueban además en el primer Esquema, porque la fila las da por hechas.

const MARK = 'marcaSinRecarga';

/** Marca la ventana: si la página se recarga, la marca desaparece. */
const markPage = (page: Page): Promise<void> =>
  page.evaluate((key: string) => {
    (window as unknown as Record<string, string>)[key] = 'antes';
  }, MARK);

const markOf = (page: Page): Promise<string | undefined> =>
  safe(() => page.evaluate((key: string) => (window as unknown as Record<string, string | undefined>)[key], MARK), undefined);

const NO_RELOAD_NOTE = 'Además se comprueban las Reglas «sin recargar la pantalla» (marca en la ventana antes de elegir).';

const sinRecarga = (marker: string | undefined): Check =>
  check(marker === 'antes', '[regla] la página no se recarga al elegir', marker === 'antes' ? 'la página no se recargó' : `la marca desapareció (${marker ?? 'sin marca'})`);

// --- Esquema 1: elegir inglés cambia todos los textos del formulario de acceso ----------------------------------------------

const chooseEnglish: BrowserRowHandler = async (row, { page }) => {
  const titulo = quoted(cell(row, 'titulo'));
  const pista = quoted(cell(row, 'pista'));
  const correo = quoted(cell(row, 'correo'));
  const contrasena = quoted(cell(row, 'contrasena'));
  const boton = quoted(cell(row, 'boton'));
  const enlace = quoted(cell(row, 'enlace'));
  const selector = quoted(cell(row, 'nombre_selector'));
  const marca = quoted(cell(row, 'marca'));
  const expected = `título «${titulo}», pista «${pista}», etiquetas «${correo}» y «${contrasena}», botón «${boton}», enlace «${enlace}», selector «${selector}» y panel de marca «${marca}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessWeb(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  await markPage(page);
  const acted = await runStepsLogged([pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (acted) return actionMissing(expected, acted);
  const result = conclude([
    await titleCheck(page, titulo),
    await textCheck(page.getByText(pista, { exact: true }), 'pista', pista),
    await oneVisibleCheck(page.getByLabel(correo, { exact: true }), `etiqueta «${correo}»`),
    await oneVisibleCheck(page.getByLabel(contrasena, { exact: true }), `etiqueta «${contrasena}»`),
    await oneVisibleCheck(page.getByRole('button', { name: boton, exact: true }), `botón «${boton}»`),
    // El enlace «Forgot password?» es un botón en la web (no un enlace de navegación)
    await oneVisibleCheck(page.getByRole('button', { name: enlace, exact: true }), `enlace «${enlace}»`),
    await oneVisibleCheck(page.getByRole('combobox', { name: selector, exact: true }), `selector «${selector}»`),
    // El panel de marca es decorativo (aria-hidden): se localiza por su texto dentro del `aside`
    await textCheck(page.locator('aside').getByText(marca, { exact: true }), 'panel de marca', marca),
    sinRecarga(await markOf(page)),
  ]);
  return { ...result, note: NO_RELOAD_NOTE };
};

// --- Esquema 2: volver al español devuelve los textos y el idioma declarado ------------------------------------------------

const backToSpanish: BrowserRowHandler = async (row, { page }) => {
  const titulo = quoted(cell(row, 'titulo'));
  const boton = quoted(cell(row, 'boton'));
  const selector = quoted(cell(row, 'nombre_selector'));
  const expected = `título «${titulo}», botón «${boton}», selector «${selector}» e idioma declarado «${cell(row, 'lang')}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([...enterAccessWeb(page), pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const acted = await runStepsLogged([pickLangWeb(page, ACCESS.en.language, 'es')]);
  if (acted) return actionMissing(expected, acted);
  return conclude([
    await titleCheck(page, titulo),
    await oneVisibleCheck(page.getByRole('button', { name: boton, exact: true }), `botón «${boton}»`),
    await oneVisibleCheck(page.getByRole('combobox', { name: selector, exact: true }), `selector «${selector}»`),
    await langCheck(page, cell(row, 'lang')),
  ]);
};

// --- Esquema 3: la elección se conserva al recargar y al cambiar de pantalla de acceso --------------------------------------

type PersistAction = (page: Page) => readonly Step[];

const PERSIST_ACTIONS: ReadonlyMap<string, PersistAction> = new Map<string, PersistAction>([
  ['recarga la página', (page) => [['recargar la página', () => page.reload(ACTION)]]],
  [
    'pulsa «Forgot password?»',
    (page) => [
      [`pulsar «${ACCESS.en.forgot}»`, () => page.getByRole('button', { name: ACCESS.en.forgot, exact: true }).click(ACTION)],
      ['llegar a /forgot', () => page.waitForURL(/\/forgot/, ACTION)],
    ],
  ],
]);

const persists: BrowserRowHandler = async (row, { page }) => {
  const titulo = quoted(cell(row, 'titulo'));
  const expected = `ve el título «${titulo}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([...enterAccessWeb(page), pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const failure = await runStepsLogged(strict('accion', PERSIST_ACTIONS, cell(row, 'accion'))(page));
  if (failure) return actionMissing(expected, failure);
  return conclude([await titleCheck(page, titulo)]);
};

// --- Esquema 4: la solicitud de acceso y la recuperación también cambian de idioma ----------------------------------------

const otherScreens: BrowserRowHandler = async (row, { page }) => {
  const ruta = cell(row, 'ruta');
  const tituloEn = quoted(cell(row, 'titulo_en'));
  const expected = `ve el título «${tituloEn}» en ${ruta}`;
  await resetTenants([TENANT_A]);
  const opened = await runStepsLogged([
    [`abrir ${ruta}`, () => page.goto(ruta, ACTION)],
    ['ver un título de nivel 1', () => page.getByRole('heading', { level: 1 }).waitFor(ACTION)],
  ]);
  if (opened) return preparationFailedWeb(expected, opened);
  const acted = await runStepsLogged([pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (acted) return actionMissing(expected, acted);
  return conclude([await titleCheck(page, tituloEn)]);
};

// --- Esquema 5: el idioma declarado de la página sigue a la elección --------------------------------------------------------

const declaredLang: BrowserRowHandler = async (row, { page }) => {
  const expected = `idioma declarado de la página «${cell(row, 'lang')}»`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged(enterAccessWeb(page));
  if (prepared) return preparationFailedWeb(expected, prepared);
  const lang: Lang = strict('opción', LANG_OPTION, quoted(cell(row, 'opcion')));
  const acted = await runStepsLogged([pickLangWeb(page, ACCESS.es.language, lang)]);
  if (acted) return actionMissing(expected, acted);
  return conclude([await langCheck(page, cell(row, 'lang'))]);
};

// --- Esquema 6: lo escrito en el formulario se conserva al cambiar de idioma ------------------------------------------------

const keepsForm: BrowserRowHandler = async (row, { page }) => {
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contrasena');
  const expected = `el campo «Email» contiene ${correo} y el campo «Password» contiene ${contrasena}`;
  await resetTenants([TENANT_A]);
  const prepared = await runStepsLogged([
    ...enterAccessWeb(page),
    [`escribir «${ACCESS.es.email}»`, () => page.getByLabel(ACCESS.es.email, { exact: true }).fill(correo, ACTION)],
    [`escribir «${ACCESS.es.password}»`, () => page.getByLabel(ACCESS.es.password, { exact: true }).fill(contrasena, ACTION)],
  ]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const acted = await runStepsLogged([pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (acted) return actionMissing(expected, acted);
  return conclude([
    await valueCheck(page.getByLabel(ACCESS.en.email, { exact: true }), 'el campo «Email» contiene', correo),
    await valueCheck(page.getByLabel(ACCESS.en.password, { exact: true }), 'el campo «Password» contiene', contrasena),
  ]);
};

defineBrowserRows({
  story: 'US-I18N-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, chooseEnglish],
    [2, backToSpanish],
    [3, persists],
    [4, otherScreens],
    [5, declaredLang],
    [6, keepsForm],
  ]),
});
