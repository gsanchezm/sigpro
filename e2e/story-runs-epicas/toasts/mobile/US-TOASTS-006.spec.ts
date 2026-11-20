import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted } from '../../support/browser';
import { cell, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  ROLE_OF_CELL,
  TONE_OF_CELL,
  actionFailed,
  armToasts,
  awaitTitle,
  boxOf,
  bodySmallerCheck,
  conclude,
  onDocuments,
  onPrograms,
  restoringChaos,
  roleCheck,
  rowAction,
  setErrorRate,
  settle,
  toastChecks,
  toastOf,
  viewportOf,
  withNote,
  type Act,
} from '../web/common';
import { EXPO_NOTE, FRANJA_NOTE, openMobileDocuments, signInMobile, topPlacement } from './common';

/** En Expo web la descarga es la del navegador (`saveFile` usa `<a download>`, no la hoja de compartir): la fila mira el aviso, no el archivo guardado. */
const DOWNLOAD_NOTE = 'En Expo web la descarga es la del navegador (`<a download>` de deliver-file.ts, no la hoja de compartir del sistema): la fila mira el aviso, no el archivo guardado.';

// US-TOASTS-006 — Avisos arriba de la pantalla en la app móvil (Expo web a 390 × 844; NO es nativo). Preparación de cada fila: reinicio
// de alumno01, inicio de sesión de gestor@sigpro.test en la app (Esquemas 1 y 3: /programs; Esquema 2: /documents, por «Más»). El
// Esquema 3 fija la tasa de error de las escrituras con PATCH /api/admin/chaos y el caos se apaga al terminar. La línea de detalle
// técnico no se compara. La franja del color del tono no se compara en la app móvil: sus colores son tokens de React Native.

const PROGRAM_ACTIONS: ReadonlyMap<string, Act> = new Map<string, Act>([
  ['abre las acciones de PRG-001 y pulsa «Archivar»', rowAction('PRG-001', 'Archivar', onPrograms, true)],
  ['abre las acciones de PRG-001 y pulsa «Duplicar»', rowAction('PRG-001', 'Duplicar', onPrograms, true)],
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

/** `(sin cuerpo)` es la cadena vacía; cualquier otro cuerpo va entre «…». */
const bodyOf = (text: string): string => (text === '(sin cuerpo)' ? '' : quoted(text));

// --- Esquema 1: una acción que sale bien muestra arriba de la pantalla un aviso de éxito ------------------------------------

const successMobile: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `arriba de la pantalla, aviso de éxito con el título ${cell(row, 'titulo')}; se anuncia con el rol de estado; el aviso tiene el cuerpo ${cell(row, 'cuerpo')}`;
  const act = strict('accion', PROGRAM_ACTIONS, cell(row, 'accion'));
  const title = quoted(cell(row, 'titulo'));
  const body = bodyOf(cell(row, 'cuerpo'));
  const prepared = await signInMobile(page, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  await armToasts(page);
  const blocked = await act(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  await settle();
  const box = await boxOf(toastOf(page, 'ok', title));
  const viewport = await viewportOf(page);
  return conclude([
    ...toastChecks(seen, 'ok', title, body),
    roleCheck(seen, 'status'),
    topPlacement(box, viewport),
    ...(body === '' ? [] : [bodySmallerCheck(seen)]),
  ]);
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
  await armToasts(page);
  const blocked = await rowAction(documento, 'Descargar PDF', onDocuments, true)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, DOWNLOAD_TITLE);
  await settle();
  const box = await boxOf(toastOf(page, 'info', DOWNLOAD_TITLE));
  const viewport = await viewportOf(page);
  return conclude([
    ...toastChecks(seen, 'info', DOWNLOAD_TITLE, file),
    roleCheck(seen, 'status'),
    topPlacement(box, viewport),
    bodySmallerCheck(seen),
  ]);
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
  await armToasts(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms, true)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  await settle();
  const box = await boxOf(toastOf(page, tone, title));
  const viewport = await viewportOf(page);
  return conclude([...toastChecks(seen, tone, title), roleCheck(seen, role), topPlacement(box, viewport)]);
});

defineBrowserRows({
  story: 'US-TOASTS-006',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withNote(withNote(successMobile, EXPO_NOTE), FRANJA_NOTE)],
    [2, withNote(withNote(withNote(downloadMobile, EXPO_NOTE), FRANJA_NOTE), DOWNLOAD_NOTE)],
    [3, withNote(withNote(errorMobile, EXPO_NOTE), FRANJA_NOTE)],
  ]),
});
