import type { Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { ACTION, holdsFor, pathOf, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  alertOf,
  articleOf,
  attrOne,
  chooseTab,
  DESKTOP_WIDTH,
  editControl,
  enabledOne,
  literal,
  milestonesSection,
  notSeenCheck,
  onWeb,
  openPath,
  prepFailed,
  progressBarOf,
  requirementsLink,
  runSteps,
  seenCheck,
  selectedLabel,
  signIn,
  stateBadgeOf,
  summaryField,
  summaryList,
  suppliersSection,
  TAB_LABELS,
  tabList,
  tabOf,
  tabSelect,
  valueCheck,
  WIDTHS,
} from './common';

// US-PROG-DETALLE-002 — Ver la ficha de un programa en la web: cabecera, datos, pestañas y botón de editar según el rol. Preparación de cada
// fila: reinicio de alumno01 con el token de su administrador; después la cuenta de la fila entra desde /login?tenant=alumno01 en un navegador
// sin sesión guardada y llega a /programs. La ficha se abre con una navegación de carga completa (la sesión guardada se conserva).

const DETAIL = '/programs/PRG-001';

/** Lectura de un dato de la ficha: sus comprobaciones frente al valor de la celda. */
type Reader = (page: Page, valor: string) => Promise<readonly Check[]>;

/** Dato de una pareja «etiqueta / valor» del resumen. */
const summaryReader =
  (label: string): Reader =>
  async (page, valor) => [await valueCheck(summaryField(page, label), valor, `el campo «${label}»`)];

const FIELD_READERS: ReadonlyMap<string, Reader> = new Map<string, Reader>([
  ['el código', async (page, valor) => [await valueCheck(articleOf(page).locator('header').locator('span').first(), valor, 'el código')]],
  ['el título de la página', async (page, valor) => [await valueCheck(articleOf(page).getByRole('heading', { level: 1 }), valor, 'el título de la página')]],
  ['la descripción', async (page, valor) => [await valueCheck(articleOf(page).locator('header > p'), valor, 'la descripción')]],
  ['el estado', async (page, valor) => [await valueCheck(stateBadgeOf(page), valor, 'el estado')]],
  ['el campo «Responsable»', summaryReader('Responsable')],
  ['el campo «Fechas»', summaryReader('Fechas')],
  ['el campo «Presupuesto»', summaryReader('Presupuesto')],
  ['el campo «Prioridad»', summaryReader('Prioridad')],
  ['el campo «Clasificado»', summaryReader('Clasificado')],
  ['el campo «Hitos completados»', summaryReader('Hitos completados')],
  [
    'la barra «Progreso»',
    async (page, valor) => {
      // El porcentaje va junto a la barra, pegado al signo; la barra expone el mismo valor en aria-valuenow
      const percent = literal(valor).replace('%', '');
      const text = await valueCheck(progressBarOf(page).locator('xpath=..').locator('span').last(), valor, 'la barra «Progreso» muestra');
      const now = await attrOne(progressBarOf(page), 'aria-valuenow');
      return [text, check(now === percent, `la barra «Progreso» vale ${percent}`, `la barra «Progreso» vale ${now ?? '(sin leer)'}`)];
    },
  ],
]);

// --- Esquema 1: la ficha de PRG-001 muestra sus datos del seed ------------------------------------------------------------------------------

const seedFacts: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const reader = strict('dato', FIELD_READERS, cell(row, 'dato'));
  const valor = cell(row, 'valor');
  const expected = `ve ${cell(row, 'dato')} con el valor ${valor}`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  return conclude(await reader(page, valor));
};

// --- Esquema 2: el botón Editar programa depende del rol ------------------------------------------------------------------------------------

const ACCOUNTS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['alumno01@sigpro.lab', { email: 'alumno01@sigpro.lab', password: 'Alumno1234!' }],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);
const EXPLANATION = 'Tu rol no permite modificar programas';
const EDIT_STATE: ReadonlyMap<string, 'habilitado' | 'deshabilitado'> = new Map<string, 'habilitado' | 'deshabilitado'>([
  ['habilitado', 'habilitado'],
  ['deshabilitado con la explicación «Tu rol no permite modificar programas»', 'deshabilitado'],
]);
const ON_CLICK: ReadonlyMap<string, 'llega' | 'no-pulsa'> = new Map<string, 'llega' | 'no-pulsa'>([
  ['al pulsarlo llega a /programs/PRG-001/edit', 'llega'],
  ['no se puede pulsar', 'no-pulsa'],
]);

const editByRole: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const credentials = strict('cuenta', ACCOUNTS, cell(row, 'cuenta'));
  const state = strict('estado_boton', EDIT_STATE, cell(row, 'estado_boton'));
  const onClick = strict('al_pulsarlo', ON_CLICK, cell(row, 'al_pulsarlo'));
  const expected = `el botón «Editar programa» está ${cell(row, 'estado_boton')}; ${cell(row, 'al_pulsarlo')}`;
  const signed = await signIn(page, DESKTOP_WIDTH, credentials);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, DETAIL);
  if (opened) return actionMissing(expected, opened);

  const control = editControl(page);
  const enabled = await enabledOne(control);
  const shown = enabled === undefined ? '(sin leer)' : enabled ? 'habilitado' : 'deshabilitado';
  const checks: Check[] = [];
  if (state === 'habilitado') {
    checks.push(check(enabled === true, 'el botón «Editar programa» está habilitado', `el botón «Editar programa» está ${shown}`));
  } else {
    const title = await attrOne(control, 'title');
    checks.push(
      check(
        enabled === false && title === EXPLANATION,
        `el botón «Editar programa» está deshabilitado con la explicación «${EXPLANATION}»`,
        `el botón «Editar programa» está ${shown}, con el título «${title ?? '(sin título)'}»`,
      ),
    );
  }

  if (onClick === 'llega') {
    const clicked = await runSteps([['pulsar «Editar programa»', () => control.click(ACTION)]]);
    if (clicked) return actionMissing(expected, clicked);
    const arrived = await waitUntil(async () => pathOf(page) === '/programs/PRG-001/edit');
    checks.push(check(arrived.reached, 'al pulsarlo llega a /programs/PRG-001/edit', `al pulsarlo llega a ${pathOf(page)}`));
    return conclude(checks);
  }
  // «No se puede pulsar»: el clic debe fallar (el botón no está habilitado) y la página debe seguir en la ficha
  const refused = await runSteps([['pulsar «Editar programa»', () => control.click({ timeout: 1_000 })]]);
  // Se distingue «el botón está deshabilitado» (el clic lo rechaza por eso) de «el clic falló por otra causa» (p. ej. lo tapa otro elemento)
  const disabledCause = refused !== undefined && refused.callLog.some((line) => /not enabled|is disabled/.test(line));
  checks.push(
    check(
      refused !== undefined && pathOf(page) === DETAIL,
      'no se puede pulsar: la ficha sigue en /programs/PRG-001',
      refused === undefined ? `se pudo pulsar y la página va a ${pathOf(page)}` : `no se pudo pulsar; sigue en ${pathOf(page)}`,
    ),
    check(
      disabledCause,
      'el clic falla porque el botón está deshabilitado',
      refused === undefined ? 'el clic no falló' : disabledCause ? 'el clic falla porque el botón está deshabilitado' : `el clic falló por otra causa: ${refused.callLog.join(' · ')}`,
    ),
  );
  return conclude(checks, refused === undefined ? {} : { evidence: { callLog: refused.callLog } });
};

// --- Esquema 3: cada opción de la ficha muestra su contenido en cada ventana ----------------------------------------------------------------

const OPTIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Resumen»', 'Resumen'],
  ['«Hitos»', 'Hitos'],
  ['«Requisitos»', 'Requisitos'],
]);
const CONTENT: ReadonlyMap<string, 'resumen' | 'hitos' | 'requisitos'> = new Map<string, 'resumen' | 'hitos' | 'requisitos'>([
  ['los datos de la ficha y la sección de proveedores del programa', 'resumen'],
  ['el panel de hitos del programa', 'hitos'],
  ['solo el enlace «Abrir el árbol de requisitos de este programa»', 'requisitos'],
]);

/** Lo que cada opción muestra y, en «Requisitos», lo que NO muestra («solo» el enlace). */
/** Los datos de PRG-001 del Esquema 1 (mismos datos y mismos valores): «ve los datos de la ficha» los comprueba todos, como ese Esquema. */
const SEED_FACTS: ReadonlyArray<readonly [string, string]> = [
  ['el código', 'PRG-001'],
  ['el título de la página', 'Sistema de mando táctico Ártemis'],
  ['la descripción', 'Programa «Sistema de mando táctico Ártemis»: alcance, hitos, requisitos y verificación del sistema.'],
  ['el estado', '«Activo»'],
  ['el campo «Responsable»', 'Marta Ruiz'],
  ['el campo «Fechas»', '01/01/2023 → 01/07/2024'],
  ['el campo «Presupuesto»', '450.000 €'],
  ['el campo «Prioridad»', '«Media»'],
  ['el campo «Clasificado»', '«Sí»'],
  ['el campo «Hitos completados»', '1 / 9'],
  ['la barra «Progreso»', '11%'],
];

const contentChecks = async (page: Page, kind: 'resumen' | 'hitos' | 'requisitos'): Promise<readonly Check[]> => {
  if (kind === 'resumen') {
    const checks: Check[] = [
      await seenCheck(summaryList(page), 've los datos de la ficha', 'los datos de la ficha'),
      await seenCheck(suppliersSection(page), 've la sección de proveedores del programa', 'la sección de proveedores'),
    ];
    for (const [dato, valor] of SEED_FACTS) {
      const reader = FIELD_READERS.get(dato);
      if (reader === undefined) throw new Error(`sin lector para «${dato}»`);
      checks.push(...(await reader(page, valor)));
    }
    return checks;
  }
  if (kind === 'hitos') {
    return [
      await seenCheck(milestonesSection(page), 've el panel de hitos del programa', 'el panel de hitos'),
      await notSeenCheck(summaryList(page), 'no ve los datos de la ficha', 'los datos de la ficha'),
    ];
  }
  return [
    await seenCheck(requirementsLink(page), 've el enlace «Abrir el árbol de requisitos de este programa»', 'el enlace de requisitos'),
    await notSeenCheck(summaryList(page), 'no ve los datos de la ficha', 'los datos de la ficha'),
    await notSeenCheck(milestonesSection(page), 'no ve el panel de hitos', 'el panel de hitos'),
    await notSeenCheck(suppliersSection(page), 'no ve la sección de proveedores', 'la sección de proveedores'),
  ];
};

const optionContent: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const width = strict('ventana', WIDTHS, cell(row, 'ventana'));
  const option = strict('opción', OPTIONS, cell(row, 'opcion'));
  const kind = strict('contenido', CONTENT, cell(row, 'contenido'));
  const expected = `ve ${cell(row, 'contenido')}; la opción seleccionada es ${option}`;
  const signed = await signIn(page, width);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  const chosen = await chooseTab(page, width, option);
  if (chosen) return actionMissing(expected, chosen);
  // La opción elegida se marca al re-pintar: se espera a que sea la seleccionada antes de leer su contenido
  await waitUntil(async () => (await selectedLabel(page, width)) === option);
  const checks: Check[] = [...(await contentChecks(page, kind))];
  const selected = await selectedLabel(page, width);
  checks.push(check(selected === option, `la opción seleccionada es ${option}`, `la opción seleccionada es ${selected ?? '(sin leer)'}`));
  return conclude(checks);
};

// --- Esquema 4: las flechas del teclado cambian de pestaña con una ventana ancha ------------------------------------------------------------

const TAB_KEY: ReadonlyMap<string, string> = new Map<string, string>([
  ['flecha derecha', 'ArrowRight'],
  ['flecha izquierda', 'ArrowLeft'],
]);

/** Lo que las filas de flechas no prueban: la regla de vuelta (desde la última, derecha → la primera; desde la primera, izquierda → la última). */
const ARROW_NOTE = 'La fila solo prueba Resumen→Hitos o Resumen→Requisitos. La vuelta de la regla (desde la última, la flecha derecha va a la primera; desde la primera, la izquierda va a la última) y Hitos↔Requisitos no la ejecuta ninguna fila.';

const arrowKeys: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const from = strict('desde', OPTIONS, cell(row, 'desde'));
  const to = strict('hasta', OPTIONS, cell(row, 'hasta'));
  const key = strict('tecla', TAB_KEY, cell(row, 'tecla'));
  const expected = `la pestaña seleccionada es ${to}`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  if (from !== 'Resumen') {
    const chosen = await chooseTab(page, DESKTOP_WIDTH, from);
    if (chosen) return actionMissing(expected, chosen);
  }
  const focused = await runSteps([[`poner el foco en la pestaña «${from}»`, () => tabOf(page, from).focus({ timeout: 10_000 })]]);
  if (focused) return actionMissing(expected, focused);
  const pressed = await runSteps([[`pulsar la ${cell(row, 'tecla')}`, () => page.keyboard.press(key)]]);
  if (pressed) return actionMissing(expected, pressed);
  await waitUntil(async () => (await selectedLabel(page, DESKTOP_WIDTH)) === to);
  const selected = await selectedLabel(page, DESKTOP_WIDTH);
  return conclude([check(selected === to, expected, `la pestaña seleccionada es ${selected ?? '(sin leer)'}`)], { note: ARROW_NOTE });
};

// --- Esquema 5: el ancho de la ventana decide cómo se ven las opciones ----------------------------------------------------------------------

const SHAPE: ReadonlyMap<string, 'lista' | 'pestañas'> = new Map<string, 'lista' | 'pestañas'>([
  ['una lista desplegable con la etiqueta «Detalle del programa»', 'lista'],
  ['las pestañas «Resumen», «Hitos» y «Requisitos» en fila', 'pestañas'],
]);

/** Las tres pestañas están en la misma línea (misma coordenada vertical, con 2 px de tolerancia). `undefined` si no se pueden medir. */
const sameRow = async (page: Page): Promise<boolean | undefined> => {
  try {
    const boxes = await Promise.all(TAB_LABELS.map((label) => tabOf(page, label).boundingBox({ timeout: 1_000 })));
    const tops = boxes.map((box) => box?.y);
    if (tops.some((top) => top === undefined)) return undefined;
    const values = tops.filter((top): top is number => top !== undefined);
    return Math.max(...values) - Math.min(...values) < 2;
  } catch {
    return undefined;
  }
};

const shapeByWidth: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const width = strict('ancho', WIDTHS, cell(row, 'ancho'));
  const shape = strict('forma', SHAPE, cell(row, 'forma'));
  const expected = `ve ${cell(row, 'forma')}`;
  const signed = await signIn(page, width);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, DETAIL);
  if (opened) return actionMissing(expected, opened);
  if (shape === 'lista') {
    return conclude([
      await seenCheck(tabSelect(page), 'una lista desplegable con la etiqueta «Detalle del programa»', 'la lista desplegable'),
      await notSeenCheck(tabList(page), 'ninguna fila de pestañas', 'la fila de pestañas'),
    ]);
  }
  const inRow = await sameRow(page);
  return conclude([
    await seenCheck(tabList(page), 'las pestañas «Detalle del programa» en fila', 'la fila de pestañas'),
    await seenCheck(tabOf(page, 'Resumen'), 'la pestaña «Resumen»', 'la pestaña «Resumen»'),
    await seenCheck(tabOf(page, 'Hitos'), 'la pestaña «Hitos»', 'la pestaña «Hitos»'),
    await seenCheck(tabOf(page, 'Requisitos'), 'la pestaña «Requisitos»', 'la pestaña «Requisitos»'),
    check(inRow === true, 'las tres pestañas en la misma línea', `las pestañas ${inRow === undefined ? 'no se pueden medir' : inRow ? 'están en la misma línea' : 'no están en la misma línea'}`),
    await notSeenCheck(tabSelect(page), 'ninguna lista desplegable', 'la lista desplegable'),
  ]);
};

// --- Esquema 6: el enlace de Requisitos lleva al árbol del programa ---------------------------------------------------------------------

const PROGRAM_CODE: ReadonlyMap<string, string> = new Map<string, string>([['PRG-001', 'PRG-001']]);

const requirementsTree: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const code = strict('codigo', PROGRAM_CODE, cell(row, 'codigo'));
  const expected = `llega a /programs/${code}/requirements`;
  const signed = await signIn(page, DESKTOP_WIDTH);
  if (signed) return prepFailed(expected, signed);
  const opened = await openPath(page, `/programs/${code}`);
  if (opened) return actionMissing(expected, opened);
  const chosen = await chooseTab(page, DESKTOP_WIDTH, 'Requisitos');
  if (chosen) return actionMissing(expected, chosen);
  const clicked = await runSteps([['pulsar «Abrir el árbol de requisitos de este programa»', () => requirementsLink(page).click(ACTION)]]);
  if (clicked) return actionMissing(expected, clicked);
  const arrived = await waitUntil(async () => pathOf(page) === `/programs/${code}/requirements`);
  return conclude([check(arrived.reached, expected, `llega a ${pathOf(page)}`)]);
};

// --- Esquema 7: sin sesión, la ficha lleva al acceso ----------------------------------------------------------------------------------------

const ROUTE: ReadonlyMap<string, string> = new Map<string, string>([['/programs/PRG-001', '/programs/PRG-001']]);

const noSession: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const route = strict('ruta', ROUTE, cell(row, 'ruta'));
  const expected = 'llega a /login y no ve ningún dato del programa';
  // Un contexto nuevo, sin sesión guardada: primero se está en /login?tenant=alumno01
  const prepared = await runSteps([
    ['abrir /login?tenant=alumno01 sin sesión guardada', () => page.goto('/login?tenant=alumno01', { timeout: 10_000 })],
    ['ver el formulario de acceso', () => page.getByRole('button', { name: 'Entrar', exact: true }).waitFor({ timeout: 10_000 })],
  ]);
  if (prepared) return prepFailed(expected, prepared);
  const went = await runSteps([[`abrir ${route}`, () => page.goto(route, { timeout: 10_000 })]]);
  if (went) return actionMissing(expected, went);
  const reached = await waitUntil(async () => pathOf(page) === '/login');
  // Se observa un tiempo en /login antes de juzgar que no aparecen datos (la ficha podría cargarse un instante después de redirigir)
  const stays = await holdsFor(async () => pathOf(page) === '/login');
  return conclude([
    check(reached.reached && stays.held, 'llega a /login y se queda ahí', `llega a ${pathOf(page)}${stays.held ? '' : ` y sale de /login a los ${stays.brokeAtMs ?? '?'} ms`}`),
    await notSeenCheck(articleOf(page), 'ningún dato del programa', 'la ficha del programa'),
    await notSeenCheck(page.getByRole('heading', { name: 'Sistema de mando táctico Ártemis', exact: true }), 'el nombre del programa', 'el nombre del programa'),
    await notSeenCheck(alertOf(page), 'ningún aviso de la ficha', 'el aviso de la ficha'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-DETALLE-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(seedFacts)],
    [2, onWeb(editByRole)],
    [3, onWeb(optionContent)],
    [4, onWeb(arrowKeys)],
    [5, onWeb(shapeByWidth)],
    [6, onWeb(requirementsTree)],
    [7, noSession],
  ]),
});
