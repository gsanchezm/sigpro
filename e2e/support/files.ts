// Archivos de prueba en memoria para los specs de subida de evidencias (`setInputFiles` acepta `{ name, mimeType, buffer }`).

/** PNG válido de 1×1 píxel (el navegador lo decodifica: `naturalWidth` = 1). */
export const PNG_BUFFER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
/** Cabecera JPEG mínima: el servidor solo comprueba la firma (los primeros bytes). */
export const JPEG_BUFFER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
export const PDF_BUFFER = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');

export interface UploadFile {
  readonly name: string;
  readonly mimeType: string;
  readonly buffer: Buffer;
}

export const png = (name = 'captura.png'): UploadFile => ({ name, mimeType: 'image/png', buffer: PNG_BUFFER });
export const jpeg = (name = 'foto.jpg'): UploadFile => ({ name, mimeType: 'image/jpeg', buffer: JPEG_BUFFER });
export const pdf = (name = 'informe.pdf'): UploadFile => ({ name, mimeType: 'application/pdf', buffer: PDF_BUFFER });
export const text = (name = 'notas.txt'): UploadFile => ({ name, mimeType: 'text/plain', buffer: Buffer.from('esto no es una imagen') });
/** PNG con firma válida pero de más de 2 MB (el cliente lo rechaza por tamaño; el servidor, con 422). */
export const bigPng = (name = 'enorme.png', bytes = 2.5 * 1024 * 1024): UploadFile => ({ name, mimeType: 'image/png', buffer: Buffer.concat([PNG_BUFFER, Buffer.alloc(bytes)]) });
/** Un «png» cuyo contenido no lo es (el servidor lo detecta por la firma aunque el tipo declarado sea image/png). */
export const fakePng = (name = 'falso.png'): UploadFile => ({ name, mimeType: 'image/png', buffer: Buffer.from('esto no es un png') });
