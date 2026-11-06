import type { InputHTMLAttributes, ReactNode, Ref } from 'react';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'id'> {
  /** Id del input; el label se enlaza con `htmlFor` (nunca placeholder como única etiqueta). */
  readonly id: string;
  readonly label: string;
  /** `data-testid` del input (viene de testids.ts). */
  readonly testId: string;
  readonly errorTestId?: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly error?: string;
  readonly help?: string;
  readonly inputRef?: Ref<HTMLInputElement>;
  /** Contenido a la derecha del label (p. ej. "¿Olvidaste la contraseña?"). */
  readonly labelAside?: ReactNode;
  /** Contenido superpuesto dentro del input (p. ej. botón mostrar/ocultar). */
  readonly endSlot?: ReactNode;
  readonly inputClassName?: string;
}

/** Label + input + mensaje de error asociado por aria-describedby. */
export const TextField = ({
  id,
  label,
  testId,
  errorTestId,
  value,
  onValueChange,
  error,
  help,
  inputRef,
  labelAside,
  endSlot,
  inputClassName = '',
  ...rest
}: TextFieldProps) => {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const describedBy = [error ? errorId : null, help && !error ? helpId : null].filter(Boolean).join(' ') || undefined;

  const input = (
    <input
      {...rest}
      id={id}
      ref={inputRef}
      data-testid={testId}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      className={`input ${endSlot ? 'pr-[72px]' : ''} ${inputClassName}`}
    />
  );

  return (
    <div className="flex flex-col gap-1">
      {labelAside ? (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="label">
            {label}
          </label>
          {labelAside}
        </div>
      ) : (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {endSlot ? (
        <div className="relative">
          {input}
          {endSlot}
        </div>
      ) : (
        input
      )}
      {error ? (
        <span id={errorId} data-testid={errorTestId} className="field-error">
          {error}
        </span>
      ) : null}
      {help && !error ? (
        <span id={helpId} className="field-help">
          {help}
        </span>
      ) : null}
    </div>
  );
};
