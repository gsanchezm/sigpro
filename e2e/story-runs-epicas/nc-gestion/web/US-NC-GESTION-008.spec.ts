import type { Locator, Page } from '@playwright/test';
import { adminCredentials, field } from '../../../story-runs/support/api';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { ACTION, waitUntil } from '../../support/browser';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { actorOf, detailNc } from '../api/common';
import { actionFailed, interact, observe, onWeb, prepareWeb, readDetail, toastShown, verdictWeb, waitDetail, watchRequests, quotedText, detailDialog, type CommentView, type DetailView } from './common';
import type { Outcome } from '../../core/framework';

// US-NC-GESTION-008 — Hilo de comentarios de NC-003 en la web (detalle en /nc/NC-003). Preparación de cada fila: reinicio de alumno01 con el
// token de su administrador; la cuenta de la fila inicia sesión en /login?tenant=alumno01 y abre el detalle. NC-003 del seed tiene 3
// comentarios (el segundo de «Pablo Serrano», rápido). El conteo y la persistencia se comprueban en el servidor después del aviso.

const COMMENT_TEXT = 'Revisión pendiente de la acción correctiva';
const ADDED = 'Comentario añadido';
const EMPTY_ERROR = 'Escribe un comentario';
const LONG_ERROR = 'El comentario es demasiado largo (máx. 1000 caracteres)';
const COMMENT_PATH = '/api/nc/NC-003/comments';

const ACCOUNT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['gestor@sigpro.test', 'gestor@sigpro.test'],
  ['auditor@sigpro.test', 'auditor@sigpro.test'],
]);

const AUTHOR_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Javier Ortega', 'Javier Ortega'],
  ['Andrés Molina', 'Andrés Molina'],
  ['Pablo Serrano', 'Pablo Serrano'],
]);

const TEXT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
  ['(1000 letras a)', 'a'.repeat(1000)],
  ['(1001 letras a)', 'a'.repeat(1001)],
]);

const RESULT_CELLS: ReadonlyMap<string, 'added-1000' | 'too-long-1001'> = new Map<string, 'added-1000' | 'too-long-1001'>([
  ['ve el aviso «Comentario añadido» y la sección muestra «Comentarios (4)»', 'added-1000'],
  ['ve el mensaje «El comentario es demasiado largo (máx. 1000 caracteres)» bajo el campo, la sección sigue mostrando «Comentarios (3)» y no se envía ninguna petición', 'too-long-1001'],
]);

const LABEL_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Rápido»', 'Rápido'],
  ['«Cierre»', 'Cierre'],
]);

const CODE_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['NC-003', 'NC-003'],
  ['NC-004', 'NC-004'],
]);

/** Comentarios de la no conformidad en el servidor (la cuenta administradora lee): autor, tipo y texto. `undefined` si no se lee. */
const persistedComments = async (code: string): Promise<readonly { readonly authorName: string | undefined; readonly kind: string | undefined; readonly body: string | undefined }[] | undefined> => {
  const admin = await actorOf(adminCredentials(TENANT_A));
  if (admin.token === undefined) return undefined;
  const detail = await detailNc(admin.token, code);
  const list = field(detail.body, 'comments');
  if (!Array.isArray(list)) return undefined;
  return list.map((item: unknown) => ({
    authorName: typeof field(item, 'authorName') === 'string' ? (field(item, 'authorName') as string) : undefined,
    kind: typeof field(item, 'kind') === 'string' ? (field(item, 'kind') as string) : undefined,
    body: typeof field(item, 'body') === 'string' ? (field(item, 'body') as string) : undefined,
  }));
};

/** Abre el detalle de NC-003 (o de otra) con la cuenta y espera a que muestre sus comentarios. */
const openWithComments = async (page: Page, email: string, path: string, expected: string): Promise<{ readonly failed?: Outcome; readonly view?: DetailView }> => {
  const failed = await prepareWeb(page, email, expected, path);
  if (failed !== undefined) return { failed };
  const view = await waitDetail(page, (current) => current.open && current.commentsHeading !== undefined && current.stateText !== undefined);
  return view === undefined ? { failed: preparationFailedWeb(expected, `no se abrió el detalle de ${path}`) } : { view };
};

const commentField = (page: Page): Locator => detailDialog(page, 'NC-003').getByRole('textbox', { name: 'Añadir comentario', exact: true });
const commentButton = (page: Page): Locator => detailDialog(page, 'NC-003').getByRole('button', { name: 'Comentar', exact: true });

/** Lectura de la última línea del hilo (autor) desde la vista. */
const lastCommentOf = (view: DetailView | undefined): CommentView | undefined => (view === undefined || view.comments.length === 0 ? undefined : view.comments[view.comments.length - 1]);

// --- Esquema 1: un comentario válido se añade al final del hilo ---------------------------------------------------------------

const addsComment: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const account = strict('correo', ACCOUNT_CELLS, cell(row, 'correo'));
  const author = strict('autor', AUTHOR_CELLS, cell(row, 'autor'));
  const expected = `${account} escribe «${COMMENT_TEXT}» en «Añadir comentario» y pulsa «Comentar» → aviso «${ADDED}», «Comentarios (4)» y el comentario al final firmado por ${cell(row, 'autor')}`;
  const opened = await openWithComments(page, account, '/nc/NC-003', expected);
  if (opened.failed !== undefined) return opened.failed;

  const typed = await interact(commentField(page), 'escribir en «Añadir comentario»', (element) => element.fill(COMMENT_TEXT, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const sent = await interact(commentButton(page), 'pulsar «Comentar»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);

  const toast = await toastShown(page, 'ok', ADDED);
  const heading = await waitUntil(async () => (await readDetail(page))?.commentsHeading === 'Comentarios (4)');
  const view = await readDetail(page);
  const last = lastCommentOf(view);
  const persisted = await persistedComments('NC-003');
  const persistedLast = persisted === undefined || persisted.length === 0 ? undefined : persisted[persisted.length - 1];
  return verdictWeb([
    check(toast.readable && toast.seen, `aviso «${ADDED}»`, toast.observed),
    check(heading.reached, '«Comentarios (4)»', `encabezado «${view?.commentsHeading ?? '(sin leer)'}»`),
    check(last?.author === author && last?.body === COMMENT_TEXT, `comentario nuevo al final, firmado por ${cell(row, 'autor')}`, `último comentario: ${last?.author ?? '(sin leer)'} / «${last?.body ?? '(sin leer)'}»`),
    check(view?.commentValue === '', 'el campo «Añadir comentario» queda vacío', `campo con «${view?.commentValue ?? '(sin leer)'}»`),
    check(persisted?.length === 4 && persistedLast?.authorName === author, 'en el servidor: 4 comentarios y el último de la persona', `en el servidor: ${persisted?.length ?? '(sin leer)'} comentarios, último de ${persistedLast?.authorName ?? '(sin leer)'}`),
  ], 'Regla sin fila: «Todavía no hay comentarios» (hilo vacío) no se ejerce: NC-003 y NC-004 tienen comentarios en el seed.');
};

// --- Esquema 2: un comentario vacío no se envía --------------------------------------------------------------------------------

const emptyNotSent: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const expected = `gestor@sigpro.test escribe ${cell(row, 'texto')} en «Añadir comentario» y pulsa «Comentar» → «${EMPTY_ERROR}» bajo el campo, «Comentarios (3)» y ninguna petición de comentario`;
  const log = watchRequests(page);
  const opened = await openWithComments(page, 'gestor@sigpro.test', '/nc/NC-003', expected);
  if (opened.failed !== undefined) return opened.failed;

  if (text !== '') {
    const typed = await interact(commentField(page), 'escribir en «Añadir comentario»', (element) => element.fill(text, ACTION));
    if (typed !== undefined) return actionFailed(expected, typed);
  }
  const sent = await interact(commentButton(page), 'pulsar «Comentar»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);

  const shown = await waitUntil(async () => (await readDetail(page))?.commentError === EMPTY_ERROR);
  const view = await readDetail(page);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${EMPTY_ERROR}» bajo el campo`, `bajo el campo: «${view?.commentError ?? '(sin error visible)'}»`),
    check(view?.commentsHeading === 'Comentarios (3)', '«Comentarios (3)»', `encabezado «${view?.commentsHeading ?? '(sin leer)'}»`),
    check(log.count('POST', COMMENT_PATH) === 0, 'ninguna petición de comentario', `peticiones POST ${COMMENT_PATH}: ${log.count('POST', COMMENT_PATH)}`),
    check(log.count('GET', '/api/nc/NC-003') > 0, 'control: el registro de peticiones ve la carga del detalle', `peticiones GET /api/nc/NC-003 vistas: ${log.count('GET', '/api/nc/NC-003')}`),
  ]);
};

// --- Esquema 3: el texto se acepta hasta 1000 caracteres -----------------------------------------------------------------------

const lengthLimit: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const text = strict('texto', TEXT_CELLS, cell(row, 'texto'));
  const result = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const expected = `gestor@sigpro.test escribe ${cell(row, 'texto')} en «Añadir comentario» y pulsa «Comentar» → ${result === 'added-1000' ? `aviso «${ADDED}» y «Comentarios (4)»` : `«${LONG_ERROR}» bajo el campo, «Comentarios (3)» y ninguna petición`}`;
  const log = watchRequests(page);
  const opened = await openWithComments(page, 'gestor@sigpro.test', '/nc/NC-003', expected);
  if (opened.failed !== undefined) return opened.failed;

  const typed = await interact(commentField(page), 'escribir en «Añadir comentario»', (element) => element.fill(text, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const sent = await interact(commentButton(page), 'pulsar «Comentar»', (element) => element.click(ACTION));
  if (sent !== undefined) return actionFailed(expected, sent);

  if (result === 'added-1000') {
    const toast = await toastShown(page, 'ok', ADDED);
    const heading = await waitUntil(async () => (await readDetail(page))?.commentsHeading === 'Comentarios (4)');
    return verdictWeb([
      check(toast.readable && toast.seen, `aviso «${ADDED}»`, toast.observed),
      check(heading.reached, '«Comentarios (4)»', `encabezado «${(await readDetail(page))?.commentsHeading ?? '(sin leer)'}»`),
    ]);
  }
  const shown = await waitUntil(async () => (await readDetail(page))?.commentError === LONG_ERROR);
  const view = await readDetail(page);
  await observe(2_000);
  return verdictWeb([
    check(shown.reached, `«${LONG_ERROR}» bajo el campo`, `bajo el campo: «${view?.commentError ?? '(sin error visible)'}»`),
    check(view?.commentsHeading === 'Comentarios (3)', '«Comentarios (3)»', `encabezado «${view?.commentsHeading ?? '(sin leer)'}»`),
    check(log.count('POST', COMMENT_PATH) === 0, 'ninguna petición de comentario', `peticiones POST ${COMMENT_PATH}: ${log.count('POST', COMMENT_PATH)}`),
    check(log.count('GET', '/api/nc/NC-003') > 0, 'control: el registro de peticiones ve la carga del detalle', `peticiones GET /api/nc/NC-003 vistas: ${log.count('GET', '/api/nc/NC-003')}`),
  ]);
};

// --- Esquema 4: cada comentario muestra la etiqueta de su tipo ----------------------------------------------------------------

const typeLabel: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const code = strict('codigo', CODE_CELLS, cell(row, 'codigo'));
  const author = strict('autor', AUTHOR_CELLS, cell(row, 'autor'));
  const label = quotedText(cell(row, 'etiqueta'));
  strict('etiqueta', LABEL_CELLS, cell(row, 'etiqueta'));
  const expected = `gestor@sigpro.test abre /nc/${code} → el comentario de ${cell(row, 'autor')} lleva la etiqueta «${label}»`;
  const opened = await openWithComments(page, 'gestor@sigpro.test', `/nc/${code}`, expected);
  if (opened.failed !== undefined) return opened.failed;
  const view = await readDetail(page);
  const found = view?.comments.find((comment) => comment.author === author);
  // Las etiquetas de TODOS los comentarios de la NC (la historia: NC-003 tiene 3 comentarios y solo el de Pablo Serrano es «Rápido»;
  // NC-004 tiene un único comentario de cierre de Javier Ortega, «Cierre»)
  const storyCount = code === 'NC-003' ? 3 : 1;
  const storyAuthor = code === 'NC-003' ? 'Pablo Serrano' : 'Javier Ortega';
  const storyLabel = code === 'NC-003' ? 'Rápido' : 'Cierre';
  const labelledNow = (view?.comments ?? []).filter((comment) => comment.kindLabel !== undefined);
  return verdictWeb([
    check(found !== undefined, `comentario de ${cell(row, 'autor')} en ${code}`, found === undefined ? `sin comentario de ${cell(row, 'autor')}` : 'comentario encontrado'),
    check(found?.kindLabel === label, `etiqueta «${label}» en el comentario de ${cell(row, 'autor')}`, `etiqueta «${found?.kindLabel ?? '(sin etiqueta)'}»`),
    check(view?.comments.length === storyCount, `${code} tiene ${storyCount} comentario(s) tras el reinicio`, `comentarios en ${code}: ${view?.comments.length ?? '(sin leer)'}`),
    check(
      labelledNow.length === 1 && labelledNow[0]?.author === storyAuthor && labelledNow[0]?.kindLabel === storyLabel,
      `en ${code} solo el comentario de ${storyAuthor} lleva la etiqueta «${storyLabel}» (los demás, ninguna)`,
      `comentarios con etiqueta en ${code}: ${labelledNow.map((comment) => `${comment.author ?? '(sin autor)'} «${comment.kindLabel ?? ''}»`).join(', ') || '(ninguno)'}`,
    ),
  ]);
};

defineBrowserRows({
  story: 'US-NC-GESTION-008',
  surface: 'web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(addsComment)],
    [2, onWeb(emptyNotSent)],
    [3, onWeb(lengthLimit)],
    [4, onWeb(typeLabel)],
  ]),
});

