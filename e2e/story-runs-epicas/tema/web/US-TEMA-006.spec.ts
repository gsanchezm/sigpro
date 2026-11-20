import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler } from '../../core/framework';
import {
  GESTOR,
  MIN_CONTRAST,
  RGB,
  SETTLE_MS,
  WEB_ONLY_NOTE,
  actionMissing,
  backgroundOf,
  colorOf,
  concluded,
  contrastOf,
  headerSearch,
  hexOf,
  newProgramButton,
  openLoginSteps,
  ownerFilter,
  placeholderColorOf,
  pressSteps,
  programsTitle,
  ratioText,
  runStepsLogged,
  signInSteps,
  temaOf,
  type Tema,
} from './common';

// US-TEMA-006 — Textos con contraste de al menos 4,5:1 sobre su fondo en los dos temas (web, /programs a 1440 px). Preparación de cada
// fila: reinicio del tenant alumno01 y navegador nuevo; gestor@sigpro.test entra desde la pantalla de acceso (en el tema oscuro, la fila
// pulsa «Cambiar tema» una vez antes de entrar). Cada categoría de la historia se mide en elementos reales de /programs: el color del texto
// y su fondo efectivo (primer ancestro opaco) se leen del navegador y el contraste se calcula sobre lo leído, no sobre las celdas. Las
// categorías que la pantalla no muestra con ese rol se devuelven como `notExecutable` con el motivo. La regla «mismos colores en web y
// móvil» no se mide en móvil (WEB_ONLY_NOTE).

const PRG_001 = 'PRG-001';

const checkboxFor = (page: Page): Locator => page.getByRole('checkbox', { name: `Seleccionar ${PRG_001}`, exact: true });
const rowOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(PRG_001));
/** Nombre del programa: el texto principal de la fila (`div.truncate` dentro de la celda del nombre). */
const rowName = (page: Page): Locator => rowOf(page).locator('div.truncate').first();
/** Fechas del programa: la única celda de la fila con el texto secundario (`text-fg-2`). */
const rowDates = (page: Page): Locator => rowOf(page).locator('td.text-fg-2').first();
/** Cabecera de una columna sin orden: su color de etiqueta es el del `.data-table thead th`. */
const unsortedHeader = (page: Page): Locator => page.getByRole('table').locator('thead th:not([aria-sort])').filter({ hasText: /\S/ }).first();
/** Línea de ayuda de la tarjeta de total (`.metric-aux`, ui/Metric.tsx): texto de etiqueta o ayuda sobre la superficie de la tarjeta. */
const metricAux = (page: Page): Locator => page.getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_METRIC_TOTAL).locator('.metric-aux');
const subtitle = (page: Page): Locator => programsTitle(page).locator('xpath=following-sibling::p[1]');

type Prep = 'ninguna' | 'seleccionar' | 'escribir' | 'cursor' | 'responsable';

/** Un elemento medido: lo que describe la comprobación y dónde se lee el color y el fondo. */
interface Target {
  readonly what: string;
  readonly element: (page: Page) => Locator;
  /** Si el texto es el marcador (`::placeholder`) del campo en lugar de su texto. */
  readonly placeholder?: true;
}

interface Measured {
  readonly kind: 'medir';
  /** Qué hace la prueba antes de medir (la pantalla que la historia describe). */
  readonly prep: Prep;
  readonly targets: readonly Target[];
  /** Nota de método, cuando el elemento medido no es el que el nombre sugiere a primera vista. */
  readonly note?: string;
}

interface NotMeasured {
  readonly kind: 'no-medible';
  /** Motivo honesto por el que la fila no se puede medir en la pantalla que la historia describe. */
  readonly motivo: string;
}

const SURFACES: ReadonlyMap<string, Measured | NotMeasured> = new Map<string, Measured | NotMeasured>([
  ['el texto principal de la página', { kind: 'medir', prep: 'ninguna', targets: [{ what: 'título de la página', element: programsTitle }] }],
  ['el texto secundario de la página', { kind: 'medir', prep: 'ninguna', targets: [{ what: 'resumen bajo el título', element: subtitle }] }],
  ['el texto principal de tarjetas y paneles', { kind: 'medir', prep: 'ninguna', targets: [{ what: `nombre de ${PRG_001}`, element: rowName }] }],
  ['el texto secundario de tarjetas y paneles', { kind: 'medir', prep: 'ninguna', targets: [{ what: `fechas de ${PRG_001}`, element: rowDates }] }],
  [
    'la etiqueta o ayuda de tarjetas y paneles',
    {
      kind: 'medir',
      prep: 'ninguna',
      targets: [
        { what: 'cabecera de columna sin orden de la tabla', element: unsortedHeader },
        { what: 'línea de ayuda de la tarjeta de total', element: metricAux },
      ],
    },
  ],
  [
    'el texto principal de cabeceras y campos de búsqueda',
    { kind: 'medir', prep: 'escribir', targets: [{ what: 'texto escrito en el buscador de la cabecera', element: headerSearch }] },
  ],
  [
    'el texto secundario de cabeceras y campos de búsqueda',
    {
      kind: 'medir',
      prep: 'responsable',
      targets: [{ what: 'texto escrito en el filtro «Responsable» con el cursor sobre el chip', element: ownerFilter }],
      note: 'Medido en el filtro «Responsable» de la barra de filtros (role=search, chip con fondo de superficie 2 al pasar el cursor), no en la cabecera: es el texto secundario que la pantalla pone sobre ese fondo. El foco se mantiene en el combobox, porque borra su texto al perder el foco.',
    },
  ],
  [
    'la etiqueta o ayuda de cabeceras y campos de búsqueda',
    {
      kind: 'medir',
      prep: 'ninguna',
      targets: [{ what: 'marcador del buscador de la cabecera', element: headerSearch, placeholder: true }],
      note: 'Se mide el marcador (placeholder) del buscador de la cabecera porque ese campo no tiene etiqueta visible.',
    },
  ],
  [
    'el texto principal de una fila seleccionada',
    { kind: 'medir', prep: 'seleccionar', targets: [{ what: `nombre de ${PRG_001} con la fila seleccionada`, element: rowName }] },
  ],
  [
    'el texto secundario de una fila seleccionada',
    { kind: 'medir', prep: 'seleccionar', targets: [{ what: `fechas de ${PRG_001} con la fila seleccionada`, element: rowDates }] },
  ],
  [
    'la etiqueta o ayuda de una fila seleccionada',
    {
      kind: 'no-medible',
      motivo:
        'Ningún texto de una fila de programas lleva el color de etiqueta o ayuda (text-3): el código, el nombre, el responsable, las fechas y el presupuesto usan texto principal o secundario, y el estado es una insignia con su propio color (ProgramsTable.tsx, celdas de las líneas 195 a 250). El rol no interviene. No se mide: la historia describe un texto que las filas de programas no tienen.',
    },
  ],
  [
    'el texto del botón principal',
    { kind: 'medir', prep: 'ninguna', targets: [{ what: 'botón «+ Nuevo programa»', element: newProgramButton }] },
  ],
  [
    'el texto del botón principal con el cursor encima',
    { kind: 'medir', prep: 'cursor', targets: [{ what: 'botón «+ Nuevo programa» con el cursor encima', element: newProgramButton }] },
  ],
  [
    'el texto del botón de peligro',
    {
      kind: 'no-medible',
      motivo:
        'La historia fija /programs con gestor@sigpro.test. Con ese rol el único botón de peligro sólido (DeleteDialog.tsx:47, «Eliminar») no existe en esa pantalla: solo lo abre program.delete, exclusivo de admin (packages/shared/src/permissions.ts, línea 8), y la barra masiva lo deja deshabilitado. Es un defecto de la historia (su preparación no alcanza el elemento que describe), no de la app. No se mide.',
    },
  ],
]);

/** Prepara la pantalla para la categoría: seleccionar la fila, escribir en el buscador, en el filtro de responsable o pasar el cursor. */
const prepare = (prep: Prep, page: Page): Promise<string | undefined> => {
  if (prep === 'seleccionar') {
    return runStepsLogged([
      [`marcar «Seleccionar ${PRG_001}»`, () => checkboxFor(page).check(ACTION)],
      ['apartar el cursor de la fila', () => page.mouse.move(0, 0)],
    ]);
  }
  if (prep === 'escribir') return runStepsLogged([[`escribir ${PRG_001} en el buscador de la cabecera`, () => headerSearch(page).fill(PRG_001, ACTION)]]);
  if (prep === 'responsable') {
    return runStepsLogged([
      ['pulsar el filtro «Responsable» (el cursor queda sobre el chip)', () => ownerFilter(page).click(ACTION)],
      ['escribir «Lu» en el filtro «Responsable»', () => ownerFilter(page).fill('Lu', ACTION)],
    ]);
  }
  if (prep === 'cursor') return runStepsLogged([['pasar el cursor sobre «+ Nuevo programa»', () => newProgramButton(page).hover(ACTION)]]);
  return runStepsLogged([['apartar el cursor de la pantalla', () => page.mouse.move(0, 0)]]);
};

/** Fila de la historia para un tema: el tema del navegador lo fija la preparación (oscuro = una pulsación antes de entrar). */
const measureOn =
  (tema: Tema): BrowserRowHandler =>
  async (row, { page }) => {
    const texto = cell(row, 'texto');
    const colorHex = cell(row, 'color_texto');
    const fondoHex = cell(row, 'fondo');
    const textRgb = strict('color_texto', RGB, colorHex);
    const bgRgb = strict('fondo', RGB, fondoHex);
    const surface = strict('texto', SURFACES, texto);
    const expected = `${texto}: texto ${colorHex} sobre ${fondoHex}, contraste de al menos 4,5:1`;

    if (surface.kind === 'no-medible') return notExecutable(expected, surface.motivo);

    // Preparación: reinicio, sistema en claro, pantalla de acceso (una pulsación si el tema es oscuro) y entrada de gestor
    await resetTenants([TENANT_A]);
    await page.emulateMedia({ colorScheme: 'light' });
    const opened = await runStepsLogged(openLoginSteps(page));
    if (opened) return preparationFailedWeb(expected, opened);
    const pressed = await runStepsLogged(pressSteps(page, tema === 'oscuro' ? 1 : 0));
    if (pressed) return preparationFailedWeb(expected, `pulsar «Cambiar tema» antes de entrar: ${pressed}`);
    const signedIn = await runStepsLogged(signInSteps(page, GESTOR));
    if (signedIn) return preparationFailedWeb(expected, `gestor@sigpro.test inicia sesión y llega a /programs: ${signedIn}`);
    const loaded = await runStepsLogged([[`ver la fila ${PRG_001} de la tabla`, () => rowOf(page).waitFor(ACTION)]]);
    if (loaded) return preparationFailedWeb(expected, loaded);
    const themeNow = await temaOf(page);
    if (themeNow !== tema) return preparationFailedWeb(expected, `en /programs el tema es ${themeNow ?? '(no legible)'}, no ${tema}`);

    // Pantalla lista para la categoría (selección, búsqueda, filtro de responsable o cursor)
    const prepared = await prepare(surface.prep, page);
    if (prepared) return actionMissing(expected, prepared);

    // Cada elemento de la categoría: color y fondo leídos, contraste calculado sobre lo leído
    const checks: Check[] = [];
    const evidence: Record<string, unknown> = { tema };
    for (const target of surface.targets) {
      const element = target.element(page);
      // Se espera a que el fondo se asiente (transiciones de los botones, chip y estado de la fila) antes de leer el color
      await waitUntil(async () => (await backgroundOf(element)) === bgRgb, SETTLE_MS);
      const color = target.placeholder === true ? await placeholderColorOf(element) : await colorOf(element);
      const background = await backgroundOf(element);
      const ratio = contrastOf(color, background);
      checks.push(check(color === textRgb, `${target.what}: texto ${colorHex}`, `${target.what}: texto ${hexOf(color)}`));
      checks.push(check(background === bgRgb, `${target.what}: sobre ${fondoHex}`, `${target.what}: sobre ${hexOf(background)}`));
      checks.push(check(ratio !== undefined && ratio >= MIN_CONTRAST, `${target.what}: contraste de al menos 4,5:1`, `${target.what}: contraste ${ratioText(ratio)}`));
      evidence[target.what] = ratioText(ratio);
    }
    const note = [surface.note, WEB_ONLY_NOTE].filter((part): part is string => part !== undefined).join(' ');
    return concluded(checks, { note, evidence });
  };

const claro = measureOn('claro');
const oscuro = measureOn('oscuro');

defineBrowserRows({
  story: 'US-TEMA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, claro],
    [2, oscuro],
  ]),
});
