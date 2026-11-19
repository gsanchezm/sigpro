import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, linesOf, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionFailed,
  alertCheck,
  clickWizardButton,
  conclude,
  fieldValueCheck,
  fillField,
  interact,
  LOCAL_MS,
  onWeb,
  openWizard,
  signIn,
  stepCheck,
  wizardNameField,
  wizardOf,
  wizardOwnerField,
} from './common';

// US-PROG-ALTA-009 — Elegir el responsable con búsqueda en el asistente (web). Preparación de cada fila: reinicio de alumno01; gestor
// entra desde /login?tenant=alumno01, llega a /programs y abre «Nuevo programa» (paso 1). Tras el reinicio hay siete personas, en el
// orden de la lista de responsables (antigüedad y, a igualdad, id: u1 a u7).

const ALL_PERSONS: readonly string[] = ['Marta Ruiz', 'Javier Ortega', 'Lucía Fernández', 'Andrés Molina', 'Carmen Vidal', 'Pablo Serrano', 'Alumno 01'];

/** Lista de personas del asistente (su id de prueba: la lista no tiene nombre accesible propio). */
const personList = (page: Page): Locator => wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_LIST);
/** Opciones de la lista. Cada opción solo contiene el nombre: el avatar es una imagen con texto alternativo vacío. */
const optionsOf = (page: Page): Locator => personList(page).getByRole('option');

/** Nombres que muestra la lista, en el orden en que aparecen (`undefined` si no se pueden leer). */
const shownNames = (page: Page): Promise<readonly string[] | undefined> =>
  safe(async () => (await optionsOf(page).allTextContents()).map((text) => text.trim()), undefined);

/** Un «Entonces» de la lista: exactamente esas personas, en ese orden (o ninguna, con el texto «Sin coincidencias»). Espera con el techo local. */
const listCheck = async (page: Page, expected: readonly string[], noMatch: boolean): Promise<Check> => {
  const sameOrder = async (): Promise<boolean> => {
    const names = await shownNames(page);
    return names !== undefined && JSON.stringify(names) === JSON.stringify(expected);
  };
  const waited = await waitUntil(sameOrder, LOCAL_MS);
  const names = (await shownNames(page)) ?? [];
  const shownText = linesOf((await safe(() => textOf(personList(page)), undefined)) ?? undefined).join(' ');
  const shown = names.length === 0 ? `ninguna persona (texto «${shownText}»)` : names.join(', ');
  if (noMatch) {
    return check(waited.reached && names.length === 0 && shownText === 'Sin coincidencias', 'la lista muestra «Sin coincidencias»', `la lista muestra ${shown}`);
  }
  return check(waited.reached, `la lista muestra ${expected.join(', ')}`, `la lista muestra ${shown}`);
};

// --- Esquema 1: escribir en el campo filtra las personas por su nombre --------------------------------------------------------

/** Texto de la tabla → (texto escrito, lista esperada). «(vacío)» deja el campo sin escribir (las siete, en orden). */
const FILTER_OF: ReadonlyMap<string, { readonly typed: string; readonly expected: readonly string[]; readonly noMatch: boolean }> = new Map<
  string,
  { readonly typed: string; readonly expected: readonly string[]; readonly noMatch: boolean }
>([
  ['lucía', { typed: 'lucía', expected: ['Lucía Fernández'], noMatch: false }],
  ['PABLO', { typed: 'PABLO', expected: ['Pablo Serrano'], noMatch: false }],
  ['xyz', { typed: 'xyz', expected: [], noMatch: true }],
  ['(vacío)', { typed: '', expected: ALL_PERSONS, noMatch: false }],
]);

const filterRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const filter = strict('texto', FILTER_OF, cell(row, 'texto'));
  const typed = await fillField(wizardOwnerField(page), filter.typed, 'Responsable');
  if (typed) return actionFailed(expected, typed);
  return conclude([await listCheck(page, filter.expected, filter.noMatch)]);
};

// --- Esquema 2: elegir una persona fija el responsable y cierra la lista ------------------------------------------------------

/** Persona de la tabla del Esquema 2 (la que se elige en la lista). */
const PERSON_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['Andrés Molina', 'Andrés Molina'],
  ['Alumno 01', 'Alumno 01'],
]);

const pickRow: BrowserRowHandler = async (row, { page }) => {
  const expected = `el campo «Responsable» muestra ${cell(row, 'persona')}, la lista se cierra y el asistente sigue en «Paso 1 de 3»`;
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const persona = strict('persona', PERSON_OF, cell(row, 'persona'));
  const opening = await interact(wizardOwnerField(page), 'abrir «Responsable»', (element) => element.click(ACTION));
  if (opening) return actionFailed(expected, opening);
  const chosen = await interact(wizardOf(page).getByRole('option', { name: persona, exact: true }), `elegir «${persona}»`, (element) => element.click(ACTION));
  if (chosen) return actionFailed(expected, chosen);
  const closed = await waitUntil(async () => !(await isVisible(personList(page))), LOCAL_MS);
  return conclude([
    await fieldValueCheck(wizardOwnerField(page), persona, 'el campo «Responsable»'),
    check(closed.reached, 'la lista se cierra', closed.reached ? 'la lista se cierra' : 'la lista sigue abierta'),
    await stepCheck(page, 1, 'sigue en'),
  ]);
};

// --- Esquema 3: escribir sobre la persona elegida quita la elección -----------------------------------------------------------

const TYPED_OVER: ReadonlyMap<string, string> = new Map<string, string>([
  ['Pablo', 'Pablo'],
  ['x', 'x'],
]);

const overwriteRow: BrowserRowHandler = async (row, { page }) => {
  const expected = 'el campo ya no tiene responsable elegido y pulsar «Siguiente» muestra el aviso «Selecciona un responsable de la lista»';
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const first = await interact(wizardOwnerField(page), 'abrir «Responsable»', (element) => element.click(ACTION));
  if (first) return preparationFailedWeb(expected, first.message);
  const picked = await interact(wizardOf(page).getByRole('option', { name: 'Andrés Molina', exact: true }), 'elegir «Andrés Molina»', (element) => element.click(ACTION));
  if (picked) return preparationFailedWeb(expected, picked.message);
  if (!(await waitUntil(async () => await fieldValueIs(page, 'Andrés Molina'), LOCAL_MS)).reached) return preparationFailedWeb(expected, 'el campo no muestra «Andrés Molina» tras elegirlo');
  const typed = await fillField(wizardOwnerField(page), strict('texto', TYPED_OVER, cell(row, 'texto')), 'Responsable');
  if (typed) return actionFailed(expected, typed);
  const next = await clickWizardButton(page, 'Siguiente');
  if (next) return actionFailed(expected, next);
  return conclude([await alertCheck(wizardOf(page).getByTestId(PROGRAMAS_TESTIDS.PROGRAMS_WIZARD_OWNER_ERROR), 'Selecciona un responsable de la lista', 'el aviso bajo «Responsable»')]);
};

/** ¿El campo «Responsable» muestra ese texto? (lectura fallida = no). */
const fieldValueIs = async (page: Page, text: string): Promise<boolean> => (await safe(() => wizardOwnerField(page).inputValue({ timeout: 500 }), undefined)) === text;

// --- Esquema 4: la tecla Esc cierra primero la lista de responsables y después el asistente -------------------------------

/** Evidencia: elemento con el foco (etiqueta, id, data-testid y aria-label). No decide el veredicto. */
const focusedElement = (page: Page): Promise<string> =>
  safe(
    () =>
      page.evaluate(() => {
        const element = document.activeElement;
        if (!(element instanceof HTMLElement)) return '(ninguno)';
        const testid = element.getAttribute('data-testid');
        const label = element.getAttribute('aria-label');
        return `${element.tagName.toLowerCase()}${element.id === '' ? '' : `#${element.id}`}${testid === null ? '' : `[data-testid="${testid}"]`}${label === null ? '' : ` aria-label="${label}"`}`;
      }),
    '(sin leer)',
  );

/** Evidencia: `aria-expanded` del campo «Responsable» (el campo puede haber salido del DOM con el asistente cerrado). */
const expandedOf = (page: Page): Promise<string> => safe(async () => (await wizardOwnerField(page).getAttribute('aria-expanded', { timeout: 500 })) ?? '(sin atributo)', '(sin leer)');

/** Un muestreo del DOM tras Escape: estado del campo, lista visible, diálogos y listas que hay en el DOM en ese momento. */
interface Sample {
  readonly aria_expanded: string;
  readonly lista_visible: boolean | undefined;
  readonly dialogo_nuevo_programa_en_dom: number;
  readonly dialogos_en_dom: readonly string[];
  readonly listboxes_en_dom: number;
}

const sampleAfterEscape = async (page: Page): Promise<Sample> => ({
  aria_expanded: await expandedOf(page),
  lista_visible: await safe<boolean | undefined>(() => personList(page).first().isVisible(), undefined),
  dialogo_nuevo_programa_en_dom: await safe(() => wizardOf(page).count(), -1),
  dialogos_en_dom: await safe(
    () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="dialog"]')).map((dialog) => {
          const labelledBy = dialog.getAttribute('aria-labelledby');
          return labelledBy === null ? (dialog.getAttribute('aria-label') ?? '(sin nombre)') : (document.getElementById(labelledBy)?.textContent ?? '(sin texto)');
        }),
      ),
    [] as string[],
  ),
  listboxes_en_dom: await safe(() => page.evaluate(() => document.querySelectorAll('[role="listbox"]').length), -1),
});

/** Situación de la tabla → si la lista del responsable está abierta (true) o cerrada (false) antes de pulsar Esc. */
const SITUATION_OPEN: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['con la lista abierta', true],
  ['con la lista cerrada', false],
]);

/** Lo medido con la lista abierta: qué cerró Escape (la lista, o el asistente entero), con el foco y el aria-expanded antes. */
const observedListOpen = (focus: string, expanded: string, first: Sample, third: Sample): string => {
  if (first.dialogo_nuevo_programa_en_dom === 0 && third.dialogo_nuevo_programa_en_dom === 0) {
    return `Escape con la lista abierta cierra el asistente entero: 1 s y 3 s después no hay diálogo en el DOM (listbox en el DOM a 3 s: ${third.listboxes_en_dom}); el foco estaba en ${focus} y aria-expanded ${expanded}`;
  }
  if (third.dialogo_nuevo_programa_en_dom > 0 && third.lista_visible === false) {
    return `Escape cierra solo la lista: 1 s y 3 s después el asistente sigue en el DOM y la lista no se ve; el foco estaba en ${focus} y aria-expanded ${expanded}`;
  }
  return `Escape no cierra la lista: 3 s después la lista ${third.lista_visible === true ? 'sigue visible' : 'no se ve'} y hay ${third.dialogo_nuevo_programa_en_dom} diálogo(s) del asistente en el DOM; el foco estaba en ${focus} y aria-expanded ${expanded}`;
};

/** Lo medido con la lista cerrada: si Escape cerró el asistente (sin diálogo en el DOM a 1 s ni a 3 s). */
const observedListClosed = (first: Sample, third: Sample): string =>
  first.dialogo_nuevo_programa_en_dom === 0 && third.dialogo_nuevo_programa_en_dom === 0
    ? 'el asistente se cierra: 1 s y 3 s después no hay diálogo del asistente en el DOM'
    : `el asistente sigue abierto: ${first.dialogo_nuevo_programa_en_dom} diálogo(s) en el DOM a 1 s y ${third.dialogo_nuevo_programa_en_dom} a 3 s`;

/** Nota de la discrepancia con la historia (Escape con la lista abierta): la causa está en el código del asistente. */
const LIST_OPEN_NOTE =
  'La historia dice que Escape con la lista abierta cierra solo la lista y el asistente sigue abierto. La app cierra el asistente entero: Modal.tsx:32-33 y :51 atienden Escape en captura sobre document y detienen la propagación antes de que OwnerCombobox.tsx:75-77 lo vea.';

const escRow: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  const opened = await signIn(page);
  if (opened) return preparationFailedWeb(expected, opened);
  const openedWizard = await openWizard(page);
  if (openedWizard) return preparationFailedWeb(expected, openedWizard.message);
  const listOpenBefore = strict('situacion', SITUATION_OPEN, cell(row, 'situacion'));
  // Abierta: el foco abre la lista del responsable. Cerrada: se abre y luego el foco pasa a «Nombre» (la lista se cierra sola).
  const focused = await interact(wizardOwnerField(page), 'enfocar «Responsable»', (element) => element.click(ACTION));
  if (focused) return preparationFailedWeb(expected, focused.message);
  if (!listOpenBefore) {
    const moved = await interact(wizardNameField(page), 'pasar el foco a «Nombre»', (element) => element.click(ACTION));
    if (moved) return preparationFailedWeb(expected, moved.message);
  }
  // Precondición: el asistente está abierto y la lista está en el estado de la fila, antes de pulsar Escape
  const wizardBefore = await waitUntil(() => isVisible(wizardOf(page)), LOCAL_MS);
  const listBefore = await waitUntil(async () => (await isVisible(personList(page))) === listOpenBefore, LOCAL_MS);
  if (!wizardBefore.reached || !listBefore.reached) {
    return preparationFailedWeb(expected, `antes de pulsar Escape: el asistente ${wizardBefore.reached ? 'está abierto' : 'no está abierto'} y la lista ${listBefore.reached ? `está ${listOpenBefore ? 'abierta' : 'cerrada'}` : `no está ${listOpenBefore ? 'abierta' : 'cerrada'}`}`);
  }
  // Evidencia (no veredicto): qué tiene el foco y el estado del campo antes de pulsar Escape
  const focusBefore = await focusedElement(page);
  const expandedBefore = await expandedOf(page);
  const pressed = await interact(wizardOf(page), 'pulsar la tecla Esc', () => page.keyboard.press('Escape'));
  if (pressed) return actionFailed(expected, pressed);
  // Un solo muestreo tras 1 s y otro tras 3 s desde la tecla
  await sleep(1_000);
  const first = await sampleAfterEscape(page);
  await sleep(2_000);
  const third = await sampleAfterEscape(page);
  const evidence = { foco_antes_de_esc: focusBefore, aria_expanded_antes: expandedBefore, tras_1s: first, tras_3s: third };

  if (listOpenBefore) {
    // La fila pide: la lista se cierra y el asistente sigue en «Paso 1 de 3». «La lista se cierra» solo cuenta si el asistente sigue en
    // el DOM: sin asistente no hay lista que cerrar (no se da por cumplido en vacío).
    const ok = first.dialogo_nuevo_programa_en_dom > 0 && third.dialogo_nuevo_programa_en_dom > 0 && first.lista_visible === false && third.lista_visible === false;
    const checks = [check(ok, expected, observedListOpen(focusBefore, expandedBefore, first, third))];
    return conclude(checks, { evidence, ...(ok ? {} : { note: LIST_OPEN_NOTE }) });
  }
  const closed = first.dialogo_nuevo_programa_en_dom === 0 && third.dialogo_nuevo_programa_en_dom === 0;
  return conclude([check(closed, expected, observedListClosed(first, third))], { evidence });
};

defineBrowserRows({
  story: 'US-PROG-ALTA-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(filterRow)],
    [2, onWeb(pickRow)],
    [3, onWeb(overwriteRow)],
    [4, onWeb(escRow)],
  ]),
});
