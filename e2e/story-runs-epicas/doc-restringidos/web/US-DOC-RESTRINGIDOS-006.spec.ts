import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { CUENTA, TENANT_A, finish, thenOf } from '../api/common';
import {
  actionFailed,
  anyViewerPage,
  backLink,
  buttonCheck,
  buttonStateOf,
  countOf,
  detailBadge,
  detailBox,
  detailTitle,
  downloadButton,
  forbiddenBox,
  gotoRoute,
  onWeb,
  publishButton,
  seenCheck,
  selectedOptionText,
  signIn,
  textCheck,
  textOfLocator,
  versionSelect,
  versionsList,
  viewerClass,
  viewerError,
  viewerPageOne,
  viewerTitle,
  viewerVersion,
  visibleOf,
} from './common';

// US-DOC-RESTRINGIDOS-006 — Ficha y visor de un restringido en la web: aviso «No tienes permiso» o documento con su marca (1440 px).
// Preparación de cada fila: `signIn` reinicia alumno01 (POST /api/admin/reset, 2xx comprobado) y entra con la cuenta de la fila (admin
// con el segundo factor); en la misma pestaña se abre la ruta de la fila (carga completa: la sesión guardada se recupera).
// Cada elemento cuenta solo si se VE; los botones se leen con su estado efectivo (visible, habilitado y recibiendo el clic).
// La línea técnica que muestra la página bajo el aviso (la traza de la petición) va a la evidencia y a la nota: nunca decide el veredicto.

const FORBIDDEN_TITLE = 'No tienes permiso para ver este documento';
const FORBIDDEN_BODY = 'Los documentos restringidos solo los ven admin, gestores de programa y auditores.';
const BACK = 'Volver a Documentos';
/** Título del documento restringido DOC-003 (seed) y del público DOC-004. */
const TITLE_RESTRICTED = 'Plan de verificación PRG-002';
const TITLE_PUBLIC = 'Especificación técnica PRG-002';
/** Líneas del cuerpo del seed de DOC-003 (lo que un visor con contenido mostraría). */
const CONTENT_LINES: readonly string[] = ['1. Objeto', 'Este documento define el alcance de la verificación del sistema.'];
const TRACE_NOTE =
  'La línea técnica bajo el aviso (la traza de la petición) no decide el veredicto: la historia la deja en «Decisiones pendientes» (README «Detalle técnico visible»); se anota en la evidencia.';

/** Ruta de la celda «ruta». */
const RUTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['/documents/DOC-003', '/documents/DOC-003'],
  ['/documents/DOC-003/view', '/documents/DOC-003/view'],
  ['/documents/DOC-004', '/documents/DOC-004'],
]);

/** Tipo de comprobación de cada texto de la celda «resultado» (cada texto nombra lo que debe verse). */
type Vista = 'ficha-denegada' | 'visor-denegado' | 'ficha-publica' | 'ficha-restringida' | 'visor-restringido' | 'ficha-auditor';

const RESULTADO: ReadonlyMap<string, Vista> = new Map<string, Vista>([
  ['el título «No tienes permiso para ver este documento», el texto «Los documentos restringidos solo los ven admin, gestores de programa y auditores.» y el enlace «Volver a Documentos», y no ve el título del documento', 'ficha-denegada'],
  ['el mismo título y el mismo texto, y no ve ningún contenido del documento', 'visor-denegado'],
  ['el título «Especificación técnica PRG-002» con la insignia «Público»', 'ficha-publica'],
  ['el título «Plan de verificación PRG-002», la insignia «Restringido» y el selector de versión en «Versión 2 (última)»', 'ficha-restringida'],
  ['el título «Plan de verificación PRG-002», la insignia «Restringido» y «Versión 2»', 'visor-restringido'],
  ['el título «Plan de verificación PRG-002», la insignia «Restringido» y el botón «Publicar nueva versión» deshabilitado', 'ficha-auditor'],
]);

/** Resultado de una verificación de pantalla: sus comprobaciones y, si lo hay, la línea técnica que muestra (solo evidencia y nota). */
interface Verification {
  readonly checks: readonly Check[];
  readonly trace?: string;
}

/** Resultado de la fila: lo que difiere (si difiere) y la línea técnica en la nota y la evidencia; la línea no decide el veredicto. */
const concluded = (verification: Verification, cuenta: string, ruta: string): Outcome => {
  const differences = verification.checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  const notes = [differences.length > 0 ? `Difiere en: ${differences.join('; ')}` : undefined, verification.trace === undefined ? undefined : TRACE_NOTE].filter(
    (text): text is string => text !== undefined,
  );
  return finish(verification.checks, {
    ...(notes.length === 0 ? {} : { note: notes.join(' · ') }),
    evidence: { cuenta, ruta, traza: verification.trace ?? '(sin línea técnica)' },
  });
};

/** Espera a que el elemento se vea (su propio marcador de pantalla) y devuelve la visibilidad medida al final (`undefined` = no leída). */
const waitVisible = async (target: Locator): Promise<boolean | undefined> => {
  await waitUntil(async () => (await visibleOf(target)) === true);
  return visibleOf(target);
};

/** Ausencias de la ficha denegada: ni título del documento, ni versiones, ni selector, ni descarga, ni publicación. */
const absencesOnDetail = async (page: Page): Promise<Check[]> => {
  const counts: readonly (readonly [string, number])[] = [
    ['el título del documento', await countOf(page.getByText(TITLE_RESTRICTED, { exact: false }))],
    ['sus versiones', await countOf(versionsList(page))],
    ['el selector de versión', await countOf(versionSelect(page))],
    ['el botón «Descargar PDF»', await countOf(downloadButton(page))],
    ['el botón «Publicar nueva versión»', await countOf(publishButton(page))],
  ];
  return counts.map(([label, count]) => check(count === 0, `no ve ${label}`, count === 0 ? `no ve ${label}` : count === -1 ? `${label} (sin leer)` : `ve ${label}`));
};

/** Ficha denegada (consultor en /documents/DOC-003): aviso visible, texto, enlace de vuelta visible y ausencias. */
const deniedDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(forbiddenBox(page));
  const heading = forbiddenBox(page).getByRole('heading', { name: FORBIDDEN_TITLE, exact: true });
  const headingCount = await countOf(heading);
  const headingSeen = await visibleOf(heading);
  const body = await textOfLocator(forbiddenBox(page).locator('p').first());
  const back = await textOfLocator(backLink(page));
  const backSeen = await visibleOf(backLink(page));
  const trace = await textOfLocator(forbiddenBox(page).locator('.trace'));
  return {
    checks: [
      seenCheck(seen, `el aviso «${FORBIDDEN_TITLE}» se ve`, 'el aviso'),
      check(headingCount === 1 && headingSeen === true, `el título «${FORBIDDEN_TITLE}» se ve`, `hay ${headingCount} encabezado(s) con ese título${headingSeen === true ? ', visible' : ''}`),
      textCheck(body, FORBIDDEN_BODY, 'el texto dice'),
      textCheck(back, BACK, 'el enlace dice'),
      seenCheck(backSeen, `el enlace «${BACK}» se ve`, 'el enlace de vuelta'),
      ...(await absencesOnDetail(page)),
    ],
    trace,
  };
};

/** Visor denegado (consultor en /documents/DOC-003/view): mismo título y texto visibles, y ningún contenido del documento. */
const deniedViewer = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(viewerError(page));
  const heading = viewerError(page).getByRole('heading', { name: FORBIDDEN_TITLE, exact: true });
  const headingCount = await countOf(heading);
  const headingSeen = await visibleOf(heading);
  const body = await textOfLocator(viewerError(page).locator('p').first());
  const trace = await textOfLocator(viewerError(page).locator('.trace'));
  const titleNodes = await countOf(page.getByText(TITLE_RESTRICTED, { exact: false }));
  const titleBox = await countOf(viewerTitle(page));
  const firstPage = await countOf(viewerPageOne(page));
  const anyPage = await countOf(anyViewerPage(page));
  const lineCounts: readonly number[] = await Promise.all(CONTENT_LINES.map((line) => countOf(page.getByText(line, { exact: true }))));
  const lineAbsent = lineCounts.every((count) => count === 0);
  return {
    checks: [
      seenCheck(seen, `el aviso «${FORBIDDEN_TITLE}» se ve`, 'el aviso del visor'),
      check(headingCount === 1 && headingSeen === true, `el título «${FORBIDDEN_TITLE}» se ve`, `hay ${headingCount} encabezado(s) con ese título${headingSeen === true ? ', visible' : ''}`),
      textCheck(body, FORBIDDEN_BODY, 'el texto dice'),
      check(titleNodes === 0 && titleBox === 0, `no ve el título «${TITLE_RESTRICTED}»`, titleNodes === 0 && titleBox === 0 ? `no ve el título «${TITLE_RESTRICTED}»` : `ve el título (${titleNodes}/${titleBox})`),
      check(firstPage === 0 && anyPage === 0, 'no ve ninguna página del contenido (viewer-page-N)', `páginas del visor: ${firstPage === -1 || anyPage === -1 ? '(sin leer)' : anyPage}`),
      check(lineAbsent, 'no ve líneas del contenido del documento', lineAbsent ? 'no ve líneas del contenido del documento' : `líneas del contenido visibles (${lineCounts.join(', ')})`),
    ],
    trace,
  };
};

/** Ficha pública (consultor en /documents/DOC-004): título y insignia «Público» visibles. */
const publicDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  return {
    checks: [seenCheck(seen, 'la ficha del documento se ve', 'la ficha'), textCheck(title, TITLE_PUBLIC, 'el título es'), textCheck(badge, 'Público', 'la insignia es')],
  };
};

/** Ficha de un restringido con el permiso (admin y gestor): título, insignia, versión «Versión 2 (última)» y publicar habilitado. */
const restrictedDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const selected = await selectedOptionText(versionSelect(page));
  const publish = await buttonStateOf(publishButton(page));
  return {
    checks: [
      seenCheck(seen, 'la ficha del documento se ve', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      textCheck(selected, 'Versión 2 (última)', 'el selector de versión está en'),
      buttonCheck(publish, 'habilitado', 'Publicar nueva versión'),
    ],
  };
};

/** Visor de un restringido con permiso: título, insignia «Restringido» y «Versión 2», visibles. */
const restrictedViewer = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(viewerTitle(page));
  const title = await textOfLocator(viewerTitle(page));
  const badge = await textOfLocator(viewerClass(page));
  const version = await textOfLocator(viewerVersion(page));
  return {
    checks: [
      seenCheck(seen, 'el encabezado del visor se ve', 'el visor'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      textCheck(version, 'Versión 2', 'la versión es'),
    ],
  };
};

/** Ficha del restringido para el auditor: título, insignia y «Publicar nueva versión» visible y deshabilitado. */
const auditorDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitVisible(detailBox(page));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const publish = await buttonStateOf(publishButton(page));
  return {
    checks: [
      seenCheck(seen, 'la ficha del documento se ve', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      buttonCheck(publish, 'deshabilitado', 'Publicar nueva versión'),
    ],
  };
};

/** Verificación que corresponde a cada tipo de vista (la celda «resultado» decide cuál). */
const VERIFY: ReadonlyMap<Vista, (page: Page) => Promise<Verification>> = new Map<Vista, (page: Page) => Promise<Verification>>([
  ['ficha-denegada', deniedDetail],
  ['visor-denegado', deniedViewer],
  ['ficha-publica', publicDetail],
  ['ficha-restringida', restrictedDetail],
  ['visor-restringido', restrictedViewer],
  ['ficha-auditor', auditorDetail],
]);

// --- Esquema 1: la ficha y el visor de un restringido se abren solo a quien tiene el permiso -----------------------------------

const detailOrViewer: BrowserRowHandler = async (row: ManifestRow, { page }) => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const ruta = strict('ruta', RUTA, cell(row, 'ruta'));
  const vista = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const signed = await signIn(page, account);
  if (signed !== undefined) return preparationFailedWeb(expected, `${cell(row, 'cuenta')} no inicia sesión: ${signed}`);
  const navigated = await gotoRoute(page, ruta);
  if (navigated !== undefined) return actionFailed(expected, navigated);
  const verify = VERIFY.get(vista);
  if (verify === undefined) throw new Error(`celda sin interpretación: vista «${vista}»`);
  return concluded(await verify(page), cell(row, 'cuenta'), ruta);
};

defineBrowserRows({
  story: 'US-DOC-RESTRINGIDOS-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, onWeb(detailOrViewer)]]),
});
