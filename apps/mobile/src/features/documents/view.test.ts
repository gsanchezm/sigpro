import { ApiError, type DocumentDto, type DocumentVersionInfo } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { PAGE_BATCH, failureKind, filterDocuments, lineKind, nextRequest, normalizeQuery, pageWindow, sortVersions, versionInfo } from './view';

const doc = (id: string, title: string, classification: DocumentDto['classification'] = 'public'): DocumentDto => ({
  id,
  programCode: 'PRG-001',
  programName: 'Programa',
  title,
  classification,
  version: 1,
  updatedAt: '2026-10-01T10:00:00.000Z',
});

const version = (n: number, authorName: string | null = null): DocumentVersionInfo => ({
  version: n,
  note: `nota ${n}`,
  authorName,
  createdAt: `2026-10-0${n}T10:00:00.000Z`,
});

describe('filterDocuments', () => {
  const items = [doc('DOC-001', 'Plan de aseguramiento'), doc('DOC-002', 'Informe de riesgos'), doc('DOC-010', 'Acta de revisión')];

  it('busca por código o título, sin distinguir mayúsculas ni espacios sobrantes', () => {
    expect(filterDocuments(items, normalizeQuery('  doc-010 ')).map((item) => item.id)).toEqual(['DOC-010']);
    expect(filterDocuments(items, normalizeQuery('RIESGOS')).map((item) => item.id)).toEqual(['DOC-002']);
  });

  it('sin texto devuelve la lista tal cual y sin coincidencias devuelve vacío', () => {
    expect(filterDocuments(items, '')).toBe(items);
    expect(filterDocuments(items, 'nada')).toEqual([]);
  });
});

describe('sortVersions y versionInfo', () => {
  const versions = [version(1, 'Ana'), version(3), version(2, 'Luis')];

  it('ordena de la más nueva a la más antigua sin tocar la lista original', () => {
    expect(sortVersions(versions).map((v) => v.version)).toEqual([3, 2, 1]);
    expect(versions.map((v) => v.version)).toEqual([1, 3, 2]);
  });

  it('devuelve el autor y la fecha de la versión pedida, o null si no existe', () => {
    expect(versionInfo(versions, 2)?.authorName).toBe('Luis');
    expect(versionInfo(versions, 9)).toBeNull();
  });
});

describe('paginación del contenido', () => {
  const pages = [['p1'], ['p2'], ['p3'], ['p4'], ['p5']];

  it('muestra las primeras páginas pedidas y avisa si quedan más', () => {
    expect(pageWindow(pages, PAGE_BATCH)).toEqual({ shown: pages.slice(0, PAGE_BATCH), hasMore: true });
  });

  it('no se pasa del total y deja de ofrecer «Cargar más» al final', () => {
    expect(pageWindow(pages, 10)).toEqual({ shown: pages, hasMore: false });
    expect(pageWindow([], PAGE_BATCH)).toEqual({ shown: [], hasMore: false });
  });

  it('«Cargar más» pide otro lote de páginas', () => {
    expect(nextRequest(PAGE_BATCH)).toBe(PAGE_BATCH * 2);
    expect(pageWindow(pages, nextRequest(PAGE_BATCH)).shown).toHaveLength(PAGE_BATCH * 2);
  });
});

describe('lineKind', () => {
  it('distingue línea vacía, encabezado numerado y texto', () => {
    expect(lineKind('')).toBe('blank');
    expect(lineKind('3. Requisitos funcionales')).toBe('heading');
    expect(lineKind('3.1 sin espacio no es encabezado')).toBe('text');
    expect(lineKind('El sistema debe cifrar el enlace.')).toBe('text');
  });
});

describe('failureKind', () => {
  const apiError = (status: number) => new ApiError(status, { statusCode: status, error: 'x', message: 'x' }, `GET /api/documents/DOC-003 → ${status}`);

  it('403 es «sin permiso» y 404 es «no existe»; el resto, otro error', () => {
    expect(failureKind(apiError(403))).toBe('forbidden');
    expect(failureKind(apiError(404))).toBe('notFound');
    expect(failureKind(apiError(500))).toBe('other');
    expect(failureKind(new Error('red caída'))).toBe('other');
  });
});
