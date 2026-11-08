import { useEffect, useRef } from 'react';

interface RangeSliderProps {
  readonly id?: string;
  readonly testId: string;
  /** Nombre accesible cuando no hay `<label for>` visible. */
  readonly label?: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  /** Texto que lee el lector de pantalla («60 %»). */
  readonly valueText: string;
  /** Mientras se arrastra o se escribe (evento `input`). */
  readonly onChange: (value: number) => void;
  /** Al soltar o confirmar (evento nativo `change`): `fill()` de Playwright, las flechas y el arrastre lo disparan una vez. */
  readonly onCommit?: (value: number) => void;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly className?: string;
}

/**
 * `<input type="range">` con `aria-valuenow` y `aria-valuetext` explícitos (el valor nativo no siempre es un atributo
 * localizable con `toHaveAttribute`). La confirmación se engancha al evento nativo `change`, no al `input` de React,
 * para no lanzar una petición por cada paso del arrastre.
 */
export const RangeSlider = ({ id, testId, label, min, max, step, value, valueText, onChange, onCommit, disabled = false, title, className }: RangeSliderProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const handler = () => commitRef.current?.(input.valueAsNumber);
    input.addEventListener('change', handler);
    return () => input.removeEventListener('change', handler);
  }, []);

  return (
    <input
      ref={ref}
      id={id}
      type="range"
      data-testid={testId}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(event.target.valueAsNumber)}
      className={`h-4 cursor-pointer accent-accent disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ''}`}
    />
  );
};
