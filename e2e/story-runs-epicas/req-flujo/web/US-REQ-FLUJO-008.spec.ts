import { TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { isVisible, waitUntil } from '../../support/browser';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { adminToken, stateOf, transition } from '../api/common';
import { ACCOUNT_CELLS, BUTTON_CELLS, COOKIE_NOTE, STATE_CELLS, STATE_LABEL, armToasts, dialogOf, detailState, openDetail, openDialog, prepareWeb, press, quietWindow, serverStateOf, toastLog, verdictWeb, webPrepFailed } from './common';

// US-REQ-FLUJO-008 — Un paso que el servidor rechaza deja el diálogo abierto con un aviso de error y el estado sin cambiar (web). El caso se
// produce cuando el detalle muestra un estado que el servidor ya no tiene: otra cuenta (alumno01, por la API) cambia el requisito después de
// abrirlo. Preparación: reinicio de alumno01, inicio de sesión en la web, detalle abierto y cambio por la API en un paso válido.

/** Requisitos y programas de las celdas (los del seed). */
const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
]);
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-002', 'PRG-002'],
  ['PRG-001', 'PRG-001'],
]);

const OK_TITLE = 'Estado actualizado';

/** Esquema 1: el servidor rechaza el paso; el diálogo sigue abierto con el error, sin «Estado actualizado»; la API conserva su estado. */
const serverRejects: BrowserRowHandler = async (row, { page }) => {
  const account: Credentials = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const shownState = strict('estado_mostrado', STATE_CELLS, cell(row, 'estado_mostrado'));
  const serverState = strict('estado_servidor', STATE_CELLS, cell(row, 'estado_servidor'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const expected = `pulsa ${cell(row, 'boton')} y «Confirmar»: aparece un aviso de error dentro del diálogo, el diálogo sigue abierto, no aparece «${OK_TITLE}» y la API devuelve ${cell(row, 'estado_servidor')}`;

  const failure = await prepareWeb(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);
  const premise = await detailState(page);
  if (premise.label !== STATE_LABEL.get(shownState)) return webPrepFailed(expected, `el detalle muestra ${premise.label ?? '(no legible)'} y no ${STATE_LABEL.get(shownState) ?? shownState}`);

  // alumno01 cambia el requisito con la API, en un paso válido, después de que el detalle se abriera.
  const changed = await transition(requirementCode, TENANT_A, await adminToken(TENANT_A), { to: serverState });
  if (changed.status !== 200 || stateOf(changed) !== serverState) return preparationFailed(expected, `alumno01 cambia ${requirementCode} a ${serverState} con la API`, changed);
  // Justo antes de pulsar, el detalle debe seguir mostrando el estado de partida (sin refresco propio).
  const stillShown = await detailState(page);
  if (stillShown.label !== cell(row, 'estado_mostrado')) return webPrepFailed(expected, `el detalle cambió solo a ${stillShown.label ?? '(no legible)'} antes de pulsar`);

  await armToasts(page);
  const dialog = await openDialog(page, buttonName);
  if (dialog.failure !== undefined) return verdictWeb([check(false, expected, dialog.failure)]);
  const confirmFailure = await press(dialogOf(page).getByRole('button', { name: 'Confirmar', exact: true }), 'pulsar «Confirmar» en el diálogo');
  if (confirmFailure !== undefined) return verdictWeb([check(false, expected, confirmFailure)]);

  const alert = await waitUntil(() => isVisible(dialogOf(page).getByRole('alert')));
  // Tras ver el error se espera la ventana de observación: un «Estado actualizado» tardío tendría tiempo de aparecer.
  await quietWindow();
  const stillOpen = await isVisible(dialogOf(page));
  const toasts = await toastLog(page);
  const okShown = toasts === undefined ? undefined : toasts.some((entry) => entry.tone === 'ok' && entry.title === OK_TITLE);
  const server = await serverStateOf(requirementCode);

  return verdictWeb(
    [
      check(alert.reached, 'aparece dentro del diálogo un aviso de error', alert.reached ? 'aparece dentro del diálogo un aviso de error' : 'no aparece un aviso de error en el diálogo'),
      check(stillOpen, 'el diálogo sigue abierto', stillOpen ? 'el diálogo sigue abierto' : 'el diálogo se cierra'),
      check(okShown === false, `no aparece el aviso «${OK_TITLE}»`, okShown === undefined ? 'el registro de avisos no se puede leer' : okShown ? `aparece el aviso «${OK_TITLE}»` : `ningún aviso «${OK_TITLE}» tras la ventana de observación`),
      check(server === serverState, `la API devuelve ${serverState}`, `la API devuelve ${server ?? '(sin estado)'}`),
    ],
    `${COOKIE_NOTE} Decisión pendiente: la línea de detalle técnico bajo el aviso no se compara (la historia no la fija); el veredicto no depende de ella.`,
  );
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, serverRejects]]),
});
