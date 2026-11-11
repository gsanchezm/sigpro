import { NC_SEVERITIES, NC_STATES, type MessageKey, type MissionEventDto, type MissionEventType, type MissionSeverity, type Translator } from '@sigpro/shared';
import type { Tone } from '../../theme/tokens';

// Presentación de un evento de misión: texto (portado de la web), glifo del tipo y tono de la severidad. Sin React.

type NcKey = MessageKey<'nc'>;
type MisionKey = MessageKey<'mision'>;

const isState = (value: string | number): boolean => (NC_STATES as readonly (string | number)[]).includes(value);
const isSeverity = (value: string | number): boolean => (NC_SEVERITIES as readonly (string | number)[]).includes(value);

/** Los estados y severidades llegan en bruto (`in_analysis`, `critical`): se traducen con el espacio `nc` antes de interpolar. */
const localizeVars = (vars: MissionEventDto['vars'], t: Translator): Readonly<Record<string, string | number>> =>
  Object.fromEntries(
    Object.entries(vars).map(([key, value]) => {
      if (key !== 'severity' && key !== 'from' && key !== 'to') return [key, value];
      if (isState(value)) return [key, t('nc', `state_${value}` as NcKey)];
      if (isSeverity(value)) return [key, t('nc', `sev_${value}` as NcKey)];
      return [key, value];
    }),
  );

/** Texto traducido de un evento (`mision.ev_<tipo>`) con sus variables ya localizadas. */
export const missionEventText = (event: Pick<MissionEventDto, 'type' | 'vars'>, t: Translator): string =>
  t('mision', `ev_${event.type}` as MisionKey, localizeVars(event.vars, t));

/** Glifo de cada tipo de evento (sin dependencias de iconos: como las letras de las pestañas). */
export const EVENT_GLYPH: Readonly<Record<MissionEventType, string>> = {
  link: '↔',
  telemetry: '▮',
  thermal: '°',
  link_lost: '✕',
  milestone: '★',
  test_pass: '✓',
  heartbeat: '♥',
  nc_created: '+',
  nc_updated: '~',
  nc_moved: '→',
  nc_closed: '■',
  nc_commented: '…',
};

/** Tono del design system que pinta un evento según su severidad (mismo vocabulario que las insignias). */
export const SEVERITY_TONE: Readonly<Record<MissionSeverity, Tone>> = {
  info: 'info',
  ok: 'ok',
  warn: 'warn',
  danger: 'danger',
};
