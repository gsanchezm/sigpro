import type { Tone } from '@sigpro/shared';

interface ToneBadgeProps {
  /** Valor del dominio (`approved`, `pass`, `restricted`…): va en `data-state` para los locators CSS. */
  readonly state: string;
  readonly tone: Tone;
  readonly label: string;
  readonly testId: string;
  /** Atributo `data-severity` opcional (badges de severidad). */
  readonly severity?: string;
}

/** Badge genérico (requisito, resultado de prueba, clasificación…) con `data-state`/`data-tone`. Mismo aspecto que `StatusBadge`. */
export const ToneBadge = ({ state, tone, label, testId, severity }: ToneBadgeProps) => (
  <span data-testid={testId} data-state={state} data-tone={tone} data-severity={severity} className="badge badge-row">
    {label}
  </span>
);
