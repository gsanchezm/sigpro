import { defineApiRows, pending, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict } from '../../support/checks';
import { CUENTA, TENANT_A, answerCheck, codeOf, expectationChecks, filenameOf, finish, isPdf, jsonOf, noDataCheck, pdfTexts, rawGet, resetTenants, sessionFor, thenOf, type Expected } from './common';

// US-DOC-RESTRINGIDOS-002 — Ficha, contenido y descarga de un restringido por la API según el permiso. Preparación de cada fila:
// reinicio de alumno01 con su administrador y, después, la cuenta de la fila inicia sesión en alumno01 (admin con el segundo factor).
// Las descargas se piden en crudo (cabeceras y bytes) para leer el nombre del archivo y la línea de cabecera del PDF.

/** Petición de la primera tabla → ruta de la API (la cabecera `x-tenant` la pone el cliente crudo). */
const PETICION: ReadonlyMap<string, string> = new Map<string, string>([
  ['GET /api/documents/DOC-003', '/documents/DOC-003'],
  ['GET /api/documents/DOC-003/content', '/documents/DOC-003/content'],
  ['GET /api/documents/DOC-003/download', '/documents/DOC-003/download'],
  ['GET /api/documents/DOC-004', '/documents/DOC-004'],
]);

/** Respuesta esperada de la primera tabla, con lo que la historia dice de su cuerpo. */
const RESPUESTA: ReadonlyMap<string, Expected> = new Map<string, Expected>([
  ['200 con classification restricted, version 2 y dos versiones', { status: 200, classification: 'restricted', version: 2, versions: [1, 2] }],
  ['200 con la versión 2 y sus páginas', { status: 200, version: 2, pages: true }],
  ['200 con un PDF llamado DOC-003-v2.pdf', { status: 200, file: 'DOC-003-v2.pdf' }],
  ['200 con classification restricted', { status: 200, classification: 'restricted' }],
  ['403 forbidden, sin datos del documento', { status: 403, code: 'forbidden', sinDatos: true }],
  ['403 forbidden, sin PDF', { status: 403, code: 'forbidden', sinDatos: true }],
  ['200 con classification public', { status: 200, classification: 'public' }],
]);

/** Documento de la descarga de la segunda tabla. */
const DOCUMENTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-003', 'DOC-003'],
  ['DOC-001', 'DOC-001'],
]);

/** Nombre del archivo que la historia da para la descarga. */
const NOMBRE: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-003-v2.pdf', 'DOC-003-v2.pdf'],
  ['DOC-001-v3.pdf', 'DOC-001-v3.pdf'],
]);

/** Marca de la línea de cabecera del PDF (el texto de la historia va entre «…»). */
const MARCA: ReadonlyMap<string, string> = new Map<string, string>([
  ['«RESTRINGIDO»', 'RESTRINGIDO'],
  ['«PÚBLICO»', 'PÚBLICO'],
]);

// --- Esquema 1: la ficha, el contenido y la descarga siguen el permiso del rol ----------------------------------------------------

const byPermission: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  const path = strict('petición', PETICION, cell(row, 'peticion'));
  const respuesta = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  await resetTenants([TENANT_A]);
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  const raw = await rawGet(path, session.token);
  const evidence = { cuenta: cell(row, 'cuenta'), peticion: cell(row, 'peticion'), estado: raw.status };
  // Decisión pendiente (002, «Decisiones pendientes»): ante un restringido que existe, 403 o 404 están abiertos. Con 403 o 404 y sin
  // datos del documento la fila no juzga el código (pending); una fuga de datos o cualquier otro estado discrepa.
  if (respuesta.sinDatos === true) {
    const noData = noDataCheck(raw);
    if (noData.ok && (raw.status === 403 || raw.status === 404)) {
      const code = codeOf(jsonOf(raw.bytes));
      // Lo medido sobre el PDF: cabecera de tipo y cuerpo (sin «%PDF-» = no hay PDF; la descarga pide que no se devuelva)
      const type = raw.contentType === '' ? '(sin cabecera Content-Type)' : raw.contentType;
      const pdf = raw.contentType.startsWith('application/pdf') || isPdf(raw.bytes) ? 'se devuelve un PDF' : 'no se devuelve un PDF';
      return pending(
        expected,
        `respuesta ${raw.status}${code === undefined ? '' : ` ${code}`}, sin datos del documento; ${pdf} (Content-Type ${type}; cuerpo ${isPdf(raw.bytes) ? 'con %PDF-' : 'sin %PDF-'})`,
        'Decisión pendiente en 002.md («Decisiones pendientes»): si un restringido que existe debe responder 404 document_not_found en lugar de 403. Hoy responde 403; la fila no juzga el código, solo que no entregue datos del documento.',
        evidence,
      );
    }
  }
  return finish(expectationChecks(raw, respuesta), { evidence });
};

// --- Esquema 2: la cabecera del PDF marca la clasificación del documento ------------------------------------------------------

const headerMark: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const documento = strict('documento', DOCUMENTO, cell(row, 'documento'));
  const nombre = strict('nombre', NOMBRE, cell(row, 'nombre'));
  const marca = strict('marca', MARCA, cell(row, 'marca'));
  await resetTenants([TENANT_A]);
  const session = await sessionFor('admin');
  if (session.token === undefined) return preparationFailed(expected, 'admin@sigpro.test inicia sesión en alumno01 (segundo factor)', session.last);
  const raw = await rawGet(`/documents/${documento}/download`, session.token);
  // La línea de cabecera es la que empieza por el código del documento («DOC-003 · Programa PRG-002 · Versión 2 · RESTRINGIDO»)
  const header = pdfTexts(raw.bytes).find((entry) => entry.text.startsWith(`${documento} · Programa `));
  const parts = header?.text.split(' · ') ?? [];
  const observedMark = parts.length > 0 ? parts[parts.length - 1] : undefined;
  const observedName = filenameOf(raw.disposition);
  return finish(
    [
      answerCheck(raw.status, codeOf(jsonOf(raw.bytes)), { status: 200 }),
      check(raw.contentType.startsWith('application/pdf') && isPdf(raw.bytes), 'un PDF completo (empieza por %PDF- y termina por %%EOF)', isPdf(raw.bytes) ? 'un PDF completo' : 'no es un PDF completo'),
      check(observedName === nombre, `el archivo se llama ${nombre}`, `el archivo se llama ${observedName ?? '(sin nombre)'}`),
      check(observedMark === marca, `su línea de cabecera dice ${marca}`, header === undefined ? `sin línea de cabecera de ${documento}` : `su línea de cabecera dice ${observedMark ?? '(sin marca)'}`),
    ],
    { evidence: { cuenta: 'admin@sigpro.test', documento, cabecera: header?.text ?? '(no encontrada)' } },
  );
};

// --- Esquema 3: un código que no existe responde 404 a cualquier rol ------------------------------------------------------------

const unknownDocument: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const expected = thenOf(row);
  const account = strict('cuenta', CUENTA, cell(row, 'cuenta'));
  await resetTenants([TENANT_A]);
  const session = await sessionFor(account);
  if (session.token === undefined) return preparationFailed(expected, `${cell(row, 'cuenta')} inicia sesión en alumno01`, session.last);
  // «Cuando pide GET /api/documents/DOC-999»: el código no existe en el tenant (la historia lo fija en el paso, no en una celda)
  const raw = await rawGet('/documents/DOC-999', session.token);
  return finish([answerCheck(raw.status, codeOf(jsonOf(raw.bytes)), { status: 404, code: 'document_not_found' })], { evidence: { cuenta: cell(row, 'cuenta'), estado: raw.status } });
};

defineApiRows({
  story: 'US-DOC-RESTRINGIDOS-002',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, byPermission],
    [2, headerMark],
    [3, unknownDocument],
  ]),
});
