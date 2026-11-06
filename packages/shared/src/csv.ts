import type { ProgramDto } from './api-types';

export const CSV_FILENAME = 'sigpro-programas.csv';

const HEADER = ['code', 'name', 'status', 'owner', 'start', 'end', 'budget', 'progress'] as const;

// Nombre y responsable van siempre entrecomillados (comillas internas duplicadas)
const quote = (text: string): string => `"${text.replace(/"/g, '""')}"`;

/** CSV de programas con el formato del handoff: separador `;`, cabecera en inglés. La usan la API y la web. */
export const programsToCsv = (programs: readonly ProgramDto[]): string =>
  [
    HEADER.join(';'),
    ...programs.map((p) => [p.code, quote(p.name), p.status, quote(p.ownerName), p.startDate, p.endDate, p.budgetEur, p.progress].join(';')),
  ].join('\n');
