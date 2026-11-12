import { can } from '@sigpro/shared';
import { useRef } from 'react';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { ForbiddenScreen } from '../../ui/ForbiddenScreen';
import { Screen } from '../../ui/Screen';
import { AuditFeed } from './AuditFeed';
import { AUDITORIA_TESTIDS, MOVIL_AUDIT_TESTIDS } from './testids';

/**
 * `/audit` (admin y auditor): título, comprobación del permiso `audit.view` y el feed. Sin permiso se muestra el aviso de la
 * web («Tu rol no permite ver la auditoría») y el feed ni se monta, así que no se pide nada a la API.
 */
export const AuditScreen = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const nearEnd = useRef<(() => void) | null>(null);
  const allowed = user ? can(user.role, 'audit.view') : false;

  if (!allowed) {
    return (
      <ForbiddenScreen
        title={t('auditoria', 'title')}
        pageTestID={MOVIL_AUDIT_TESTIDS.FORBIDDEN_PAGE}
        noticeTestID={AUDITORIA_TESTIDS.AUDIT_FORBIDDEN}
        heading={t('auditoria', 'forbidden')}
        body={t('auditoria', 'forbiddenBody')}
        backTestID={AUDITORIA_TESTIDS.AUDIT_FORBIDDEN_BACK}
      />
    );
  }

  return (
    <Screen title={t('auditoria', 'title')} subtitle={t('auditoria', 'subtitle')} testID={AUDITORIA_TESTIDS.AUDIT_PAGE} onNearEnd={() => nearEnd.current?.()}>
      <AuditFeed nearEndRef={nearEnd} />
    </Screen>
  );
};
