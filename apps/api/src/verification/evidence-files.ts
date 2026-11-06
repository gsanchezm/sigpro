import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES, EVIDENCE_MIME_TYPES, type EvidenceMime } from '@sigpro/shared';

/** Archivo subido por multer (solo lo que usamos; evitamos depender de `@types/multer`). */
export interface UploadedFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

/** Claves i18n del espacio `verificacion` que devuelve la API en `errors.files`. */
export type EvidenceError = 'tooManyFiles' | 'fileBadTypeServer' | 'fileTooBigServer';

const SIGNATURES: readonly (readonly [EvidenceMime, readonly number[]])[] = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['application/pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
];

/** Tipo real según los primeros bytes (el `Content-Type` que manda el cliente no basta). */
export const sniffMime = (buffer: Uint8Array): EvidenceMime | null => SIGNATURES.find(([, signature]) => signature.every((byte, index) => buffer[index] === byte))?.[0] ?? null;

const isAllowed = (mimetype: string): mimetype is EvidenceMime => (EVIDENCE_MIME_TYPES as readonly string[]).includes(mimetype);

/**
 * Valida las evidencias de una ejecución: hasta 5 archivos, PNG/JPEG/PDF de verdad (firma incluida) y ≤ 2 MB cada uno.
 * Devuelve la primera clave de error o `null` si todo es válido.
 */
export const validateEvidence = (files: readonly UploadedFile[]): EvidenceError | null => {
  if (files.length > EVIDENCE_MAX_FILES) return 'tooManyFiles';
  if (files.some((file) => !isAllowed(file.mimetype) || sniffMime(file.buffer) !== file.mimetype)) return 'fileBadTypeServer';
  if (files.some((file) => file.size > EVIDENCE_MAX_BYTES)) return 'fileTooBigServer';
  return null;
};

/** Siguiente id `PREFIJO-NNN` (admite huecos): RUN-051, EV-014… */
export const nextId = (prefix: string, existing: readonly string[]): string => {
  const max = existing.reduce((acc, id) => Math.max(acc, Number.parseInt(id.replace(/\D/g, ''), 10) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};
