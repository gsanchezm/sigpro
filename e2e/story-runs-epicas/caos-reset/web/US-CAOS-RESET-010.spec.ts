import type { Locator, Page } from '@playwright/test';
import { LAB_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { CEILING_MS, isVisible, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminAccess, prepareTenant, studentAdmin } from '../api/common';
import { call } from '../../../story-runs/support/api';
import {
  actionFailed,
  actionFailedOn,
  armToasts,
  controlCheck,
  describeLog,
  inputOf,
  interact,
  numberCheck,
  observeTexts,
  describeSeen,
  onWeb,
  prepareBrowser,
  rowOutcome,
  signInWeb,
  toastCheck,
  TOOLTIP_NOTE,
  waitChecked,
  waitForValue,
  waitToast,
  type Blocked,
} from './common';

// US-CAOS-RESET-010 — Aplicar y apagar el modo caos desde /lab (web). Cada fila reinicia alumno01 con su administrador y deja el caos
// apagado; la fila abre /lab con la sesión de alumno01 (salvo los Esquemas que miran sin sesión o con gestor).

const LATENCY_LABEL = 'Latencia máxima (ms)';
const RATE_LABEL = 'Tasa de errores 500 en escrituras (0–1)';
const FLAKY_LABEL = 'Textos de botón variables';
const APPLY_TEXT = 'Aplicar caos';
const OFF_TEXT = 'Desactivar caos';
const APPLIED_TOAST = 'Configuración de caos aplicada';
const NEED_ADMIN = 'Inicia sesión como admin para cambiar el modo caos.';
const ERROR_TITLE = 'Ha ocurrido un error inesperado';

/** Latencia de la fila (Esquemas 1 y 2) y de los valores fuera de rango (Esquema 3). */
const LATENCIES: ReadonlyMap<string, number> = new Map<string, number>([
  ['400', 400],
  ['0', 0],
]);
/** Tasa de la fila (0–1). */
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0.5', 0.5],
  ['0', 0],
  ['1', 1],
]);
/** Estado de la casilla de textos variables. */
const FLAKY_STATES: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['marcada', true],
  ['sin marcar', false],
]);
/** Campo fuera de rango y su nombre accesible (Esquema 3). */
const FIELDS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Latencia máxima (ms)»', LATENCY_LABEL],
  ['«Tasa de errores 500 en escrituras (0–1)»', RATE_LABEL],
]);
/** Valores fuera de rango (Esquema 3): se escriben tal cual. */
const OUT_OF_RANGE: ReadonlyMap<string, string> = new Map<string, string>([
  ['5001', '5001'],
  ['-1', '-1'],
  ['1.5', '1.5'],
]);
/** Quién mira los controles sin ser admin (Esquema 4). */
const WHO: ReadonlyMap<string, Credentials | undefined> = new Map<string, Credentials | undefined>([
  ['una persona sin sesión iniciada', undefined],
  ['gestor@sigpro.test con sesión iniciada', DEMO.gestor],
]);

const latencyBox = (page: Page): Locator => page.getByRole('spinbutton', { name: LATENCY_LABEL, exact: true });
const rateBox = (page: Page): Locator => page.getByRole('spinbutton', { name: RATE_LABEL, exact: true });
const flakyBox = (page: Page): Locator => page.getByRole('checkbox', { name: FLAKY_LABEL, exact: true });
const applyButton = (page: Page): Locator => page.getByRole('button', { name: APPLY_TEXT, exact: true });
const offButton = (page: Page): Locator => page.getByRole('button', { name: OFF_TEXT, exact: true });
const labHeading = (page: Page): Locator => page.getByRole('heading', { name: 'Laboratorio', exact: true });
const exampleButton = (page: Page): Locator => page.getByTestId(LAB_TESTIDS.LAB_FLAKY_GROUP).getByRole('button');

/** Cuenta de la fila del Esquema 5 (la celda `cuenta`). */
const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([['alumno01@sigpro.lab', studentAdmin(TENANT_A)]]);

/**
 * Fija el caos por API ANTES de iniciar sesión (la web lee la configuración al iniciar sesión). Devuelve el motivo si no responde 200.
 * Sirve para partir de un estado previo distinto del de la fila.
 */
const presetChaos = async (flags: { readonly latencyMs: number; readonly errorRate: number; readonly flakyLabels: boolean }): Promise<string | undefined> => {
  const admin = await adminAccess(TENANT_A);
  const preset = await call('PATCH', '/admin/chaos', { tenant: TENANT_A, token: admin, body: flags });
  return preset.status === 200 ? undefined : `PATCH /api/admin/chaos responde ${preset.status}`;
};

/**
 * Respuesta GET de la configuración del caos (`/api/admin/chaos`). El formulario de /lab arranca en 0 (LabPage.tsx, estado inicial) y se
 * rellena cuando llega esta respuesta: escribir antes puede perderse. Devuelve `false` si no llega dentro del techo.
 */
const chaosResponse = (page: Page): Promise<boolean> =>
  page
    .waitForResponse((response) => response.url().includes('/admin/chaos') && response.request().method() === 'GET', { timeout: CEILING_MS })
    .then(
      () => true,
      () => false,
    );

/** Abre /lab como administrador y espera a que llegue la configuración del caos antes de escribir en el formulario. */
const openLabAsAdmin = async (page: Page): Promise<boolean> => {
  const loaded = chaosResponse(page);
  await openLab(page);
  return loaded;
};

/** Recarga /lab como administrador y espera a que vuelva a llegar la configuración guardada. */
const reloadLabAsAdmin = async (page: Page): Promise<boolean> => {
  const loaded = chaosResponse(page);
  await page.reload({ timeout: CEILING_MS });
  await waitUntil(() => isVisible(labHeading(page)));
  return loaded;
};

/** Comprobación de que la recarga volvió a leer la configuración del tenant (sin ella, lo que se lee del formulario no es fiable). */
const reloadCheck = (ok: boolean): Check =>
  check(ok, 'al recargar, /lab vuelve a leer la configuración guardada', ok ? 'al recargar, /lab vuelve a leer la configuración guardada' : 'la configuración no llega tras recargar (no hay respuesta de GET /api/admin/chaos)');

/** Abre /lab (con o sin la sesión que ya hay en la página) y espera a que la pantalla esté montada. */
const openLab = async (page: Page): Promise<void> => {
  await page.goto(`/lab?tenant=${TENANT_A}`, { timeout: CEILING_MS });
  await waitUntil(() => isVisible(labHeading(page)));
};

/** Escribe los controles del modo caos y pulsa «Aplicar caos». Devuelve el diagnóstico del primer paso que no se pueda hacer. */
const applyOnLab = async (page: Page, values: { readonly latency?: string; readonly rate?: string; readonly flaky?: boolean }): Promise<Blocked | undefined> => {
  if (values.latency !== undefined) {
    const latency = values.latency;
    const typed = await interact(latencyBox(page), `escribir ${latency} en «${LATENCY_LABEL}»`, (element) => element.fill(latency, { timeout: CEILING_MS }));
    if (typed) return typed;
  }
  if (values.rate !== undefined) {
    const rate = values.rate;
    const typed = await interact(rateBox(page), `escribir ${rate} en «${RATE_LABEL}»`, (element) => element.fill(rate, { timeout: CEILING_MS }));
    if (typed) return typed;
  }
  if (values.flaky !== undefined) {
    const flaky = values.flaky;
    const set = await interact(flakyBox(page), `dejar «${FLAKY_LABEL}» ${flaky ? 'marcada' : 'sin marcar'}`, (element) => element.setChecked(flaky, { timeout: CEILING_MS }));
    if (set) return set;
  }
  return interact(applyButton(page), `pulsar «${APPLY_TEXT}»`, (element) => element.click({ timeout: CEILING_MS }));
};

/** Valores que se leen de la página tras recargar: espera (con techo) a que lleguen los guardados y devuelve lo que se ve. */
const readSaved = async (page: Page, latency: number, rate: number, flaky: boolean): Promise<{ readonly latency?: string; readonly rate?: string; readonly flaky?: boolean }> => {
  const latencyNow = await waitForValue(() => inputOf(latencyBox(page)), (value) => value !== undefined && Number(value) === latency);
  const rateNow = await waitForValue(() => inputOf(rateBox(page)), (value) => value !== undefined && Number(value) === rate);
  const flakyNow = await waitChecked(flakyBox(page), flaky);
  return { latency: latencyNow, rate: rateNow, flaky: flakyNow };
};

// --- Esquema 1: aplicar guarda la configuración y se conserva al recargar -----------------------------------------------------

const appliesAndKeeps: BrowserRowHandler = async (row, { page }) => {
  const latency = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const flaky = strict('casilla', FLAKY_STATES, cell(row, 'casilla'));
  const expected = `ve el aviso ok «${APPLIED_TOAST}»; al recargar /lab los campos muestran ${latency} y ${rate}, y la casilla queda ${cell(row, 'casilla')}`;
  await prepareTenant(TENANT_A);
  // Estado previo distinto de la fila en TODOS los campos (la casilla, al contrario): así aplicar cambia algo de verdad
  const preset = { latencyMs: 100, errorRate: 0.1, flakyLabels: !flaky };
  const presetError = await presetChaos(preset);
  if (presetError !== undefined) return preparationFailedWeb(expected, `alumno01@sigpro.lab fija un estado previo: ${presetError}`);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  const loaded = await openLabAsAdmin(page);
  if (!loaded) return preparationFailedWeb(expected, 'la configuración del caos no llega a /lab tras abrirlo (no hay respuesta de GET /api/admin/chaos)');
  // El formulario arranca en 0: se espera a que MUESTRE el estado previo (latencia 100, tasa 0.1, casilla del preset) antes de escribir
  const shownLatency = await waitForValue(() => inputOf(latencyBox(page)), (value) => value !== undefined && Number(value) === preset.latencyMs);
  const shownRate = await waitForValue(() => inputOf(rateBox(page)), (value) => value !== undefined && Number(value) === preset.errorRate);
  const shownFlaky = await waitChecked(flakyBox(page), preset.flakyLabels);
  const showsPreset = shownLatency !== undefined && Number(shownLatency) === preset.latencyMs && shownRate !== undefined && Number(shownRate) === preset.errorRate && shownFlaky === preset.flakyLabels;
  if (!showsPreset) {
    return preparationFailedWeb(
      expected,
      `el formulario no muestra el estado previo (latencia ${shownLatency ?? '(no legible)'}, tasa ${shownRate ?? '(no legible)'}, casilla ${shownFlaky === undefined ? '(no legible)' : shownFlaky ? 'marcada' : 'sin marcar'})`,
    );
  }
  await armToasts(page);
  const blocked = await applyOnLab(page, { latency: String(latency), rate: String(rate), flaky });
  if (blocked) return actionFailedOn(page, expected, blocked, labHeading(page));
  const toast = await toastCheck(page, 'ok', APPLIED_TOAST);
  const reloadedOk = await reloadLabAsAdmin(page);
  const saved = await readSaved(page, latency, rate, flaky);
  return rowOutcome([
    toast,
    reloadCheck(reloadedOk),
    numberCheck(saved.latency, latency, 'al recargar, el campo «Latencia máxima (ms)» muestra'),
    numberCheck(saved.rate, rate, 'al recargar, el campo «Tasa de errores 500 en escrituras (0–1)» muestra'),
    check(saved.flaky === flaky, `al recargar, la casilla queda ${cell(row, 'casilla')}`, `al recargar, la casilla queda ${saved.flaky === undefined ? '(no legible)' : saved.flaky ? 'marcada' : 'sin marcar'}`),
  ]);
};

// --- Esquema 2: desactivar caos devuelve los campos a reposo ------------------------------------------------------------------

const offReturnsRest: BrowserRowHandler = async (row, { page }) => {
  const latency = strict('latencia', LATENCIES, cell(row, 'latencia'));
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const flaky = strict('casilla', FLAKY_STATES, cell(row, 'casilla'));
  const expected = `tras «${OFF_TEXT}» ve el aviso ok «${APPLIED_TOAST}»; los campos muestran 0 y 0, y la casilla queda sin marcar`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  if (!(await openLabAsAdmin(page))) return preparationFailedWeb(expected, 'la configuración del caos no llega a /lab tras abrirlo');
  // Preparación: el caos queda aplicado con los valores de la fila (se comprueba el aviso antes de desactivar)
  await armToasts(page);
  const applied = await applyOnLab(page, { latency: String(latency), rate: String(rate), flaky });
  if (applied) return preparationFailedWeb(expected, `no se aplica la configuración previa: ${applied.message}`);
  const prepared = await toastCheck(page, 'ok', APPLIED_TOAST);
  if (!prepared.ok) return preparationFailedWeb(expected, `no aparece el aviso de la configuración previa (${prepared.observed})`);
  await armToasts(page);
  const off = await interact(offButton(page), `pulsar «${OFF_TEXT}»`, (element) => element.click({ timeout: CEILING_MS }));
  if (off) return actionFailed(expected, off);
  const toast = await toastCheck(page, 'ok', APPLIED_TOAST);
  const latencyNow = await waitForValue(() => inputOf(latencyBox(page)), (value) => value !== undefined && Number(value) === 0);
  const rateNow = await waitForValue(() => inputOf(rateBox(page)), (value) => value !== undefined && Number(value) === 0);
  const flakyNow = await waitChecked(flakyBox(page), false);
  return rowOutcome([
    toast,
    numberCheck(latencyNow, 0, 'el campo «Latencia máxima (ms)» muestra'),
    numberCheck(rateNow, 0, 'el campo «Tasa de errores 500 en escrituras (0–1)» muestra'),
    check(flakyNow === false, 'la casilla «Textos de botón variables» queda sin marcar', `la casilla queda ${flakyNow === undefined ? '(no legible)' : flakyNow ? 'marcada' : 'sin marcar'}`),
  ]);
};

// --- Esquema 3: un valor fuera de rango no se guarda --------------------------------------------------------------------------

const outOfRangeNotSaved: BrowserRowHandler = async (row, { page }) => {
  const field = strict('campo', FIELDS, cell(row, 'campo'));
  const value = strict('valor', OUT_OF_RANGE, cell(row, 'valor'));
  const expected = `ve el aviso de error «${ERROR_TITLE}» con la traza de la petición PATCH /api/admin/chaos; al recargar, los campos muestran 0 y 0, y la casilla queda sin marcar`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, studentAdmin(TENANT_A));
  if (login) return preparationFailedWeb(expected, `alumno01@sigpro.lab no inicia sesión: ${login}`);
  if (!(await openLabAsAdmin(page))) return preparationFailedWeb(expected, 'la configuración del caos no llega a /lab tras abrirlo');
  const box = field === LATENCY_LABEL ? latencyBox(page) : rateBox(page);
  await armToasts(page);
  const typed = await interact(box, `escribir ${value} en «${field}»`, (element) => element.fill(value, { timeout: CEILING_MS }));
  if (typed) return actionFailed(expected, typed);
  const pressed = await interact(applyButton(page), `pulsar «${APPLY_TEXT}»`, (element) => element.click({ timeout: CEILING_MS }));
  if (pressed) return actionFailed(expected, pressed);
  const error = await waitToast(page, 'danger', ERROR_TITLE);
  const body = error.found?.body ?? '';
  const reloadedOk = await reloadLabAsAdmin(page);
  const saved = await readSaved(page, 0, 0, false);
  return rowOutcome([
    check(error.found !== undefined, `aviso de error «${ERROR_TITLE}»`, error.found === undefined ? describeLog(error.log) : `aviso de error «${ERROR_TITLE}»`),
    check(
      body.includes('PATCH /api/admin/chaos') && body.includes('422'),
      'con la traza de la petición PATCH /api/admin/chaos y el 422',
      `traza «${body === '' ? '(sin traza)' : body}»`,
    ),
    reloadCheck(reloadedOk),
    numberCheck(saved.latency, 0, 'al recargar, el campo «Latencia máxima (ms)» muestra'),
    numberCheck(saved.rate, 0, 'al recargar, el campo «Tasa de errores 500 en escrituras (0–1)» muestra'),
    check(saved.flaky === false, 'al recargar, la casilla queda sin marcar', `al recargar, la casilla queda ${saved.flaky === undefined ? '(no legible)' : saved.flaky ? 'marcada' : 'sin marcar'}`),
  ]);
};

// --- Esquema 4: sin sesión de admin los controles del modo caos están deshabilitados ------------------------------------------

const controlsNeedAdmin: BrowserRowHandler = async (row, { page }) => {
  const who = strict('sesion', WHO, cell(row, 'sesion'));
  const expected = `los controles del modo caos están deshabilitados, con el motivo «${NEED_ADMIN}»`;
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  if (who !== undefined) {
    const login = await signInWeb(page, who);
    if (login) return preparationFailedWeb(expected, `${cell(row, 'sesion')}: ${login}`);
  }
  await openLab(page);
  return rowOutcome([
    await controlCheck(latencyBox(page), 'el campo «Latencia máxima (ms)»', 'deshabilitado', NEED_ADMIN),
    await controlCheck(rateBox(page), 'el campo «Tasa de errores 500 en escrituras (0–1)»', 'deshabilitado', NEED_ADMIN),
    await controlCheck(flakyBox(page), 'la casilla «Textos de botón variables»', 'deshabilitado', NEED_ADMIN),
    await controlCheck(applyButton(page), 'el botón «Aplicar caos»', 'deshabilitado', NEED_ADMIN),
    await controlCheck(offButton(page), 'el botón «Desactivar caos»', 'deshabilitado', NEED_ADMIN),
  ], { note: TOOLTIP_NOTE });
};

// --- Esquema 5: tras aplicar los textos variables, el botón de ejemplo alterna sin recargar la página --------------------------

const exampleAlternatesAfterApply: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const expected = 'el botón de ejemplo de «Contraejemplos» alterna entre «Guardar» y «Guardar cambios» sin recargar la página';
  await prepareTenant(TENANT_A);
  await prepareBrowser(page);
  const login = await signInWeb(page, account);
  if (login) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${login}`);
  if (!(await openLabAsAdmin(page))) return preparationFailedWeb(expected, 'la configuración del caos no llega a /lab tras abrirlo');
  const applied = await applyOnLab(page, { latency: '0', rate: '0', flaky: true });
  if (applied) return actionFailed(expected, applied);
  const toast = await toastCheck(page, 'ok', APPLIED_TOAST);
  // Se observa sin recargar: dos fases completas (2,5 s cada una) con margen
  const seen = await observeTexts(exampleButton(page), 7_000);
  const alternates = seen.has('Guardar') && seen.has('Guardar cambios');
  return rowOutcome(
    [
      toast,
      check(alternates, expected, `el botón de ejemplo muestra ${describeSeen(seen)} (sin recargar)`),
    ],
    alternates
      ? {}
      : {
          note: 'Inferencia por lectura del código, no observación: LabPage.tsx (applyChaos, líneas 118-122) no vuelve a leer la configuración tras aplicar (solo lo hace ChaosPanel de Administración), así que el botón de ejemplo no cambia sin recargar. La observación de esta fila es solo la lectura del texto durante la ventana.',
        },
  );
};

defineBrowserRows({
  story: 'US-CAOS-RESET-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(appliesAndKeeps)],
    [2, onWeb(offReturnsRest)],
    [3, onWeb(outOfRangeNotSaved)],
    [4, onWeb(controlsNeedAdmin)],
    [5, onWeb(exampleAlternatesAfterApply)],
  ]),
});
