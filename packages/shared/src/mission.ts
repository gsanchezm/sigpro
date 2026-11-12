// Panel de misión (fase 3): contrato de los eventos en tiempo real (Socket.IO) y reglas puras del feed y la campana.

/** Evento de Socket.IO que lleva cada `MissionEventDto` (rooms por tenant: `tenant:<id>`). */
export const MISSION_SOCKET_EVENT = 'mission:event';
export const MISSION_SOCKET_PATH = '/socket.io';

export const MISSION_SEVERITIES = ['info', 'ok', 'warn', 'danger'] as const;
export type MissionSeverity = (typeof MISSION_SEVERITIES)[number];

/**
 * Catálogo de eventos. Los del simulador son telemetría sintética (no tocan la base: los specs siguen siendo
 * deterministas); los `nc_*` los emite la API cuando alguien crea o mueve una no conformidad de verdad.
 */
export const MISSION_EVENT_TYPES = [
  'link',
  'telemetry',
  'thermal',
  'link_lost',
  'milestone',
  'test_pass',
  'heartbeat',
  'nc_created',
  'nc_updated',
  'nc_moved',
  'nc_closed',
  'nc_commented',
] as const;
export type MissionEventType = (typeof MISSION_EVENT_TYPES)[number];

export type MissionOrigin = 'simulator' | 'system';

export interface MissionEventDto {
  readonly id: string;
  /** Número de orden dentro del tenant (crece con cada evento; los specs lo usan para esperar «el siguiente»). */
  readonly seq: number;
  readonly at: string;
  readonly type: MissionEventType;
  readonly severity: MissionSeverity;
  readonly programCode: string | null;
  /** Valores para el texto traducido (`mision.ev_<type>`): códigos, números y estados en bruto. */
  readonly vars: Readonly<Record<string, string | number>>;
  readonly origin: MissionOrigin;
  /** Solo en los `nc_*`: NC abiertas tras el cambio (el KPI del panel y la insignia del menú se actualizan con él). */
  readonly ncOpen?: number;
  /** Solo en los `nc_*`: NC abiertas por severidad tras el cambio (alimenta la gráfica). */
  readonly ncBySeverity?: Readonly<Record<'minor' | 'major' | 'critical', number>>;
}

/** Los avisos (`warn`, `danger`) generan notificación en la campana; el resto solo aparece en el feed. */
export const isNotifiable = (event: Pick<MissionEventDto, 'severity'>): boolean => event.severity === 'warn' || event.severity === 'danger';

export const FEED_MAX_ITEMS = 50;
export const NOTIFICATIONS_MAX_ITEMS = 20;

/** Añade al principio y recorta (inmutable): el feed muestra primero lo más reciente. */
export const prependEvent = (events: readonly MissionEventDto[], event: MissionEventDto, max = FEED_MAX_ITEMS): readonly MissionEventDto[] =>
  events.some((item) => item.id === event.id) ? events : [event, ...events].slice(0, max);

export interface MissionKpis {
  readonly activePrograms: number;
  readonly programsTotal: number;
  /** Media (0–100) del avance de todos los programas del tenant; los que no tienen hitos cuentan como 0 %. */
  readonly programsProgress: number;
  readonly milestonesDone: number;
  readonly milestonesTotal: number;
  readonly ncOpen: number;
  readonly ncTotal: number;
  /** Porcentaje (0–100) de casos con ejecuciones cuyo último resultado es «superado». */
  readonly verificationPass: number;
  readonly casesWithRuns: number;
}

export interface MilestoneBar {
  readonly programCode: string;
  readonly programName: string;
  readonly done: number;
  readonly total: number;
}

export interface MissionSummaryDto {
  readonly kpis: MissionKpis;
  readonly milestonesByProgram: readonly MilestoneBar[];
  /** NC abiertas (sin cerrar ni rechazar) por severidad. */
  readonly ncBySeverity: Readonly<Record<'minor' | 'major' | 'critical', number>>;
  /** Últimos eventos (más reciente primero). */
  readonly recent: readonly MissionEventDto[];
  /** Intervalo del simulador en ms (0 = desactivado). */
  readonly simulatorMs: number;
}

/** Porcentaje entero seguro (0 si no hay base). */
export const percentOf = (part: number, total: number): number => (total <= 0 ? 0 : Math.round((part / total) * 100));
