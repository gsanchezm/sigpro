import { ComingSoon } from '../ComingSoon';
import { useI18n } from '../../state/i18n';

/** Marcador: lo sustituye el módulo No conformidades (T23). */
export const NcPage = () => {
  const { t } = useI18n();
  return <ComingSoon title={t('programas', 'nav_nc')} />;
};
