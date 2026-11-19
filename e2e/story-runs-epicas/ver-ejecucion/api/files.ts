import { deflateSync } from 'node:zlib';

// Archivos de evidencia que fabrican los manejadores (API, web y móvil): se generan en memoria con el tamaño EXACTO que dice cada
// fila, sin disco. Un PNG es decodificable (imagen de 1 × 1 píxel, con CRC correcto) y se rellena con un fragmento auxiliar
// privado; un JPEG lleva su marcador de inicio (FF D8 FF) y de fin (FF D9) con un segmento APP0 y relleno; un PDF lleva `%PDF-`
// y `%%EOF`. El texto plano no lleva firma. El servidor mira la firma y el tamaño; estas formas bastan para eso y para que el
// navegador pinte el PNG.

/** Tipo de contenido que describe una fila (`un PNG válido de 1.024 bytes`, `un texto plano de 1.024 bytes`…). */
export type FileKind = 'png' | 'jpeg' | 'pdf' | 'texto';

/** Un archivo que se adjunta: nombre, tipo que declara el cliente y contenido. */
export interface Upload {
  readonly name: string;
  readonly type: string;
  readonly bytes: Buffer;
}

/** Firma de un PNG (los ocho primeros bytes). */
export const PNG_SIGNATURE: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** ¿Empieza el contenido por la firma de un PNG? (Sirve para decir que un cuerpo «es un PNG» o que «no es el archivo»). */
export const isPng = (bytes: Buffer): boolean => bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** Fragmento PNG: longitud, tipo, datos y CRC. */
const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

const IEND = chunk('IEND', Buffer.alloc(0));
const PNG_HEADER = (() => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0); // ancho 1
  header.writeUInt32BE(1, 4); // alto 1
  header.set([8, 2, 0, 0, 0], 8); // 8 bits por canal, RGB, sin entrelazado
  return header;
})();
const PNG_PIXEL = deflateSync(Buffer.from([0, 0x26, 0x84, 0x54])); // filtro 0 + un píxel RGB

/** PNG de exactamente `size` bytes: imagen de 1 × 1 y un fragmento auxiliar privado con el relleno. */
const pngOf = (size: number): Buffer => {
  const fixed = PNG_SIGNATURE.length + chunk('IHDR', PNG_HEADER).length + chunk('IDAT', PNG_PIXEL).length + IEND.length;
  const padding = size - fixed - 12; // 12 = longitud + tipo + CRC del fragmento de relleno
  if (padding < 0) throw new Error(`PNG de ${size} bytes: demasiado pequeño`);
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', PNG_HEADER), chunk('IDAT', PNG_PIXEL), chunk('prVt', Buffer.alloc(padding)), IEND]);
};

/** JPEG de exactamente `size` bytes: inicio SOI + APP0, relleno y fin EOI. (Solo firma y marcadores: no es una imagen pintable.) */
const jpegOf = (size: number): Buffer => {
  if (size < 8) throw new Error(`JPEG de ${size} bytes: demasiado pequeño`);
  const bytes = Buffer.alloc(size, 0);
  bytes.set([0xff, 0xd8, 0xff, 0xe0], 0);
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
};

/** PDF de exactamente `size` bytes: cabecera `%PDF-1.4` y final `%%EOF`, con espacios de relleno. */
const pdfOf = (size: number): Buffer => {
  const bytes = Buffer.alloc(size, 0x20);
  bytes.write('%PDF-1.4\n', 0, 'ascii');
  bytes.write('\n%%EOF\n', size - 7, 'ascii');
  return bytes;
};

/** Texto plano de exactamente `size` bytes (letras «a»). */
const textoOf = (size: number): Buffer => Buffer.alloc(size, 0x61);

const BUILDERS: ReadonlyMap<FileKind, (size: number) => Buffer> = new Map<FileKind, (size: number) => Buffer>([
  ['png', pngOf],
  ['jpeg', jpegOf],
  ['pdf', pdfOf],
  ['texto', textoOf],
]);

/** Contenido de un tipo y tamaño exactos. */
export const contentOf = (kind: FileKind, size: number): Buffer => {
  const build = BUILDERS.get(kind);
  if (build === undefined) throw new Error(`tipo de archivo sin constructor: ${kind}`);
  return build(size);
};

/** Un archivo listo para adjuntar: su contenido, su nombre y el tipo que declara el cliente. */
export const upload = (name: string, type: string, kind: FileKind, size: number): Upload => ({ name, type, bytes: contentOf(kind, size) });

/** Copia del contenido en un `ArrayBuffer` propio (lo que pide `Blob`/`fetch` en TypeScript estricto). */
export const copyOf = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
};
