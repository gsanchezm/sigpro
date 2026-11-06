import type { PdfLine } from '../common/pdf';

/** Líneas del PDF de una versión de documento: cabecera con el id, programa y versión, y el contenido tal cual. */
export const buildDocumentPdfLines = (doc: { id: string; title: string; programCode: string; classification: string; version: number }, lines: readonly string[]): readonly PdfLine[] => [
  { text: doc.title, size: 16, bold: true },
  { text: `${doc.id} · Programa ${doc.programCode} · Versión ${doc.version} · ${doc.classification === 'restricted' ? 'RESTRINGIDO' : 'PÚBLICO'}`, size: 9, gapBefore: 4 },
  ...lines.map((line, index) => {
    const isHeading = /^\d+\. /.test(line);
    return { text: line === '' ? ' ' : line, bold: isHeading, gapBefore: index === 0 ? 14 : isHeading ? 8 : 0 } satisfies PdfLine;
  }),
];
