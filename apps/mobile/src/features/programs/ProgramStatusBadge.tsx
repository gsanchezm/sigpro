import type { ProgramStatus } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { Badge } from '../../ui/Badge';
import { programStatusTone } from './view';

interface Props {
  readonly status: ProgramStatus;
  readonly testID: string;
}

/** Badge de estado con el mapa estado→tono de la web. `data-state` lleva el estado (`on_hold`…). */
export const ProgramStatusBadge = ({ status, testID }: Props) => {
  const { t } = useI18n();
  return <Badge label={t('programas', `st_${status}`)} tone={programStatusTone(status)} state={status} testID={testID} />;
};
