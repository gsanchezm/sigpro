import { PROGRAMAS_TESTIDS, RESPONSIVE_TESTIDS } from '@sigpro/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '../state/i18n';
import { moveActive } from '../ui/combobox';
import { CloseIcon, SearchIcon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { RESPONSIVE_SEARCH_IDS, SearchList, SearchStatus, useSearchMessage, useSearchResults } from './search-view';

/**
 * Búsqueda global del DISEÑO RESPONSIVE (< 1024 px): en la cabecera solo hay un icono (`layout-search-toggle`) que abre una
 * pantalla completa con el campo (`layout-search-mobile`, mismo nombre accesible que el de escritorio) y, debajo, los
 * mismos resultados agrupados. Mientras está abierta el icono no existe en el DOM: no hay dos «Búsqueda global».
 * En escritorio se monta `GlobalSearch` (campo en la cabecera con popover).
 */
export const GlobalSearchScreen = () => {
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const baseId = useId();
  const listId = `${baseId}-list`;
  const titleId = `${baseId}-title`;
  const inputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const results = useSearchResults(text, open);
  const message = useSearchMessage(RESPONSIVE_SEARCH_IDS, text, open, results);

  // Al navegar se cierra la pantalla y se vacía el campo
  useEffect(() => {
    setOpen(false);
    setText('');
  }, [location.pathname, location.search]);

  const close = () => {
    setOpen(false);
    setText('');
    // El icono vuelve a existir en el siguiente render: el foco regresa a él
    requestAnimationFrame(() => toggleRef.current?.focus());
  };

  const go = (href: string) => {
    setOpen(false);
    setText('');
    navigate(href);
  };

  const showList = results.flat.length > 0;
  const activeItem = showList ? results.flat[results.active] : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      results.setActive(moveActive(event.key, results.active, results.flat.length));
    } else if (event.key === 'Enter' && activeItem) {
      event.preventDefault();
      go(activeItem.item.href);
    }
  };

  if (!open) {
    return (
      <button
        ref={toggleRef}
        type="button"
        data-testid={PROGRAMAS_TESTIDS.LAYOUT_SEARCH_TOGGLE}
        aria-label={t('programas', 'globalSearch')}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="icon-btn"
      >
        <SearchIcon size={16} />
      </button>
    );
  }

  // Se pinta en <body>: la cabecera es `sticky` con su propio contexto de apilado y taparía la pantalla completa
  return createPortal(
    <Modal role="dialog" testId={RESPONSIVE_TESTIDS.LAYOUT_SEARCH_SCREEN} labelledBy={titleId} onClose={close} initialFocus={inputRef} className="inset-0 !border-0 !shadow-none">
      <h2 id={titleId} className="sr-only">
        {t('programas', 'searchScreen')}
      </h2>
      <div className="flex flex-none items-center gap-2 border-b border-border p-3">
        <div className="relative min-w-0 flex-1">
          <SearchIcon size={14} className="pointer-events-none absolute top-[11px] left-3 text-fg-3" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            data-testid={RESPONSIVE_TESTIDS.LAYOUT_SEARCH}
            aria-label={t('programas', 'globalSearch')}
            aria-expanded={showList}
            aria-controls={showList ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={activeItem ? `${baseId}-item-${results.active}` : undefined}
            aria-busy={results.loading}
            autoComplete="off"
            placeholder={t('programas', 'searchPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            className="input input-header !border-transparent !bg-surface-2 pl-9 text-[16px]"
          />
        </div>
        <button type="button" data-testid={RESPONSIVE_TESTIDS.LAYOUT_SEARCH_CLOSE} aria-label={t('programas', 'close')} onClick={close} className="icon-btn">
          <CloseIcon />
        </button>
      </div>
      <div data-testid={RESPONSIVE_SEARCH_IDS.results} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {showList ? (
          <SearchList
            ids={RESPONSIVE_SEARCH_IDS}
            groups={results.groups}
            baseId={baseId}
            listId={listId}
            active={results.active}
            onActive={results.setActive}
            onGo={go}
            className="min-h-0 flex-1 overflow-y-auto py-1"
          />
        ) : null}
        <SearchStatus ids={RESPONSIVE_SEARCH_IDS} message={message} />
      </div>
    </Modal>,
    document.body,
  );
};
