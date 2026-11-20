import type { Locator, Page } from '@playwright/test';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { call } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { adminAccess, prepareTenant, studentAdmin } from '../api/common';
import { armToasts, describeSeen, interact, observeTexts, textCheck, toastCheck, waitForValue } from '../web/common';
import { adminPath, ariaDisabled, mobileOutcome, onMobile, pressTimes, prepareMobile, signInMobile, switchOn } from './common';

// US-CAOS-RESET-013 — Modo caos en Administración (app móvil, Expo web a 390 px). Los deslizadores son de pasos: «−» y «+» junto a su
// valor, con el nombre accesible «<etiqueta> +100» (latencia) y «<etiqueta> +5» (errores). Cada fila reinicia alumno01 y deja el caos
// apagado al terminar.

const LATENCY_LABEL = 'Latencia máxima';
const ERRORS_LABEL = 'Errores 500 en escrituras';
const FLAKY_NAME = 'Textos alternos («Guardar» / «Guardar cambios»)';
const UPDATED_TOAST = 'Modo caos actualizado';
const FORBIDDEN_HEADING = 'Tu rol no permite administrar el tenant';
const FORBIDDEN_BODY = 'Solo admin puede entrar en Administración.';
const OFF_BADGE = 'Caos apagado';

/** Cuentas de la fila (Esquema 1). */
const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['alumno01@sigpro.lab', studentAdmin(TENANT_A)],
]);
/** Lo que ve cada cuenta al abrir la pestaña: el aviso de rol o el título y la insignia del administrador. */
const RESULTS: ReadonlyMap<string, 'aviso' | 'pestaña'> = new Map<string, 'aviso' | 'pestaña'>([
  ['el aviso «Tu rol no permite administrar el tenant»', 'aviso'],
  ['el título «Modo caos» con la insignia «Caos apagado»', 'pestaña'],
]);

/** Pulsaciones de «+» de la latencia (paso de 100 ms) y de los errores (paso de 5 %) (Esquema 2). */
const LATENCY_PRESSES: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['0', 0],
]);
const ERROR_PRESSES: ReadonlyMap<string, number> = new Map<string, number>([
  ['10', 10],
  ['0', 0],
]);
const SWITCH_STATES: ReadonlyMap<string, boolean> = new Map<string, boolean>([['activado', true]]);

/** Estado guardado antes de abrir la pestaña (Esquemas 3 y 4): latencia en ms, errores en %, y textos alternos. */
const SAVED_LATENCY: ReadonlyMap<string, number> = new Map<string, number>([
  ['400', 400],
  ['0', 0],
]);
const SAVED_ERRORS: ReadonlyMap<string, number> = new Map<string, number>([
  ['50', 50],
  ['100', 100],
]);
const SAVED_FLAKY: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['activos', true],
  ['desactivados', false],
  ['sin activar', false],
]);

const latencyValue = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_LATENCY_VALUE);
const statusBadge = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_STATUS);
const applyButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_APPLY);
const offButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_OFF);
const offReason = (page: Page): Locator => page.getByTestId(MOVIL_ADMIN_TESTIDS.CHAOS_OFF_REASON);
const applyReason = (page: Page): Locator => page.getByTestId(MOVIL_ADMIN_TESTIDS.CHAOS_APPLY_REASON);
const flakySwitch = (page: Page): Locator => page.getByRole('switch', { name: FLAKY_NAME, exact: true });
const previewButton = (page: Page): Locator => page.getByRole('button', { name: /^Guardar( cambios)?$/ });
const chaosHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Modo caos', exact: true });

/** Abre /admin?tab=chaos con la sesión de la fila y espera a la pestaña. */
const openChaos = async (page: Page): Promise<void> => {
  await page.goto(adminPath('chaos'), { timeout: CEILING_MS });
  await waitUntil(() => isVisible(chaosHeading(page)));
};

/** Texto de un valor leído, o «(no legible)». */
const shown = (value: string | undefined): string => (value === undefined ? '(no legible)' : `«${value}»`);

/** Resultado de una fila móvil que no pudo ejecutar su paso: el motivo queda en la comprobación. */
const stepFailed = (expected: string, reason: string): Outcome => mobileOutcome([check(false, expected, reason)]);

// --- Esquema 1: solo el admin ve la pestaña Modo caos -------------------------------------------------------------------------

const onlyAdminSeesChaos: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const result = strict('resultado', RESULTS, cell(row, 'resultado'));
  const expected = `${cell(row, 'cuenta')} ve ${cell(row, 'resultado')}`;
  await prepareTenant(TENANT_A);
  await prepareMobile(page);
  const login = await signInMobile(page, account.email, account.password);
  if (login) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión en la app móvil: ${login}`);
  await page.goto(adminPath('chaos'), { timeout: CEILING_MS });
  if (result === 'aviso') {
    const notice = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN);
    await waitUntil(() => isVisible(notice));
    const lines = (await textOf(notice) ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
    const back = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK);
    return mobileOutcome([
      check(lines.includes(FORBIDDEN_HEADING), `el aviso «${FORBIDDEN_HEADING}»`, lines.length === 0 ? 'no aparece el aviso' : `el aviso dice ${lines.map((line) => `«${line}»`).join(' ')}`),
      check(lines.includes(FORBIDDEN_BODY), `el texto «${FORBIDDEN_BODY}»`, lines.includes(FORBIDDEN_BODY) ? `el texto «${FORBIDDEN_BODY}»` : 'no aparece el texto de rol'),
      check(await isVisible(back), 'una acción para volver', (await isVisible(back)) ? 'una acción para volver' : 'no aparece la acción para volver'),
    ]);
  }
  await waitUntil(() => isVisible(chaosHeading(page)));
  const badge = await textOf(statusBadge(page));
  return mobileOutcome([
    check(await isVisible(chaosHeading(page)), 'el título «Modo caos»', (await isVisible(chaosHeading(page))) ? 'el título «Modo caos»' : 'no aparece el título «Modo caos»'),
    textCheck(badge, OFF_BADGE, 'la insignia del modo caos muestra'),
  ]);
};

// --- Esquema 2: aplicar guarda el modo caos fijado con los controles -------------------------------------------------------

const appliesFromControls: BrowserRowHandler = async (row, { page }) => {
  const latencyPresses = strict('pulsaciones_latencia', LATENCY_PRESSES, cell(row, 'pulsaciones_latencia'));
  const errorPresses = strict('pulsaciones_errores', ERROR_PRESSES, cell(row, 'pulsaciones_errores'));
  const switchWanted = strict('interruptor', SWITCH_STATES, cell(row, 'interruptor'));
  const body = quoted(cell(row, 'cuerpo'));
  const badge = quoted(cell(row, 'insignia'));
  const expected = `aviso ok «${UPDATED_TOAST}» con el cuerpo «${body}» y la insignia «${badge}»`;
  await prepareTenant(TENANT_A);
  await prepareMobile(page);
  const login = await signInMobile(page, studentAdmin(TENANT_A).email, studentAdmin(TENANT_A).password);
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión en la app móvil: ${login}`);
  await openChaos(page);
  const latencyDone = await pressTimes(page, `${LATENCY_LABEL} +100`, latencyPresses);
  if (latencyDone !== undefined) return stepFailed(expected, `no se pudo mover «${LATENCY_LABEL}»: ${latencyDone}`);
  const errorsDone = await pressTimes(page, `${ERRORS_LABEL} +5`, errorPresses);
  if (errorsDone !== undefined) return stepFailed(expected, `no se pudo mover «${ERRORS_LABEL}»: ${errorsDone}`);
  if ((await switchOn(flakySwitch(page))) !== switchWanted) {
    const toggled = await interact(flakySwitch(page), `poner «${FLAKY_NAME}» activado`, (element) => element.click(ACTION));
    if (toggled) return stepFailed(expected, `no se pudo activar «${FLAKY_NAME}»: ${toggled.message}`);
  }
  const apply = applyButton(page);
  const enabledBefore = (await ariaDisabled(apply)) === false;
  await armToasts(page);
  const applied = await interact(apply, 'pulsar «Aplicar»', (element) => element.click({ timeout: 5_000 }));
  if (applied) {
    const reason = (await textOf(applyReason(page))) ?? '(sin motivo visible)';
    return mobileOutcome([check(false, expected, `«Aplicar» no se pudo pulsar (motivo visible: «${reason}»): ${applied.message}`)], { note: applied.note });
  }
  const toast = await toastCheck(page, 'ok', UPDATED_TOAST, body);
  const badgeNow = await waitForValue(() => textOf(statusBadge(page)), (value) => value === badge);
  return mobileOutcome([
    check(enabledBefore, 'el botón «Aplicar» está activo con cambios sin aplicar', enabledBefore ? 'el botón «Aplicar» está activo' : 'el botón «Aplicar» está deshabilitado con cambios'),
    toast,
    textCheck(badgeNow, badge, 'la insignia del modo caos muestra'),
  ]);
};

// --- Esquema 3: apagar caos devuelve el modo a reposo y los motivos se ven como texto -------------------------------------

const offReturnsRestMobile: BrowserRowHandler = async (row, { page }) => {
  const latency = strict('latencia', SAVED_LATENCY, cell(row, 'latencia'));
  const errors = strict('errores', SAVED_ERRORS, cell(row, 'errores'));
  const flaky = strict('textos', SAVED_FLAKY, cell(row, 'textos'));
  const expected = `tras «Apagar caos»: aviso ok «${UPDATED_TOAST}» con el cuerpo «Latencia 0 ms · errores 0 % · textos alternos no», la insignia «${OFF_BADGE}» y «Apagar caos» deshabilitado con el motivo «${OFF_BADGE}» visible`;
  await prepareTenant(TENANT_A);
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: { latencyMs: latency, errorRate: errors / 100, flakyLabels: flaky } });
  if (preset.status !== 200) return preparationFailedWeb(expected, `alumno01@sigpro.lab fija el caos con PATCH /api/admin/chaos (respuesta ${preset.status})`);
  await prepareMobile(page);
  const login = await signInMobile(page, studentAdmin(TENANT_A).email, studentAdmin(TENANT_A).password);
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión en la app móvil: ${login}`);
  await openChaos(page);
  const shownLatency = await waitForValue(() => textOf(latencyValue(page)), (value) => value === `${latency} ms`);
  await armToasts(page);
  const off = await interact(offButton(page), 'pulsar «Apagar caos»', (element) => element.click(ACTION));
  if (off) return stepFailed(expected, `no se pudo pulsar «Apagar caos»: ${off.message}`);
  const toast = await toastCheck(page, 'ok', UPDATED_TOAST, 'Latencia 0 ms · errores 0 % · textos alternos no');
  const badgeNow = await waitForValue(() => textOf(statusBadge(page)), (value) => value === OFF_BADGE);
  const disabled = (await ariaDisabled(offButton(page))) === true;
  const reasonNow = await waitForValue(() => textOf(offReason(page)), (value) => value === OFF_BADGE);
  return mobileOutcome([
    check(shownLatency === `${latency} ms`, `antes de apagar, la latencia muestra ${latency} ms`, `antes de apagar, la latencia muestra ${shown(shownLatency)}`),
    toast,
    textCheck(badgeNow, OFF_BADGE, 'la insignia del modo caos muestra'),
    check(disabled, '«Apagar caos» queda deshabilitado', disabled ? '«Apagar caos» deshabilitado' : '«Apagar caos» sigue activo'),
    textCheck(reasonNow, OFF_BADGE, 'el motivo visible junto al botón es'),
  ]);
};

// --- Esquema 4: el botón de ejemplo alterna solo con los textos alternos guardados ----------------------------------------

const exampleAlternatesOnlyWhenSaved: BrowserRowHandler = async (row, { page }) => {
  const flaky = strict('estado', SAVED_FLAKY, cell(row, 'estado'));
  const behavior = cell(row, 'comportamiento');
  const expected = `el botón de ejemplo ${behavior}; al pulsarlo aparece el aviso informativo «Has pulsado «…»» con el texto que tenía`;
  await prepareTenant(TENANT_A);
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: { flakyLabels: flaky } });
  if (preset.status !== 200) return preparationFailedWeb(expected, `alumno01@sigpro.lab fija los textos alternos con PATCH /api/admin/chaos (respuesta ${preset.status})`);
  await prepareMobile(page);
  const login = await signInMobile(page, studentAdmin(TENANT_A).email, studentAdmin(TENANT_A).password);
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión en la app móvil: ${login}`);
  await openChaos(page);
  const seen = await observeTexts(previewButton(page), 7_000);
  const before = await textOf(previewButton(page));
  await armToasts(page);
  const clicked = await interact(previewButton(page), 'pulsar el «Botón de ejemplo»', (element) => element.click(ACTION));
  if (clicked) return stepFailed(expected, `no se pudo pulsar el «Botón de ejemplo»: ${clicked.message}`);
  const toast = await toastCheck(page, 'info', `Has pulsado «${before ?? '(sin texto)'}»`);
  const behaves = flaky ? seen.has('Guardar') && seen.has('Guardar cambios') : seen.size === 1 && seen.has('Guardar');
  const behavesCheck: Check = check(behaves, `el botón de ejemplo ${behavior}`, `el botón de ejemplo muestra ${describeSeen(seen)}`);
  return mobileOutcome([behavesCheck, toast]);
};

defineBrowserRows({
  story: 'US-CAOS-RESET-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(onlyAdminSeesChaos)],
    [2, onMobile(appliesFromControls)],
    [3, onMobile(offReturnsRestMobile)],
    [4, onMobile(exampleAlternatesOnlyWhenSaved)],
  ]),
});

