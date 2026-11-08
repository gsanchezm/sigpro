import { ApiError, AUDIT_ENTITIES, AUDITORIA_DYNAMIC_TESTIDS, AUDITORIA_TESTIDS, PROGRAMAS_TESTIDS, type AuditEntryDto, type MessageKey } from '@sigpro/shared';
import { useEffect, useRef, useState } from 'react';
import { formatTrace } from '../../lib/errors';
import { useDebouncedValue } from '../../lib/hooks';
import { useI18n } from '../../state/i18n';
import { Avatar } from '../../ui/Avatar';
import { useAuditFeed, type AuditFilters } from './useAuditFeed';

const diffSummary = (diff: AuditEntryDto['diff']): string =>
  diff === null
    ? ''
    : Object.entries(diff)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`)
        .join(' · ');

/**
 * Feed de auditoría: filtros por entidad, rango de fechas (Desde–Hasta) y texto, y scroll infinito dentro de un
 * contenedor de altura fija. Lo comparten la pantalla Auditoría y la pestaña «Auditoría» de Administración; quien lo
 * monta ya comprobó el permiso `audit.view`.
 */
export const AuditFeed = () => {
  const { t, lang } = useI18n();
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 250);
  const filters: AuditFilters = { entity, q, from, to };
  const { status, items, nextCursor, total, error, loadingMore, moreError, loadMore, reload } = useAuditFeed(filters, true);
  const feedRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = nextCursor !== null;
  const filtered = Boolean(entity || q || from || to);

  // Scroll infinito: cuando el centinela del final entra en el contenedor se pide la página siguiente.
  // La raíz es el propio contenedor (altura fija), no la ventana: si no, el centinela estaría ya visible y cargaría todo de golpe.
  useEffect(() => {
    const root = feedRef.current;
    const target = sentinelRef.current;
    if (!root || !target || !hasMore || moreError) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && loadMore(), { root, rootMargin: '0px 0px 120px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, moreError, loadMore, items.length]);

  const loading = status === 'loading';
  const isError = status === 'error';
  const isEmpty = status === 'ready' && items.length === 0;
  const clearFilters = () => {
    setEntity('');
    setFrom('');
    setTo('');
    setSearch('');
  };
  const actionLabel = (action: string): string => {
    const key = `a_${action.replace(/[.]/g, '_')}` as MessageKey<'auditoria'>;
    const label = t('auditoria', key);
    return label === key ? action : label;
  };
  const when = (iso: string): string => new Date(iso).toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-entity" className="label">
            {t('auditoria', 'filterEntity')}
          </label>
          <select id="audit-entity" data-testid={AUDITORIA_TESTIDS.AUDIT_FILTER_ENTITY} value={entity} onChange={(event) => setEntity(event.target.value)} className="input input-filter !h-8 !w-auto">
            <option value="">{t('auditoria', 'allEntities')}</option>
            {AUDIT_ENTITIES.map((value) => (
              <option key={value} value={value}>
                {t('auditoria', `e_${value}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-from" className="label">
            {t('auditoria', 'filterFrom')}
          </label>
          <input id="audit-from" type="date" data-testid={AUDITORIA_TESTIDS.AUDIT_FILTER_FROM} value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="input input-filter !h-8 !w-auto !font-mono !text-[12px]" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="audit-to" className="label">
            {t('auditoria', 'filterTo')}
          </label>
          <input id="audit-to" type="date" data-testid={AUDITORIA_TESTIDS.AUDIT_FILTER_TO} value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="input input-filter !h-8 !w-auto !font-mono !text-[12px]" />
        </div>
        <div className="flex min-w-[180px] flex-1 flex-col gap-1 sm:max-w-[300px]">
          <label htmlFor="audit-search" className="label">
            {t('auditoria', 'searchLabel')}
          </label>
          <input
            id="audit-search"
            type="search"
            data-testid={AUDITORIA_TESTIDS.AUDIT_SEARCH}
            placeholder={t('auditoria', 'searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input input-filter !h-8"
          />
        </div>
        {filtered ? (
          <button type="button" data-testid={AUDITORIA_TESTIDS.AUDIT_FILTERS_CLEAR} onClick={clearFilters} className="btn btn-ghost !h-8 !px-2.5">
            {t('auditoria', 'clearFilters')}
          </button>
        ) : null}
      </div>

      <p data-testid={AUDITORIA_TESTIDS.AUDIT_COUNT} aria-live="polite" className="m-0 font-mono text-[12px] text-fg-2">
        {loading ? '…' : t('auditoria', 'count', { shown: items.length, total })}
      </p>

      {isError ? (
        <div role="alert" data-testid={AUDITORIA_TESTIDS.AUDIT_ERROR} className="alert alert-danger flex flex-wrap items-center justify-between gap-3 !px-3.5 !py-3">
          <div>
            <div className="font-semibold">{t('auditoria', 'errorTitle')}</div>
            <div className="trace !text-[12.5px]">{error instanceof ApiError ? formatTrace(error) : t('common', 'networkError')}</div>
          </div>
          <button type="button" data-testid={AUDITORIA_TESTIDS.AUDIT_ERROR_RETRY} onClick={reload} className="btn btn-danger-outline !h-[30px] !px-3">
            {t('auditoria', 'retry')}
          </button>
        </div>
      ) : null}

      <div
        ref={feedRef}
        role="feed"
        // Una región con scroll debe poder recorrerse con el teclado (axe: scrollable-region-focusable)
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        aria-label={t('auditoria', 'feedLabel')}
        aria-busy={loading || loadingMore}
        data-testid={AUDITORIA_TESTIDS.AUDIT_FEED}
        className="max-h-[min(68vh,640px)] overflow-y-auto rounded-[6px] border border-border bg-surface"
      >
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <div key={index} data-testid={PROGRAMAS_TESTIDS.SKELETON_ROW} className="flex items-center gap-3 border-b border-border px-3 py-3">
                <span className="skeleton h-4 w-24" />
                <span className="skeleton h-4 flex-1" />
                <span className="skeleton h-4 w-20" />
              </div>
            ))
          : items.map((item, index) => (
              <article
                key={item.id}
                aria-posinset={index + 1}
                aria-setsize={total}
                data-testid={AUDITORIA_DYNAMIC_TESTIDS.AUDIT_ROW(item.id)}
                data-entity={item.entity}
                data-action={item.action}
                className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-border px-3 py-2.5 last:border-b-0 sm:flex-nowrap"
              >
                <time dateTime={item.at} className="w-[132px] flex-none font-mono text-[11.5px] text-fg-2">
                  {when(item.at)}
                </time>
                <span className="flex min-w-0 flex-1 items-center gap-2 sm:w-[150px] sm:flex-none">
                  <Avatar name={item.actorName ?? t('auditoria', 'system')} size={22} fontPx={9} />
                  <span className="truncate text-[12.5px]">{item.actorName ?? t('auditoria', 'system')}</span>
                </span>
                <span className="flex w-full min-w-0 flex-col gap-0.5 sm:w-auto sm:flex-1">
                  <span className="text-[12.5px] font-medium">{actionLabel(item.action)}</span>
                  <code className="w-fit text-[11px] text-fg-3">{item.action}</code>
                </span>
                <span className="flex w-full items-baseline gap-2 text-[12px] sm:w-[170px] sm:flex-none sm:flex-col sm:items-stretch sm:gap-0.5">
                  <span className="text-fg-2">{t('auditoria', `e_${item.entity}` as MessageKey<'auditoria'>)}</span>
                  <span className="font-mono text-[11.5px] font-medium">{item.entityId}</span>
                </span>
                <span className="w-full min-w-0 text-[11.5px] break-words text-fg-3 sm:w-[220px] sm:flex-none">{diffSummary(item.diff)}</span>
              </article>
            ))}

        {isEmpty ? (
          <div data-testid={AUDITORIA_TESTIDS.AUDIT_EMPTY} className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
            <div className="font-medium">{t('auditoria', 'emptyTitle')}</div>
            <div className="text-[12.5px] text-fg-2">{filtered ? t('auditoria', 'emptyFiltered') : t('auditoria', 'emptyNone')}</div>
          </div>
        ) : null}

        {/* Centinela del scroll infinito + estados del final del feed */}
        <div ref={sentinelRef} data-testid={AUDITORIA_TESTIDS.AUDIT_SENTINEL} aria-hidden="true" className="h-px" />
        {loadingMore ? (
          <div role="status" className="flex items-center justify-center gap-2 px-3 py-3 text-[12px] text-fg-2">
            <span aria-hidden="true" className="spinner" />
            {t('auditoria', 'loadingMore')}
          </div>
        ) : null}
        {moreError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
            <span className="trace">{formatTrace(moreError) || t('common', 'networkError')}</span>
            <button type="button" data-testid={AUDITORIA_TESTIDS.AUDIT_LOAD_MORE} onClick={loadMore} className="btn btn-danger-outline !h-7 !px-2.5 !text-[12px]">
              {t('auditoria', 'loadMore')}
            </button>
          </div>
        ) : null}
        {!hasMore && !loading && items.length > 0 ? (
          <p data-testid={AUDITORIA_TESTIDS.AUDIT_END} className="m-0 px-3 py-3 text-center text-[12px] text-fg-3">
            {t('auditoria', 'end')}
          </p>
        ) : null}
      </div>
    </div>
  );
};
