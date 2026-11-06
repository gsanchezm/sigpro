import { useId, useState, type KeyboardEvent } from 'react';

export interface TagOption {
  readonly value: string;
  readonly label: string;
}

interface TagPickerProps {
  /** Id del input (el `<label for>` lo pone quien lo usa). */
  readonly inputId: string;
  readonly selected: readonly string[];
  readonly options: readonly TagOption[];
  readonly onChange: (next: readonly string[]) => void;
  readonly placeholder: string;
  readonly noneLabel: string;
  /** Nombre accesible de la lista de chips (p. ej. «Etiquetas»). */
  readonly chipsLabel: string;
  readonly allUsedLabel: string;
  readonly removeLabel: (tag: string) => string;
  readonly listLabel: string;
  readonly disabled?: boolean;
  readonly disabledTitle?: string;
  readonly testIds: {
    readonly group: string;
    readonly chips: string;
    readonly input: string;
    readonly list: string;
    readonly chip: (tag: string) => string;
    readonly remove: (tag: string) => string;
    readonly option: (tag: string) => string;
  };
}

/** Multi-select con chips: escribir filtra, ↑↓ Enter elige, Retroceso quita el último chip y cada chip tiene su botón ×. */
export const TagPicker = ({ inputId, selected, options, onChange, placeholder, noneLabel, chipsLabel, allUsedLabel, removeLabel, listLabel, disabled = false, disabledTitle, testIds }: TagPickerProps) => {
  const listId = `${useId()}-list`;
  const [typed, setTyped] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const labelOf = (value: string): string => options.find((option) => option.value === value)?.label ?? value;
  const available = options.filter((option) => !selected.includes(option.value) && option.label.toLowerCase().includes(typed.trim().toLowerCase()));
  const activeOption = open ? available[active] : undefined;

  // Elegir una etiqueta cierra la lista (el foco se queda en el campo); escribir o ↓ la vuelven a abrir
  const add = (value: string) => {
    onChange([...selected, value]);
    setTyped('');
    setActive(0);
    setOpen(false);
  };
  const remove = (value: string) => onChange(selected.filter((tag) => tag !== value));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), Math.max(available.length - 1, 0)));
    } else if (event.key === 'Enter' && open && activeOption) {
      event.preventDefault();
      add(activeOption.value);
    } else if (event.key === 'Escape' && open) {
      // Cierra solo la lista, no el panel que la contiene
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Backspace' && typed === '' && selected.length > 0) {
      remove(selected[selected.length - 1] as string);
    }
  };

  return (
    <div role="group" data-testid={testIds.group} className="relative flex flex-col gap-1.5">
      <ul data-testid={testIds.chips} aria-label={chipsLabel} className="m-0 flex min-h-6 list-none flex-wrap items-center gap-1.5 p-0">
        {selected.length === 0 ? <li className="text-[12px] text-fg-3">{noneLabel}</li> : null}
        {selected.map((tag) => (
          <li key={tag} data-testid={testIds.chip(tag)} data-state={tag} className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-surface-2 pr-0.5 pl-2.5 text-[12px]">
            {labelOf(tag)}
            <button
              type="button"
              data-testid={testIds.remove(tag)}
              aria-label={removeLabel(labelOf(tag))}
              disabled={disabled}
              title={disabled ? disabledTitle : undefined}
              onClick={() => remove(tag)}
              className="grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[14px] leading-none text-fg-3 hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <input
        id={inputId}
        role="combobox"
        data-testid={testIds.input}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeOption ? `${listId}-${activeOption.value}` : undefined}
        autoComplete="off"
        disabled={disabled}
        title={disabled ? disabledTitle : undefined}
        placeholder={placeholder}
        value={typed}
        onChange={(event) => {
          setTyped(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="input !h-8 !bg-surface"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={listLabel}
          aria-multiselectable="true"
          data-testid={testIds.list}
          className="absolute top-full right-0 left-0 z-[25] mt-1 max-h-[200px] list-none overflow-auto rounded-[6px] border border-border bg-surface p-1 shadow-pop"
        >
          {available.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${option.value}`}
              role="option"
              tabIndex={-1}
              aria-selected="false"
              data-testid={testIds.option(option.value)}
              // mousedown (no click) para que el input no pierda el foco y cierre la lista antes de elegir
              onMouseDown={(event) => {
                event.preventDefault();
                add(option.value);
              }}
              className="cursor-pointer rounded-[4px] px-2 py-1.5 text-[12.5px]"
              style={{ background: index === active ? 'var(--accent-soft)' : 'transparent' }}
            >
              {option.label}
            </li>
          ))}
          {available.length === 0 ? <li className="p-2 text-[12px] text-fg-3">{allUsedLabel}</li> : null}
        </ul>
      ) : null}
    </div>
  );
};
