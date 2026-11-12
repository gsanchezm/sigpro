import { VERIFICACION_TESTIDS } from '@sigpro/shared';
import { useI18n } from '../../../src/state/i18n';
import { PendingModule } from '../../../src/ui/PendingModule';

export default function VerificationRoute() {
  const { t } = useI18n();
  return <PendingModule title={t('programas', 'nav_verification')} testID={VERIFICACION_TESTIDS.VERIFICATION_PAGE} />;
}
