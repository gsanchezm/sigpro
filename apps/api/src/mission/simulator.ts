import type { MissionEventDto, MissionEventType, MissionSeverity } from '@sigpro/shared';

// Catálogo del simulador de misión. Es una función pura y determinista (nada de Math.random ni Date.now): la misma
// secuencia produce siempre los mismos eventos, así los specs y las capturas son estables.

export type SimulatedEvent = Pick<MissionEventDto, 'type' | 'severity' | 'programCode' | 'vars' | 'origin'>;

interface CatalogEntry {
  readonly type: MissionEventType;
  readonly severity: MissionSeverity;
  readonly vars: (index: number, program: string) => Readonly<Record<string, string | number>>;
}

const MILESTONE_NAMES = ['SRR', 'PDR', 'CDR', 'TRR', 'FAT', 'SAT'] as const;
const pad = (n: number, width = 3): string => String(n).padStart(width, '0');

/** Ocho posiciones en ciclo: 2 avisos (térmica y pérdida de enlace) de cada 8 generan notificación en la campana. */
const CATALOG: readonly CatalogEntry[] = [
  { type: 'link', severity: 'info', vars: (i, program) => ({ program, value: 20 + ((i * 7) % 80) }) },
  { type: 'milestone', severity: 'ok', vars: (i, program) => ({ program, name: MILESTONE_NAMES[i % MILESTONE_NAMES.length] ?? 'SRR' }) },
  { type: 'thermal', severity: 'warn', vars: (i, program) => ({ program, value: 62 + ((i * 5) % 30) }) },
  { type: 'telemetry', severity: 'info', vars: (i, program) => ({ program, value: 400 + ((i * 37) % 600) }) },
  { type: 'test_pass', severity: 'ok', vars: (i, program) => ({ program, code: `TC-${pad(1 + ((i * 5) % 25))}` }) },
  { type: 'link_lost', severity: 'danger', vars: (i, program) => ({ program, value: 2 + ((i * 3) % 12) }) },
  { type: 'telemetry', severity: 'info', vars: (i, program) => ({ program, value: 520 + ((i * 41) % 480) }) },
  { type: 'heartbeat', severity: 'info', vars: (i) => ({ value: `T+${i}` }) },
];

export const SIMULATOR_CYCLE = CATALOG.length;

/** Evento número `index` (desde 0) del simulador sobre los programas indicados. */
export const simulatorEvent = (index: number, programCodes: readonly string[]): SimulatedEvent => {
  const entry = CATALOG[index % CATALOG.length] as CatalogEntry;
  const program = programCodes.length > 0 ? (programCodes[(index * 3) % programCodes.length] as string) : 'PRG-001';
  const isHeartbeat = entry.type === 'heartbeat';
  return { type: entry.type, severity: entry.severity, programCode: isHeartbeat ? null : program, vars: entry.vars(index, program), origin: 'simulator' };
};
