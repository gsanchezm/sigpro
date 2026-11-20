import type { Locator, Page } from '@playwright/test';
import { ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { call } from '../../../story-runs/support/api';
import { ACTION, CEILING_MS, isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminAccess, prepareTenant, studentAdmin } from '../api/common';
import {
  absentCheck,
  actionFailed,
  ariaChecked,
  armToasts,
  controlCheck,
  TOOLTIP_NOTE,
  describeSeen,
  inputOf,
  interact,
  moveSlider,
  numberCheck,
  observeTexts,
  onWeb,
  prepareBrowser,
  rowOutcome,
  signInWeb,
  textCheck,
  toastCheck,
  waitForValue,
} from './common';

// US-CAOS-RESET-011 — Modo caos en Administración (web). Cada fila reinicia alumno01 con su administrador y deja el caos apagado; la
// pestaña «Modo caos» se abre en /admin?tab=chaos. Los controles son los de la web: deslizadores (flechas), interruptor y botones.

const LATENCY_SLIDER = 'Latencia máxima';
const ERRORS_SLIDER = 'Errores 500 en escrituras';
const FLAKY_SWITCH = 'Textos alternos («Guardar» / «Guardar cambios»)';
const APPLY_TEXT = 'Aplicar';
const OFF_TEXT = 'Apagar caos';
const UPDATED_TOAST = 'Modo caos actualizado';
const FORBIDDEN_HEADING = 'Tu rol no permite administrar el tenant';
const FORBIDDEN_BODY = 'Solo admin puede entrar en Administración.';
const DRAFT_PENDING = 'Cambios sin aplicar';
const OFF_BADGE = 'Caos apagado';
const NO_CHANGES = 'No hay cambios que guardar';
/** Texto de ayuda de la pestaña y explicación del botón de ejemplo (admin.ts, chaosHint y chaosPreviewHint). */
const CHAOS_HINT = 'Solo afecta a este tenant: latencia aleatoria, errores 500 en las escrituras y textos de botón que alternan. Se guarda al aplicar.';
const PREVIEW_HINT = 'Con los textos alternos activos, este botón cambia entre «Guardar» y «Guardar cambios».';

/** Cuentas de la fila (Esquema 1). */
const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
  ['alumno01@sigpro.lab', studentAdmin(TENANT_A)],
]);
/** Qué ve cada cuenta en la pestaña: el aviso de rol o la pestaña del administrador. */
const RESULTS: ReadonlyMap<string, 'aviso' | 'pestaña'> = new Map<string, 'aviso' | 'pestaña'>([
  ['el aviso «Tu rol no permite administrar el tenant»', 'aviso'],
  ['el título «Modo caos» con la insignia «Caos apagado»', 'pestaña'],
]);

/** Latencia de la fila (Esquemas 2 y 3): valor en ms del deslizador. */
const LATENCIES: ReadonlyMap<string, number> = new Map<string, number>([
  ['400', 400],
  ['0', 0],
]);
/** Errores de la fila: porcentaje del deslizador (la API guarda la tasa, que es el porcentaje entre 100). */
const ERRORS: ReadonlyMap<string, number> = new Map<string, number>([
  ['50', 50],
  ['0', 0],
  ['100', 100],
]);
/** Interruptor de textos alternos al aplicar (Esquema 2). */
const SWITCH_STATES: ReadonlyMap<string, boolean> = new Map<string, boolean>([['activado', true]]);
/** Textos alternos guardados antes de abrir la pestaña (Esquemas 3 y 5). */
const SAVED_FLAKY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['activos', true],
  ['sin activar', false],
  ['desactivados', false],
]);
/** Acciones de la fila sobre los controles (Esquema 4). */
const DRAFT_ACTIONS: ReadonlyMap<string, 'sin cambios' | 'latencia a 100'> = new Map<string, 'sin cambios' | 'latencia a 100'>([
  ['no cambia ningún control', 'sin cambios'],
  ['mueve «Latencia máxima» a 100', 'latencia a 100'],
]);

const latencySlider = (page: Page): Locator => page.getByRole('slider', { name: LATENCY_SLIDER, exact: true });
const errorsSlider = (page: Page): Locator => page.getByRole('slider', { name: ERRORS_SLIDER, exact: true });
const flakySwitch = (page: Page): Locator => page.getByRole('switch', { name: FLAKY_SWITCH, exact: true });
const applyButton = (page: Page): Locator => page.getByRole('button', { name: APPLY_TEXT, exact: true });
const offButton = (page: Page): Locator => page.getByRole('button', { name: OFF_TEXT, exact: true });
const statusBadge = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_STATUS);
const previewButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_PREVIEW).first();
const chaosHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Modo caos', exact: true });

/** Abre /admin?tab=chaos y espera a que la pestaña esté montada (el título «Modo caos» o el aviso de rol). */
const openChaosTab = async (page: Page): Promise<void> => {
  await page.goto('/admin?tab=chaos', { timeout: CEILING_MS });
  await waitUntil(async () => (await isVisible(chaosHeading(page))) || (await isVisible(page.getByRole('heading', { name: FORBIDDEN_HEADING, exact: true }))));
};

/** Espera a que los controles reflejen lo guardado (la carga es asíncrona): el deslizador de latencia llega al valor dado. */
const waitLoaded = async (page: Page, latency: number): Promise<void> => {
  await waitForValue(() => inputOf(latencySlider(page)), (value) => value !== undefined && Number(value) === latency);
};

// --- Esquema 1: solo el admin ve la pestaña Modo caos ------------------------------------------------------------------------

const onlyAdminSeesChaos: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const result = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `${cell(row, 'cuenta')} ve ${cell(row, 'resultado')}`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, account);
  if (login) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${login}`);
  await openChaosTab(page);
  if (result === 'aviso') {
    const heading = page.getByRole('heading', { name: FORBIDDEN_HEADING, exact: true });
    return rowOutcome([
      check(await isVisible(heading), `el aviso «${FORBIDDEN_HEADING}»`, (await isVisible(heading)) ? `el aviso «${FORBIDDEN_HEADING}»` : 'no aparece el aviso de rol'),
      check(await isVisible(page.getByText(FORBIDDEN_BODY, { exact: true })), `el texto «${FORBIDDEN_BODY}»`, (await isVisible(page.getByText(FORBIDDEN_BODY, { exact: true }))) ? `el texto «${FORBIDDEN_BODY}»` : 'no aparece el texto de rol'),
      check(await isVisible(page.getByRole('link', { name: 'Volver a Programas', exact: true })), 'el enlace «Volver a Programas»', 'no aparece el enlace «Volver a Programas»'),
    ]);
  }
  const badge = await textOf(statusBadge(page));
  // Reglas de la pestaña: el texto de ayuda y el de la vista previa (admin.ts:52 y :68)
  const panel = (await textOf(page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_PANEL))) ?? '';
  return rowOutcome([
    check(await isVisible(chaosHeading(page)), 'el título «Modo caos»', (await isVisible(chaosHeading(page))) ? 'el título «Modo caos»' : 'no aparece el título «Modo caos»'),
    textCheck(badge, OFF_BADGE, 'la insignia del modo caos muestra'),
    check(panel.includes(CHAOS_HINT), `el texto de ayuda «${CHAOS_HINT}»`, panel.includes(CHAOS_HINT) ? `el texto de ayuda «${CHAOS_HINT}»` : 'no aparece el texto de ayuda de la pestaña'),
    check(panel.includes(PREVIEW_HINT), `el texto «${PREVIEW_HINT}»`, panel.includes(PREVIEW_HINT) ? `el texto «${PREVIEW_HINT}»` : 'no aparece la explicación del botón de ejemplo'),
  ]);
};

// --- Esquema 2: aplicar el borrador guarda el modo caos y muestra su resumen -----------------------------------------------

const appliesDraft: BrowserRowHandler = async (row, { page }) => {
  const latency = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const errors = strict('errores', ERRORS, cell(row, 'errores'));
  const switchOn = strict('interruptor', SWITCH_STATES, cell(row, 'interruptor'));
  const body = quoted(cell(row, 'cuerpo'));
  const badge = quoted(cell(row, 'insignia'));
  const expected = `aviso ok «${UPDATED_TOAST}» con el cuerpo «${body}» y la insignia «${badge}»`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  await openChaosTab(page);
  await waitLoaded(page, 0);
  const moved = await moveSlider(latencySlider(page), latency, 100);
  if (moved) return actionFailed(expected, moved);
  const movedErrors = await moveSlider(errorsSlider(page), errors, 5);
  if (movedErrors) return actionFailed(expected, movedErrors);
  if ((await ariaChecked(flakySwitch(page))) !== switchOn) {
    const toggled = await interact(flakySwitch(page), `poner «${FLAKY_SWITCH}» ${switchOn ? 'activado' : 'desactivado'}`, (element) => element.click(ACTION));
    if (toggled) return actionFailed(expected, toggled);
  }
  await armToasts(page);
  const applied = await interact(applyButton(page), `pulsar «${APPLY_TEXT}»`, (element) => element.click(ACTION));
  if (applied) return actionFailed(expected, applied);
  const toast = await toastCheck(page, 'ok', UPDATED_TOAST, body);
  const badgeNow = await waitForValue(() => textOf(statusBadge(page)), (value) => value === badge);
  return rowOutcome([toast, textCheck(badgeNow, badge, 'la insignia del modo caos muestra')], {
    note: 'Regla de la historia sin fila propia, no comprobada: si guardar falla, el aviso de error sale con la traza y el borrador se conserva. Los deslizadores no admiten un valor fuera de rango, así que esta fila no fuerza el fallo.',
  });
};

// --- Esquema 3: apagar caos devuelve el modo a reposo ---------------------------------------------------------------------

const offReturnsRest: BrowserRowHandler = async (row, { page }) => {
  const latency = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const errors = strict('errores', ERRORS, cell(row, 'errores'));
  const flaky = strict('textos', SAVED_FLAKY, cell(row, 'textos'));
  const expected = `tras «${OFF_TEXT}»: aviso ok «${UPDATED_TOAST}» con el cuerpo «Latencia 0 ms · errores 0 % · textos alternos no», la insignia «${OFF_BADGE}» y el deslizador «${LATENCY_SLIDER}» en 0 ms`;
  await prepareTenant(TENANT_A);
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: { latencyMs: latency, errorRate: errors / 100, flakyLabels: flaky } });
  if (preset.status !== 200) return preparationFailedWeb(expected, `alumno01@sigpro.lab fija el caos con PATCH /api/admin/chaos (respuesta ${preset.status})`);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  await openChaosTab(page);
  await waitLoaded(page, latency);
  await armToasts(page);
  const off = await interact(offButton(page), `pulsar «${OFF_TEXT}»`, (element) => element.click(ACTION));
  if (off) return actionFailed(expected, off);
  const toast = await toastCheck(page, 'ok', UPDATED_TOAST, 'Latencia 0 ms · errores 0 % · textos alternos no');
  const badgeNow = await waitForValue(() => textOf(statusBadge(page)), (value) => value === OFF_BADGE);
  const sliderNow = await waitForValue(() => inputOf(latencySlider(page)), (value) => value !== undefined && Number(value) === 0);
  // Regla: «Apagar caos» queda deshabilitado con el motivo «Caos apagado» cuando el caos guardado está apagado y no hay cambios
  const offDisabled = await controlCheck(offButton(page), 'el botón «Apagar caos»', 'deshabilitado', OFF_BADGE);
  return rowOutcome([
    toast,
    textCheck(badgeNow, OFF_BADGE, 'la insignia del modo caos muestra'),
    numberCheck(sliderNow, 0, `el deslizador «${LATENCY_SLIDER}» vuelve a`),
    offDisabled,
  ], { note: TOOLTIP_NOTE });
};

// --- Esquema 4: el botón Aplicar depende de que haya cambios sin guardar -------------------------------------------------

const applyNeedsChanges: BrowserRowHandler = async (row, { page }) => {
  const action = strict('accion', DRAFT_ACTIONS, cell(row, 'accion'));
  const expected = `el botón «${APPLY_TEXT}» ${action === 'sin cambios' ? `está deshabilitado con el motivo «${NO_CHANGES}»` : 'está activo'} y ${action === 'sin cambios' ? 'no aparece el texto «Cambios sin aplicar»' : 'aparece el texto «Cambios sin aplicar»'}; la insignia muestra «${OFF_BADGE}»`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  await openChaosTab(page);
  await waitLoaded(page, 0);
  const pending = page.getByText(DRAFT_PENDING, { exact: true });
  if (action === 'latencia a 100') {
    const moved = await moveSlider(latencySlider(page), 100, 100);
    if (moved) return actionFailed(expected, moved);
    await waitUntil(() => isVisible(pending));
  }
  const badge = await textOf(statusBadge(page));
  const apply =
    action === 'sin cambios'
      ? await controlCheck(applyButton(page), `el botón «${APPLY_TEXT}»`, 'deshabilitado', NO_CHANGES)
      : await controlCheck(applyButton(page), `el botón «${APPLY_TEXT}»`, 'habilitado');
  const pendingCheck = action === 'sin cambios' ? await absentCheck(pending, `el texto «${DRAFT_PENDING}»`) : check(await isVisible(pending), `aparece el texto «${DRAFT_PENDING}»`, (await isVisible(pending)) ? `aparece el texto «${DRAFT_PENDING}»` : `no aparece el texto «${DRAFT_PENDING}»`);
  return rowOutcome([apply, pendingCheck, textCheck(badge, OFF_BADGE, 'la insignia del modo caos muestra')], { note: TOOLTIP_NOTE });
};

// --- Esquema 5: el botón de ejemplo alterna solo con los textos alternos guardados ---------------------------------------

const exampleOnlyWithSaved: BrowserRowHandler = async (row, { page }) => {
  const flaky = strict('estado', SAVED_FLAKY, cell(row, 'estado'));
  const behavior = cell(row, 'comportamiento');
  const expected = `el botón de ejemplo ${behavior}; al pulsarlo aparece el aviso informativo «Has pulsado «…»» con el texto que mostraba`;
  await prepareTenant(TENANT_A);
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: { flakyLabels: flaky } });
  if (preset.status !== 200) return preparationFailedWeb(expected, `alumno01@sigpro.lab fija los textos alternos con PATCH /api/admin/chaos (respuesta ${preset.status})`);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  await openChaosTab(page);
  const seen = await observeTexts(previewButton(page), 7_000);
  const before = await textOf(previewButton(page));
  await armToasts(page);
  const clicked = await interact(previewButton(page), 'pulsar el «Botón de ejemplo»', (element) => element.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  const toast = await toastCheck(page, 'info', `Has pulsado «${before ?? '(sin texto)'}»`);
  const behaves = flaky ? seen.has('Guardar') && seen.has('Guardar cambios') : seen.size === 1 && seen.has('Guardar');
  return rowOutcome([check(behaves, `el botón de ejemplo ${behavior}`, `el botón de ejemplo muestra ${describeSeen(seen)}`), toast]);
};

defineBrowserRows({
  story: 'US-CAOS-RESET-011',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(onlyAdminSeesChaos)],
    [2, onWeb(appliesDraft)],
    [3, onWeb(offReturnsRest)],
    [4, onWeb(applyNeedsChanges)],
    [5, onWeb(exampleOnlyWithSaved)],
  ]),
});
