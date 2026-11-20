import type { Locator, Page } from '@playwright/test';
import { ADMIN_TESTIDS, MOVIL_ADMIN_TESTIDS } from '../../../../packages/shared/src/testids';
import { call } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, holdsFor, isVisible, quoted, textOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import { adminAccess, prepareTenant, studentAdmin } from '../api/common';
import { actionFailedOn, armToasts, describeSeen, interact, observeTexts, textCheck, toastCheck, waitForValue, type Blocked } from '../web/common';
import { adminPath, ariaDisabled, mobileOutcome, onMobile, pressTimes, prepareMobile, signInMobile, switchOn, unreachedScreen } from './common';

// US-CAOS-RESET-013 — Modo caos en Administración (app móvil, Expo web a 390 px). Los deslizadores son de pasos: «−» y «+» junto a su
// valor, con el nombre accesible «<etiqueta> +100» (latencia) y «<etiqueta> +5» (errores). Cada fila reinicia alumno01 y deja el caos
// apagado al terminar. El interruptor y el botón de ejemplo se localizan por testid: su nombre cambia o se repite.

const LATENCY_LABEL = 'Latencia máxima';
const ERRORS_LABEL = 'Errores 500 en escrituras';
const UPDATED_TOAST = 'Modo caos actualizado';
const FORBIDDEN_HEADING = 'Tu rol no permite administrar el tenant';
const FORBIDDEN_BODY = 'Solo admin puede entrar en Administración.';
const OFF_BADGE = 'Caos apagado';
const NO_CHANGES = 'No hay cambios que guardar';

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
const applyButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_APPLY).first();
const offButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_OFF).first();
const offReason = (page: Page): Locator => page.getByTestId(MOVIL_ADMIN_TESTIDS.CHAOS_OFF_REASON);
const applyReason = (page: Page): Locator => page.getByTestId(MOVIL_ADMIN_TESTIDS.CHAOS_APPLY_REASON);
/** Interruptor de textos alternos: el testid está en el propio `role="switch"` (SwitchField); el primero es el elemento de la fila. */
const flakySwitch = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_FLAKY).first();
/** Botón de ejemplo: su nombre cambia entre «Guardar» y «Guardar cambios», así que se localiza por su testid. */
const previewButton = (page: Page): Locator => page.getByTestId(ADMIN_TESTIDS.ADMIN_CHAOS_PREVIEW).first();
const chaosHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Modo caos', exact: true });

/** Abre /admin?tab=chaos con la sesión de la fila y espera a la pestaña. */
/** Fallo de una acción sobre la pestaña «Modo caos»: discrepa solo si la pantalla está visible (ver `actionFailedOn`). */
const failOnChaos = (page: Page, expected: string, blocked: Blocked): Promise<Outcome> => actionFailedOn(page, expected, blocked, chaosHeading(page));

/** Espera (con techo) a que el encabezado «Modo caos» esté visible y se mantenga 1 s: la pantalla no se desmonta. No navega. */
const waitChaosStable = async (page: Page): Promise<boolean> => {
  const reached = await waitUntil(() => isVisible(chaosHeading(page)));
  if (!reached.reached) return false;
  return (await holdsFor(() => isVisible(chaosHeading(page)), 1_000)).held;
};

/** Abre /admin?tab=chaos con la sesión de la fila y espera a que la pantalla esté estable. */
const openChaos = async (page: Page): Promise<boolean> => {
  await page.goto(adminPath('chaos'), { timeout: CEILING_MS });
  return waitChaosStable(page);
};

/** Texto de un valor leído, o «(no legible)». */
const shown = (value: string | undefined): string => (value === undefined ? '(no legible)' : `«${value}»`);

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
    const noticeShown = await waitUntil(() => isVisible(notice));
    if (!noticeShown.reached) return mobileOutcome([check(false, `el aviso «${FORBIDDEN_HEADING}»`, 'no aparece el aviso de rol tras esperar')]);
    const lines = ((await textOf(notice)) ?? '').split('\n').map((line) => line.trim()).filter((line) => line !== '');
    const back = page.getByTestId(ADMIN_TESTIDS.ADMIN_FORBIDDEN_BACK);
    const backShown = await isVisible(back);
    return mobileOutcome([
      check(lines.includes(FORBIDDEN_HEADING), `el aviso «${FORBIDDEN_HEADING}»`, lines.length === 0 ? 'no aparece el aviso' : `el aviso dice ${lines.map((line) => `«${line}»`).join(' ')}`),
      check(lines.includes(FORBIDDEN_BODY), `el texto «${FORBIDDEN_BODY}»`, lines.includes(FORBIDDEN_BODY) ? `el texto «${FORBIDDEN_BODY}»` : 'no aparece el texto de rol'),
      check(backShown, 'una acción para volver', backShown ? 'una acción para volver' : 'no aparece la acción para volver'),
    ]);
  }
  const headingShown = await waitChaosStable(page);
  const badge = await textOf(statusBadge(page));
  return mobileOutcome([
    check(headingShown, 'el título «Modo caos»', headingShown ? 'el título «Modo caos»' : 'no aparece el título «Modo caos»'),
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
  if (!(await openChaos(page))) return unreachedScreen(page, expected, 'Modo caos');
  // Regla sin cambios: «Aplicar» deshabilitado con el motivo «No hay cambios que guardar» como texto visible junto al botón
  const idleDisabled = (await ariaDisabled(applyButton(page))) === true;
  const idleReason = await textOf(applyReason(page));
  const idleChecks: Check[] = [
    check(idleDisabled, `«Aplicar» deshabilitado sin cambios`, idleDisabled ? '«Aplicar» deshabilitado sin cambios' : '«Aplicar» activo sin cambios'),
    textCheck(idleReason, NO_CHANGES, 'el motivo visible junto a «Aplicar» es'),
  ];
  const latencyDone = await pressTimes(page, `${LATENCY_LABEL} +100`, latencyPresses);
  if (latencyDone !== undefined) return failOnChaos(page, expected, latencyDone);
  const errorsDone = await pressTimes(page, `${ERRORS_LABEL} +5`, errorPresses);
  if (errorsDone !== undefined) return failOnChaos(page, expected, errorsDone);
  if ((await switchOn(flakySwitch(page))) !== switchWanted) {
    const toggled = await interact(flakySwitch(page), 'poner «Textos alternos» activado', (element) => element.click(ACTION));
    if (toggled) return failOnChaos(page, expected, toggled);
  }
  const switchNow = await waitForValue(
    async () => ((await switchOn(flakySwitch(page))) === true ? 'true' : 'false'),
    (value) => value === (switchWanted ? 'true' : 'false'),
  );
  const apply = applyButton(page);
  const enabledBefore = (await ariaDisabled(apply)) === false;
  await armToasts(page);
  const applied = await interact(apply, 'pulsar «Aplicar»', (element) => element.click({ timeout: 5_000 }));
  if (applied) {
    const reason = (await textOf(applyReason(page))) ?? '(sin motivo visible)';
    return failOnChaos(page, expected, { ...applied, message: `${applied.message} · motivo visible junto a «Aplicar»: «${reason}»` });
  }
  const toast = await toastCheck(page, 'ok', UPDATED_TOAST, body);
  const badgeNow = await waitForValue(() => textOf(statusBadge(page)), (value) => value === badge);
  return mobileOutcome([
    ...idleChecks,
    check(switchNow === (switchWanted ? 'true' : 'false'), 'el interruptor de textos alternos queda activado', `el interruptor queda ${switchNow === 'true' ? 'activado' : 'desactivado'} (aria-checked)`),
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
  if (!(await openChaos(page))) return unreachedScreen(page, expected, 'Modo caos');
  const shownLatency = await waitForValue(() => textOf(latencyValue(page)), (value) => value === `${latency} ms`);
  await armToasts(page);
  const off = await interact(offButton(page), 'pulsar «Apagar caos»', (element) => element.click(ACTION));
  if (off) return failOnChaos(page, expected, off);
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
  if (!(await openChaos(page))) return unreachedScreen(page, expected, 'Modo caos');
  const seen = await observeTexts(previewButton(page), 7_000);
  const before = await textOf(previewButton(page));
  await armToasts(page);
  const clicked = await interact(previewButton(page), 'pulsar el «Botón de ejemplo»', (element) => element.click(ACTION));
  if (clicked) return failOnChaos(page, expected, clicked);
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
