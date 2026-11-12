// Reglas puras del selector de severidad móvil. Son las de `<sigpro-severity-picker>` de la web (apps/web/src/ui/
// severity-picker-rules.ts) que valen sin teclado ni Shadow DOM: tres opciones de selección única, en el orden de
// `NC_SEVERITIES`, y sin valor inicial en el alta. Se copian aquí porque el archivo de la web no está en `@sigpro/shared`.
// Sin imports de react-native: se prueba con Vitest en Node (`severity.test.ts`).
import { NC_SEVERITIES, type NcSeverity } from '@sigpro/shared';

export const isSeverity = (value: unknown): value is NcSeverity => typeof value === 'string' && (NC_SEVERITIES as readonly string[]).includes(value);

/** Valor del selector: una severidad o `null` (alta sin elegir). */
export type SeverityValue = NcSeverity | null;

/** La opción `severity` está elegida. */
export const isChosen = (value: SeverityValue, severity: NcSeverity): boolean => value === severity;

/**
 * Resultado de pulsar una opción: la nueva severidad, o `null` si no hay que avisar (el selector no cambia de valor al
 * pulsar la ya elegida y un valor que no es una severidad se ignora).
 */
export const pick = (current: SeverityValue, next: unknown): NcSeverity | null => (isSeverity(next) && next !== current ? next : null);
