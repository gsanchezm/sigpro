import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserRowHandler, type BrowserFixtures, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import {
  chooseIn,
  classSelect,
  codesOf,
  controlValue,
  countCheck,
  interact,
  listCheck,
  onWeb,
  openDocuments,
  programSelect,
  searchBox,
  selectedOptionText,
  shownCodes,
  signIn,
  subtitleText,
  thenOf,
  toolbarClear,
  waitForList,
  type Blocked,
  finish,
} from './common';

// US-DOC-LISTA-007 — Búsqueda y filtros de la lista de documentos en la web (escritorio). Preparación: reinicio de alumno01, inicio
// de sesión de gestor@sigpro.test y apertura de /documents con diseño de escritorio. El recuento que se juzga es el de debajo de la
// tabla («N documentos» de la lista que se ve); el de encima se anota como evidencia.

type Page = BrowserFixtures['page'];

/** Texto de búsqueda de la celda (es lo que se escribe en el buscador). */
const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['plan', 'plan'],
  ['PRG-004', 'PRG-004'],
  ['Ártemis', 'Ártemis'],
]);

/** Programa de la celda → texto de la opción del desplegable «Programa». */
const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['«PRG-002»', 'PRG-002'],
  ['«Todos los programas»', 'Todos los programas'],
  ['«PRG-001»', 'PRG-001'],
]);

/** Clasificación de la celda → texto de la opción del desplegable «Clasificación». */
const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Todas las clasificaciones»', 'Todas las clasificaciones'],
  ['«Restringido»', 'Restringido'],
  ['«Público»', 'Público'],
]);

/** Recuento de la celda, sin sus comillas de texto de la interfaz («6 documentos» → 6 documentos). */
const RECUENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«6 documentos»', '6 documentos'],
  ['«2 documentos»', '2 documentos'],
  ['«0 documentos»', '0 documentos'],
  ['«4 documentos»', '4 documentos'],
]);

/** Programa que se elige a la vez que se escribe el texto y se elige la clasificación (tercera tabla). */
const PROGRAMA_LIMPIEZA: ReadonlyMap<string, string> = new Map<string, string>([
  ['«PRG-002»', 'PRG-002'],
  ['«Todos los programas»', 'Todos los programas'],
]);

/** Todos los documentos del tenant (12), en orden. */
const TODOS: readonly string[] = Array.from({ length: 12 }, (_, index) => `DOC-${String(index + 1).padStart(3, '0')}`);

/** Prepara la pantalla de escritorio: reinicio, inicio de sesión y /documents. */
const prepare = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return (await signIn(page, 'escritorio')) ?? (await openDocuments(page));
};

/** Resultado de una acción fallida, como fila con su diagnóstico. */
const failedAction = (expected: string, blocked: Blocked): Outcome => ({
  verdict: 'discrepa',
  expected,
  observed: blocked.message,
  note: blocked.note,
  ...(blocked.evidence === undefined ? {} : { evidence: blocked.evidence }),
});

/** El buscador queda vacío (lectura del valor del campo). */
const searchEmptyCheck = async (page: Page): Promise<Check> => {
  const value = await controlValue(searchBox(page));
  return check(value === '', 'el buscador queda vacío', `el buscador tiene «${value ?? '(sin leer)'}»`);
};

// --- Esquema 1: el buscador deja los documentos cuyo código o título contiene el texto --------------------------------------------

const searchFilters: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const recuento = strict('recuento', RECUENTO, cell(row, 'recuento'));
  const codes = codesOf(cell(row, 'codigos'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const typed = await interact(searchBox(page), `escribir «${texto}» en «Buscar documentos»`, (element) => element.fill(texto, ACTION));
  if (typed !== undefined) return failedAction(expected, typed);
  const shown = await waitForList(page, codes, recuento);
  return finish([listCheck(shown.codes, codes), countCheck(shown.count, recuento)], {
    evidence: { recuentoEncimaDeLaTabla: (await subtitleText(page)) ?? null },
  });
});

// --- Esquema 2: los desplegables acotan la lista por programa y por clasificación ---------------------------------------------------

const dropdownFilters: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const programa = strict('programa', PROGRAMA, cell(row, 'programa'));
  const clasificacion = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const recuento = strict('recuento', RECUENTO, cell(row, 'recuento'));
  const codes = codesOf(cell(row, 'codigos'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const chosenProgram = await chooseIn(programSelect, programa, 'Programa')(page);
  if (chosenProgram !== undefined) return failedAction(expected, chosenProgram);
  const chosenClass = await chooseIn(classSelect, clasificacion, 'Clasificación')(page);
  if (chosenClass !== undefined) return failedAction(expected, chosenClass);
  const shown = await waitForList(page, codes, recuento);
  return finish([listCheck(shown.codes, codes), countCheck(shown.count, recuento)]);
});

// --- Esquema 3: «Limpiar filtros» quita el texto y los dos desplegables a la vez ----------------------------------------------------

const clearFilters: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const programa = strict('programa', PROGRAMA_LIMPIEZA, cell(row, 'programa'));
  const clasificacion = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const failure = await prepare(page);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const typed = await interact(searchBox(page), `escribir «${texto}» en «Buscar documentos»`, (element) => element.fill(texto, ACTION));
  if (typed !== undefined) return failedAction(expected, typed);
  const chosenProgram = await chooseIn(programSelect, programa, 'Programa')(page);
  if (chosenProgram !== undefined) return failedAction(expected, chosenProgram);
  const chosenClass = await chooseIn(classSelect, clasificacion, 'Clasificación')(page);
  if (chosenClass !== undefined) return failedAction(expected, chosenClass);
  // Precondición: los tres filtros llegan a la lista (una lista filtrada, con menos de 12 y al menos uno) antes de limpiar.
  const filtered = await waitUntil(async () => {
    const codes = await shownCodes(page);
    return codes !== undefined && codes.length > 0 && codes.length < 12;
  });
  if (!filtered.reached) return preparationFailedWeb(expected, 'los filtros no llegan a la lista: no se ve una lista filtrada');
  const cleared = await interact(toolbarClear(page), 'pulsar «Limpiar filtros»', (element) => element.click(ACTION));
  if (cleared !== undefined) return failedAction(expected, cleared);
  const shown = await waitForList(page, TODOS, '12 documentos');
  return finish([
    await searchEmptyCheck(page),
    check((await selectedOptionText(programSelect(page))) === 'Todos los programas', '«Programa» muestra «Todos los programas»', `«Programa» muestra «${(await selectedOptionText(programSelect(page))) ?? '(sin leer)'}»`),
    check((await selectedOptionText(classSelect(page))) === 'Todas las clasificaciones', '«Clasificación» muestra «Todas las clasificaciones»', `«Clasificación» muestra «${(await selectedOptionText(classSelect(page))) ?? '(sin leer)'}»`),
    listCheck(shown.codes, TODOS),
    countCheck(shown.count, '12 documentos'),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-LISTA-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, searchFilters],
    [2, dropdownFilters],
    [3, clearFilters],
  ]),
});

