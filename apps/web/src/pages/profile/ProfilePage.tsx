import { ComingSoon } from '../ComingSoon';
import { useI18n } from '../../state/i18n';

/** Marcador: lo sustituye el Perfil (T26). */
export const ProfilePage = () => {
  const { t } = useI18n();
  return <ComingSoon title={t('perfil', 'title')} />;
};
