import type { ReactNode } from 'react';

interface FilterChipProps {
  readonly active: boolean;
  readonly children: ReactNode;
  /** «×» para quitar el filtro (solo con el chip activo). */
  readonly clear?: { readonly label: string; readonly testId: string; readonly onClear: () => void };
  /** Chevrón de los chips con desplegable. */
  readonly caret?: boolean;
}

/**
 * Chip de filtro: el CONTROL NATIVO (select, fecha, combobox) con forma de chip, siempre en el DOM y operable (así `selectOption`,
 * `fill` y `getByLabel` siguen funcionando). Vacío = píldora discontinua «+ Etiqueta»; activo = píldora suave con el valor y «×».
 */
export const FilterChip = ({ active, children, clear, caret = false }: FilterChipProps) => (
  <div className="chip" data-active={active}>
    {children}
    {caret && !active ? <span aria-hidden="true" className="chip-caret" /> : null}
    {active && clear ? (
      <button type="button" data-testid={clear.testId} aria-label={clear.label} onClick={clear.onClear} className="chip-x">
        ×
      </button>
    ) : null}
  </div>
);
