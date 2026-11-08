import { ComingSoon } from '../ComingSoon';
import { useI18n } from '../../state/i18n';

/** Marcador: lo sustituye el Panel de misión (T24). */
export const MissionPage = () => {
  const { t } = useI18n();
  return <ComingSoon title={t('programas', 'nav_mission')} />;
};
