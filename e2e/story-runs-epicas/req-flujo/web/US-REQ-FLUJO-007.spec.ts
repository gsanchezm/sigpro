import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { isVisible, runSteps, safe, waitUntil } from '../../support/browser';
import { cell, check, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, BUTTON_CELLS, COOKIE_NOTE, QUIET_MS, STATE_CELLS, STATE_LABEL, TARGET_OF_BUTTON, TOAST_TOLERANCE_MS, armToasts, detailState, dialogActions, dialogOf, eqCheck, openDetail, openDialog, prepareWeb, press, quietWindow, readFlow, rowLabel, serverStateOf, toastLifeMs, toastLog, verdictWeb, waitOkToast, webPrepFailed } from './common';

/** Lectura de un botón en una sola consulta al elemento: deshabilitado y título salen del mismo instante. */
type ButtonReading = { readonly disabled: boolean; readonly title: string | null };
const readButton = (target: Locator): Promise<ButtonReading | undefined> =>
  safe(() => target.first().evaluate((element) => ({ disabled: (element as HTMLButtonElement).disabled, title: element.getAttribute('title') }), undefined, { timeout: 2000 }), undefined);

// US-REQ-FLUJO-007 — Diálogo de confirmación del cambio de estado (web). «Cancelar» cierra el diálogo y no cambia nada; «Confirmar» pide el paso,
// muestra «Estado actualizado» (3 s) y deja el detalle y la fila del árbol con el estado nuevo; mientras espera la respuesta, «Confirmar» está
// deshabilitado con «Procesando…». Preparación de cada fila: reinicio de alumno01, inicio de sesión en /login?tenant=alumno01 y detalle abierto.

/** Celda «aviso»: el texto exacto del aviso «Estado actualizado». */
const TOAST_BODY_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«REQ-017 → Aprobado»', 'REQ-017 → Aprobado'],
  ['«REQ-001 → Verificado»', 'REQ-001 → Verificado'],
  ['«REQ-002 → Validado»', 'REQ-002 → Validado'],
  ['«REQ-001 → Borrador»', 'REQ-001 → Borrador'],
]);

/** Celda «espera»: el retardo que la prueba da a la respuesta de la API (dato de la historia, en ms). */
const DELAY_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Requisitos y programas de las celdas (los del seed). */
const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
]);
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-002', 'PRG-002'],
  ['PRG-001', 'PRG-001'],
]);

/** Duración de un aviso emergente (la historia y el producto: 3 s). */
const TOAST_MS = 3_000;
const OK_TITLE = 'Estado actualizado';

/** Título y texto del diálogo de cambio de estado, leídos del DOM (exactos). */
const dialogShows = async (page: Page, requirementCode: string, from: string, to: string): Promise<{ readonly title: number; readonly body: number }> => {
  const dialog = dialogOf(page);
  return {
    title: await dialog.getByRole('heading', { name: `Cambiar el estado de ${requirementCode}`, exact: true }).count(),
    body: await dialog.getByText(`${requirementCode} pasará de ${from} a ${to}.`, { exact: true }).count(),
  };
};

/** Estado al que lleva el botón (su texto en la interfaz, p. ej. «Aprobado»). */
const targetLabelOf = (buttonName: string): string => STATE_LABEL.get(TARGET_OF_BUTTON.get(buttonName) ?? '') ?? '(desconocido)';

/** Esquema 1: «Cancelar» cierra el diálogo, el detalle conserva su estado y no aparece «Estado actualizado». */
const cancelKeepsState: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const expectedLabel = cell(row, 'estado');
  const expected = `pulsa ${cell(row, 'boton')} y «Cancelar»: el diálogo se cierra, el detalle sigue en ${expectedLabel} y no aparece «Estado actualizado»`;

  const failure = await prepareWeb(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);
  const premise = await detailState(page);
  if (premise.label !== expectedLabel) return webPrepFailed(expected, `el detalle muestra ${premise.label ?? '(no legible)'} y no ${expectedLabel}`);

  await armToasts(page);
  const dialog = await openDialog(page, buttonName);
  if (dialog.failure !== undefined) return verdictWeb([check(false, expected, dialog.failure)]);
  const shows = await dialogShows(page, requirementCode, expectedLabel, targetLabelOf(buttonName));
  const actions = await dialogActions(page);
  const cancelFailure = await press(dialogOf(page).getByRole('button', { name: 'Cancelar', exact: true }), 'pulsar «Cancelar» en el diálogo');
  if (cancelFailure !== undefined) return verdictWeb([check(false, expected, cancelFailure)]);
  const closed = await waitUntil(async () => !(await isVisible(dialogOf(page))));
  await quietWindow();

  const after = await detailState(page);
  const toasts = await toastLog(page);
  const okShown = toasts === undefined ? undefined : toasts.some((entry) => entry.tone === 'ok' && entry.title === OK_TITLE);
  const server = await serverStateOf(requirementCode);

  return verdictWeb([
    check(dialog.shown, `se abre el diálogo «Cambiar el estado de ${requirementCode}»`, dialog.shown ? 'se abre el diálogo' : 'no se abre el diálogo'),
    check(shows.title === 1 && shows.body === 1, `el diálogo dice «${requirementCode} pasará de ${expectedLabel} a ${targetLabelOf(buttonName)}.»`, shows.title === 1 && shows.body === 1 ? 'el diálogo dice el título y el texto de la historia' : `título ${shows.title} y texto ${shows.body} encontrados`),
    check(actions.cancel === 1 && actions.confirm === 1, 'el diálogo tiene «Cancelar» y «Confirmar»', `«Cancelar»: ${actions.cancel} y «Confirmar»: ${actions.confirm} en el diálogo`),
    check(closed.reached, 'el diálogo se cierra', closed.reached ? 'el diálogo se cierra' : 'el diálogo sigue abierto'),
    eqCheck('el detalle sigue mostrando', after.label, expectedLabel),
    check(okShown === false, `no aparece el aviso «${OK_TITLE}»`, okShown === undefined ? 'el registro de avisos no se puede leer' : okShown ? `aparece el aviso «${OK_TITLE}»` : `ningún aviso «${OK_TITLE}» tras ${QUIET_MS / 1000} s de observación`),
    check(server === expectedState, `la API sigue en ${expectedState}`, `la API devuelve ${server ?? '(sin estado)'}`),
  ], `${COOKIE_NOTE} Ventana de observación de ${QUIET_MS / 1000} s (mayor que los 3 s del aviso).`);
};

/** Esquema 2: «Confirmar» aplica el paso: aviso «Estado actualizado» (3 s), detalle y fila del árbol con el estado nuevo, y la API lo confirma. */
const confirmApplies: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const toastBody = strict('aviso', TOAST_BODY_CELLS, cell(row, 'aviso'));
  const newState = strict('nuevo', STATE_CELLS, cell(row, 'nuevo'));
  const expected = `pulsa ${cell(row, 'boton')} y «Confirmar»: aparece «Estado actualizado» con ${cell(row, 'aviso')}; el detalle y la fila muestran ${cell(row, 'nuevo')}`;

  const failure = await prepareWeb(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);
  const premise = await detailState(page);
  if (premise.label !== STATE_LABEL.get(expectedState)) return webPrepFailed(expected, `el detalle muestra ${premise.label ?? '(no legible)'} y no ${STATE_LABEL.get(expectedState) ?? expectedState}`);

  await armToasts(page);
  const dialog = await openDialog(page, buttonName);
  if (dialog.failure !== undefined) return verdictWeb([check(false, expected, dialog.failure)]);
  const shows = await dialogShows(page, requirementCode, cell(row, 'estado'), targetLabelOf(buttonName));
  const actions = await dialogActions(page);
  const confirmFailure = await press(dialogOf(page).getByRole('button', { name: 'Confirmar', exact: true }), 'pulsar «Confirmar» en el diálogo');
  if (confirmFailure !== undefined) return verdictWeb([check(false, expected, confirmFailure)]);
  const toast = await waitOkToast(page, OK_TITLE, toastBody);
  const life = toast.at === undefined ? undefined : await toastLifeMs(page, toast.at, toastBody);
  const closed = await waitUntil(async () => !(await isVisible(dialogOf(page))));
  const detailNew = await waitUntil(async () => (await detailState(page)).label === STATE_LABEL.get(newState));
  const rowNew = await waitUntil(async () => (await rowLabel(page, requirementCode)) === STATE_LABEL.get(newState));
  const detailAfter = await detailState(page);
  const rowAfter = await rowLabel(page, requirementCode);
  const flowAfter = await readFlow(page);
  const flowCurrent = flowAfter.filter((step) => step.status === 'current').map((step) => step.state);
  const server = await serverStateOf(requirementCode);

  return verdictWeb(
    [
      check(dialog.shown, `se abre el diálogo «Cambiar el estado de ${requirementCode}»`, dialog.shown ? 'se abre el diálogo' : 'no se abre el diálogo'),
      check(shows.title === 1 && shows.body === 1, `el diálogo dice «${requirementCode} pasará de ${cell(row, 'estado')} a ${targetLabelOf(buttonName)}.»`, shows.title === 1 && shows.body === 1 ? 'el diálogo dice el título y el texto de la historia' : `título ${shows.title} y texto ${shows.body} encontrados`),
      check(actions.cancel === 1 && actions.confirm === 1, 'el diálogo tiene «Cancelar» y «Confirmar»', `«Cancelar»: ${actions.cancel} y «Confirmar»: ${actions.confirm} en el diálogo`),
      check(toast.found, `ve «${OK_TITLE}» con «${toastBody}»`, toast.observed),
      check(
        life !== undefined && Math.abs(life - TOAST_MS) <= TOAST_TOLERANCE_MS,
        `el aviso se cierra solo a los ${TOAST_MS / 1000} s (tolerancia de 0,5 s)`,
        life === undefined ? 'el aviso no se cierra en el plazo de observación' : `el aviso se cierra a los ${life} ms desde que aparece`,
      ),
      check(closed.reached, 'la confirmación se cierra', closed.reached ? 'la confirmación se cierra' : 'la confirmación sigue abierta'),
      eqCheck('el detalle muestra', detailAfter.label, STATE_LABEL.get(newState) ?? newState),
      check(rowNew.reached && rowAfter === STATE_LABEL.get(newState), `la fila de ${requirementCode} en el árbol muestra ${cell(row, 'nuevo')}`, `la fila de ${requirementCode} en el árbol muestra ${rowAfter ?? '(no legible)'}`),
      check(flowCurrent.length === 1 && flowCurrent[0] === newState, `el flujo pasa al paso de ${cell(row, 'nuevo')}`, `el paso actual del flujo es ${flowCurrent.length === 1 ? (STATE_LABEL.get(flowCurrent[0] ?? '') ?? flowCurrent[0]) : '(ninguno o varios)'}`),
      check(server === newState && detailNew.reached, `la API devuelve ${newState}`, `la API devuelve ${server ?? '(sin estado)'}`),
    ],
    `${COOKIE_NOTE} El aviso se mide desde su aparición hasta que desaparece; la tolerancia de la prueba es de 0,5 s sobre los 3 s del producto.`,
  );
};

/** Esquema 3: mientras se espera la respuesta, «Confirmar» está deshabilitado con «Procesando…»; al llegar, aparece el aviso. */
const busyWhileWaiting: BrowserRowHandler = async (row, { page }) => {
  const delayMs = strict('espera', DELAY_CELLS, cell(row, 'espera'));
  const expected = `durante la espera «Confirmar» está deshabilitado con la explicación «Procesando…»; al llegar la respuesta aparece «${OK_TITLE}» con «REQ-017 → Aprobado»`;

  const failure = await prepareWeb(page, strict('cuenta', ACCOUNT_CELLS, 'gestor@sigpro.test'));
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, 'PRG-002', 'REQ-017');
  if (opened !== undefined) return webPrepFailed(expected, opened);
  const premise = await detailState(page);
  if (premise.label !== 'Borrador') return webPrepFailed(expected, `el detalle muestra ${premise.label ?? '(no legible)'} y no Borrador`);

  // La prueba retrasa solo la petición POST del paso; el OPTIONS de CORS pasa sin demora.
  let hits = 0;
  let released = false;
  const delayed = await runSteps([
    [
      `retrasar ${cell(row, 'espera')} la respuesta de POST /api/requirements/REQ-017/transition`,
      () =>
        page.route('**/api/requirements/REQ-017/transition', async (route) => {
          if (route.request().method() !== 'POST') return route.continue();
          hits += 1;
          await sleep(delayMs);
          released = true;
          return route.continue();
        }),
    ],
  ]);
  if (delayed !== undefined) return webPrepFailed(expected, delayed);

  await armToasts(page);
  const dialog = await openDialog(page, 'Aprobar');
  if (dialog.failure !== undefined) return verdictWeb([check(false, expected, dialog.failure)]);
  const confirmButton = dialogOf(page).getByRole('button', { name: 'Confirmar', exact: true });
  const confirmFailure = await press(confirmButton, 'pulsar «Confirmar» en el diálogo');
  if (confirmFailure !== undefined) return verdictWeb([check(false, expected, confirmFailure)]);

  // Lectura atómica: el estado deshabilitado y el título salen de la misma consulta; se guarda la última que se cumplió.
  const busyRead: { current?: ButtonReading } = {};
  const busy = await waitUntil(async () => {
    busyRead.current = await readButton(confirmButton);
    return busyRead.current !== undefined && busyRead.current.disabled && busyRead.current.title === 'Procesando…';
  }, 5_000);
  const beforeRelease = !released;
  const toast = await waitOkToast(page, OK_TITLE, 'REQ-017 → Aprobado');
  const persisted = await serverStateOf('REQ-017');

  return verdictWeb([
    check(busy.reached && busyRead.current?.disabled === true, '«Confirmar» está deshabilitado mientras espera', busy.reached ? '«Confirmar» está deshabilitado mientras espera' : '«Confirmar» no se deshabilita mientras espera'),
    check(busyRead.current?.title === 'Procesando…', 'con la explicación «Procesando…»', `con la explicación «${busyRead.current?.title ?? '(ninguna)'}»`),
    check(beforeRelease, 'la lectura se hace antes de que llegue la respuesta', beforeRelease ? 'la lectura se hace antes de que llegue la respuesta' : 'la respuesta ya había llegado'),
    check(hits === 1, 'se envía una sola petición de transición', `se envían ${hits} peticiones de transición`),
    check(toast.found, `al llegar la respuesta aparece «${OK_TITLE}» con «REQ-017 → Aprobado»`, toast.observed),
    check(persisted === 'approved', 'la API devuelve approved', `la API devuelve ${persisted ?? '(sin estado)'}`),
  ], `${COOKIE_NOTE} La demora de la respuesta la pone la prueba: retiene la petición POST antes de reenviarla al servidor; la app no tarda así.`);
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, cancelKeepsState],
    [2, confirmApplies],
    [3, busyWhileWaiting],
  ]),
});
