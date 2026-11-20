import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  TRANSVERSAL_NOTE,
  actionFailed,
  appearance,
  archiveVerify,
  armOrFail,
  awaitTitle,
  bodySmallerCheck,
  conclude,
  duplicateVerify,
  franjaCheck,
  onDocuments,
  onPrograms,
  openDocumentsList,
  rowAction,
  signInWeb,
  toastChecks,
  watchDownload,
  watchReplies,
  withNote,
  type Act,
  type WriteReply,
} from './common';

// US-TOASTS-001 — Cuatro tonos de aviso (transversal; sus filas se miran en la web, 1440 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test y llegada a /programs (Esquema 1) o a /documents (Esquema 2). Cada aviso de éxito se
// comprueba además contra la API: archivar deja PRG-001 «Cerrado» y duplicar deja la copia PRG-025 como borrador; el servidor confirma
// la escritura con 2xx. La franja (color del tono) y el cuerpo (letra más pequeña, solo si lo hay) se miran en las dos filas. La
// descarga de la fila informativa se escucha como evento de descarga y su nombre debe ser el del aviso. La línea de detalle técnico no
// se mira. El aviso no bloquea la pantalla: esta fila no lo mira (lo cubre US-TOASTS-003 E1).

const NO_BLOCK_NOTE = 'El aviso no bloquea la pantalla: esta fila no lo mira; lo cubre US-TOASTS-003 E1 (la segunda acción se hace con el primer aviso a la vista).';

interface ProgramCase {
  readonly act: Act;
  /** Lo que el servidor y la API confirman para esa acción. */
  readonly verify: (replies: readonly WriteReply[]) => Promise<Check[]>;
}

const PROGRAM_ACTIONS: ReadonlyMap<string, ProgramCase> = new Map<string, ProgramCase>([
  ['abre las acciones de PRG-001 y pulsa «Archivar»', { act: rowAction('PRG-001', 'Archivar', onPrograms), verify: archiveVerify }],
  ['abre las acciones de PRG-001 y pulsa «Duplicar»', { act: rowAction('PRG-001', 'Duplicar', onPrograms), verify: duplicateVerify }],
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
  const testCase = strict('accion', PROGRAM_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const body = bodyOf(cell(row, 'cuerpo'));
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const replies = watchReplies(page);
  const blocked = await testCase.act(page);
  if (blocked !== undefined) {
    replies.stop();
    return actionFailed(expected, blocked);
  }
  const seen = await awaitTitle(page, title);
  const collected = await replies.collect();
  replies.stop();
  return conclude(
    [
      ...(await toastChecks(page, seen, 'ok', title, body)),
      await franjaCheck(page, seen, 'ok'),
      ...(body === '' ? [] : [bodySmallerCheck(seen)]),
      ...(await testCase.verify(collected)),
    ],
    { note: NO_BLOCK_NOTE, evidence: appearance(seen) },
  );
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
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const downloaded = watchDownload(page);
  const blocked = await act(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  const fileName = await downloaded;
  return conclude(
    [
      ...(await toastChecks(page, seen, 'info', title, file)),
      await franjaCheck(page, seen, 'info'),
      bodySmallerCheck(seen),
      check(fileName === file, `se descarga el archivo ${file}`, fileName === undefined ? 'no llegó ningún evento de descarga' : `se descarga el archivo ${fileName}`),
    ],
    { note: NO_BLOCK_NOTE, evidence: appearance(seen) },
  );
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
