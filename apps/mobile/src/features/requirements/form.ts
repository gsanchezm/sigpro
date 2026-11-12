// Lógica pura de los formularios de Requisitos (alta, edición): texto plano ↔ HTML de la descripción, diferencia de
// cambios para el PATCH y validación con los esquemas Zod compartidos con la API. Sin imports de react-native.
import {
  ApiError,
  createRequirementSchema,
  flattenIssues,
  updateRequirementSchema,
  type CreateRequirementInput,
  type Priority,
  type RequirementDto,
  type RequirementTag,
  type UpdateRequirementInput,
} from '@sigpro/shared';

// La descripción se guarda como HTML saneado (`sanitizeRichText`). En móvil se edita como texto plano: un párrafo por línea.

/** Campos del formulario: la descripción es texto plano, no HTML. */
export interface RequirementDraft {
  readonly title: string;
  readonly description: string;
  readonly priority: Priority;
  readonly tags: readonly RequirementTag[];
}

/** Borrador vacío del alta (prioridad media, como la web). */
export const EMPTY_DRAFT: RequirementDraft = { title: '', description: '', priority: 'medium', tags: [] };

/** Resultado de validar: los datos listos para la API, o un error por campo (clave i18n de `requisitos`). */
export type Validation<T> = { readonly success: true; readonly data: T } | { readonly success: false; readonly errors: Readonly<Record<string, string>> };

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Quita espacios de cada línea y las líneas vacías: así la comparación no depende de los saltos sobrantes. */
export const normalizeText = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join('\n');

/** HTML saneado → texto plano con un párrafo o elemento de lista por línea (los elementos de lista llevan «• »). */
export const descriptionToText = (html: string): string => {
  const withBreaks = html
    .replace(/<li>/gi, '• ')
    .replace(/<\/(?:p|li)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return normalizeText(withBreaks.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity));
};

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Texto plano → HTML de párrafos (`<p>`), escapado. Un texto vacío es una descripción vacía, no un párrafo vacío. */
export const textToDescription = (text: string): string => {
  const lines = normalizeText(text);
  return lines === '' ? '' : lines.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('');
};

/** Valores iniciales del formulario de edición a partir del requisito. */
export const draftOf = (item: RequirementDto): RequirementDraft => ({
  title: item.title,
  description: descriptionToText(item.description),
  priority: item.priority,
  tags: item.tags,
});

/** Mismas etiquetas, sin importar el orden. */
export const sameTags = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((tag) => b.includes(tag));

export const titleChanged = (item: RequirementDto, draft: RequirementDraft): boolean => draft.title !== item.title;

/** El texto de la descripción cambió (los saltos de línea sobrantes no cuentan). */
export const descriptionChanged = (item: RequirementDto, draft: RequirementDraft): boolean => normalizeText(draft.description) !== descriptionToText(item.description);

/** Cambia el título o la descripción: la API devuelve el requisito a borrador (como la web). */
export const textChanged = (item: RequirementDto, draft: RequirementDraft): boolean => titleChanged(item, draft) || descriptionChanged(item, draft);

/**
 * Solo los campos que cambiaron. La descripción viaja únicamente si su texto cambió: si se reenviara el HTML regenerado en
 * una edición de prioridad, la API lo vería distinto del guardado y devolvería el requisito a borrador sin motivo.
 */
export const buildChanges = (item: RequirementDto, draft: RequirementDraft): UpdateRequirementInput => ({
  ...(titleChanged(item, draft) ? { title: draft.title } : {}),
  ...(descriptionChanged(item, draft) ? { description: textToDescription(draft.description) } : {}),
  ...(draft.priority === item.priority ? {} : { priority: draft.priority }),
  ...(sameTags(draft.tags, item.tags) ? {} : { tags: [...draft.tags] }),
});

/** ¿Hay algo que enviar? Con cambios vacíos el botón «Guardar» queda deshabilitado (la API rechaza un PATCH vacío). */
export const hasChanges = (changes: UpdateRequirementInput): boolean => Object.keys(changes).length > 0;

/** Cuerpo del alta. `parentCode` vacío significa raíz. */
export const createInputOf = (programCode: string, parentCode: string | null, draft: RequirementDraft): Record<string, unknown> => ({
  programCode,
  parentCode,
  title: draft.title,
  description: textToDescription(draft.description),
  priority: draft.priority,
  tags: [...draft.tags],
});

/** Errores por campo de un 422 de la API (`{ campo: claveI18n }`), o `null` si el fallo no es de validación. */
export const fieldErrorsOf = (error: unknown): Readonly<Record<string, string>> | null =>
  error instanceof ApiError && error.status === 422 ? (error.body.errors ?? {}) : null;

/** Quita el error de los campos que acaban de cambiar (como la web: el aviso desaparece al corregir). */
export const withoutErrors = (errors: Readonly<Record<string, string>>, fields: readonly string[]): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(errors).filter(([field]) => !fields.includes(field)));

/** Valida el alta con el mismo esquema que la API. */
export const validateCreate = (input: Record<string, unknown>): Validation<CreateRequirementInput> => {
  const parsed = createRequirementSchema.safeParse(input);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: flattenIssues(parsed.error.issues) };
};

/** Valida la edición con el mismo esquema que la API (incluido «no hay nada que actualizar»). */
export const validateUpdate = (changes: UpdateRequirementInput): Validation<UpdateRequirementInput> => {
  const parsed = updateRequirementSchema.safeParse(changes);
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: flattenIssues(parsed.error.issues) };
};
