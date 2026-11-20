import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  TRANSVERSAL_NOTE,
  actionFailed,
  armToasts,
  awaitTitle,
  boxOf,
  conclude,
  describeLog,
  onPrograms,
  premiseLost,
  restoringChaos,
  rowAction,
  settle,
  setErrorRate,
  shownNow,
  signInWeb,
  sleepUntil,
  toastLog,
  toastOf,
  withNote,
} from './common';

// US-TOASTS-003 — Varios avisos a la vez y cierre a los 3 segundos (transversal; sus filas se miran en la web, 1440 px). Preparación de
// cada fila: reinicio de alumno01, inicio de sesión de gestor@sigpro.test hasta /programs; las filas de error fijan la tasa con PATCH
// /api/admin/chaos (latencia 0, errorRate 1) y el caos se apaga al terminar. El Esquema 3 mide desde la marca de aparición del aviso
// en el registro, no desde la pantalla. El plazo de retirada no se detiene con el ratón ni con el foco (decisión pendiente).

const PRG_CODES: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-003', 'PRG-003'],
]);

const ARCHIVED = 'PRG-001 archivado';
const ERROR_TITLE = 'Ha ocurrido un error inesperado';

// --- Esquema 1: cada acción muestra su propio aviso aunque el anterior siga a la vista -----------------------------------------

const stacking: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const first = strict('primero', PRG_CODES, cell(row, 'primero'));
  const second = strict('segundo', PRG_CODES, cell(row, 'segundo'));
  const firstTitle = quoted(cell(row, 'aviso_primero'));
  const secondTitle = quoted(cell(row, 'aviso_segundo'));
  const expected = `ve los avisos «${firstTitle}» y «${secondTitle}» a la vez, y «${secondTitle}» debajo de «${firstTitle}»`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  await armToasts(page);
  const firstBlocked = await rowAction(first, 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) return actionFailed(expected, firstBlocked);
  const seenFirst = await awaitTitle(page, firstTitle);
  // «Mientras el aviso sigue a la vista»: si el primero ya no está, la condición de la fila no se da
  const firstStill = (await shownNow(toastOf(page, 'ok', firstTitle))) === true;
  if (!firstStill) return premiseLost(expected, firstTitle, seenFirst.entry, describeLog(seenFirst.log));
  const secondBlocked = await rowAction(second, 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) return actionFailed(expected, secondBlocked);
  const seenSecond = await awaitTitle(page, secondTitle);
  await settle();
  const bothSeen = (await shownNow(toastOf(page, 'ok', firstTitle))) === true && (await shownNow(toastOf(page, 'ok', secondTitle))) === true;
  const firstBox = await boxOf(toastOf(page, 'ok', firstTitle));
  const secondBox = await boxOf(toastOf(page, 'ok', secondTitle));
  // Debajo y sin tapar: el segundo empieza a la altura del fondo del primero (o más abajo)
  const below = firstBox !== undefined && secondBox !== undefined && secondBox.y >= firstBox.y + firstBox.height - 1;
  return conclude(
    [
      check(bothSeen, `ve «${firstTitle}» y «${secondTitle}» a la vez`, bothSeen ? `ve «${firstTitle}» y «${secondTitle}» a la vez` : `no los ve a la vez (${describeLog(seenSecond.log)})`),
      check(below, `«${secondTitle}» está debajo de «${firstTitle}», sin taparlo`, below ? `«${secondTitle}» está debajo de «${firstTitle}»` : `posiciones: primero ${JSON.stringify(firstBox ?? null)}, segundo ${JSON.stringify(secondBox ?? null)}`),
    ],
    {
      evidence: {
        msEntreApariciones: seenSecond.entry === undefined || seenFirst.entry === undefined ? '(sin medir)' : seenSecond.entry.at - seenFirst.entry.at,
        msDesdePrimeraAlLeer: seenFirst.entry === undefined ? '(sin medir)' : Date.now() - seenFirst.entry.at,
      },
    },
  );
};

// --- Esquema 2: dos fallos seguidos muestran dos avisos de error aunque el texto sea el mismo ----------------------------

const doubleError: BrowserRowHandler = restoringChaos(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const first = strict('primero', PRG_CODES, cell(row, 'primero'));
  const second = strict('segundo', PRG_CODES, cell(row, 'segundo'));
  const expected = `ve dos avisos de error con el título «${ERROR_TITLE}»`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const rateStatus = await setErrorRate(1);
  if (rateStatus !== 200) return preparationFailedWeb(expected, `PATCH /api/admin/chaos respondió ${rateStatus}`);
  await armToasts(page);
  const firstBlocked = await rowAction(first, 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) return actionFailed(expected, firstBlocked);
  const seenFirst = await awaitTitle(page, ERROR_TITLE);
  const firstStill = (await shownNow(toastOf(page, 'danger', ERROR_TITLE))) === true;
  if (!firstStill) return premiseLost(expected, ERROR_TITLE, seenFirst.entry, describeLog(seenFirst.log));
  const secondBlocked = await rowAction(second, 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) return actionFailed(expected, secondBlocked);
  await waitUntil(async () => (await safe(() => toastOf(page, 'danger', ERROR_TITLE).count(), 0)) >= 2);
  const shown = await safe(() => toastOf(page, 'danger', ERROR_TITLE).count(), -1);
  const logged = (await toastLog(page)).filter((entry) => entry.tone === 'danger' && entry.title === ERROR_TITLE).length;
  return conclude([check(shown === 2, `ve dos avisos de error con el título «${ERROR_TITLE}»`, `ve ${shown} aviso(s) de error con ese título (registrados: ${logged})`)]);
});

// --- Esquema 3: el aviso se retira a los 3 segundos de aparecer -----------------------------------------------------------------

const SECONDS: ReadonlyMap<string, number> = new Map<string, number>([
  ['2', 2],
  ['4', 4],
]);

/** «sigue a la vista» → visible; «ya no está en la pantalla» → retirado (ya no está en el DOM). */
const STATES: ReadonlyMap<string, 'visible' | 'retirado'> = new Map<string, 'visible' | 'retirado'>([
  ['sigue a la vista', 'visible'],
  ['ya no está en la pantalla', 'retirado'],
]);

const lifetime: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const seconds = strict('segundos', SECONDS, cell(row, 'segundos'));
  const state = strict('estado', STATES, cell(row, 'estado'));
  const expected = `a los ${seconds} segundos desde que apareció «${ARCHIVED}», el aviso ${cell(row, 'estado')}`;
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  await armToasts(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, ARCHIVED);
  if (seen.entry === undefined) return preparationFailedWeb(expected, `no apareció el aviso «${ARCHIVED}» tras archivar PRG-001 (${seen.observed})`);
  // Se mide desde la marca de aparición del registro, no desde la pantalla
  const appearedAt = seen.entry.at;
  await sleepUntil(appearedAt + seconds * 1_000);
  const visible = await shownNow(toastOf(page, 'ok', ARCHIVED));
  const count = await safe(() => toastOf(page, 'ok', ARCHIVED).count(), -1);
  const observed = visible === true ? 'sigue a la vista' : count === 0 ? 'ya no está en la pantalla' : visible === undefined ? '(lectura no disponible)' : `sigue en el DOM sin verse (${count})`;
  const ok = state === 'visible' ? visible === true : count === 0;
  return conclude(
    [check(ok, `a los ${seconds} segundos el aviso ${cell(row, 'estado')}`, `a los ${seconds} segundos el aviso ${observed}`)],
    {
      note: 'Los instantes de 2 y 4 s son los de la fila, medidos desde la marca de aparición del aviso en el registro (no desde la pantalla).',
      evidence: { msDesdeAparicion: Date.now() - appearedAt },
    },
  );
};

defineBrowserRows({
  story: 'US-TOASTS-003',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(withNote(stacking, COOKIE_NOTE), TRANSVERSAL_NOTE)],
    [2, withNote(withNote(doubleError, COOKIE_NOTE), TRANSVERSAL_NOTE)],
    [3, withNote(withNote(lifetime, COOKIE_NOTE), TRANSVERSAL_NOTE)],
  ]),
});
