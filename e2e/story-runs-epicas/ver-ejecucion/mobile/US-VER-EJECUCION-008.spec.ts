import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { ACCOUNT_OF, caseOf, loginAs, runCountOf, runIdsOf, runsById } from '../api/common';
import { upload } from '../api/files';
import { armToasts, inOrder, interact, noOkToast, toastShown, watchRunPosts } from '../web/common';
import {
  actionFailedMobile,
  checkedOf,
  deniedNote,
  firstCardId,
  lockedCheck,
  lockedOf,
  mobileVerdict,
  notesErrorText,
  notesField,
  onExpoWeb,
  openCaseMobile,
  pickManyButton,
  pickOneButton,
  pickPdfButton,
  pickWith,
  readMobileFiles,
  reasonOf,
  resultErrorText,
  resultRadio,
  runCard,
  runCardCount,
  serverErrorBox,
  settledCard,
  signIn,
  submitButton,
  visibleTextOf,
  type MobileAccount,
} from './common';

// US-VER-EJECUCION-008 — Registro de una ejecución desde el detalle del caso, en la app móvil (Expo web, 390 × 844; NO es nativo).
// Preparación de cada fila: reinicio de alumno01; la app en /login con alumno01 en «Tenant de trabajo», la cuenta de la fila y el caso
// abierto. La persistencia se comprueba por la API después de la interfaz. Las lecturas son de texto visible y de atributos.

interface Resultado {
  readonly label: string;
  readonly api: string;
}

const RESULTADO: ReadonlyMap<string, Resultado> = new Map<string, Resultado>([
  ['«Superado»', { label: 'Superado', api: 'pass' }], // strict: 008/E1/resultado
  ['«Fallido»', { label: 'Fallido', api: 'fail' }],
  ['«Bloqueado»', { label: 'Bloqueado', api: 'blocked' }],
]);

const AVISO: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-001: Superado · RUN-051', 'TC-001: Superado · RUN-051'], // strict: 008/E1/aviso
  ['TC-001: Fallido · RUN-051', 'TC-001: Fallido · RUN-051'],
  ['TC-001: Bloqueado · RUN-051', 'TC-001: Bloqueado · RUN-051'],
]);

const NOTAS_E2: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(vacío)', undefined], // strict: 008/E2/notas
  ['Prueba sin resultado', 'Prueba sin resultado'],
]);

const CARACTERES: ReadonlyMap<string, number> = new Map<string, number>([
  ['999', 999], // strict: 008/E3/caracteres
  ['1000', 1000],
  ['1001', 1001],
]);

const RESPUESTA_E3: ReadonlyMap<string, 'guarda' | 'rechaza'> = new Map<string, 'guarda' | 'rechaza'>([
  ['ve el aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051»', 'guarda'], // strict: 008/E3/respuesta
  ['ve bajo el campo «Notas» el aviso «Las notas admiten hasta 1000 caracteres», y el historial sigue con 2 ejecuciones', 'rechaza'],
]);

const ARCHIVO_E4: ReadonlyMap<string, () => ReturnType<typeof upload>> = new Map<string, () => ReturnType<typeof upload>>([
  ['falso.png', () => upload('falso.png', 'image/png', 'texto', 1024)], // strict: 008/E4/archivo
]);

const AVISO_E4 = 'Solo se admiten archivos PNG, JPEG o PDF';

const CUENTA_E5: ReadonlyMap<string, MobileAccount> = new Map<string, MobileAccount>([
  ['gestor@sigpro.test', 'gestor'], // strict: 008/E5/cuenta
  ['auditor@sigpro.test', 'auditor'],
]);

const MOTIVO_PERMISO = 'Tu rol no permite registrar ejecuciones';

/** Número de ejecuciones del caso según la API (con la cuenta de alumno01). */
const apiRunCount = async (): Promise<number | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  return session.token === undefined ? undefined : runCountOf(await caseOf(session.token));
};

/** Aviso de éxito con su texto exacto (el título es «Ejecución registrada»). */
const toastOk = (page: Page, body: string) => toastShown(page, 'ok', 'Ejecución registrada', body);

/** Prepara la fila: la app móvil con la cuenta y el caso abierto (o el motivo si no llega). */
const prepare = async (page: Page, account: MobileAccount): Promise<string | undefined> => {
  const signed = await signIn(page, account);
  if (signed !== undefined) return signed;
  return openCaseMobile(page);
};

/** Escribe las notas de la fila (vacío = no se escribe nada). */
const typeNotes = (page: Page, notes: string | undefined) => (notes === undefined ? undefined : interact(notesField(page), 'escribir en «Notas»', (element) => element.fill(notes, ACTION)));

// --- E1: una ejecución con resultado y notas aparece en el historial -------------------------------------------------------------------

const registra: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `ejecución registrada «${cell(row, 'aviso')}», primera del historial, con el formulario vacío`;
  const prepared = await prepare(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const choice = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const picked = await inOrder(
    () => interact(resultRadio(page, choice.label), `elegir «${choice.label}»`, (element) => element.click(ACTION)),
    () => interact(notesField(page), 'escribir «Prueba de humo» en «Notas»', (element) => element.fill('Prueba de humo', ACTION)),
  );
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailedMobile(expected, sent);
  const toast = await toastOk(page, aviso);
  await waitUntil(async () => (await firstCardId(page)) === 'RUN-051');
  const first = await firstCardId(page);
  const card = await settledCard(runCard(page, 'RUN-051'));
  const radios = await Promise.all(['Superado', 'Fallido', 'Bloqueado'].map((label) => checkedOf(resultRadio(page, label))));
  const notes = await notesField(page).inputValue({ timeout: 2_000 }).catch(() => undefined);
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  const after = session.token === undefined ? undefined : await caseOf(session.token);
  const saved = after === undefined ? undefined : runsById(after).get('RUN-051');
  const checks: Check[] = [
    check(toast.seen, `aviso «Ejecución registrada» con el texto «${aviso}»`, toast.observed),
    check(first === 'RUN-051', 'el historial muestra RUN-051 como primera tarjeta', `primera tarjeta ${first ?? '(ninguna)'}`),
    check(card?.lines.includes(choice.label) === true, `RUN-051 con el resultado «${choice.label}»`, `RUN-051 muestra ${card?.lines.find((line) => ['Superado', 'Fallido', 'Bloqueado'].includes(line)) ?? '(ningún resultado)'}`),
    check(radios.every((value) => value === false), 'el formulario queda sin resultado', `opciones marcadas: ${radios.map((value) => (value === true ? 'sí' : value === false ? 'no' : 'sin leer')).join(', ')}`),
    check(notes === '', '«Notas» vacío', `«Notas» con «${notes ?? '(sin leer)'}»`),
    check(after !== undefined && runIdsOf(after)[0] === 'RUN-051' && saved?.result === choice.api, `la API guarda RUN-051 con ${choice.api} como primera`, `la API: primera ${after === undefined ? '(sin leer)' : (runIdsOf(after)[0] ?? '(ninguna)')}, RUN-051 ${saved === undefined ? '(no está)' : String(saved.result)}`),
  ];
  const note = choice.label === 'Bloqueado' ? 'La fila no distingue por la cabecera: el último resultado del seed ya es «Bloqueado»; se confirma por la tarjeta y por la API.' : undefined;
  return mobileVerdict(checks, { note });
};

// --- E2: sin resultado elegido no se envía la ejecución ------------------------------------------------------------------------------

const sinResultado: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'sin resultado no se envía y bajo las opciones aparece «Selecciona un resultado»';
  const prepared = await prepare(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const posts = watchRunPosts(page);
  const typed = await typeNotes(page, strict('notas', NOTAS_E2, cell(row, 'notas')));
  if (typed !== undefined) return actionFailedMobile(expected, typed);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailedMobile(expected, sent);
  await waitUntil(async () => (await visibleTextOf(resultErrorText(page))) !== undefined);
  const message = await visibleTextOf(resultErrorText(page));
  const quiet = await noOkToast(page);
  const cards = await runCardCount(page);
  const count = await apiRunCount();
  return mobileVerdict([
    check(message === 'Selecciona un resultado', 'bajo las opciones aparece «Selecciona un resultado»', `bajo las opciones aparece «${message ?? '(no visible)'}»`),
    check(quiet.held, 'no aparece el aviso «Ejecución registrada»', quiet.held ? 'no aparece el aviso «Ejecución registrada»' : `aparece «${quiet.seen}»`),
    check(cards === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${cards} ejecución(es)`),
    check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
    check(posts() === 0, 'no se envía ninguna petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
  ]);
};

// --- E3: las notas admiten hasta 1000 caracteres -------------------------------------------------------------------------------------

const notasLimite: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = 'las notas de la fila se aceptan o se rechazan según su longitud';
  const prepared = await prepare(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const size = strict('caracteres', CARACTERES, cell(row, 'caracteres'));
  const want = strict('respuesta', RESPUESTA_E3, cell(row, 'respuesta'));
  const posts = watchRunPosts(page);
  const picked = await inOrder(
    () => interact(resultRadio(page, 'Fallido'), 'elegir «Fallido»', (element) => element.click(ACTION)),
    () => interact(notesField(page), `escribir ${size} caracteres en «Notas»`, (element) => element.fill('a'.repeat(size), ACTION)),
  );
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailedMobile(expected, sent);
  if (want === 'guarda') {
    const toast = await toastOk(page, 'TC-001: Fallido · RUN-051');
    await waitUntil(async () => (await firstCardId(page)) === 'RUN-051');
    const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
    const after = session.token === undefined ? undefined : await caseOf(session.token);
    const saved = after === undefined ? undefined : runsById(after).get('RUN-051');
    return mobileVerdict([
      check(toast.seen, 'aviso «Ejecución registrada» con el texto «TC-001: Fallido · RUN-051»', toast.observed),
      check(saved?.result === 'fail' && typeof saved.notes === 'string' && saved.notes.length === size, `la API guarda RUN-051 con «fail» y ${size} caracteres de notas`, saved === undefined ? 'la API no tiene RUN-051' : `la API guarda RUN-051 con «${String(saved.result)}» y ${typeof saved.notes === 'string' ? saved.notes.length : '(sin notas)'} caracteres`),
      check(posts() === 1, 'se envía una sola petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
    ]);
  }
  await waitUntil(async () => (await visibleTextOf(notesErrorText(page))) !== undefined);
  await sleep(1_000);
  const notice = await visibleTextOf(notesErrorText(page));
  const quiet = await noOkToast(page);
  const cards = await runCardCount(page);
  const count = await apiRunCount();
  return mobileVerdict([
    check(notice === 'Las notas admiten hasta 1000 caracteres', 'bajo «Notas» aparece «Las notas admiten hasta 1000 caracteres»', notice === undefined ? 'bajo «Notas» no aparece ningún aviso' : `bajo «Notas» aparece «${notice}»`),
    check(quiet.held, 'no aparece el aviso «Ejecución registrada»', quiet.held ? 'no aparece el aviso «Ejecución registrada»' : `aparece «${quiet.seen}»`),
    check(cards === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${cards} ejecución(es)`),
    check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
    check(posts() === 0, 'no se envía ninguna petición de ejecución', `peticiones de ejecución enviadas: ${posts()}`),
  ]);
};

// --- E4: el servidor rechaza un archivo que la app había aceptado ---------------------------------------------------------------------

const rechazaArchivo: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `el servidor rechaza el archivo con el aviso «${AVISO_E4}»`;
  const prepared = await prepare(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const file = strict('archivo', ARCHIVO_E4, cell(row, 'archivo'))();
  const picked = await inOrder(
    () => interact(resultRadio(page, 'Bloqueado'), 'elegir «Bloqueado»', (element) => element.click(ACTION)),
    () => interact(notesField(page), 'escribir en «Notas»', (element) => element.fill('Prueba con evidencia no válida', ACTION)),
    () => pickWith(page, pickOneButton(page), 'pulsar «Adjuntar un archivo»', [file]),
  );
  if (picked !== undefined) return actionFailedMobile(expected, picked);
  await waitUntil(async () => ((await readMobileFiles(page))?.items.length ?? 0) === 1);
  const posts = watchRunPosts(page);
  await armToasts(page);
  const sent = await interact(submitButton(page), 'pulsar «Registrar ejecución»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailedMobile(expected, sent);
  await waitUntil(async () => (await visibleTextOf(serverErrorBox(page))) !== undefined);
  const text = await visibleTextOf(serverErrorBox(page));
  const motive = text === undefined ? undefined : (text.split(' · ').at(-1) ?? '').trim();
  const quiet = await noOkToast(page);
  const cards = await runCardCount(page);
  const count = await apiRunCount();
  const panel = await readMobileFiles(page);
  const radio = await checkedOf(resultRadio(page, 'Bloqueado'));
  const notes = await notesField(page).inputValue({ timeout: 2_000 }).catch(() => undefined);
  const kept = panel?.items.some((item) => item.lines.includes(file.name)) === true;
  return mobileVerdict(
    [
      check(motive === AVISO_E4, `aviso de error «${AVISO_E4}»`, `aviso de error «${motive ?? '(no visible)'}»`),
      check(quiet.held, 'no aparece el aviso «Ejecución registrada»', quiet.held ? 'no aparece el aviso «Ejecución registrada»' : `aparece «${quiet.seen}»`),
      check(cards === 2, 'el historial sigue con 2 ejecuciones', `el historial muestra ${cards} ejecución(es)`),
      check(count === 2, 'la API sigue con 2 ejecuciones del caso', `la API responde ${String(count)} ejecuciones`),
      check(posts() === 1, 'la app sí envía la petición (la rechaza el servidor)', `peticiones de ejecución enviadas: ${posts()}`),
      check(radio === true, 'el formulario conserva el resultado «Bloqueado»', `resultado «Bloqueado» ${radio === undefined ? '(sin leer)' : radio ? 'marcado' : 'sin marcar'}`),
      check(notes === 'Prueba con evidencia no válida', 'el formulario conserva las notas', `notas «${notes ?? '(sin leer)'}»`),
      check(kept, `el formulario conserva ${file.name} en «Archivos seleccionados»`, kept ? `${file.name} sigue en «Archivos seleccionados»` : `«Archivos seleccionados» sin ${file.name}`),
    ],
    { evidence: { avisoCompleto: text ?? null } },
  );
};

// --- E5: sin el permiso el formulario se ve, pero no se puede usar --------------------------------------------------------------------

const sinPermiso: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `ve «${MOTIVO_PERMISO}» y el formulario no se puede usar`;
  const account = strict('cuenta', CUENTA_E5, cell(row, 'cuenta'));
  const prepared = await prepare(page, account);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const seen = await visibleTextOf(deniedNote(page));
  const radios = await Promise.all(['Superado', 'Fallido', 'Bloqueado'].map((label) => lockedOf(resultRadio(page, label))));
  const notes = await lockedOf(notesField(page));
  const attach = await Promise.all([pickOneButton(page), pickManyButton(page), pickPdfButton(page)].map((button) => lockedOf(button)));
  const submit = await lockedOf(submitButton(page));
  const reason = await reasonOf(submitButton(page));
  const everyLocked = (values: readonly (boolean | undefined)[]): boolean => values.every((value) => value === true);
  return mobileVerdict(
    [
      check(seen === MOTIVO_PERMISO, `aviso «${MOTIVO_PERMISO}» visible`, `aviso «${seen ?? '(no visible)'}»`),
      check(everyLocked(radios), 'las opciones de resultado no se pueden usar', `opciones de resultado: ${radios.map((value) => (value === true ? 'bloqueada' : value === false ? 'usable' : 'sin leer')).join(', ')}`),
      lockedCheck('«Notas»', notes),
      check(everyLocked(attach), 'los controles para adjuntar evidencias no se pueden usar', `controles: ${attach.map((value) => (value === true ? 'bloqueado' : value === false ? 'usable' : 'sin leer')).join(', ')}`),
      lockedCheck('«Registrar ejecución»', submit),
    ],
    { evidence: { motivoDelBotonDataReason: reason ?? null } },
  );
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-008',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(registra)],
    [2, onExpoWeb(sinResultado)],
    [3, onExpoWeb(notasLimite)],
    [4, onExpoWeb(rechazaArchivo)],
    [5, onExpoWeb(sinPermiso)],
  ]),
});
