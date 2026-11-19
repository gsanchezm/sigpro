import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { persistedState } from '../api/common';
import { actionFailed, interact, observe, pollPersisted, toastShown, verdictWeb, watchRequests } from '../web/common';
import { onMobile, openCard, prepareMobile, readDetail, sheetOf, waitDetail, waitSheetReady } from './common';

// US-NC-GESTION-012 — Comentarios y cierre de NC-003 desde la hoja de detalle en la app móvil (Expo web a 390 px; NO es nativo). Preparación de
// cada fila: reinicio de alumno01 con su administrador; la cuenta abre la app, llega a /nc y toca NC-003 (en «Acción correctiva», con 3
// comentarios). La app móvil no muestra aviso al comentar (decisión pendiente de la historia): no se comprueba como paso.

const COMMENT_TEXT = 'Revisión pendiente de la acción correctiva';
const EMPTY_COMMENT = 'Escribe un comentario';
const SHORT_CLOSE = 'El comentario de cierre debe tener al menos 20 caracteres';
const REQUIRED_CLOSE = 'El comentario de cierre es obligatorio';
const CLOSED = 'NC-003 cerrada';
const DENIED_CLOSE = 'Tu rol no permite cerrar no conformidades';
const DENIED_MOVE = 'Tu rol no permite mover no conformidades';
const TRANSITION_PATH = '/api/nc/NC-003/transition';
const COMMENT_PATH = '/api/nc/NC-003/comments';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
  ['consultor@sigpro.test', 'consultor@sigpro.test'],
]);

const AUTHOR_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Andrés Molina', 'Andrés Molina'],
]);

const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['(19 letras a)', 'a'.repeat(19)],
  ['(20 letras a)', 'a'.repeat(20)],
]);

const COUNTER_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['19 / 20', '19 / 20'],
  ['20 / 20', '20 / 20'],
  ['0 / 20', '0 / 20'],
]);

/** Resultado del cierre: un error bajo el campo (con su texto y si se envía algo), o el aviso y la hoja cerrada. */
const CLOSE_RESULT_CELLS: ReadonlyMap<string, { readonly kind: 'error'; readonly text: string } | { readonly kind: 'closed' }> = new Map<string, { readonly kind: 'error'; readonly text: string } | { readonly kind: 'closed' }>([
  ['ve el mensaje «El comentario de cierre debe tener al menos 20 caracteres» bajo el campo y no se envía nada', { kind: 'error', text: SHORT_CLOSE }],
  ['ve el aviso «NC-003 cerrada» y la hoja de detalle se cierra', { kind: 'closed' }],
  ['ve el mensaje «El comentario de cierre es obligatorio» bajo el campo y no se envía nada', { kind: 'error', text: REQUIRED_CLOSE }],
]);

/** Lo que la historia espera de los botones «Mover a…» según el rol. */
const ROLE_CELLS: ReadonlyMap<string, 'enabled-form' | 'consultant' | 'auditor'> = new Map<string, 'enabled-form' | 'consultant' | 'auditor'>([
  ['«Mover a «Cerrada»» está habilitado y al pulsarlo aparece el formulario de cierre', 'enabled-form'],
  ['«Mover a «Cerrada»» está deshabilitado con la explicación «Tu rol no permite cerrar no conformidades» visible', 'consultant'],
  ['todos los botones «Mover a…» están deshabilitados con la explicación «Tu rol no permite mover no conformidades» visible', 'auditor'],
]);

const sheet = (page: Page): Locator => sheetOf(page, 'NC-003');

/** Abre NC-003 con la cuenta de la fila; espera a que la hoja muestre el estado. */
const openSheet = async (page: Page, email: string, expected: string): Promise<Outcome | undefined> => {
  const failed = await prepareMobile(page, email, expected);
  if (failed !== undefined) return failed;
  const tapped = await openCard(page, 'NC-003');
  if (tapped !== undefined) return actionFailed(expected, tapped);
  const ready = await waitSheetReady(page, 'NC-003');
  return ready ? undefined : actionFailed(expected, { message: 'la hoja de NC-003 no se abre', note: 'la tarjeta no abre el detalle en el plazo' });
};

const commentField = (page: Page): Locator => sheet(page).getByRole('textbox', { name: 'Añadir comentario', exact: true });
const commentButton = (page: Page): Locator => sheet(page).getByRole('button', { name: 'Comentar', exact: true });
const closeToggle = (page: Page): Locator => sheet(page).getByRole('button', { name: 'Mover a «Cerrada»', exact: true });
const closeArea = (page: Page): Locator => sheet(page).getByRole('textbox', { name: 'Comentario de cierre', exact: true });
const closeSubmit = (page: Page): Locator => sheet(page).getByRole('button', { name: 'Cerrar no conformidad', exact: true });

// --- Esquema 1: un comentario válido se añade al final de la lista ------------------------------------------------------------

const addsComment: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const author = strict('autor', AUTHOR_CELLS, cell(row, 'autor'));
  const expected = `${account} escribe «${COMMENT_TEXT}» en «Añadir comentario» y pulsa «Comentar» → el comentario aparece al final firmado por ${cell(row, 'autor')} y la sección muestra «Comentarios (4)»`;
  const log = watchRequests(page);
  const opened = await openSheet(page, account, expected);
  if (opened !== undefined) return opened;
  const typed = await interact(commentField(page), 'escribir en «Añadir comentario»', (element) => element.fill(COMMENT_TEXT, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const sent = await interact(commentButton(page), 'pulsar «Comentar»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);

  const shown = await waitDetail(page, 'NC-003', (current) => current.commentsHeading === 'Comentarios (4)');
  const last = shown?.comments[shown.comments.length - 1];
  const persisted = await pollPersisted('NC-003', (fields) => fields.commentCount === 4);
  return verdictWeb([
    check(shown?.commentsHeading === 'Comentarios (4)', '«Comentarios (4)»', `encabezado «${shown?.commentsHeading ?? '(sin leer)'}»`),
    check(last?.author === author && last?.body === COMMENT_TEXT, `comentario nuevo al final firmado por ${cell(row, 'autor')}`, `último comentario: ${last?.author ?? '(sin leer)'} / «${last?.body ?? '(sin leer)'}»`),
    check(shown?.commentValue === '', 'el campo «Añadir comentario» queda vacío', `campo con «${shown?.commentValue ?? '(sin leer)'}»`),
    check(persisted?.commentCount === 4, 'NC-003 con 4 comentarios en el servidor', `NC-003 con ${persisted?.commentCount ?? '(sin leer)'} comentarios en el servidor`),
    check(log.count('POST', COMMENT_PATH) === 1, 'una sola petición de comentario', `peticiones POST ${COMMENT_PATH}: ${log.count('POST', COMMENT_PATH)}`),
  ]);
};

// --- Esquema 2: un comentario vacío no se envía --------------------------------------------------------------------------------

const emptyNotSent: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const expected = `gestor@sigpro.test escribe ${cell(row, 'texto')} en «Añadir comentario» y pulsa «Comentar» → «${EMPTY_COMMENT}» bajo el campo y la sección sigue en «Comentarios (3)»`;
  const log = watchRequests(page);
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  if (text !== '') {
    const typed = await interact(commentField(page), 'escribir en «Añadir comentario»', (element) => element.fill(text, ACTION));
    if (typed !== undefined) return actionFailed(expected, typed);
  }
  const sent = await interact(commentButton(page), 'pulsar «Comentar»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);

  const shown = await waitUntil(async () => (await readDetail(page, 'NC-003'))?.commentError === EMPTY_COMMENT);
  const view = await readDetail(page, 'NC-003');
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${EMPTY_COMMENT}» bajo el campo`, `bajo el campo: «${view?.commentError ?? '(sin error visible)'}»`),
    check(view?.commentsHeading === 'Comentarios (3)', '«Comentarios (3)»', `encabezado «${view?.commentsHeading ?? '(sin leer)'}»`),
    check(log.count('POST', COMMENT_PATH) === 0, 'ninguna petición de comentario', `peticiones POST ${COMMENT_PATH}: ${log.count('POST', COMMENT_PATH)}`),
  ]);
};

// --- Esquema 3: el cierre exige al menos 20 caracteres y muestra el contador ----------------------------------------------------

const closeCounter: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const counter = strict('contador', COUNTER_CELLS, cell(row, 'contador'));
  const result = strict('resultado', CLOSE_RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test pulsa «Mover a «Cerrada»», escribe ${cell(row, 'texto')} en «Comentario de cierre», ve el contador ${counter} y pulsa «Cerrar no conformidad» → ${cell(row, 'resultado')}`;
  const transitions = watchRequests(page);
  const opened = await openSheet(page, 'gestor@sigpro.test', expected);
  if (opened !== undefined) return opened;
  const toggled = await interact(closeToggle(page), 'pulsar «Mover a «Cerrada»»', (element) => element.click(ACTION));
  if (toggled !== undefined) return actionFailed(expected, toggled);
  const area = await waitUntil(async () => (await closeArea(page).count()) > 0);
  if (!area.reached) return actionFailed(expected, { message: 'no aparece el formulario de cierre', note: 'el botón no abre el comentario de cierre' });
  const typed = await interact(closeArea(page), 'escribir en «Comentario de cierre»', (element) => element.fill(text, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const counted = await waitUntil(async () => (await readDetail(page, 'NC-003'))?.closeCounter === counter);
  const shownCounter = (await readDetail(page, 'NC-003'))?.closeCounter;
  const submitted = await interact(closeSubmit(page), 'pulsar «Cerrar no conformidad»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  if (result.kind === 'closed') {
    const toast = await toastShown(page, 'ok', CLOSED);
    const gone = await waitUntil(async () => (await sheet(page).count()) === 0);
    const state = await persistedState('NC-003');
    return verdictWeb([
      check(counted.reached && shownCounter === counter, `contador «${counter}»`, `contador «${shownCounter ?? '(sin leer)'}»`),
      check(toast.readable && toast.seen, `aviso «${CLOSED}»`, toast.observed),
      check(gone.reached, 'la hoja de detalle se cierra', gone.reached ? 'la hoja de detalle se cerró' : 'la hoja de detalle sigue abierta'),
      check(state === 'closed', 'NC-003 cerrada en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
    ]);
  }
  const shown = await waitUntil(async () => (await readDetail(page, 'NC-003'))?.closeError === result.text);
  const view = await readDetail(page, 'NC-003');
  await observe(2_000);
  const state = await persistedState('NC-003');
  return verdictWeb([
    check(counted.reached && shownCounter === counter, `contador «${counter}»`, `contador «${shownCounter ?? '(sin leer)'}»`),
    check(shown.reached, `«${result.text}» bajo el campo`, `bajo el campo: «${view?.closeError ?? '(sin error visible)'}»`),
    check(view?.open === true, 'la hoja de detalle sigue abierta', view?.open === true ? 'la hoja de detalle sigue abierta' : 'la hoja de detalle se cerró'),
    check(transitions.count('POST', TRANSITION_PATH) === 0, 'ninguna petición de cierre', `peticiones POST ${TRANSITION_PATH}: ${transitions.count('POST', TRANSITION_PATH)}`),
    check(state === 'corrective_action', 'NC-003 sigue en «Acción correctiva» en el servidor', `NC-003 en el servidor: ${state ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 4: cada rol ve el cierre según su permiso -------------------------------------------------------------------------

const roleSeesClose: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const expect = strict('resultado', ROLE_CELLS, cell(row, 'resultado'));
  const expected = `${account} abre NC-003 y mira los botones «Mover a…» → ${cell(row, 'resultado')}`;
  const opened = await openSheet(page, account, expected);
  if (opened !== undefined) return opened;
  const view = await waitDetail(page, 'NC-003', (current) => current.transitions.length > 0);
  const toggle = view?.transitions.find((button) => button.label === 'Mover a «Cerrada»');
  if (expect === 'enabled-form') {
    const tapped = await interact(closeToggle(page), 'pulsar «Mover a «Cerrada»»', (element) => element.click(ACTION));
    if (tapped !== undefined) return actionFailed(expected, tapped);
    const form = await waitUntil(async () => (await closeArea(page).count()) > 0);
    return verdictWeb([
      check(toggle !== undefined && toggle.disabled === false, '«Mover a «Cerrada»» habilitado', `«Mover a «Cerrada»» ${toggle === undefined ? '(no está)' : toggle.disabled ? 'deshabilitado' : 'habilitado'}`),
      check(form.reached, 'aparece el formulario de cierre', form.reached ? 'aparece el formulario de cierre' : 'no aparece el formulario de cierre'),
    ]);
  }
  if (expect === 'consultant') {
    return verdictWeb([
      check(toggle !== undefined && toggle.disabled === true, '«Mover a «Cerrada»» deshabilitado', `«Mover a «Cerrada»» ${toggle === undefined ? '(no está)' : toggle.disabled ? 'deshabilitado' : 'habilitado'}`),
      check(view?.reasonVisible === DENIED_CLOSE, `«${DENIED_CLOSE}» visible bajo los botones`, `motivo visible: «${view?.reasonVisible ?? '(no visible)'}»`),
    ]);
  }
  const all = view?.transitions ?? [];
  return verdictWeb([
    check(all.length > 0 && all.every((button) => button.disabled), 'todos los botones «Mover a…» deshabilitados', `botones: ${all.map((button) => `${button.label ?? '?'} ${button.disabled ? 'deshabilitado' : 'habilitado'}`).join('; ') || '(ninguno)'}`),
    check(view?.reasonVisible === DENIED_MOVE, `«${DENIED_MOVE}» visible`, `motivo visible: «${view?.reasonVisible ?? '(no visible)'}»`),
  ]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-012',
  surface: 'expo-web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onMobile(addsComment)],
    [2, onMobile(emptyNotSent)],
    [3, onMobile(closeCounter)],
    [4, onMobile(roleSeesClose)],
  ]),
});
