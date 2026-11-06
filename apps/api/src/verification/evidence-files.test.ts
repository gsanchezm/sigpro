import type { TestCaseDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { contentDisposition, safeFilename } from '../common/content-disposition';
import { buildPdf } from '../common/pdf';
import { nextId, sniffMime, validateEvidence, type UploadedFile } from './evidence-files';
import { buildReportLines } from './report';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF = Buffer.from('%PDF-1.4\n');
const file = (name: string, mimetype: string, buffer: Buffer, size = buffer.length): UploadedFile => ({ originalname: name, mimetype, buffer, size });

describe('sniffMime', () => {
  it('reconoce PNG, JPEG y PDF por su firma y rechaza el resto', () => {
    expect(sniffMime(PNG)).toBe('image/png');
    expect(sniffMime(JPG)).toBe('image/jpeg');
    expect(sniffMime(PDF)).toBe('application/pdf');
    expect(sniffMime(Buffer.from('texto plano'))).toBeNull();
    expect(sniffMime(Buffer.alloc(0))).toBeNull();
  });
});

describe('validateEvidence', () => {
  it('acepta hasta 5 archivos válidos', () => {
    expect(validateEvidence([])).toBeNull();
    expect(validateEvidence([file('a.png', 'image/png', PNG), file('b.jpg', 'image/jpeg', JPG), file('c.pdf', 'application/pdf', PDF)])).toBeNull();
    expect(validateEvidence(Array.from({ length: 5 }, (_, i) => file(`${i}.png`, 'image/png', PNG)))).toBeNull();
  });

  it('más de 5 archivos → tooManyFiles', () => {
    expect(validateEvidence(Array.from({ length: 6 }, (_, i) => file(`${i}.png`, 'image/png', PNG)))).toBe('tooManyFiles');
  });

  it('el tipo declarado debe estar permitido y coincidir con el contenido real', () => {
    expect(validateEvidence([file('x.txt', 'text/plain', Buffer.from('hola'))])).toBe('fileBadTypeServer');
    expect(validateEvidence([file('falso.png', 'image/png', Buffer.from('esto no es un png'))])).toBe('fileBadTypeServer');
    expect(validateEvidence([file('mal.png', 'image/png', JPG)])).toBe('fileBadTypeServer');
    expect(validateEvidence([file('x.gif', 'image/gif', Buffer.from('GIF89a'))])).toBe('fileBadTypeServer');
  });

  it('más de 2 MB → fileTooBigServer (exactamente 2 MB sí se admite)', () => {
    expect(validateEvidence([file('grande.png', 'image/png', PNG, 2 * 1024 * 1024 + 1)])).toBe('fileTooBigServer');
    expect(validateEvidence([file('justo.png', 'image/png', PNG, 2 * 1024 * 1024)])).toBeNull();
  });
});

describe('nextId, contentDisposition y safeFilename', () => {
  it('nextId continúa tras el mayor y admite huecos', () => {
    expect(nextId('RUN', [])).toBe('RUN-001');
    expect(nextId('RUN', ['RUN-001', 'RUN-050', 'RUN-007'])).toBe('RUN-051');
    expect(nextId('EV', ['EV-013'])).toBe('EV-014');
  });

  it('contentDisposition incluye nombre ASCII y filename* UTF-8', () => {
    expect(contentDisposition('attachment', 'informe.pdf')).toBe(`attachment; filename="informe.pdf"; filename*=UTF-8''informe.pdf`);
    expect(contentDisposition('inline', 'Informe técnico "A".pdf')).toBe(`inline; filename="Informe t_cnico _A_.pdf"; filename*=UTF-8''Informe%20t%C3%A9cnico%20%22A%22.pdf`);
  });

  it('safeFilename quita rutas y caracteres de control', () => {
    expect(safeFilename('C:\\Users\\yo\\captura.png')).toBe('captura.png');
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('a\u0000b\u001f.png')).toBe('ab.png');
    expect(safeFilename('   ', 'sin-nombre')).toBe('sin-nombre');
    expect(safeFilename('x'.repeat(300))).toHaveLength(120);
  });
});

describe('buildReportLines', () => {
  const cases: TestCaseDto[] = [
    { code: 'TC-001', programCode: 'PRG-001', programName: 'Ártemis', title: 'Cifrado', steps: ['Preparar', 'Ejecutar'], expected: 'Cumple', requirementCodes: ['REQ-001'], runCount: 2, lastResult: 'pass', lastRunAt: '2026-02-01T10:00:00.000Z' },
    { code: 'TC-002', programCode: 'PRG-001', programName: 'Ártemis', title: 'Latencia', steps: [], expected: 'Cumple', requirementCodes: [], runCount: 0, lastResult: null, lastRunAt: null },
  ];

  it('resume los resultados y añade una ficha por caso', () => {
    const lines = buildReportLines('Programa PRG-001', '2026-11-06', cases).map((line) => line.text);
    expect(lines).toContain('Casos de prueba: 2 · Ejecutados: 1 · Sin ejecutar: 1');
    expect(lines).toContain('Último resultado - Superados: 1 · Fallidos: 0 · Bloqueados: 0');
    expect(lines).toContain('TC-001 · Cifrado');
    expect(lines).toContain('   2. Ejecutar');
    expect(lines).toContain('Último resultado: Superado (2026-02-01) · Ejecuciones: 2');
    expect(lines).toContain('Último resultado: Sin ejecutar (—) · Ejecuciones: 0');
    expect(lines).toContain('Requisitos verificados: ninguno');
  });

  it('se convierte en un PDF válido', () => {
    const pdf = buildPdf('Informe', [...buildReportLines('Todos', '2026-11-06', cases)]).toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf).toContain('Informe del plan de verificaci\xf3n');
  });
});
