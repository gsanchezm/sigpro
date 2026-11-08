import { ComingSoon } from '../ComingSoon';
import { useI18n } from '../../state/i18n';

/** Marcador: lo sustituye Administración (T25). */
export const AdminPage = () => {
  const { t } = useI18n();
  return <ComingSoon title={t('programas', 'nav_admin')} />;
};
