import type { Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { CUENTA, TENANT_A, finish, thenOf } from '../api/common';
import {
  actionFailed,
  backLink,
  countOf,
  detailBadge,
  detailBox,
  detailTitle,
  downloadButton,
  enabledOf,
  forbiddenBox,
  gotoRoute,
  onWeb,
  presenceCheck,
  publishButton,
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
} from './common';

// US-DOC-RESTRINGIDOS-006 — Ficha y visor de un restringido en la web: aviso «No tienes permiso» o documento con su marca (1440 px).
// Preparación de cada fila: el arnés reinicia alumno01; la cuenta de la fila inicia sesión en /login?tenant=alumno01 (admin con el
// segundo factor) y, en la misma pestaña, se abre la ruta de la fila (carga completa: la sesión guardada se recupera).
// La línea técnica que muestra la página bajo el aviso de «No tienes permiso» (la traza de la petición) va a la evidencia y a la nota:
// nunca decide el veredicto (README «Detalle técnico visible»).

const FORBIDDEN_TITLE = 'No tienes permiso para ver este documento';
const FORBIDDEN_BODY = 'Los documentos restringidos solo los ven admin, gestores de programa y auditores.';
const BACK = 'Volver a Documentos';
/** Título del documento restringido DOC-003 (seed) y del público DOC-004. */
const TITLE_RESTRICTED = 'Plan de verificación PRG-002';
const TITLE_PUBLIC = 'Especificación técnica PRG-002';
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

/** Resultado de una verificación de pantalla: sus comprobaciones y, si lo hay, la línea técnica que muestra (solo para la evidencia). */
interface Verification {
  readonly checks: readonly Check[];
  readonly trace?: string;
}

/** Resultado de la fila: lo que difiere (si difiere) y la línea técnica en la nota y la evidencia; la línea no decide el veredicto. */
const concluded = (verification: Verification, cuenta: string, ruta: string): Outcome => {
  const differences = verification.checks.filter((entry) => !entry.ok).map((entry) => `«${entry.expected}» no se cumple (${entry.observed})`);
  const notes = [differences.length > 0 ? `Difiere en: ${differences.join('; ')}` : undefined, verification.trace === undefined ? undefined : TRACE_NOTE].filter((text): text is string => text !== undefined);
  return finish(verification.checks, {
    ...(notes.length === 0 ? {} : { note: notes.join(' · ') }),
    evidence: { cuenta, ruta, traza: verification.trace ?? '(sin línea técnica)' },
  });
};

/** Espera a que aparezca el elemento de la pantalla (su propio marcador) y devuelve el recuento medido al final. */
const waitFor = async (target: () => Promise<number>): Promise<number> => {
  await waitUntil(async () => (await target()) === 1);
  return target();
};

/** Ausencias de la ficha denegada: ni versiones, ni selector, ni descarga, ni publicación, ni título del documento. */
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

/** Ficha denegada (consultor en /documents/DOC-003): aviso, texto, enlace de vuelta y ausencias. */
const deniedDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(forbiddenBox(page)));
  const heading = await countOf(forbiddenBox(page).getByRole('heading', { name: FORBIDDEN_TITLE, exact: true }));
  const body = await textOfLocator(forbiddenBox(page).locator('p').first());
  const back = await textOfLocator(backLink(page));
  const trace = await textOfLocator(forbiddenBox(page).locator('.trace'));
  return {
    checks: [
      presenceCheck(seen, `el aviso «${FORBIDDEN_TITLE}»`, 'el aviso'),
      check(heading === 1, `el título «${FORBIDDEN_TITLE}»`, `hay ${heading} encabezado(s) con ese título`),
      textCheck(body, FORBIDDEN_BODY, 'el texto dice'),
      textCheck(back, BACK, 'el enlace dice'),
      ...(await absencesOnDetail(page)),
    ],
    trace,
  };
};

/** Visor denegado (consultor en /documents/DOC-003/view): mismo título y texto, y ningún contenido. */
const deniedViewer = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(viewerError(page)));
  const heading = await countOf(viewerError(page).getByRole('heading', { name: FORBIDDEN_TITLE, exact: true }));
  const body = await textOfLocator(viewerError(page).locator('p').first());
  const trace = await textOfLocator(viewerError(page).locator('.trace'));
  const titleNodes = await countOf(page.getByText(TITLE_RESTRICTED, { exact: false }));
  const firstPage = await countOf(viewerPageOne(page));
  const titleBox = await countOf(viewerTitle(page));
  return {
    checks: [
      presenceCheck(seen, `el aviso «${FORBIDDEN_TITLE}»`, 'el aviso del visor'),
      check(heading === 1, `el título «${FORBIDDEN_TITLE}»`, `hay ${heading} encabezado(s) con ese título`),
      textCheck(body, FORBIDDEN_BODY, 'el texto dice'),
      check(titleNodes === 0 && titleBox === 0, `no ve el título «${TITLE_RESTRICTED}»`, titleNodes === 0 && titleBox === 0 ? `no ve el título «${TITLE_RESTRICTED}»` : `ve el título (${titleNodes}/${titleBox})`),
      check(firstPage === 0, 'no ve ningún contenido del documento (sin páginas)', firstPage === 0 ? 'no ve ningún contenido del documento' : `ve contenido (${firstPage})`),
    ],
    trace,
  };
};

/** Ficha pública (consultor en /documents/DOC-004): título y insignia «Público». */
const publicDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(detailBox(page)));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  return {
    checks: [
      presenceCheck(seen, 'la ficha del documento', 'la ficha'),
      textCheck(title, TITLE_PUBLIC, 'el título es'),
      textCheck(badge, 'Público', 'la insignia es'),
    ],
  };
};

/** Ficha de un restringido con el permiso (admin y gestor): título, insignia, versión «Versión 2 (última)» y publicar habilitado. */
const restrictedDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(detailBox(page)));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const selected = await selectedOptionText(versionSelect(page));
  const publish = await enabledOf(publishButton(page));
  return {
    checks: [
      presenceCheck(seen, 'la ficha del documento', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      textCheck(selected, 'Versión 2 (última)', 'el selector de versión está en'),
      check(publish === true, '«Publicar nueva versión» está habilitado', `«Publicar nueva versión» está ${publish === undefined ? '(sin leer)' : publish ? 'habilitado' : 'deshabilitado'}`),
    ],
  };
};

/** Visor de un restringido con permiso: título, insignia «Restringido» y «Versión 2». */
const restrictedViewer = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(viewerTitle(page)));
  const title = await textOfLocator(viewerTitle(page));
  const badge = await textOfLocator(viewerClass(page));
  const version = await textOfLocator(viewerVersion(page));
  return {
    checks: [
      presenceCheck(seen, 'el encabezado del visor', 'el visor'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      textCheck(version, 'Versión 2', 'la versión es'),
    ],
  };
};

/** Ficha del restringido para el auditor: título, insignia y «Publicar nueva versión» deshabilitado. */
const auditorDetail = async (page: Page): Promise<Verification> => {
  const seen = await waitFor(() => countOf(detailBox(page)));
  const title = await textOfLocator(detailTitle(page));
  const badge = await textOfLocator(detailBadge(page));
  const publish = await enabledOf(publishButton(page));
  return {
    checks: [
      presenceCheck(seen, 'la ficha del documento', 'la ficha'),
      textCheck(title, TITLE_RESTRICTED, 'el título es'),
      textCheck(badge, 'Restringido', 'la insignia es'),
      check(publish === false, '«Publicar nueva versión» está deshabilitado', `«Publicar nueva versión» está ${publish === undefined ? '(sin leer)' : publish ? 'habilitado' : 'deshabilitado'}`),
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
