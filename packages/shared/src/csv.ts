import type { ProgramDto, RequirementDto } from './api-types';
import { richTextToPlain } from './richtext';

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

export const REQUIREMENTS_CSV_FILENAME = 'sigpro-requisitos.csv';

const REQUIREMENTS_HEADER = ['code', 'title', 'state', 'priority', 'parent', 'tags', 'tests'] as const;

/** CSV de requisitos del programa: separador `;`, título entrecomillado, etiquetas y casos separados por `|`. */
export const requirementsToCsv = (requirements: readonly RequirementDto[]): string =>
  [
    REQUIREMENTS_HEADER.join(';'),
    ...requirements.map((r) => [r.code, quote(r.title), r.state, r.priority, r.parentCode ?? '', r.tags.join('|'), r.testCaseCodes.join('|')].join(';')),
  ].join('\n');

/** Texto plano de la descripción, útil para filtros y resúmenes (sin etiquetas). */
export const requirementSummary = (requirement: Pick<RequirementDto, 'description'>, max = 120): string => richTextToPlain(requirement.description).slice(0, max);
