import { DETALLE_TESTIDS } from '@sigpro/shared';
import { Link } from 'react-router-dom';
import { useI18n } from '../state/i18n';

/** Marcador de las secciones del menú que llegan en fases posteriores (el enlace existe, el módulo no). */
export const ComingSoon = ({ title }: { title: string }) => {
  const { t } = useI18n();
  return (
    <section data-testid={DETALLE_TESTIDS.COMING_SOON} className="card flex max-w-[560px] flex-col gap-2 p-6">
      <h1 className="m-0 text-[20px] font-semibold tracking-[-.01em]">{title}</h1>
      <p className="m-0 text-fg-2">{t('common', 'comingSoon')}</p>
      <Link to="/programs" data-testid={DETALLE_TESTIDS.COMING_SOON_BACK} className="mt-2 self-start text-[12.5px] font-medium">
        {t('common', 'backToPrograms')}
      </Link>
    </section>
  );
};
