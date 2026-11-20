import type { Page } from '@playwright/test';
import { PERFIL_TESTIDS } from '../../../../packages/shared/src/testids';
import { adminToken } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { attrOf, holdsFor, isVisible, pathOf, quoted, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  DESKTOP,
  TIME_OF,
  actionFailed,
  badgeText,
  bellButton,
  bellName,
  clickAction,
  emitTicks,
  markReadButton,
  noted,
  notifiableSeqs,
  notificationsPanel,
  panelRows,
  prepFailed,
  prepareWeb,
  rowTestIdOf,
  seenText,
  signIn,
  simulatorMs,
  trackRealtime,
  waitRealtime,
  type Realtime,
  type TickEvent,
} from './common';

// US-NAVEGACION-008 — Campana de avisos en la web. Preparación de cada fila: reinicio de alumno01, inicio de sesión de
// gestor@sigpro.test en /programs (escritorio 1440 px) y los avisos con POST /api/mission/tick del administrador de alumno01.
// La campana cuenta los avisos que llegan por el canal en tiempo real DESPUÉS de iniciar sesión: la prueba espera a que el canal
// esté conectado antes de emitir las pulsaciones.

/** Número de pulsaciones de cada fila (la columna «pulsaciones»). */
const TICKS: ReadonlyMap<string, number> = new Map<string, number>([
  ['4', 4],
  ['5', 5],
  ['8', 8],
  ['37', 37],
  ['40', 40],
]);

/** Insignia esperada: ninguna, o el número visible (9+ con diez o más). */
const BADGE: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(ninguna)', undefined],
  ['1', '1'],
  ['2', '2'],
  ['9', '9'],
  ['9+', '9+'],
]);

/** Lo que muestra el panel en cada fila de «contenido». */
const CONTENT: ReadonlyMap<string, 'empty' | 'two'> = new Map<string, 'empty' | 'two'>([
  ['el aviso «Sin notificaciones» y ninguna lista', 'empty'],
  ['una lista de 2 avisos, el más reciente primero, cada uno con su texto y su hora', 'two'],
]);

const READ_AFTER: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
]);

const PREFERENCE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['activada', true],
  ['desactivada', false],
]);

const PREFERENCE_RESULT: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['ve la insignia 1', '1'],
  ['no ve ninguna insignia', undefined],
]);

const NOTE_TICKS =
  'Las pulsaciones se hacen tras la conexión del canal; antes de cualquier ausencia de aviso se comprueba que llegaron los eventos «mission:event». La preferencia se guarda en localStorage (live.tsx:61,67), no en el servidor, aunque la historia diga «su Perfil».';

/** Reglas de la historia sin fila (solo se anotan): el orden de llegada y que lo ya existente antes de iniciar sesión no cuenta. */
const RULES_NOTE = 'Regla sin fila (no comprobada): los avisos que ya existían antes de iniciar sesión no cuentan, y el orden del panel es el más reciente primero (solo se mira en la fila 2).';

/** Espera a la insignia con un valor estable: se sostiene 2 s (una ausencia necesita ventana suficiente, no 1 s). */
const settledBadge = async (page: Page, expected: string | undefined): Promise<{ readonly reached: boolean; readonly seen: string | undefined }> => {
  const reached = await waitUntil(async () => (await badgeText(page)) === expected);
  const stable = await holdsFor(async () => (await badgeText(page)) === expected, 2_000);
  return { reached: reached.reached && stable.held, seen: await badgeText(page) };
};

/**
 * Pulsaciones del administrador de alumno01 (POST /api/mission/tick). Antes: canal conectado y simulador apagado (intervalo 0,
 * la historia no tiene temporizador). Después: los `count` eventos llegan al navegador (control). Sin ese control, una ausencia
 * de aviso no significa nada: podría ser que no llegó nada.
 */
const provokeAfterConnected = async (link: Realtime, count: number): Promise<{ readonly events: readonly TickEvent[]; readonly failure?: string }> => {
  const connected = await waitRealtime(link);
  if (!connected) return { events: [], failure: 'el canal en tiempo real no se conecta tras iniciar sesión' };
  const token = await adminToken(TENANT_A);
  const speed = await simulatorMs(token);
  if (speed !== 0) return { events: [], failure: `el simulador de misión tiene intervalo ${speed === undefined ? '(ilegible)' : String(speed)} ms; la historia exige 0 (sin temporizador)` };
  const before = link.events();
  const ticks = await emitTicks(token, count);
  if (ticks.failed) return { events: ticks.events, failure: `POST /api/mission/tick responde ${String(ticks.failed.status)}` };
  const arrived = await waitUntil(async () => link.events() - before >= count, 5_000);
  if (!arrived.reached) return { events: ticks.events, failure: `solo llegan ${String(link.events() - before)} de ${String(count)} eventos «mission:event» al navegador` };
  return { events: ticks.events };
};

// --- Esquema 1: la campana cuenta los avisos sin leer que llegan a la pestaña después de iniciar la sesión ---------------------

const counts: BrowserRowHandler = async (row, { page }) => {
  const ticks = strict('pulsaciones', TICKS, cell(row, 'pulsaciones'));
  const badge = strict('insignia', BADGE, cell(row, 'insignia'));
  const name = quoted(cell(row, 'nombre'));
  const expected = `insignia ${cell(row, 'insignia')}; nombre «${name}»`;
  const link = trackRealtime(page);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const provoked = await provokeAfterConnected(link, ticks);
  if (provoked.failure) return prepFailed(expected, provoked.failure);
  const shown = await settledBadge(page, badge);
  const label = await bellName(page);
  return conclude(
    [
      check(shown.reached, `insignia ${cell(row, 'insignia')}`, shown.seen === undefined ? 'sin insignia' : `insignia ${shown.seen}`),
      check(label === name, `el texto de la campana «${name}»`, label === undefined ? 'no se lee el texto de la campana' : `el texto de la campana «${label}»`),
    ],
    { note: NOTE_TICKS, evidence: { avisosDeLaSecuencia: notifiableSeqs(provoked.events).length } },
  );
};

// --- Esquema 2: el panel muestra la lista de avisos o el aviso de que no hay ninguno ----------------------------------------

const panel: BrowserRowHandler = async (row, { page }) => {
  const ticks = strict('pulsaciones', TICKS, cell(row, 'pulsaciones'));
  const content = strict('contenido', CONTENT, cell(row, 'contenido'));
  const expected = cell(row, 'contenido');
  const link = trackRealtime(page);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const provoked = await provokeAfterConnected(link, ticks);
  if (provoked.failure) return prepFailed(expected, provoked.failure);
  const opened = await clickAction(page, bellButton(page), 'abrir la campana');
  if (opened) return actionFailed(expected, opened);
  await waitUntil(() => isVisible(notificationsPanel(page)));
  const rows = await waitUntil(async () => (await panelRows(page)).length === (content === 'two' ? 2 : 0));
  const seen = await panelRows(page);
  if (content === 'empty') {
    const empty = await seenText(page, 'Sin notificaciones');
    return conclude([check(empty && seen.length === 0, 'el aviso «Sin notificaciones» y ninguna lista', `${empty ? 'aviso «Sin notificaciones»' : 'sin aviso'}; ${String(seen.length)} avisos en la lista`)], { note: NOTE_TICKS });
  }
  const wanted = notifiableSeqs(provoked.events);
  const testids = seen.map((item) => item.testid);
  const sameOrder = testids.length === wanted.length && wanted.every((seq, index) => testids[index] === rowTestIdOf(seq));
  const timed = seen.every((item) => TIME_OF.test(item.lines[1] ?? '') && (item.lines[0] ?? '') !== '');
  const severities = seen.every((item) => item.severity === 'warn' || item.severity === 'danger');
  const checks: Check[] = [
    check(rows.reached && seen.length === 2, 'una lista de 2 avisos', `${String(seen.length)} avisos en la lista`),
    check(sameOrder, 'el más reciente primero (los avisos de la secuencia, en orden)', `avisos: ${testids.join(', ') || '(ninguno)'}`),
    check(timed, 'cada uno con su texto y su hora (hh:mm:ss)', timed ? 'cada uno con su texto y su hora' : 'algún aviso sin texto o sin hora válida'),
    check(severities, 'avisos de gravedad aviso o peligro', severities ? 'avisos de gravedad aviso o peligro' : 'algún aviso de otra gravedad'),
  ];
  return conclude(checks, { note: NOTE_TICKS, evidence: { filas: seen.map((item) => item.lines) } });
};

// --- Esquema 3: «Marcar leídas» deja la campana sin avisos sin leer y conserva la lista ---------------------------------------

const readAll: BrowserRowHandler = async (row, { page }) => {
  const ticks = strict('pulsaciones', TICKS, cell(row, 'pulsaciones'));
  const count = strict('avisos', READ_AFTER, cell(row, 'avisos'));
  const expected = `campana sin insignia y el panel cerrado; al volver a abrirla, ${cell(row, 'avisos')} avisos en la lista`;
  const link = trackRealtime(page);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const provoked = await provokeAfterConnected(link, ticks);
  if (provoked.failure) return prepFailed(expected, provoked.failure);
  const pre = await settledBadge(page, String(count));
  if (!pre.reached) return prepFailed(expected, `antes de «Marcar leídas» la insignia no llega a ${String(count)} (lee ${pre.seen ?? 'sin insignia'})`);
  const opened = await clickAction(page, bellButton(page), 'abrir la campana');
  if (opened) return actionFailed(expected, opened);
  await waitUntil(() => isVisible(notificationsPanel(page)));
  const read = await clickAction(page, markReadButton(page), 'pulsar «Marcar leídas»');
  if (read) return actionFailed(expected, read);
  const closed = await waitUntil(async () => !(await isVisible(notificationsPanel(page))));
  const cleared = await holdsFor(async () => (await badgeText(page)) === undefined, 2_000);
  const reopened = await clickAction(page, bellButton(page), 'volver a abrir la campana');
  if (reopened) return actionFailed(expected, reopened);
  await waitUntil(() => isVisible(notificationsPanel(page)));
  const listed = await waitUntil(async () => (await panelRows(page)).length === count);
  const rows = await panelRows(page);
  const wanted = notifiableSeqs(provoked.events);
  const kept = rows.length === wanted.length && wanted.every((seq, index) => rows[index]?.testid === rowTestIdOf(seq));
  return conclude(
    [
      check(closed.reached, 'el panel se cierra', closed.reached ? 'el panel se cierra' : 'el panel sigue abierto'),
      check(cleared.held, 'la campana no muestra ninguna insignia', cleared.held ? 'la campana no muestra ninguna insignia' : `la insignia sigue (${(await badgeText(page)) ?? '(sin texto)'})`),
      check(listed.reached && kept, `al volver a abrir la campana, ${String(count)} avisos en la lista`, `avisos en la lista: ${String(rows.length)}`),
    ],
    { note: NOTE_TICKS },
  );
};

// --- Esquema 4: la preferencia «Notificaciones en tiempo real» decide si la campana cuenta los avisos nuevos -----------------

const userMenu = (page: Page) => page.getByRole('button', { name: 'Menú de usuario', exact: true });

/** Fija la preferencia en el Perfil (visita, lee el interruptor y, si cambia, lo guarda) y vuelve a /programs por la barra. */
const setPreference = async (page: Page, want: boolean, expected: string): Promise<Check | undefined> => {
  const opened = await clickAction(page, userMenu(page), 'abrir «Menú de usuario»');
  if (opened) return check(false, expected, `no se pudo abrir el menú de usuario (${opened.note})`);
  const profile = await clickAction(page, page.getByRole('menuitem', { name: 'Perfil', exact: true }), 'elegir «Perfil»');
  if (profile) return check(false, expected, `no se pudo abrir Perfil (${profile.note})`);
  const toggle = page.getByRole('switch', { name: 'Notificaciones en tiempo real', exact: true });
  await waitUntil(() => isVisible(toggle));
  const current = (await attrOf(toggle, 'aria-checked')) === 'true';
  if (current !== want) {
    const flipped = await clickAction(page, toggle, 'cambiar «Notificaciones en tiempo real»');
    if (flipped) return check(false, expected, `no se pudo cambiar la preferencia (${flipped.note})`);
    const saved = await clickAction(page, page.getByTestId(PERFIL_TESTIDS.PROFILE_SAVE), 'pulsar «Guardar»');
    if (saved) return check(false, expected, `no se pudo guardar la preferencia (${saved.note})`);
  }
  const back = await clickAction(page, page.getByRole('link', { name: 'Programas', exact: true }).first(), 'volver a «Programas»');
  if (back) return check(false, expected, `no se pudo volver a Programas (${back.note})`);
  const arrived = await waitUntil(async () => pathOf(page) === '/programs');
  return arrived.reached ? undefined : check(false, expected, `no vuelve a /programs (ruta ${pathOf(page)})`);
};

const preference: BrowserRowHandler = async (row, { page }) => {
  const want = strict('preferencia', PREFERENCE, cell(row, 'preferencia'));
  const shown = strict('resultado', PREFERENCE_RESULT, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  const link = trackRealtime(page);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const set = await setPreference(page, want, `la preferencia «Notificaciones en tiempo real» está ${cell(row, 'preferencia')}`);
  if (set) return conclude([set]);
  const provoked = await provokeAfterConnected(link, 5);
  if (provoked.failure) return prepFailed(expected, provoked.failure);
  const result = await settledBadge(page, shown);
  const seen = result.seen === undefined ? 'no ve ninguna insignia' : `ve la insignia ${result.seen}`;
  // Con «desactivada» la preferencia descarta los avisos a propósito: el control (eventos recibidos) separa «la preferencia lo
  // respeta» de «no llegó nada»
  return conclude([check(result.reached, expected, seen)], { note: NOTE_TICKS, evidence: { eventosRecibidos: link.events(), preferencia: cell(row, 'preferencia') } });
};

// --- Esquema 5: cerrar la sesión vacía los avisos y al volver a entrar la campana empieza de cero -------------------------

const logout: BrowserRowHandler = async (row, { page }) => {
  const ticks = strict('pulsaciones', TICKS, cell(row, 'pulsaciones'));
  const expected = `tras cerrar la sesión y volver a entrar, la campana no muestra ninguna insignia`;
  const link = trackRealtime(page);
  await prepareWeb(page, DESKTOP);
  await resetTenants([TENANT_A]);
  const failure = await signIn(page, DEMO.gestor, TENANT_A);
  if (failure) return prepFailed(expected, failure);
  const provoked = await provokeAfterConnected(link, ticks);
  if (provoked.failure) return prepFailed(expected, provoked.failure);
  const before = await settledBadge(page, '1');
  if (!before.reached) return prepFailed(expected, `antes de cerrar la sesión la insignia no es 1 (${before.seen ?? 'sin insignia'})`);
  const opened = await clickAction(page, userMenu(page), 'abrir «Menú de usuario»');
  if (opened) return actionFailed(expected, opened);
  const out = await clickAction(page, page.getByRole('menuitem', { name: 'Cerrar sesión', exact: true }), 'elegir «Cerrar sesión»');
  if (out) return actionFailed(expected, out);
  const loggedOut = await waitUntil(async () => pathOf(page) === '/login');
  if (!loggedOut.reached) return prepFailed(expected, `no se llega a /login tras cerrar sesión (ruta ${pathOf(page)})`);
  const again = await signIn(page, DEMO.gestor, TENANT_A);
  if (again) return prepFailed(expected, `no vuelve a iniciar sesión: ${again}`);
  const quiet = await holdsFor(async () => (await badgeText(page)) === undefined, 2_000);
  const label = await bellName(page);
  return conclude(
    [
      check(quiet.held, 'la campana no muestra ninguna insignia', quiet.held ? 'la campana no muestra ninguna insignia' : `la insignia sigue (${(await badgeText(page)) ?? '(sin texto)'})`),
      check(label === 'Notificaciones', 'la campana se describe como «Notificaciones»', label === undefined ? 'no se lee la campana' : `la campana se describe como «${label}»`),
    ],
    { note: NOTE_TICKS },
  );
};

defineBrowserRows({
  story: 'US-NAVEGACION-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, noted(counts, RULES_NOTE)],
    [2, noted(panel, RULES_NOTE)],
    [3, noted(readAll, RULES_NOTE)],
    [4, noted(preference, RULES_NOTE)],
    [5, noted(logout, RULES_NOTE)],
  ]),
});
