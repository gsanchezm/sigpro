import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, isVisible, quoted, safe, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cuentaOf, letras, lineas, thenOf, type VersionEntry } from '../api/common';
import {
  actionFailed,
  apiVersionHolds,
  apiVersionReached,
  armToasts,
  backLink,
  cancelButton,
  contentError,
  contentField,
  countPosts,
  dialogOf,
  fieldAlertCheck,
  finish,
  interact,
  noteField,
  onWeb,
  openDetail,
  openPublishDialog,
  publishButton,
  quietWindow,
  selectedOptionText,
  seenWord,
  signIn,
  stateCheck,
  submitButton,
  toastShown,
  versionCellOf,
  versionSelect,
  visibleOrUnknown,
  waitContentLoaded,
  type Blocked,
} from './common';

// US-DOC-VERSIONES-005 — Publicar una versión nueva desde la ficha (web). Preparación de cada fila: reinicio de alumno01, inicio de
// sesión de la cuenta de la fila en /login?tenant=alumno01 y apertura de la ficha del documento. Lo que se afirma es lo MEDIDO: el aviso
// que casó en el registro, la visibilidad del diálogo, el selector y la celda de la lista. La API se sondea tras la acción.

const UNARMED = 'el registro de avisos no está instalado en la página: no se puede comprobar el aviso';

/** Nota que escribe la fila (`undefined` = no escribe nada en «Nota de cambios»). */
const NOTA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['escribe «Revisión de alcance» en «Nota de cambios»', 'Revisión de alcance'],
  ['no escribe nada en «Nota de cambios»', undefined],
]);

/** Campo de la celda «campo» del Esquema 2: bajo qué control aparece el aviso. */
const CAMPO: ReadonlyMap<string, 'contenido' | 'nota'> = new Map<string, 'contenido' | 'nota'>([
  ['«Contenido (una línea por fila)»', 'contenido'],
  ['«Nota de cambios»', 'nota'],
]);

/** Cambio que la fila hace en el diálogo antes de publicar (Esquema 2). Cada cambio es una acción con su diagnóstico. */
const CAMBIO: ReadonlyMap<string, (page: Page) => Promise<Blocked | undefined>> = new Map<string, (page: Page) => Promise<Blocked | undefined>>([
  ['borra todo el contenido', (page) => interact(contentField(page), 'borrar el contenido', (element) => element.fill('', ACTION))],
  ['escribe 81 líneas de texto en el contenido', (page) => interact(contentField(page), 'escribir 81 líneas en el contenido', (element) => element.fill(lineas(81).join('\n'), ACTION))],
  ['escribe una línea de 201 letras a en el contenido', (page) => interact(contentField(page), 'escribir una línea de 201 letras en el contenido', (element) => element.fill(letras(201), ACTION))],
  ['escribe 201 letras a en «Nota de cambios»', (page) => interact(noteField(page), 'escribir 201 letras en «Nota de cambios»', (element) => element.fill(letras(201), ACTION))],
]);

/** Primera línea que escribe el Esquema 4 («cambia la primera línea del contenido»): el texto nuevo de esa línea. */
const CAMBIO_CANCELAR: ReadonlyMap<string, string> = new Map<string, string>([['cambia la primera línea del contenido', 'Primera línea modificada por la prueba']]);

/** Prepara la ficha: reinicio, inicio de sesión y apertura de la ficha con la versión de partida. Devuelve el fallo o `undefined`. */
const prepareDetail = async (page: Page, email: string, doc: string, lastLabel: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, cuentaOf(email));
  if (signed !== undefined) return signed;
  const opened = await openDetail(page, doc);
  if (opened !== undefined) return opened;
  const label = await selectedOptionText(versionSelect(page));
  return label === lastLabel ? undefined : `la ficha de ${doc} muestra «${label ?? '(sin leer)'}» y se esperaba «${lastLabel}»`;
};

// --- Esquema 1: publicar desde la ficha deja la versión nueva como la última --------------------------------------------------------

const publishFromDetail: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const typed = strict('nota', NOTA, cell(row, 'nota'));
  const failure = await prepareDetail(page, account.email, 'DOC-001', 'Versión 3 (última)');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const opened = await openPublishDialog(page, 'DOC-001');
  if (opened !== undefined) return actionFailed(expected, opened);
  if (!(await waitContentLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  if (typed !== undefined) {
    const written = await interact(noteField(page), `escribir «${typed}» en «Nota de cambios»`, (element) => element.fill(typed, ACTION));
    if (written !== undefined) return actionFailed(expected, written);
  }
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const toast = await toastShown(page, 'ok', 'Versión publicada', 'DOC-001 → versión 4');
  // El diálogo debe dejar de verse (lectura sin leer = no cumple); se espera antes de medir
  await waitUntil(async () => (await visibleOrUnknown(dialogOf(page, 'DOC-001'))) === false);
  const dialogSeen = await visibleOrUnknown(dialogOf(page, 'DOC-001'));
  // El selector pasa a «Versión 4 (última)» cuando termina la recarga de la ficha: se espera antes de leerlo
  await waitUntil(async () => (await selectedOptionText(versionSelect(page))) === 'Versión 4 (última)');
  const selected = await selectedOptionText(versionSelect(page));
  // Persistencia por API, después del aviso (sondeo de hasta 5 s)
  const persisted = await apiVersionReached(account, 'DOC-001', 4);
  const stored: VersionEntry | undefined = persisted.state?.versions?.find((entry) => entry.version === 4);
  const back = await interact(backLink(page), 'pulsar «Volver a Documentos»', (element) => element.click(ACTION));
  if (back !== undefined) return actionFailed(expected, back);
  await waitUntil(async () => (await versionCellOf(page, 'DOC-001')) === 'v4');
  const listed = await versionCellOf(page, 'DOC-001');
  return finish(
    [
      check(
        toast.seen,
        'aparece el aviso «Versión publicada» / «DOC-001 → versión 4»',
        toast.seen ? `aparece el aviso ${toast.shownAs ?? '(sin leer)'}` : `no aparece el aviso: ${toast.observed}`,
      ),
      check(dialogSeen === false, 'el diálogo se cierra', `el diálogo ${seenWord(dialogSeen)}`),
      check(selected === 'Versión 4 (última)', 'en la ficha, el selector «Versión» muestra «Versión 4 (última)»', `en la ficha, el selector «Versión» muestra «${selected ?? '(sin leer)'}»`),
      check(
        persisted.reached && stored?.note === (typed ?? ''),
        `la API guarda la versión 4 con la nota ${typed === undefined ? '(vacía)' : `«${typed}»`}`,
        persisted.reached ? `la API guarda la versión 4 con la nota «${stored?.note ?? '(sin leer)'}»` : 'la API no llega a la versión 4 en 5 s',
      ),
      check(listed === 'v4', 'al volver a /documents, la fila de DOC-001 muestra «v4» (columna Versión)', `al volver a /documents, la fila de DOC-001 muestra «${listed ?? '(sin leer)'}» (columna Versión)`),
    ],
    { evidence: { celdaVersion: listed ?? null } },
  );
});

// --- Esquema 2: el contenido y la nota se comprueban antes de enviar ------------------------------------------------------------------

const validatesBeforeSending: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const change = strict('cambio', CAMBIO, cell(row, 'cambio'));
  const field = strict('campo', CAMPO, cell(row, 'campo'));
  const aviso = quoted(cell(row, 'aviso'));
  const failure = await prepareDetail(page, 'gestor@sigpro.test', 'DOC-002', 'Versión 1 (última)');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const opened = await openPublishDialog(page, 'DOC-002');
  if (opened !== undefined) return actionFailed(expected, opened);
  if (!(await waitContentLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  const posts = countPosts(page, '/documents/DOC-002/versions');
  const changed = await change(page);
  if (changed !== undefined) return actionFailed(expected, changed);
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  // El aviso es de validación en el propio diálogo: se espera a que aparezca con su texto exacto (techo 10 s) antes de juzgarlo
  const alert = field === 'contenido' ? contentError(page) : page.getByRole('alert').filter({ hasText: aviso });
  await waitUntil(async () => (await safe(() => alert.first().innerText({ timeout: 500 }), '')).trim() === aviso);
  const alertCheck =
    field === 'contenido'
      ? await fieldAlertCheck(alert, contentField(page), aviso, '«Contenido (una línea por fila)»')
      : await fieldAlertCheck(alert, noteField(page), aviso, '«Nota de cambios»');
  // Ventana de observación: una publicación indebida tendría tiempo de llegar al servidor y a la API (5 s)
  const holds = await apiVersionHolds(cuentaOf('gestor@sigpro.test'), 'DOC-002', 1, 5_000);
  const stillOpen = await visibleOrUnknown(dialogOf(page, 'DOC-002'));
  return finish([
    alertCheck,
    check(posts() === 0, 'no se envía nada al servidor', `se envían ${posts()} peticiones de publicación`),
    check(stillOpen === true, 'el diálogo sigue abierto', `el diálogo ${seenWord(stillOpen)}`),
    check(
      holds.changedTo === undefined && holds.last === 1,
      'DOC-002 sigue en la versión 1 durante la ventana de 5 s',
      holds.changedTo !== undefined ? `DOC-002 pasa a la versión ${holds.changedTo}` : `DOC-002 queda en la versión ${holds.last === undefined ? '(sin leer)' : String(holds.last)}`,
    ),
  ]);
});

// --- Esquema 3: el botón de publicar solo está habilitado para admin y gestor de programa -------------------------------------------

const ESTADO: ReadonlyMap<string, { readonly enabled: boolean; readonly reason?: string }> = new Map<string, { readonly enabled: boolean; readonly reason?: string }>([
  ['está habilitado', { enabled: true }],
  ['está deshabilitado, con la explicación «Solo admin y gestor pueden publicar versiones»', { enabled: false, reason: 'Solo admin y gestor pueden publicar versiones' }],
]);

const publishEnabledByRole: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const estado = strict('estado', ESTADO, cell(row, 'estado'));
  const failure = await prepareDetail(page, account.email, 'DOC-001', 'Versión 3 (última)');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  await waitUntil(() => isVisible(publishButton(page)));
  const state = estado.enabled ? await stateCheck(publishButton(page), 'habilitado') : await stateCheck(publishButton(page), 'deshabilitado', estado.reason);
  return finish([state]);
});

// --- Esquema 4: cancelar el diálogo no publica nada ----------------------------------------------------------------------------------

const cancelKeepsVersion: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const replacement = strict('cambio', CAMBIO_CANCELAR, cell(row, 'cambio'));
  const failure = await prepareDetail(page, 'gestor@sigpro.test', 'DOC-001', 'Versión 3 (última)');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const opened = await openPublishDialog(page, 'DOC-001');
  if (opened !== undefined) return actionFailed(expected, opened);
  if (!(await waitContentLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const current = await safe(() => contentField(page).inputValue({ timeout: 500 }), undefined);
  if (current === undefined) return preparationFailedWeb(expected, 'no se puede leer el contenido del diálogo');
  const edited = await interact(contentField(page), 'cambiar la primera línea del contenido', (element) =>
    element.fill([replacement, ...current.split('\n').slice(1)].join('\n'), ACTION),
  );
  if (edited !== undefined) return actionFailed(expected, edited);
  const cancelled = await interact(cancelButton(page), 'pulsar «Cancelar»', (element) => element.click(ACTION));
  if (cancelled !== undefined) return actionFailed(expected, cancelled);

  const quiet = await quietWindow(page, 'ok');
  await waitUntil(async () => (await visibleOrUnknown(dialogOf(page, 'DOC-001'))) === false);
  const dialogSeen = await visibleOrUnknown(dialogOf(page, 'DOC-001'));
  const selected = await selectedOptionText(versionSelect(page));
  // Sondeo de la API durante 5 s: la versión 3 debe mantenerse, no solo en una lectura
  const holds = await apiVersionHolds(cuentaOf('gestor@sigpro.test'), 'DOC-001', 3, 5_000);
  const quietObserved = quiet.unarmed ? `no se puede afirmar (${quiet.seen})` : quiet.held ? 'ningún aviso de tono ok en la ventana de 4 s' : `aparece ${quiet.seen}`;
  return finish([
    check(dialogSeen === false, 'el diálogo se cierra sin aviso de publicación', `el diálogo ${seenWord(dialogSeen)}`),
    check(!quiet.unarmed && quiet.held, 'no aparece ningún aviso de publicación', quietObserved),
    check(selected === 'Versión 3 (última)', 'la ficha sigue mostrando la versión 3 como la última', `la ficha muestra «${selected ?? '(sin leer)'}»`),
    check(
      holds.changedTo === undefined && holds.last === 3,
      'DOC-001 sigue en la versión 3 en la API durante 5 s',
      holds.changedTo !== undefined ? `DOC-001 pasa a la versión ${holds.changedTo} en la API` : `DOC-001 queda en la versión ${holds.last === undefined ? '(sin leer)' : String(holds.last)} en la API`,
    ),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-VERSIONES-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, publishFromDetail],
    [2, validatesBeforeSending],
    [3, publishEnabledByRole],
    [4, cancelKeepsVersion],
  ]),
});
