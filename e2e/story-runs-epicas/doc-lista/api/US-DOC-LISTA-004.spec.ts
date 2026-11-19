import { call, field } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { fieldIs, gestorIn, statusCheck, thenOf, finish } from './common';

// US-DOC-LISTA-004 — Contenido de una versión para el visor, por la API: páginas de 12 líneas, huecos tal cual y la versión que
// pide `version` (o la última). Preparación: reinicio de alumno01 con su administrador y sesión de gestor@sigpro.test en alumno01.

const CODIGO_CONTENIDO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
]);

const VERSION_CONTENIDO: ReadonlyMap<string, number> = new Map<string, number>([
  ['3', 3],
  ['1', 1],
  ['2', 2],
]);

const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['public', 'public'],
  ['restricted', 'restricted'],
]);

/** Texto de una línea de la segunda tabla: `(vacío)` es la cadena vacía (el hueco entre apartados). */
const TEXTO_LINEA: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['1. Objeto', '1. Objeto'],
  ['El auditor valida los resultados.', 'El auditor valida los resultados.'],
  ['El director técnico supervisa la ejecución.', 'El director técnico supervisa la ejecución.'],
  ['5. Anexos', '5. Anexos'],
]);

/** Petición de la tercera tabla → cadena de consulta (sin `?`) sobre DOC-001. */
const PETICION: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET /api/documents/DOC-001/content', ''],
  ['GET /api/documents/DOC-001/content?version=1', 'version=1'],
  ['GET /api/documents/DOC-001/content?version=2', 'version=2'],
  ['GET /api/documents/DOC-001/content?version=0', 'version=0'],
  ['GET /api/documents/DOC-001/content?version=4', 'version=4'],
]);

/** Respuesta de la tercera tabla: código y, si son 200, la versión, la nota y el número de páginas que se citan. */
interface Answer {
  readonly status: number;
  readonly code?: string;
  readonly version?: number;
  readonly note?: string;
  readonly pages?: number;
}

const RESPUESTA: ReadonlyMap<string, Answer> = new Map<string, Answer>([
  ['200 con la versión 3', { status: 200, version: 3 }],
  ['200 con la versión 1, la nota Versión inicial y 2 páginas', { status: 200, version: 1, note: 'Versión inicial', pages: 2 }],
  ['200 con la versión 2 y 2 páginas', { status: 200, version: 2, pages: 2 }],
  ['404 version_not_found', { status: 404, code: 'version_not_found' }],
]);

/** Código inexistente de la cuarta tabla (no existe en el tenant). */
const CODIGO_INEXISTENTE: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-000', 'DOC-000'],
  ['DOC-013', 'DOC-013'],
  ['doc-001', 'doc-001'],
]);

const numberOf = (text: string): number => {
  const value = Number(text);
  if (!Number.isInteger(value)) throw new Error(`celda sin interpretación: número «${text}»`);
  return value;
};

/** Páginas de un cuerpo de contenido (lista vacía si no trae `pages`). */
const pagesOf = (body: unknown): readonly (readonly string[])[] => {
  const pages = field(body, 'pages');
  return Array.isArray(pages) ? (pages as string[][]) : [];
};

/** Preparación común: reinicio de alumno01 y sesión de gestor@sigpro.test. Devuelve el accessToken o el resultado de fallo. */
const gestorReady = async (row: ManifestRow): Promise<{ readonly token: string } | { readonly failed: Outcome }> => {
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return { failed: preparationFailed(thenOf(row), 'gestor@sigpro.test inicia sesión en alumno01', gestor.last) };
  return { token: gestor.token };
};

// --- Esquema 1: el contenido trae la versión, su nota y su reparto en páginas ------------------------------------------------------

const contentShape: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const id = strict('id', CODIGO_CONTENIDO, cell(row, 'id'));
  const version = strict('versión', VERSION_CONTENIDO, cell(row, 'version'));
  const clasificacion = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const content = await call('GET', `/documents/${id}/content`, { tenant: TENANT_A, token: ready.token });
  const pages = pagesOf(content.body);
  const firstPage = pages[0] ?? [];
  const lastPage = pages[pages.length - 1] ?? [];
  const firstLine = firstPage[0];
  const lastLine = lastPage[lastPage.length - 1];
  return finish([
    statusCheck(content, 200),
    check(field(content.body, 'version') === version, `la versión ${version}`, `la versión ${String(field(content.body, 'version'))}`),
    fieldIs(content.body as Record<string, unknown>, 'note', cell(row, 'nota'), 'la nota'),
    fieldIs(content.body as Record<string, unknown>, 'classification', clasificacion, 'la clasificación'),
    check(pages.length === numberOf(cell(row, 'paginas')), `tiene ${cell(row, 'paginas')} páginas`, `tiene ${pages.length} páginas`),
    check(firstPage.length === numberOf(cell(row, 'lineas_1')), `con ${cell(row, 'lineas_1')} líneas en la página 1`, `con ${firstPage.length} líneas en la página 1`),
    check(lastPage.length === numberOf(cell(row, 'lineas_ultima')), `y ${cell(row, 'lineas_ultima')} en la última`, `y ${lastPage.length} en la última`),
    check(firstLine === cell(row, 'primera'), `la primera línea del documento es ${cell(row, 'primera')}`, `la primera línea del documento es ${firstLine ?? '(sin línea)'}`),
    check(lastLine === cell(row, 'ultima'), `la última es ${cell(row, 'ultima')}`, `la última es ${lastLine ?? '(sin línea)'}`),
  ]);
};

// --- Esquema 2: las líneas llegan tal cual, con sus huecos y en su página ---------------------------------------------------------

const linesAsIs: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const pageNumber = numberOf(cell(row, 'pagina'));
  const lineNumber = numberOf(cell(row, 'linea'));
  const text = strict('texto', TEXTO_LINEA, cell(row, 'texto'));
  const content = await call('GET', '/documents/DOC-001/content', { tenant: TENANT_A, token: ready.token });
  const line = pagesOf(content.body)[pageNumber - 1]?.[lineNumber - 1];
  const shown = line === undefined ? '(sin línea)' : line === '' ? '(vacío)' : line;
  return finish([
    statusCheck(content, 200),
    check(line === text, `la línea ${lineNumber} de la página ${pageNumber} es ${cell(row, 'texto')}`, `la línea ${lineNumber} de la página ${pageNumber} es ${shown}`),
  ]);
};

// --- Esquema 3: el parámetro version elige la versión; sin él se muestra la última ---------------------------------------------

const versionParameter: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const query = strict('peticion', PETICION, cell(row, 'peticion'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const content = await call('GET', '/documents/DOC-001/content', { tenant: TENANT_A, token: ready.token, ...(query === '' ? {} : { query }) });
  const checks: Check[] = [statusCheck(content, answer.status, answer.code)];
  if (answer.version !== undefined) checks.push(check(field(content.body, 'version') === answer.version, `la versión ${answer.version}`, `la versión ${String(field(content.body, 'version'))}`));
  if (answer.note !== undefined) checks.push(fieldIs(content.body as Record<string, unknown>, 'note', answer.note, 'la nota'));
  if (answer.pages !== undefined) checks.push(check(pagesOf(content.body).length === answer.pages, `${answer.pages} páginas`, `${pagesOf(content.body).length} páginas`));
  return finish(checks);
};

// --- Esquema 4: un código que no existe en el tenant responde 404 y no trae páginas ------------------------------------------------

const unknownCode: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const id = strict('id', CODIGO_INEXISTENTE, cell(row, 'id'));
  const content = await call('GET', `/documents/${id}/content`, { tenant: TENANT_A, token: ready.token });
  return finish([
    statusCheck(content, 404, 'document_not_found'),
    check(field(content.body, 'message') === 'document_not_found', 'message document_not_found', `message ${String(field(content.body, 'message'))}`),
    check(field(content.body, 'pages') === undefined, 'sin páginas', field(content.body, 'pages') === undefined ? 'sin páginas' : 'trae páginas'),
  ]);
};

defineApiRows({
  story: 'US-DOC-LISTA-004',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, contentShape],
    [2, linesAsIs],
    [3, versionParameter],
    [4, unknownCode],
  ]),
});
