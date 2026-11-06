// Generador de PDF mínimo (sin dependencias): texto en Helvetica con WinAnsi, saltos de línea y de página automáticos.
// Suficiente para el informe de verificación y la descarga de documentos del laboratorio.

export interface PdfLine {
  readonly text: string;
  /** Tamaño en puntos (por defecto 10). */
  readonly size?: number;
  readonly bold?: boolean;
  /** Espacio extra antes de la línea, en puntos. */
  readonly gapBefore?: number;
}

const PAGE = { width: 595, height: 842, margin: 56, top: 770, bottom: 72, footerY: 34 } as const;
const DEFAULT_SIZE = 10;
const LEADING = 1.45;

/** Equivalencias de caracteres fuera de Latin-1 que la codificación WinAnsi no tiene. */
const SUBSTITUTIONS: ReadonlyMap<string, string> = new Map([
  ['—', '-'],
  ['–', '-'],
  ['‘', "'"],
  ['’', "'"],
  ['“', '"'],
  ['”', '"'],
  ['→', '->'],
  ['↔', '<->'],
  ['≥', '>='],
  ['≤', '<='],
  ['…', '...'],
  ['•', '-'],
]);

const WIN_ANSI_EURO = '€';

/** Texto → bytes WinAnsi (Latin-1 + euro); lo que no existe se sustituye o pasa a «?». */
export const toWinAnsi = (text: string): Buffer =>
  Buffer.from(
    Array.from(text).flatMap((char) => {
      if (char === WIN_ANSI_EURO) return [0x80];
      const replacement = SUBSTITUTIONS.get(char);
      if (replacement) return Array.from(replacement).map((c) => c.charCodeAt(0));
      const code = char.charCodeAt(0);
      return code >= 0x20 && code < 0x7f ? [code] : code >= 0xa0 && code <= 0xff ? [code] : [0x3f];
    }),
  );

const escapePdf = (bytes: Buffer): string => bytes.toString('latin1').replace(/[\\()]/g, (char) => `\\${char}`);

/** Corta por palabras para que cada línea quepa en el ancho útil (Helvetica ≈ 0,5 × cuerpo por carácter). */
export const wrapText = (text: string, size: number): readonly string[] => {
  const maxChars = Math.max(10, Math.floor((PAGE.width - PAGE.margin * 2) / (size * 0.52)));
  if (text.length <= maxChars) return [text];
  return text.split(' ').reduce<string[]>((lines, word) => {
    const current = lines[lines.length - 1] ?? '';
    if (current.length === 0) return [...lines.slice(0, -1), word.slice(0, maxChars)];
    return current.length + 1 + word.length <= maxChars ? [...lines.slice(0, -1), `${current} ${word}`] : [...lines, word.slice(0, maxChars)];
  }, []);
};

interface PlacedLine {
  readonly text: string;
  readonly size: number;
  readonly bold: boolean;
  readonly y: number;
}

/** Reparte las líneas (ya envueltas) en páginas, de arriba abajo. */
export const layoutLines = (lines: readonly PdfLine[]): readonly (readonly PlacedLine[])[] => {
  const pages: PlacedLine[][] = [[]];
  let y = PAGE.top;
  for (const line of lines) {
    const size = line.size ?? DEFAULT_SIZE;
    for (const [index, text] of wrapText(line.text, size).entries()) {
      const wantedGap = index === 0 ? (line.gapBefore ?? 0) : 0;
      const overflow = y - wantedGap - size * LEADING < PAGE.bottom;
      if (overflow) {
        pages.push([]);
        y = PAGE.top;
      }
      // Sin hueco extra al principio de una página
      const gap = overflow || y === PAGE.top ? 0 : wantedGap;
      y = y - gap - size * LEADING;
      pages[pages.length - 1]?.push({ text, size, bold: line.bold ?? false, y });
    }
  }
  return pages;
};

const contentStream = (placed: readonly PlacedLine[], footer: string): Buffer => {
  const body = placed.map((line) => `BT /${line.bold ? 'F2' : 'F1'} ${line.size} Tf 1 0 0 1 ${PAGE.margin} ${line.y.toFixed(2)} Tm (${escapePdf(toWinAnsi(line.text))}) Tj ET`);
  const foot = `BT /F1 8 Tf 1 0 0 1 ${PAGE.margin} ${PAGE.footerY} Tm (${escapePdf(toWinAnsi(footer))}) Tj ET`;
  return Buffer.from([...body, foot].join('\n'), 'latin1');
};

/** Construye el PDF: catálogo, páginas, fuentes (F1 normal, F2 negrita), pie «título · Página n de N» y tabla xref. */
export const buildPdf = (title: string, lines: readonly PdfLine[]): Buffer => {
  const pages = layoutLines(lines);
  const objects: Buffer[] = [];
  const add = (body: string | Buffer): number => objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1'));

  // Numeración fija: 1 catálogo · 2 páginas · 3 y 4 fuentes · 5 info · luego (página, contenido) por cada página
  const firstPage = 6;
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(`<< /Type /Pages /Kids [${pages.map((_, i) => `${firstPage + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  add(`<< /Title (${escapePdf(toWinAnsi(title))}) /Producer (SIGPRO) >>`);
  pages.forEach((placed, index) => {
    const pageNumber = firstPage + index * 2;
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`);
    const stream = contentStream(placed, `SIGPRO · ${title} · Página ${index + 1} de ${pages.length}`);
    add(Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, 'latin1'), stream, Buffer.from('\nendstream', 'latin1')]));
  });

  const header = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1');
  const chunks: Buffer[] = [header];
  const offsets: number[] = [];
  let position = header.length;
  objects.forEach((object, index) => {
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), object, Buffer.from('\nendobj\n', 'latin1')]);
    offsets.push(position);
    position += chunk.length;
    chunks.push(chunk);
  });

  const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`, ...offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)].join('');
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${position}\n%%EOF\n`;
  return Buffer.concat([...chunks, Buffer.from(xref + trailer, 'latin1')]);
};
