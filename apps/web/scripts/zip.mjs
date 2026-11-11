// Escritor y lector de zip mínimos (DEFLATE), sin dependencias: lo usa el build para empaquetar `examples/`.
// En Windows no hay `zip` en la consola y en Render tampoco queremos instalar nada, así que se escribe a mano
// (igual que el PDF de la API o el editor de texto enriquecido): son ~80 líneas con tests.
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (el de zip, gzip y PNG). */
export const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

// Fecha MS-DOS fija (2026-01-01 00:00): el mismo contenido produce el mismo zip, byte a byte, en cada build
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;
const UTF8_FLAG = 0x0800;
const UNIX_FILE_ATTRIBUTES = 0o100644 * 0x10000; // -rw-r--r-- en los 16 bits altos
const MADE_BY_UNIX = (3 << 8) | 30;

/** Un archivo del zip: `name` con `/` como separador y el contenido en un Buffer. */
const toEntry = ({ name, data }) => {
  const nameBytes = Buffer.from(name, 'utf8');
  const deflated = deflateRawSync(data, { level: 9 });
  const stored = deflated.length >= data.length; // si no comprime, se guarda tal cual
  return { nameBytes, body: stored ? data : deflated, method: stored ? 0 : 8, crc: crc32(data), size: data.length };
};

/** Crea un zip con las entradas dadas (en el orden recibido). */
export const createZip = (files) => {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const { nameBytes, body, method, crc, size } = toEntry(file);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(UTF8_FLAG, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    parts.push(local, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(MADE_BY_UNIX, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(UTF8_FLAG, 8);
    entry.writeUInt16LE(method, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(size, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(UNIX_FILE_ATTRIBUTES, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += local.length + nameBytes.length + body.length;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, directory, end]);
};

/** Lee un zip creado por `createZip` (o cualquier zip sin cifrar ni zip64): `[{ name, data }]`. Verifica el CRC. */
export const readZip = (buffer) => {
  const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endAt < 0) throw new Error('No es un zip: falta el registro final');
  const count = buffer.readUInt16LE(endAt + 10);
  let cursor = buffer.readUInt32LE(endAt + 16);

  return Array.from({ length: count }, () => {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Directorio central dañado');
    const method = buffer.readUInt16LE(cursor + 10);
    const crc = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localAt = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    const dataAt = localAt + 30 + buffer.readUInt16LE(localAt + 26) + buffer.readUInt16LE(localAt + 28);
    const raw = buffer.subarray(dataAt, dataAt + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error(`CRC incorrecto en ${name}`);
    return { name, data };
  });
};
