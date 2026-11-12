// Lógica pura de «Publicar nueva versión» en móvil (web: PublishVersionDialog). El contenido de una versión es una lista de
// líneas (`publishVersionSchema`: de 1 a 80, hasta 200 caracteres cada una) más una nota opcional. Valida con el esquema
// compartido con la API y devuelve los errores por campo. Sin imports de react-native: se prueba con Vitest en Node.
import { ApiError, flattenIssues, publishVersionSchema, type PublishVersionInput } from '@sigpro/shared';

export type Errors = Readonly<Record<string, string>>;

export type Validation = { readonly success: true; readonly data: PublishVersionInput } | { readonly success: false; readonly errors: Errors };

/** Texto del contenido de la última versión para precargar el campo: una línea por fila, páginas seguidas. */
export const textOfPages = (pages: readonly (readonly string[])[]): string => pages.flat().join('\n');

/** Líneas del texto: una por fila, sin el `\r` de un salto Windows y sin las filas vacías del final (no cuentan). */
export const linesOf = (text: string): readonly string[] => {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  // Posición, contando desde el final, de la última fila con contenido (-1 si no hay ninguna)
  const blankTail = [...lines].reverse().findIndex((line) => line.trim() !== '');
  return blankTail === -1 ? [] : lines.slice(0, lines.length - blankTail);
};

/** Los errores de contenido llegan como `lines` (vacío, demasiadas líneas) o `lines.N` (línea demasiado larga): se pintan bajo el campo de texto. */
export const withTextError = (errors: Errors): Errors => {
  const key = Object.keys(errors).find((candidate) => candidate === 'lines' || candidate.startsWith('lines.'));
  return key === undefined ? errors : { ...errors, text: errors[key] ?? '' };
};

/** Valida el contenido y la nota con el mismo esquema que la API. */
export const validatePublish = (text: string, note: string): Validation => {
  const parsed = publishVersionSchema.safeParse({ lines: linesOf(text), note });
  return parsed.success ? { success: true, data: parsed.data } : { success: false, errors: withTextError(flattenIssues(parsed.error.issues)) };
};

/** Errores por campo de un 422 de la API (`lines` pasa a `text`), o `null` si el fallo no es de validación. */
export const fieldErrorsOf = (error: unknown): Errors | null => (error instanceof ApiError && error.status === 422 ? withTextError(error.body.errors ?? {}) : null);

/** Quita el error de un campo cuando se corrige (como la web). */
export const withoutError = (errors: Errors, field: string): Errors => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));
