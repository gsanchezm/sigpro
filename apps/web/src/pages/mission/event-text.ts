import type { MessageKey, MissionEventDto, Translator } from '@sigpro/shared';
import { NC_SEVERITIES, NC_STATES } from '@sigpro/shared';

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

/** Texto traducido de un evento de misión (`mision.ev_<tipo>`) con sus variables ya localizadas. */
export const missionEventText = (event: Pick<MissionEventDto, 'type' | 'vars'>, t: Translator): string =>
  t('mision', `ev_${event.type}` as MisionKey, localizeVars(event.vars, t));
