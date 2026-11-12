import { AUDITORIA_TESTIDS } from '@sigpro/shared';
import { useI18n } from '../../../src/state/i18n';
import { PendingModule } from '../../../src/ui/PendingModule';

export default function AuditRoute() {
  const { t } = useI18n();
  return <PendingModule title={t('programas', 'nav_audit')} testID={AUDITORIA_TESTIDS.AUDIT_PAGE} />;
}
