import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, quoted } from '../../support/browser';
import { cell, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ALUMNO_ADMIN, COOKIE_NOTE, PASSWORDS, ambiguityOutcome, heading1, namedCheck, ncCard, openLogin, prepFailed, programRow, quietCookies, resetAlumno, runStepsLogged, signInToPrograms } from './common';

// US-A11Y-001 — Nombres accesibles y textos alternativos de controles, campos e imágenes (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 con su administrador y, en las filas que lo piden, inicio de sesión desde el
// formulario con la cuenta y el tenant de la fila. Los nombres se leen del elemento que el contenedor de la historia contiene
// (cabecera, formulario, fila, tarjeta, pie de la barra lateral), y no por su nombre.

// --- Esquema 1: los controles de la pantalla de acceso -------------------------------------------------------------------------

const ACCESS_CONTROLS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['el botón de cambio de tema de la cabecera', (page) => page.getByRole('banner').getByRole('button')],
  ['el selector de idioma de la cabecera', (page) => page.getByRole('banner').getByRole('combobox')],
  // El botón de mostrar contraseña es el único botón dentro del contenedor del campo de contraseña
  ['el botón que muestra la contraseña, cuando la contraseña está oculta', (page) => page.getByLabel('Contraseña', { exact: true }).locator('xpath=..').getByRole('button')],
  ['la casilla de mantener la sesión', (page) => page.locator('form').getByRole('checkbox')],
  // El primer botón del formulario de acceso, en orden del DOM, es el de la contraseña olvidada (va antes del campo)
  ['el botón de la contraseña olvidada', (page) => page.locator('form').getByRole('button').first()],
]);

const accessControl: BrowserRowHandler = async (row, { page, context }) => {
  const control = cell(row, 'control');
  const expected = quoted(cell(row, 'nombre'));
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(`«${expected}» en el formulario de acceso`, opened);
  const target = strict('control', ACCESS_CONTROLS, control)(page);
  const ambiguous = await ambiguityOutcome(target, expected, control);
  if (ambiguous) return ambiguous;
  return conclude([await namedCheck(target, expected, control)], { note: COOKIE_NOTE });
};

// --- Esquema 2: los controles de una fila de Programas -----------------------------------------------------------------------

const ROW_CONTROLS: ReadonlyMap<string, (scope: Locator) => Locator> = new Map<string, (scope: Locator) => Locator>([
  ['el botón de acciones', (scope) => scope.getByRole('button')],
  ['la casilla de selección', (scope) => scope.getByRole('checkbox')],
]);

const programControl: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const control = cell(row, 'control');
  const expected = quoted(cell(row, 'nombre'));
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(`sesión de gestor en /programs y «${expected}»`, signed);
  const target = strict('control', ROW_CONTROLS, control)(programRow(page, code));
  const ambiguous = await ambiguityOutcome(target, expected, `${control} de ${code}`);
  if (ambiguous) return ambiguous;
  return conclude([await namedCheck(target, expected, `${control} de ${code}`)], { note: COOKIE_NOTE });
};

// --- Esquema 3: el texto alternativo de cada imagen -----------------------------------------------------------------------------

const IMAGES: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  // El logotipo es la única imagen de la barra lateral, que la API llama «Navegación principal»
  ['el logotipo de la barra lateral', (page) => page.getByRole('complementary', { name: 'Navegación principal', exact: true }).locator('img')],
  ['el avatar de la fila de PRG-001', (page) => programRow(page, 'PRG-001').locator('img')],
  ['el avatar de la fila de PRG-004', (page) => programRow(page, 'PRG-004').locator('img')],
  ['el avatar de la tarjeta de NC-001', (page) => ncCard(page, 'NC-001').locator('img')],
  ['la miniatura de la evidencia de la ejecución de TC-001', (page) => page.getByRole('main').locator('img')],
]);

/** Cuentas de las filas de imágenes (la contraseña de cada una se valida con el mapa de contraseñas). */
const ACCOUNTS: ReadonlyMap<string, { readonly email: string; readonly password: string }> = new Map<string, { readonly email: string; readonly password: string }>([
  [DEMO.gestor.email, DEMO.gestor],
  [ALUMNO_ADMIN.email, ALUMNO_ADMIN],
]);

/** Pantallas a las que se llega tras iniciar sesión, con lo que confirma que la pantalla cargó. */
const SCREENS: ReadonlyMap<string, (page: Page) => Promise<void>> = new Map<string, (page: Page) => Promise<void>>([
  ['/programs', (page) => programRow(page, 'PRG-001').waitFor({ timeout: CEILING_MS })],
  ['/nc', (page) => ncCard(page, 'NC-001').waitFor({ timeout: CEILING_MS })],
  ['/verification/TC-001', (page) => page.getByRole('main').locator('img').first().waitFor({ state: 'attached', timeout: CEILING_MS })],
]);

const imageAlt: BrowserRowHandler = async (row, { page, context }) => {
  const account = strict('correo', ACCOUNTS, cell(row, 'correo'));
  const password = strict('contraseña', PASSWORDS, cell(row, 'contraseña'));
  const screen = cell(row, 'pantalla');
  const image = cell(row, 'imagen');
  const expected = quoted(cell(row, 'texto'));
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, account.email, password);
  if (signed) return prepFailed(`sesión de ${account.email} y pantalla ${screen}`, signed);
  const navigated = screen === '/programs' ? undefined : await runStepsLogged([[`abrir ${screen} escribiendo su dirección`, () => page.goto(screen, { timeout: CEILING_MS })]]);
  if (navigated) return prepFailed(`pantalla ${screen} con la imagen`, navigated);
  const ready = await runStepsLogged([[`ver la pantalla ${screen}`, () => strict('pantalla', SCREENS, screen)(page)]]);
  if (ready) return prepFailed(`pantalla ${screen} con la imagen`, ready);
  const target = strict('imagen', IMAGES, image)(page);
  const ambiguous = await ambiguityOutcome(target, expected, image);
  if (ambiguous) return ambiguous;
  return conclude([await namedCheck(target, expected, image)], { note: COOKIE_NOTE });
};

defineBrowserRows({
  story: 'US-A11Y-001',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, accessControl],
    [2, programControl],
    [3, imageAlt],
  ]),
});
