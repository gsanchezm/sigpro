import type { MessageKey, NcSeverity, NcState } from '@sigpro/shared';
import { useMemo } from 'react';
import { useI18n } from '../../state/i18n';
import type { SeverityLabels } from '../../ui/severity-picker-rules';

type NcKey = MessageKey<'nc'>;

/** Textos traducidos de estados y severidades (los usan el tablero, el detalle y el selector Shadow DOM). */
export const useNcLabels = () => {
  const { t } = useI18n();
  return useMemo(() => {
    const severities: SeverityLabels = { minor: t('nc', 'sev_minor'), major: t('nc', 'sev_major'), critical: t('nc', 'sev_critical') };
    return {
      state: (state: NcState): string => t('nc', `state_${state}` as NcKey),
      severity: (severity: NcSeverity): string => severities[severity],
      severities,
    };
  }, [t]);
};

/** Traduce una clave de error de Zod/servidor (`closureShort`, `descShort`…) con el espacio `nc`. */
export const useNcMessage = () => {
  const { t } = useI18n();
  return (key: string): string => t('nc', key as NcKey);
};
