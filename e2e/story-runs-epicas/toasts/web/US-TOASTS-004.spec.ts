import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  LIFETIME_MS,
  LIFETIME_TOLERANCE_MS,
  NARROW,
  PLACEMENT_NOTE,
  ROLE_OF_CELL,
  actionFailed,
  appearance,
  armOrFail,
  awaitTitle,
  boxOf,
  chaosReplyCheck,
  closeToast,
  confirmedReplyCheck,
  conclude,
  franjaCheck,
  lifetimeOf,
  liveCheck,
  onPrograms,
  pageNow,
  premiseLost,
  replyOf,
  restoringChaos,
  roleCheck,
  rowAction,
  setErrorRate,
  settle,
  shownNow,
  signInWeb,
  toastOf,
  viewportOf,
  watchReplies,
  withNote,
  type Box,
  type Viewport,
} from './common';

// US-TOASTS-004 — Avisos emergentes en la web: esquina inferior derecha, «Cerrar» y rol de cada tono (escritorio 1440 px y ventana
// estrecha 390 px). Preparación de cada fila: reinicio de alumno01 e inicio de sesión de gestor@sigpro.test en /programs con la ventana de
// la fila (la ventana estrecha usa el diseño responsive y su hoja de acciones). Las medidas se toman sobre la zona visible de la ventana,
// con 1 px de tolerancia (la historia fija 16 px). Además se comprueba: que el aviso se ve por encima del contenido, que no se mueve al
// desplazar la página (si la página se desplaza), la franja del color del tono y que «Cerrar» queda a la derecha. El aviso que se cierra
// sale por su botón (antes de sus 3 s) y el otro sigue hasta su propio plazo.

const FIRST = 'PRG-001 archivado';
const SECOND = 'PRG-002 archivado';
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['100', 1],
]);

const fmt = (value: number | undefined): string => (value === undefined ? '(sin medir)' : `${Math.round(value * 10) / 10}`);
const nearly = (value: number | undefined, target: number): boolean => value !== undefined && Math.abs(value - target) <= 1;

/** Un aviso mide y se coloca como dice la historia: el espacio entre el aviso y la ventana, medido sobre su zona visible. */
type Placement = (box: Box | undefined, viewport: Viewport | undefined) => readonly Check[];

const gapsOf = (box: Box | undefined, viewport: Viewport | undefined): { readonly left?: number; readonly right?: number; readonly bottom?: number } =>
  box === undefined || viewport === undefined ? {} : { left: box.x, right: viewport.width - (box.x + box.width), bottom: viewport.height - (box.y + box.height) };

/** Escritorio: esquina inferior derecha, a 16 px del borde derecho y del inferior, y como máximo 360 px de ancho. */
const desktopPlacement: Placement = (box, viewport) => {
  const measured = gapsOf(box, viewport);
  return [
    check(nearly(measured.right, 16), 'queda a 16 px del borde derecho', `queda a ${fmt(measured.right)} px del borde derecho`),
    check(nearly(measured.bottom, 16), 'a 16 px del borde inferior', `a ${fmt(measured.bottom)} px del borde inferior`),
    check(box !== undefined && box.width <= 360.5, 'mide como máximo 360 px de ancho', `mide ${fmt(box?.width)} px de ancho`),
  ];
};

/** Ventana estrecha: ancho de la ventana menos 16 px a cada lado, y a 16 px del borde inferior. */
const narrowPlacement: Placement = (box, viewport) => {
  const measured = gapsOf(box, viewport);
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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms, windowSize.width < 1024)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, FIRST);
  // La entrada del aviso se desplaza 6 px durante 180 ms: se mide cuando ya está en su sitio
  await settle();
  const box = await boxOf(toastOf(page, 'ok', FIRST));
  const viewport = await viewportOf(page);
  const bottomHalf = box !== undefined && viewport !== undefined && box.y > viewport.height / 2;
  // Desplazamiento: si la página se desplaza, el aviso debe quedar en su sitio
  const scrollable = await safe<boolean | undefined>(() => page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight), undefined);
  let scrollCheck: Check | undefined;
  if (scrollable === true && box !== undefined) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await settle();
    const moved = await boxOf(toastOf(page, 'ok', FIRST));
    scrollCheck = check(moved !== undefined && nearly(moved.y, box.y) && nearly(moved.x, box.x), 'el aviso queda en su sitio al desplazarse la página', moved === undefined ? '(el aviso no se ve tras desplazar)' : `tras desplazar, el aviso sigue en x ${fmt(moved.x)} e y ${fmt(moved.y)}`);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  const live = await liveCheck(page, 'ok', FIRST);
  const checks: Check[] = [
    check(seen.entry !== undefined && bottomHalf, `el aviso «${FIRST}» está en la parte inferior de la ventana`, bottomHalf ? `el aviso «${FIRST}» está en la parte inferior de la ventana` : `no está abajo (${seen.observed})`),
    live,
    ...placement(box, viewport),
    ...(scrollCheck === undefined ? [] : [scrollCheck]),
  ];
  const note = scrollable === true ? PLACEMENT_NOTE : `${PLACEMENT_NOTE} La página no se desplaza en esta vista: la regla de desplazamiento no se mide aquí.`;
  return conclude(checks, { note, evidence: appearance(seen) });
};

// --- Esquema 2: el botón «Cerrar» retira solo el aviso al que pertenece -----------------------------------------------------

const closeOne: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const closing = quoted(cell(row, 'aviso'));
  const other = quoted(cell(row, 'otro'));
  const expected = `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla; el aviso ${cell(row, 'otro')} sigue a la vista`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const firstBlocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) return actionFailed(expected, firstBlocked);
  const firstSeen = await awaitTitle(page, FIRST);
  // «Mientras el aviso sigue a la vista»: si ya no está, la condición de la fila no se da
  const firstReading = await shownNow(toastOf(page, 'ok', FIRST));
  if (firstReading !== true) return premiseLost(page, expected, FIRST, firstSeen, firstReading);
  const secondBlocked = await rowAction('PRG-002', 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) return actionFailed(expected, secondBlocked);
  const secondSeen = await awaitTitle(page, SECOND);
  const closingSeen = closing === FIRST ? firstSeen : secondSeen;
  const otherSeen = closing === FIRST ? secondSeen : firstSeen;
  const closingReading = await shownNow(toastOf(page, 'ok', closing));
  if (closingReading !== true) return premiseLost(page, expected, closing, closingSeen, closingReading);
  // El botón «Cerrar» queda a la derecha del aviso y la franja del aviso tiene el color de su tono
  const toastBox = await boxOf(toastOf(page, 'ok', closing));
  const buttonBox = await boxOf(toastOf(page, 'ok', closing).first().getByRole('button', { name: 'Cerrar', exact: true }));
  const rightOfCenter = toastBox !== undefined && buttonBox !== undefined && buttonBox.x > toastBox.x + toastBox.width / 2;
  const stripe = await franjaCheck(page, closingSeen, 'ok');
  const closeBlocked = await closeToast(closing)(page);
  if (closeBlocked !== undefined) return actionFailed(expected, closeBlocked);
  const clickedAt = (await pageNow(page)) ?? Date.now();
  // Debe irse por el botón, no por su plazo: 1 s desde el clic y antes de sus 3 s desde la aparición
  const gone = await waitUntil(async () => (await safe(() => toastOf(page, 'ok', closing).count(), -1)) === 0, 1_000);
  const removedAt = (await pageNow(page)) ?? Date.now();
  const sinceAppearance = closingSeen.entry === undefined ? undefined : removedAt - closingSeen.entry.at;
  const inTime = gone.reached && sinceAppearance !== undefined && sinceAppearance < LIFETIME_MS;
  const sinceText = sinceAppearance === undefined ? '(sin aparición)' : `${sinceAppearance} ms desde su aparición`;
  // El otro aviso sigue hasta su propio plazo: su retirada cae a los 3 s de su aparición, no antes
  const otherReading = await shownNow(toastOf(page, 'ok', other));
  const otherLife = await lifetimeOf(page, otherSeen.entry, `aviso «${other}»`);
  return conclude(
    [
      check(inTime, `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla por el botón «Cerrar»`, inTime ? `el aviso ${cell(row, 'aviso')} deja de estar en la pantalla (${gone.elapsedMs} ms tras el clic; ${sinceText})` : `el aviso ${cell(row, 'aviso')} sigue en la pantalla tras el clic (${sinceText})`),
      check(otherReading === true, `el aviso ${cell(row, 'otro')} sigue a la vista`, otherReading === true ? `el aviso ${cell(row, 'otro')} sigue a la vista` : otherReading === false ? `el aviso ${cell(row, 'otro')} ya no está a la vista` : '(lectura no disponible)'),
      otherLife.check,
      check(rightOfCenter, '«Cerrar» queda a la derecha del aviso', rightOfCenter ? '«Cerrar» queda a la derecha del aviso' : `«Cerrar» no está a la derecha (aviso ${JSON.stringify(toastBox ?? null)}, botón ${JSON.stringify(buttonBox ?? null)})`),
      stripe,
    ],
    {
      note: `Plazo del aviso que se cierra: sale por su botón, en menos de 1 s del clic y antes de sus 3 s (tolerancia ${LIFETIME_TOLERANCE_MS} ms en el otro aviso).`,
      evidence: { ...appearance(closingSeen), msHastaRetirarTrasClic: removedAt - clickedAt, msDesdeAparicionDelCerrado: sinceAppearance ?? '(sin medir)', msDeVidaDelOtro: otherLife.ms ?? '(sin retirada)' },
    },
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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const replies = watchReplies(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (blocked !== undefined) {
    replies.stop();
    return actionFailed(expected, blocked);
  }
  const seen = await awaitTitle(page, title);
  const collected = await replies.collect();
  replies.stop();
  const archive = replyOf(collected, 'POST', 'PRG-001/archive');
  const serverCheck = rate === 0 ? confirmedReplyCheck(archive, 'el archivado') : chaosReplyCheck(archive);
  return conclude([roleCheck(seen, role), serverCheck], { evidence: appearance(seen) });
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
