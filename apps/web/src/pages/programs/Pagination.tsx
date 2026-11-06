import { PROGRAMAS_DYNAMIC_TESTIDS, PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useI18n } from '../../state/i18n';
import { pageWindow } from '../../ui/combobox';

interface PaginationProps {
  readonly page: number;
  readonly pages: number;
  readonly onPage: (page: number) => void;
  /** En móvil: solo anterior/siguiente, botones de 44 × 36. */
  readonly compact?: boolean;
}

const pageButton = 'h-[26px] min-w-[26px] cursor-pointer rounded-[4px] border border-border bg-surface px-1.5 text-[12px] text-fg hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50';

/** Paginación de 10 en 10: anterior, números (con huecos si hay más de 7 páginas) y siguiente. */
export const Pagination = ({ page, pages, onPage, compact = false }: PaginationProps) => {
  const { t } = useI18n();
  const size = compact ? '!h-9 !min-w-11' : '';
  const prev = (
    <button
      type="button"
      data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PAGE_PREV}
      aria-label={t('programas', 'prevPage')}
      disabled={page <= 1}
      title={page <= 1 ? t('common', 'firstPage') : undefined}
      onClick={() => onPage(page - 1)}
      className={`${pageButton} ${size}`}
    >
      ‹
    </button>
  );
  const next = (
    <button
      type="button"
      data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PAGE_NEXT}
      aria-label={t('programas', 'nextPage')}
      disabled={page >= pages}
      title={page >= pages ? t('common', 'lastPage') : undefined}
      onClick={() => onPage(page + 1)}
      className={`${pageButton} ${size}`}
    >
      ›
    </button>
  );

  if (compact) {
    return (
      <div className="flex gap-1.5">
        {prev}
        {next}
      </div>
    );
  }

  return (
    <nav aria-label={t('programas', 'pagination')} data-testid={PROGRAMAS_TESTIDS.PROGRAMS_PAGINATION} className="flex items-center gap-1">
      {prev}
      {pageWindow(page, pages).map((n) => (
        <button
          key={n}
          type="button"
          data-testid={PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_PAGE(n)}
          aria-label={`${t('programas', 'page')} ${n}`}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onPage(n)}
          className={`${pageButton} ${n === page ? '!border-accent !bg-accent !text-white' : ''}`}
        >
          {n}
        </button>
      ))}
      {next}
    </nav>
  );
};
