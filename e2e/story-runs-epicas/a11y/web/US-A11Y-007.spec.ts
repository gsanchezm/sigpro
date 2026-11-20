import type { Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, attrOf, safe, type Step } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  ALUMNO_ADMIN,
  COOKIE_NOTE,
  describeNamed,
  focusCheck,
  focusedNamed,
  focusRingCheck,
  heading1,
  openLogin,
  prepFailed,
  programRow,
  programsTitle,
  quietCookies,
  resetAlumno,
  settle,
  signInToPrograms,
  runStepsLogged,
} from './common';

// US-A11Y-007 — Recorrer y accionar la pantalla solo con el teclado (web de 1440 px).
// Preparación de cada fila: reinicio de alumno01 y sesión desde el formulario de acceso. Los puntos de partida que la historia da
// por hechos («el foco está en…») se comprueban antes de actuar; si no se cumplen, la fila es una preparación fallida. Lo que se
// comprueba después es lo que tiene el foco (lectura de `:focus`), no el elemento que la prueba buscó.
// El contorno de foco (2 px, `--accent`) se mide en las filas en que el foco cae sobre un botón o un enlace.

// --- Esquema 1: Tab recorre la tarjeta de acceso en orden de lectura ------------------------------------------------------------

const TAB_TARGETS: ReadonlyMap<string, { readonly name: string; readonly role?: string }> = new Map<string, { readonly name: string; readonly role?: string }>([
  ['el botón «¿Olvidaste la contraseña?»', { name: '¿Olvidaste la contraseña?', role: 'button' }],
  ['el campo «Contraseña»', { name: 'Contraseña' }],
  ['el botón «Mostrar contraseña»', { name: 'Mostrar contraseña', role: 'button' }],
  ['la casilla «Mantener la sesión en este equipo»', { name: 'Mantener la sesión en este equipo', role: 'checkbox' }],
  ['el botón «Entrar»', { name: 'Entrar', role: 'button' }],
  ['el botón «Acceder con certificado digital / SSO»', { name: 'Acceder con certificado digital / SSO', role: 'button' }],
]);

const VECES: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['5', 5],
  ['6', 6],
]);

const tabOrder: BrowserRowHandler = async (row, { page, context }) => {
  const veces = strict('veces', VECES, cell(row, 'veces'));
  const wanted = strict('control', TAB_TARGETS, cell(row, 'control'));
  const expected = `tras ${veces} Tab el foco está en ${cell(row, 'control')}`;
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  // Punto de partida de la historia: el foco ya está en «Correo electrónico» al abrir el formulario
  const start = await focusCheck(page, 'Correo electrónico');
  if (!start.ok) return prepFailed(expected, `punto de partida: ${start.observed}`);
  const presses: readonly Step[] = Array.from({ length: veces }, (_, index): Step => [`pulsar Tab (${index + 1})`, () => page.keyboard.press('Tab')]);
  const tabbed = await runStepsLogged(presses);
  if (tabbed) return prepFailed(expected, tabbed);
  // El contorno de foco de la historia es para botones y enlaces: solo se mide cuando el foco cae en uno de ellos
  const ring = wanted.role === 'button' || wanted.role === 'link' ? [await focusRingCheck(page)] : [];
  return conclude([await focusCheck(page, wanted.name, wanted.role), ...ring], { note: COOKIE_NOTE });
};

// --- Esquema 2: el menú de acciones de una fila se maneja con el teclado -------------------------------------------------------

const MENU_KEYS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['Intro', ['Enter']],
  ['Intro y después la flecha de abajo', ['Enter', 'ArrowDown']],
  ['Intro y después Fin', ['Enter', 'End']],
  ['Intro y después Esc', ['Enter', 'Escape']],
]);

const MENU_RESULTS: ReadonlyMap<string, { readonly focus: string; readonly open: boolean }> = new Map<string, { readonly focus: string; readonly open: boolean }>([
  ['se abre el menú y el foco está en «Ver detalle»', { focus: 'Ver detalle', open: true }],
  ['el foco está en «Editar»', { focus: 'Editar', open: true }],
  ['el foco está en «Eliminar»', { focus: 'Eliminar', open: true }],
  ['el menú se cierra y el foco vuelve al botón «Acciones para PRG-001»', { focus: 'Acciones para PRG-001', open: false }],
]);

const rowMenu: BrowserRowHandler = async (row, { page, context }) => {
  const keys = strict('teclas', MENU_KEYS, cell(row, 'teclas'));
  const result = strict('resultado', MENU_RESULTS, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, ALUMNO_ADMIN.email, ALUMNO_ADMIN.password);
  if (signed) return prepFailed(expected, signed);
  // El foco se pone en el botón de la fila (punto de partida de la historia), sin pulsarlo
  const button = programRow(page, 'PRG-001').getByRole('button');
  const focused = await runStepsLogged([['dar el foco al botón «Acciones para PRG-001»', () => button.focus({ timeout: CEILING_MS })]]);
  if (focused) return prepFailed(expected, focused);
  const start = await focusCheck(page, 'Acciones para PRG-001', 'button');
  if (!start.ok) return prepFailed(expected, `punto de partida: ${start.observed}`);
  const pressed = await runStepsLogged(keys.map((key): Step => [`pulsar ${key}`, () => page.keyboard.press(key)]));
  if (pressed) return prepFailed(expected, pressed);
  const menuOpen = await settle(
    async () => (await safe(() => page.getByRole('menu', { name: 'Acciones para PRG-001', exact: true }).count(), 0)) === 1,
    (open) => open === result.open,
  );
  const focus = await focusCheck(page, result.focus);
  return conclude(
    [check(menuOpen.ok, result.open ? 'el menú está abierto' : 'el menú está cerrado', menuOpen.value ? 'el menú está abierto' : 'el menú está cerrado'), focus],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 3: Tab salta el contenido al principio de una página con sesión ----------------------------------------------------

/** La pantalla de la fila: la página con sesión a la que se llega (documento nuevo). */
const SCREENS_OF_ROW: ReadonlyMap<string, string> = new Map([['/programs', '/programs']]);

const skipToContent: BrowserRowHandler = async (row, { page, context }) => {
  const ruta = strict('pantalla', SCREENS_OF_ROW, cell(row, 'pantalla'));
  const expected = 'Tab lleva a «Saltar al contenido» y Intro lleva el foco al contenido principal';
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  // Un documento nuevo: el foco empieza al inicio de la página, como al llegar desde la barra de direcciones
  const reloaded = await runStepsLogged([
    [`recargar ${ruta}`, () => page.goto(ruta, { timeout: CEILING_MS })],
    ['ver el título «Programas»', () => programsTitle(page).waitFor({ timeout: CEILING_MS })],
  ]);
  if (reloaded) return prepFailed(expected, reloaded);
  const atStart = await safe(() => page.evaluate(() => document.activeElement === document.body), false);
  if (!atStart) return prepFailed(expected, 'el foco no está al inicio de la página tras llegar a /programs');
  const tabbed = await runStepsLogged([['pulsar Tab', () => page.keyboard.press('Tab')]]);
  if (tabbed) return prepFailed(expected, tabbed);
  const skip = await focusCheck(page, 'Saltar al contenido', 'link');
  const ring = await focusRingCheck(page);
  const entered = await runStepsLogged([['pulsar Intro', () => page.keyboard.press('Enter')]]);
  if (entered) return prepFailed(expected, entered);
  const main = page.getByRole('main');
  const inMain = await settle(
    () => safe(() => main.evaluate((element) => element === document.activeElement, undefined, { timeout: 1_000 }), false),
    (value) => value === true,
  );
  return conclude(
    [
      skip,
      ring,
      check(inMain.ok, 'el foco está en el contenido principal de la página', inMain.ok ? 'el foco está en el contenido principal de la página' : 'el foco no está en el contenido principal de la página'),
    ],
    { note: `${COOKIE_NOTE} El foco al inicio se establece con una recarga de /programs (documento nuevo); se comprueba que no hay elemento enfocado antes del Tab.` },
  );
};

// --- Esquema 4: el árbol de requisitos responde a las teclas de la fila que tiene el foco ---------------------------------------

const TREE_KEYS: ReadonlyMap<string, string> = new Map([
  ['la flecha de la izquierda', 'ArrowLeft'],
  ['F2', 'F2'],
  ['Inicio', 'Home'],
]);

/** El foco está en la fila del árbol de ese código (su nombre accesible empieza por el código y un espacio). */
const treeRowFocus = async (page: Page, code: string, label: string): Promise<Check> => {
  const focused = await settle(
    () => focusedNamed(page),
    (named) => named?.name.startsWith(`${code} `) === true,
    2_000,
  );
  return check(focused.ok, label, `el foco está en ${describeNamed(focused.value)}`);
};

const TREE_RESULTS: ReadonlyMap<string, (page: Page) => Promise<Check>> = new Map<string, (page: Page) => Promise<Check>>([
  ['el foco pasa a la fila de su padre, REQ-015', (page) => treeRowFocus(page, 'REQ-015', 'el foco pasa a la fila de su padre, REQ-015')],
  ['se abre la edición del título de REQ-016', (page) => focusCheck(page, 'Título de REQ-016', 'textbox')],
  ['el foco está en la fila de REQ-015, la primera de primer nivel del programa', (page) => treeRowFocus(page, 'REQ-015', 'el foco está en la fila de REQ-015, la primera de primer nivel del programa')],
]);

const treeKeys: BrowserRowHandler = async (row, { page, context }) => {
  const tecla = cell(row, 'tecla');
  const key = strict('tecla', TREE_KEYS, tecla);
  const result = strict('resultado', TREE_RESULTS, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const opened = await runStepsLogged([
    ['abrir /programs/PRG-002/requirements', () => page.goto('/programs/PRG-002/requirements', { timeout: CEILING_MS })],
    ['ver el árbol de requisitos', () => page.getByRole('tree').waitFor({ timeout: CEILING_MS })],
  ]);
  if (opened) return prepFailed(expected, opened);
  // Punto de partida: REQ-015 desplegado y el foco en la fila de REQ-016 (se da el foco a la fila, no se pulsa)
  const expanded = await attrOf(page.getByRole('treeitem', { name: /^REQ-015 / }), 'aria-expanded');
  if (expanded !== 'true') return prepFailed(expected, `REQ-015 no está desplegado (aria-expanded ${expanded ?? '(sin atributo)'})`);
  const placed = await runStepsLogged([['dar el foco a la fila de REQ-016', () => page.getByRole('treeitem', { name: /^REQ-016 / }).focus({ timeout: CEILING_MS })]]);
  if (placed) return prepFailed(expected, placed);
  const start = await treeRowFocus(page, 'REQ-016', 'el foco está en la fila de REQ-016');
  if (!start.ok) return prepFailed(expected, `punto de partida: ${start.observed}`);
  const pressed = await runStepsLogged([[`pulsar ${tecla}`, () => page.keyboard.press(key)]]);
  if (pressed) return prepFailed(expected, pressed);
  return conclude([await result(page)], { note: COOKIE_NOTE });
};

defineBrowserRows({
  story: 'US-A11Y-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, tabOrder],
    [2, rowMenu],
    [3, skipToContent],
    [4, treeKeys],
  ]),
});
