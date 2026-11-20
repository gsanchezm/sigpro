import { defineBrowserRows, type BrowserRowHandler, type ManifestRow } from '../../core/framework';
import { ACTION, HOLD_MS, runSteps, safe, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { CUENTA, COBERTURA_GESTOR, TENANT_A, finish, finishNoted, thenOf } from '../api/common';
import {
  RESTRICTED,
  absenceAfterHold,
  actionFailed,
  badgeIn,
  boxOf,
  countBelow,
  countOf,
  hiddenNote,
  onWeb,
  openDocumentsFromMenu,
  presenceCheck,
  rowOf,
  searchBox,
  seenCheck,
  settledList,
  shownCodes,
  signIn,
  subtitleAbove,
  tableOf,
  textCheck,
  textOfLocator,
  visibleFor,
  visibleOf,
} from './common';

// US-DOC-RESTRINGIDOS-005 — Lista de documentos en la web: el consultor no ve los restringidos y lee cuántos hay ocultos (1440 px).
// Preparación de cada fila: `signIn` reinicia alumno01 (POST /api/admin/reset, 2xx comprobado) y entra con la cuenta de la fila (admin
// con el segundo factor); después se abre «Documentos» desde la barra lateral. Las ausencias se miran tras comprobar que la lista está
// cargada con su recuento (cabecera y pie) y tras una ventana de HOLD_MS; el aviso de ocultos se lee con su texto exacto y su visibilidad.

/** Recuento de la celda «recuento» (el texto va entre «…»). */
const RECUENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«12 documentos»', '12 documentos'],
  ['«8 documentos»', '8 documentos'],
]);

/** Aviso de la celda «aviso»: ausente, o presente con su texto exacto. */
interface Aviso {
  readonly presente: boolean;
  readonly texto?: string;
}

const AVISO: ReadonlyMap<string, Aviso> = new Map<string, Aviso>([
  ['no aparece', { presente: false }],
  ['aparece con el texto «4 documentos restringidos no son visibles para tu rol.»', { presente: true, texto: '4 documentos restringidos no son visibles para tu rol.' }],
]);

/** Documento de la celda «documento» de la segunda tabla. */
const DOCUMENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
  ['DOC-006', 'DOC-006'],
]);

/** «está en la lista» / «no está en la lista». */
const FILA: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['está en la lista', true],
  ['no está en la lista', false],
]);

/** Insignia de la celda «insignia» (`undefined` = «(ninguna)»: no hay fila que mirar). */
const INSIGNIA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['«Restringido»', 'Restringido'],
  ['«Público»', 'Público'],
  ['(ninguna)', undefined],
]);

/** Texto de búsqueda de la tercera tabla (se escribe tal cual). */
const TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-003', 'DOC-003'],
  ['Plan de verificación PRG-002', 'Plan de verificación PRG-002'],
  ['Especificación técnica PRG-006', 'Especificación técnica PRG-006'],
]);

/** Control positivo de la búsqueda: un título público que el consultor SÍ ve (DOC-004, único con ese texto). */
const CONTROL_PUBLICO = 'Especificación técnica PRG-002';

/** Insignia que la historia da a cada documento visible: «Restringido» para los restringidos, «Público» para el resto. */
const badgeOf = (code: string): string => (RESTRICTED.includes(code) ? 'Restringido' : 'Público');

const sameList = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && expected.every((code, index) => actual[index] === code);

// --- Esquema 1: cada rol ve el recuento de los documentos que puede ver ------------------------------------------------------------

const countsByRole: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const recuento = strict('recuento', RECUENTO, cell(row, 'recuento'));
  const aviso = strict('aviso', AVISO, cell(row, 'aviso'));
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${signed}`);
  const opened = await openDocumentsFromMenu(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const settled = await settledList(page);
  const above = await textOfLocator(subtitleAbove(page));
  const below = await textOfLocator(countBelow(page));
  const codes = await shownCodes(page);
  const visible = visibleFor(account);
  const badges: { readonly code: string; readonly seen: string | undefined }[] = [];
  for (const code of codes ?? []) {
    badges.push({ code, seen: await textOfLocator(badgeIn(rowOf(page, code))) });
  }
  const wrongBadges = badges.filter((entry) => entry.seen !== badgeOf(entry.code));
  const checks: Check[] = [
    check(settled, 'la lista se asienta con su recuento', `la lista ${settled ? 'se asienta' : 'no se asienta'} (cabecera «${above ?? '(sin leer)'}», pie «${below ?? '(sin leer)'}»)`),
    textCheck(above, recuento, 'el recuento de la cabecera dice'),
    textCheck(below, recuento, 'el recuento del pie dice'),
    check(
      sameList(codes, visible),
      `la lista muestra ${visible.length} filas (${visible.join(', ')})`,
      `la lista muestra ${codes === undefined ? '(sin leer)' : `${codes.length} filas (${codes.join(', ') || '(ninguna)'})`}`,
    ),
    check(
      badges.length > 0 && wrongBadges.length === 0,
      'cada restringido lleva la insignia «Restringido» y cada público la insignia «Público»',
      wrongBadges.length === 0 ? `las ${badges.length} insignias son las que dice la historia` : `insignias que no coinciden: ${wrongBadges.map((entry) => `${entry.code} «${entry.seen ?? '(sin leer)'}»`).join(', ')}`,
    ),
  ];
  if (aviso.presente) {
    await waitUntil(async () => (await countOf(hiddenNote(page))) === 1);
    const text = await textOfLocator(hiddenNote(page));
    const visibleNote = await visibleOf(hiddenNote(page));
    // «Encima de la tabla»: la caja del aviso acaba antes de que empiece la tabla
    const noteBox = await boxOf(hiddenNote(page));
    const tableBox = await boxOf(tableOf(page));
    const aboveTable = noteBox !== undefined && tableBox !== undefined && noteBox.y + noteBox.height <= tableBox.y;
    checks.push(textCheck(text, aviso.texto ?? '', 'el aviso de ocultos dice'));
    checks.push(seenCheck(visibleNote, 'el aviso de ocultos se ve', 'el aviso de ocultos'));
    checks.push(
      check(
        aboveTable,
        'el aviso de ocultos está encima de la tabla',
        noteBox === undefined || tableBox === undefined ? 'la posición del aviso o de la tabla no se pudo medir' : `el aviso acaba en y=${String(Math.round(noteBox.y + noteBox.height))} y la tabla empieza en y=${String(Math.round(tableBox.y))}`,
      ),
    );
  } else {
    const absence = await absenceAfterHold(hiddenNote(page));
    checks.push(check(absence === 'ausente', 'no aparece ningún aviso de ocultos', `el aviso de ocultos está ${absence}`));
  }
  return finish(checks, { evidence: { cuenta: cell(row, 'cuenta'), filasVistas: codes?.length ?? -1 } });
};

// --- Esquema 2: la clasificación de cada fila es la que se ve a cada rol -----------------------------------------------------------

const rowForRole: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const documento = strict('documento', DOCUMENTO, cell(row, 'documento'));
  const presence = strict('fila', FILA, cell(row, 'fila'));
  const insignia = strict('insignia', INSIGNIA, cell(row, 'insignia'));
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${signed}`);
  const opened = await openDocumentsFromMenu(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  const settled = await settledList(page);
  const below = await textOfLocator(countBelow(page));
  const loadedAs = `${visibleFor(account).length} documentos`;
  // Ventana tras asentar la lista: la fila puede pintarse un instante después del recuento
  await sleep(HOLD_MS);
  const target = rowOf(page, documento);
  const found = await countOf(target);
  const checks: Check[] = [check(settled && below === loadedAs, `la lista está cargada con «${loadedAs}»`, `la lista dice «${below ?? '(sin leer)'}»`)];
  if (presence) {
    checks.push(presenceCheck(found, `la fila de ${documento} está en la lista`, `la fila de ${documento}`));
    checks.push(seenCheck(await visibleOf(target), `la fila de ${documento} se ve`, `la fila de ${documento}`));
    if (insignia !== undefined) {
      const seen = await textOfLocator(badgeIn(target));
      checks.push(check(seen === insignia, `la insignia de la fila de ${documento} es «${insignia}»`, `la insignia de la fila de ${documento} es «${seen ?? '(sin leer)'}»`));
    }
  } else {
    checks.push(check(found === 0, `la fila de ${documento} no está en la lista`, found === -1 ? `la fila de ${documento} (sin leer)` : `la fila de ${documento} ${found === 0 ? 'no está' : 'aparece'} (${found} elementos)`));
  }
  // La historia no pone gestor en este Esquema: la cobertura se anota
  return finishNoted(checks, COBERTURA_GESTOR, { cuenta: cell(row, 'cuenta'), documento, filasEncontradas: found });
};

// --- Esquema 3: buscar un restringido como consultor no devuelve su fila ------------------------------------------------------------

const searchAsConsultant: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const texto = strict('texto', TEXTO, cell(row, 'texto'));
  const signed = await signIn(page, 'consultor');
  if (signed !== undefined) return preparationFailedWeb(expected, `consultor@sigpro.test no inicia sesión: ${signed}`);
  const opened = await openDocumentsFromMenu(page);
  if (opened !== undefined) return actionFailed(expected, opened);
  if (!(await settledList(page))) return preparationFailedWeb(expected, 'la lista de documentos del consultor no se asienta antes de buscar');
  // Control positivo PRIMERO: el buscador debe devolver el documento público; así «ninguna fila» no se da por bueno con un buscador roto
  const controlTyped = await runSteps([[`escribir «${CONTROL_PUBLICO}» en «Buscar documentos»`, () => searchBox(page).fill(CONTROL_PUBLICO, ACTION)]]);
  if (controlTyped !== undefined) return actionFailed(expected, controlTyped);
  await waitUntil(async () => {
    const codes = await shownCodes(page);
    return codes !== undefined && codes.length === 1 && codes[0] === 'DOC-004';
  });
  const controlCodes = await shownCodes(page);
  // Búsqueda del restringido: se espera a que el recuento cambie (si no cambia, el filtro no tuvo efecto)
  const typed = await runSteps([[`escribir «${texto}» en «Buscar documentos»`, () => searchBox(page).fill(texto, ACTION)]]);
  if (typed !== undefined) return actionFailed(expected, typed);
  await waitUntil(async () => (await textOfLocator(countBelow(page))) === '0 documentos');
  const above = await textOfLocator(subtitleAbove(page));
  const below = await textOfLocator(countBelow(page));
  const codes = await shownCodes(page);
  const value = await safe(() => searchBox(page).inputValue({ timeout: 1_000 }), undefined);
  const checks: Check[] = [
    check(
      sameList(controlCodes, ['DOC-004']),
      `con el control «${CONTROL_PUBLICO}» aparece DOC-004`,
      `con el control «${CONTROL_PUBLICO}» aparecen ${controlCodes === undefined ? '(sin leer)' : controlCodes.length === 0 ? '(ninguna fila)' : controlCodes.join(', ')}`,
    ),
    check(value === texto, `el buscador tiene el texto «${texto}»`, `el buscador tiene «${value ?? '(sin leer)'}»`),
    check(codes !== undefined && codes.length === 0, 'no ve ninguna fila de documento', codes === undefined ? 'filas (sin leer)' : codes.length === 0 ? 'no ve ninguna fila de documento' : `ve ${codes.join(', ')}`),
    textCheck(below, '0 documentos', 'el recuento dice'),
    textCheck(above, '0 documentos', 'el recuento de la cabecera dice'),
  ];
  return finish(checks, { evidence: { texto, cuenta: 'consultor@sigpro.test', control: CONTROL_PUBLICO } });
};

defineBrowserRows({
  story: 'US-DOC-RESTRINGIDOS-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(countsByRole)],
    [2, onWeb(rowForRole)],
    [3, onWeb(searchAsConsultant)],
  ]),
});
