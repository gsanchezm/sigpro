import type { Locator, Page } from '@playwright/test';
import { NC_TESTIDS } from '../../../../packages/shared/src/testids';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { actionFailed, interact, observe, pollPersisted, toastShown, verdictWeb, watchRequests, waitCount, type Blocked } from '../web/common';
import { onMobile, prepareMobile, readNew, waitNew, type MobileNewView } from './common';

// US-NC-GESTION-010 — Alta de una no conformidad desde el diálogo «Nueva no conformidad» en la app móvil (Expo web a 390 px; NO es nativo).
// Preparación de cada fila: reinicio de alumno01 con su administrador; la cuenta de la fila abre la app con alumno01 en «Tenant de trabajo»,
// inicia sesión y llega a «No conformidades». El recuento del seed es «12 no conformidades · 8 abiertas».

const TEN_A = 'a'.repeat(10);
const COUNT_AFTER = '13 no conformidades · 9 abiertas';
const CREATE_PATH = '/api/nc';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

const SEVERITY_CELLS: ReadonlyMap<string, { readonly label: string; readonly key: string }> = new Map<string, { readonly label: string; readonly key: string }>([
  ['«Crítica»', { label: 'Crítica', key: 'critical' }],
  ['«Menor»', { label: 'Menor', key: 'minor' }],
  ['«Mayor»', { label: 'Mayor', key: 'major' }],
]);

interface Filling {
  readonly program: boolean;
  readonly severity: string | undefined;
  readonly description: string | undefined;
  readonly errorField: 'programError' | 'severityError' | 'descriptionError';
}

const FILLING_CELLS: ReadonlyMap<string, Filling> = new Map<string, Filling>([
  ['programa (sin elegir), severidad «Mayor» y descripción (10 letras a)', { program: false, severity: 'Mayor', description: TEN_A, errorField: 'programError' }],
  ['programa PRG-001, severidad (sin elegir) y descripción (10 letras a)', { program: true, severity: undefined, description: TEN_A, errorField: 'severityError' }],
  ['programa PRG-001, severidad «Mayor» y descripción (9 letras a)', { program: true, severity: 'Mayor', description: 'a'.repeat(9), errorField: 'descriptionError' }],
  ['programa PRG-001, severidad «Mayor» y descripción (sin elegir)', { program: true, severity: 'Mayor', description: undefined, errorField: 'descriptionError' }],
]);

const MESSAGE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Elige un programa»', 'Elige un programa'],
  ['«Elige una severidad»', 'Elige una severidad'],
  ['«La descripción debe tener al menos 10 caracteres»', 'La descripción debe tener al menos 10 caracteres'],
]);

const dialogOf = (page: Page): Locator => page.getByTestId(NC_TESTIDS.NC_NEW_DIALOG);

/** Abre «Nueva no conformidad» y espera a que el alta tenga los programas cargados (la lista deja de estar en espera). */
const openNewMobile = async (page: Page): Promise<Blocked | undefined> => {
  const clicked = await interact(page.getByRole('button', { name: 'Nueva no conformidad', exact: true }), 'pulsar «Nueva no conformidad»', (element) => element.click(ACTION));
  if (clicked !== undefined) return clicked;
  const shown = await waitNew(page, (view) => view.open && view.programEnabled === true);
  return shown === undefined || !shown.open ? { message: 'no se abrió el diálogo «Nueva no conformidad» con los programas cargados', note: 'el diálogo no abre o los programas no cargan en el plazo' } : undefined;
};

/** Elige el programa PRG-001 en el selector «Programa» (una hoja con opciones tipo radio). */
const choosePrg001 = async (page: Page): Promise<Blocked | undefined> => {
  const opened = await interact(dialogOf(page).getByRole('combobox', { name: 'Programa', exact: true }), 'abrir «Programa»', (element) => element.click(ACTION));
  if (opened !== undefined) return opened;
  return interact(page.getByRole('radio', { name: /^PRG-001 · / }), 'elegir PRG-001 en «Programa»', (element) => element.click(ACTION));
};

const chooseSeverity = (page: Page, label: string): Promise<Blocked | undefined> =>
  interact(dialogOf(page).getByRole('radio', { name: label, exact: true }), `elegir la severidad «${label}»`, (element) => element.click(ACTION));

const writeDescription = (page: Page, text: string): Promise<Blocked | undefined> =>
  interact(dialogOf(page).getByRole('textbox', { name: 'Descripción', exact: true }), 'escribir en «Descripción»', (element) => element.fill(text, ACTION));

const submitMobile = (page: Page): Promise<Blocked | undefined> =>
  interact(dialogOf(page).getByRole('button', { name: 'Abrir no conformidad', exact: true }), 'pulsar «Abrir no conformidad»', (element) => element.click(ACTION));

// --- Esquema 1: cada rol abre una no conformidad con datos válidos -------------------------------------------------------------

const createValid: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const severity = strict('severidad', SEVERITY_CELLS, cell(row, 'severidad'));
  const expected = `${account} abre «Nueva no conformidad» desde /nc, elige PRG-001, severidad «${severity.label}» y descripción (10 letras a) → aviso «NC-013 abierta» y recuento «${COUNT_AFTER}»`;
  const log = watchRequests(page);
  const failed: Outcome | undefined = await prepareMobile(page, account, expected);
  if (failed !== undefined) return failed;

  const opened = await openNewMobile(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const program = await choosePrg001(page);
  if (program !== undefined) return actionFailed(expected, program);
  const picked = await chooseSeverity(page, severity.label);
  if (picked !== undefined) return actionFailed(expected, picked);
  const written = await writeDescription(page, TEN_A);
  if (written !== undefined) return actionFailed(expected, written);
  const submitted = await submitMobile(page);
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const toast = await toastShown(page, 'ok', 'NC-013 abierta');
  const counted = await waitCount(page, COUNT_AFTER);
  const closed = await waitUntil(async () => (await dialogOf(page).count()) === 0);
  const saved = await pollPersisted('NC-013', (fields) => fields.code === 'NC-013');
  return verdictWeb([
    check(toast.readable && toast.seen, 'aviso «NC-013 abierta»', toast.observed),
    check(counted === COUNT_AFTER, `recuento «${COUNT_AFTER}»`, `recuento «${counted ?? '(sin leer)'}»`),
    check(closed.reached, 'el diálogo se cierra', closed.reached ? 'el diálogo se cerró' : 'el diálogo sigue abierto'),
    check(saved?.severity === severity.key && saved?.programCode === 'PRG-001' && saved?.assigneeId === null, `NC-013 en el servidor: PRG-001, severidad ${severity.key}, sin asignar`, `NC-013 en el servidor: ${saved?.programCode ?? '(sin leer)'}, severidad ${saved?.severity ?? '(sin leer)'}, assigneeId ${saved === undefined ? '(sin leer)' : String(saved.assigneeId)}`),
    check(log.count('POST', CREATE_PATH) === 1, 'una sola petición POST /api/nc', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
  ]);
};

// --- Esquema 2: cada campo obligatorio se valida antes de enviar -------------------------------------------------------------------

const eachFieldValidated: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const filling = strict('combinacion', FILLING_CELLS, cell(row, 'combinacion'));
  const message = strict('mensaje', MESSAGE_CELLS, cell(row, 'mensaje'));
  const expected = `al enviar «${cell(row, 'combinacion')}» aparece «${message}» bajo su campo, el diálogo sigue abierto y no hay petición de alta`;
  const log = watchRequests(page);
  const failed = await prepareMobile(page, 'gestor@sigpro.test', expected);
  if (failed !== undefined) return failed;

  const opened = await openNewMobile(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  if (filling.program) {
    const program = await choosePrg001(page);
    if (program !== undefined) return actionFailed(expected, program);
  }
  if (filling.severity !== undefined) {
    const severity = await chooseSeverity(page, filling.severity);
    if (severity !== undefined) return actionFailed(expected, severity);
  }
  if (filling.description !== undefined) {
    const written = await writeDescription(page, filling.description);
    if (written !== undefined) return actionFailed(expected, written);
  }
  // Relectura del campo «Descripción» tras escribir (vacío si la fila no escribe nada): lo que se envía es lo que dice la fila
  const readBack = await dialogOf(page)
    .getByRole('textbox', { name: 'Descripción', exact: true })
    .first()
    .inputValue({ timeout: 2_000 })
    .catch(() => undefined);
  const submitted = await submitMobile(page);
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const shown = await waitUntil(async () => (await readNew(page))?.[filling.errorField] === message);
  const view: MobileNewView | undefined = await readNew(page);
  await observe(2_000);
  return verdictWeb([
    check(readBack !== undefined && readBack.trim() === (filling.description ?? '').trim(), 'el campo «Descripción» contiene el texto de la fila', `campo «Descripción» con «${readBack ?? '(sin leer)'}»`),
    check(shown.reached, `«${message}» bajo su campo`, `bajo su campo: ${view?.[filling.errorField] ?? '(sin error visible)'}`),
    check((await readNew(page))?.open === true, 'el diálogo sigue abierto', (await readNew(page))?.open === true ? 'el diálogo sigue abierto' : 'el diálogo no está abierto'),
    check(log.count('POST', CREATE_PATH) === 0, 'ninguna petición de alta', `peticiones POST /api/nc: ${log.count('POST', CREATE_PATH)}`),
    check(log.count('GET', CREATE_PATH) > 0, 'control: el registro de peticiones ve la carga de la lista', `peticiones GET /api/nc vistas: ${log.count('GET', CREATE_PATH)}`),
  ], 'Regla sin fila: «Abrir no conformidad» deshabilitado mientras cargan los programas («Cargando programas…»); la fila solo abre el diálogo una vez cargados.');
};

defineBrowserRows({
  story: 'US-NC-GESTION-010',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(createValid)],
    [2, onMobile(eachFieldValidated)],
  ]),
});
