import { can } from './permissions';
import type { Role, Tone } from './domain';

// Dominio de las no conformidades (fase 3): estados, severidades, máquina de estados y reglas puras.

/** Columnas del tablero kanban, en orden. */
export const NC_STATES = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'] as const;
export type NcState = (typeof NC_STATES)[number];

export const NC_SEVERITIES = ['minor', 'major', 'critical'] as const;
export type NcSeverity = (typeof NC_SEVERITIES)[number];

/** Color por severidad (tarjeta, badge y gráfica comparten el mismo vocabulario del design system). */
export const NC_SEVERITY_TONE: Readonly<Record<NcSeverity, Tone>> = { minor: 'info', major: 'warn', critical: 'danger' };

export const NC_STATE_TONE: Readonly<Record<NcState, Tone>> = {
  open: 'neutral',
  in_analysis: 'info',
  corrective_action: 'purple',
  closed: 'ok',
  rejected: 'neutral',
};

export const NC_COMMENT_KINDS = ['comment', 'quick', 'closure'] as const;
export type NcCommentKind = (typeof NC_COMMENT_KINDS)[number];

/** Mínimo de caracteres del comentario de cierre (regla del plan; es un caso negativo para los alumnos). */
export const NC_CLOSE_MIN_LENGTH = 20;
export const NC_COMMENT_MAX_LENGTH = 1000;
export const NC_DESCRIPTION_MIN_LENGTH = 10;

/**
 * Máquina de estados: open → in_analysis → corrective_action → closed; `rejected` es la salida alternativa desde
 * in_analysis; un rechazo puede reabrirse y la acción correctiva puede volver a análisis. `closed` es terminal.
 */
export const NC_TRANSITIONS: ReadonlyMap<NcState, readonly NcState[]> = new Map<NcState, readonly NcState[]>([
  ['open', ['in_analysis']],
  ['in_analysis', ['corrective_action', 'rejected', 'open']],
  ['corrective_action', ['closed', 'in_analysis']],
  ['closed', []],
  ['rejected', ['open']],
]);

export const ncNextStates = (from: NcState): readonly NcState[] => NC_TRANSITIONS.get(from) ?? [];

export const isNcTransition = (from: NcState, to: NcState): boolean => ncNextStates(from).includes(to);

/** Una NC está «abierta» (cuenta en el KPI del panel de misión) mientras no esté cerrada ni rechazada. */
export const isNcOpen = (state: NcState): boolean => state !== 'closed' && state !== 'rejected';

/** Permiso para dar el paso: cerrar exige `nc.close`; el resto, `nc.transition`. */
export const canNcTransition = (role: Role, to: NcState): boolean => can(role, to === 'closed' ? 'nc.close' : 'nc.transition');

/**
 * Longitud mínima del comentario de cierre. `degraded` aplica el defecto plantado del laboratorio (acepta 19 en lugar
 * de 20); lo decide `PLANTED_BUGS` en la API y la web lo lee de `/api/config`.
 */
export const ncClosureMinLength = (degraded = false): number => (degraded ? NC_CLOSE_MIN_LENGTH - 1 : NC_CLOSE_MIN_LENGTH);

export const isClosureComment = (text: string, degraded = false): boolean => text.trim().length >= ncClosureMinLength(degraded);

export interface NcLike {
  readonly state: NcState;
  readonly severity: NcSeverity;
  readonly assigneeId: string | null;
}

/** Reparte las tarjetas por columna conservando el orden recibido (siempre devuelve las cinco columnas). */
export const groupByState = <T extends Pick<NcLike, 'state'>>(items: readonly T[]): Readonly<Record<NcState, readonly T[]>> => {
  const empty: Record<NcState, T[]> = { open: [], in_analysis: [], corrective_action: [], closed: [], rejected: [] };
  items.forEach((item) => empty[item.state].push(item));
  return empty;
};

export const countBySeverity = <T extends Pick<NcLike, 'severity'>>(items: readonly T[]): Readonly<Record<NcSeverity, number>> =>
  items.reduce<Record<NcSeverity, number>>((acc, item) => ({ ...acc, [item.severity]: acc[item.severity] + 1 }), { minor: 0, major: 0, critical: 0 });

/** Siguiente código `NC-NNN` a partir de los existentes (admite huecos). */
export const nextNcCode = (codes: readonly string[]): string => {
  const max = codes.reduce((acc, code) => Math.max(acc, Number.parseInt(code.replace(/\D/g, ''), 10) || 0), 0);
  return `NC-${String(max + 1).padStart(3, '0')}`;
};
