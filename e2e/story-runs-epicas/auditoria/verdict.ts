import { conclude, type Check } from '../support/checks';
import type { Outcome } from '../core/framework';

/** Lectura imposible (no hay contenedor, no hay elemento): no es un hallazgo sobre la app, es un fallo del arnés (la nota dice por qué). */
export const unreadableOf = (expected: string, observed: string, note: string): Outcome => ({ verdict: 'error-de-prueba', expected, observed, note });

// Veredicto de una fila de EP-AUDITORIA: como `conclude` del arnés, pero una fila `discrepa` lleva SIEMPRE una nota con en qué
// difiere (lección 7): las comprobaciones que no se cumplen, con lo que la historia espera y lo que se midió. Las notas propias de la
// fila (mecanismo, advertencias) se conservan delante de esa lista, nunca la sustituyen.

export const verdictOf = (checks: readonly Check[], extra: Pick<Outcome, 'note' | 'evidence'> = {}): Outcome => {
  const result = conclude(checks, extra.evidence === undefined ? {} : { evidence: extra.evidence });
  if (result.verdict !== 'discrepa') return extra.note === undefined ? result : { ...result, note: extra.note };
  const differs = checks.filter((entry) => !entry.ok).map((entry) => `${entry.expected} (medido: ${entry.observed})`);
  const note = [extra.note, `Difiere en: ${differs.join('; ')}`].filter((part): part is string => part !== undefined).join(' ');
  return { ...result, note };
};

/** Lectura del total de una respuesta de la auditoría: «(sin leer)» si el cuerpo no lo trae (nunca «undefined»). */
export const shownTotal = (total: number | undefined): string => (total === undefined ? '(sin leer)' : String(total));

/** Nota común de las filas que provocan un fallo con StrictMode (web y móvil): por qué la prueba responde 500 a todas las peticiones. */
export const STRICTMODE_NOTE =
  'La prueba responde 500 a todas las peticiones coincidentes mientras está encendida (hasta «Reintentar» o «Cargar más»), no solo a la primera: la pantalla monta dos veces en desarrollo (StrictMode, apps/web/src/main.tsx:22) y su primera respuesta se descarta.';

/** Nota común de las filas con un aviso de traza: su formato no está decidido, así que solo se comprueba su presencia. */
export const TRACE_NOTE = 'La traza del error solo se comprueba por su presencia: su formato no está decidido en la historia (Decisiones pendientes).';

/** Nota común de las filas que miden ventanas de tiempo: el instante del evento se compara con el reloj del propio runner (mismo host). */
export const CLOCK_NOTE = 'La ventana de tiempo del evento usa el reloj del runner (el mismo host que la API); no se compara con el reloj de la base.';
