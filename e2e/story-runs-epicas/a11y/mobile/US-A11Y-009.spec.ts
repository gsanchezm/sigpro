import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, quoted, safe } from '../../support/browser';
import { check, cell, conclude, strict } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import { MOBILE_URL, ambiguityOutcome, describeNamed, failedAction, namedOf, prepFailed, reachable, resetAlumno, runStepsLogged, withRoutesReleased } from '../web/common';
import { MOBILE_NOTE, expoNotRunning, mobileProgramsArrival, mobileSignInSteps } from '../web/mobile';

// US-A11Y-009 — Objetivos táctiles de al menos 44 px y nombres de los controles (app móvil: Expo web a 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 y sesión de gestor@sigpro.test en la app móvil con alumno01 en «Tenant de trabajo».
// El área que responde al toque se mide con la caja del elemento (`boundingBox`, en píxeles CSS): los controles de estas pantallas
// no declaran un área extra de toque. Los nombres se leen con la API de accesibilidad, nunca se dan por la celda.

const MIN_PX = 44;

/** Controles medidos por su nombre: el nombre no es lo que se comprueba aquí (el tamaño sí). */
const TOUCH_TARGETS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['el botón «Acciones para PRG-001»', (page) => page.getByRole('button', { name: 'Acciones para PRG-001', exact: true })],
  ['el filtro «Activo» del grupo «Estado»', (page) => page.getByRole('radiogroup', { name: 'Estado', exact: true }).getByRole('radio', { name: 'Activo', exact: true })],
  ['la opción «Árbol» del selector de vistas', (page) => page.getByRole('radio', { name: 'Árbol', exact: true }).or(page.getByRole('tab', { name: 'Árbol', exact: true }))],
]);

/** Pantallas de la fila: cada una confirma que cargó antes de medir. */
const SCREENS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['/programs', (page) => runStepsLogged([['ver la lista de programas', () => mobileProgramsArrival(page).waitFor({ timeout: CEILING_MS })]])],
  [
    '/programs/PRG-002/requirements',
    (page) =>
      runStepsLogged([
        ['abrir /programs/PRG-002/requirements', () => page.goto('/programs/PRG-002/requirements', { timeout: CEILING_MS })],
        ['ver el selector de vistas', () => page.getByRole('radiogroup', { name: 'Vistas de requisitos', exact: true }).waitFor({ timeout: CEILING_MS })],
      ]),
  ],
]);

const CONTROLS_NAMED: ReadonlyMap<string, string> = new Map([['el botón de acciones', 'el botón de acciones']]);
const PESTANAS: ReadonlyMap<string, { readonly short: string }> = new Map([
  ['la pestaña del panel de misión', { short: 'Misión' }],
  ['la pestaña de no conformidades', { short: 'NC' }],
]);

/** Sesión de gestor en la app móvil y llegada a la lista. Devuelve por qué no llegó, si no llegó. */
const enterPrograms = async (page: Page): Promise<string | undefined> =>
  runStepsLogged([...mobileSignInSteps(page, DEMO.gestor.email, DEMO.gestor.password), ['ver la lista de programas', () => mobileProgramsArrival(page).waitFor({ timeout: CEILING_MS })]]);

// --- Esquema 1: los controles que se tocan responden en un área de al menos 44 px -------------------------------------------------

const touchSize: BrowserRowHandler = async (row, { page }) => {
  const pantalla = cell(row, 'pantalla');
  const control = cell(row, 'control');
  const expected = `${control} mide al menos ${MIN_PX} px de alto y ${MIN_PX} px de ancho en ${pantalla}`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(expected, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const signed = await enterPrograms(page);
  if (signed) return prepFailed(expected, signed);
  const screen = strict('pantalla', SCREENS, pantalla);
  const ready = await screen(page);
  if (ready) return prepFailed(expected, ready);
  const target = strict('control', TOUCH_TARGETS, control)(page);
  const ambiguous = await ambiguityOutcome(target, expected, control);
  if (ambiguous) return ambiguous;
  const seen = await runStepsLogged([[`ver ${control}`, () => target.waitFor({ state: 'visible', timeout: CEILING_MS })]]);
  if (seen) return failedAction(expected, seen);
  const box = await safe(() => target.boundingBox({ timeout: 1_000 }), null);
  if (box === null) return notExecutable(expected, `No se puede medir ${control}: el elemento no tiene caja visible (lectura del arnés, no un dato de la app).`);
  const width = Math.round(box.width);
  const height = Math.round(box.height);
  return conclude(
    [check(height >= MIN_PX, `alto de al menos ${MIN_PX} px`, `alto de ${height} px`), check(width >= MIN_PX, `ancho de al menos ${MIN_PX} px`, `ancho de ${width} px`)],
    { note: `${MOBILE_NOTE} El área de respuesta se mide con la caja del elemento (sin área extra de toque).`, evidence: { width, height } },
  );
};

// --- Esquema 2: los botones de acciones de una fila se anuncian con el código de su fila -----------------------------------------

const rowActionName: BrowserRowHandler = async (row, { page }) => {
  const control = strict('control', CONTROLS_NAMED, cell(row, 'control'));
  const code = cell(row, 'codigo');
  const expected = quoted(cell(row, 'nombre'));
  const label = `${control} de la fila de ${code}`;
  if (!(await reachable(MOBILE_URL))) return notExecutable(`«${expected}» en ${label}`, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const signed = await enterPrograms(page);
  if (signed) return prepFailed(`«${expected}» en ${label}`, signed);
  // La tarjeta se localiza por el nombre de su elemento de lista (su código); el botón, por su rol dentro de la tarjeta
  const button = page.getByRole('listitem', { name: code, exact: true }).getByRole('button');
  const ambiguous = await ambiguityOutcome(button, expected, `el botón de la fila de ${code}`);
  if (ambiguous) return ambiguous;
  const named = await namedOf(button);
  return conclude([check(named?.name === expected, `lo anuncia como «${expected}»`, named === undefined ? `no hay un único botón en la tarjeta de ${code}` : `lo anuncia como ${describeNamed(named)}`)], {
    note: MOBILE_NOTE,
  });
};

// --- Esquema 3: cada pestaña de la navegación inferior se anuncia con su nombre completo -------------------------------------

const tabName: BrowserRowHandler = async (row, { page }) => {
  const pestana = strict('pestaña', PESTANAS, cell(row, 'pestaña'));
  const expected = quoted(cell(row, 'nombre'));
  if (!(await reachable(MOBILE_URL))) return notExecutable(`«${expected}» en la navegación inferior`, expoNotRunning(MOBILE_URL));
  await resetAlumno();
  const signed = await enterPrograms(page);
  if (signed) return prepFailed(`«${expected}» en la navegación inferior`, signed);
  // La pestaña se localiza por su texto corto visible (la etiqueta completa no se ve); su nombre accesible es lo que se lee
  const tab = page
    .getByRole('tab')
    .or(page.getByRole('link'))
    .or(page.getByRole('button'))
    .filter({ has: page.getByText(pestana.short, { exact: true }) });
  const ambiguous = await ambiguityOutcome(tab, expected, `la pestaña «${pestana.short}»`);
  if (ambiguous) return ambiguous;
  const named = await namedOf(tab);
  return conclude([check(named?.name === expected, `la anuncia como «${expected}»`, named === undefined ? `no hay una única pestaña con el texto «${pestana.short}»` : `la anuncia como ${describeNamed(named)}`)], {
    note: MOBILE_NOTE,
  });
};

defineBrowserRows({
  story: 'US-A11Y-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(touchSize)],
    [2, withRoutesReleased(rowActionName)],
    [3, withRoutesReleased(tabName)],
  ]),
});
