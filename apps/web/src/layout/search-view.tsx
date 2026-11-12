import {
  BUSQUEDA_DYNAMIC_TESTIDS,
  BUSQUEDA_TESTIDS,
  RESPONSIVE_DYNAMIC_TESTIDS,
  RESPONSIVE_TESTIDS,
  type MessageKey,
  type SearchGroupDto,
} from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { formatTrace } from '../lib/errors';
import { useDebouncedValue } from '../lib/hooks';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { canSearch, flattenGroups, totalResults, type FlatResult } from './global-search';

// Pieza común de las dos variantes de la búsqueda global (popover de escritorio y pantalla completa responsive):
// la consulta al servidor y la lista de resultados. Cada variante pone su propio contenedor y sus propios ids.

const DEBOUNCE_MS = 250;

/** Ids de prueba de la lista de resultados: los de escritorio, o los `-mobile` de la pantalla completa. */
export interface SearchIds {
  readonly results: string;
  readonly list: string;
  readonly status: string;
  readonly empty: string;
  readonly error: string;
  readonly loading: string;
  readonly group: (kind: string) => string;
  readonly groupTotal: (kind: string) => string;
  readonly item: (kind: string, id: string) => string;
}

export const DESKTOP_SEARCH_IDS: SearchIds = {
  results: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_RESULTS,
  list: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LIST,
  status: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_STATUS,
  empty: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_EMPTY,
  error: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_ERROR,
  loading: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LOADING,
  group: BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP,
  groupTotal: BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL,
  item: BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM,
};

export const RESPONSIVE_SEARCH_IDS: SearchIds = {
  results: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_RESULTS,
  list: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_LIST,
  status: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_STATUS,
  empty: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_EMPTY,
  error: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_ERROR,
  loading: RESPONSIVE_TESTIDS.GLOBAL_SEARCH_LOADING,
  group: RESPONSIVE_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP,
  groupTotal: RESPONSIVE_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL,
  item: RESPONSIVE_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM,
};

type ResultsState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly groups: readonly SearchGroupDto[] }
  | { readonly status: 'error'; readonly trace: string };

export interface SearchResults {
  readonly groups: readonly SearchGroupDto[];
  readonly flat: readonly FlatResult[];
  readonly loading: boolean;
  readonly failed: boolean;
  readonly active: number;
  readonly setActive: (index: number) => void;
}

/** Pide los resultados agrupados cuando el texto lleva 250 ms quieto y tiene al menos 2 caracteres. */
export const useSearchResults = (text: string, enabled: boolean): SearchResults => {
  const { t } = useI18n();
  const { api } = useAuth();
  const [state, setState] = useState<ResultsState>({ status: 'idle' });
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const typing = text.trim() !== debounced;

  useEffect(() => {
    if (!enabled || !canSearch(debounced)) {
      setState({ status: 'idle' });
      return;
    }
    let alive = true;
    setState({ status: 'loading' });
    api.search.global(debounced).then(
      (response) => {
        if (!alive) return;
        setState({ status: 'ready', groups: response.groups });
        setActive(0);
      },
      (error: unknown) => alive && setState({ status: 'error', trace: formatTrace(error) || t('common', 'networkError') }),
    );
    return () => {
      alive = false;
    };
  }, [api, debounced, enabled, t]);

  const groups = state.status === 'ready' && !typing ? state.groups : [];
  return {
    groups,
    flat: flattenGroups(groups),
    loading: canSearch(text) && (typing || state.status === 'loading'),
    failed: state.status === 'error',
    active,
    setActive,
  };
};

interface StatusMessage {
  readonly testId: string | null;
  readonly text: string;
}

/** Un único mensaje de estado (región `aria-live`): el mínimo de caracteres, la carga, el error, el vacío o el recuento. */
export const useSearchMessage = (ids: SearchIds, text: string, visible: boolean, results: SearchResults): StatusMessage => {
  const { t } = useI18n();
  if (!visible) return { testId: null, text: '' };
  if (!canSearch(text)) return { testId: null, text: t('busqueda', 'minChars') };
  if (results.loading) return { testId: ids.loading, text: t('busqueda', 'searching') };
  if (results.failed) return { testId: ids.error, text: t('busqueda', 'error') };
  if (results.flat.length === 0) return { testId: ids.empty, text: t('busqueda', 'empty', { query: text.trim() }) };
  const count = totalResults(results.groups);
  return { testId: null, text: count === 1 ? t('busqueda', 'summaryOne') : t('busqueda', 'summary', { count, groups: results.groups.length }) };
};

interface ListProps {
  readonly ids: SearchIds;
  readonly groups: readonly SearchGroupDto[];
  readonly baseId: string;
  readonly listId: string;
  readonly active: number;
  readonly onActive: (index: number) => void;
  readonly onGo: (href: string) => void;
  /** Altura máxima: el popover la acota; la pantalla completa ocupa lo que queda. */
  readonly className: string;
}

/** Lista `listbox` de resultados agrupados (programas, requisitos, casos, NC, documentos). */
export const SearchList = ({ ids, groups, baseId, listId, active, onActive, onGo, className }: ListProps) => {
  const { t } = useI18n();
  let flatIndex = -1;
  return (
    <div id={listId} role="listbox" aria-label={t('busqueda', 'listLabel')} data-testid={ids.list} className={className}>
      {groups.map((group) => {
        const headingId = `${baseId}-group-${group.kind}`;
        return (
          <div key={group.kind} role="group" aria-labelledby={headingId} data-testid={ids.group(group.kind)}>
            <div id={headingId} className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[.04em] text-fg-3 uppercase">
              {t('busqueda', `group_${group.kind}` as MessageKey<'busqueda'>)}
              <span data-testid={ids.groupTotal(group.kind)} className="font-mono normal-case">
                {group.total > group.items.length ? `${group.items.length} / ${group.total}` : group.total}
              </span>
            </div>
            {group.items.map((item) => {
              flatIndex += 1;
              const index = flatIndex;
              return (
                <div
                  key={item.id}
                  id={`${baseId}-item-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={index === active}
                  data-testid={ids.item(group.kind, item.id)}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onGo(item.href);
                  }}
                  onMouseEnter={() => onActive(index)}
                  className="flex cursor-pointer items-baseline gap-2.5 px-3 py-1.5 text-[12.5px]"
                  style={{ background: index === active ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <span className="w-[62px] flex-none font-mono text-[11.5px] text-fg-2">{item.id}</span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="flex-none text-[11px] text-fg-3">{item.subtitle}</span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

interface StatusProps {
  readonly ids: SearchIds;
  readonly message: StatusMessage;
}

export const SearchStatus = ({ ids, message }: StatusProps) => (
  <div role="status" aria-live="polite" data-testid={ids.status} className="border-t border-border px-3 py-1.5 text-[11.5px] text-fg-3 first:border-t-0">
    <span data-testid={message.testId ?? undefined}>{message.text}</span>
  </div>
);
