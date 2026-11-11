import { percentOf, type MissionEventDto, type MissionKpis, type NcSeverity, type Translator } from '@sigpro/shared';

// KPIs y NC en vivo (sin React). Los eventos `nc_*` traen las NC abiertas tras el cambio (`ncOpen`, `ncBySeverity`): ese
// valor manda sobre el del resumen en cuanto llega, sin refrescar a mano.

export type NcBySeverity = Readonly<Record<NcSeverity, number>>;

/** Lo que han dicho los eventos desde que se abrió el panel. */
export interface LiveNc {
  /** NC abiertas según el último evento que lo trajo (null hasta que llega uno). */
  readonly ncOpen: number | null;
  readonly ncBySeverity: NcBySeverity | null;
  /** NC creadas desde que se abrió el panel: el total del resumen no lo sabe hasta recargar. */
  readonly created: number;
}

export const NO_LIVE_NC: LiveNc = { ncOpen: null, ncBySeverity: null, created: 0 };

/** Aplica un evento al estado en vivo: solo toca lo que el evento trae (inmutable). */
export const applyNcEvent = (state: LiveNc, event: Pick<MissionEventDto, 'type' | 'ncOpen' | 'ncBySeverity'>): LiveNc => {
  const created = event.type === 'nc_created' ? state.created + 1 : state.created;
  return {
    ncOpen: event.ncOpen ?? state.ncOpen,
    ncBySeverity: event.ncBySeverity ?? state.ncBySeverity,
    created,
  };
};

export interface NcView {
  readonly ncOpen: number;
  readonly ncTotal: number;
  readonly ncBySeverity: NcBySeverity;
}

/** Cifras de NC que muestra el panel: el dato en vivo si existe, si no, el del resumen. El total nunca baja de las abiertas. */
export const displayedNc = (summary: { readonly kpis: Pick<MissionKpis, 'ncOpen' | 'ncTotal'>; readonly ncBySeverity: NcBySeverity }, live: LiveNc): NcView => {
  const ncOpen = live.ncOpen ?? summary.kpis.ncOpen;
  return {
    ncOpen,
    ncTotal: Math.max(summary.kpis.ncTotal + live.created, ncOpen),
    ncBySeverity: live.ncBySeverity ?? summary.ncBySeverity,
  };
};

export type KpiKey = 'programs' | 'milestones' | 'nc' | 'verification';

export interface KpiCardView {
  readonly key: KpiKey;
  readonly label: string;
  readonly value: string;
  readonly sub: string;
  /** Qué mide el indicador (se muestra en la hoja de información). */
  readonly help: string;
}

/** Las cuatro tarjetas del panel con sus textos (espacio `mision`). */
export const kpiCards = (kpis: MissionKpis, nc: NcView, t: Translator): readonly KpiCardView[] => [
  {
    key: 'programs',
    label: t('mision', 'kpi_programs'),
    value: String(kpis.activePrograms),
    sub: t('mision', 'kpi_programs_sub', { total: kpis.programsTotal }),
    help: t('mision', 'kpiTip_programs'),
  },
  {
    key: 'milestones',
    label: t('mision', 'kpi_milestones'),
    value: `${percentOf(kpis.milestonesDone, kpis.milestonesTotal)} %`,
    sub: t('mision', 'kpi_milestones_sub', { done: kpis.milestonesDone, total: kpis.milestonesTotal }),
    help: t('mision', 'kpiTip_milestones'),
  },
  {
    key: 'nc',
    label: t('mision', 'kpi_nc'),
    value: String(nc.ncOpen),
    sub: t('mision', 'kpi_nc_sub', { total: nc.ncTotal }),
    help: t('mision', 'kpiTip_nc'),
  },
  {
    key: 'verification',
    label: t('mision', 'kpi_verification'),
    value: `${kpis.verificationPass} %`,
    sub: t('mision', 'kpi_verification_sub', { cases: kpis.casesWithRuns }),
    help: t('mision', 'kpiTip_verification'),
  },
];

/** Valores a cero para pintar las tarjetas (con etiquetas) mientras llega el resumen. */
export const EMPTY_KPIS: MissionKpis = {
  activePrograms: 0,
  programsTotal: 0,
  milestonesDone: 0,
  milestonesTotal: 0,
  ncOpen: 0,
  ncTotal: 0,
  verificationPass: 0,
  casesWithRuns: 0,
};

export const EMPTY_NC: NcView = { ncOpen: 0, ncTotal: 0, ncBySeverity: { minor: 0, major: 0, critical: 0 } };
