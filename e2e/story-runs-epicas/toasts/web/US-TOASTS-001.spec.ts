import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { COOKIE_NOTE, DESKTOP, TRANSVERSAL_NOTE, actionFailed, armToasts, awaitTitle, bodySmallerCheck, conclude, franjaCheck, onDocuments, onPrograms, openDocumentsList, rowAction, signInWeb, toastChecks, withNote, type Act } from './common';

// US-TOASTS-001 — Cuatro tonos de aviso (transversal; sus filas se miran en la web, 1440 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test y llegada a /programs (Esquema 1) o a /documents (Esquema 2). Además de la línea
// de cada Esquema, la regla de la franja (color del tono) y la del cuerpo (letra más pequeña, solo si lo hay) se comprueban en las filas.
// La línea de detalle técnico no se mira. El tono se lee del aviso que aparece (su `data-testid`).

const PROGRAM_ACTIONS: ReadonlyMap<string, Act> = new Map<string, Act>([
  ['abre las acciones de PRG-001 y pulsa «Archivar»', rowAction('PRG-001', 'Archivar', onPrograms)],
  ['abre las acciones de PRG-001 y pulsa «Duplicar»', rowAction('PRG-001', 'Duplicar', onPrograms)],
]);

const DOCUMENT_ACTIONS: ReadonlyMap<string, Act> = new Map<string, Act>([
  ['abre las acciones de DOC-001 y pulsa «Descargar PDF»', rowAction('DOC-001', 'Descargar PDF', onDocuments)],
  ['abre las acciones de DOC-002 y pulsa «Descargar PDF»', rowAction('DOC-002', 'Descargar PDF', onDocuments)],
]);

/** Nombres de archivo que la historia escribe tal cual en el cuerpo del aviso informativo. */
const FILE_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001-v3.pdf', 'DOC-001-v3.pdf'],
  ['DOC-002-v1.pdf', 'DOC-002-v1.pdf'],
]);

/** `(sin cuerpo)` es la cadena vacía; cualquier otro cuerpo va entre «…». */
const bodyOf = (text: string): string => (text === '(sin cuerpo)' ? '' : quoted(text));

/** Lo que la historia dice del aviso, con sus celdas tal como las escribe. */
const expectedToast = (tone: string, title: string, body: string): string => `aviso de ${tone} con el título ${title}; el aviso tiene el cuerpo ${body}`;

// --- Esquema 1: una acción que sale bien muestra un aviso de éxito con su título y su cuerpo ----------------------------------

const successToast: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = expectedToast('éxito', cell(row, 'titulo'), cell(row, 'cuerpo'));
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const act = strict('accion', PROGRAM_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const body = bodyOf(cell(row, 'cuerpo'));
  await armToasts(page);
  const blocked = await act(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  return conclude([
    ...toastChecks(seen, 'ok', title, body),
    await franjaCheck(page, seen, 'ok'),
    ...(body === '' ? [] : [bodySmallerCheck(seen)]),
  ]);
};

// --- Esquema 2: una descarga muestra un aviso informativo con el nombre del archivo ----------------------------------------

const infoToast: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = expectedToast('informativo', cell(row, 'titulo'), cell(row, 'cuerpo'));
  const signed = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  const prepared = signed ?? (await openDocumentsList(page));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const act = strict('accion', DOCUMENT_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const file = strict('cuerpo', FILE_NAMES, cell(row, 'cuerpo'));
  await armToasts(page);
  const blocked = await act(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  return conclude([...toastChecks(seen, 'info', title, file), await franjaCheck(page, seen, 'info'), bodySmallerCheck(seen)]);
};

defineBrowserRows({
  story: 'US-TOASTS-001',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(withNote(successToast, COOKIE_NOTE), TRANSVERSAL_NOTE)],
    [2, withNote(withNote(infoToast, COOKIE_NOTE), TRANSVERSAL_NOTE)],
  ]),
});
