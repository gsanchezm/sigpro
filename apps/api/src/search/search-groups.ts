import { SEARCH_GROUP_KINDS, SEARCH_ITEMS_PER_GROUP, SEARCH_MIN_CHARS, richTextToPlain, type SearchGroupDto, type SearchGroupKind, type SearchItemDto } from '@sigpro/shared';

// Parte pura de la búsqueda global: normalizar el texto, buscar en memoria sobre texto plano y agrupar. Sin base de datos.

/** Texto de búsqueda recortado; `null` si no llega al mínimo (la API responde 422 `errors.q = 'minChars'`). */
export const normalizeQuery = (raw: string | undefined): string | null => {
  const text = (raw ?? '').trim();
  return text.length >= SEARCH_MIN_CHARS ? text : null;
};

/** Un candidato: lo que se devuelve y los textos en los que se busca (el HTML enriquecido se pasa ya como texto plano). */
export interface SearchEntry {
  readonly item: SearchItemDto;
  readonly fields: readonly string[];
}

/** Candidatos que contienen el texto (sin distinguir mayúsculas) en alguno de sus campos, en el orden recibido. */
export const matchEntries = (query: string, entries: readonly SearchEntry[]): readonly SearchItemDto[] => {
  const text = query.trim().toLowerCase();
  return entries.filter((entry) => entry.fields.some((field) => field.toLowerCase().includes(text))).map((entry) => entry.item);
};

/**
 * Grupos de la respuesta: orden fijo (programas, requisitos, casos, NC, documentos), solo los que tienen resultados y
 * como mucho 5 ítems por grupo; `total` cuenta todas las coincidencias del grupo.
 */
export const buildGroups = (matches: Readonly<Record<SearchGroupKind, readonly SearchItemDto[]>>): readonly SearchGroupDto[] =>
  SEARCH_GROUP_KINDS.flatMap((kind) => {
    const items = matches[kind];
    return items.length === 0 ? [] : [{ kind, total: items.length, items: items.slice(0, SEARCH_ITEMS_PER_GROUP) }];
  });

const SUMMARY_MAX = 90;

/** Resumen de una descripción (HTML saneado) para usarlo como título de una NC. */
export const summarize = (html: string, max = SUMMARY_MAX): string => {
  const plain = richTextToPlain(html);
  return plain.length <= max ? plain : `${plain.slice(0, max - 1).trimEnd()}…`;
};

// --- Candidatos por tipo: los campos buscables y el enlace de cada resultado ---------------------------------

export const programEntry = (row: { code: string; name: string; description: string; owner: { name: string } }): SearchEntry => ({
  item: { id: row.code, title: row.name, subtitle: row.owner.name, href: `/programs/${row.code}` },
  fields: [row.code, row.name, row.description],
});

export const requirementEntry = (row: { code: string; programCode: string; title: string; description: string }): SearchEntry => ({
  item: { id: row.code, title: row.title, subtitle: row.programCode, href: `/programs/${row.programCode}/requirements?select=${row.code}` },
  fields: [row.code, row.title, richTextToPlain(row.description)],
});

export const testCaseEntry = (row: { code: string; programCode: string; title: string }): SearchEntry => ({
  item: { id: row.code, title: row.title, subtitle: row.programCode, href: `/verification/${row.code}` },
  fields: [row.code, row.title],
});

export const ncEntry = (row: { code: string; programCode: string; description: string }): SearchEntry => ({
  item: { id: row.code, title: summarize(row.description), subtitle: row.programCode, href: `/nc/${row.code}` },
  fields: [row.code, richTextToPlain(row.description)],
});

export const documentEntry = (row: { id: string; programCode: string; title: string }): SearchEntry => ({
  item: { id: row.id, title: row.title, subtitle: row.programCode, href: `/documents/${row.id}` },
  fields: [row.id, row.title],
});
