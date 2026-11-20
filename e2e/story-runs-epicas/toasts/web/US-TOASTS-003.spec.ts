import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  LIFETIME_NOTE,
  TRANSVERSAL_NOTE,
  actionFailed,
  appearance,
  armOrFail,
  awaitTitle,
  boxOf,
  chaosArchivesCheck,
  conclude,
  describeLog,
  lifetimeOf,
  onPrograms,
  pageNow,
  premiseLost,
  restoringChaos,
  rowAction,
  setErrorRate,
  settle,
  shownNow,
  signInWeb,
  sleepUntilPage,
  toastLog,
  toastOf,
  watchReplies,
  withNote,
} from './common';

// US-TOASTS-003 — Varios avisos a la vez y cierre a los 3 segundos (transversal; sus filas se miran en la web, 1440 px). Preparación de
// cada fila: reinicio de alumno01, inicio de sesión de gestor@sigpro.test hasta /programs; las filas de error fijan la tasa con PATCH
// /api/admin/chaos (latencia 0, errorRate 1) y el caos se apaga al terminar. Cada aviso se mide de dos formas: su retirada del DOM
// (tiempo de vida desde la aparición, con tolerancia de 500 ms) y, en el Esquema 3, si sigue a la vista a los 2 s y no está a los 4 s. El
// aviso de error solo se atribuye al caos si la escritura responde 500 chaos_error. El plazo no se detiene con el ratón ni con el foco
// (decisión pendiente de la historia).

const PRG_CODES: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
  ['PRG-003', 'PRG-003'],
]);

const ARCHIVED = 'PRG-001 archivado';
const ERROR_TITLE = 'Ha ocurrido un error inesperado';
/** Tolerancia al decir «debajo»: 1 px de solape (la historia no fija tolerancia). */
const STACK_NOTE = 'Tolerancia de medida: 1 px al decir que un aviso está debajo del otro (la historia no la fija).';

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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const firstBlocked = await rowAction(first, 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) return actionFailed(expected, firstBlocked);
  const seenFirst = await awaitTitle(page, firstTitle);
  // «Mientras el aviso sigue a la vista»: si el primero ya no está, la condición de la fila no se da
  const firstReading = await shownNow(toastOf(page, 'ok', firstTitle));
  if (firstReading !== true) return premiseLost(page, expected, firstTitle, seenFirst, firstReading);
  const secondBlocked = await rowAction(second, 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) return actionFailed(expected, secondBlocked);
  const seenSecond = await awaitTitle(page, secondTitle);
  await settle();
  const bothSeen = (await shownNow(toastOf(page, 'ok', firstTitle))) === true && (await shownNow(toastOf(page, 'ok', secondTitle))) === true;
  const firstBox = await boxOf(toastOf(page, 'ok', firstTitle));
  const secondBox = await boxOf(toastOf(page, 'ok', secondTitle));
  // Debajo y sin tapar: el segundo empieza a la altura del fondo del primero (o más abajo), con 1 px de tolerancia
  const below = firstBox !== undefined && secondBox !== undefined && secondBox.y >= firstBox.y + firstBox.height - 1;
  const gap = seenSecond.entry === undefined || seenFirst.entry === undefined ? undefined : seenSecond.entry.at - seenFirst.entry.at;
  return conclude(
    [
      check(bothSeen, `ve «${firstTitle}» y «${secondTitle}» a la vez`, bothSeen ? `ve «${firstTitle}» y «${secondTitle}» a la vez` : `no los ve a la vez (${describeLog(seenSecond.log)})`),
      check(below, `«${secondTitle}» está debajo de «${firstTitle}», sin taparlo`, below ? `«${secondTitle}» está debajo de «${firstTitle}»` : `posiciones: primero ${JSON.stringify(firstBox ?? null)}, segundo ${JSON.stringify(secondBox ?? null)}`),
    ],
    {
      note: STACK_NOTE,
      evidence: {
        ...appearance(seenFirst),
        msEntreApariciones: gap ?? '(sin medir)',
        msDelPrimeroAlLeer: seenFirst.entry === undefined ? '(sin medir)' : (await pageNow(page) ?? Date.now()) - seenFirst.entry.at,
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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const replies = watchReplies(page);
  const firstBlocked = await rowAction(first, 'Archivar', onPrograms)(page);
  if (firstBlocked !== undefined) {
    replies.stop();
    return actionFailed(expected, firstBlocked);
  }
  const seenFirst = await awaitTitle(page, ERROR_TITLE);
  const firstReading = await shownNow(toastOf(page, 'danger', ERROR_TITLE));
  if (firstReading !== true) {
    replies.stop();
    return premiseLost(page, expected, ERROR_TITLE, seenFirst, firstReading);
  }
  const secondBlocked = await rowAction(second, 'Archivar', onPrograms)(page);
  if (secondBlocked !== undefined) {
    replies.stop();
    return actionFailed(expected, secondBlocked);
  }
  await waitUntil(async () => (await safe(() => toastOf(page, 'danger', ERROR_TITLE).count(), 0)) >= 2);
  const shown = await safe(() => toastOf(page, 'danger', ERROR_TITLE).count(), -1);
  const collected = await replies.collect();
  replies.stop();
  const errors = ((await toastLog(page)) ?? []).filter((entry) => entry.tone === 'danger' && entry.title === ERROR_TITLE);
  const lifeFirst = await lifetimeOf(page, errors[0], 'primer aviso de error');
  const lifeSecond = await lifetimeOf(page, errors[1], 'segundo aviso de error');
  return conclude(
    [
      check(shown === 2, `ve dos avisos de error con el título «${ERROR_TITLE}»`, `ve ${shown} aviso(s) de error con ese título (registrados: ${errors.length})`),
      chaosArchivesCheck(collected, 2),
      lifeFirst.check,
      lifeSecond.check,
    ],
    { note: LIFETIME_NOTE, evidence: { ...appearance(seenFirst), msDeVida: [lifeFirst.ms ?? '(sin retirada)', lifeSecond.ms ?? '(sin retirada)'] } },
  );
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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, ARCHIVED);
  if (seen.entry === undefined) return preparationFailedWeb(expected, `no apareció el aviso «${ARCHIVED}» tras archivar PRG-001 (${seen.observed})`);
  // Se mide desde la marca de aparición del registro (reloj de la página), no desde la pantalla
  const appearedAt = seen.entry.at;
  await sleepUntilPage(page, appearedAt + seconds * 1_000);
  const reading = await shownNow(toastOf(page, 'ok', ARCHIVED));
  const count = await safe(() => toastOf(page, 'ok', ARCHIVED).count(), -1);
  const observed = reading === true ? 'sigue a la vista' : count === 0 ? 'ya no está en la pantalla' : reading === undefined ? '(lectura no disponible)' : `sigue en el DOM sin verse (${count})`;
  const ok = state === 'visible' ? reading === true : count === 0;
  // La retirada del DOM: el aviso debe irse a los 3 s de aparecer (no antes ni después, con tolerancia)
  const life = await lifetimeOf(page, seen.entry, `aviso «${ARCHIVED}»`);
  return conclude([check(ok, `a los ${seconds} segundos el aviso ${cell(row, 'estado')}`, `a los ${seconds} segundos el aviso ${observed}`), life.check], {
    note: `${LIFETIME_NOTE} Los instantes de 2 y 4 s son los de la fila, medidos desde la marca de aparición del aviso en el registro.`,
    evidence: { ...appearance(seen), msDeVida: life.ms ?? '(sin retirada)', msEnLaLectura: (await pageNow(page) ?? Date.now()) - appearedAt },
  });
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
