import type { BrowserContext, Locator, Page } from '@playwright/test';
import { PERFIL_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, CEILING_MS, isVisible, linesOf, pathOf, safe, waitUntil } from '../../support/browser';
import { check, type Check } from '../../support/checks';
import { outcome, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  COOKIE_NOTE,
  MFA_CODE,
  NO_CHANGES,
  PREP_NOTE,
  TENANT,
  checkedState,
  disabledOf,
  notOffered,
  notReached,
  onProfile,
  readOne,
  rootOf,
  runDiagnosed,
  saveButton,
  sectionHeading,
  visibleOf,
  type Action,
  type Read,
} from '../web/common';

// Piezas comunes de las filas de «Perfil» en la app móvil servida como web de Expo (390 × 844). NO es la app nativa: el veredicto
// vale para Expo web. Los controles de estado (interruptor, casilla y opciones de tema) se localizan por su identificador de prueba
// (el de `testids.ts`, que la app móvil reutiliza) y su estado se lee del atributo `aria-checked`, que debe ser `true` o `false`;
// «Guardar», el selector de idioma y la hoja de opciones se localizan por rol y nombre accesible dentro de `profile-page`.

export const EXPO_NOTE = 'El veredicto vale para Expo web (390 × 844): la app móvil servida como web, no el nativo; no se ha comprobado en iOS ni en Android nativo. El tema del sistema se fija en claro (emulateMedia) para que el tema inicial sea «Claro».';
export const REOPEN_NOTE = 'Cerrar la app y volver a abrirla se aproxima cerrando la página y abriendo otra en el mismo contexto de navegador (la sesión y las preferencias guardadas se conservan); no reinicia el proceso nativo.';
export const MOBILE_MAIL_NOTE = '«no envía ningún correo» no se comprueba en móvil: toda la persistencia es local (AsyncStorage, que en web es localStorage) y no hay petición de envío que discrimine; no es un veredicto.';
export const MOBILE_RULE_NOTE = 'Reglas sin fila en móvil: «cambiar un control no aplica nada» no se ve en el DOM del tema (la app no cambia el tema hasta «Guardar», pero no hay atributo que lo muestre); «si un control vuelve a su valor guardado…» solo se prueba con el idioma.';

/** Añade a cada resultado de la app móvil la salvedad de Expo web, la preparación y la nota de cookies. */
export const withExpoNote = (handler: BrowserRowHandler): BrowserRowHandler => async (row, fixtures) => {
  const result = await handler(row, fixtures);
  const note = `${EXPO_NOTE} ${COOKIE_NOTE} ${PREP_NOTE}`;
  return { ...result, note: result.note === undefined ? note : `${result.note} ${note}` };
};

// --- Localizadores de la app móvil ------------------------------------------------------------------------------------------

const textbox = (page: Page, name: string): Locator => page.getByRole('textbox', { name, exact: true });
const button = (page: Page, name: string): Locator => page.getByRole('button', { name, exact: true });
const heading1 = (page: Page, name: string): Locator => page.getByRole('heading', { name, level: 1, exact: true });

export const tabNamed = (page: Page, name: string): Locator => page.getByRole('tab', { name, exact: true });
export const moreTab = (page: Page): Locator => tabNamed(page, 'Más');
export const programsTab = (page: Page): Locator => tabNamed(page, 'Programas');
/** El enlace «Perfil» de la pestaña «Más» (el menú de la app). */
export const moreProfileLink = (page: Page): Locator => page.getByRole('link', { name: 'Perfil', exact: true });

/** El selector de idioma: su nombre accesible cambia con el idioma guardado, así que se localiza por su identificador de prueba. */
export const langCombo = (page: Page): Locator => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_LANG);
/** Opciones de «Tema» («Claro» y «Oscuro»): cada una tiene su identificador de prueba y su `aria-checked`. */
export const themeRadio = (page: Page, name: string): Locator => rootOf(page).getByTestId(name === 'Claro' ? PERFIL_TESTIDS.PROFILE_THEME_LIGHT : PERFIL_TESTIDS.PROFILE_THEME_DARK);
/** El interruptor «Notificaciones en tiempo real» (`role=switch`, `aria-checked`). */
export const liveSwitchM = (page: Page): Locator => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_LIVE);
/** La casilla del resumen semanal (`role=checkbox`, `aria-checked`). */
export const digestBoxM = (page: Page): Locator => rootOf(page).getByTestId(PERFIL_TESTIDS.PROFILE_DIGEST);
/** El texto que aparece bajo «Guardar» cuando no hay cambios. */
export const noChangesHint = (page: Page): Locator => rootOf(page).getByText(NO_CHANGES, { exact: true });

const loginTitle = (page: Page): Locator => heading1(page, 'Iniciar sesión');
const mfaTitle = (page: Page): Locator => heading1(page, 'Verificación en dos pasos');
const codeField = (page: Page): Locator => textbox(page, 'Código de verificación');
const isShell = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(moreTab(page)));
const alertText = async (page: Page): Promise<string | undefined> => linesOf(await safe(() => page.getByRole('alert').first().innerText({ timeout: 1000 }), undefined))[0];

/** `aria-checked` de un control de estado de RN-web: debe ser `true` o `false`; si falta, la lectura no es válida. */
export const ariaCheckedOf = async (found: Locator): Promise<boolean> => {
  const value = await found.getAttribute('aria-checked', { timeout: 1000 });
  if (value !== 'true' && value !== 'false') throw new Error(`aria-checked ausente o no booleano («${value ?? 'sin atributo'}»)`);
  return value === 'true';
};

/** Lectura de `aria-checked` con espera: espera (con techo) a que esté como se pide y devuelve la última lectura. */
export const checkedAttrSettled = async (target: Locator, want: boolean, ceilingMs: number = 3_000): Promise<Read<boolean>> => {
  await waitUntil(async () => {
    const current = await readOne(target, ariaCheckedOf);
    return current.ok && current.value === want;
  }, ceilingMs);
  return readOne(target, ariaCheckedOf);
};

/** El texto del selector de idioma sin su flecha («▾»): el idioma de la opción elegida. */
export const comboLabel = (page: Page): Promise<Read<string>> =>
  readOne(langCombo(page), async (found) => ((await found.textContent({ timeout: 1000 })) ?? '').replace('▾', '').trim());

/** Idioma del selector con espera: tras guardar en otro idioma el texto cambia un instante después. */
export const comboCheckSettled = async (page: Page, label: string): Promise<Check> => {
  await waitUntil(async () => {
    const current = await comboLabel(page);
    return current.ok && current.value === label;
  }, 3_000);
  const read = await comboLabel(page);
  return check(read.ok && read.value === label, `el selector muestra «${label}»`, read.ok ? `el selector muestra «${read.value}»` : read.reason);
};

/** Preparación común: tema claro del sistema, la app abierta en /login, «Tenant de trabajo» y el inicio de sesión de la fila. */
export const signInMobile = async (page: Page, expected: string, email: string, password: string, mfa: boolean): Promise<Outcome | undefined> => {
  const opened = await runDiagnosed([
    { what: 'fijar el tema claro del sistema', act: () => page.emulateMedia({ colorScheme: 'light' }) },
    { what: 'abrir /login', act: () => page.goto('/login', { timeout: CEILING_MS }) },
    { what: 'ver el título «Iniciar sesión»', act: () => loginTitle(page).waitFor({ timeout: CEILING_MS }), target: loginTitle(page) },
    // Un solo `fill`: el campo vuelve a `demo` al quedar vacío, así que escribir carácter a carácter tras borrar daría otro tenant
    { what: 'escribir el tenant en «Tenant de trabajo»', act: () => textbox(page, 'Tenant de trabajo').fill(TENANT, ACTION), target: textbox(page, 'Tenant de trabajo') },
    { what: 'escribir el correo', act: () => textbox(page, 'Correo electrónico').fill(email, ACTION), target: textbox(page, 'Correo electrónico') },
    { what: 'escribir la contraseña', act: () => textbox(page, 'Contraseña').fill(password, ACTION), target: textbox(page, 'Contraseña') },
    { what: 'pulsar «Entrar»', act: () => button(page, 'Entrar').click(ACTION), target: button(page, 'Entrar') },
  ]);
  if (opened) return notReached(expected, opened);
  // Espera primero a la verificación o a la app; el aviso de error solo se lee si ninguna de las dos llega
  await waitUntil(async () => (await isVisible(mfaTitle(page))) || (await isShell(page)), CEILING_MS);
  if (await isVisible(mfaTitle(page))) return completeSecondStepMobile(page, expected, mfa);
  if (await isShell(page)) return mfa ? outcome(false, expected, `entra sin segundo paso (ruta ${pathOf(page)})`, { note: 'La historia da por hecho el segundo paso de esta cuenta.' }) : undefined;
  const alert = await alertText(page);
  if (alert !== undefined) return outcome(false, expected, `la app rechaza la cuenta: «${alert}»`, { note: 'La cuenta no inicia sesión como dice la historia.' });
  return outcome(false, expected, `tras «Entrar» sigue en ${pathOf(page)} sin aviso`, { note: 'La cuenta no inicia sesión como dice la historia.' });
};

const completeSecondStepMobile = async (page: Page, expected: string, mfa: boolean): Promise<Outcome | undefined> => {
  if (!mfa) return outcome(false, expected, 'pide un segundo paso', { note: 'La historia no pide segundo paso a esta cuenta.' });
  const sent = await runDiagnosed([
    { what: 'limpiar «Código de verificación»', act: () => codeField(page).fill('', ACTION), target: codeField(page) },
    { what: 'escribir el código 123456', act: () => codeField(page).pressSequentially(MFA_CODE, { delay: 0 }), target: codeField(page) },
    { what: 'pulsar «Verificar»', act: () => button(page, 'Verificar').click(ACTION), target: button(page, 'Verificar') },
  ]);
  if (sent) return notReached(expected, sent);
  const arrived = await waitUntil(() => isShell(page));
  return arrived.reached ? undefined : outcome(false, expected, `tras «Verificar» no llega a /programs (ruta ${pathOf(page)})`, { note: 'El segundo paso no deja la sesión abierta.' });
};

/** «Más» → «Perfil», como lo hace una persona desde las pestañas. Espera a que las preferencias estén pintadas. */
export const openProfileMobile = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const tab = await runDiagnosed([{ what: 'abrir la pestaña «Más»', act: () => moreTab(page).click(ACTION), target: moreTab(page) }]);
  if (tab) return notReached(expected, tab);
  const offered = await waitUntil(() => isVisible(moreProfileLink(page)), 3_500);
  if (!offered.reached) return notOffered(expected, `con la pestaña «Más» abierta, no ofrece «Perfil» (ruta ${pathOf(page)})`, 'La app no ofrece «Perfil» en la pestaña «Más».');
  const clicked = await runDiagnosed([{ what: 'pulsar «Perfil»', act: () => moreProfileLink(page).click(ACTION), target: moreProfileLink(page) }]);
  if (clicked) return notReached(expected, clicked);
  const arrived = await waitUntil(() => onProfile(page));
  if (!arrived.reached) return outcome(false, expected, `tras «Perfil» la ruta es ${pathOf(page)}`, { note: 'No se llega a /profile desde «Más».' });
  // Las preferencias se pintan cuando la app termina de leer el almacenamiento: si no aparecen, la prueba no llegó a la pantalla
  const shown = await waitUntil(() => isVisible(sectionHeading(page, 'Preferencias')), CEILING_MS);
  return shown.reached ? undefined : notReached(expected, 'la sección «Preferencias» no aparece en «Perfil»: la prueba no llegó a la pantalla');
};

/** Sale de «Perfil» por la pestaña «Programas» (la pila de «Más» se vacía al cambiar de pestaña) y vuelve a abrirlo desde «Más». */
export const leaveAndReturnMobile = async (page: Page, expected: string): Promise<Outcome | undefined> => {
  const left = await runDiagnosed([{ what: 'abrir la pestaña «Programas»', act: () => programsTab(page).click(ACTION), target: programsTab(page) }]);
  if (left) return notReached(expected, left);
  const inShell = await waitUntil(() => isShell(page));
  if (!inShell.reached) return outcome(false, expected, `tras «Programas» la ruta es ${pathOf(page)}`, { note: 'La pestaña «Programas» no lleva a la app.' });
  return openProfileMobile(page, expected);
};

/**
 * «Cerrar la app y volver a abrirla»: se aproxima cerrando la página y abriendo otra en el MISMO contexto en la raíz. Así se
 * conservan el almacenamiento y la sesión, y la app arranca de nuevo. No reinicia el proceso nativo.
 */
export const reopenMobile = async (context: BrowserContext, previous: Page, expected: string): Promise<{ readonly page: Page; readonly outcome?: Outcome }> => {
  const next = await context.newPage();
  await previous.close();
  const opened = await runDiagnosed([
    { what: 'fijar el tema claro del sistema', act: () => next.emulateMedia({ colorScheme: 'light' }) },
    { what: 'volver a abrir la app (su raíz)', act: () => next.goto('/', { timeout: CEILING_MS }) },
  ]);
  if (opened) return { page: next, outcome: notReached(expected, opened) };
  const back = await waitUntil(() => isShell(next));
  return back.reached ? { page: next } : { page: next, outcome: outcome(false, expected, `tras volver a abrir la app la ruta es ${pathOf(next)}`, { note: 'La app no vuelve a la pestaña «Programas» al abrirla.' }) };
};

/**
 * Espera (con techo) a que la app escriba en el almacenamiento los valores guardados: AsyncStorage escribe de forma asíncrona y la
 * reapertura solo tiene sentido después. Devuelve si llegaron; si no llegan, la comprobación de la reapertura lo hará visible.
 */
export const waitStoredValues = async (page: Page, values: Readonly<Record<string, string>>): Promise<boolean> => {
  const keys = Object.keys(values);
  const waited = await waitUntil(async () => {
    const stored = await safe<(string | null)[] | undefined>(() => page.evaluate((list: readonly string[]) => list.map((key) => localStorage.getItem(key)), keys), undefined);
    return stored !== undefined && keys.every((key, index) => stored[index] === values[key]);
  }, 3_000);
  return waited.reached;
};

// --- Estado de «Guardar» en la app móvil: deshabilitado o no, y si se lee «No hay cambios que guardar» ------------------------

export interface MobileSave {
  readonly disabled: boolean;
  readonly hintVisible: boolean;
}

export const mobileSaveState = async (page: Page): Promise<Read<MobileSave>> => {
  const disabled = await readOne(saveButton(page), disabledOf);
  if (!disabled.ok) return disabled;
  const hint = await readOne(noChangesHint(page), visibleOf);
  // «No aparece» es una lectura válida (el texto no está); cualquier otra falla no cumple
  if (!hint.ok && hint.reason !== 'no aparece') return hint;
  return { ok: true, value: { disabled: disabled.value, hintVisible: hint.ok ? hint.value : false } };
};

export const describeMobileSave = (read: Read<MobileSave>): string => {
  if (!read.ok) return read.reason;
  return `${read.value.disabled ? 'deshabilitado' : 'habilitado'}, ${read.value.hintVisible ? 'se lee' : 'no se lee'} «${NO_CHANGES}»`;
};

/** Espera (con techo) al estado pedido de «Guardar» y lo devuelve, cumpla o no. */
export const settledMobileSave = async (page: Page, wanted: (state: MobileSave) => boolean): Promise<Read<MobileSave>> => {
  await waitUntil(async () => {
    const current = await mobileSaveState(page);
    return current.ok && wanted(current.value);
  }, 3_000);
  return mobileSaveState(page);
};

/** Comprobación de «Guardar» en la app móvil frente al texto de la historia. */
export const mobileSaveCheck = async (page: Page, expected: string, wanted: (state: MobileSave) => boolean): Promise<Check> => {
  const read = await settledMobileSave(page, wanted);
  return check(read.ok && wanted(read.value), `«Guardar» está ${expected}`, describeMobileSave(read));
};

/** Estado inicial «sin cambios» de la historia móvil: idioma, tema, interruptor, casilla y «Guardar» con su texto. */
export const mobileDefaults = async (page: Page): Promise<Check[]> => {
  const lang = await comboLabel(page);
  const theme = await checkedAttrSettled(themeRadio(page, 'Claro'), true);
  const live = await readOne(liveSwitchM(page), ariaCheckedOf);
  const digest = await readOne(digestBoxM(page), ariaCheckedOf);
  const save = await settledMobileSave(page, (state) => state.disabled && state.hintVisible);
  return [
    check(lang.ok && lang.value === 'Español', 'el idioma es «Español»', lang.ok ? `el idioma es «${lang.value}»` : lang.reason),
    checkedState(theme, true, 'el tema es «Claro» (seleccionado)', 'seleccionado', 'sin seleccionar'),
    checkedState(live, true, 'el interruptor «Notificaciones en tiempo real» está activado', 'activado', 'desactivado'),
    checkedState(digest, false, 'la casilla del resumen semanal está desmarcada', 'marcada', 'sin marcar'),
    check(save.ok && save.value.disabled && save.value.hintVisible, `«Guardar» deshabilitado y se lee «${NO_CHANGES}»`, describeMobileSave(save)),
  ];
};

// --- Acciones móviles (cada una comprueba que el control refleja el cambio) -----------------------------------------------

/** Elige un idioma: abre el selector, toca la opción en la hoja y la hoja se cierra. */
export const mobileLang = (label: 'English' | 'Español'): Action => ({
  what: `cambiar el idioma a «${label}»`,
  target: langCombo,
  act: async (found, page) => {
    await found.click(ACTION);
    await page.getByRole('radiogroup', { name: 'Idioma de la interfaz', exact: true }).getByRole('radio', { name: label, exact: true }).click(ACTION);
  },
  applied: (page) => comboCheckSettled(page, label),
});

export const mobileTheme = (name: 'Claro' | 'Oscuro'): Action => ({
  what: `marcar el tema «${name}»`,
  target: (page) => themeRadio(page, name),
  act: (found) => found.click(ACTION),
  applied: async (page) => checkedState(await checkedAttrSettled(themeRadio(page, name), true), true, `la opción «${name}» queda seleccionada`, 'seleccionada', 'sin seleccionar'),
});

export const mobileLive: Action = {
  what: 'pulsar el interruptor «Notificaciones en tiempo real»',
  target: liveSwitchM,
  act: (found) => found.click(ACTION),
  applied: async (page) => checkedState(await checkedAttrSettled(liveSwitchM(page), false), false, 'el interruptor «Notificaciones en tiempo real» queda desactivado', 'activado', 'desactivado'),
};

export const mobileDigest: Action = {
  what: 'pulsar la casilla del resumen semanal',
  target: digestBoxM,
  act: (found) => found.click(ACTION),
  applied: async (page) => checkedState(await checkedAttrSettled(digestBoxM(page), true), true, 'la casilla del resumen semanal queda marcada', 'marcada', 'sin marcar'),
};
