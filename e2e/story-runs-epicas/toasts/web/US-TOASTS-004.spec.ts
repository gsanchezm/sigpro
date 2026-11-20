import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  NARROW,
  ROLE_OF_CELL,
  actionFailed,
  armToasts,
  awaitTitle,
  boxOf,
  closeToast,
  conclude,
  describeLog,
  onPrograms,
  premiseLost,
  restoringChaos,
  roleCheck,
  rowAction,
  setErrorRate,
  settle,
  shownNow,
  signInWeb,
  toastOf,
  viewportOf,
  withNote,
  type Box,
  type Viewport,
} from './common';

// US-TOASTS-004 — Avisos emergentes en la web: esquina inferior derecha, «Cerrar» y rol de cada tono (escritorio 1440 px y ventana
// estrecha 390 px). Preparación de cada fila: reinicio de alumno01 e inicio de sesión de gestor@sigpro.test en /programs con la
// ventana de la fila (la ventana estrecha usa el diseño responsive y su hoja de acciones). Las medidas se toman sobre la zona visible
// de la ventana (sin barras de desplazamiento). La regla de que los avisos no se muevan al desplazar la página no es un Esquema de esta
// historia y no se comprueba aquí.

const FIRST = 'PRG-001 archivado';
const SECOND = 'PRG-002 archivado';
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['100', 1],
]);

const fmt = (value: number | undefined): string => (value === undefined ? '(sin medir)' : `${Math.round(value * 10) / 10}`);

/** Un aviso mide y se coloca como dice la historia: el espacio entre el aviso y la ventana, medido sobre su zona visible. */
type Placement = (box: Box | undefined, viewport: Viewport | undefined) => readonly Check[];

const gaps = (box: Box | undefined, viewport: Viewport | undefined): { readonly left?: number; readonly right?: number; readonly bottom?: number } =>
  box === undefined || viewport === undefined ? {} : { left: box.x, right: viewport.width - (box.x + box.width), bottom: viewport.height - (box.y + box.height) };

const nearly = (value: number | undefined, target: number): boolean => value !== undefined && Math.abs(value - target) <= 1;

/** Escritorio: esquina inferior derecha, a 16 px del borde derecho y del inferior, y como máximo 360 px de ancho. */
const desktopPlacement: Placement = (box, viewport) => {
  const measured = gaps(box, viewport);
  return [
    check(nearly(measured.right, 16), 'queda a 16 px del borde derecho', `queda a ${fmt(measured.right)} px del borde derecho`),
    check(nearly(measured.bottom, 16), 'a 16 px del borde inferior', `a ${fmt(measured.bottom)} px del borde inferior`),
    check(box !== undefined && box.width <= 360.5, 'mide como máximo 360 px de ancho', `mide ${fmt(box?.width)} px de ancho`),
  ];
};

/** Ventana estrecha: ancho de la ventana menos 16 px a cada lado, y a 16 px del borde inferior. */
const narrowPlacement: Placement = (box, viewport) => {
  const measured = gaps(box, viewport);
  const widthOk = box !== undefined && viewport !== undefined && nearly(box.width, viewport.width - 32);
  return [
    check(nearly(measured.left, 16) && nearly(measured.right, 16) && widthOk, 'ocupa el ancho de la ventana menos 16 px a cada lado', `a ${fmt(measured.left)} px a la izquierda, ${fmt(measured.right)} px a la derecha y ancho ${fmt(box?.width)} px`),
    check(nearly(measured.bottom, 16), 'queda a 16 px del borde inferior', `queda a ${fmt(measured.bottom)} px del borde inferior`),
  ];
};

const PLACEMENTS: ReadonlyMap<string, Placement> = new Map<string, Placement>([
  ['queda a 16 px del borde derecho y a 16 px del borde inferior, y mide como máximo 360 px de ancho', desktopPlacement],
  ['ocupa el ancho de la ventana menos 16 px a cada lado y queda a 16 px del borde inferior', narrowPlacement],
]);

const WINDOWS: ReadonlyMap<string, Viewport> = new Map<string, Viewport>([
  ['1440', DESKTOP],
  ['390', NARROW],
]);

// --- Esquema 1: el aviso aparece en la parte inferior de la ventana -------------------------------------------------------------

const position: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const windowSize = strict('ancho', WINDOWS, cell(row, 'ancho'));
  const placement = strict('posicion', PLACEMENTS, cell(row, 'posicion'));
  const expected = `el aviso «${FIRST}» está en la parte inferior de la ventana; ${cell(row, 'posicion')}`;
  const prepared = await signInWeb(page, windowSize, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  await armToasts(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms, windowSize.width < 1024)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, FIRST);
  // La entrada del aviso se desplaza 6 px durante 180 ms: se mide cuando ya está en su sitio
  await settle();
  const box = await boxOf(toastOf(page, 'ok', FIRST));
  const viewport = await viewportOf(page);
  const bottomHalf = box !== undefined && viewport !== undefined && box.y > viewport.height / 2;
  return conclude(
    [
      check(seen.entry !== undefined && bottomHalf, `el aviso «${FIRST}» está en la parte inferior de la ventana`, bottomHalf ? `el aviso «${FIRST}» está en la parte inferior de la ventana` : `no está abajo (${seen.observed})`),
      ...placement(box, viewport),
    ],
    { note: 'La regla de que los avisos queden en su sitio al desplazarse la página no es un Esquema de esta historia y no se comprueba aquí.' },
  );
};

// --- Esquema 2: el botón «Cerrar» retira solo el aviso al que pertenece -----------------------------------------------------

const closeOne: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const closing = quoted(cell(row, 'aviso'));
  const other = quoted(cell(row, 'otro'));
  const expected = `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla; el aviso ${cell(row, 'otro')} sigue a la vista`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  await armToasts(page);
  const firstBlocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) return actionFailed(expected, firstBlocked);
  const firstSeen = await awaitTitle(page, FIRST);
  // «Mientras el aviso sigue a la vista»: si el primero ya no está, la condición de la fila no se da
  const firstStill = (await shownNow(toastOf(page, 'ok', FIRST))) === true;
  if (!firstStill) return premiseLost(expected, FIRST, firstSeen.entry, describeLog(firstSeen.log));
  const secondBlocked = await rowAction('PRG-002', 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) return actionFailed(expected, secondBlocked);
  const secondSeen = await awaitTitle(page, SECOND);
  // El aviso que se cierra y el que debe quedar: su aparición se mide del registro
  const closingEntry = (closing === FIRST ? firstSeen : secondSeen).entry;
  const closingStill = (await shownNow(toastOf(page, 'ok', closing))) === true;
  if (!closingStill) return premiseLost(expected, closing, closingEntry, describeLog(secondSeen.log));
  const closeBlocked = await closeToast(closing)(page);
  if (closeBlocked !== undefined) return actionFailed(expected, closeBlocked);
  const clickedAt = Date.now();
  // Debe irse por el botón, no por su plazo: tiene que desaparecer en 1 s desde el clic y antes de sus 3 s desde la aparición
  const gone = await waitUntil(async () => (await safe(() => toastOf(page, 'ok', closing).count(), -1)) === 0, 1_000);
  const otherSeen = (await shownNow(toastOf(page, 'ok', other))) === true;
  const removedMs = Date.now() - clickedAt;
  const sinceAppearance = closingEntry === undefined ? undefined : Date.now() - closingEntry.at;
  const inTime = gone.reached && sinceAppearance !== undefined && sinceAppearance < 3_000;
  const sinceText = sinceAppearance === undefined ? '(sin aparición)' : `${sinceAppearance} ms desde su aparición`;
  return conclude(
    [
      check(inTime, `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla por el botón «Cerrar»`, inTime ? `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla (${removedMs} ms tras el clic, ${sinceText})` : `el aviso ${cell(row, 'aviso')} sigue en la pantalla ${removedMs} ms tras el clic (${sinceText})`),
      check(otherSeen, `el aviso ${cell(row, 'otro')} sigue a la vista`, otherSeen ? `el aviso ${cell(row, 'otro')} sigue a la vista` : `el aviso ${cell(row, 'otro')} ya no está a la vista`),
    ],
    { evidence: { msHastaRetirarTrasClic: removedMs, msDesdeAparicionDelCerrado: sinceAppearance ?? '(sin medir)' } },
  );
};

// --- Esquema 3: cada tono se anuncia con el rol que le corresponde ----------------------------------------------------------

const announced: BrowserRowHandler = restoringChaos(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const role = strict('rol', ROLE_OF_CELL, cell(row, 'rol'));
  const title = quoted(cell(row, 'titulo'));
  const expected = `el aviso ${cell(row, 'titulo')} se anuncia con el rol de ${cell(row, 'rol')}`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const rateStatus = await setErrorRate(rate);
  if (rateStatus !== 200) return preparationFailedWeb(expected, `PATCH /api/admin/chaos respondió ${rateStatus}`);
  await armToasts(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  const checks: readonly Check[] = [roleCheck(seen, role)];
  return conclude(checks);
});

defineBrowserRows({
  story: 'US-TOASTS-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(position, COOKIE_NOTE)],
    [2, withNote(closeOne, COOKIE_NOTE)],
    [3, withNote(announced, COOKIE_NOTE)],
  ]),
});
