import { NC_SEVERITIES, type NcSeverity } from '@sigpro/shared';

// Reglas puras del selector de severidad (`<sigpro-severity-picker>`): se prueban en Node, sin DOM.

export const isSeverity = (value: unknown): value is NcSeverity => typeof value === 'string' && (NC_SEVERITIES as readonly string[]).includes(value);

export type SeverityLabels = Readonly<Record<NcSeverity, string>>;

/** Textos por defecto (español): si el atributo `labels` falta o llega roto se usan estos. */
export const DEFAULT_SEVERITY_LABELS: SeverityLabels = { minor: 'Menor', major: 'Mayor', critical: 'Crítica' };

/** Lee el atributo `labels` (JSON `{"minor":"…","major":"…","critical":"…"}`); lo inválido cae en los valores por defecto. */
export const parseSeverityLabels = (raw: string | null): SeverityLabels => {
  if (!raw) return DEFAULT_SEVERITY_LABELS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SEVERITY_LABELS;
    const record = parsed as Record<string, unknown>;
    const pick = (severity: NcSeverity): string => (typeof record[severity] === 'string' && record[severity] !== '' ? (record[severity] as string) : DEFAULT_SEVERITY_LABELS[severity]);
    return { minor: pick('minor'), major: pick('major'), critical: pick('critical') };
  } catch {
    return DEFAULT_SEVERITY_LABELS;
  }
};

/** Mapa de despacho tecla → nueva posición (índice) dentro de `count` opciones; `null` si la tecla no mueve el foco. */
const MOVES: ReadonlyMap<string, (index: number, count: number) => number> = new Map([
  ['ArrowRight', (index, count) => (index + 1) % count],
  ['ArrowDown', (index, count) => (index + 1) % count],
  ['ArrowLeft', (index, count) => (index - 1 + count) % count],
  ['ArrowUp', (index, count) => (index - 1 + count) % count],
  ['Home', () => 0],
  ['End', (_index, count) => count - 1],
]);

export const moveFocusIndex = (key: string, index: number, count: number): number | null => {
  if (count <= 0) return null;
  return MOVES.get(key)?.(index, count) ?? null;
};

/** Enter y Espacio eligen la opción enfocada. */
export const isSelectKey = (key: string): boolean => key === 'Enter' || key === ' ' || key === 'Spacebar';

/** Opción que lleva el tabindex 0 (roving tabindex): la elegida o, si no hay, la primera. */
export const tabStopIndex = (value: NcSeverity | null): number => (value === null ? 0 : NC_SEVERITIES.indexOf(value));
