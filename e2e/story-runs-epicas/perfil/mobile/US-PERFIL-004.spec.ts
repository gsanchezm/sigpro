import type { BrowserContext, Page } from '@playwright/test';
import { resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  HEADER_OBSERVATION_NOTE,
  NO_ENDPOINT_NOTE,
  SAVED,
  TENANT,
  checkedState,
  concluded,
  installInitScripts,
  pressSave,
  profileTitleCheck,
  runActions,
  toastCheck,
  withNote,
  type Action,
} from '../web/common';
import {
  MOBILE_MAIL_NOTE,
  MOBILE_RULE_NOTE,
  REOPEN_NOTE,
  checkedAttrSettled,
  comboCheckSettled,
  digestBoxM,
  leaveAndReturnMobile,
  liveSwitchM,
  mobileDefaults,
  mobileDigest,
  mobileLang,
  mobileLive,
  mobileSaveCheck,
  mobileTheme,
  openProfileMobile,
  reopenMobile,
  signInMobile,
  themeRadio,
  waitStoredValues,
  withExpoNote,
  type MobileSave,
} from './common';

// US-PERFIL-004 — Cambiar las preferencias en borrador y guardarlas en el perfil (app móvil servida como web de Expo, 390 × 844).
// Preparación de cada fila: caos apagado (lo comprueba el marco), reinicio de alumno01, la app abierta sin sesión ni preferencias
// guardadas y con «alumno01» en «Tenant de trabajo», inicio de sesión de gestor@sigpro.test con Gestor1234! y «Perfil» desde «Más».

const GESTOR_EMAIL = 'gestor@sigpro.test';
const GESTOR_PASSWORD = 'Gestor1234!';
const ARRIVAL = `llega a «Perfil» desde «Más» con la sesión de ${GESTOR_EMAIL}`;

/** Prepara la fila: scripts del contexto, reinicio del tenant, inicio de sesión de gestor y «Perfil» desde «Más». */
const arriveGestor = async (page: Page, context: BrowserContext): Promise<Outcome | undefined> => {
  await installInitScripts(context);
  await resetTenants([TENANT]);
  return (await signInMobile(page, ARRIVAL, GESTOR_EMAIL, GESTOR_PASSWORD, false)) ?? (await openProfileMobile(page, ARRIVAL));
};

const comboCheck = (page: Page, label: string): Promise<Check> => comboCheckSettled(page, label);

/** Tras volver a abrir la app, el tema y las preferencias se leen del almacenamiento de forma asíncrona: se espera a su estado. */
const themeSelected = async (page: Page, name: string, expected: string): Promise<Check> =>
  checkedState(await checkedAttrSettled(themeRadio(page, name), true), true, expected, 'seleccionada', 'sin seleccionar');

const liveOff = async (page: Page, expected: string): Promise<Check> =>
  checkedState(await checkedAttrSettled(liveSwitchM(page), false), false, expected, 'activado', 'desactivado');

const digestMarked = async (page: Page, expected: string): Promise<Check> =>
  checkedState(await checkedAttrSettled(digestBoxM(page), true), true, expected, 'marcada', 'sin marcar');

// --- Esquema 1: «Guardar» solo se activa cuando hay un cambio pendiente -------------------------------------------------

const ACTIONS_E1: ReadonlyMap<string, readonly Action[]> = new Map<string, readonly Action[]>([
  ['no toca ningún control', []],
  ['cambia «Idioma de la interfaz» a «English»', [mobileLang('English')]],
  ['cambia «Idioma de la interfaz» a «English» y después vuelve a «Español»', [mobileLang('English'), mobileLang('Español')]],
  ['cambia «Tema» a «Oscuro»', [mobileTheme('Oscuro')]],
  ['desmarca «Notificaciones en tiempo real»', [mobileLive]],
  ['marca «Recibir un resumen semanal por correo (simulado)»', [mobileDigest]],
]);

const STATES_E1: ReadonlyMap<string, (state: MobileSave) => boolean> = new Map<string, (state: MobileSave) => boolean>([
  ['deshabilitado, y se lee «No hay cambios que guardar»', (state) => state.disabled && state.hintVisible],
  ['habilitado, y no se lee «No hay cambios que guardar»', (state) => !state.disabled && !state.hintVisible],
]);

const saveEnablesRow: BrowserRowHandler = async (row, { page, context }) => {
  const estado = cell(row, 'estado');
  const wanted = strict('estado', STATES_E1, estado);
  const actions = strict('accion', ACTIONS_E1, cell(row, 'accion'));
  const arrival = await arriveGestor(page, context);
  if (arrival) return arrival;
  const before = await mobileDefaults(page);
  const failed = await runActions(page, `«Guardar» está ${estado}`, actions);
  if (failed) return failed;
  return concluded([...before, await mobileSaveCheck(page, estado, wanted)], { note: MOBILE_RULE_NOTE });
};

// --- Esquema 2: un cambio sin guardar no se aplica y se descarta al salir ----------------------------------------------

const DISCARD: ReadonlyMap<string, { readonly actions: readonly Action[]; readonly leave: boolean }> = new Map<string, { readonly actions: readonly Action[]; readonly leave: boolean }>([
  ['cambia «Idioma de la interfaz» a «English» y no pulsa «Guardar»', { actions: [mobileLang('English')], leave: false }],
  ['cambia «Idioma de la interfaz» a «English», sale de «Perfil» sin pulsar «Guardar» y vuelve a abrirlo desde «Más»', { actions: [mobileLang('English')], leave: true }],
  ['cambia «Tema» a «Oscuro», sale de «Perfil» sin pulsar «Guardar» y vuelve a abrirlo desde «Más»', { actions: [mobileTheme('Oscuro')], leave: true }],
]);

const DISCARD_RESULTS: ReadonlyMap<string, (page: Page) => Promise<Check[]>> = new Map<string, (page: Page) => Promise<Check[]>>([
  ['el título de la pantalla sigue siendo «Perfil» y el selector muestra «English»', async (page) => [await profileTitleCheck(page, 'Perfil'), await comboCheck(page, 'English')]],
  ['el título de la pantalla es «Perfil» y el selector muestra «Español»', async (page) => [await profileTitleCheck(page, 'Perfil'), await comboCheck(page, 'Español')]],
  ['la opción «Claro» está seleccionada', async (page) => [await themeSelected(page, 'Claro', 'la opción «Claro» está seleccionada')]],
]);

const discardRow: BrowserRowHandler = async (row, { page, context }) => {
  const accion = cell(row, 'accion');
  const plan = strict('accion', DISCARD, accion);
  const results = strict('resultado', DISCARD_RESULTS, cell(row, 'resultado'));
  const arrival = await arriveGestor(page, context);
  if (arrival) return arrival;
  const before = await mobileDefaults(page);
  // Cada cambio se comprueba al actuar (runActions): antes de salir, la pantalla ya lo muestra
  const failed = await runActions(page, accion, plan.actions);
  if (failed) return failed;
  if (plan.leave) {
    const back = await leaveAndReturnMobile(page, accion);
    if (back) return back;
  }
  return concluded([...before, ...(await results(page))], { note: MOBILE_RULE_NOTE });
};

// --- Esquema 3: «Guardar» aplica las preferencias, avisa y se conservan al volver a abrir la app -----------------------

interface ChangePlan {
  readonly actions: readonly Action[];
  /** Valores que la app escribe al guardar: se espera a que estén antes de cerrar y reabrir. */
  readonly stored: Readonly<Record<string, string>>;
}

const CHANGE: ReadonlyMap<string, ChangePlan> = new Map<string, ChangePlan>([
  ['cambia «Tema» a «Oscuro»', { actions: [mobileTheme('Oscuro')], stored: { 'sigpro.theme': 'dark' } }],
  ['desmarca «Notificaciones en tiempo real»', { actions: [mobileLive], stored: { 'sigpro.live': 'off' } }],
  ['marca «Recibir un resumen semanal por correo (simulado)»', { actions: [mobileDigest], stored: { 'sigpro.digest': 'on' } }],
  [
    'cambia «Tema» a «Oscuro», desmarca «Notificaciones en tiempo real» y marca «Recibir un resumen semanal por correo (simulado)»',
    { actions: [mobileTheme('Oscuro'), mobileLive, mobileDigest], stored: { 'sigpro.theme': 'dark', 'sigpro.live': 'off', 'sigpro.digest': 'on' } },
  ],
]);

const AFTER_REOPEN: ReadonlyMap<string, (page: Page) => Promise<Check[]>> = new Map<string, (page: Page) => Promise<Check[]>>([
  ['la opción «Oscuro» está seleccionada', async (page) => [await themeSelected(page, 'Oscuro', 'la opción «Oscuro» está seleccionada')]],
  ['el interruptor «Notificaciones en tiempo real» está desactivado', async (page) => [await liveOff(page, 'el interruptor «Notificaciones en tiempo real» está desactivado')]],
  ['la casilla «Recibir un resumen semanal por correo (simulado)» está marcada', async (page) => [await digestMarked(page, 'la casilla «Recibir un resumen semanal por correo (simulado)» está marcada')]],
  [
    'la opción «Oscuro» está seleccionada, el interruptor «Notificaciones en tiempo real» está desactivado y la casilla del resumen semanal está marcada',
    async (page) => [
      await themeSelected(page, 'Oscuro', 'la opción «Oscuro» está seleccionada'),
      await liveOff(page, 'el interruptor «Notificaciones en tiempo real» está desactivado'),
      await digestMarked(page, 'la casilla del resumen semanal está marcada'),
    ],
  ],
]);

const saveAndReopenRow: BrowserRowHandler = async (row, { page, context }) => {
  const plan = strict('cambio', CHANGE, cell(row, 'cambio'));
  const after = strict('tras_reabrir', AFTER_REOPEN, cell(row, 'tras_reabrir'));
  const arrival = await arriveGestor(page, context);
  if (arrival) return arrival;
  const before = await mobileDefaults(page);
  const changed = await runActions(page, `ve el aviso «${SAVED}»`, plan.actions);
  if (changed) return changed;
  const saved = await runActions(page, `ve el aviso «${SAVED}»`, [pressSave]);
  if (saved) return saved;
  const toast = await toastCheck(page, `ve el aviso «${SAVED}»`);
  const disabledAfterSave = await mobileSaveCheck(page, 'deshabilitado, y se lee «No hay cambios que guardar»', (state) => state.disabled && state.hintVisible);
  // AsyncStorage escribe de forma asíncrona: se espera (con techo) a que lo guardado esté en el almacenamiento antes de reabrir
  await waitStoredValues(page, plan.stored);
  const reopenExpected = `al volver a abrir la app y abrir «Perfil» desde «Más», ${cell(row, 'tras_reabrir')}`;
  const reopened = await reopenMobile(context, page, reopenExpected);
  if (reopened.outcome) return reopened.outcome;
  const next = reopened.page;
  const opened = await openProfileMobile(next, reopenExpected);
  if (opened) return opened;
  const notes = [REOPEN_NOTE, NO_ENDPOINT_NOTE, MOBILE_MAIL_NOTE, MOBILE_RULE_NOTE].join(' ');
  return concluded([...before, toast, disabledAfterSave, ...(await after(next))], { note: notes });
};

// --- Esquema 4: el idioma guardado cambia la pantalla y el aviso sale en el idioma anterior ---------------------------

const LANG_LABELS: ReadonlyMap<string, 'English' | 'Español'> = new Map<string, 'English' | 'Español'>([
  ['English', 'English'],
  ['Español', 'Español'],
]);

const saveLangRow: BrowserRowHandler = async (row, { page, context }) => {
  const idioma = strict('idioma', LANG_LABELS, quoted(cell(row, 'idioma')));
  const titulo = quoted(cell(row, 'titulo'));
  const expected = `ve el aviso «${SAVED}», el título de la pantalla es «${titulo}» y el selector muestra «${idioma}»`;
  const arrival = await arriveGestor(page, context);
  if (arrival) return arrival;
  const before = await mobileDefaults(page);
  const failed = await runActions(page, expected, [mobileLang(idioma), pressSave]);
  if (failed) return failed;
  // El aviso se mira en el idioma en el que estaba la pantalla al guardar; después, el título y el selector en el idioma nuevo
  const toast = await toastCheck(page, `ve el aviso «${SAVED}»`);
  return concluded([...before, toast, await profileTitleCheck(page, titulo), await comboCheck(page, idioma)], { note: MOBILE_RULE_NOTE });
};

defineBrowserRows({
  story: 'US-PERFIL-004',
  surface: 'expo-web',
  tenants: [TENANT],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withExpoNote(withNote(HEADER_OBSERVATION_NOTE)(saveEnablesRow))],
    [2, withExpoNote(withNote(HEADER_OBSERVATION_NOTE)(discardRow))],
    [3, withExpoNote(withNote(HEADER_OBSERVATION_NOTE)(saveAndReopenRow))],
    [4, withExpoNote(withNote(HEADER_OBSERVATION_NOTE)(saveLangRow))],
  ]),
});
