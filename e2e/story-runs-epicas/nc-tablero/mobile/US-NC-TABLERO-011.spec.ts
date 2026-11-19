import type { Page } from '@playwright/test';
import { NC_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION } from '../../support/browser';
import { actionFailed, armToasts, intercept, interact, persistedState, sameOrder, toastShown, verdictWeb } from '../web/common';
import { READ_ONLY_REASON, mobileColumn, onMobile, prepareMobile, transitionCheck, waitMobileBoard, waitMobileDetail } from './common';

// US-NC-TABLERO-011 — Cambio de estado desde el detalle en la app móvil (Expo web, 390 × 844) con «Mover a…». Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; la cuenta de la fila inicia sesión en la app con alumno01 en «Tenant de
// trabajo», abre la pestaña «No conformidades» y abre el detalle de la no conformidad de la fila. La hoja de detalle es un diálogo.

const TITLE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['En análisis', 'in_analysis'],
  ['Rechazada', 'rejected'],
  ['Abierta', 'open'],
]);

const NC_CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001', 'NC-001'],
  ['NC-002', 'NC-002'],
  ['NC-004', 'NC-004'],
  ['NC-005', 'NC-005'],
]);

const AVISO_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-001 pasó a «En análisis»', 'NC-001 pasó a «En análisis»'],
  ['NC-002 pasó a «Rechazada»', 'NC-002 pasó a «Rechazada»'],
  ['NC-005 pasó a «Abierta»', 'NC-005 pasó a «Abierta»'],
]);

/** Botones «Mover a …» que la hoja debe mostrar, en orden; `none` si la celda dice «sin cambios» (y ningún botón). */
const STEPS_CELLS: ReadonlyMap<string, { readonly labels: readonly string[]; readonly none: boolean }> = new Map<string, { readonly labels: readonly string[]; readonly none: boolean }>([
  ['solo el botón «Mover a «En análisis»»', { labels: ['Mover a «En análisis»'], none: false }],
  ['los botones «Mover a «Acción correctiva»», «Mover a «Rechazada»» y «Mover a «Abierta»»', { labels: ['Mover a «Acción correctiva»', 'Mover a «Rechazada»', 'Mover a «Abierta»'], none: false }],
  ['el texto «Sin más cambios de estado posibles» y ningún botón', { labels: [], none: true }],
]);

const HTTP_CELLS: ReadonlyMap<string, number> = new Map<string, number>([
  ['500', 500],
  ['503', 503],
]);

const GESTOR = 'gestor@sigpro.test';
const AUDITOR = 'auditor@sigpro.test';
const TRANSITION_PATH = '/api/nc/NC-001/transition';
const SERVER_ERROR = 'No se pudo mover NC-001';

/** Acción: tocar la tarjeta de la no conformidad (su botón «Abrir <código>») para abrir la hoja de detalle. */
const openSheet = (page: Page, code: string): Promise<{ readonly message: string; readonly note: string } | undefined> =>
  interact(page.getByRole('button', { name: `Abrir ${code}`, exact: true }), `tocar la tarjeta de ${code}`, (element) => element.click(ACTION));

const sheetTitle = (code: string): string => `Detalle de ${code}`;

// --- Esquema 1: «Mover a…» cambia el estado, cierra la hoja y avisa ---------------------------------------------------------

const moveFromSheet: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const to = strict('destino', TITLE_CELLS, cell(row, 'destino'));
  const aviso = strict('aviso', AVISO_CELLS, cell(row, 'aviso'));
  const expected = `pulsar «Mover a «${cell(row, 'destino')}»» muestra el aviso «${aviso}», la hoja se cierra y la columna «${cell(row, 'destino')}» muestra la tarjeta ${code}`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  const opened = await openSheet(page, code);
  if (opened !== undefined) return actionFailed(expected, opened);
  await waitMobileDetail(page, (view) => view.open && view.heading === sheetTitle(code));
  await armToasts(page);
  const clicked = await interact(page.getByTestId(NC_DYNAMIC_TESTIDS.NC_TRANSITION(to)), `pulsar «Mover a «${cell(row, 'destino')}»»`, (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const toast = await toastShown(page, 'ok', aviso);
  const sheet = await waitMobileDetail(page, (view) => !view.open);
  const board = await waitMobileBoard(page, (view) => mobileColumn(view, to)?.cards.includes(code) === true);
  const column = board === undefined ? undefined : mobileColumn(board, to);
  // Persistencia: la API se lee después del aviso y del tablero recargado
  const persisted = await persistedState(code);
  return verdictWeb([
    check(persisted === to, `la API guarda ${code} en ${to}`, `la API da state ${persisted ?? '(sin leer)'}`),
    check(toast.seen, `aviso «${aviso}»`, `aviso ${toast.observed}`),
    check(sheet?.open === false, 'la hoja se cierra', sheet?.open === undefined ? '(sin leer)' : sheet.open ? 'la hoja sigue abierta' : 'la hoja se cierra'),
    check(column?.cards.includes(code) === true, `${code} en la columna «${cell(row, 'destino')}»`, `${code} ${column?.cards.includes(code) === true ? 'en' : 'no está en'} la columna «${cell(row, 'destino')}» (tarjetas: ${column?.cards.join(', ') || '(ninguna)'})`),
  ]);
};

// --- Esquema 2: el detalle ofrece solo los pasos que la máquina admite --------------------------------------------------

const offeredSteps: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const steps = strict('pasos', STEPS_CELLS, cell(row, 'pasos'));
  const expected = `en la sección «Mover a…» de ${code} ve ${cell(row, 'pasos')}`;
  const failed = await prepareMobile(page, GESTOR, expected);
  if (failed !== undefined) return failed;

  const opened = await openSheet(page, code);
  if (opened !== undefined) return actionFailed(expected, opened);
  const view = await waitMobileDetail(page, (current) => current.open && current.heading === sheetTitle(code) && (current.transitions.length > 0 || (current.sectionText ?? '').includes('Sin más cambios')));
  const labels = view?.transitions.map((entry) => entry.label) ?? [];
  const noSteps = view?.transitions.length === 0 && (view.sectionText ?? '').includes('Sin más cambios de estado posibles');
  return verdictWeb([
    check(view?.heading === sheetTitle(code), `hoja «${sheetTitle(code)}»`, `hoja «${view?.heading ?? '(sin leer)'}»`),
    check(steps.none ? noSteps : sameOrder(labels, steps.labels), `«Mover a…» con ${cell(row, 'pasos')}`, steps.none ? `«Mover a…»: ${view?.transitions.length ?? '(sin leer)'} botones, texto «${(view?.sectionText ?? '(sin leer)').slice(0, 80)}»` : `«Mover a…» ${labels.join(' | ') || '(ningún botón)'}`),
  ]);
};

// --- Esquema 3: quien solo lee ve los pasos deshabilitados con su motivo --------------------------------------------------

const readOnlySheet: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', NC_CODE_CELLS, cell(row, 'codigo'));
  const expected = `el botón «Mover a «En análisis»» de ${code} está deshabilitado y junto a él se lee «${READ_ONLY_REASON}»`;
  const failed = await prepareMobile(page, AUDITOR, expected);
  if (failed !== undefined) return failed;

  const opened = await openSheet(page, code);
  if (opened !== undefined) return actionFailed(expected, opened);
  const view = await waitMobileDetail(page, (current) => current.open && current.heading === sheetTitle(code) && current.transitions.length > 0);
  return verdictWeb(
    [transitionCheck(view, 'in_analysis', { enabled: false, reason: READ_ONLY_REASON }, 'el botón «Mover a «En análisis»»')],
    '«junto a él se lee» se interpreta como texto visible del motivo en el mismo grupo «Mover a…» (el elemento de MOVIL_NC_TESTIDS.TRANSITION_REASON); el motivo también va en data-reason del botón.',
  );
};

// --- Esquema 4: un fallo del servidor al mover deja la hoja abierta con la NC en su estado anterior ------------------

const serverFailure: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const status = strict('codigo_http', HTTP_CELLS, cell(row, 'codigo_http'));
  const expected = `con el servidor respondiendo ${cell(row, 'codigo_http')} al paso, pulsar «Mover a «En análisis»» muestra «${SERVER_ERROR}» y la hoja sigue abierta con NC-001 en «Abierta»`;
  const failed = await prepareMobile(page, GESTOR, expected, async () => {
    await intercept(page, 'POST', TRANSITION_PATH, { kind: 'failFirst', status });
  });
  if (failed !== undefined) return failed;

  const opened = await openSheet(page, 'NC-001');
  if (opened !== undefined) return actionFailed(expected, opened);
  await waitMobileDetail(page, (current) => current.open && current.heading === sheetTitle('NC-001') && current.transitions.length > 0);
  await armToasts(page);
  const clicked = await interact(page.getByTestId(NC_DYNAMIC_TESTIDS.NC_TRANSITION('in_analysis')), 'pulsar «Mover a «En análisis»»', (element) => element.click(ACTION));
  if (clicked !== undefined) return actionFailed(expected, clicked);
  const toast = await toastShown(page, 'danger', SERVER_ERROR);
  const view = await waitMobileDetail(page, (current) => current.serverError !== undefined);
  return verdictWeb(
    [
      check(view?.serverError === SERVER_ERROR, `aviso «${SERVER_ERROR}» junto a los botones`, `aviso «${view?.serverError ?? '(no aparece)'}»`),
      check(toast.seen, `aviso emergente «${SERVER_ERROR}»`, `aviso emergente ${toast.observed}`),
      check(view?.open === true && view.state === 'Abierta', 'la hoja sigue abierta con NC-001 en «Abierta»', `hoja ${view?.open === true ? 'abierta' : 'cerrada'}, estado «${view?.state ?? '(sin leer)'}»`),
    ],
    'La respuesta de error la fabrica la prueba: la petición no llega al servidor, así que esta fila no afirma que la transición no se registrara.',
  );
};

defineBrowserRows({
  story: 'US-NC-TABLERO-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(moveFromSheet)],
    [2, onMobile(offeredSteps)],
    [3, onMobile(readOnlySheet)],
    [4, onMobile(serverFailure)],
  ]),
});
