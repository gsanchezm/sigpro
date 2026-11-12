import { PROGRAMAS_TESTIDS } from '@sigpro/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../state/i18n';
import { moveActive } from '../ui/combobox';
import { SearchIcon } from '../ui/icons';
import { isProgramsRoute, popoverVisible } from './global-search';
import { DESKTOP_SEARCH_IDS, SearchList, SearchStatus, useSearchMessage, useSearchResults } from './search-view';
import { useGlobalSearch } from './useGlobalSearch';

/**
 * Búsqueda global de la CABECERA DE ESCRITORIO. En `/programs` sigue filtrando la tabla (`?q=`, sin popover: es el
 * comportamiento de la fase 1); en el resto de rutas es un combobox con un popover de resultados agrupados (programas,
 * requisitos, casos de prueba, NC y documentos): ↑ ↓ recorren, Intro abre el resultado, Esc cierra, y se cierra al
 * navegar o al salir del campo. En el diseño responsive se monta `GlobalSearchScreen` (icono + pantalla completa).
 */
export const GlobalSearch = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const { draft, setDraft } = useGlobalSearch();
  const onPrograms = isProgramsRoute(location.pathname);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const results = useSearchResults(text, !onPrograms);

  // Al navegar se cierra el popover y se vacía el campo
  useEffect(() => {
    setOpen(false);
    setText('');
  }, [location.pathname, location.search]);

  const visible = popoverVisible(open, text, location.pathname);
  const showList = visible && results.flat.length > 0;
  const activeItem = showList ? results.flat[results.active] : undefined;
  const message = useSearchMessage(DESKTOP_SEARCH_IDS, text, visible, results);

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
      results.setActive(moveActive(event.key, results.active, results.flat.length));
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

  return (
    <div className="relative w-[min(320px,30vw)]">
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
        aria-activedescendant={activeItem ? `${baseId}-item-${results.active}` : undefined}
        aria-busy={onPrograms ? undefined : results.loading}
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
      <kbd aria-hidden="true" className="kbd absolute top-[9px] right-2.5 bg-surface text-fg-3">
        /
      </kbd>

      {visible ? (
        <div
          data-testid={DESKTOP_SEARCH_IDS.results}
          className="absolute top-[calc(100%+4px)] right-0 z-40 flex w-[min(440px,calc(100vw-32px))] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-pop"
        >
          {showList ? (
            <SearchList
              ids={DESKTOP_SEARCH_IDS}
              groups={results.groups}
              baseId={baseId}
              listId={listId}
              active={results.active}
              onActive={results.setActive}
              onGo={go}
              className="max-h-[min(420px,60vh)] overflow-y-auto py-1"
            />
          ) : null}
          <SearchStatus ids={DESKTOP_SEARCH_IDS} message={message} />
        </div>
      ) : null}
    </div>
  );
};
