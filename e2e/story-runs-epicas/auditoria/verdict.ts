import { conclude, type Check } from '../support/checks';
import type { Outcome } from '../core/framework';

/** Lectura imposible (no hay contenedor, no hay elemento): no es un hallazgo sobre la app, es un fallo del arnés (la nota dice por qué). */
export const unreadableOf = (expected: string, observed: string, note: string): Outcome => ({ verdict: 'error-de-prueba', expected, observed, note });

// Veredicto de una fila de EP-AUDITORIA: como `conclude` del arnés, pero una fila `discrepa` lleva SIEMPRE una nota con en qué
// difiere (lección 7): las comprobaciones que no se cumplen, con lo que la historia espera y lo que se midió.

export const verdictOf = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const result = conclude(checks, extra);
  if (result.verdict !== 'discrepa' || result.note !== undefined) return result;
  const differs = checks.filter((entry) => !entry.ok).map((entry) => `${entry.expected} (medido: ${entry.observed})`);
  return { ...result, note: `Difiere en: ${differs.join('; ')}` };
};

/** Lectura del total de una respuesta de la auditoría: «(sin leer)» si el cuerpo no lo trae (nunca «undefined»). */
export const shownTotal = (total: number | undefined): string => (total === undefined ? '(sin leer)' : String(total));
