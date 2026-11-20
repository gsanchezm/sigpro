import type { Locator, Page } from '@playwright/test';
import { LAB_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { call } from '../../../story-runs/support/api';
import { ACTION, CEILING_MS, attrOf, isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminAccess, prepareTenant, studentAdmin } from '../api/common';
import { actionFailed, armToasts, describeSeen, interact, observeTexts, onWeb, prepareBrowser, rowOutcome, signInWeb, textCheck, toastCheck } from './common';

// US-CAOS-RESET-012 — Contraejemplos y preguntas frecuentes de /lab (web). Cada fila reinicia alumno01 con su administrador y deja el caos
// apagado; las filas sin sesión abren /lab sin cookie de sesión. Los textos variables se guardan con PATCH antes de iniciar sesión, porque
// la web lee la configuración al iniciar sesión.

const OVERLAP_GROUP = 'Textos que se solapan a propósito';
const FIRST_QUESTION = '¿Cómo reinicio mis datos?';
/** Lo que la FAQ de la descarga debe nombrar (Esquema 3, fila 8: la historia la describe, no la transcribe). */
const DESCRIBED_LINK = 'Material del curso';
const FLAKY_ON_BADGE = 'Caos activo: el texto del botón alterna';
const FLAKY_OFF_BADGE = 'Caos apagado: el texto no cambia';

/** Botones del bloque de solapamiento (Esquema 1). */
const OVERLAP_BUTTONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Guardar»', 'Guardar'],
  ['«Guardar y cerrar»', 'Guardar y cerrar'],
]);

/** Situación del botón de ejemplo (Esquema 2): sin sesión (undefined) o con la sesión de alumno01. */
const SITUATIONS: ReadonlyMap<string, boolean | undefined> = new Map<string, boolean | undefined>([
  ['sin sesión iniciada', undefined],
  ['con sesión iniciada de alumno01@sigpro.lab', true],
]);
/** Comportamiento esperado del botón de ejemplo según la situación (Esquema 2). */
const BEHAVIORS: ReadonlyMap<string, 'siempre Guardar' | 'alterna'> = new Map<string, 'siempre Guardar' | 'alterna'>([
  ['muestra siempre «Guardar»', 'siempre Guardar'],
  ['alterna entre «Guardar» y «Guardar cambios»', 'alterna'],
]);
/** Insignia esperada según la situación (Esquema 2). */
const BADGES: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Caos apagado: el texto no cambia»', FLAKY_OFF_BADGE],
  ['«Caos activo: el texto del botón alterna»', FLAKY_ON_BADGE],
]);

const labHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Laboratorio', exact: true });
const exampleButton = (page: Page): Locator => page.getByTestId(LAB_TESTIDS.LAB_FLAKY_GROUP).getByRole('button');
const flakyBadge = (page: Page): Locator => page.getByTestId(LAB_TESTIDS.LAB_FLAKY_STATE);
const questionToggle = (page: Page, question: string): Locator => page.getByRole('button', { name: question, exact: true });

/** Abre /lab (con la sesión que ya haya en la página) y espera a que esté montada. */
const openLab = async (page: Page): Promise<void> => {
  await page.goto(`/lab?tenant=${TENANT_A}`, { timeout: CEILING_MS });
  await waitUntil(() => isVisible(labHeading(page)));
};

/** Guarda los textos alternos con PATCH (preparación, antes de iniciar sesión). Devuelve el motivo si la API no responde 200. */
const setFlaky = async (flaky: boolean): Promise<string | undefined> => {
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: { flakyLabels: flaky } });
  return preset.status === 200 ? undefined : `PATCH /api/admin/chaos responde ${preset.status}`;
};

// --- Esquema 1: cada botón del bloque de solapamiento muestra su propio aviso -----------------------------------------------

const overlapButtonsToast: BrowserRowHandler = async (row, { page }) => {
  const label = strict('boton', OVERLAP_BUTTONS, cell(row, 'boton'));
  const expected = `pulsar «${label}» muestra el aviso de éxito con el título «${label}»; las insignias «Activo» y «Activo (3)» no cambian`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  await openLab(page);
  const target = page.getByRole('group', { name: OVERLAP_GROUP, exact: true }).getByRole('button', { name: label, exact: true });
  await armToasts(page);
  const pressed = await interact(target, `pulsar «${label}» en el bloque de solapamiento`, (element) => element.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const toast = await toastCheck(page, 'ok', label);
  const active = await textOf(page.getByTestId(LAB_TESTIDS.LAB_OVERLAP_ACTIVE));
  const count = await textOf(page.getByTestId(LAB_TESTIDS.LAB_OVERLAP_ACTIVE_COUNT));
  // Regla del bloque 1 (tabla de contraejemplos): tres filas con «…» en la segunda columna
  const table = (await textOf(page.getByTestId(LAB_TESTIDS.LAB_XPATH_TABLE))) ?? '';
  const codesShown = ['PRG-003', 'PRG-004', 'PRG-005'].every((code) => table.includes(code)) && table.includes('…');
  return rowOutcome([
    toast,
    textCheck(active, 'Activo', 'la insignia muestra'),
    textCheck(count, 'Activo (3)', 'la insignia muestra'),
    check(codesShown, 'el bloque 1 muestra PRG-003, PRG-004 y PRG-005 con «…» en la segunda columna', codesShown ? 'el bloque 1 muestra PRG-003, PRG-004 y PRG-005 con «…»' : `el bloque 1 dice «${table.slice(0, 120)}»`),
  ]);
};

// --- Esquema 2: el botón de ejemplo alterna solo con una sesión iniciada ----------------------------------------------------

const exampleAlternatesOnlyInSession: BrowserRowHandler = async (row, { page }) => {
  const account = strict('situacion', SITUATIONS, cell(row, 'situacion'));
  const behavior = strict('comportamiento', BEHAVIORS, cell(row, 'comportamiento'));
  const badge = strict('insignia', BADGES, cell(row, 'insignia'));
  const expected = `el botón de ejemplo ${cell(row, 'comportamiento')} y la insignia muestra «${badge}»`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  // Los textos variables quedan guardados ANTES de abrir /lab: la configuración se lee al iniciar sesión
  const flakyError = await setFlaky(true);
  if (flakyError !== undefined) return preparationFailedWeb(expected, flakyError);
  if (account === true) {
    const login = await signInWeb(page, studentAdmin(TENANT_A));
    if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  }
  await openLab(page);
  const seen = await observeTexts(exampleButton(page), 6_000);
  const badgeNow = await textOf(flakyBadge(page));
  const behaves = behavior === 'alterna' ? seen.has('Guardar') && seen.has('Guardar cambios') : seen.size === 1 && seen.has('Guardar');
  // Regla: pulsar el botón de ejemplo muestra el aviso «Guardado» (lab.ts, flakySaved)
  await armToasts(page);
  const clicked = await interact(exampleButton(page), 'pulsar el botón de ejemplo', (element) => element.click(ACTION));
  const saved: Check = clicked === undefined ? await toastCheck(page, 'ok', 'Guardado') : check(false, 'pulsar el botón de ejemplo muestra el aviso «Guardado»', `no se pudo pulsar: ${clicked.message}`);
  return rowOutcome([
    check(behaves, `el botón de ejemplo ${cell(row, 'comportamiento')}`, `el botón de ejemplo muestra ${describeSeen(seen)}`),
    textCheck(badgeNow, badge, 'la insignia muestra'),
    saved,
  ]);
};

// --- Esquema 3: cada pregunta frecuente despliega su respuesta --------------------------------------------------------------

const faqAnswerShows: BrowserRowHandler = async (row, { page }) => {
  const question = quoted(cell(row, 'pregunta'));
  const fragmentCell = cell(row, 'fragmento');
  // La fila 8 describe el enlace («indica el enlace del material de ejemplo»): se comprueba que la respuesta nombra «Material del curso»
  const described = fragmentCell.startsWith('(describe:');
  const fragment = described ? DESCRIBED_LINK : quoted(fragmentCell);
  const expected = `pulsa «${question}» y se despliega una respuesta que contiene «${fragment}»`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  await openLab(page);
  const pressed = await interact(questionToggle(page, question), `pulsar la pregunta «${question}»`, (element) => element.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  const region = page.getByRole('region', { name: question, exact: true });
  await waitUntil(() => isVisible(region));
  const answer = await textOf(region);
  const checks: Check[] = [check(answer !== undefined && answer.includes(fragment), expected, answer === undefined ? 'la respuesta no es legible' : `la respuesta dice «${answer}»`)];
  if (described) {
    // La respuesta solo nombra la sección: el enlace de descarga («Descargar sigpro-examples.zip») debe existir en esa sección
    const link = page.getByTestId(LAB_TESTIDS.LAB_DOWNLOAD_EXAMPLES);
    const linkShown = await isVisible(link);
    checks.push(check(linkShown, `el enlace de descarga del material de ejemplo («${DESCRIBED_LINK}») es visible`, linkShown ? 'el enlace de descarga es visible' : 'no aparece el enlace de descarga del material'));
  }
  return rowOutcome(
    checks,
    described ? { note: `La celda describe el contenido de la respuesta («${fragmentCell}»): la fila comprueba que nombra «${DESCRIBED_LINK}» y que existe el enlace de descarga.` } : {},
  );
};

// --- Esquema 4: abrir una pregunta pliega la que estaba abierta ----------------------------------------------------------------

const openingFoldsPrevious: BrowserRowHandler = async (row, { page }) => {
  const question = quoted(cell(row, 'pregunta'));
  const expected = `la respuesta de «${FIRST_QUESTION}» queda plegada y la de «${question}» queda desplegada`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  await openLab(page);
  const first = questionToggle(page, FIRST_QUESTION);
  const opened = await interact(first, `pulsar «${FIRST_QUESTION}»`, (element) => element.click(ACTION));
  if (opened) return preparationFailedWeb(expected, `no se despliega «${FIRST_QUESTION}»: ${opened.message}`);
  const firstOpen = await waitUntil(async () => (await attrOf(first, 'aria-expanded')) === 'true');
  if (!firstOpen.reached) return preparationFailedWeb(expected, `«${FIRST_QUESTION}» no queda desplegada tras pulsarla`);
  const toggled = await interact(questionToggle(page, question), `pulsar «${question}»`, (element) => element.click(ACTION));
  if (toggled) return actionFailed(expected, toggled);
  const target = questionToggle(page, question);
  // Espera con techo a que el estado cambie; después se lee y se compara lo leído (no lo que se esperaba)
  const switched = await waitUntil(async () => (await attrOf(target, 'aria-expanded')) === 'true' && (await attrOf(first, 'aria-expanded')) === 'false');
  const firstState = await attrOf(first, 'aria-expanded');
  const targetState = await attrOf(target, 'aria-expanded');
  // Signos: «+» en la pregunta plegada y «−» (U+2212) en la desplegada (lab.ts y LabPage.tsx)
  const firstSign = ((await textOf(first)) ?? '').endsWith('+');
  const targetSign = ((await textOf(target)) ?? '').endsWith('−');
  return rowOutcome([
    check(switched.reached, `la pregunta «${question}» queda desplegada y «${FIRST_QUESTION}» plegada`, `estado tras esperar: «${FIRST_QUESTION}» ${firstState ?? '(no legible)'}, «${question}» ${targetState ?? '(no legible)'}`),
    textCheck(firstState, 'false', `la respuesta de «${FIRST_QUESTION}» (aria-expanded)`),
    textCheck(targetState, 'true', `la respuesta de «${question}» (aria-expanded)`),
    check(firstSign, `el signo de «${FIRST_QUESTION}» plegada es «+»`, firstSign ? 'el signo es «+»' : 'el signo de la pregunta plegada no es «+»'),
    check(targetSign, `el signo de «${question}» desplegada es «−»`, targetSign ? 'el signo es «−»' : 'el signo de la pregunta desplegada no es «−»'),
  ]);
};

defineBrowserRows({
  story: 'US-CAOS-RESET-012',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(overlapButtonsToast)],
    [2, onWeb(exampleAlternatesOnlyInSession)],
    [3, onWeb(faqAnswerShows)],
    [4, onWeb(openingFoldsPrevious)],
  ]),
});
