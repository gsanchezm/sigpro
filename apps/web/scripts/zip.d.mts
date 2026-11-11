export function crc32(buffer: Uint8Array): number;
export function createZip(files: readonly { name: string; data: Buffer }[]): Buffer;
export function readZip(buffer: Buffer): { name: string; data: Buffer }[];
