interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  /** `data-testid` del interruptor (viene de testids.ts). */
  readonly testId: string;
  /** Nombre accesible cuando no hay texto visible que lo etiquete. */
  readonly label?: string;
  /** Id del elemento visible que etiqueta el interruptor (alternativa a `label`). */
  readonly labelledBy?: string;
  readonly id?: string;
  readonly disabled?: boolean;
  /** Motivo por el que está deshabilitado (`title`). */
  readonly title?: string;
}

/** Interruptor accesible: `<button role="switch" aria-checked>`; Espacio e Intro lo cambian (comportamiento de `button`). */
export const Switch = ({ checked, onChange, testId, label, labelledBy, id, disabled = false, title }: SwitchProps) => (
  <button
    type="button"
    role="switch"
    id={id}
    data-testid={testId}
    aria-checked={checked}
    aria-label={label}
    aria-labelledby={labelledBy}
    disabled={disabled}
    title={title}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-[20px] w-[36px] flex-none cursor-pointer items-center rounded-full border p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'border-accent bg-accent' : 'border-border-strong bg-surface-2'
    }`}
  >
    <span aria-hidden="true" className={`block size-[14px] rounded-full shadow-sm transition-transform ${checked ? 'translate-x-[18px] bg-on-accent' : 'translate-x-[2px] bg-fg-3'}`} />
  </button>
);
