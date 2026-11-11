import { BUSQUEDA_DYNAMIC_TESTIDS, BUSQUEDA_TESTIDS, PROGRAMAS_TESTIDS, type MessageKey, type SearchGroupDto } from '@sigpro/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatTrace } from '../lib/errors';
import { useDebouncedValue } from '../lib/hooks';
import { useAuth } from '../state/auth';
import { useI18n } from '../state/i18n';
import { moveActive } from '../ui/combobox';
import { SearchIcon } from '../ui/icons';
import { canSearch, flattenGroups, isProgramsRoute, popoverVisible, totalResults } from './global-search';
import { useGlobalSearch } from './useGlobalSearch';

const DEBOUNCE_MS = 250;

type ResultsState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly groups: readonly SearchGroupDto[] }
  | { readonly status: 'error'; readonly trace: string };

interface GlobalSearchProps {
  /** `mobile`: el popover ocupa el ancho de la pantalla bajo la cabecera y el campo se enfoca al abrirse. */
  readonly variant?: 'desktop' | 'mobile';
}

/**
 * Búsqueda global de la cabecera. En `/programs` sigue filtrando la tabla (`?q=`, sin popover: es el comportamiento de la
 * fase 1); en el resto de rutas es un combobox con un popover de resultados agrupados (programas, requisitos, casos de
 * prueba, NC y documentos): ↑ ↓ recorren, Intro abre el resultado, Esc cierra, y se cierra al navegar o al salir del campo.
 */
export const GlobalSearch = ({ variant = 'desktop' }: GlobalSearchProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { draft, setDraft } = useGlobalSearch();
  const onPrograms = isProgramsRoute(location.pathname);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<ResultsState>({ status: 'idle' });
  const debounced = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const typing = text.trim() !== debounced;

  // Al navegar se cierra el popover y se vacía el campo
  useEffect(() => {
    setOpen(false);
    setText('');
    setState({ status: 'idle' });
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (variant === 'mobile') inputRef.current?.focus();
  }, [variant]);

  // La petición va al servidor cuando el texto lleva 250 ms quieto y tiene al menos 2 caracteres
  useEffect(() => {
    if (onPrograms || !canSearch(debounced)) {
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
  }, [api, debounced, onPrograms, t]);

  const groups = state.status === 'ready' && !typing ? state.groups : [];
  const flat = flattenGroups(groups);
  const visible = popoverVisible(open, text, location.pathname);
  const showList = visible && flat.length > 0;
  const itemId = (index: number) => `${baseId}-item-${index}`;
  const activeItem = showList ? flat[active] : undefined;
  const loading = canSearch(text) && (typing || state.status === 'loading');

  // Un único mensaje de estado (región `aria-live`): el mínimo de caracteres, la carga, el error, el vacío o el recuento
  const message = ((): { readonly testId: string | null; readonly text: string } => {
    if (!visible) return { testId: null, text: '' };
    if (!canSearch(text)) return { testId: null, text: t('busqueda', 'minChars') };
    if (loading) return { testId: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LOADING, text: t('busqueda', 'searching') };
    if (state.status === 'error') return { testId: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_ERROR, text: t('busqueda', 'error') };
    if (flat.length === 0) return { testId: BUSQUEDA_TESTIDS.GLOBAL_SEARCH_EMPTY, text: t('busqueda', 'empty', { query: text.trim() }) };
    const count = totalResults(groups);
    return { testId: null, text: count === 1 ? t('busqueda', 'summaryOne') : t('busqueda', 'summary', { count, groups: groups.length }) };
  })();

  const go = (href: string) => {
    setOpen(false);
    setText('');
    inputRef.current?.blur();
    navigate(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (onPrograms) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(moveActive(event.key, active, flat.length));
    } else if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      go(activeItem.item.href);
    } else if (event.key === 'Escape' && visible) {
      // Cierra solo el popover: sin `preventDefault`, Chrome vaciaría además el campo de tipo `search` (un segundo Esc ya lo limpia)
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  };

  let flatIndex = -1;
  return (
    <div className={`relative ${variant === 'mobile' ? 'w-full' : 'w-[min(320px,30vw)]'}`}>
      <SearchIcon size={14} className="pointer-events-none absolute top-[11px] left-3 text-fg-3" />
      <input
        ref={inputRef}
        type="search"
        // Fuera de /programs el campo es un combobox con popover; en /programs sigue siendo un searchbox que filtra la tabla
        role={onPrograms ? undefined : 'combobox'}
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_SEARCH}
        aria-label={t('programas', 'globalSearch')}
        aria-expanded={onPrograms ? undefined : showList}
        aria-controls={onPrograms ? undefined : showList ? listId : undefined}
        aria-autocomplete={onPrograms ? undefined : 'list'}
        aria-activedescendant={activeItem ? itemId(active) : undefined}
        aria-busy={onPrograms ? undefined : loading}
        autoComplete="off"
        placeholder={t('programas', 'searchPlaceholder')}
        value={onPrograms ? draft : text}
        onChange={(event) => {
          if (onPrograms) {
            setDraft(event.target.value);
            return;
          }
          setText(event.target.value);
          setOpen(true);
        }}
        onFocus={() => !onPrograms && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="input input-header !border-transparent !bg-surface-2 pr-10 pl-9 text-[13.5px]"
        style={{ borderColor: 'var(--border)' }}
      />
      {variant === 'desktop' ? (
        <kbd aria-hidden="true" className="kbd absolute top-[9px] right-2.5 bg-surface text-fg-3">
          /
        </kbd>
      ) : null}

      {visible ? (
        <div
          data-testid={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_RESULTS}
          className={`z-40 flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop ${
            variant === 'mobile' ? 'fixed top-[calc(var(--topbar-h)+4px)] right-3 left-3' : 'absolute top-[calc(100%+4px)] right-0 w-[min(440px,calc(100vw-32px))]'
          }`}
        >
          {showList ? (
            <div id={listId} role="listbox" aria-label={t('busqueda', 'listLabel')} data-testid={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_LIST} className="max-h-[min(420px,60vh)] overflow-y-auto py-1">
              {groups.map((group) => {
                const headingId = `${baseId}-group-${group.kind}`;
                return (
                  <div key={group.kind} role="group" aria-labelledby={headingId} data-testid={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP(group.kind)}>
                    <div id={headingId} className="flex items-center justify-between px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[.04em] text-fg-3 uppercase">
                      {t('busqueda', `group_${group.kind}` as MessageKey<'busqueda'>)}
                      <span data-testid={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_GROUP_TOTAL(group.kind)} className="font-mono normal-case">
                        {group.total > group.items.length ? `${group.items.length} / ${group.total}` : group.total}
                      </span>
                    </div>
                    {group.items.map((item) => {
                      flatIndex += 1;
                      const index = flatIndex;
                      return (
                        <div
                          key={item.id}
                          id={itemId(index)}
                          role="option"
                          tabIndex={-1}
                          aria-selected={index === active}
                          data-testid={BUSQUEDA_DYNAMIC_TESTIDS.GLOBAL_SEARCH_ITEM(group.kind, item.id)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            go(item.href);
                          }}
                          onMouseEnter={() => setActive(index)}
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
          ) : null}
          <div
            role="status"
            aria-live="polite"
            data-testid={BUSQUEDA_TESTIDS.GLOBAL_SEARCH_STATUS}
            className="border-t border-border px-3 py-1.5 text-[11.5px] text-fg-3 first:border-t-0"
          >
            <span data-testid={message.testId ?? undefined}>{message.text}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
