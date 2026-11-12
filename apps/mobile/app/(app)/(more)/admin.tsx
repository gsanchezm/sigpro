import { ADMIN_TESTIDS } from '@sigpro/shared';
import { useI18n } from '../../../src/state/i18n';
import { PendingModule } from '../../../src/ui/PendingModule';

export default function AdminRoute() {
  const { t } = useI18n();
  return <PendingModule title={t('programas', 'nav_admin')} testID={ADMIN_TESTIDS.ADMIN_PAGE} />;
}
