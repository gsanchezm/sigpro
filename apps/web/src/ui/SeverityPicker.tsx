import { useEffect, useLayoutEffect, useRef } from 'react';
import type { NcSeverity } from '@sigpro/shared';
import { defineSeverityPicker } from './severity-picker';
import { isSeverity, type SeverityLabels } from './severity-picker-rules';

defineSeverityPicker();

interface SeverityPickerProps {
  readonly value: NcSeverity | null;
  readonly onChange: (severity: NcSeverity) => void;
  /** Nombre accesible del listbox. */
  readonly label: string;
  /** Textos ya traducidos de las tres severidades. */
  readonly labels: SeverityLabels;
  readonly testId: string;
  readonly disabled?: boolean;
  /** Motivo por el que está deshabilitado (`title` del host). */
  readonly disabledTitle?: string;
}

/**
 * Envoltorio React de `<sigpro-severity-picker>`. Los atributos del custom element se asignan por la referencia y el
 * evento `change` se engancha con `addEventListener` (React 18 no enlaza eventos personalizados por props).
 */
export const SeverityPicker = ({ value, onChange, label, labels, testId, disabled = false, disabledTitle }: SeverityPickerProps) => {
  const ref = useRef<HTMLElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const labelsJson = JSON.stringify(labels);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (value) element.setAttribute('value', value);
    else element.removeAttribute('value');
    element.setAttribute('labels', labelsJson);
    element.setAttribute('label', label);
    if (disabled) element.setAttribute('disabled', '');
    else element.removeAttribute('disabled');
  }, [value, labelsJson, label, disabled]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const handler = (event: Event) => {
      const detail: unknown = event instanceof CustomEvent ? (event.detail as { value?: unknown } | null)?.value : undefined;
      if (isSeverity(detail)) onChangeRef.current(detail);
    };
    element.addEventListener('change', handler);
    return () => element.removeEventListener('change', handler);
  }, []);

  // El nombre accesible vive solo en el listbox del shadow (un `aria-label` también en el host haría ambiguo `getByLabel`)
  return <sigpro-severity-picker ref={ref} data-testid={testId} title={disabled ? disabledTitle : undefined} />;
};
