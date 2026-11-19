import { call, field } from '../../../story-runs/support/api';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { defineApiRows, type ApiRowHandler, type ManifestRow, type Outcome } from '../../core/framework';
import { cell, check, preparationFailed, strict, type Check } from '../../support/checks';
import { fieldIs, gestorIn, noDocumentDataCheck, numbersOf, statusCheck, thenOf, finish } from './common';

// US-DOC-LISTA-003 — Detalle de un documento por la API con su historial de versiones. Preparación: reinicio de alumno01 con su
// administrador y sesión de gestor@sigpro.test en alumno01; la petición lleva x-tenant alumno01 y el accessToken como Bearer.

/** Código de la celda de la primera tabla (los tres que citan los ejemplos). */
const CODIGO_DETALLE: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-001', 'DOC-001'],
  ['DOC-002', 'DOC-002'],
  ['DOC-003', 'DOC-003'],
]);

const PROGRAMA: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

const CLASIFICACION: ReadonlyMap<string, string> = new Map<string, string>([
  ['public', 'public'],
  ['restricted', 'restricted'],
]);

/** Versión vigente de la celda (número entero). */
const VERSION: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
]);

/** Código de la tercera tabla: exacto del tenant (las variantes en minúsculas o inexistentes no se encuentran). */
const CODIGO_EXACTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['DOC-000', 'DOC-000'],
  ['DOC-001', 'DOC-001'],
  ['DOC-012', 'DOC-012'],
  ['DOC-013', 'DOC-013'],
  ['doc-001', 'doc-001'],
]);

/** Respuesta de la tercera tabla: 404 sin datos del documento, o 200 con su título. */
interface Answer {
  readonly status: number;
  readonly code?: string;
  readonly title?: string;
}

const RESPUESTA: ReadonlyMap<string, Answer> = new Map<string, Answer>([
  ['404 document_not_found, sin datos del documento', { status: 404, code: 'document_not_found' }],
  ['200 con el título Plan de verificación PRG-001', { status: 200, title: 'Plan de verificación PRG-001' }],
  ['200 con el título Especificación técnica PRG-006', { status: 200, title: 'Especificación técnica PRG-006' }],
]);

/** Versión del historial de la segunda tabla (número). */
const VERSION_HISTORIAL: ReadonlyMap<string, number> = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
]);

/** Preparación común: reinicio de alumno01 y sesión de gestor@sigpro.test. Devuelve el accessToken o el resultado de fallo. */
const gestorReady = async (row: ManifestRow): Promise<{ readonly token: string } | { readonly failed: Outcome }> => {
  await resetTenants([TENANT_A]);
  const gestor = await gestorIn(TENANT_A);
  if (gestor.token === undefined) return { failed: preparationFailed(thenOf(row), 'gestor@sigpro.test inicia sesión en alumno01', gestor.last) };
  return { token: gestor.token };
};

/** Historial de versiones de un cuerpo de detalle (lista vacía si no lo trae). */
const versionsOf = (body: unknown): readonly Record<string, unknown>[] => {
  const versions = field(body, 'versions');
  return Array.isArray(versions) ? (versions as Record<string, unknown>[]) : [];
};

// --- Esquema 1: el detalle trae los datos del documento y sus versiones ------------------------------------------------------------

const detailData: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const id = strict('id', CODIGO_DETALLE, cell(row, 'id'));
  const programa = strict('programa', PROGRAMA, cell(row, 'programa'));
  const clasificacion = strict('clasificación', CLASIFICACION, cell(row, 'clasificacion'));
  const version = strict('versión', VERSION, cell(row, 'version'));
  const detail = await call('GET', `/documents/${id}`, { tenant: TENANT_A, token: ready.token });
  const expectedVersions = numbersOf(cell(row, 'versiones'));
  const observedVersions = versionsOf(detail.body).map((entry) => field(entry, 'version'));
  const sameVersions = observedVersions.length === expectedVersions.length && expectedVersions.every((value, index) => observedVersions[index] === value);
  return finish([
    statusCheck(detail, 200),
    fieldIs(detail.body as Record<string, unknown>, 'id', id, 'el documento'),
    fieldIs(detail.body as Record<string, unknown>, 'programCode', programa, 'del programa'),
    fieldIs(detail.body as Record<string, unknown>, 'classification', clasificacion, 'la clasificación'),
    fieldIs(detail.body as Record<string, unknown>, 'version', String(version), 'la versión'),
    fieldIs(detail.body as Record<string, unknown>, 'updatedAt', cell(row, 'actualizado'), 'updatedAt'),
    check(sameVersions, `trae las versiones ${expectedVersions.join(', ')}`, `trae las versiones ${observedVersions.map(String).join(', ') || '(ninguna)'}`),
  ]);
};

// --- Esquema 2: cada versión del historial trae su nota, su autor y su fecha de creación ------------------------------------------

const historyEntry: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const version = strict('versión', VERSION_HISTORIAL, cell(row, 'version'));
  const detail = await call('GET', '/documents/DOC-001', { tenant: TENANT_A, token: ready.token });
  const entry = versionsOf(detail.body).find((candidate) => field(candidate, 'version') === version);
  return finish([
    statusCheck(detail, 200),
    fieldIs(entry, 'note', cell(row, 'nota'), `la versión ${version} del historial tiene la nota`),
    fieldIs(entry, 'authorName', cell(row, 'autor'), 'el autor'),
    fieldIs(entry, 'createdAt', cell(row, 'creado'), 'createdAt'),
  ]);
};

// --- Esquema 3: solo se encuentra un documento por su código exacto del tenant ------------------------------------------------------

const exactCode: ApiRowHandler = async (row: ManifestRow): Promise<Outcome> => {
  const ready = await gestorReady(row);
  if ('failed' in ready) return ready.failed;
  const id = strict('id', CODIGO_EXACTO, cell(row, 'id'));
  const answer = strict('respuesta', RESPUESTA, cell(row, 'respuesta'));
  const detail = await call('GET', `/documents/${id}`, { tenant: TENANT_A, token: ready.token });
  const checks: Check[] = [statusCheck(detail, answer.status, answer.code)];
  if (answer.code !== undefined) {
    checks.push(check(field(detail.body, 'message') === answer.code, `message ${answer.code}`, `message ${String(field(detail.body, 'message'))}`));
    checks.push(noDocumentDataCheck(detail.body));
  }
  if (answer.title !== undefined) checks.push(fieldIs(detail.body as Record<string, unknown>, 'title', answer.title, 'el título'));
  return finish(checks, { evidence: { cuerpo: JSON.stringify(detail.body).slice(0, 200) } });
};

defineApiRows({
  story: 'US-DOC-LISTA-003',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, detailData],
    [2, historyEntry],
    [3, exactCode],
  ]),
});
