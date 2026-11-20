import { ACTION, CEILING_MS, waitUntil } from '../../support/browser';
import { cell, check, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ADMIN_ALUMNO01, TENANT_A, resetTenants } from '../api/common';
import { DEMO } from '../../../story-runs/support/prepare';
import { TICK_PATH, actionMissing, conclude, armToasts, describeToasts, interceptApi, kpiCheck, normalized, prepFailed, prepFailedReason, runSteps, toastLifetime, toastShown, toastsAfterWindow, traceDependent, type Mode } from '../web/common';
import { EMIT_LABEL, onExpoWeb, openMissionTab, readMobilePanel, readSimulate, signInTo, simulateStateCheck, waitMobileKpisShown, type SimulateReading } from './common';

// US-MISION-KPI-012 — Botón «Emitir evento de prueba» del panel de misión en la app móvil (web de Expo a 390 px; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 con el token de su administrador; la app se abre sin sesión, se escribe alumno01 en
// «Tenant de trabajo», la cuenta de la fila inicia sesión y se abre la pestaña «Misión». La respuesta de la emisión (200 real o 503
// provocado por la prueba) va por la ruta de la API, tras una demora de 1,5 s para poder leer el botón ocupado.

const ADMIN_ONLY = 'Solo admin puede emitir eventos de prueba';
const ERROR_TITLE = 'Ha ocurrido un error inesperado';
const OK_TITLE = 'Evento emitido';
/** Demora de la respuesta de la emisión: da tiempo a leer el botón ocupado (la historia no fija el plazo). */
const BUSY_MS = 1_500;
const CARDS = [
  { id: 'programs', label: 'Programas activos', value: '12' },
  { id: 'milestones', label: 'Hitos cumplidos', value: '49 %' },
  { id: 'nc', label: 'NC abiertas', value: '8' },
  { id: 'verification', label: 'Verificación superada', value: '56 %' },
] as const;

/** Cuenta de la celda `cuenta` → correo del seed (la contraseña sale de la celda). */
const ACCOUNT_EMAILS: ReadonlyMap<string, string> = new Map<string, string>([
  ['alumno01@sigpro.lab', ADMIN_ALUMNO01.email],
  ['gestor@sigpro.test', DEMO.gestor.email],
  ['auditor@sigpro.test', DEMO.auditor.email],
]);

/** Estado del botón de la celda: habilitado, o deshabilitado con el motivo debajo. */
const BUTTON_STATES: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map<string, { readonly enabled: boolean; readonly reason?: string }>([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado y debajo se lee «Solo admin puede emitir eventos de prueba»', { enabled: false, reason: ADMIN_ONLY }],
]);

/** Respuesta de la emisión de la celda (Esquema 2): 200 real o 503 provocado; las dos llegan tras la demora. */
const RESPONSES: ReadonlyMap<string, Mode> = new Map<string, Mode>([
  ['200', { kind: 'delay', ms: BUSY_MS }],
  ['503', { kind: 'delayHttp', ms: BUSY_MS, status: 503 }],
]);

/** Resultado esperado de la celda `resultado` (Esquema 2): aviso de éxito, o aviso de error. */
const RESULT_OF_CELL: ReadonlyMap<string, 'ok' | 'error'> = new Map<string, 'ok' | 'error'>([
  ['aparece el aviso «Evento emitido» y el botón vuelve a estar habilitado', 'ok'],
  ['aparece el aviso «Ha ocurrido un error inesperado» con la traza de la respuesta, que empieza por «POST /api/mission/tick → 503», y el botón vuelve a estar habilitado', 'error'],
]);

// --- Esquema 1: solo el administrador puede pulsar el botón --------------------------------------------------------------------

const onlyAdminButton: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const state = strict('estado', BUTTON_STATES, cell(row, 'estado'));
  const email = strict('cuenta', ACCOUNT_EMAILS, cell(row, 'cuenta'));
  const expected = `el botón «${EMIT_LABEL}» ${cell(row, 'estado')}`;
  const opened = await signInTo(page, { email, password: cell(row, 'contraseña') });
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitMobileKpisShown(page);
  const reading = await readSimulate(page);
  return conclude([simulateStateCheck(reading, state.enabled, state.reason, EMIT_LABEL)]);
});

// --- Esquema 2: la respuesta de la emisión se muestra como aviso ---------------------------------------------------------------

const afterEmit: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const mode = strict('respuesta', RESPONSES, cell(row, 'respuesta'));
  const result = strict('resultado', RESULT_OF_CELL, cell(row, 'resultado'));
  if ((result === 'ok') !== (mode.kind === 'delay')) throw new Error('la celda resultado no corresponde a la respuesta de la misma fila');
  const expected = `pulsar «${EMIT_LABEL}» con la respuesta de la emisión ${cell(row, 'respuesta')}: ${cell(row, 'resultado')}; las cuatro tarjetas siguen mostrando 12, 49 %, 8 y 56 %`;
  const opened = await signInTo(page, ADMIN_ALUMNO01);
  if (opened) return prepFailed(expected, opened);
  const tab = await openMissionTab(page);
  if (tab) return prepFailed(expected, tab);
  await waitMobileKpisShown(page);
  const before = await readMobilePanel(page);
  const tick = await interceptApi(page, 'POST', TICK_PATH, mode);
  const replied = page
    .waitForResponse((response) => new URL(response.url()).pathname === TICK_PATH && response.request().method() === 'POST', { timeout: CEILING_MS })
    .then((response) => response.status(), () => undefined);
  if (!(await armToasts(page))) return prepFailedReason(expected, 'el registro de avisos no está armado (no se puede afirmar lo que aparece)');
  const clickAt = Date.now();
  const clicked = await runSteps([[`pulsar «${EMIT_LABEL}»`, () => page.getByRole('button', { name: EMIT_LABEL, exact: true }).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  // Regla: mientras la emisión está en curso, el botón está ocupado y deshabilitado
  await waitUntil(async () => (await readSimulate(page))?.enabled === false, BUSY_MS);
  const busy: SimulateReading | undefined = await readSimulate(page);
  const status = await replied;
  await waitUntil(async () => (await readSimulate(page))?.enabled === true, CEILING_MS);
  const reading = await readSimulate(page);
  const view = await readMobilePanel(page);
  const statusCheck = check(status === Number(cell(row, 'respuesta')), `la respuesta de la emisión es ${cell(row, 'respuesta')}`, `la respuesta de la emisión es ${status ?? '(sin respuesta)'}`);
  const enabled = check(reading?.enabled === true, `el botón «${EMIT_LABEL}» vuelve a estar habilitado`, `el botón está ${reading?.enabled === undefined ? '(sin leer)' : reading.enabled ? 'habilitado' : 'deshabilitado'}`);
  const busyCheck = check(
    busy?.enabled === false && busy.busy === 'true',
    'mientras la emisión está en curso, el botón está ocupado (aria-busy «true») y deshabilitado',
    `mientras tanto: ${busy?.enabled === undefined ? '(sin leer)' : busy.enabled ? 'habilitado' : 'deshabilitado'}, aria-busy «${busy?.busy ?? '(sin atributo)'}»`,
  );
  const cards = CARDS.map((card) => kpiCheck(view, card.id, card.label, card.value));
  // Regla: pulsar el botón no cambia las tarjetas ni las gráficas
  const chartsStill = check(
    before !== undefined && view !== undefined && before.milestones.text === view.milestones.text && before.nc.text === view.nc.text,
    'pulsar el botón no cambia las gráficas',
    before === undefined || view === undefined ? 'las gráficas no se pudieron leer' : before.milestones.text === view.milestones.text && before.nc.text === view.nc.text ? 'las gráficas siguen igual' : 'las gráficas cambiaron',
  );
  const note = 'La emisión no cambia las cifras; el evento que llega al feed de la misión (EP-MISION-FEED) no se comprueba aquí, y la conexión en tiempo real tampoco.';
  if (mode.kind === 'delay' && result === 'ok') {
    const shown = await toastShown(page, 'ok', OK_TITLE);
    const okToast = check(shown.seen, `aparece el aviso «${OK_TITLE}»`, shown.readable ? `avisos: ${shown.observed}` : 'el registro de avisos no se pudo leer');
    const life = await toastLifetime(page, 'ok', OK_TITLE);
    const lifeCheck = check(life.lifetimeMs !== undefined && life.lifetimeMs >= 2_500 && life.lifetimeMs <= 4_000, 'el aviso de éxito se cierra solo a los 3 segundos', life.observed);
    const log = await toastsAfterWindow(page, clickAt);
    return conclude([okToast, enabled, statusCheck, busyCheck, chartsStill, lifeCheck, ...cards], {
      note,
      evidence: { peticiones: tick.log(), avisos: describeToasts(log) },
    });
  }
  const shown = await toastShown(page, 'danger', ERROR_TITLE);
  const titleCheck = check(shown.seen, `aparece el aviso «${ERROR_TITLE}»`, shown.readable ? `avisos: ${shown.observed}` : 'el registro de avisos no se pudo leer');
  const trace = normalized(shown.entry?.body);
  const traceCheck = check(trace?.startsWith('POST /api/mission/tick → 503') === true, 'la traza empieza por «POST /api/mission/tick → 503»', `la traza es «${trace ?? '(sin leer)'}»`);
  const life = await toastLifetime(page, 'danger', ERROR_TITLE);
  const lifeCheck = check(life.lifetimeMs !== undefined && life.lifetimeMs >= 2_500 && life.lifetimeMs <= 4_000, 'el aviso de error se cierra solo a los 3 segundos', life.observed);
  return traceDependent(expected, [titleCheck, enabled, statusCheck, busyCheck, chartsStill, lifeCheck, ...cards], traceCheck, {
    peticiones: tick.log(),
    trazaObservada: trace ?? '(sin leer)',
    duracionAviso: life.observed,
  });
});

defineBrowserRows({
  story: 'US-MISION-KPI-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onlyAdminButton],
    [2, afterEmit],
  ]),
});
