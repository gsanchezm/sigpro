// Render de una historia o épica ya leída a un borrador de issue de GitHub, y lectura de vuelta de la marca de
// identidad que lleva el cuerpo. Es puro: la sincronización (Tarea 6) decide qué hacer con el borrador.
import type { StoryFile } from './model';

/** Lo que se publica en GitHub por cada archivo: `epicId` es la épica padre de una historia (`null` en una épica). */
export type IssueDraft = {
  id: string;
  kind: 'epic' | 'story';
  title: string;
  body: string;
  labels: readonly string[];
  epicId: string | null;
};

/** Parte común del front matter de épicas e historias que el borrador necesita. */
type Heading = { readonly id: string; readonly titulo: string; readonly etiquetas: readonly string[] };

/** Comentario HTML invisible con el que la sincronización reconoce sus issues: `<!-- sigpro-story-id: US-LOGIN-003 -->`. */
export const storyMarker = (id: string): string => `<!-- sigpro-story-id: ${id} -->`;

/**
 * Lee el id de la primera marca del cuerpo. Tolera espacios de más y el id solo admite el alfabeto de los
 * ids de épica e historia. Con varias marcas manda la primera: es la que escribe `renderIssue`, y un texto
 * posterior que cite otra marca no la desplaza.
 */
const MARKER_PATTERN = /<!--\s*sigpro-story-id:\s*([A-Z0-9-]+)\s*-->/;

/** Id guardado en la marca del cuerpo de un issue, o `null` si el cuerpo no la tiene. */
export const markerOf = (body: string): string | null => MARKER_PATTERN.exec(body)?.[1] ?? null;

/** Línea visible bajo la marca: `**Id:** US-LOGIN-003 · **Épica:** EP-LOGIN` (una épica no lleva `Épica`). */
const visibleLine = (id: string, epicId: string | null): string =>
  epicId === null ? `**Id:** ${id}` : `**Id:** ${id} · **Épica:** ${epicId}`;

/** Sección final con las historias relacionadas, una por línea; vacía si no hay ninguna. */
const relatedSection = (ids: readonly string[]): string =>
  ids.length === 0 ? '' : ['## Relacionadas', ...ids.map((id) => `- ${id}`)].join('\n');

/** Saltos de línea a `\n` y sin blancos finales: así el cuerpo publicado no depende de cómo guardó el archivo el editor. */
const cleanBody = (body: string): string => body.replace(/\r\n?/g, '\n').trimEnd();

/**
 * Cuerpo del issue: marca, línea visible, cuerpo original y relacionadas. Cada bloque va separado por una línea
 * en blanco y el texto no acaba en salto de línea (GitHub recorta el final y la sincronización compara el texto).
 * El front matter y `verificacion` no llegan aquí: solo se usa `body`.
 */
const bodyOf = (id: string, epicId: string | null, body: string, related: readonly string[]): string =>
  [[storyMarker(id), visibleLine(id, epicId)].join('\n'), cleanBody(body), relatedSection(related)]
    .filter((block) => block !== '')
    .join('\n\n');

const draftOf = (
  kind: IssueDraft['kind'],
  fm: Heading,
  epicId: string | null,
  body: string,
  related: readonly string[],
): IssueDraft => ({
  id: fm.id,
  kind,
  title: fm.titulo,
  body: bodyOf(fm.id, epicId, body, related),
  labels: [...fm.etiquetas],
  epicId,
});

/** Convierte un archivo de épica o de historia en el borrador del issue que lo publica. */
export const renderIssue = (file: StoryFile): IssueDraft => {
  if (file.kind === 'epic') return draftOf('epic', file.fm, null, file.body, []);
  return draftOf('story', file.fm, file.fm.epica, file.body, file.fm.relacionadas ?? []);
};
