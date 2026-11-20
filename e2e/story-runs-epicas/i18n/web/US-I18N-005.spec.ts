import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, quoted, waitUntil, type Step } from '../../support/browser';
import { cell, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  conclude,
  ACCESS,
  COOKIE_NOTE,
  actionMissing,
  enterAccessWeb,
  fixCookiePreference,
  markOf,
  markPage,
  oneVisibleCheck,
  onProgramsAny,
  pathCheck,
  pickLangWeb,
  runStepsLogged,
  signInWeb,
  sinRecargaCheck,
  textCheck,
  titleCheck,
  valueCheck,
} from './common';

// US-I18N-005 — Cambiar el idioma desde la cabecera de la aplicación de escritorio (web, 1440 px). Preparación de cada fila: reinicio
// de alumno01; gestor@sigpro.test entra por /login?tenant=alumno01 (la elección de la cabecera se hace DESPUÉS de entrar, salvo en el
// Esquema 4). El menú lateral debe estar desplegado: si la fila lo encuentra plegado, se despliega con su botón antes de actuar.
// La Regla «pasa al idioma elegido sin recargarla» se mide en cada elección de la cabecera: marca en la ventana, título y migas.

const GESTOR = DEMO.gestor;

/** Lo que la historia dice y esta épica no mide: la ventana de menos de 1024 px (decisión pendiente) y el almacenamiento del navegador. */
const COVERAGE_NOTE = 'No cubierto: la Regla de la ventana de menos de 1024 px (sin selector en la cabecera: decisión pendiente) y «se guarda en el navegador» (no se inspecciona el almacenamiento).';

const NOTE_005 = `${COOKIE_NOTE} ${COVERAGE_NOTE}`;

/** El enlace de la sección en el menú lateral: la `nav` dentro de la `aside` de la barra lateral (no las migas ni otros enlaces). */
const sidebarLink = (page: Page, name: string): Locator => page.locator('aside nav').getByRole('link', { name, exact: true });

/** La miga actual (la última, con `aria-current`) de la barra de migas de la cabecera. */
const crumbCheck = (page: Page, name: string): Promise<Check> =>
  textCheck(page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_BREADCRUMBS).locator('[aria-current="page"]'), 'miga actual', name);

/** Marca como extra de la Regla «sin recargarla / títulos / migas» (el Esquema no lo nombra): el texto esperado lleva «[regla]». */
const rule = <T extends Check>(entry: T): T => ({ ...entry, expected: `[regla] ${entry.expected}` });

/** Despliega el menú lateral si está plegado; devuelve el fallo, si lo hay. */
const expandSidebar = async (page: Page): Promise<string | undefined> => {
  const toggle = page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_SIDEBAR_TOGGLE);
  if ((await attrOf(toggle, 'aria-expanded')) === 'true') return undefined;
  const failure = await runStepsLogged([['desplegar el menú lateral', () => toggle.click(ACTION)]]);
  if (failure) return failure;
  const open = await waitUntil(async () => (await attrOf(toggle, 'aria-expanded')) === 'true');
  return open.reached ? undefined : 'el menú lateral sigue plegado tras pulsar su botón';
};

/** Entra como gestor en /programs (idioma por defecto) con el menú lateral desplegado. Devuelve el fallo de preparación, si lo hay. */
const enterPrograms = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const entered = await runStepsLogged(signInWeb(page, 'es', GESTOR.email, GESTOR.password));
  if (entered) return preparationFailedWeb(expected, entered);
  const expanded = await expandSidebar(page);
  return expanded ? preparationFailedWeb(expected, expanded) : undefined;
};

// --- Esquema 1: elegir inglés en la cabecera cambia el menú lateral y el botón de alta -----------------------------------

const chooseEnglish: BrowserRowHandler = async (row, { page, context }) => {
  const programas = quoted(cell(row, 'programas'));
  const verificacion = quoted(cell(row, 'verificacion'));
  const boton = quoted(cell(row, 'boton'));
  const expected = `«${programas}» y «${verificacion}» en el menú lateral y «${boton}» en la página`;
  await resetTenants([TENANT_A]);
  await context.addInitScript(fixCookiePreference);
  const prepared = await enterPrograms(page, expected);
  if (prepared) return prepared;
  await markPage(page);
  const acted = await runStepsLogged([pickLangWeb(page, 'Idioma', 'en')]);
  if (acted) return actionMissing(expected, acted);
  return conclude(
    [
      sinRecargaCheck(await markOf(page)),
      rule(await titleCheck(page, programas)),
      rule(await crumbCheck(page, programas)),
      await oneVisibleCheck(sidebarLink(page, programas), `enlace «${programas}» del menú lateral`),
      await oneVisibleCheck(sidebarLink(page, verificacion), `enlace «${verificacion}» del menú lateral`),
      await oneVisibleCheck(page.getByRole('button', { name: boton, exact: true }), `botón «${boton}»`),
    ],
    { note: NOTE_005 },
  );
};

// --- Esquema 2: volver al español desde la cabecera devuelve el menú y el botón al español -----------------------------

const backToSpanish: BrowserRowHandler = async (row, { page, context }) => {
  const programas = quoted(cell(row, 'programas'));
  const verificacion = quoted(cell(row, 'verificacion'));
  const boton = quoted(cell(row, 'boton'));
  const expected = `«${programas}» y «${verificacion}» en el menú lateral y «${boton}» en la página`;
  await resetTenants([TENANT_A]);
  await context.addInitScript(fixCookiePreference);
  const prepared = await enterPrograms(page, expected);
  if (prepared) return prepared;
  const chosenEn = await runStepsLogged([pickLangWeb(page, 'Idioma', 'en')]);
  if (chosenEn) return preparationFailedWeb(expected, chosenEn);
  await markPage(page);
  const acted = await runStepsLogged([pickLangWeb(page, 'Language', 'es')]);
  if (acted) return actionMissing(expected, acted);
  return conclude(
    [
      sinRecargaCheck(await markOf(page)),
      rule(await titleCheck(page, programas)),
      rule(await crumbCheck(page, programas)),
      await oneVisibleCheck(sidebarLink(page, programas), `enlace «${programas}» del menú lateral`),
      await oneVisibleCheck(sidebarLink(page, verificacion), `enlace «${verificacion}» del menú lateral`),
      await oneVisibleCheck(page.getByRole('button', { name: boton, exact: true }), `botón «${boton}»`),
    ],
    { note: NOTE_005 },
  );
};

// --- Esquema 3: la elección se conserva al recargar, al cambiar de sección y al cerrar sesión -------------------------

type Action = (page: Page) => readonly Step[];

const ACTIONS: ReadonlyMap<string, Action> = new Map<string, Action>([
  ['recarga la página', (page) => [['recargar la página', () => page.reload(ACTION)]]],
  [
    'pulsa «Verification» en el menú lateral',
    (page) => [
      ['pulsar «Verification» en el menú lateral', () => sidebarLink(page, 'Verification').click(ACTION)],
      ['llegar a /verification', () => page.waitForURL(/\/verification/, ACTION)],
    ],
  ],
  [
    'cierra sesión desde el menú de usuario',
    (page) => [
      // El menú de usuario y su «Cerrar sesión» se localizan por su id de prueba: la historia no nombra el control
      ['abrir el menú de usuario', () => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_USER_MENU).click(ACTION)],
      ['cerrar sesión', () => page.getByTestId(PROGRAMAS_TESTIDS.LAYOUT_USER_LOGOUT).click(ACTION)],
      ['llegar a /login', () => page.waitForURL(/\/login/, ACTION)],
    ],
  ],
]);

const RESULTS: ReadonlyMap<string, (page: Page) => Promise<Check>> = new Map<string, (page: Page) => Promise<Check>>([
  ['ve «Programs» en el menú lateral', (page) => oneVisibleCheck(sidebarLink(page, 'Programs'), 'enlace «Programs» del menú lateral')],
  ['ve «Verification» en el menú lateral', (page) => oneVisibleCheck(sidebarLink(page, 'Verification'), 'enlace «Verification» del menú lateral')],
  ['ve el título «Sign in» en la pantalla de acceso', (page) => titleCheck(page, 'Sign in')],
]);

const keepsChoice: BrowserRowHandler = async (row, { page, context }) => {
  const resultado = cell(row, 'resultado');
  const expected = resultado;
  await resetTenants([TENANT_A]);
  await context.addInitScript(fixCookiePreference);
  const prepared = await enterPrograms(page, expected);
  if (prepared) return prepared;
  // La elección de la precondición también es una elección de la cabecera: se mide sin recarga, título y migas
  await markPage(page);
  const chosen = await runStepsLogged([pickLangWeb(page, 'Idioma', 'en')]);
  if (chosen) return preparationFailedWeb(expected, chosen);
  const regla = [sinRecargaCheck(await markOf(page)), rule(await titleCheck(page, 'Programs')), rule(await crumbCheck(page, 'Programs'))];
  const acted = strict('accion', ACTIONS, cell(row, 'accion'))(page);
  const failure = await runStepsLogged(acted);
  if (failure) return actionMissing(expected, failure);
  const result = strict('resultado', RESULTS, resultado);
  return conclude([...regla, await result(page)], { note: NOTE_005 });
};

// --- Esquema 4: la elección hecha antes de entrar se mantiene dentro de la aplicación ----------------------------------

const keepsBeforeLogin: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const contrasena = cell(row, 'contrasena');
  const expected = 'llega a /programs y ve «Programs» en el menú lateral; el selector de idioma de la cabecera queda en «EN»';
  await resetTenants([TENANT_A]);
  await context.addInitScript(fixCookiePreference);
  const prepared = await runStepsLogged([...enterAccessWeb(page), pickLangWeb(page, ACCESS.es.language, 'en')]);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const sent = await runStepsLogged([
    [`escribir «${ACCESS.en.email}»`, () => page.getByLabel(ACCESS.en.email, { exact: true }).fill(correo, ACTION)],
    [`escribir «${ACCESS.en.password}»`, () => page.getByLabel(ACCESS.en.password, { exact: true }).fill(contrasena, ACTION)],
    [`pulsar «${ACCESS.en.submit}»`, () => page.getByRole('button', { name: ACCESS.en.submit, exact: true }).click(ACTION)],
  ]);
  if (sent) return actionMissing(expected, sent);
  await waitUntil(() => onProgramsAny(page));
  return conclude(
    [
      pathCheck(page, '/programs'),
      await oneVisibleCheck(sidebarLink(page, 'Programs'), 'enlace «Programs» del menú lateral'),
      await valueCheck(page.getByRole('combobox', { name: 'Language', exact: true }), '[regla] el selector de la cabecera vale', 'en'),
    ],
    { note: NOTE_005 },
  );
};

defineBrowserRows({
  story: 'US-I18N-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, chooseEnglish],
    [2, backToSpanish],
    [3, keepsChoice],
    [4, keepsBeforeLogin],
  ]),
});
