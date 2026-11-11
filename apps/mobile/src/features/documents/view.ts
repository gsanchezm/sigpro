// Lógica pura de Documentos: filtro por texto, versiones, paginación del contenido y clasificación de líneas.
// Sin imports de react-native: se prueba con Vitest en Node (`view.test.ts`).
import { ApiError, type DocumentDto, type DocumentVersionInfo } from '@sigpro/shared';

/** Páginas por lote del visor: al abrir una versión se ve el primer lote y cada «Cargar más» añade otro. */
export const PAGE_BATCH = 1;

/** Texto de búsqueda normalizado: sin espacios sobrantes y en minúsculas. */
export const normalizeQuery = (raw: string): string => raw.trim().toLowerCase();

/** Documentos que cumplen el texto (código o título, sin distinguir mayúsculas). Sin texto, todos. */
export const filterDocuments = (items: readonly DocumentDto[], query: string): readonly DocumentDto[] => {
  if (query === '') return items;
  return items.filter((doc) => doc.id.toLowerCase().includes(query) || doc.title.toLowerCase().includes(query));
};

/** Versiones de la más nueva a la más antigua, sin mutar la lista recibida. */
export const sortVersions = (versions: readonly DocumentVersionInfo[]): readonly DocumentVersionInfo[] => [...versions].sort((a, b) => b.version - a.version);

/** Información de una versión concreta (autor y fecha), o `null` si no existe. */
export const versionInfo = (versions: readonly DocumentVersionInfo[], version: number): DocumentVersionInfo | null =>
  versions.find((candidate) => candidate.version === version) ?? null;

export interface PageWindow {
  /** Páginas visibles: las primeras, en orden. */
  readonly shown: readonly (readonly string[])[];
  /** Quedan páginas por mostrar (botón «Cargar más»). */
  readonly hasMore: boolean;
}

/** Las primeras `requested` páginas, sin pasarse del total. */
export const pageWindow = (pages: readonly (readonly string[])[], requested: number): PageWindow => {
  const count = Math.min(pages.length, requested);
  return { shown: pages.slice(0, count), hasMore: count < pages.length };
};

/** Cuántas páginas pedir tras «Cargar más». */
export const nextRequest = (requested: number): number => requested + PAGE_BATCH;

export type LineKind = 'blank' | 'heading' | 'text';

const HEADING = /^\d+\. /;

/** Cómo se pinta una línea del documento: vacía (espacio), encabezado numerado («3. Requisitos») o texto. */
export const lineKind = (line: string): LineKind => {
  if (line === '') return 'blank';
  return HEADING.test(line) ? 'heading' : 'text';
};

export type FailureKind = 'forbidden' | 'notFound' | 'other';

/** Estado HTTP → qué mensaje mostrar. Mapa de despacho, sin `switch`. */
const FAILURE_KIND: ReadonlyMap<number, FailureKind> = new Map<number, FailureKind>([
  [403, 'forbidden'],
  [404, 'notFound'],
]);

export const failureKind = (failure: unknown): FailureKind => {
  if (!(failure instanceof ApiError)) return 'other';
  return FAILURE_KIND.get(failure.status) ?? 'other';
};
