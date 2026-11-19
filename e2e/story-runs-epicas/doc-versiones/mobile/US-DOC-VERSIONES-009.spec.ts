import type { Page } from '@playwright/test';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, isVisible, quoted, safe, textOf, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cuentaOf, letras, lineas, thenOf } from '../api/common';
import {
  actionFailed,
  apiVersionOf,
  apiVersionReached,
  armToasts,
  countPosts,
  fieldAlertCheck,
  finish,
  interact,
  seenWord,
  settle,
  toastShown,
  verticalBox,
  visibleOrUnknown,
  type Blocked,
} from '../web/common';
import {
  contentError,
  contentField,
  detailTitle,
  gotoApp,
  noteField,
  onExpoWeb,
  openPublishDialog,
  publishButton,
  publishDialog,
  publishReason,
  signInAs,
  submitButton,
  versionChip,
  waitDialogLoaded,
} from './common';

// US-DOC-VERSIONES-009 — Publicar una versión nueva desde la ficha (móvil, Expo web a 390 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de la cuenta de la fila en la app (con «alumno01» en «Tenant de trabajo») y apertura de la ficha por una
// carga completa de la dirección. La app NO es nativa: el veredicto vale para Expo web (la nota de cada fila lo dice).

const UNARMED = 'el registro de avisos no está instalado en la página: no se puede comprobar el aviso';
const SIN_PERMISO = 'Solo admin y gestor pueden publicar versiones';

/** Nota que escribe la fila (`undefined` = no escribe nada en «Nota de cambios»). */
const NOTA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['escribe «Revisión de alcance» en «Nota de cambios»', 'Revisión de alcance'],
  ['no escribe nada en «Nota de cambios»', undefined],
]);

/** Cambio que la fila hace en el diálogo (Esquema 3): una acción con su diagnóstico. */
const CAMBIO: ReadonlyMap<string, (page: Page) => Promise<Blocked | undefined>> = new Map<string, (page: Page) => Promise<Blocked | undefined>>([
  ['borra todo el contenido', (page) => interact(contentField(page), 'borrar el contenido', (element) => element.fill('', ACTION))],
  ['escribe 81 líneas de texto en el contenido', (page) => interact(contentField(page), 'escribir 81 líneas en el contenido', (element) => element.fill(lineas(81).join('\n'), ACTION))],
  ['escribe una línea de 201 letras a en el contenido', (page) => interact(contentField(page), 'escribir una línea de 201 letras en el contenido', (element) => element.fill(letras(201), ACTION))],
  ['escribe 201 letras a en «Nota de cambios»', (page) => interact(noteField(page), 'escribir 201 letras en «Nota de cambios»', (element) => element.fill(letras(201), ACTION))],
]);

/** Campo de la celda «campo»: bajo qué control aparece el aviso. */
const CAMPO: ReadonlyMap<string, 'contenido' | 'nota'> = new Map<string, 'contenido' | 'nota'>([
  ['«Contenido (una línea por fila)»', 'contenido'],
  ['«Nota de cambios»', 'nota'],
]);

/** Prepara la ficha de DOC-001 o DOC-002 con la cuenta en la app. Devuelve el fallo o `undefined`. */
const prepareDetail = async (page: Page, email: string, doc: string, lastLabel: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  const signed = await signInAs(page, cuentaOf(email));
  if (signed !== undefined) return signed;
  const opened = await gotoApp(page, `/documents/${doc}`);
  if (opened !== undefined) return opened;
  const shown = await waitUntil(() => isVisible(detailTitle(page)));
  if (!shown.reached) return `no se ve la ficha de ${doc}`;
  const current = await attrOf(versionChip(page, lastLabel), 'aria-checked');
  return current === 'true' ? undefined : `la ficha no muestra «${lastLabel}» elegida (aria-checked ${String(current)})`;
};

// --- Esquema 1: publicar desde la ficha móvil deja la versión nueva elegida ---------------------------------------------------------

const publishFromMobile: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const typed = strict('nota', NOTA, cell(row, 'nota'));
  const failure = await prepareDetail(page, account.email, 'DOC-001', 'Versión 3 · última');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const dialog = await openPublishDialog(page);
  if (dialog !== undefined) return actionFailed(expected, dialog);
  if (!(await waitDialogLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  if (typed !== undefined) {
    const written = await interact(noteField(page), `escribir «${typed}» en «Nota de cambios»`, (element) => element.fill(typed, ACTION));
    if (written !== undefined) return actionFailed(expected, written);
  }
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, UNARMED);
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const toast = await toastShown(page, 'ok', 'Versión publicada', 'DOC-001 → versión 4');
  await waitUntil(async () => (await visibleOrUnknown(publishDialog(page))) === false);
  const dialogSeen = await visibleOrUnknown(publishDialog(page));
  await waitUntil(async () => (await attrOf(versionChip(page, 'Versión 4 · última'), 'aria-checked')) === 'true');
  const chosen = await attrOf(versionChip(page, 'Versión 4 · última'), 'aria-checked');
  // Persistencia por API, después del aviso
  const persisted = await apiVersionReached(account, 'DOC-001', 4);
  const stored = persisted.state?.versions?.find((entry) => entry.version === 4);
  return finish([
    check(
      toast.seen,
      'aparece el aviso «Versión publicada» / «DOC-001 → versión 4»',
      toast.seen ? `aparece el aviso ${toast.shownAs ?? '(sin leer)'}` : `no aparece el aviso: ${toast.observed}`,
    ),
    check(dialogSeen === false, 'el diálogo se cierra', `el diálogo ${seenWord(dialogSeen)}`),
    check(chosen === 'true', 'la ficha muestra la opción «Versión 4 · última» elegida', `la opción «Versión 4 · última» tiene aria-checked ${chosen ?? '(sin leer)'}`),
    check(
      persisted.reached && stored?.note === (typed ?? ''),
      `la API guarda la versión 4 con la nota ${typed === undefined ? '(vacía)' : `«${typed}»`}`,
      persisted.reached ? `la API guarda la versión 4 con la nota «${stored?.note ?? '(sin leer)'}»` : 'la API no llega a la versión 4 en 5 s',
    ),
  ]);
});

// --- Esquema 2: un rol sin permiso para publicar ve el motivo bajo los botones -------------------------------------------------------

const noPermissionReason: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  await resetTenants([TENANT_A]);
  const signed = await signInAs(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await gotoApp(page, '/documents/DOC-001');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await waitUntil(() => isVisible(detailTitle(page)));
  const button = publishButton(page);
  const disabled = await attrOf(button, 'aria-disabled');
  const dataReason = await attrOf(button, 'data-reason');
  const posts = countPosts(page, '/documents/DOC-001/versions');
  // Prueba de comportamiento: un clic forzado sobre el botón no habilitado no abre el diálogo ni envía nada
  await interact(button, 'pulsar «Publicar nueva versión» (sin permiso)', (element) => element.click({ ...ACTION, force: true }));
  await settle();
  const dialogSeen = await visibleOrUnknown(publishDialog(page));
  // El motivo: primero se mide que se ve (y dónde), y solo después se lee su texto visible
  const reason = publishReason(page);
  const reasonSeen = await visibleOrUnknown(reason);
  const reasonBox = reasonSeen === true ? await verticalBox(reason) : undefined;
  const buttonBox = await verticalBox(button);
  const reasonText = reasonSeen === true ? await textOf(reason) : undefined;
  const below = reasonBox !== undefined && buttonBox !== undefined && reasonBox.top >= buttonBox.bottom - 1;
  return finish(
    [
      check(disabled === 'true', '«Publicar nueva versión» no se puede pulsar (aria-disabled true)', disabled === undefined ? '«Publicar nueva versión»: aria-disabled sin leer' : `«Publicar nueva versión» aria-disabled ${disabled}`),
      check(dialogSeen === false, 'al pulsarlo no se abre el diálogo', `el diálogo ${seenWord(dialogSeen)} tras el clic`),
      check(posts() === 0, 'no se envía ninguna publicación', `se envían ${posts()} peticiones de publicación`),
      check(
        reasonSeen === true && reasonText === SIN_PERMISO && below,
        `debajo de los botones se ve «${SIN_PERMISO}»`,
        reasonSeen === true ? `debajo de los botones se ve «${reasonText ?? '(sin texto)'}»${below ? '' : ', no debajo de los botones'}` : `el motivo ${seenWord(reasonSeen)}`,
      ),
    ],
    { evidence: { dataReason: dataReason ?? null } },
  );
});

// --- Esquema 3: un contenido o una nota que no cumplen los límites no se envían -------------------------------------------------------

const rejectsBeforeSending: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const change = strict('cambio', CAMBIO, cell(row, 'cambio'));
  const field = strict('campo', CAMPO, cell(row, 'campo'));
  const aviso = quoted(cell(row, 'aviso'));
  const failure = await prepareDetail(page, 'gestor@sigpro.test', 'DOC-002', 'Versión 1 · última');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const dialog = await openPublishDialog(page);
  if (dialog !== undefined) return actionFailed(expected, dialog);
  if (!(await waitDialogLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  const posts = countPosts(page, '/documents/DOC-002/versions');
  const changed = await change(page);
  if (changed !== undefined) return actionFailed(expected, changed);
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const alert = field === 'contenido' ? contentError(page) : page.getByRole('alert').filter({ hasText: aviso });
  await waitUntil(async () => (await safe(() => alert.first().innerText({ timeout: 500 }), '')).trim() === aviso);
  const alertCheck =
    field === 'contenido'
      ? await fieldAlertCheck(alert, contentField(page), aviso, '«Contenido (una línea por fila)»')
      : await fieldAlertCheck(alert, noteField(page), aviso, '«Nota de cambios»');
  // Tolerancia de la prueba: una reacción local (1 s) para que una publicación indebida llegue a salir si la hubiera
  await settle();
  const stillOpen = await visibleOrUnknown(publishDialog(page));
  const version = await apiVersionOf(cuentaOf('gestor@sigpro.test'), 'DOC-002');
  return finish([
    alertCheck,
    check(posts() === 0, 'no se envía nada al servidor', `se envían ${posts()} peticiones de publicación`),
    check(stillOpen === true, 'el diálogo sigue abierto', `el diálogo ${seenWord(stillOpen)}`),
    check(version === 1, 'DOC-002 sigue en la versión 1', `DOC-002 queda en la versión ${version === undefined ? '(sin leer)' : String(version)}`),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-VERSIONES-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, publishFromMobile],
    [2, noPermissionReason],
    [3, rejectsBeforeSending],
  ]),
});
