import { PROVEEDORES_DYNAMIC_TESTIDS, PROVEEDORES_TESTIDS, type SupplierDto } from '@sigpro/shared';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { formatTrace } from '../../lib/errors';
import { useDebouncedValue } from '../../lib/hooks';
import { useAuth } from '../../state/auth';
import { useI18n } from '../../state/i18n';
import { moveActive } from '../../ui/combobox';
import { limitOptions } from './supplier-view';

const DEBOUNCE_MS = 250;

type SearchState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly items: readonly SupplierDto[] }
  | { readonly status: 'error'; readonly trace: string };

interface SupplierSearchProps {
  readonly selected: SupplierDto | null;
  readonly onSelect: (supplier: SupplierDto | null) => void;
}

/**
 * Combobox ARIA 1.2 con autocompletar «Buscar proveedor…»: pide los proveedores del tenant al servidor (debounce 250 ms,
 * `GET /api/suppliers?q=`), enseña como mucho 5 opciones y se maneja con ratón o teclado (↑ ↓ Intro Esc).
 */
export const SupplierSearch = ({ selected, onSelect }: SupplierSearchProps) => {
  const { t } = useI18n();
  const { api } = useAuth();
  const inputId = useId();
  const listId = `${inputId}-list`;
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<SearchState>({ status: 'loading' });
  const debounced = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const typing = text.trim() !== debounced;

  // La petición va al servidor cuando la lista está abierta y el texto lleva 250 ms quieto
  useEffect(() => {
    if (!open || selected) return;
    let alive = true;
    setState({ status: 'loading' });
    api.suppliers.list({ q: debounced }).then(
      (items) => {
        if (!alive) return;
        setState({ status: 'ready', items });
        setActive(0);
      },
      (error: unknown) => alive && setState({ status: 'error', trace: formatTrace(error) || t('common', 'networkError') }),
    );
    return () => {
      alive = false;
    };
  }, [api, open, selected, debounced, t]);

  const ready = state.status === 'ready' && !typing ? state.items : [];
  const { shown, hidden } = limitOptions(ready);
  const showList = open && !selected && shown.length > 0;
  const activeOption = showList ? shown[active] : undefined;
  const optionId = (id: string) => `${inputId}-option-${id}`;
  const loading = state.status === 'loading' || typing;

  const status = ((): string => {
    if (!open || selected) return '';
    if (loading) return t('proveedores', 'searching');
    if (state.status === 'error') return t('proveedores', 'searchError');
    if (shown.length === 0) return t('proveedores', 'noMatches');
    const count = ready.length;
    const summary = count === 1 ? t('proveedores', 'resultsOne') : t('proveedores', 'results', { count });
    return hidden > 0 ? `${summary} · ${t('proveedores', 'moreResults', { count: hidden })}` : summary;
  })();

  const pick = (supplier: SupplierDto) => {
    onSelect(supplier);
    setText('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(moveActive(event.key, active, shown.length));
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      pick(activeOption);
    } else if (event.key === 'Escape' && open) {
      // Cierra solo la lista, no un diálogo o menú que pueda contenerla
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative flex max-w-[420px] flex-col gap-1">
      <label htmlFor={inputId} className="label">
        {t('proveedores', 'searchLabel')}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          data-testid={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH}
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
          aria-busy={open && loading}
          title={t('proveedores', 'searchHint')}
          autoComplete="off"
          placeholder={t('proveedores', 'searchPlaceholder')}
          value={selected ? selected.name : text}
          onChange={(event) => {
            setText(event.target.value);
            if (selected) onSelect(null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="input pr-[26px]"
        />
        {selected ? (
          <button
            type="button"
            data-testid={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_CLEAR}
            aria-label={t('proveedores', 'clear')}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(null);
              setText('');
            }}
            className="absolute top-[5px] right-1 size-5 cursor-pointer rounded-ctl-sm border-0 bg-transparent text-[14px] leading-none text-fg-3"
          >
            ×
          </button>
        ) : (
          <span aria-hidden="true" className="absolute top-[7px] right-[9px] text-[11px] text-fg-3">
            ⌄
          </span>
        )}
      </div>
      {open && !selected ? (
        <div className="absolute top-full right-0 left-0 z-[25] mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-pop">
          {showList ? (
            <ul id={listId} role="listbox" aria-label={t('proveedores', 'listLabel')} data-testid={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_LIST} className="m-0 max-h-[240px] list-none overflow-auto p-1">
              {shown.map((supplier, index) => (
                <li
                  key={supplier.id}
                  id={optionId(supplier.id)}
                  role="option"
                  tabIndex={-1}
                  aria-selected={false}
                  data-testid={PROVEEDORES_DYNAMIC_TESTIDS.SUPPLIER_OPTION(supplier.id)}
                  data-state={supplier.approved ? 'approved' : 'not_approved'}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(supplier);
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-ctl-sm px-2 py-1.5 text-[12.5px]"
                  style={{ background: index === active ? 'var(--accent-soft)' : 'transparent' }}
                >
                  <span className="min-w-0 flex-1 truncate">{supplier.name}</span>
                  <span className="font-mono text-[11px] text-fg-3">{supplier.nif}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div role="status" aria-live="polite" data-testid={PROVEEDORES_TESTIDS.SUPPLIER_SEARCH_STATUS} className="px-3 py-1.5 text-[11.5px] text-fg-3">
            {status}
          </div>
        </div>
      ) : null}
    </div>
  );
};
