import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil } from '../../support/browser';
import { check, cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cuentaOf, thenOf } from '../api/common';
import { actionFailed, armToasts, finish, interact, noteField, onWeb, openDetail, openPublishDialog, readHistory, selectedOptionText, signIn, submitButton, toastShown, versionSelect, waitContentLoaded } from './common';

// US-DOC-VERSIONES-006 — Tras publicar desde la ficha, el historial muestra la versión nueva primera (web). Preparación de cada fila:
// reinicio de alumno01, inicio de sesión de la cuenta de la fila y apertura de DOC-001 (versión 3). La fila lee el historial de la
// ficha después de publicar: cada fila del historial se lee por sus hijos (versión, nota, autor y fecha), sin tomar el texto de la página.

/** Nota que escribe la fila (`undefined` = no escribe nada en «Nota de cambios»). */
const NOTA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['escribe «Revisión de alcance» en «Nota de cambios»', 'Revisión de alcance'],
  ['no escribe nada en «Nota de cambios»', undefined],
]);

/** Primera fila del historial que la historia espera tras publicar: versión, nota («—» si está vacía) y autor. */
const PRIMERA_FILA: ReadonlyMap<string, { readonly nota: string; readonly autor: string }> = new Map<string, { readonly nota: string; readonly autor: string }>([
  ['«v4», la nota «Revisión de alcance» y «por Javier Ortega»', { nota: 'Revisión de alcance', autor: 'por Javier Ortega' }],
  ['«v4», la nota «—» y «por Alumno 01»', { nota: '—', autor: 'por Alumno 01' }],
]);

const showRow = (cells: readonly string[] | undefined): string => (cells === undefined ? '(sin leer)' : `«${cells.join(' · ')}»`);

const historyAfterPublish: BrowserRowHandler = onWeb(async (row, { page }) => {
  const expected = thenOf(row);
  const account = cuentaOf(cell(row, 'cuenta'));
  const typed = strict('nota', NOTA, cell(row, 'nota'));
  const primera = strict('primera_fila', PRIMERA_FILA, cell(row, 'primera_fila'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openDetail(page, 'DOC-001');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const before = await selectedOptionText(versionSelect(page));
  if (before !== 'Versión 3 (última)') return preparationFailedWeb(expected, `la ficha muestra «${before ?? '(sin leer)'}» y se esperaba «Versión 3 (última)»`);

  const dialog = await openPublishDialog(page, 'DOC-001');
  if (dialog !== undefined) return actionFailed(expected, dialog);
  if (!(await waitContentLoaded(page))) return preparationFailedWeb(expected, 'el contenido de la última versión no llega al diálogo');
  if (typed !== undefined) {
    const written = await interact(noteField(page), `escribir «${typed}» en «Nota de cambios»`, (element) => element.fill(typed, ACTION));
    if (written !== undefined) return actionFailed(expected, written);
  }
  const armedAt = await armToasts(page);
  if (armedAt === undefined) return preparationFailedWeb(expected, 'el registro de avisos no está instalado en la página');
  const submitted = await interact(submitButton(page), 'pulsar «Publicar versión»', (element) => element.click(ACTION));
  if (submitted !== undefined) return actionFailed(expected, submitted);

  const toast = await toastShown(page, 'ok', 'Versión publicada', 'DOC-001 → versión 4');
  // El historial se relee tras el aviso: la fila nueva debe estar primera
  await waitUntil(async () => (await readHistory(page))?.[0]?.[0] === 'v4');
  const history = await readHistory(page);
  const first = history?.[0];
  const second = history?.[1];
  const firstOk = first?.[0] === 'v4' && first[1] === primera.nota && first[2] !== undefined && first[2].split(' · ')[0] === primera.autor;
  const secondOk = second?.[0] === 'v3' && second[1] === 'Nuevos criterios de aceptación y anexos' && second[2] !== undefined && second[2].split(' · ')[0] === 'por Javier Ortega';
  return finish([
    check(toast.seen, 'aparece el aviso «Versión publicada» / «DOC-001 → versión 4»', toast.seen ? 'aparece el aviso «Versión publicada» / «DOC-001 → versión 4»' : `no aparece el aviso: ${toast.observed}`),
    check(
      firstOk,
      `la primera fila del historial es «v4», la nota «${primera.nota}» y «${primera.autor}»`,
      `la primera fila del historial es ${showRow(first)}`,
    ),
    check(
      secondOk,
      'la segunda fila es «v3», la nota «Nuevos criterios de aceptación y anexos» y «por Javier Ortega»',
      `la segunda fila es ${showRow(second)}`,
    ),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-VERSIONES-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, historyAfterPublish]]),
});
