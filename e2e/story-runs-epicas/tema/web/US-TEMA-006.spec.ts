import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
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
  concluded,
  colorOf,
  contrastOf,
  headerSearch,
  hexOf,
  newProgramButton,
  openLoginSteps,
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
// pulsa «Cambiar tema» una vez antes de entrar). Cada categoría de la historia se mide en un elemento real de /programs: el color del
// texto y su fondo efectivo (primer ancestro opaco) se leen del navegador y el contraste se calcula sobre lo leído, no sobre las celdas.
// Las categorías que la pantalla no muestra (o que el rol de la historia no puede ver) se devuelven como `notExecutable` con el motivo.

const PRG_001 = 'PRG-001';

const checkboxFor = (page: Page): Locator => page.getByRole('checkbox', { name: `Seleccionar ${PRG_001}`, exact: true });
const rowOf = (page: Page): Locator => page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW(PRG_001));
/** Nombre del programa: el texto principal de la fila (`div.truncate` dentro de la celda del nombre). */
const rowName = (page: Page): Locator => rowOf(page).locator('div.truncate').first();
/** Fechas del programa: la única celda de la fila con el texto secundario (`text-fg-2`). */
const rowDates = (page: Page): Locator => rowOf(page).locator('td.text-fg-2').first();
/** Cabecera de una columna sin orden: su color de etiqueta es el del `.data-table thead th`. */
const unsortedHeader = (page: Page): Locator => page.getByRole('table').locator('thead th:not([aria-sort])').filter({ hasText: /\S/ }).first();
const subtitle = (page: Page): Locator => programsTitle(page).locator('xpath=following-sibling::p[1]');

type Prep = 'ninguna' | 'seleccionar' | 'escribir' | 'cursor';

interface Measured {
  readonly kind: 'medir';
  /** Qué hace la prueba antes de medir (la fila que la historia describe). */
  readonly prep: Prep;
  /** Elemento real de la pantalla donde se mide el color y el fondo. */
  readonly element: (page: Page) => Locator;
  /** Descripción del elemento medido, para la evidencia. */
  readonly descripcion: string;
  /** Si el texto es el marcador (`::placeholder`) del campo en lugar de su texto. */
  readonly placeholder?: true;
}

interface NotMeasured {
  readonly kind: 'no-medible';
  /** Motivo honesto por el que la fila no se puede medir en la pantalla (cita el código). */
  readonly motivo: string;
}

const SURFACES: ReadonlyMap<string, Measured | NotMeasured> = new Map<string, Measured | NotMeasured>([
  ['el texto principal de la página', { kind: 'medir', prep: 'ninguna', element: programsTitle, descripcion: 'título de la página «Programas» (h1)' }],
  ['el texto secundario de la página', { kind: 'medir', prep: 'ninguna', element: subtitle, descripcion: 'resumen bajo el título (p.text-fg-2)' }],
  ['el texto principal de tarjetas y paneles', { kind: 'medir', prep: 'ninguna', element: rowName, descripcion: `nombre del programa ${PRG_001} en la tabla` }],
  ['el texto secundario de tarjetas y paneles', { kind: 'medir', prep: 'ninguna', element: rowDates, descripcion: `fechas de ${PRG_001} en la tabla` }],
  ['la etiqueta o ayuda de tarjetas y paneles', { kind: 'medir', prep: 'ninguna', element: unsortedHeader, descripcion: 'cabecera de columna sin orden de la tabla' }],
  ['el texto principal de cabeceras y campos de búsqueda', { kind: 'medir', prep: 'escribir', element: headerSearch, descripcion: 'campo de búsqueda de la cabecera con un texto escrito por la prueba' }],
  [
    'el texto secundario de cabeceras y campos de búsqueda',
    {
      kind: 'no-medible',
      motivo:
        'El campo de búsqueda de la cabecera (GlobalSearch.tsx, «input-header !bg-surface-2») solo muestra el texto escrito, con el color principal, y su marcador, que es la etiqueta o ayuda. No hay ningún texto secundario sobre ese fondo: la fila describe un texto que la pantalla no muestra ahí. No se mide.',
    },
  ],
  [
    'la etiqueta o ayuda de cabeceras y campos de búsqueda',
    { kind: 'medir', prep: 'ninguna', element: headerSearch, descripcion: 'marcador del campo de búsqueda de la cabecera (sin texto escrito)', placeholder: true },
  ],
  ['el texto principal de una fila seleccionada', { kind: 'medir', prep: 'seleccionar', element: rowName, descripcion: `nombre de ${PRG_001} con la fila seleccionada` }],
  ['el texto secundario de una fila seleccionada', { kind: 'medir', prep: 'seleccionar', element: rowDates, descripcion: `fechas de ${PRG_001} con la fila seleccionada` }],
  [
    'la etiqueta o ayuda de una fila seleccionada',
    {
      kind: 'no-medible',
      motivo:
        'Una fila de programas (ProgramsTable.tsx, celdas de la línea 195 a la 250) muestra el código, el nombre, el estado, el responsable, las fechas, el presupuesto y el avance, sin ninguna etiqueta ni ayuda (ningún text-fg-3 dentro de la fila). Con la fila seleccionada no hay ese texto que medir: la fila describe un elemento que la pantalla no tiene.',
    },
  ],
  ['el texto del botón principal', { kind: 'medir', prep: 'ninguna', element: newProgramButton, descripcion: 'botón «+ Nuevo programa» (btn-primary)' }],
  ['el texto del botón principal con el cursor encima', { kind: 'medir', prep: 'cursor', element: newProgramButton, descripcion: 'botón «+ Nuevo programa» con el cursor encima' }],
  [
    'el texto del botón de peligro',
    {
      kind: 'no-medible',
      motivo:
        'El único botón de peligro sólido de /programs es «Eliminar» del diálogo de borrado (DeleteDialog.tsx, btn-danger), y solo se abre desde la barra masiva o el menú de fila, que requieren program.delete: solo el rol admin (packages/shared/src/permissions.ts, línea 8). Con gestor@sigpro.test (program_manager) «Eliminar» está deshabilitado y el diálogo no se abre. La fila no se puede reproducir con el rol de la preparación.',
    },
  ],
]);

/** Prepara la pantalla para la categoría: seleccionar la fila, escribir en la búsqueda, pasar el cursor, o apartar el cursor. */
const prepare = (prep: Prep, page: Page): Promise<string | undefined> => {
  if (prep === 'seleccionar') {
    return runStepsLogged([
      [`marcar «Seleccionar ${PRG_001}»`, () => checkboxFor(page).check(ACTION)],
      ['apartar el cursor de la fila', () => page.mouse.move(0, 0)],
    ]);
  }
  if (prep === 'escribir') return runStepsLogged([[`escribir ${PRG_001} en el campo de búsqueda`, () => headerSearch(page).fill(PRG_001, ACTION)]]);
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

    // Pantalla lista para la categoría (selección, búsqueda o cursor)
    const prepared = await prepare(surface.prep, page);
    if (prepared) return actionMissing(expected, prepared);

    // Se espera a que el fondo se asiente (transiciones de los botones y del estado de la fila) antes de leer el color
    const element = surface.element(page);
    await waitUntil(async () => (await backgroundOf(element)) === bgRgb, SETTLE_MS);
    const color = surface.placeholder === true ? await placeholderColorOf(element) : await colorOf(element);
    const background = await backgroundOf(element);
    const ratio = contrastOf(color, background);

    const checks: Check[] = [
      check(color === textRgb, `el texto es ${colorHex}`, `el texto es ${hexOf(color)}`),
      check(background === bgRgb, `sobre ${fondoHex}`, `sobre ${hexOf(background)}`),
      check(ratio !== undefined && ratio >= MIN_CONTRAST, 'contraste de al menos 4,5:1', `contraste ${ratioText(ratio)}`),
    ];
    return concluded(checks, { note: WEB_ONLY_NOTE, evidence: { medido_sobre: surface.descripcion, tema, contraste: ratioText(ratio) } });
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
