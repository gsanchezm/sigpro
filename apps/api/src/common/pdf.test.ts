import { describe, expect, it } from 'vitest';
import { buildPdf, layoutLines, toWinAnsi, wrapText } from './pdf';

describe('toWinAnsi', () => {
  it('conserva Latin-1 (acentos, ñ, ¿¡) y el euro', () => {
    expect([...toWinAnsi('áéíóú ñ ¿¡ €')]).toEqual([0xe1, 0xe9, 0xed, 0xf3, 0xfa, 0x20, 0xf1, 0x20, 0xbf, 0xa1, 0x20, 0x80]);
  });

  it('sustituye lo que WinAnsi no tiene', () => {
    expect(toWinAnsi('a → b ↔ c — d').toString('latin1')).toBe('a -> b <-> c - d');
    expect(toWinAnsi('漢').toString('latin1')).toBe('?');
  });
});

describe('wrapText y layoutLines', () => {
  it('envuelve por palabras sin superar el ancho útil', () => {
    const lines = wrapText('palabra '.repeat(40).trim(), 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length <= 93)).toBe(true);
    expect(lines.join(' ')).toBe('palabra '.repeat(40).trim());
  });

  it('salta de página cuando se acaba el espacio y no deja huecos al principio de página', () => {
    const pages = layoutLines(Array.from({ length: 120 }, (_, i) => ({ text: `línea ${i}`, gapBefore: i === 0 ? 30 : 0 })));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.every((page) => page.every((line) => line.y >= 72))).toBe(true);
    expect(pages[1]?.[0]?.y).toBe(pages[0]?.[0]?.y);
  });
});

describe('buildPdf', () => {
  const pdf = buildPdf('Informe de prueba', [
    { text: 'Título del informe', size: 16, bold: true },
    { text: 'Texto con acentos y paréntesis (uno) y barra \\.', gapBefore: 6 },
  ]);
  const text = pdf.toString('latin1');

  it('tiene cabecera, fin de archivo y una página', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 1');
    expect(text).toContain('/Title (Informe de prueba)');
  });

  it('escapa paréntesis y barras en el texto', () => {
    expect(text).toContain('\\(uno\\)');
    expect(text).toContain('barra \\\\.');
  });

  it('la tabla xref apunta al inicio exacto de cada objeto y startxref a la tabla', () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThanOrEqual(7);
    entries.forEach((offset, index) => expect(text.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`));
  });

  it('el pie indica la página y el total, y varias páginas se reflejan en /Count', () => {
    expect(text).toContain('Página 1 de 1');
    const long = buildPdf('Largo', Array.from({ length: 200 }, (_, i) => ({ text: `línea ${i}` }))).toString('latin1');
    const count = Number(/\/Count (\d+)/.exec(long)?.[1]);
    expect(count).toBeGreaterThan(2);
    expect(long).toContain(`Página ${count} de ${count}`);
  });
});
