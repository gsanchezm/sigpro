import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, CEILING_MS, attrOf, isVisible, noSessionCheck, pathOf, safe } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  describedByText,
  enterButton,
  failedAction,
  focusCheck,
  heading1,
  namedOf,
  noticeBelow,
  openLogin,
  prepFailed,
  programsTitle,
  quietCookies,
  resetAlumno,
  settle,
  submitLogin,
  typeCredentials,
  runStepsLogged,
} from './common';

// US-A11Y-002 — Campos con etiqueta visible, texto de ejemplo distinto y aviso ligado al campo (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 y formularios abiertos en un navegador sin sesión guardada.
// Los campos se localizan por su posición en el formulario (un campo sin nombre no se encuentra por su nombre) y su etiqueta, su
// ejemplo y su aviso se LEEN del propio campo (`labels`, `placeholder`, `aria-describedby`).

const REGISTER_PATH = `/register?tenant=${TENANT_A}`;
const NONE = '(ninguno)';

/** Campos de los formularios por su posición en el formulario (orden del DOM). */
const FIELDS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['Correo electrónico', (page) => page.locator('form input').nth(0)],
  ['Contraseña', (page) => page.locator('form input[type="password"]')],
  ['Nombre', (page) => page.locator('form input').nth(0)],
  ['Correo corporativo', (page) => page.locator('form input[type="email"]')],
  ['Organización / Unidad', (page) => page.locator('form input').nth(3)],
  ['Código de verificación', (page) => page.locator('form input')],
]);

/** Texto de la etiqueta asociada del campo (`<label for>`), o `undefined` si no hay. */
const labelOf = (field: Locator): Promise<string | undefined> =>
  safe(
    () => field.evaluate((element) => (element as HTMLInputElement).labels?.[0]?.textContent?.trim(), undefined, { timeout: 1_000 }),
    undefined,
  );

/** La etiqueta asociada se ve (tiene caja y no está oculta). */
const labelVisible = (field: Locator): Promise<boolean> =>
  safe(
    () =>
      field.evaluate(
        (element) => {
          const label = (element as HTMLInputElement).labels?.[0];
          if (!label) return false;
          const box = label.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && getComputedStyle(label).visibility !== 'hidden';
        },
        undefined,
        { timeout: 1_000 },
      ),
    false,
  );

// --- Esquema 1: cada campo se anuncia con su etiqueta y su ejemplo --------------------------------------------------------------

const PREVIOUS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  [
    'una persona sin sesión iniciada está en /login?tenant=alumno01',
    (page) => runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]),
  ],
  [
    'una persona sin sesión iniciada está en /register?tenant=alumno01',
    (page) => runStepsLogged([['abrir /register?tenant=alumno01', () => page.goto(REGISTER_PATH, { timeout: CEILING_MS })], ['ver el título «Solicitar acceso»', () => heading1(page, 'Solicitar acceso').waitFor({ timeout: CEILING_MS })]]),
  ],
  [
    'admin@sigpro.test ha escrito Admin1234! en /login?tenant=alumno01 y ha pulsado «Entrar»',
    (page) =>
      runStepsLogged([
        openLogin(page),
        ...typeCredentials(page, DEMO.admin.email, DEMO.admin.password),
        submitLogin(page),
        ['ver «Verificación en dos pasos»', () => heading1(page, 'Verificación en dos pasos').waitFor({ timeout: CEILING_MS })],
      ]),
  ],
]);

const labelsAndExamples: BrowserRowHandler = async (row, { page, context }) => {
  const previo = cell(row, 'previo');
  const etiqueta = cell(row, 'etiqueta');
  const ejemplo = cell(row, 'ejemplo');
  await quietCookies(context);
  await resetAlumno();
  const prepared = await strict('previo', PREVIOUS, previo)(page);
  if (prepared) return prepFailed(`«${etiqueta}» en el formulario previsto`, prepared);
  const field = strict('campo', FIELDS, etiqueta)(page);
  const announced = (await namedOf(field))?.name ?? (await labelOf(field));
  const labelText = await labelOf(field);
  const visible = await labelVisible(field);
  const placeholder = await attrOf(field, 'placeholder');
  const exampleOk = ejemplo === NONE ? placeholder === undefined || placeholder === '' : placeholder === ejemplo && ejemplo !== etiqueta;
  const checks: Check[] = [
    check(announced === etiqueta, `lo anuncia como «${etiqueta}»`, `lo anuncia como ${announced === undefined ? '(sin nombre legible)' : `«${announced}»`}`),
    check(labelText === etiqueta && visible, `etiqueta visible «${etiqueta}»`, `etiqueta ${labelText === undefined ? '(sin etiqueta asociada)' : `«${labelText}»`} ${visible ? 'visible' : 'no visible'}`),
    check(exampleOk, `su texto de ejemplo es ${ejemplo === NONE ? '(ninguno)' : `«${ejemplo}»`}`, `su texto de ejemplo es ${placeholder === undefined || placeholder === '' ? '(ninguno)' : `«${placeholder}»`}`),
  ];
  return conclude(checks, { note: COOKIE_NOTE });
};

// --- Esquema 2: un formulario vacío avisa junto al primer campo y lleva el foco allí ----------------------------------------------

const SUBMIT_BUTTONS: ReadonlyMap<string, (page: Page) => Locator> = new Map<string, (page: Page) => Locator>([
  ['Entrar', (page) => enterButton(page)],
  ['Enviar solicitud', (page) => page.getByRole('button', { name: 'Enviar solicitud', exact: true })],
]);

const SCREEN_OPENERS: ReadonlyMap<string, (page: Page) => Promise<string | undefined>> = new Map<string, (page: Page) => Promise<string | undefined>>([
  ['/login?tenant=alumno01', (page) => runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]])],
  ['/register?tenant=alumno01', (page) => runStepsLogged([['abrir /register?tenant=alumno01', () => page.goto(REGISTER_PATH, { timeout: CEILING_MS })], ['ver el título «Solicitar acceso»', () => heading1(page, 'Solicitar acceso').waitFor({ timeout: CEILING_MS })]])],
]);

const REQUIRED = 'Campo obligatorio';

const emptySubmit: BrowserRowHandler = async (row, { page, context }) => {
  const pantalla = cell(row, 'pantalla');
  const boton = cell(row, 'boton');
  const campo = cell(row, 'campo');
  const expected = `aviso «${REQUIRED}» debajo de «${campo}» y foco en «${campo}»`;
  await quietCookies(context);
  await resetAlumno();
  const opened = await strict('pantalla', SCREEN_OPENERS, pantalla)(page);
  if (opened) return prepFailed(expected, opened);
  const clicked = await runStepsLogged([[`pulsar «${boton}»`, () => strict('boton', SUBMIT_BUTTONS, boton)(page).click(ACTION)]]);
  if (clicked) return failedAction(expected, clicked);
  const field = strict('campo', FIELDS, campo)(page);
  const notice = await settle(() => describedByText(field), (text) => text === REQUIRED);
  const below = await settle(() => noticeBelow(field), (value) => value === true);
  const focus = await focusCheck(page, campo);
  return conclude([
    check(notice.ok, `ve el aviso «${REQUIRED}» debajo del campo «${campo}»`, notice.value === undefined ? '(sin aviso asociado al campo)' : `el aviso asociado dice «${notice.value}»`),
    check(below.ok, `el aviso queda debajo del campo «${campo}»`, below.value === true ? 'el aviso queda debajo del campo' : below.value === false ? 'el aviso no queda debajo del campo' : '(sin aviso medible)'),
    focus,
  ], { note: COOKIE_NOTE });
};

// --- Esquema 3: un correo mal escrito avisa junto a «Correo electrónico» y deja el foco allí -------------------------------------

const onLoginForm = async (page: Page): Promise<boolean> => pathOf(page) === '/login' && (await isVisible(heading1(page, 'Iniciar sesión')));
const onPrograms = async (page: Page): Promise<boolean> => pathOf(page) === '/programs' && (await isVisible(programsTitle(page)));

const badEmail: BrowserRowHandler = async (row, { page, context }) => {
  const correo = cell(row, 'correo');
  const expected = `aviso «Introduce un correo válido» debajo de «Correo electrónico» y foco en «Correo electrónico»`;
  await quietCookies(context);
  await resetAlumno();
  const opened = await runStepsLogged([openLogin(page), ['ver el título «Iniciar sesión»', () => heading1(page, 'Iniciar sesión').waitFor({ timeout: CEILING_MS })]]);
  if (opened) return prepFailed(expected, opened);
  const typed = await runStepsLogged([
    ['escribir el correo mal escrito', () => page.locator('form input').nth(0).fill(correo, ACTION)],
    ['escribir Gestor1234! en «Contraseña»', () => page.locator('form input[type="password"]').fill(DEMO.gestor.password, ACTION)],
    ['pulsar «Entrar»', () => enterButton(page).click(ACTION)],
  ]);
  if (typed) return failedAction(expected, typed);
  const field = strict('campo', FIELDS, 'Correo electrónico')(page);
  const notice = await settle(() => describedByText(field), (text) => text === 'Introduce un correo válido');
  const below = await settle(() => noticeBelow(field), (value) => value === true);
  const focus = await focusCheck(page, 'Correo electrónico');
  const stays = await noSessionCheck(page, onLoginForm, onPrograms);
  return conclude([
    check(notice.ok, 've el aviso «Introduce un correo válido» debajo del campo «Correo electrónico»', notice.value === undefined ? '(sin aviso asociado al campo)' : `el aviso asociado dice «${notice.value}»`),
    check(below.ok, 'el aviso queda debajo del campo «Correo electrónico»', below.value === true ? 'el aviso queda debajo del campo' : below.value === false ? 'el aviso no queda debajo del campo' : '(sin aviso medible)'),
    focus,
    stays,
  ], { note: COOKIE_NOTE });
};

defineBrowserRows({
  story: 'US-A11Y-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, labelsAndExamples],
    [2, emptySubmit],
    [3, badEmail],
  ]),
});
