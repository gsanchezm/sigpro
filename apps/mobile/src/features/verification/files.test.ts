import { EVIDENCE_MAX_BYTES, EVIDENCE_MAX_FILES } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { addFiles, fileKey, formatBytes, isAllowedMime, isPdf, removeFileAt, resolveMime, resolveName, sameFile, toDataUri, toPickedFile, type PickedFile } from './files';

const file = (name: string, size: number | null = 100, mimeType = 'image/png'): PickedFile => ({ uri: `file:///cache/${name}`, name, mimeType, size });

describe('resolveMime', () => {
  it('usa el tipo declarado', () => {
    expect(resolveMime('image/jpeg', 'x.png', 'file:///x.png')).toBe('image/jpeg');
  });

  it('si el selector no lo da, lo deduce de la extensión del nombre y, si no, de la ruta', () => {
    expect(resolveMime(null, 'captura.PNG', 'content://media/1')).toBe('image/png');
    expect(resolveMime(undefined, 'foto.jpeg', '')).toBe('image/jpeg');
    expect(resolveMime('', '', 'file:///cache/ImagePicker/abc.jpg?x=1')).toBe('image/jpeg');
    expect(resolveMime(null, 'informe.pdf', '')).toBe('application/pdf');
  });

  it('un tipo que no se puede deducir queda vacío (y se rechaza al validar)', () => {
    expect(resolveMime(null, 'notas.txt', 'file:///notas.txt')).toBe('');
    expect(isAllowedMime('')).toBe(false);
  });
});

describe('resolveName', () => {
  it('usa el nombre del selector', () => {
    expect(resolveName('IMG_0001.JPG', 'file:///x/otro.png', 'image/jpeg', 0)).toBe('IMG_0001.JPG');
  });

  it('sin nombre, toma el último tramo de la ruta, sin consulta', () => {
    expect(resolveName(null, 'file:///data/cache/ImagePicker/abc-123.png?v=2', 'image/png', 0)).toBe('abc-123.png');
  });

  it('si la ruta no trae extensión, inventa «evidencia-N» con la extensión de su tipo', () => {
    expect(resolveName(undefined, 'content://media/external/images/media/42', 'image/jpeg', 1)).toBe('evidencia-2.jpg');
    expect(resolveName(undefined, 'content://x/1', 'application/pdf', 0)).toBe('evidencia-1.pdf');
  });
});

describe('toPickedFile', () => {
  it('normaliza lo que entrega un selector de imágenes de la web (File incluido)', () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    expect(toPickedFile({ uri: 'blob:http://localhost/1', name: 'captura.png', mimeType: 'image/png', size: 67, file: blob }, 0)).toEqual({
      uri: 'blob:http://localhost/1',
      name: 'captura.png',
      mimeType: 'image/png',
      size: 67,
      file: blob,
    });
  });

  it('en nativo rellena lo que falta: nombre, tipo y tamaño desconocido', () => {
    expect(toPickedFile({ uri: 'file:///cache/ImagePicker/9f.jpeg', name: null, mimeType: null, size: undefined }, 3)).toEqual({
      uri: 'file:///cache/ImagePicker/9f.jpeg',
      name: '9f.jpeg',
      mimeType: 'image/jpeg',
      size: null,
    });
  });
});

describe('addFiles (las reglas de RunForm de la web)', () => {
  it('añade los válidos en orden', () => {
    const result = addFiles([], [file('a.png'), file('b.pdf', 10, 'application/pdf')]);
    expect(result.files.map((f) => f.name)).toEqual(['a.png', 'b.pdf']);
    expect(result.errors).toEqual([]);
  });

  it('rechaza un tipo no admitido con su nombre', () => {
    const result = addFiles([], [file('notas.txt', 5, 'text/plain'), file('sin-tipo.bin', 5, '')]);
    expect(result.files).toEqual([]);
    expect(result.errors).toEqual([
      { kind: 'badType', name: 'notas.txt' },
      { kind: 'badType', name: 'sin-tipo.bin' },
    ]);
  });

  it('rechaza más de 2 MB y acepta exactamente 2 MB', () => {
    const big = addFiles([], [file('enorme.png', EVIDENCE_MAX_BYTES + 1)]);
    expect(big.errors).toEqual([{ kind: 'tooBig', name: 'enorme.png' }]);
    expect(addFiles([], [file('justo.png', EVIDENCE_MAX_BYTES)]).files).toHaveLength(1);
  });

  it('un tamaño desconocido no se rechaza en el cliente (lo valida el servidor con 422)', () => {
    expect(addFiles([], [file('x.png', null)]).files).toHaveLength(1);
  });

  it('ignora sin avisar el mismo archivo (mismo nombre y tamaño), también dentro de la misma tanda', () => {
    const first = addFiles([], [file('a.png', 10)]);
    const again = addFiles(first.files, [file('a.png', 10), file('b.png', 10), file('b.png', 10)]);
    expect(again.files.map((f) => f.name)).toEqual(['a.png', 'b.png']);
    expect(again.errors).toEqual([]);
    expect(sameFile(file('a.png', 10), file('a.png', 11))).toBe(false);
  });

  it(`admite hasta ${EVIDENCE_MAX_FILES} y avisa una sola vez de que el resto sobra`, () => {
    const incoming = Array.from({ length: EVIDENCE_MAX_FILES + 3 }, (_, index) => file(`f${index}.png`, index + 1));
    const result = addFiles([], incoming);
    expect(result.files).toHaveLength(EVIDENCE_MAX_FILES);
    expect(result.errors).toEqual([{ kind: 'tooMany' }]);
  });

  it('no modifica la lista de entrada', () => {
    const current: readonly PickedFile[] = [file('a.png')];
    addFiles(current, [file('b.png')]);
    expect(current).toHaveLength(1);
  });

  it('un rechazo por tipo no impide añadir los demás', () => {
    const result = addFiles([], [file('a.txt', 1, 'text/plain'), file('b.png')]);
    expect(result.files.map((f) => f.name)).toEqual(['b.png']);
    expect(result.errors).toHaveLength(1);
  });
});

describe('utilidades', () => {
  it('quita un archivo por posición', () => {
    expect(removeFileAt([file('a.png'), file('b.png'), file('c.png')], 1).map((f) => f.name)).toEqual(['a.png', 'c.png']);
  });

  it('la clave de un archivo es nombre y tamaño', () => {
    expect(fileKey(file('a.png', 10))).toBe('a.png-10');
    expect(fileKey(file('a.png', null))).toBe('a.png-x');
  });

  it('reconoce el PDF', () => {
    expect(isPdf('application/pdf')).toBe(true);
    expect(isPdf('image/png')).toBe(false);
  });

  it('toDataUri fuerza el tipo MIME de la evidencia (el blob de nativo puede venir sin tipo)', () => {
    expect(toDataUri('data:application/octet-stream;base64,AAAA', 'image/png')).toBe('data:image/png;base64,AAAA');
    expect(toDataUri('data:;base64,QQ==', 'image/jpeg')).toBe('data:image/jpeg;base64,QQ==');
    expect(toDataUri('sin-coma', 'image/png')).toBe('sin-coma');
  });

  it('formatBytes como la web: B, KB con un decimal y MB con dos', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });
});
