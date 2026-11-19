import { call, field } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A, TENANT_B } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { boldFontOf, errorOfBytes, finish, gestorIn, isolationPrep, isPdf, pdfTexts, rawGet, thenOf, type PrepFailure, type RawResponse } from './common';

// US-DOC-LISTA-005 — Descarga de una versión como PDF por la API, con su nombre. Preparación: reinicio de alumno01 con su
// administrador y sesión de gestor@sigpro.test en alumno01; las filas de aislamiento reinician también alumno02 y publican la
// versión 4 de su DOC-001. La descarga se pide con GET crudo (cabeceras y bytes), no con el cliente JSON.

/** Petición de la primera tabla: documento y cadena de consulta. */
interface DocRequest {
  readonly id: string;
  readonly query: string;
}

const PETICION: ReadonlyMap<string, DocRequest> = new Map<string, DocRequest>([
  ['GET /api/documents/DOC-001/download', { id: 'DOC-001', query: '' }],
  ['GET /api/documents/DOC-002/download', { id: 'DOC-002', query: '' }],
  ['GET /api/documents/DOC-003/download', { id: 'DOC-003', query: '' }],
  ['GET /api/documents/DOC-001/download?version=1', { id: 'DOC-001', query: 'version=1' }],
  ['GET /api/documents/DOC-001/download?version=0', { id: 'DOC-001', query: 'version=0' }],
  ['GET /api/documents/DOC-001/download?version=4', { id: 'DOC-001', query: 'version=4' }],
  ['GET /api/documents/DOC-013/download', { id: 'DOC-013', query: '' }],
]);

/** Respuesta esperada de la primera tabla: 200 con el nombre del archivo, o 404 con su código. */
interface Answer {
  readonly status: number;
  readonly name?: string;
  readonly code?: string;
}

const RESPUESTA: ReadonlyMap<string, Answer> = new Map<string, Answer>([
  ['200 con application/pdf y el nombre DOC-001-v3.pdf', { status: 200, name: 'DOC-001-v3.pdf' }],
  ['200 con application/pdf y el nombre DOC-002-v1.pdf', { status: 200, name: 'DOC-002-v1.pdf' }],
  ['200 con application/pdf y el nombre DOC-003-v2.pdf', { status: 200, name: 'DOC-003-v2.pdf' }],
  ['200 con application/pdf y el nombre DOC-001-v1.pdf', { status: 200, name: 'DOC-001-v1.pdf' }],
  ['404 version_not_found', { status: 404, code: 'version_not_found' }],
  ['404 document_not_found', { status: 404, code: 'document_not_found' }],
]);

/** Documento de la segunda tabla (el PDF que se descarga). */
const CODIGO_PDF: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-003', 'DOC-003'],
]);

/** Tenant de la credencial de la tercera tabla. */
const TENANT_DE_CREDENCIAL: ReadonlyMap<string, string> = new Map<string, string>([
  ['el accessToken de gestor@sigpro.test en alumno01', TENANT_A],
  ['el accessToken de gestor@sigpro.test en alumno02', TENANT_B],
]);

/** Cabecera x-tenant de la tercera tabla: `undefined` = sin cabecera. */
const CABECERA: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(sin cabecera)', undefined],
  ['alumno01', TENANT_A],
  ['alumno02', TENANT_B],
]);

/** Cabecera `Content-Disposition` esperada para un nombre de archivo (formato de la API). */
const dispositionOf = (name: string): string => `attachment; filename="${name}"; filename*=UTF-8''${name}`;

/** Preparación común: reinicio de alumno01 y sesión de gestor@sigpro.test. Devuelve el accessToken o el resultado de fallo. */
const gestorReady = async (row: ManifestRow): Promise<{ readonly token: string } | { readonly failed: Outcome }> => {
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return { failed: preparationFailed(thenOf(row), 'gestor@sigpro.test inicia sesión en alumno01', gestor.last) };
  return { token: gestor.token };
};

// --- Esquema 1: la descarga entrega el PDF de la versión pedida con su nombre ---------------------------------------------------

const deliversNamedPdf: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const request = strict('petición', PETICION, cell(row, 'peticion'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const raw: RawResponse = await rawGet(`/documents/${request.id}/download`, TENANT_A, ready.token, request.query === '' ? undefined : request.query);
  const checks: Check[] = [check(raw.status === answer.status, `respuesta ${answer.status}`, `respuesta ${raw.status}`)];
  if (answer.status === 200 && answer.name !== undefined) {
    checks.push(check(raw.contentType === 'application/pdf', 'tipo application/pdf', `tipo ${raw.contentType || '(sin tipo)'}`));
    checks.push(check(raw.disposition === dispositionOf(answer.name), `el nombre ${answer.name}`, `cabecera ${raw.disposition || '(sin cabecera)'}`));
    checks.push(check(isPdf(raw.bytes), 'un PDF que empieza por %PDF- y termina por %%EOF', isPdf(raw.bytes) ? 'un PDF válido' : 'no es un PDF'));
  }
  if (answer.status === 404 && answer.code !== undefined) {
    const error = errorOfBytes(raw.bytes);
    checks.push(check(error.code === answer.code, `código ${answer.code}`, `código ${error.code ?? '(sin código)'}`));
    checks.push(check(!isPdf(raw.bytes), 'sin PDF', isPdf(raw.bytes) ? 'trae un PDF' : 'sin PDF'));
    if (answer.code === 'document_not_found') checks.push(check(error.message === 'document_not_found', 'message document_not_found', `message ${error.message ?? '(sin message)'}`));
  }
  return finish(checks, { evidence: { disposition: raw.disposition, tipo: raw.contentType, bytes: raw.bytes.length } });
};

// --- Esquema 2: el PDF empieza por su título y por la línea de identificación del documento ----------------------------------

const startsWithTitle: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const id = strict('id', CODIGO_PDF, cell(row, 'id'));
  const raw = await rawGet(`/documents/${id}/download`, TENANT_A, ready.token);
  const texts = pdfTexts(raw.bytes);
  const first = texts[0];
  const second = texts[1];
  // Las líneas de la versión (la última, como la descarga) tal cual y en orden; un hueco es una línea en blanco que el PDF dibuja como espacio.
  const content = await call('GET', `/documents/${id}/content`, { tenant: TENANT_A, token: ready.token });
  const pagesValue = field(content.body, 'pages');
  const versionLines = Array.isArray(pagesValue) ? (pagesValue as string[][]).flat() : undefined;
  const expectedLines = (versionLines ?? []).map((line) => (line === '' ? ' ' : line));
  const bodyLines = texts.slice(2, -1).map((entry) => entry.text);
  const firstDifference = bodyLines.findIndex((text, index) => text !== expectedLines[index]);
  const sameBody = versionLines !== undefined && bodyLines.length === expectedLines.length && firstDifference < 0;
  const footer = texts[texts.length - 1]?.text;
  const footerExpected = `SIGPRO · ${cell(row, 'titulo')} · Página 1 de 1`;
  const bold = boldFontOf(raw.bytes);
  const bodyText = 'después van las líneas de la versión, tal cual y en orden';
  return finish([
    check(raw.status === 200 && isPdf(raw.bytes), 'un PDF que empieza por %PDF-', raw.status === 200 && isPdf(raw.bytes) ? 'un PDF que empieza por %PDF-' : `respuesta ${raw.status} sin PDF`),
    check(first?.text === cell(row, 'titulo') && first.font === 'F2' && bold, `su primer texto es ${cell(row, 'titulo')}, en negrita (Helvetica-Bold)`, `su primer texto es ${first?.text ?? '(sin texto)'}, con la fuente ${first?.font ?? '(sin fuente)'}${bold ? ' Helvetica-Bold' : ' sin Helvetica-Bold'}`),
    check(second?.text === cell(row, 'identificacion'), `su segundo texto es ${cell(row, 'identificacion')}`, `su segundo texto es ${second?.text ?? '(sin texto)'}`),
    check(sameBody, bodyText, sameBody ? bodyText : versionLines === undefined ? '(sin leer las líneas de la versión en la API)' : `${bodyLines.length} líneas en el PDF y ${expectedLines.length} en la versión; primera diferencia en la línea ${firstDifference + 1}: «${bodyLines[firstDifference] ?? '(sin línea)'}» frente a «${expectedLines[firstDifference] ?? '(sin línea)'}»`),
    check(footer === footerExpected, `el pie ${footerExpected}`, `el pie es «${footer ?? '(sin texto)'}»`),
  ]);
};

// --- Esquema 3: cada tenant descarga su propia versión, aunque la cabecera x-tenant diga otra cosa ------------------------------

const ownVersion: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const tenantOfCredential = strict('credencial', TENANT_DE_CREDENCIAL, cell(row, 'credencial'));
  const header = strict('cabecera', CABECERA, cell(row, 'cabecera'));
  const failure: PrepFailure | undefined = await isolationPrep();
  if (failure !== undefined) return preparationFailed(expected, failure.step, failure.result);
  const owner = await gestorIn(tenantOfCredential);
  if (owner.token === undefined) return preparationFailed(expected, `gestor@sigpro.test inicia sesión en ${tenantOfCredential}`, owner.last);
  const raw = await rawGet('/documents/DOC-001/download', header, owner.token);
  return finish(
    [
      check(raw.status === 200, 'respuesta 200', `respuesta ${raw.status}`),
      check(raw.disposition === dispositionOf(cell(row, 'nombre')), `la respuesta tiene el nombre ${cell(row, 'nombre')}`, `cabecera ${raw.disposition || '(sin cabecera)'}`),
    ],
    { evidence: { tenantDelToken: tenantOfCredential, cabecera: header ?? '(sin cabecera)' } },
  );
};

defineApiRows({
  story: 'US-DOC-LISTA-005',
  surface: 'api',
  tenants: [TENANT_A, TENANT_B],
  handlers: new Map<number, ApiRowHandler>([
    [1, deliversNamedPdf],
    [2, startsWithTitle],
    [3, ownVersion],
  ]),
});
