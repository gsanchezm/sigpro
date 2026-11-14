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

/**
 * Línea de estado de una historia: quien solo ve el issue publicado sabe si debe probarlo contra la app.
 * Depende solo de la etiqueta `no-implementada` (`verificacion` no se publica). La épica no lleva estado.
 */
const STATUS_CURRENT = '**Estado:** vigente — la app debe cumplirlo; si no lo cumple, es un defecto.';
const STATUS_FUTURE = '**Estado:** capacidad futura — la app todavía no la tiene; no se prueba contra la app.';

const statusLine = (labels: readonly string[]): string => (labels.includes('no-implementada') ? STATUS_FUTURE : STATUS_CURRENT);

/** Sección final con las historias relacionadas, una por línea; vacía si no hay ninguna. */
const relatedSection = (ids: readonly string[]): string =>
  ids.length === 0 ? '' : ['## Relacionadas', ...ids.map((id) => `- ${id}`)].join('\n');

/** Saltos de línea a `\n` y sin blancos finales: así el cuerpo publicado no depende de cómo guardó el archivo el editor. */
const cleanBody = (body: string): string => body.replace(/\r\n?/g, '\n').trimEnd();

/**
 * Cuerpo del issue: cabecera (marca, línea visible y, en una historia, la de estado), cuerpo original y
 * relacionadas. Cada bloque va separado por una línea en blanco y el texto no acaba en salto de línea (GitHub
 * recorta el final y la sincronización compara el texto). El front matter y `verificacion` no llegan aquí.
 */
const bodyOf = (header: readonly string[], body: string, related: readonly string[]): string =>
  [header.join('\n'), cleanBody(body), relatedSection(related)].filter((block) => block !== '').join('\n\n');

const draftOf = (
  kind: IssueDraft['kind'],
  fm: Heading,
  epicId: string | null,
  header: readonly string[],
  body: string,
  related: readonly string[],
): IssueDraft => ({
  id: fm.id,
  kind,
  title: fm.titulo,
  body: bodyOf(header, body, related),
  labels: [...fm.etiquetas],
  epicId,
});

/** Convierte un archivo de épica o de historia en el borrador del issue que lo publica. */
export const renderIssue = (file: StoryFile): IssueDraft => {
  const { fm } = file;
  if (file.kind === 'epic') return draftOf('epic', fm, null, [storyMarker(fm.id), visibleLine(fm.id, null)], file.body, []);
  const header = [storyMarker(fm.id), visibleLine(fm.id, file.fm.epica), statusLine(fm.etiquetas)];
  return draftOf('story', fm, file.fm.epica, header, file.body, file.fm.relacionadas ?? []);
};
