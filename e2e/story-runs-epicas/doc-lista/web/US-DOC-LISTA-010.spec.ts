import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { isVisible, safe, waitUntil } from '../../support/browser';
import { defineBrowserRows, type BrowserFixtures, type BrowserRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import {
  delayGet,
  gotoPath,
  hasTrace,
  apiPagesOf,
  linesOf,
  sectionChildren,
  normalizedText,
  onWeb,
  signIn,
  thenOf,
  viewerError,
  viewerLoading,
  viewerPage,
  viewerPageN,
  viewerTitle,
  viewerVersion,
  finish,
  traceDependent,
} from './common';

// US-DOC-LISTA-010 — Visor de una versión en la web: página de lectura sin el menú de la aplicación. Preparación: reinicio de alumno01
// e inicio de sesión de gestor@sigpro.test; las demoras y los errores los provoca la prueba antes de abrir la página del visor.

type Page = BrowserFixtures['page'];

const DIRECCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['/documents/DOC-001/view', '/documents/DOC-001/view'],
  ['/documents/DOC-001/view?version=2', '/documents/DOC-001/view?version=2'],
  ['/documents/DOC-002/view', '/documents/DOC-002/view'],
]);

const DIRECCION_NO_ENCONTRADA: ReadonlyMap<string, string> = new Map<string, string>([
  ['/documents/DOC-013/view', '/documents/DOC-013/view'],
  ['/documents/DOC-001/view?version=9', '/documents/DOC-001/view?version=9'],
]);

const CODIGO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
]);

const VERSION: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['2', 2],
  ['1', 1],
]);

const PAGINA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
]);

const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([
  ['1 segundo', 1_000],
  ['3 segundos', 3_000],
]);

/** Textos de la cabecera del visor (sus `span` y su `p`), leídos del elemento de la cabecera. */
const headerSpans = (page: Page): Promise<readonly string[] | undefined> => safe(() => viewerPage(page).locator('header span').allInnerTexts(), undefined);

/** Número de páginas que muestra el visor (con su identificador de prueba). */
const pagesShown = (page: Page): Promise<number> => safe(() => viewerPage(page).locator('[data-testid^="viewer-page-"]').count(), -1);

/** Entra en la sesión y abre una dirección de la aplicación con la sesión guardada. */
const enter = async (page: Page, direccion: string): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return (await signIn(page, 'escritorio')) ?? (await gotoPath(page, direccion));
};

// --- Esquema 1: el visor muestra la versión pedida con su cabecera -----------------------------------------------------------------

const header: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const direccion = strict('dirección', DIRECCION, cell(row, 'direccion'));
  const codigo = strict('código', CODIGO, cell(row, 'codigo'));
  const version = strict('versión', VERSION, cell(row, 'version'));
  const failure = await enter(page, direccion);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const shown = await waitUntil(() => isVisible(viewerTitle(page)));
  const spans = (await headerSpans(page)) ?? [];
  const note = await normalizedText(viewerPage(page).locator('header p').first());
  const titleText = await normalizedText(viewerTitle(page));
  const versionText = await normalizedText(viewerVersion(page));
  return finish([
    check(shown.reached, 'el visor carga el documento', shown.reached ? 'el visor carga el documento' : 'el visor no carga el documento'),
    check(spans.includes(codigo), `el código ${codigo}`, `los textos de la cabecera son ${spans.join(' · ') || '(sin leer)'}`),
    check(versionText === `Versión ${version}`, `la versión ${version}`, `la versión «${versionText ?? '(sin leer)'}»`),
    check(spans.includes(cell(row, 'fecha')), `la fecha ${cell(row, 'fecha')}`, `la fecha no aparece entre «${spans.join(' · ') || '(sin leer)'}»`),
    check(titleText === cell(row, 'titulo'), `el título ${cell(row, 'titulo')}`, `el título «${titleText ?? '(sin leer)'}»`),
    check(note === cell(row, 'nota'), `la nota ${cell(row, 'nota')}`, `la nota «${note ?? '(sin leer)'}»`),
  ]);
});

// --- Esquema 2: cada página se titula con su número y reparte las líneas en orden ---------------------------------------------------

/** Un apartado numerado (su línea empieza por «N. ») se lee en negrita; el resto, no. */
const NUMBERED = /^\d+\. /;

const pages: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const pagina = strict('página', PAGINA, cell(row, 'pagina'));
  const failure = await enter(page, '/documents/DOC-001/view');
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const shown = await waitUntil(() => isVisible(viewerPageN(page, pagina)));
  const children = (await sectionChildren(viewerPageN(page, pagina))) ?? [];
  const body = children.slice(1);
  const lines = body.map((child) => (child.tag === 'DIV' ? '' : child.text));
  const content = lines.filter((line) => line !== '');
  // Líneas de la última versión de DOC-001 con sus huecos, tal como las sirve la API (la historia 004 fija su reparto en páginas).
  const reference = (await apiPagesOf('DOC-001'))?.[pagina - 1];
  const expectedLines = reference ?? [];
  const firstDifference = lines.findIndex((line, index) => line !== expectedLines[index]);
  const sameLayout = reference !== undefined && lines.length === expectedLines.length && firstDifference < 0;
  const boldOk = body.every((child, index) => child.tag === 'DIV' || (NUMBERED.test(expectedLines[index] ?? '') ? Number(child.weight) >= 600 : Number(child.weight) < 600));
  const layoutText = 'las líneas de la página, con sus huecos vacíos, son las de la versión';
  const boldText = 'los apartados numerados en negrita y el resto sin negrita';
  return finish(
    [
      check(shown.reached, `ve «Página ${pagina} de 2»`, shown.reached ? `ve «Página ${pagina} de 2»` : `no aparece la página ${pagina}`),
      check(children[0]?.text === `Página ${pagina} de 2`, `ve «Página ${pagina} de 2»`, `ve «${children[0]?.text ?? '(sin leer)'}»`),
      check(content[0] === cell(row, 'primera'), `con las líneas que empiezan por ${cell(row, 'primera')}`, `empieza por «${content[0] ?? '(sin leer)'}»`),
      check(content[content.length - 1] === cell(row, 'ultima'), `y acaban en ${cell(row, 'ultima')}`, `acaba en «${content[content.length - 1] ?? '(sin leer)'}»`),
      check(sameLayout, layoutText, reference === undefined ? '(sin leer la versión en la API)' : sameLayout ? layoutText : `difiere en la línea ${firstDifference + 1}: «${lines[firstDifference] ?? '(hueco)'}» frente a «${expectedLines[firstDifference] ?? '(sin línea)'}»`),
      check(boldOk, boldText, boldOk ? boldText : 'la negrita no coincide con los apartados numerados'),
    ],
    { evidence: { huecosVistos: lines.filter((line) => line === '').length } },
  );
});

// --- Esquema 3: un documento o una versión que no existen muestran el aviso de no encontrado -----------------------------------

const notFoundView: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const direccion = strict('dirección', DIRECCION_NO_ENCONTRADA, cell(row, 'direccion'));
  const failure = await enter(page, direccion);
  if (failure !== undefined) return preparationFailedWeb(expected, failure);
  const shown = await waitUntil(() => isVisible(viewerError(page)));
  const lines = (await linesOf(viewerError(page))) ?? [];
  const trace = lines.join(' · ');
  const pages = await pagesShown(page);
  // La traza de la petición es una decisión pendiente de la historia: si el resto de pasos se cumple, la fila queda pendiente.
  return traceDependent(
    expected,
    [
      check(shown.reached, 've el aviso «No se encontró el documento»', shown.reached ? 've el aviso «No se encontró el documento»' : 'no aparece el aviso de no encontrado'),
      check(lines.includes('No se encontró el documento'), 'el título «No se encontró el documento»', `el aviso dice: ${trace || '(sin leer)'}`),
      check(pages === 0, 'ninguna página', pages < 0 ? 'ninguna página (sin leer)' : `${pages} páginas`),
    ],
    hasTrace(trace === '' ? undefined : trace, 404),
    { trazaDelAviso: trace },
  );
});

// --- Esquema 4: mientras llega el contenido se ve «Cargando documento…» y después el documento -----------------------------------

const loadingThenPages: BrowserRowHandler = onWeb(async (row: ManifestRow, { page }): Promise<Outcome> => {
  const expected = thenOf(row);
  const delay = strict('espera', ESPERA, cell(row, 'espera'));
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, 'escritorio');
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  await delayGet(page, '/api/documents/DOC-002/content', delay);
  const opened = await gotoPath(page, '/documents/DOC-002/view');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const loading = await waitUntil(async () => (await normalizedText(viewerLoading(page))) === 'Cargando documento…');
  const second = await waitUntil(() => isVisible(viewerPageN(page, 2)));
  const lines = (await linesOf(viewerPageN(page, 2))) ?? [];
  return finish([
    check(loading.reached, 've «Cargando documento…» mientras espera', loading.reached ? 've «Cargando documento…» mientras espera' : 'no se ve «Cargando documento…» mientras espera'),
    check(second.reached && lines[0] === 'Página 2 de 2', 'al llegar la respuesta ve «Página 2 de 2»', `al llegar la respuesta ve «${lines[0] ?? '(sin leer)'}»`),
    check(lines[1] === 'El consultor ejecuta las pruebas.', 'con la línea «El consultor ejecuta las pruebas.» al principio', `la primera línea es «${lines[1] ?? '(sin leer)'}»`),
  ]);
});

defineBrowserRows({
  story: 'US-DOC-LISTA-010',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, header],
    [2, pages],
    [3, notFoundView],
    [4, loadingThenPages],
  ]),
});
