import type { BrowserContext, Page } from '@playwright/test';
import { resetTenants } from '../../../story-runs/support/prepare';
import { CEILING_MS, pathOf, quoted, runSteps, waitUntil } from '../../support/browser';
import { cell, check, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  ALTERNATION_MS,
  DIGEST_NOTE,
  NO_CHANGES,
  NO_ENDPOINT_NOTE,
  SAVED,
  TENANT,
  TOOLTIP_NOTE,
  checkDigest,
  checkedSettled,
  checkedState,
  chooseLang,
  chooseTheme,
  concluded,
  defaultsChecks,
  describeSave,
  digestBox,
  enableFlakyLabels,
  installInitScripts,
  leaveAndReturnWeb,
  liveSwitch,
  notReached,
  onProfile,
  openProfileWeb,
  pressSave,
  profileTitleCheck,
  readOne,
  restoreChaos,
  runActions,
  sampleSaveLabels,
  saveButton,
  saveCheck,
  selectedLangCheck,
  settledSave,
  signInWeb,
  themeRadio,
  toastCheck,
  toggleLive,
  watchWrites,
  withCookieNote,
  type Action,
  type SaveState,
} from './common';

// US-PERFIL-002 — Cambiar las preferencias en borrador y guardarlas en el perfil (web, 1440 px). Preparación de cada fila:
// reinicio de alumno01 con su administrador, /login?tenant=alumno01 en un contexto sin sesión ni preferencias, inicio de sesión de
// gestor@sigpro.test con Gestor1234! y «Menú de usuario» → «Perfil». Solo la fila de textos alternos activa el caos (`flakyLabels`)
// antes de iniciar sesión, porque la web lee la configuración al autenticarse, y lo apaga al terminar.

const GESTOR_EMAIL = 'gestor@sigpro.test';
const GESTOR_PASSWORD = 'Gestor1234!';
const ARRIVAL = `llega a /profile con la sesión de ${GESTOR_EMAIL}`;

/** Prepara la fila: contexto con sus scripts, reinicio del tenant, inicio de sesión de gestor y «Perfil». */
const arriveAsGestor = async (page: Page, context: BrowserContext): Promise<Outcome | undefined> => {
  await installInitScripts(context);
  await resetTenants([TENANT]);
  return (await signInWeb(page, ARRIVAL, GESTOR_EMAIL, GESTOR_PASSWORD, false)) ?? (await openProfileWeb(page, ARRIVAL));
};

const themeMarked = async (page: Page, name: string, expected: string): Promise<Check> => checkedState(await checkedSettled(themeRadio(page, name), true), true, expected, 'marcada', 'sin marcar');

const liveDisabled = async (page: Page, expected: string): Promise<Check> => checkedState(await checkedSettled(liveSwitch(page), false), false, expected, 'activado', 'desactivado');

const digestMarked = async (page: Page, expected: string): Promise<Check> => checkedState(await checkedSettled(digestBox(page), true), true, expected, 'marcada', 'sin marcar');

// --- Esquema 1: «Guardar» solo se activa cuando hay un cambio pendiente ---------------------------------------------------

const ACTIONS_E1: ReadonlyMap<string, readonly Action[]> = new Map<string, readonly Action[]>([
  ['no toca ningún control', []],
  ['cambia «Idioma de la interfaz» a «English»', [chooseLang('English')]],
  ['cambia «Idioma de la interfaz» a «English» y después vuelve a «Español»', [chooseLang('English'), chooseLang('Español')]],
  ['cambia «Tema» a «Oscuro»', [chooseTheme('Oscuro')]],
  ['desmarca «Notificaciones en tiempo real»', [toggleLive]],
  ['marca «Recibir un resumen semanal por correo (simulado)»', [checkDigest]],
]);

const SAVE_STATES: ReadonlyMap<string, (state: SaveState) => boolean> = new Map<string, (state: SaveState) => boolean>([
  ['habilitado', (state) => !state.disabled],
  ['deshabilitado, con la explicación «No hay cambios que guardar» al pasar el cursor', (state) => state.disabled && state.title === NO_CHANGES],
]);

const saveEnablesRow: BrowserRowHandler = async (row, { page, context }) => {
  const estado = cell(row, 'estado');
  const accion = cell(row, 'accion');
  const wanted = strict('estado', SAVE_STATES, estado);
  const actions = strict('accion', ACTIONS_E1, accion);
  const arrival = await arriveAsGestor(page, context);
  if (arrival) return arrival;
  const before = await defaultsChecks(page);
  const failed = await runActions(page, `«Guardar» está ${estado}`, actions);
  if (failed) return failed;
  return concluded([...before, await saveCheck(page, estado, wanted)], { note: TOOLTIP_NOTE });
};

// --- Esquema 2: un cambio sin guardar no se aplica y se descarta al salir ----------------------------------------------

const DISCARD: ReadonlyMap<string, { readonly actions: readonly Action[]; readonly leave: boolean }> = new Map<string, { readonly actions: readonly Action[]; readonly leave: boolean }>([
  ['cambia «Idioma de la interfaz» a «English» y no pulsa «Guardar»', { actions: [chooseLang('English')], leave: false }],
  ['cambia «Idioma de la interfaz» a «English», abre /programs sin pulsar «Guardar» y vuelve a /profile', { actions: [chooseLang('English')], leave: true }],
  ['cambia «Tema» a «Oscuro», abre /programs sin pulsar «Guardar» y vuelve a /profile', { actions: [chooseTheme('Oscuro')], leave: true }],
]);

const DISCARD_RESULTS: ReadonlyMap<string, (page: Page) => Promise<Check[]>> = new Map<string, (page: Page) => Promise<Check[]>>([
  ['el título de la página sigue siendo «Perfil» y el selector muestra «English»', async (page) => [await profileTitleCheck(page, 'Perfil'), await selectedLangCheck(page, 'English')]],
  ['el título de la página es «Perfil» y el selector muestra «Español»', async (page) => [await profileTitleCheck(page, 'Perfil'), await selectedLangCheck(page, 'Español')]],
  ['la opción «Claro» está marcada', async (page) => [await themeMarked(page, 'Claro', 'la opción «Claro» está marcada')]],
]);

const discardRow: BrowserRowHandler = async (row, { page, context }) => {
  const accion = cell(row, 'accion');
  const plan = strict('accion', DISCARD, accion);
  const results = strict('resultado', DISCARD_RESULTS, cell(row, 'resultado'));
  const arrival = await arriveAsGestor(page, context);
  if (arrival) return arrival;
  const before = await defaultsChecks(page);
  const failed = await runActions(page, accion, plan.actions);
  if (failed) return failed;
  if (plan.leave) {
    const back = await leaveAndReturnWeb(page, accion);
    if (back) return back;
  }
  return concluded([...before, ...(await results(page))]);
};

// --- Esquema 3: guardar aplica las preferencias, avisa y se conservan al recargar -----------------------------------------

const CHANGE: ReadonlyMap<string, { readonly actions: readonly Action[]; readonly digest: boolean }> = new Map<string, { readonly actions: readonly Action[]; readonly digest: boolean }>([
  ['cambia «Tema» a «Oscuro»', { actions: [chooseTheme('Oscuro')], digest: false }],
  ['desmarca «Notificaciones en tiempo real»', { actions: [toggleLive], digest: false }],
  ['marca «Recibir un resumen semanal por correo (simulado)»', { actions: [checkDigest], digest: true }],
  [
    'cambia «Tema» a «Oscuro», desmarca «Notificaciones en tiempo real» y marca «Recibir un resumen semanal por correo (simulado)»',
    { actions: [chooseTheme('Oscuro'), toggleLive, checkDigest], digest: true },
  ],
]);

const AFTER_RELOAD: ReadonlyMap<string, (page: Page) => Promise<Check[]>> = new Map<string, (page: Page) => Promise<Check[]>>([
  ['la opción «Oscuro» está marcada', async (page) => [await themeMarked(page, 'Oscuro', 'la opción «Oscuro» está marcada')]],
  ['el interruptor «Notificaciones en tiempo real» está desactivado', async (page) => [await liveDisabled(page, 'el interruptor «Notificaciones en tiempo real» está desactivado')]],
  ['la casilla «Recibir un resumen semanal por correo (simulado)» está marcada', async (page) => [await digestMarked(page, 'la casilla «Recibir un resumen semanal por correo (simulado)» está marcada')]],
  [
    'la opción «Oscuro» está marcada, el interruptor «Notificaciones en tiempo real» está desactivado y la casilla del resumen semanal está marcada',
    async (page) => [
      await themeMarked(page, 'Oscuro', 'la opción «Oscuro» está marcada'),
      await liveDisabled(page, 'el interruptor «Notificaciones en tiempo real» está desactivado'),
      await digestMarked(page, 'la casilla del resumen semanal está marcada'),
    ],
  ],
]);

const saveAndReloadRow: BrowserRowHandler = async (row, { page, context }) => {
  const plan = strict('cambio', CHANGE, cell(row, 'cambio'));
  const after = strict('tras_recargar', AFTER_RELOAD, cell(row, 'tras_recargar'));
  const arrival = await arriveAsGestor(page, context);
  if (arrival) return arrival;
  const before = await defaultsChecks(page);
  const changed = await runActions(page, `ve el aviso «${SAVED}»`, plan.actions);
  if (changed) return changed;
  // Las escrituras de red se miran en las filas que tocan la casilla: el resumen semanal es simulado y no envía correo
  const writes = watchWrites(page);
  const saved = await runActions(page, `ve el aviso «${SAVED}»`, [pressSave]);
  if (saved) {
    writes.stop();
    return saved;
  }
  const toast = await toastCheck(page, `ve el aviso «${SAVED}»`);
  const disabledAfterSave = await settledSave(page, (state) => state.disabled);
  const disabledCheck = check(disabledAfterSave.ok && disabledAfterSave.value.disabled, '«Guardar» vuelve a estar deshabilitado', describeSave(disabledAfterSave));
  await sleep(500);
  writes.stop();
  const noMail = plan.digest
    ? [check(writes.writes.length === 0, 'al guardar la casilla no se envía ningún correo (sin peticiones de escritura)', writes.writes.length === 0 ? 'sin peticiones de escritura al guardar' : `peticiones de escritura: ${writes.writes.join(', ')}`)]
    : [];
  const reloaded = await runSteps([['recargar /profile', () => page.reload({ timeout: CEILING_MS })]]);
  if (reloaded) return notReached(`al recargar /profile, ${cell(row, 'tras_recargar')}`, reloaded);
  const back = await waitUntil(() => onProfile(page));
  if (!back.reached) return outcome(false, `al recargar /profile, ${cell(row, 'tras_recargar')}`, `tras recargar la ruta es ${pathOf(page)}`, { note: 'Recargar /profile no deja la página de perfil.' });
  const notes = [TOOLTIP_NOTE, NO_ENDPOINT_NOTE, ...(plan.digest ? [DIGEST_NOTE] : [])].join(' ');
  return concluded([...before, toast, disabledCheck, ...noMail, ...(await after(page))], { note: notes });
};

// --- Esquema 4: el idioma guardado cambia la página y el aviso sale en el idioma anterior ---------------------------------

const LANG_LABELS: ReadonlyMap<string, 'English' | 'Español'> = new Map<string, 'English' | 'Español'>([
  ['English', 'English'],
  ['Español', 'Español'],
]);

const saveLangRow: BrowserRowHandler = async (row, { page, context }) => {
  const idioma = strict('idioma', LANG_LABELS, quoted(cell(row, 'idioma')));
  const titulo = quoted(cell(row, 'titulo'));
  const expected = `ve el aviso «${SAVED}», el título de la página es «${titulo}» y el selector muestra «${idioma}»`;
  const arrival = await arriveAsGestor(page, context);
  if (arrival) return arrival;
  const before = await defaultsChecks(page);
  const failed = await runActions(page, expected, [chooseLang(idioma), pressSave]);
  if (failed) return failed;
  // El aviso se mira en el idioma en el que estaba la página al guardar; después, el título y el selector en el idioma nuevo
  const toast = await toastCheck(page, `ve el aviso «${SAVED}»`);
  return concluded([...before, toast, await profileTitleCheck(page, titulo), await selectedLangCheck(page, idioma)]);
};

// --- Esquema 5: con los textos alternos del modo caos, «Guardar» alterna su texto y guarda con cualquiera de los dos ---------

const ACCION_E5: ReadonlyMap<string, 'observar' | 'pulsar'> = new Map<string, 'observar' | 'pulsar'>([
  ['observa el botón «Guardar» durante el tiempo que elige la prueba', 'observar'],
  ['pulsa el botón con el texto que tiene en ese momento', 'pulsar'],
]);

const RESULTADO_E5: ReadonlyMap<string, 'alterna' | 'aviso'> = new Map<string, 'alterna' | 'aviso'>([
  ['su texto alterna entre «Guardar» y «Guardar cambios»', 'alterna'],
  ['ve el aviso «Preferencias guardadas»', 'aviso'],
]);

const flakyRow: BrowserRowHandler = async (row, { page, context }) => {
  const accion = strict('accion', ACCION_E5, cell(row, 'accion'));
  const resultado = cell(row, 'resultado');
  const expectation = strict('resultado', RESULTADO_E5, resultado);
  await installInitScripts(context);
  await resetTenants([TENANT]);
  try {
    // El caos va antes de iniciar sesión: la web lee `GET /api/config` al autenticarse
    const flaky = await enableFlakyLabels('los textos alternos del modo caos están activados');
    if (flaky) return flaky;
    const arrival = (await signInWeb(page, ARRIVAL, GESTOR_EMAIL, GESTOR_PASSWORD, false)) ?? (await openProfileWeb(page, ARRIVAL));
    if (arrival) return arrival;
    const changed = await runActions(page, resultado, [chooseTheme('Oscuro')]);
    if (changed) return changed;
    if (accion === 'observar') {
      const labels = await sampleSaveLabels(page);
      const alternates = expectation === 'alterna' && labels.length === 2 && labels.includes('Guardar') && labels.includes('Guardar cambios');
      const seen = labels.length === 0 ? '(ninguno legible)' : labels.map((label) => `«${label}»`).join(' y ');
      return concluded([check(alternates, resultado, `textos vistos en ${ALTERNATION_MS / 1000} s: ${seen}`)]);
    }
    const before = await readOne(saveButton(page), (found) => found.innerText({ timeout: 500 }));
    const saved = await runActions(page, resultado, [pressSave]);
    if (saved) return saved;
    const toast = await toastCheck(page, resultado);
    return concluded([toast], { evidence: { textoAntesDelClic: before.ok ? before.value : before.reason } });
  } finally {
    await restoreChaos();
  }
};

defineBrowserRows({
  story: 'US-PERFIL-002',
  surface: 'web',
  tenants: [TENANT],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(saveEnablesRow)],
    [2, withCookieNote(discardRow)],
    [3, withCookieNote(saveAndReloadRow)],
    [4, withCookieNote(saveLangRow)],
    [5, withCookieNote(flakyRow)],
  ]),
});
