import { PROGRAMAS_DYNAMIC_TESTIDS, type OwnerDto } from '@sigpro/shared';
import { useId, useState, type KeyboardEvent } from 'react';
import { Avatar } from './Avatar';
import { filterOwners, moveActive } from './combobox';

interface OwnerComboboxProps {
  readonly inputId: string;
  /** Prefijo de los ids de prueba: `programs-filter-owner` → opciones `programs-filter-owner-option-u1`. */
  readonly testIdPrefix: string;
  readonly inputTestId: string;
  readonly listTestId: string;
  readonly clearTestId?: string;
  readonly owners: readonly OwnerDto[];
  /** Id del responsable seleccionado (o null). */
  readonly value: string | null;
  readonly onChange: (ownerId: string | null) => void;
  readonly placeholder: string;
  readonly listLabel: string;
  readonly clearLabel?: string;
  readonly noMatch: string;
  /** Muestra el recuento de programas en cada opción (filtro de la lista). */
  readonly showCounts?: boolean;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly inputClassName: string;
}

/** Combobox ARIA 1.2 con autocompletar: ↑↓ Enter Esc, `aria-activedescendant`, opciones con avatar. */
export const OwnerCombobox = ({
  inputId,
  testIdPrefix,
  inputTestId,
  listTestId,
  clearTestId,
  owners,
  value,
  onChange,
  placeholder,
  listLabel,
  clearLabel,
  noMatch,
  showCounts = false,
  invalid = false,
  describedBy,
  inputClassName,
}: OwnerComboboxProps) => {
  const listId = `${useId()}-list`;
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selected = owners.find((owner) => owner.id === value) ?? null;
  const text = selected ? selected.name : typed;
  const options = filterOwners(owners, selected ? '' : typed, value);
  const optionId = (id: string) => `${testIdPrefix}-${id}`;
  const activeOption = open ? options[active] : undefined;

  const pick = (id: string) => {
    onChange(id);
    setTyped('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActive(moveActive(event.key, active, options.length));
    } else if (event.key === 'Enter' && open && activeOption) {
      event.preventDefault();
      pick(activeOption.id);
    } else if (event.key === 'Escape' && open) {
      // Cierra solo la lista, no el diálogo que pueda contenerla
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        id={inputId}
        role="combobox"
        data-testid={inputTestId}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? optionId(activeOption.id) : undefined}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setTyped(event.target.value);
          if (selected) onChange(null);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (!selected) setTyped('');
        }}
        onKeyDown={onKeyDown}
        className={`input pr-[26px] ${inputClassName}`}
      />
      {selected && clearTestId ? (
        <button
          type="button"
          data-testid={clearTestId}
          aria-label={clearLabel}
          onMouseDown={(event) => {
            event.preventDefault();
            onChange(null);
            setTyped('');
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
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          data-testid={listTestId}
          className="absolute top-full right-0 left-0 z-[25] mt-1 max-h-[220px] list-none overflow-auto rounded-card border border-border bg-surface p-1 shadow-pop"
        >
          {options.map((owner, index) => (
            <li
              key={owner.id}
              id={optionId(owner.id)}
              role="option"
              tabIndex={-1}
              aria-selected={owner.id === value}
              data-testid={PROGRAMAS_DYNAMIC_TESTIDS.COMBOBOX_OPTION(testIdPrefix, owner.id)}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(owner.id);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-ctl-sm px-2 py-1.5 text-[12.5px]"
              style={{ background: index === active ? 'var(--accent-soft)' : owner.id === value ? 'var(--surface-2)' : 'transparent' }}
            >
              <Avatar name={owner.name} size={20} fontPx={9} shape="circle" tone="solid" decorative />
              <span className="flex-1">{owner.name}</span>
              {showCounts ? <span className="font-mono text-[11px] text-fg-3">{owner.programCount}</span> : null}
            </li>
          ))}
          {options.length === 0 ? <li className="p-2 text-[12px] text-fg-3">{noMatch}</li> : null}
        </ul>
      ) : null}
    </div>
  );
};
