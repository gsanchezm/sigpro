import type { Page } from '@playwright/test';
import { ACTION, CEILING_MS, attrOf, safe, waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_ALUMNO01, TENANT_A, resetTenants } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import {
  actionMissing,
  armToasts,
  conclude,
  describeToasts,
  interceptApi,
  kpiCheck,
  normalized,
  onWeb,
  openMission,
  prepFailed,
  prepFailedReason,
  readPanel,
  runSteps,
  signIn,
  TICK_PATH,
  toastLifetime,
  toastShown,
  toastsAfterWindow,
  traceDependent,
  waitKpisShown,
  type Mode,
} from './common';

// US-MISION-KPI-009 — Botón «Simular evento» del panel de misión en la web: solo lo pulsa el administrador (escritorio 1440 px).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la cuenta de la fila entra desde
// /login?tenant=alumno01 y abre /mission. La respuesta de la emisión la provoca la prueba en la ruta de la API: el 200 es la emisión
// real, retrasada 1,5 s para poder leer el botón ocupado; el 503 se fabrica tras la misma demora. El motivo de un botón deshabilitado se
// lee de su atributo `title` (el tooltip nativo del navegador no es observable aquí).

/** Demora de la respuesta de la emisión: da tiempo a leer el botón ocupado (la historia no fija el plazo). */
const BUSY_MS = 1_500;

/** Cuenta de la celda `cuenta` → correo (la contraseña sale de la celda). */
const ACCOUNT_EMAILS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01@sigpro.lab', ADMIN_ALUMNO01.email],
  ['gestor@sigpro.test', DEMO.gestor.email],
  ['auditor@sigpro.test', DEMO.auditor.email],
]);

/** Estado del botón de la celda: habilitado, o deshabilitado con su motivo. */
const BUTTON_STATES: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map<string, { readonly enabled: boolean; readonly reason?: string }>([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado y, al pasar el puntero sobre él, muestra «Solo admin puede emitir eventos de prueba»', { enabled: false, reason: 'Solo admin puede emitir eventos de prueba' }],
]);

/** Respuesta de la emisión de la celda (Esquema 2): 200 real, o 503 provocado por la prueba; las dos llegan tras la demora. */
const RESPONSES: ReadonlyMap<string, Mode> = new Map<string, Mode>([
  ['200', { kind: 'delay', ms: BUSY_MS }],
  ['503', { kind: 'delayHttp', ms: BUSY_MS, status: 503 }],
]);

/** Resultado esperado de la celda `resultado` (Esquema 2): el botón vuelve a estar habilitado y no hay error, o aparece el aviso de error. */
const RESULT_OF_CELL: ReadonlyMap<string, 'ok' | 'error'> = new Map<string, 'ok' | 'error'>([
  ['el botón vuelve a estar habilitado y no aparece ningún aviso de error', 'ok'],
  ['aparece el aviso «Ha ocurrido un error inesperado» con la traza de la respuesta, que empieza por «POST /api/mission/tick → 503», y el botón vuelve a estar habilitado', 'error'],
]);

const SIMULATE = 'Simular evento';
const ERROR_TITLE = 'Ha ocurrido un error inesperado';
const CARDS = [
  { id: 'programs', label: 'Programas activos', value: '12' },
  { id: 'milestones', label: 'Hitos cumplidos', value: '49 %' },
  { id: 'nc', label: 'NC abiertas', value: '8' },
  { id: 'verification', label: 'Verificación superada', value: '56 %' },
] as const;

/** Botón «Simular evento» por su rol y su nombre accesible (el texto visible). */
const buttonOf = (page: Page) => page.getByRole('button', { name: SIMULATE, exact: true });

/** Estado efectivo del botón: habilitado (propiedad del elemento), motivo (atributo `title`) y ocupado (`aria-busy`). */
const readButton = async (page: Page): Promise<{ readonly enabled: boolean | undefined; readonly title: string | undefined; readonly busy: string | undefined }> => {
  const button = buttonOf(page);
  const disabled = await safe(() => button.isDisabled({ timeout: 2_000 }), undefined);
  return { enabled: disabled === undefined ? undefined : !disabled, title: await attrOf(button, 'title'), busy: await attrOf(button, 'aria-busy') };
};

/** Cuatro tarjetas con sus cifras de la historia (12, 49 %, 8 y 56 %). */
const cardsStill = (view: Awaited<ReturnType<typeof readPanel>>): Check[] => CARDS.map((card) => kpiCheck(view, card.id, card.label, card.value));

// --- Esquema 1: solo el administrador puede pulsar el botón -------------------------------------------------------------------

const onlyAdminButton: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const state = strict('estado', BUTTON_STATES, cell(row, 'estado'));
  const email = strict('cuenta', ACCOUNT_EMAILS, cell(row, 'cuenta'));
  const expected = `el botón «${SIMULATE}» ${cell(row, 'estado')}`;
  const opened = await signIn(page, { email, password: cell(row, 'contraseña') });
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  if (!state.enabled) {
    const hovered = await runSteps([[`pasar el puntero sobre «${SIMULATE}»`, () => buttonOf(page).hover({ timeout: 2_000 })]]);
    if (hovered) return actionMissing(expected, hovered);
  }
  const reading = await readButton(page);
  const enabledCheck = check(
    reading.enabled === true && reading.title === undefined,
    `el botón «${SIMULATE}» está habilitado`,
    `el botón «${SIMULATE}» ${reading.enabled === undefined ? '(sin leer)' : reading.enabled ? 'está habilitado' : 'está deshabilitado'}${reading.title === undefined ? '' : `, con el motivo «${reading.title}»`}`,
  );
  const disabledCheck = check(
    reading.enabled === false && reading.title === state.reason,
    `el botón «${SIMULATE}» está deshabilitado con el motivo «${state.reason ?? ''}»`,
    `el botón «${SIMULATE}» ${reading.enabled === undefined ? '(sin leer)' : reading.enabled ? 'está habilitado' : 'está deshabilitado'}, con el motivo «${reading.title ?? '(sin atributo title)'}»`,
  );
  return conclude([state.enabled ? enabledCheck : disabledCheck], {
    note: 'El motivo se lee del atributo title del botón (el tooltip nativo del navegador no se ve en la prueba).',
  });
});

// --- Esquema 2: pulsar el botón emite un evento y no cambia las cifras ---------------------------------------------------------

const afterSimulate: BrowserRowHandler = onWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const mode = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const result = strict('resultado', RESULT_OF_CELL, cell(row, 'resultado'));
  if ((result === 'ok') !== (mode.kind === 'delay')) throw new Error('la celda resultado no corresponde a la respuesta de la misma fila');
  const expected = `pulsar «${SIMULATE}» con la respuesta de la emisión ${cell(row, 'respuesta')}: ${cell(row, 'resultado')}; las cuatro tarjetas siguen mostrando 12, 49 %, 8 y 56 %`;
  const opened = await signIn(page, ADMIN_ALUMNO01);
  if (opened) return prepFailed(expected, opened);
  const failed = await openMission(page);
  if (failed) return prepFailed(expected, failed);
  await waitKpisShown(page);
  const before = await readPanel(page);
  const tick = await interceptApi(page, 'POST', TICK_PATH, mode);
  const replied = page
    .waitForResponse((response) => new URL(response.url()).pathname === TICK_PATH && response.request().method() === 'POST', { timeout: CEILING_MS })
    .then((response) => response.status(), () => undefined);
  if (!(await armToasts(page))) return prepFailedReason(expected, 'el registro de avisos no está armado (no se puede afirmar lo que aparece)');
  const clickAt = Date.now();
  const clicked = await runSteps([[`pulsar «${SIMULATE}»`, () => buttonOf(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  // Regla: mientras la petición está en curso, el botón está ocupado y deshabilitado (la prueba la retrasa para poder leerlo)
  await waitUntil(async () => (await readButton(page)).enabled === false, BUSY_MS);
  const busy = await readButton(page);
  const status = await replied;
  await waitUntil(async () => (await readButton(page)).enabled === true, CEILING_MS);
  const reading = await readButton(page);
  const view = await readPanel(page);
  const busyCheck = check(
    busy.enabled === false && busy.busy === 'true',
    'mientras la petición está en curso, el botón está ocupado (aria-busy «true») y deshabilitado',
    `mientras tanto: ${busy.enabled === undefined ? '(sin leer)' : busy.enabled ? 'habilitado' : 'deshabilitado'}, aria-busy «${busy.busy ?? '(sin atributo)'}»`,
  );
  const statusCheck = check(status === Number(cell(row, 'respuesta')), `la respuesta de la emisión es ${cell(row, 'respuesta')}`, `la respuesta de la emisión es ${status ?? '(sin respuesta)'}`);
  const enabled = check(reading.enabled === true, `el botón «${SIMULATE}» vuelve a estar habilitado`, `el botón está ${reading.enabled === undefined ? '(sin leer)' : reading.enabled ? 'habilitado' : 'deshabilitado'}`);
  // Regla: pulsar el botón no cambia las cuatro tarjetas ni las gráficas
  const chartsStill = check(
    before !== undefined && view !== undefined && before.milestones.text === view.milestones.text && before.nc.text === view.nc.text,
    'pulsar el botón no cambia las gráficas',
    before === undefined || view === undefined ? 'las gráficas no se pudieron leer' : before.milestones.text === view.milestones.text && before.nc.text === view.nc.text ? 'las gráficas siguen igual' : 'las gráficas cambiaron',
  );
  const evidence = { peticiones: tick.log() };
  if (mode.kind === 'delay' && result === 'ok') {
    // Un aviso de error es un aviso `danger`; un aviso de éxito queda en la evidencia y no cuenta aquí
    const log = await toastsAfterWindow(page, clickAt);
    const errors = log?.filter((entry) => entry.tone === 'danger');
    const quiet = check(
      errors !== undefined && errors.length === 0,
      'no aparece ningún aviso de error',
      errors === undefined ? 'el registro de avisos no se pudo leer' : errors.length === 0 ? 'ningún aviso de error' : `aparece ${errors.map((entry) => `«${entry.title}»`).join(', ')}`,
    );
    return conclude([statusCheck, busyCheck, enabled, quiet, chartsStill, ...cardsStill(view)], {
      note: 'La emisión no cambia las cifras; el evento que llega al feed de la misión (EP-MISION-FEED) no se comprueba aquí, y la conexión en tiempo real tampoco.',
      evidence: { ...evidence, avisos: describeToasts(log) },
    });
  }
  const shown = await toastShown(page, 'danger', ERROR_TITLE);
  const titleCheck = check(shown.seen, `aparece el aviso «${ERROR_TITLE}»`, shown.readable ? `avisos: ${shown.observed}` : 'el registro de avisos no se pudo leer');
  const trace = normalized(shown.entry?.body);
  const traceCheck = check(trace?.startsWith('POST /api/mission/tick → 503') === true, 'la traza empieza por «POST /api/mission/tick → 503»', `la traza es «${trace ?? '(sin leer)'}»`);
  // Regla: el aviso de error se cierra solo a los 3 segundos (se mide su vida en el documento; la tolerancia de la prueba es de ±1 s)
  const life = await toastLifetime(page, 'danger', ERROR_TITLE);
  const lifeCheck = check(
    life.lifetimeMs !== undefined && life.lifetimeMs >= 2_500 && life.lifetimeMs <= 4_000,
    'el aviso de error se cierra solo a los 3 segundos',
    life.observed,
  );
  return traceDependent(expected, [statusCheck, busyCheck, titleCheck, enabled, chartsStill, lifeCheck, ...cardsStill(view)], traceCheck, { ...evidence, trazaObservada: trace ?? '(sin leer)', duracionAviso: life.observed });
});

defineBrowserRows({
  story: 'US-MISION-KPI-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onlyAdminButton],
    [2, afterSimulate],
  ]),
});

