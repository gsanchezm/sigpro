import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, EVIDENCE_MIME_TYPES } from '@sigpro/shared';

// Evidencias de una ejecución: modelo del archivo elegido y las mismas reglas que `RunForm` de la web (tipo, 2 MB, no repetir
// y máximo de 5). Sin react-native: se prueba con Vitest. Cada selector (imágenes o documentos) entrega un archivo con
// una forma distinta y las funciones de aquí lo normalizan antes de validarlo.

/** Archivo elegido para adjuntar: lo que se pinta en la lista y lo que viaja en el multipart. */
export interface PickedFile {
  /** `file://` o `content://` en nativo; `blob:` en la web. */
  readonly uri: string;
  readonly name: string;
  /** Tipo MIME resuelto; vacío si ni el selector ni la extensión lo dan. */
  readonly mimeType: string;
  /** Tamaño en bytes; `null` si el selector no lo da (el servidor lo valida igualmente con 422). */
  readonly size: number | null;
  /** Solo en la web: el `File` del navegador, que se adjunta tal cual. */
  readonly file?: Blob;
}

/** Lo que entregan `expo-image-picker` (`fileName`, `fileSize`) y `expo-document-picker` (`name`, `size`), ya aplanado. */
export interface RawPicked {
  readonly uri: string;
  readonly name?: string | null;
  readonly mimeType?: string | null;
  readonly size?: number | null;
  readonly file?: Blob;
}

const EXTENSION_MIME: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
const MIME_EXTENSION: Readonly<Record<string, string>> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };

/** Último tramo de una ruta o URI, sin consulta ni fragmento (`file:///x/IMG_1.JPG?a=1` → `IMG_1.JPG`). */
const lastSegment = (uri: string): string => decodeURIComponent((uri.split(/[?#]/)[0] ?? '').split('/').pop() ?? '');

const extensionOf = (name: string): string => (name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : '');

/** Tipo declarado o, si el selector no lo da (Android con proveedores de contenido), el deducido de la extensión del nombre o de la ruta. */
export const resolveMime = (declared: string | null | undefined, name: string, uri: string): string =>
  declared || EXTENSION_MIME[extensionOf(name)] || EXTENSION_MIME[extensionOf(lastSegment(uri))] || '';

/** Nombre del archivo: el del selector o, si falta, el de la ruta; en último caso «evidencia-N» con la extensión de su tipo. */
export const resolveName = (declared: string | null | undefined, uri: string, mimeType: string, index: number): string => {
  if (declared) return declared;
  const segment = lastSegment(uri);
  if (extensionOf(segment) !== '') return segment;
  return `evidencia-${index + 1}.${MIME_EXTENSION[mimeType] ?? 'bin'}`;
};

/** Normaliza lo que entrega un selector. `index` numera los archivos sin nombre. */
export const toPickedFile = (raw: RawPicked, index: number): PickedFile => {
  const firstGuess = resolveMime(raw.mimeType, raw.name ?? '', raw.uri);
  const name = resolveName(raw.name, raw.uri, firstGuess, index);
  const mimeType = resolveMime(raw.mimeType, name, raw.uri);
  return { uri: raw.uri, name, mimeType, size: typeof raw.size === 'number' ? raw.size : null, ...(raw.file ? { file: raw.file } : {}) };
};

export const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

export const isAllowedMime = (mimeType: string): boolean => (EVIDENCE_MIME_TYPES as readonly string[]).includes(mimeType);

/** Mismo archivo = mismo nombre y mismo tamaño (no se añade dos veces), como la web. */
export const sameFile = (a: PickedFile, b: PickedFile): boolean => a.name === b.name && a.size === b.size;

/** Motivo por el que un archivo no se añade; el texto sale de `t('verificacion', 'fileBadType' | 'fileTooBig' | 'fileTooMany')`. */
export type FileError = { readonly kind: 'badType' | 'tooBig'; readonly name: string } | { readonly kind: 'tooMany' };

export interface AddResult {
  readonly files: readonly PickedFile[];
  /** Un aviso por archivo rechazado (y, a lo sumo, un «máximo de 5»). Vacío si todo se añadió. */
  readonly errors: readonly FileError[];
}

/**
 * Añade los archivos válidos a los que ya hay y devuelve los avisos de los rechazados: tipo no admitido, más de 2 MB o
 * pasarse de 5 (un solo aviso). Los repetidos se ignoran sin aviso. Misma lógica y orden de comprobaciones que la web.
 */
export const addFiles = (current: readonly PickedFile[], incoming: readonly PickedFile[]): AddResult =>
  incoming.reduce<AddResult>(
    (result, file) => {
      if (!isAllowedMime(file.mimeType)) return { ...result, errors: [...result.errors, { kind: 'badType', name: file.name }] };
      if (file.size !== null && file.size > EVIDENCE_MAX_BYTES) return { ...result, errors: [...result.errors, { kind: 'tooBig', name: file.name }] };
      if (result.files.some((existing) => sameFile(existing, file))) return result;
      if (result.files.length >= EVIDENCE_MAX_FILES) {
        return result.errors.some((error) => error.kind === 'tooMany') ? result : { ...result, errors: [...result.errors, { kind: 'tooMany' }] };
      }
      return { ...result, files: [...result.files, file] };
    },
    { files: current, errors: [] },
  );

/** Quita un archivo de la lista (por posición). */
export const removeFileAt = (files: readonly PickedFile[], index: number): readonly PickedFile[] => files.filter((_, position) => position !== index);

/** Clave estable de un archivo en la lista (nombre y tamaño: dos iguales nunca conviven). */
export const fileKey = (file: PickedFile): string => `${file.name}-${file.size ?? 'x'}`;

/** `data:…;base64,…` con el tipo MIME de la evidencia: `FileReader` da el del blob, que en nativo puede venir vacío o genérico. */
export const toDataUri = (dataUrl: string, mimeType: string): string => {
  const comma = dataUrl.indexOf(',');
  return comma < 0 ? dataUrl : `data:${mimeType};base64,${dataUrl.slice(comma + 1)}`;
};

/** Tamaño legible: B, KB (1 decimal) o MB (2 decimales), como `formatBytes` de la web. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};
