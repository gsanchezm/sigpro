import { deflateSync } from 'node:zlib';

// Codificador PNG mínimo (RGB, 8 bits) para las evidencias del seed: sin dependencias y determinista
// (mismo `pixel` → mismos bytes), así el seed sigue siendo reproducible.

const CRC_TABLE: readonly number[] = Array.from({ length: 256 }, (_, n) =>
  Array.from({ length: 8 }).reduce<number>((c) => (c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1), n),
);

const crc32 = (data: Uint8Array): number => (data.reduce((crc, byte) => (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8), 0xffffffff) ^ 0xffffffff) >>> 0;

const chunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

export type Rgb = readonly [number, number, number];

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** PNG de `width × height` píxeles; `pixel(x, y)` devuelve el color de cada uno. */
export const makePng = (width: number, height: number, pixel: (x: number, y: number) => Rgb): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, sin entrelazado

  const rows = Array.from({ length: height }, (_, y) => Buffer.from([0, ...Array.from({ length: width }, (__, x) => pixel(x, y)).flat()]));
  return Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const RESULT_COLOR: Readonly<Record<'pass' | 'fail' | 'blocked', Rgb>> = {
  pass: [38, 132, 84],
  fail: [190, 58, 58],
  blocked: [196, 134, 28],
};

/** Miniatura de «captura» para una evidencia: fondo del color del resultado, barra de título y líneas de texto. */
export const evidencePng = (result: 'pass' | 'fail' | 'blocked', seed: number): Buffer => {
  const [r, g, b] = RESULT_COLOR[result];
  return makePng(160, 100, (x, y) => {
    if (y < 14) return [32, 41, 56];
    const line = Math.floor((y - 22) / 12);
    const isText = y >= 22 && (y - 22) % 12 < 5 && x >= 10 && x < 150 - ((line * 17 + seed * 11) % 60);
    return isText ? [235, 240, 247] : [r, g, b];
  });
};
