import type { Locator, Page } from '@playwright/test';
import { LAB_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { call } from '../../../story-runs/support/api';
import { ACTION, CEILING_MS, attrOf, isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
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
  return rowOutcome([toast, textCheck(active, 'Activo', 'la insignia muestra'), textCheck(count, 'Activo (3)', 'la insignia muestra')]);
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
  return rowOutcome([
    check(behaves, `el botón de ejemplo ${cell(row, 'comportamiento')}`, `el botón de ejemplo muestra ${describeSeen(seen)}`),
    textCheck(badgeNow, badge, 'la insignia muestra'),
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
  return rowOutcome(
    [check(answer !== undefined && answer.includes(fragment), expected, answer === undefined ? 'la respuesta no es legible' : `la respuesta dice «${answer}»`)],
    described ? { note: `La celda describe el contenido de la respuesta («${fragmentCell}»): la fila comprueba que nombra «${DESCRIBED_LINK}», el lugar del enlace de descarga.` } : {},
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
  await waitUntil(async () => (await attrOf(first, 'aria-expanded')) === 'true');
  const toggled = await interact(questionToggle(page, question), `pulsar «${question}»`, (element) => element.click(ACTION));
  if (toggled) return actionFailed(expected, toggled);
  const target = questionToggle(page, question);
  await waitUntil(async () => (await attrOf(target, 'aria-expanded')) === 'true' && (await attrOf(first, 'aria-expanded')) === 'false');
  return rowOutcome([
    textCheck(await attrOf(first, 'aria-expanded'), 'false', `la respuesta de «${FIRST_QUESTION}» (aria-expanded)`),
    textCheck(await attrOf(target, 'aria-expanded'), 'true', `la respuesta de «${question}» (aria-expanded)`),
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
