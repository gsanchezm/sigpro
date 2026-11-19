import type { Locator, Page } from '@playwright/test';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isEnabled, isVisible, linesOf, pathOf, runSteps, safe, textOf, valueOf, waitUntil, quoted } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../support/framework';
import {
  HINT,
  TERMS_SENTENCE,
  actionMissing,
  afterObserving,
  barColors,
  expectedRuleStates,
  expectedStrength,
  filledBars,
  legalLink,
  meterOf,
  plainValue,
  ruleChecks,
  ruleStates,
  rulesNamed,
  toggleButton,
  visibleStrengthWords,
  watchSubmissions,
} from '../web/common';
import { BACK_APPROXIMATION, DIRECT_APPROXIMATION, buttonNamed, onExpoWeb, onPrograms, openRegisterFromLogin, registerTitle, roleCombobox, seen, signInAsManager, textbox } from './common';

// US-REGISTRO-013 — Formulario de solicitud en la app móvil: elementos, ayudas, medidor y mostrar la contraseña. La app se ejecuta
// como web de Expo a 390 px: NO es iOS ni Android nativo. Preparación de cada fila: reinicio de alumno01, /login con alumno01 en
// «Tenant de trabajo» y «Solicitar acceso» (o carga directa de /register cuando la historia lo pide en la sesión).

const HELP = 'Debe pertenecer a un dominio autorizado.';
const ROLE_HELP = 'El rol admin solo se asigna manualmente.';

/** Campos del formulario en el orden de la historia (de arriba abajo). */
const FIELD_LOCATORS = (page: Page): readonly Locator[] => [
  textbox(page, 'Nombre'),
  textbox(page, 'Apellidos'),
  textbox(page, 'Correo corporativo'),
  textbox(page, 'Organización / Unidad'),
  roleCombobox(page),
  textbox(page, 'Contraseña'),
  textbox(page, 'Confirmar contraseña'),
];

// --- Esquema 1: estado inicial de cada elemento del formulario ----------------------------------------------------------------

const ELEMENTS: ReadonlyMap<string, (page: Page) => Promise<readonly Check[]>> = new Map<string, (page: Page) => Promise<readonly Check[]>>([
  [
    '«Solicitar acceso»',
    async (page) => {
      const title = await isVisible(registerTitle(page));
      const hint = await isVisible(page.getByText(HINT, { exact: true }));
      const roleHelp = await isVisible(page.getByText(ROLE_HELP, { exact: true }));
      // Cada campo debe estar más abajo que el anterior (posición vertical de su caja)
      const tops = await Promise.all(FIELD_LOCATORS(page).map((locator) => locator.boundingBox({ timeout: 500 }).then((box) => box?.y ?? Number.NaN, () => Number.NaN)));
      const inOrder = tops.every((top, index) => Number.isFinite(top) && (index === 0 || top > (tops[index - 1] ?? Number.NEGATIVE_INFINITY)));
      return [
        check(title && hint, `es el título de la pantalla, con el texto «${HINT}»`, `título ${title ? 'visible' : 'ausente'} y texto ${hint ? 'visible' : 'ausente'}`),
        check(roleHelp, `bajo «Rol solicitado» la ayuda «${ROLE_HELP}»`, roleHelp ? `ayuda «${ROLE_HELP}» visible` : 'sin la ayuda del rol'),
        check(inOrder, 'los campos van en el orden de la historia (de arriba abajo)', `posiciones verticales: ${tops.map((top) => Math.round(top)).join(', ')}`),
      ];
    },
  ],
  [
    '«Nombre»',
    async (page) => {
      const empty = (await valueOf(textbox(page, 'Nombre'))) === '';
      return [check(empty, 'está vacío', empty ? 'vacío' : 'con texto')];
    },
  ],
  [
    '«Correo corporativo»',
    async (page) => {
      const empty = (await valueOf(textbox(page, 'Correo corporativo'))) === '';
      const help = await isVisible(page.getByText(HELP, { exact: true }));
      return [check(empty && help, `está vacío y muestra la ayuda «${HELP}»`, `${empty ? 'vacío' : 'con texto'} y ayuda ${help ? 'visible' : 'ausente'}`)];
    },
  ],
  [
    '«Rol solicitado»',
    async (page) => {
      // La caja del selector trae el valor y el indicador «▾»: se compara solo el valor
      const value = (linesOf(await textOf(roleCombobox(page)))[0] ?? '').replace('▾', '').trim();
      return [check(value === 'consultant', 'tiene seleccionado consultant', `tiene seleccionado ${value || '(ninguno)'}`)];
    },
  ],
  [
    '«Contraseña»',
    async (page) => {
      const input = textbox(page, 'Contraseña');
      const empty = (await valueOf(input)) === '';
      const hidden = (await inputTypeOf(input)) === 'password';
      return [check(empty && hidden, 'está vacía y oculta lo que se escribe', `${empty ? 'vacía' : 'con texto'} y ${hidden ? 'oculta' : 'en claro'}`)];
    },
  ],
  [
    'la casilla de condiciones',
    async (page) => {
      const state = await attrOf(page.getByRole('checkbox', { name: TERMS_SENTENCE, exact: true }), 'aria-checked');
      return [check(state === 'false', 'está desmarcada', `aria-checked ${state ?? '(sin atributo)'}`)];
    },
  ],
  [
    '«Enviar solicitud»',
    async (page) => {
      const enabled = await isEnabled(buttonNamed(page, 'Enviar solicitud'));
      return [check(enabled, 'está habilitado', enabled ? 'habilitado' : 'deshabilitado')];
    },
  ],
]);

const initialState: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'elemento')} ${cell(row, 'estado')}`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const observe = strict('elemento', ELEMENTS, cell(row, 'elemento'));
  return conclude(await observe(page));
};

// --- Esquema 2: el control de mostrar la contraseña alterna la visibilidad de las dos contraseñas -----------------------------

const CLICKS: ReadonlyMap<string, number> = new Map([
  ['0', 0],
  ['1', 1],
  ['2', 2],
]);
const VISIBILITY: ReadonlyMap<string, boolean> = new Map([
  ['ocultas', false],
  ['en claro', true],
]);
const PRESSED: ReadonlyMap<string, boolean> = new Map([
  ['sin marcar como pulsado', false],
  ['marcado como pulsado', true],
]);

/** Tipo de cada campo de contraseña (`password` oculta, `text` en claro). */
/**
 * Tipo EFECTIVO del campo (propiedad del elemento, no el atributo): en Expo web un campo en claro no lleva el atributo `type` y su tipo por defecto es `text`.
 * Una lectura fallida da `undefined` y no cuenta ni como oculto ni como en claro.
 */
const inputTypeOf = (target: Locator): Promise<string | undefined> =>
  safe(() => target.first().evaluate((element) => (element instanceof HTMLInputElement ? element.type : undefined), undefined, { timeout: 500 }), undefined);

const typesOf = async (password: Locator, confirm: Locator): Promise<readonly (string | undefined)[]> => [await inputTypeOf(password), await inputTypeOf(confirm)];

const toggling: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const clicks = strict('veces', CLICKS, cell(row, 'veces'));
  const shown = strict('visibilidad', VISIBILITY, cell(row, 'visibilidad'));
  const pressed = strict('pulsado', PRESSED, cell(row, 'pulsado'));
  const label = quoted(cell(row, 'texto'));
  const expected = `${cell(row, 'visibilidad')}; el control muestra «${label}» y ${cell(row, 'pulsado')}; los dos campos siguen con Abcdefghij1!; no envía el formulario`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([
    ['escribir «Contraseña»', () => textbox(page, 'Contraseña').fill('Abcdefghij1!', ACTION)],
    ['escribir «Confirmar contraseña»', () => textbox(page, 'Confirmar contraseña').fill('Abcdefghij1!', ACTION)],
  ]);
  if (typed) return preparationFailedWeb(expected, typed);
  const watch = watchSubmissions(page);
  for (let index = 0; index < clicks; index += 1) {
    const failure = await runSteps([['pulsar el control de la contraseña', () => toggleButton(page).click(ACTION)]]);
    if (failure) return actionMissing(expected, failure);
  }
  const password = textbox(page, 'Contraseña');
  const confirm = textbox(page, 'Confirmar contraseña');
  // Los dos tipos se leen cuando ya son los de la fila: el cambio de `secureTextEntry` puede tardar un render
  const expectedType = shown ? 'text' : 'password';
  const settled = await waitUntil(async () => (await typesOf(password, confirm)).every((type) => type === expectedType), CEILING_MS);
  const types = await typesOf(password, confirm);
  const clear = types.every((type) => type === 'text');
  const hidden = types.every((type) => type === 'password');
  const sent = await afterObserving(watch);
  const control = toggleButton(page);
  const text = linesOf(await textOf(control))[0];
  const name = await attrOf(control, 'aria-label');
  const isPressed = (await attrOf(control, 'aria-pressed')) === 'true';
  const values = [await valueOf(password), await valueOf(confirm)];
  return conclude(
    [
      check(settled.reached && (shown ? clear : hidden), `«Contraseña» y «Confirmar contraseña» se ven ${cell(row, 'visibilidad')}`, `se ven ${clear ? 'en claro' : hidden ? 'ocultas' : 'con tipos mixtos'} (tipos ${types.map(String).join(' y ')})`),
      check(text === label && name === label, `el control muestra «${label}»`, `el control muestra «${text ?? '(sin texto)'}» (nombre «${name ?? '(sin nombre)'}»)`),
      check(isPressed === pressed, cell(row, 'pulsado'), isPressed ? 'marcado como pulsado' : 'sin marcar como pulsado'),
      check(values[0] === 'Abcdefghij1!' && values[1] === 'Abcdefghij1!', 'los dos campos siguen conteniendo Abcdefghij1!', `contienen ${String(values[0])} y ${String(values[1])}`),
      check(sent === 0, 'el control no envía el formulario', `solicitudes enviadas: ${sent}`),
    ],
    { evidence: { tiposObservados: types.map(String) } },
  );
};

// --- Esquema 3: el medidor cuenta las reglas cumplidas y muestra la fuerza ---------------------------------------------------

const BARS: ReadonlyMap<string, number> = new Map([
  ['0', 0],
  ['1', 1],
  ['3', 3],
  ['4', 4],
]);

const meter: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const password = plainValue(cell(row, 'contraseña'));
  const named = rulesNamed(cell(row, 'reglas'));
  const strength = expectedStrength(cell(row, 'fuerza'));
  const bars = BARS.get(cell(row, 'barras'));
  if (bars === undefined) throw new Error(`celda sin interpretación: barras «${cell(row, 'barras')}»`);
  const expected = `reglas ${cell(row, 'reglas')}; fuerza ${cell(row, 'fuerza')}; ${bars} de 4 barras`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const gauge = meterOf(page);
  const baseline = await barColors(gauge);
  const typed = await runSteps([['escribir «Contraseña»', () => textbox(page, 'Contraseña').fill(password, ACTION)]]);
  if (typed) return actionMissing(expected, typed);
  const states = await ruleStates(gauge);
  // El texto de la fuerza se ve en la pantalla en móvil: se cuenta solo lo visible
  const words = await visibleStrengthWords(gauge);
  const colors = await barColors(gauge);
  const filled = filledBars(baseline, colors);
  const strengthOk = strength === undefined ? words.length === 0 : words.length === 1 && words[0] === strength;
  return conclude([
    ...ruleChecks(states, expectedRuleStates(named)),
    check(strengthOk, strength === undefined ? 'sin texto de fuerza' : `la fuerza es «${strength}» y se ve en la pantalla`, `texto de fuerza visible: ${words.length === 0 ? 'ninguno' : words.join(', ')}`),
    check(colors.length === 4 && filled === bars, `el medidor rellena ${bars} de sus cuatro barras`, `rellena ${filled} de ${colors.length} barras`),
  ]);
};

// --- Esquema 4: los enlaces legales se abren dentro de la app sin perder lo escrito --------------------------------------------

const LEGAL_ROUTES: ReadonlySet<string> = new Set(['/legal/terms', '/legal/privacy']);

const legal: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const linkName = quoted(cell(row, 'enlace'));
  const route = cell(row, 'ruta');
  if (!LEGAL_ROUTES.has(route)) throw new Error(`celda sin interpretación: ruta «${route}»`);
  const expected = `llega a ${route} dentro de la app; al volver ve el formulario con Ana escrita en «Nombre»`;
  const opened = await openRegisterFromLogin(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const typed = await runSteps([['escribir «Nombre»', () => textbox(page, 'Nombre').fill('Ana', ACTION)]]);
  if (typed) return actionMissing(expected, typed);
  const clicked = await runSteps([['pulsar el enlace', () => legalLink(page, linkName).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === route, CEILING_MS);
  const back = await runSteps([['volver a la pantalla anterior', () => page.goBack({ timeout: CEILING_MS })]]);
  const returned = await waitUntil(() => isVisible(registerTitle(page)), CEILING_MS);
  const kept = (await valueOf(textbox(page, 'Nombre'))) === 'Ana';
  return conclude(
    [
      check(arrived.reached, `llega a ${route} dentro de la app`, arrived.reached ? `llega a ${route}` : `no llega a ${route} (ruta ${pathOf(page)})`),
      check(back === undefined && returned.reached && kept, 'al volver ve el formulario con Ana escrita en «Nombre»', back !== undefined ? `no se puede volver: ${back}` : returned.reached ? (kept ? 've el formulario con Ana escrita en «Nombre»' : 'el formulario no conserva Ana') : 'no vuelve al formulario'),
    ],
    { note: BACK_APPROXIMATION },
  );
};

// --- Esquema 5: con una sesión iniciada no se pide acceso ---------------------------------------------------------------------

const SESSIONS: ReadonlyMap<string, string> = new Map([['gestor@sigpro.test', 'gestor@sigpro.test']]);

const withSession: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const account = strict('sesion', SESSIONS, cell(row, 'sesion'));
  const expected = `llega a /programs sin ver el formulario de solicitud (sesión de ${account})`;
  const signed = await signInAsManager(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await runSteps([['abrir /register', () => page.goto('/register', { timeout: CEILING_MS })]]);
  if (opened) return actionMissing(expected, opened);
  const arrived = await waitUntil(() => onPrograms(page), CEILING_MS);
  // Si la comprobación es ambigua (más de un título), no se da por cumplido «sin ver el formulario»: cuenta como visible
  const form = await safe(() => seen(registerTitle(page)), true);
  return conclude(
    [
      check(arrived.reached, 'llega a /programs', arrived.reached ? 'llega a /programs' : `no llega a /programs (ruta ${pathOf(page)})`),
      check(!form, 'sin ver el formulario de solicitud', form ? 'se ve el formulario de solicitud' : 'sin formulario de solicitud'),
    ],
    { note: DIRECT_APPROXIMATION },
  );
};

defineBrowserRows({
  story: 'US-REGISTRO-013',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(initialState)],
    [2, onExpoWeb(toggling)],
    [3, onExpoWeb(meter)],
    [4, onExpoWeb(legal)],
    [5, onExpoWeb(withSession)],
  ]),
});
