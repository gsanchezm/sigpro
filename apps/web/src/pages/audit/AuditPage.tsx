import { AUDITORIA_TESTIDS, can } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { AuditFeed } from './AuditFeed';

/** Auditoría (admin y auditor): título, comprobación del permiso y el feed compartido con Administración. */
export const AuditPage = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const allowed = user ? can(user.role, 'audit.view') : false;

  if (!allowed) {
    return (
      <section role="alert" data-testid={AUDITORIA_TESTIDS.AUDIT_FORBIDDEN} className="alert alert-warn flex max-w-[560px] flex-col gap-1">
        <h1 className="m-0 text-[16px] font-semibold">{t('auditoria', 'forbidden')}</h1>
        <p className="m-0">{t('auditoria', 'forbiddenBody')}</p>
        <Link to="/programs" data-testid={AUDITORIA_TESTIDS.AUDIT_FORBIDDEN_BACK} className="mt-1 self-start text-[12.5px] font-medium">
          {t('common', 'backToPrograms')}
        </Link>
      </section>
    );
  }

  return (
    <div data-testid={AUDITORIA_TESTIDS.AUDIT_PAGE} className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h1 className="page-title">{t('auditoria', 'title')}</h1>
        <p className="m-0 text-[12.5px] text-fg-2">{t('auditoria', 'subtitle')}</p>
      </div>
      <AuditFeed />
    </div>
  );
};
