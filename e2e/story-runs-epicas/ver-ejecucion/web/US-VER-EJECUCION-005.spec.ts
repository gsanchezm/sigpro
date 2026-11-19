import type { Locator } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { ACTION, attrOf, isVisible, safe, waitUntil } from '../../support/browser';
import { ACCOUNT_OF, caseOf, field, loginAs, runCountOf, runIdsOf, runsById, verdict } from '../api/common';
import { upload, type Upload } from '../api/files';
import {
  READ_MS,
  actionFailed,
  armToasts,
  chooseFiles,
  deniedNote,
  evidenceSimpleInput,
  firstRunId,
  headerResult,
  inOrder,
  interact,
  motiveOf,
  noOkToast,
  notesBox,
  onWeb,
  prepareCase,
  readFilesPanel,
  readRunRow,
  resultErrorText,
  resultRadio,
  runForm,
  runRowCount,
  runRowOf,
  serverErrorBox,
  submitButton,
  textOfVisible,
  toastShown,
  watchRunPosts,
  type WebAccount,
} from './common';
import { VERIFICACION_TESTIDS } from '../../../../packages/shared/src/testids';

// US-VER-EJECUCION-005 — Registro de una ejecución desde el detalle del caso (web). Preparación de cada fila: reinicio de alumno01 con
// su administrador; la persona entra en /login?tenant=alumno01 con la cuenta de la fila y abre /verification/TC-001. Cada aviso se
// observa en el registro de avisos de la página (armado justo antes de la acción); el historial y la cabecera se leen tras el aviso,
// y la persistencia se comprueba por la API, después de la interfaz.

// --- Celdas ---------------------------------------------------------------------------------------------------------------------------

interface Resultado {
  readonly label: string;
  readonly api: string;
}

/** Opción del selector de resultado (la historia la escribe entre comillas). */
const RESULTADO: ReadonlyMap<string, Resultado> = new Map<string, Resultado>([
  ['«Superado»', { label: 'Superado', api: 'pass' }], // strict: 005/E1/resultado
  ['«Fallido»', { label: 'Fallido', api: 'fail' }],
  ['«Bloqueado»', { label: 'Bloqueado', api: 'blocked' }],
]);

/** Último resultado que muestra la cabecera de la página. */
const ULTIMO: ReadonlyMap<string, Resultado> = new Map<string, Resultado>([
  ['«Superado»', { label: 'Superado', api: 'pass' }], // strict: 005/E1/ultimo
  ['«Fallido»', { label: 'Fallido', api: 'fail' }],
  ['«Bloqueado»', { label: 'Bloqueado', api: 'blocked' }],
]);

/** Texto exacto del aviso «Ejecución registrada» de cada resultado (caso: TC-001; ejecución: RUN-051). */
const AVISO: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-001: Superado · RUN-051', 'TC-001: Superado · RUN-051'], // strict: 005/E1/aviso
  ['TC-001: Fallido · RUN-051', 'TC-001: Fallido · RUN-051'],
  ['TC-001: Bloqueado · RUN-051', 'TC-001: Bloqueado · RUN-051'],
]);

/** Notas de la E2: vacías (no se escriben) o un texto. */
const NOTAS_E2: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', undefined], // strict: 005/E2/notas
  ['Prueba sin resultado', 'Prueba sin resultado'],
]);

/** Longitud de las notas de la E3. */
const CARACTERES: ReadonlyMap<string, number> = new Map<string, number>([
  ['999', 999], // strict: 005/E3/caracteres
  ['1000', 1000],
  ['1001', 1001],
]);

/** Lo que la E3 espera: el aviso de registro con su texto (guarda), o el aviso bajo «Notas» y ninguna ejecución (rechaza). */
const RESPUESTA_E3: ReadonlyMap<string, 'guarda' | 'rechaza'> = new Map<string, 'guarda' | 'rechaza'>([
  ['ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051»', 'guarda'], // strict: 005/E3/respuesta
  ['ve bajo el campo «Notas» el aviso «Las notas admiten hasta 1000 caracteres», y el historial sigue con 2 ejecuciones', 'rechaza'],
]);

/** Archivo que el navegador acepta por su extensión y el servidor rechaza por su contenido. */
const ARCHIVO_E4: ReadonlyMap<string, () => Upload> = new Map<string, () => Upload>([
  ['falso.png', () => upload('falso.png', 'image/png', 'texto', 1024)], // strict: 005/E4/archivo
  ['mal.png', () => upload('mal.png', 'image/png', 'jpeg', 1024)],
]);

/** Aviso de error del servidor para un archivo que no es PNG, JPEG ni PDF (el texto del motivo). */
const AVISO_E4: ReadonlyMap<string, string> = new Map<string, string>([['Solo se admiten archivos PNG, JPEG o PDF', 'Solo se admiten archivos PNG, JPEG o PDF']]); // strict: 005/E4/aviso

/** Cuenta sin permiso (la E5): solo las que no ejecutan pruebas. */
const CUENTA_E5: ReadonlyMap<string, WebAccount> = new Map<string, WebAccount>([
  ['gestor@sigpro.test', 'gestor'], // strict: 005/E5/cuenta
  ['auditor@sigpro.test', 'auditor'],
]);

/** Motivo del formulario para quien no tiene el permiso (texto visible y `title` del botón). */
const MOTIVO_PERMISO = 'Tu rol no permite registrar ejecuciones';

/** Número de ejecuciones del caso según la API (con la cuenta de alumno01). `undefined` si no se puede leer. */
const apiRunCount = async (): Promise<number | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return undefined;
  return runCountOf(await caseOf(session.token));
};

const apiCase = async () => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  return session.token === undefined ? undefined : caseOf(session.token);
};

/** Desactivado (propiedad) o `undefined` si no se puede leer. */
const disabledOf = (target: Locator): Promise<boolean | undefined> => safe(() => target.isDisabled({ timeout: READ_MS }), undefined);

// --- E1: una ejecución con resultado y notas aparece en el historial -------------------------------------------------------------------

const registra: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `ejecución registrada «${cell(row, 'aviso')}»`;
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const choice = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const ultimo = strict('ultimo', ULTIMO, cell(row, 'ultimo'));
  const posts = watchRunPosts(page);
  const picked = await inOrder(
    () => interact(resultRadio(page, choice.label), `elegir «${choice.label}»`, (element) => element.check(ACTION)),
    () => interact(notesBox(page), 'escribir en «Notas»', (element) => element.fill('Prueba de humo', ACTION)),
  );
  if (picked !== undefined) return actionFailed(expected, picked);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);
  const toast = await toastShown(page, 'ok', 'Ejecución registrada', aviso);
  await waitUntil(async () => (await firstRunId(page)) === 'RUN-051');
  const first = await firstRunId(page);
  const firstRow = await readRunRow(runRowOf(page, 'RUN-051'));
  const header = await waitUntil(async () => (await headerResult(page)) === ultimo.label).then(() => headerResult(page));
  const after = await apiCase();
  const saved = after === undefined ? undefined : runsById(after).get('RUN-051');
  const checks: Check[] = [
    check(toast.seen, `aviso «Ejecución registrada» con el texto «${aviso}»`, toast.observed),
    check(first === 'RUN-051', 'el historial muestra RUN-051 como primera fila', `primera fila ${first ?? '(ninguna)'}`),
    check(firstRow?.cells[1] === choice.label, `RUN-051 con el resultado «${choice.label}»`, `RUN-051 con el resultado «${firstRow?.cells[1] ?? '(sin leer)'}»`),
    check(firstRow?.cells[2] === 'Prueba de humo', 'RUN-051 con las notas «Prueba de humo»', `RUN-051 con las notas «${firstRow?.cells[2] ?? '(sin leer)'}»`),
    check(header === ultimo.label, `la cabecera muestra el último resultado «${ultimo.label}»`, `la cabecera muestra «${header ?? '(sin leer)'}»`),
    check(after !== undefined && field(after.body, 'lastResult') === choice.api, `la API guarda el último resultado ${choice.api}`, `la API guarda el último resultado ${String(after === undefined ? '(sin leer)' : field(after.body, 'lastResult'))}`),
    check(after !== undefined && runIdsOf(after)[0] === 'RUN-051' && saved?.result === choice.api && saved?.notes === 'Prueba de humo', 'la API guarda RUN-051 como primera, con el resultado y las notas', `la API: primera ${after === undefined ? '(sin leer)' : (runIdsOf(after)[0] ?? '(ninguna)')}, RUN-051 ${saved === undefined ? '(no está)' : `con ${String(saved.result)} y notas «${String(saved.notes)}»`}`),
    check(posts() === 1, 'se envía una sola petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
  ];
  const note = ultimo.label === 'Bloqueado' ? 'La fila no distingue por la cabecera: el último resultado del seed ya es «Bloqueado»; se confirma además por el historial y por la API.' : undefined;
  return verdict(checks, note);
};

// --- E2: sin resultado elegido no se envía la ejecución ----------------------------------------------------------------------------------

const sinResultado: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'sin resultado no se envía y aparece «Selecciona un resultado»';
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const notas = strict('notas', NOTAS_E2, cell(row, 'notas'));
  const posts = watchRunPosts(page);
  if (notas !== undefined) {
    const typed = await interact(notesBox(page), 'escribir en «Notas»', (element) => element.fill(notas, ACTION));
    if (typed !== undefined) return actionFailed(expected, typed);
  }
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);
  await waitUntil(() => isVisible(resultErrorText(page)));
  const message = await textOfVisible(resultErrorText(page));
  const quiet = await noOkToast(page);
  const rows = await runRowCount(page);
  const count = await apiRunCount();
  return verdict([
    check(message === 'Selecciona un resultado', 'bajo las opciones aparece «Selecciona un resultado»', `bajo las opciones aparece «${message ?? '(no visible)'}»`),
    check(quiet.held, 'no aparece el aviso «Ejecución registrada»', quiet.held ? 'no aparece el aviso «Ejecución registrada»' : `aparece «${quiet.seen}»`),
    check(rows === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${rows} ejecución(es)`),
    check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
    check(posts() === 0, 'no se envía ninguna petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
  ]);
};

// --- E3: las notas admiten hasta 1000 caracteres ------------------------------------------------------------------------------------------

const notasLimite: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'las notas de la fila se aceptan o se rechazan según su longitud';
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const size = strict('caracteres', CARACTERES, cell(row, 'caracteres'));
  const outcomeExpected = strict('respuesta', RESPUESTA_E3, cell(row, 'respuesta'));
  const posts = watchRunPosts(page);
  const picked = await inOrder(
    () => interact(resultRadio(page, 'Fallido'), 'elegir «Fallido»', (element) => element.check(ACTION)),
    () => interact(notesBox(page), `escribir ${size} caracteres en «Notas»`, (element) => element.fill('a'.repeat(size), ACTION)),
  );
  if (picked !== undefined) return actionFailed(expected, picked);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);
  if (outcomeExpected === 'guarda') {
    const toast = await toastShown(page, 'ok', 'Ejecución registrada', 'TC-001: Fallido · RUN-051');
    await waitUntil(async () => (await firstRunId(page)) === 'RUN-051');
    const after = await apiCase();
    const saved = after === undefined ? undefined : runsById(after).get('RUN-051');
    return verdict([
      check(toast.seen, 'aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051»', toast.observed),
      check(saved?.result === 'fail' && typeof saved.notes === 'string' && saved.notes.length === size, `la API guarda RUN-051 con «fail» y ${size} caracteres de notas`, saved === undefined ? 'la API no tiene RUN-051' : `la API guarda RUN-051 con «${String(saved.result)}» y ${typeof saved.notes === 'string' ? saved.notes.length : '(sin notas)'} caracteres`),
      check(posts() === 1, 'se envía una sola petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
    ]);
  }
  // Un aviso bajo el campo «Notas» y ninguna ejecución: se observa durante un instante de reacción local (1 s)
  await sleep(1_000);
  const notice = runForm(page).getByText('Las notas admiten hasta 1000 caracteres', { exact: true });
  const shown = await safe(() => notice.first().isVisible(), false);
  const quiet = await noOkToast(page);
  const rows = await runRowCount(page);
  const count = await apiRunCount();
  return verdict([
    check(shown, 'bajo «Notas» aparece «Las notas admiten hasta 1000 caracteres»', shown ? 'bajo «Notas» aparece «Las notas admiten hasta 1000 caracteres»' : 'bajo «Notas» no aparece el aviso «Las notas admiten hasta 1000 caracteres» (no sale ningún aviso del límite)'),
    check(quiet.held, 'no se envía la ejecución: no aparece «Ejecución registrada»', quiet.held ? 'no aparece «Ejecución registrada»' : `aparece «${quiet.seen}»`),
    check(rows === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${rows} ejecución(es)`),
    check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
    check(posts() === 0, 'no se envía ninguna petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
  ]);
};

// --- E4: el servidor rechaza un archivo que el navegador había aceptado ------------------------------------------------------------

const rechazaArchivo: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `el servidor rechaza el archivo con el aviso «${cell(row, 'aviso')}»`;
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const file = strict('archivo', ARCHIVO_E4, cell(row, 'archivo'))();
  const aviso = strict('aviso', AVISO_E4, cell(row, 'aviso'));
  const posts = watchRunPosts(page);
  const picked = await inOrder(
    () => interact(resultRadio(page, 'Bloqueado'), 'elegir «Bloqueado»', (element) => element.check(ACTION)),
    () => interact(notesBox(page), 'escribir en «Notas»', (element) => element.fill('Prueba con evidencia no válida', ACTION)),
    () => chooseFiles(evidenceSimpleInput(page), 'añadir el archivo con «Adjuntar un archivo»', [file]),
  );
  if (picked !== undefined) return actionFailed(expected, picked);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);
  await waitUntil(() => isVisible(serverErrorBox(page)));
  const text = await textOfVisible(serverErrorBox(page));
  const motive = motiveOf(text);
  const quiet = await noOkToast(page);
  const rows = await runRowCount(page);
  const count = await apiRunCount();
  const panel = await readFilesPanel(page);
  const radio = await safe(() => resultRadio(page, 'Bloqueado').isChecked({ timeout: READ_MS }), undefined);
  const notes = await safe(() => notesBox(page).inputValue({ timeout: READ_MS }), undefined);
  const kept = panel?.items.some((item) => item.lines.includes(file.name)) === true;
  return verdict([
    check(motive === aviso, `aviso de error «${aviso}»`, `aviso de error «${motive ?? '(no visible)'}»`),
    check(quiet.held, 'no aparece el aviso «Ejecución registrada»', quiet.held ? 'no aparece el aviso «Ejecución registrada»' : `aparece «${quiet.seen}»`),
    check(rows === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${rows} ejecución(es)`),
    check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
    check(posts() === 1, 'el formulario sí envía la petición (la rechaza el servidor)', `peticiones de ejecución enviadas: ${posts()}`),
    check(radio === true, 'el formulario conserva el resultado «Bloqueado»', `resultado «Bloqueado» ${radio === undefined ? '(sin leer)' : radio ? 'marcado' : 'sin marcar'}`),
    check(notes === 'Prueba con evidencia no válida', 'el formulario conserva las notas', `notas «${notes ?? '(sin leer)'}»`),
    check(kept, `el formulario conserva ${file.name} en «Archivos seleccionados»`, kept ? `${file.name} sigue en «Archivos seleccionados»` : `«Archivos seleccionados» sin ${file.name}`),
  ], text === undefined ? undefined : `el aviso de error muestra «${text}»; la historia deja pendiente si lleva el código HTTP, y solo se compara el motivo`);
};

// --- E5: sin el permiso el formulario se ve, pero no se puede enviar -------------------------------------------------------------

const sinPermiso: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `ve «${MOTIVO_PERMISO}» y el formulario no se puede usar`;
  const account = strict('cuenta', CUENTA_E5, cell(row, 'cuenta'));
  const prepared = await prepareCase(page, account);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const seen = await textOfVisible(deniedNote(page));
  const radios = ['Superado', 'Fallido', 'Bloqueado'].map((label) => resultRadio(page, label));
  const radioStates = await Promise.all(radios.map((radio) => disabledOf(radio)));
  const notesState = await safe(() => notesBox(page).isDisabled({ timeout: READ_MS }), undefined);
  const inputs = [evidenceSimpleInput(page), runForm(page).getByLabel('Adjuntar varios archivos', { exact: true }), runForm(page).getByTestId(VERIFICACION_TESTIDS.RUN_DROPZONE_INPUT)];
  const inputStates = await Promise.all(inputs.map((input) => safe(() => input.isDisabled({ timeout: READ_MS }), undefined)));
  const submitState = await disabledOf(submitButton(page));
  const submitTitle = await attrOf(submitButton(page), 'title');
  const allLocked = (states: readonly (boolean | undefined)[]): boolean => states.every((state) => state === true);
  return verdict([
    check(seen === MOTIVO_PERMISO, `aviso «${MOTIVO_PERMISO}» visible`, `aviso «${seen ?? '(no visible)'}»`),
    check(allLocked(radioStates), 'las opciones de resultado están deshabilitadas', `opciones de resultado: ${radioStates.map((state) => (state === true ? 'deshabilitada' : state === false ? 'habilitada' : 'sin leer')).join(', ')}`),
    check(notesState === true, '«Notas» está deshabilitado', notesState === undefined ? '«Notas» sin leer' : notesState ? '«Notas» deshabilitado' : '«Notas» habilitado'),
    check(allLocked(inputStates), 'los controles para adjuntar evidencias están deshabilitados', `controles de evidencias: ${inputStates.map((state) => (state === true ? 'deshabilitado' : state === false ? 'habilitado' : 'sin leer')).join(', ')}`),
    check(submitState === true && submitTitle === MOTIVO_PERMISO, `«Registrar ejecución» deshabilitado, con el motivo «${MOTIVO_PERMISO}»`, `«Registrar ejecución» ${submitState === true ? 'deshabilitado' : submitState === false ? 'habilitado' : 'sin leer'}, con el motivo «${submitTitle ?? '(sin motivo)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(registra)],
    [2, onWeb(sinResultado)],
    [3, onWeb(notasLimite)],
    [4, onWeb(rechazaArchivo)],
    [5, onWeb(sinPermiso)],
  ]),
});
