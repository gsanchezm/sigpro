import type { Locator, Page } from '@playwright/test';
import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { adminCredentials, adminToken, call, resetTenant } from '../../../story-runs/support/api';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  GESTOR,
  MIN_CONTRAST,
  RGB,
  SETTLE_MS,
  WEB_ONLY_NOTE,
  actionMissing,
  animationsRunning,
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

// US-TEMA-006 — Textos con contraste de al menos 4,5:1 sobre su fondo en los dos temas (web, /programs a 1440 px). Esquemas 1 y 2: gestor@sigpro.test
// entra desde la pantalla de acceso (en el tema oscuro, la fila pulsa «Cambiar tema» una vez antes de entrar). Cada categoría se mide en
// elementos reales de /programs: el color del texto y su fondo efectivo (primer ancestro opaco) se leen del navegador, y el contraste se
// calcula sobre lo leído, no sobre las celdas. Esquemas 3 y 4 (botón de peligro): alumno01@sigpro.lab (administrador sin segundo factor) abre
// el diálogo de eliminación de PRG-001 desde el menú de acciones de su fila; el color y el fondo se leen del botón «Eliminar» del diálogo
// (btn-danger) con la transición terminada, y el diálogo se cierra con «Cancelar»: el borrado no se confirma. La regla «mismos colores en
// web y móvil» no se mide en móvil (WEB_ONLY_NOTE).

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
/** Botón de acciones de la fila de PRG-001 (aria-label «Acciones para {code}», RowMenu.tsx). */
const rowMenuButton = (page: Page): Locator => page.getByRole('button', { name: `Acciones para ${PRG_001}`, exact: true });
const rowMenuDelete = (page: Page): Locator => page.getByRole('menuitem', { name: 'Eliminar', exact: true });
/** Diálogo de eliminación (DeleteDialog.tsx, `alertdialog`): el único diálogo de la pantalla cuando está abierto. */
const deleteDialog = (page: Page): Locator => page.getByRole('alertdialog');

type Prep = 'ninguna' | 'seleccionar' | 'escribir' | 'cursor' | 'responsable';

/** Un elemento medido: lo que describe la comprobación y dónde se lee el color y el fondo. */
interface Target {
  readonly what: string;
  readonly element: (page: Page) => Locator;
  /** Si el texto es el marcador (`::placeholder`) del campo en lugar de su texto. */
  readonly placeholder?: true;
}

interface Measured {
  /** Qué hace la prueba antes de medir (la pantalla que la historia describe). */
  readonly prep: Prep;
  readonly targets: readonly Target[];
  /** Nota de método, cuando el elemento medido no es el que el nombre sugiere a primera vista. */
  readonly note?: string;
}

const SURFACES: ReadonlyMap<string, Measured> = new Map<string, Measured>([
  ['el texto principal de la página', { prep: 'ninguna', targets: [{ what: 'título de la página', element: programsTitle }] }],
  ['el texto secundario de la página', { prep: 'ninguna', targets: [{ what: 'resumen bajo el título', element: subtitle }] }],
  ['el texto principal de tarjetas y paneles', { prep: 'ninguna', targets: [{ what: `nombre de ${PRG_001}`, element: rowName }] }],
  ['el texto secundario de tarjetas y paneles', { prep: 'ninguna', targets: [{ what: `fechas de ${PRG_001}`, element: rowDates }] }],
  [
    'la etiqueta o ayuda de tarjetas y paneles',
    {
      prep: 'ninguna',
      targets: [
        { what: 'cabecera de columna sin orden de la tabla', element: unsortedHeader },
        { what: 'línea de ayuda de la tarjeta de total', element: metricAux },
      ],
    },
  ],
  ['el texto principal de cabeceras y campos de búsqueda', { prep: 'escribir', targets: [{ what: 'texto escrito en el buscador de la cabecera', element: headerSearch }] }],
  [
    'el texto secundario de cabeceras y campos de búsqueda',
    {
      prep: 'responsable',
      targets: [{ what: 'texto escrito en el filtro «Responsable» con el cursor sobre el chip', element: ownerFilter }],
      note: 'Medido en el filtro «Responsable» de la barra de filtros (role=search, chip con fondo de superficie 2 al pasar el cursor), no en la cabecera: es el texto secundario que la pantalla pone sobre ese fondo. El foco se mantiene en el combobox, porque borra su texto al perder el foco.',
    },
  ],
  [
    'la etiqueta o ayuda de cabeceras y campos de búsqueda',
    {
      prep: 'ninguna',
      targets: [{ what: 'marcador del buscador de la cabecera', element: headerSearch, placeholder: true }],
      note: 'Se mide el marcador (placeholder) del buscador de la cabecera porque ese campo no tiene etiqueta visible.',
    },
  ],
  ['el texto principal de una fila seleccionada', { prep: 'seleccionar', targets: [{ what: `nombre de ${PRG_001} con la fila seleccionada`, element: rowName }] }],
  ['el texto secundario de una fila seleccionada', { prep: 'seleccionar', targets: [{ what: `fechas de ${PRG_001} con la fila seleccionada`, element: rowDates }] }],
  ['el texto del botón principal', { prep: 'ninguna', targets: [{ what: 'botón «+ Nuevo programa»', element: newProgramButton }] }],
  ['el texto del botón principal con el cursor encima', { prep: 'cursor', targets: [{ what: 'botón «+ Nuevo programa» con el cursor encima', element: newProgramButton }] }],
]);

/** Texto de la categoría de peligro de los Esquemas 3 y 4 (única categoría de esas filas). */
const DANGER: ReadonlyMap<string, string> = new Map<string, string>([['el texto del botón de peligro', 'peligro']]);

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

/**
 * Esquemas 3 y 4: el botón de peligro del diálogo de eliminación de PRG-001 (administrador). La preparación reinicia el tenant por API
 * (2xx), entra como alumno01@sigpro.lab (en el oscuro, tras una pulsación en la pantalla de acceso), abre el diálogo desde el menú de
 * acciones de la fila y mide su botón «Eliminar». Se cierra con «Cancelar»: no se confirma nada.
 */
const dangerDialog = (tema: Tema): BrowserRowHandler =>
  async (row, { page }) => {
    const texto = cell(row, 'texto');
    const colorHex = cell(row, 'color_texto');
    const fondoHex = cell(row, 'fondo');
    const textRgb = strict('color_texto', RGB, colorHex);
    const bgRgb = strict('fondo', RGB, fondoHex);
    strict('texto', DANGER, texto);
    const expected = `${texto}: texto ${colorHex} sobre ${fondoHex}, contraste de al menos 4,5:1`;

    // Preparación: reinicio por API con comprobación de 2xx (si no, la fila no empieza del estado de la historia)
    const reset = await resetTenant(TENANT_A);
    if (reset.status < 200 || reset.status > 299) return preparationFailedWeb(expected, `POST /api/admin/reset respondió ${reset.status}`);
    await page.emulateMedia({ colorScheme: 'light' });
    const opened = await runStepsLogged(openLoginSteps(page));
    if (opened) return preparationFailedWeb(expected, opened);
    if (tema === 'oscuro') {
      const pressed = await runStepsLogged(pressSteps(page, 1));
      if (pressed) return preparationFailedWeb(expected, `pulsar «Cambiar tema» antes de iniciar sesión: ${pressed}`);
    }
    const admin = adminCredentials(TENANT_A);
    const signedIn = await runStepsLogged(signInSteps(page, admin));
    if (signedIn) return preparationFailedWeb(expected, `alumno01@sigpro.lab inicia sesión y llega a /programs: ${signedIn}`);
    const themeNow = await temaOf(page);
    if (themeNow !== tema) return preparationFailedWeb(expected, `en /programs el tema es ${themeNow ?? '(no legible)'}, no ${tema}`);
    const loaded = await runStepsLogged([[`ver la fila ${PRG_001} de la tabla`, () => rowOf(page).waitFor(ACTION)]]);
    if (loaded) return preparationFailedWeb(expected, loaded);

    // Preparación: el diálogo de eliminación de PRG-001 abierto desde el menú de acciones de su fila (no se confirma nada)
    const dialogOpened = await runStepsLogged([
      [`abrir el menú «Acciones para ${PRG_001}»`, () => rowMenuButton(page).click(ACTION)],
      ['pulsar «Eliminar» en el menú de la fila', () => rowMenuDelete(page).click(ACTION)],
      ['ver el diálogo de eliminación', () => deleteDialog(page).waitFor(ACTION)],
    ]);
    if (dialogOpened) return preparationFailedWeb(expected, dialogOpened);

    // Medición: el botón «Eliminar» del diálogo, con la transición terminada (sin animaciones y con el fondo asentado)
    const confirm = deleteDialog(page).getByRole('button', { name: 'Eliminar', exact: true });
    await waitUntil(async () => (await backgroundOf(confirm)) === bgRgb && (await animationsRunning(confirm)) === 0, SETTLE_MS);
    const color = await colorOf(confirm);
    const background = await backgroundOf(confirm);
    const ratio = contrastOf(color, background);
    const checks: Check[] = [
      check(color === textRgb, `texto ${colorHex}`, `texto ${hexOf(color)}`),
      check(background === bgRgb, `sobre ${fondoHex}`, `sobre ${hexOf(background)}`),
      check(ratio !== undefined && ratio >= MIN_CONTRAST, 'contraste de al menos 4,5:1', `contraste ${ratioText(ratio)}`),
    ];

    // Cierre sin borrar: «Cancelar». Se verifica por API que PRG-001 sigue existiendo (evidencia de la prueba, no una regla de la historia)
    const cancelFailure = await runStepsLogged([['pulsar «Cancelar» en el diálogo', () => deleteDialog(page).getByRole('button', { name: 'Cancelar', exact: true }).click(ACTION)]]);
    const closed = await waitUntil(async () => (await deleteDialog(page).count()) === 0, SETTLE_MS);
    const token = await adminToken(TENANT_A);
    const program = await call('GET', `/programs/${PRG_001}`, { tenant: TENANT_A, token });

    const note = [
      'Preparación: diálogo de eliminación de PRG-001 abierto como administrador (alumno01@sigpro.lab) desde el menú de acciones de su fila. La medición se hace en el diálogo abierto, sobre el botón «Eliminar» (btn-danger), no en la tabla. Se cierra con «Cancelar»: el borrado no se confirma.',
      WEB_ONLY_NOTE,
    ].join(' ');
    return concluded(checks, {
      note,
      evidence: {
        medido_sobre: 'botón «Eliminar» del diálogo de eliminación de PRG-001',
        tema,
        contraste: ratioText(ratio),
        cancelar_fallo: cancelFailure ?? null,
        dialogo_cerrado: closed.reached,
        prg001_tras_cancelar_status: program.status,
      },
    });
  };

const claro = measureOn('claro');
const oscuro = measureOn('oscuro');
const peligroClaro = dangerDialog('claro');
const peligroOscuro = dangerDialog('oscuro');

defineBrowserRows({
  story: 'US-TEMA-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, claro],
    [2, oscuro],
    [3, peligroClaro],
    [4, peligroOscuro],
  ]),
});
