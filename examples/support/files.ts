import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';

// Archivos de prueba EN MEMORIA para los specs de subida y descarga (sesión 7).
// `setInputFiles` acepta `{ name, mimeType, buffer }`: no hace falta ningún fichero en disco.
// Los buffers son mínimos pero válidos: el servidor comprueba la firma (los primeros bytes) de cada archivo,
// no solo la extensión ni el tipo declarado.

/** PNG válido de 1×1 píxel: el navegador lo decodifica y `naturalWidth` vale 1. */
export const PNG_BUFFER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
/** Cabecera JPEG mínima: el servidor solo mira la firma. */
export const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
/** PDF mínimo: empieza por `%PDF-`, que es lo que comprueban los specs. */
export const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

/** Un archivo listo para `setInputFiles` o para `filechooser.setFiles`. */
export interface UploadFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

export const png = (name = 'captura.png'): UploadFile => ({ name, mimeType: 'image/png', buffer: PNG_BUFFER });
export const jpeg = (name = 'foto.jpg'): UploadFile => ({ name, mimeType: 'image/jpeg', buffer: JPEG_BUFFER });
export const pdf = (name = 'informe.pdf'): UploadFile => ({ name, mimeType: 'application/pdf', buffer: PDF_BUFFER });
/** Un .txt: el tipo no está permitido como evidencia, así que el cliente lo rechaza. */
export const text = (name = 'notas.txt'): UploadFile => ({ name, mimeType: 'text/plain', buffer: Buffer.from('esto no es una imagen') });
/** PNG con la firma correcta pero de más de 2 MB: el cliente lo rechaza por tamaño. */
export const bigPng = (name = 'enorme.png', extraBytes = 2.5 * 1024 * 1024): UploadFile => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.concat([PNG_BUFFER, Buffer.alloc(extraBytes)]),
});

/**
 * Lee el contenido de una descarga. `path()` espera a que termine y devuelve la ruta del fichero temporal que guarda Playwright;
 * si la descarga falla, lanza el error (no devuelve `null`).
 */
export const readDownload = async (download: Download): Promise<Buffer> => readFile(await download.path());
