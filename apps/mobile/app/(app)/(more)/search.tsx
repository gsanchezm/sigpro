import { MOVIL_TESTIDS } from '@sigpro/shared';
import { useI18n } from '../../../src/state/i18n';
import { PendingModule } from '../../../src/ui/PendingModule';

export default function SearchRoute() {
  const { t } = useI18n();
  return <PendingModule title={t('busqueda', 'listLabel')} testID={MOVIL_TESTIDS.SEARCH_PAGE} />;
}
