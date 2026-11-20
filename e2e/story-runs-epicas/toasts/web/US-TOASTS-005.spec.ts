import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  actionFailed,
  answerPrompt,
  appearance,
  armOrFail,
  awaitTitle,
  clickAt,
  conclude,
  franjaCheck,
  goTo,
  inOrder,
  ncCommentIds,
  onDocuments,
  onNc,
  onPrograms,
  openNcBoard,
  roleCheck,
  rowAction,
  sidebarLink,
  signInWeb,
  sleepUntilPage,
  toastChecks,
  watchDownload,
  withNote,
  writesTo,
  type Act,
} from './common';

// US-TOASTS-005 — Avisos informativos y de advertencia en la web (escritorio 1440 px). Preparación de cada fila: reinicio de alumno01 e
// inicio de sesión de gestor@sigpro.test; el Esquema 2 sigue hasta /nc. El cuadro del navegador (`prompt()`) se responde con el texto de
// la fila (`(vacío)` es la cadena vacía, `(tres espacios)` tres espacios). Cada aviso se anuncia con el rol de estado y tiene la franja de
// su tono. Las escrituras a la API se vigilan durante toda la vida del aviso (3,5 s desde que aparece): el informativo no escribe, el de
// advertencia no envía ninguna escritura y deja los comentarios de NC-001 como estaban. La descarga del informativo se escucha como evento.

const WARN_TITLE = 'El comentario rápido no puede estar vacío';
/** Cuerpo del aviso «Atajos de teclado», tal como lo escribe la historia (con sus guiones largos). */
const SHORTCUTS_BODY = 'N · nuevo programa — / · buscar — Esc · cerrar';
/** Ventana de observación de las escrituras: más que la vida del aviso (3 s) para cubrir cualquier petición tardía. */
const WATCH_MS = 3_500;

/** Cuerpos que la historia escribe en el Esquema 1: el de los atajos (entre «…») y el nombre de archivo de la descarga. */
const INFO_BODIES: ReadonlyMap<string, string> = new Map<string, string>([
  [`«${SHORTCUTS_BODY}»`, SHORTCUTS_BODY],
  ['DOC-002-v1.pdf', 'DOC-002-v1.pdf'],
]);

/** Textos que la fila escribe en el cuadro `prompt()`: `(vacío)` y `(tres espacios)`. */
const PROMPT_TEXTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(tres espacios)', '   '],
]);

/** Abre el menú de usuario (avatar) y pulsa «Atajos de teclado» (su nombre accesible trae el «?» de la tecla). */
const shortcutsAct: Act = inOrder(
  clickAt((page) => page.getByRole('button', { name: 'Menú de usuario', exact: true }), 'abrir el «Menú de usuario»', onPrograms),
  clickAt((page) => page.getByRole('menuitem', { name: /^Atajos de teclado/ }), 'pulsar «Atajos de teclado» en el menú de usuario', onPrograms),
);

/** Va a la lista de documentos desde la navegación y abre las acciones de DOC-002. */
const documentsAct: Act = inOrder(
  goTo((page) => sidebarLink(page, 'documents', /^Documentos/), 'pulsar «Documentos» en la navegación', '/documents'),
  rowAction('DOC-002', 'Descargar PDF', onDocuments),
);

const INFO_ACTIONS: ReadonlyMap<string, Act> = new Map<string, Act>([
  ['abre el menú de su avatar y pulsa «Atajos de teclado»', shortcutsAct],
  ['va a la lista de documentos, abre las acciones de DOC-002 y pulsa «Descargar PDF»', documentsAct],
]);

const sameIds = (before: readonly string[], after: readonly string[]): boolean => before.length === after.length && before.every((id, index) => id === after[index]);

// --- Esquema 1: una acción informativa muestra su aviso con el texto que corresponde ----------------------------------------

const informative: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso informativo con el título ${cell(row, 'titulo')} y el cuerpo ${cell(row, 'cuerpo')}`;
  const act = strict('accion', INFO_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const body = strict('cuerpo', INFO_BODIES, cell(row, 'cuerpo'));
  const isDownload = body.endsWith('.pdf');
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const writes = writesTo(page);
  const downloaded = isDownload ? watchDownload(page) : Promise.resolve(undefined);
  const blocked = await act(page);
  if (blocked !== undefined) {
    writes.stop();
    return actionFailed(expected, blocked);
  }
  const seen = await awaitTitle(page, title);
  // Ventana de escrituras: la vida entera del aviso (no solo hasta que aparece)
  if (seen.entry !== undefined) await sleepUntilPage(page, seen.entry.at + WATCH_MS);
  writes.stop();
  const fileName = await downloaded;
  const downloadCheck = isDownload ? [check(fileName === body, `se descarga el archivo ${body}`, fileName === undefined ? 'no llegó ningún evento de descarga' : `se descarga el archivo ${fileName}`)] : [];
  return conclude(
    [
      ...(await toastChecks(page, seen, 'info', title, body)),
      roleCheck(seen, 'status'),
      await franjaCheck(page, seen, 'info'),
      check(writes.writes.length === 0, 'el aviso informativo no cambia ningún dato (ninguna escritura a la API en la vida del aviso)', writes.writes.length === 0 ? 'ninguna escritura a la API' : `escrituras: ${writes.writes.join(', ')}`),
      ...downloadCheck,
    ],
    { evidence: appearance(seen) },
  );
};

// --- Esquema 2: un comentario rápido sin texto muestra un aviso de advertencia y no se guarda -----------------------------

const emptyComment: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso de advertencia con el título «${WARN_TITLE}»; NC-001 no tiene ningún comentario nuevo`;
  const typed = strict('texto', PROMPT_TEXTS, cell(row, 'texto'));
  const signed = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  const prepared = signed ?? (await openNcBoard(page));
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const before = await ncCommentIds('NC-001');
  if (before === undefined) return preparationFailedWeb(expected, 'no se pudieron leer los comentarios de NC-001 por API');
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const prompt = answerPrompt(page, typed);
  const writes = writesTo(page);
  const blocked = await rowAction('NC-001', 'Comentario rápido…', onNc)(page);
  if (blocked !== undefined) {
    prompt.stop();
    writes.stop();
    return actionFailed(expected, blocked);
  }
  const seen = await awaitTitle(page, WARN_TITLE);
  // Vigila las escrituras durante la vida entera del aviso (3,5 s desde que aparece)
  if (seen.entry !== undefined) await sleepUntilPage(page, seen.entry.at + WATCH_MS);
  else await sleep(1_000);
  prompt.stop();
  writes.stop();
  const after = await ncCommentIds('NC-001');
  const sameComments = after !== undefined && sameIds(before, after);
  const added = after === undefined ? [] : after.filter((id) => !before.includes(id));
  return conclude(
    [
      check(prompt.kinds.includes('prompt'), 'llega el cuadro del navegador para escribir el comentario', prompt.kinds.length === 0 ? 'no llega ningún cuadro del navegador' : `llega un cuadro de tipo ${prompt.kinds.join(', ')}`),
      ...(await toastChecks(page, seen, 'warn', WARN_TITLE)),
      roleCheck(seen, 'status'),
      await franjaCheck(page, seen, 'warn'),
      check(writes.writes.length === 0, 'no llega ninguna petición de escritura al servidor', writes.writes.length === 0 ? 'ninguna petición de escritura al servidor' : `escrituras: ${writes.writes.join(', ')}`),
      check(sameComments, 'NC-001 no tiene ningún comentario nuevo', after === undefined ? '(no se pudo leer NC-001)' : sameComments ? `NC-001 tiene ${after.length} comentarios, los mismos que antes` : `NC-001 pasó de ${before.length} a ${after.length} comentarios (nuevos: ${added.join(', ') || 'ninguno identificable'})`),
    ],
    {
      note: 'La comprobación de peticiones cuenta solo las de escritura (POST, PUT, PATCH, DELETE) a la API, durante 3,5 s desde que aparece el aviso; las lecturas no cuentan.',
      evidence: appearance(seen),
    },
  );
};

defineBrowserRows({
  story: 'US-TOASTS-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(informative, COOKIE_NOTE)],
    [2, withNote(emptyComment, COOKIE_NOTE)],
  ]),
});
