import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  PLACEMENT_NOTE,
  ROLE_OF_CELL,
  TONE_OF_CELL,
  actionFailed,
  appearance,
  archiveVerify,
  armOrFail,
  awaitTitle,
  boxOf,
  bodySmallerCheck,
  chaosReplyCheck,
  confirmedReplyCheck,
  conclude,
  duplicateVerify,
  lifetimeOf,
  onDocuments,
  onPrograms,
  restoringChaos,
  roleCheck,
  rowAction,
  setErrorRate,
  toastChecks,
  toastOf,
  viewportOf,
  watchDownload,
  watchReplies,
  withNote,
  type Act,
  type WriteReply,
} from '../web/common';
import { EXPO_NOTE, FRANJA_NOTE, openMobileDocuments, signInMobile, topPlacement } from './common';

// US-TOASTS-006 — Avisos arriba de la pantalla en la app móvil (Expo web a 390 × 844; NO es nativo). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test en la app (Esquemas 1 y 3: /programs; Esquema 2: /documents, por «Más»). El Esquema 3
// fija la tasa de error de las escrituras con PATCH /api/admin/chaos y el caos se apaga al terminar. Cada aviso se mira en el momento
// (se ve, por encima del contenido: su punto central lo recibe el aviso), posicionado arriba a 12 px del borde y de cada lado, con rol
// y se retira a los 3 s de aparecer (tolerancia de 500 ms). El éxito se confirma en la API y el error se atribuye al caos (500
// chaos_error). La línea de detalle técnico no se mira. La franja del color no se compara (tokens de React Native). La descarga de Expo
// web es la del navegador: se anota si llega el evento, sin hacerlo condición.

/** Lo que la fila pide comprobar de la API tras la acción (éxito: archivado o copia). */
interface ProgramCase {
  readonly act: Act;
  readonly verify: (replies: readonly WriteReply[]) => Promise<Check[]>;
}

const PROGRAM_ACTIONS: ReadonlyMap<string, ProgramCase> = new Map<string, ProgramCase>([
  ['abre las acciones de PRG-001 y pulsa «Archivar»', { act: rowAction('PRG-001', 'Archivar', onPrograms, true), verify: archiveVerify }],
  ['abre las acciones de PRG-001 y pulsa «Duplicar»', { act: rowAction('PRG-001', 'Duplicar', onPrograms, true), verify: duplicateVerify }],
]);

const DOCUMENTS: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
]);

const FILE_NAMES: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001-v3.pdf', 'DOC-001-v3.pdf'],
  ['DOC-002-v1.pdf', 'DOC-002-v1.pdf'],
]);

const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['100', 1],
]);

const DOWNLOAD_TITLE = 'Descarga iniciada';

/** En Expo web la descarga es la del navegador (`saveFile` usa `<a download>`, no la hoja de compartir del sistema). */
const DOWNLOAD_NOTE = 'En Expo web la descarga es la del navegador (`<a download>` de deliver-file.ts, no la hoja de compartir del sistema): el evento de descarga se anota como evidencia y no decide el veredicto.';

/** `(sin cuerpo)` es la cadena vacía; cualquier otro cuerpo va entre «…». */
const bodyOf = (text: string): string => (text === '(sin cuerpo)' ? '' : quoted(text));

// --- Esquema 1: una acción que sale bien muestra arriba de la pantalla un aviso de éxito ------------------------------------

const successMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `arriba de la pantalla, aviso de éxito con el título ${cell(row, 'titulo')}; se anuncia con el rol de estado; el aviso tiene el cuerpo ${cell(row, 'cuerpo')}`;
  const testCase = strict('accion', PROGRAM_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const body = bodyOf(cell(row, 'cuerpo'));
  const prepared = await signInMobile(page, DEMO.gestor.email, DEMO.gestor.password);
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
  const live = await toastChecks(page, seen, 'ok', title, body);
  const collected = await replies.collect();
  replies.stop();
  const box = await boxOf(toastOf(page, 'ok', title));
  const viewport = await viewportOf(page);
  const life = await lifetimeOf(page, seen.entry, 'aviso');
  return conclude(
    [...live, roleCheck(seen, 'status'), topPlacement(box, viewport), ...(body === '' ? [] : [bodySmallerCheck(seen)]), life.check, ...(await testCase.verify(collected))],
    { note: `${PLACEMENT_NOTE} ${FRANJA_NOTE}`, evidence: { ...appearance(seen), msDeVida: life.ms ?? '(sin retirada)' } },
  );
};

// --- Esquema 2: una descarga muestra arriba de la pantalla un aviso informativo con el nombre del archivo -------------------

const downloadMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `arriba de la pantalla, aviso informativo con el título «${DOWNLOAD_TITLE}»; se anuncia con el rol de estado; el aviso tiene el cuerpo ${cell(row, 'cuerpo')}`;
  const documento = strict('documento', DOCUMENTS, cell(row, 'documento'));
  const file = strict('cuerpo', FILE_NAMES, cell(row, 'cuerpo'));
  const prepared = await signInMobile(page, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const listed = await openMobileDocuments(page);
  if (listed !== undefined) return preparationFailedWeb(expected, listed.message);
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const downloaded = watchDownload(page);
  const blocked = await rowAction(documento, 'Descargar PDF', onDocuments, true)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, DOWNLOAD_TITLE);
  const live = await toastChecks(page, seen, 'info', DOWNLOAD_TITLE, file);
  const box = await boxOf(toastOf(page, 'info', DOWNLOAD_TITLE));
  const viewport = await viewportOf(page);
  const fileName = await downloaded;
  const life = await lifetimeOf(page, seen.entry, 'aviso');
  return conclude([...live, roleCheck(seen, 'status'), topPlacement(box, viewport), bodySmallerCheck(seen), life.check], {
    note: `${PLACEMENT_NOTE} ${FRANJA_NOTE} ${DOWNLOAD_NOTE}`,
    evidence: { ...appearance(seen), descargaObservada: fileName ?? '(no observada)', msDeVida: life.ms ?? '(sin retirada)' },
  });
};

// --- Esquema 3: un fallo del servidor muestra un aviso de error que se anuncia con rol de alerta -----------------------------

const errorMobile: BrowserRowHandler = restoringChaos(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `arriba de la pantalla, aviso de ${cell(row, 'tono')} con el título ${cell(row, 'titulo')}; se anuncia con el rol de ${cell(row, 'rol')}`;
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const tone = strict('tono', TONE_OF_CELL, cell(row, 'tono'));
  const role = strict('rol', ROLE_OF_CELL, cell(row, 'rol'));
  const title = quoted(cell(row, 'titulo'));
  const prepared = await signInMobile(page, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const rateStatus = await setErrorRate(rate);
  if (rateStatus !== 200) return preparationFailedWeb(expected, `PATCH /api/admin/chaos respondió ${rateStatus}`);
  const armed = await armOrFail(page);
  if (armed !== undefined) return preparationFailedWeb(expected, armed);
  const replies = watchReplies(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms, true)(page);
  if (blocked !== undefined) {
    replies.stop();
    return actionFailed(expected, blocked);
  }
  const seen = await awaitTitle(page, title);
  const live = await toastChecks(page, seen, tone, title);
  const collected = await replies.collect();
  replies.stop();
  const box = await boxOf(toastOf(page, tone, title));
  const viewport = await viewportOf(page);
  const life = await lifetimeOf(page, seen.entry, 'aviso');
  const archive = collected.find((reply) => reply.method === 'POST' && reply.path.includes('PRG-001/archive'));
  // La fila de éxito (tasa 0) exige 2xx; solo la de error (tasa 100) atribuye el fallo al caos (500 chaos_error)
  const serverCheck = rate === 0 ? confirmedReplyCheck(archive, 'el archivado') : chaosReplyCheck(archive);
  return conclude([...live, roleCheck(seen, role), topPlacement(box, viewport), life.check, serverCheck], {
    note: `${PLACEMENT_NOTE} ${FRANJA_NOTE}`,
    evidence: { ...appearance(seen), msDeVida: life.ms ?? '(sin retirada)' },
  });
});

defineBrowserRows({
  story: 'US-TOASTS-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(successMobile, EXPO_NOTE)],
    [2, withNote(downloadMobile, EXPO_NOTE)],
    [3, withNote(errorMobile, EXPO_NOTE)],
  ]),
});
