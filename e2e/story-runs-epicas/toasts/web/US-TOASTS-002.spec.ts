import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { quoted, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  DESKTOP,
  ROLE_OF_CELL,
  TONE_OF_CELL,
  TRANSVERSAL_NOTE,
  actionFailed,
  armToasts,
  awaitTitle,
  badgeOf,
  conclude,
  onPrograms,
  programStateLabel,
  restoringChaos,
  roleCheck,
  rowAction,
  setErrorRate,
  signInWeb,
  toastChecks,
  withNote,
} from './common';

// US-TOASTS-002 — Error del servidor (transversal; sus filas se miran en la web, 1440 px). Preparación de cada fila: reinicio de
// alumno01, inicio de sesión de gestor@sigpro.test hasta /programs y, si la fila fija una tasa, PATCH /api/admin/chaos con latencia 0 y
// errorRate 1 (solo falla las escrituras). El caos se apaga al terminar la fila, también si falla. El cuerpo del aviso de error no se
// compara (la historia lo deja en «Decisiones pendientes»). El estado de PRG-001 se comprueba en la API (persistencia) y en la insignia de
// su fila (lo que ve la persona).

/** Tasa de error de la celda (texto) → fracción del caos. */
const RATES: ReadonlyMap<string, number> = new Map<string, number>([
  ['0', 0],
  ['100', 1],
]);

const archiveWithRate: BrowserRowHandler = restoringChaos(async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `aviso de ${cell(row, 'tono')} con el título ${cell(row, 'titulo')}; se anuncia con el rol de ${cell(row, 'rol')}; PRG-001 queda con el estado ${cell(row, 'estado_programa')}`;
  const tone = strict('tono', TONE_OF_CELL, cell(row, 'tono'));
  const role = strict('rol', ROLE_OF_CELL, cell(row, 'rol'));
  const rate = strict('tasa', RATES, cell(row, 'tasa'));
  const title = quoted(cell(row, 'titulo'));
  const stateLabel = quoted(cell(row, 'estado_programa'));
  const prepared = await signInWeb(page, DESKTOP, DEMO.gestor.email, DEMO.gestor.password);
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const rateStatus = await setErrorRate(rate);
  if (rateStatus !== 200) return preparationFailedWeb(expected, `PATCH /api/admin/chaos respondió ${rateStatus}`);
  await armToasts(page);
  const blocked = await rowAction('PRG-001', 'Archivar', onPrograms)(page);
  if (blocked !== undefined) return actionFailed(expected, blocked);
  const seen = await awaitTitle(page, title);
  // La insignia de la fila se lee cuando la lista se ha vuelto a cargar (plazo de la prueba para una reacción de red)
  await waitUntil(async () => (await badgeOf(page, 'PRG-001')) === stateLabel);
  const badge = await badgeOf(page, 'PRG-001');
  const state = await programStateLabel('PRG-001');
  return conclude([
    ...toastChecks(seen, tone, title),
    roleCheck(seen, role),
    check(state === stateLabel, `PRG-001 queda con el estado «${stateLabel}» en la API`, `PRG-001 queda con el estado «${state ?? '(sin leer)'}» en la API`),
    check(badge === stateLabel, `la fila de PRG-001 muestra «${stateLabel}»`, `la fila de PRG-001 muestra «${badge ?? '(sin leer)'}»`),
  ]);
});

defineBrowserRows({
  story: 'US-TOASTS-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, withNote(withNote(archiveWithRate, COOKIE_NOTE), TRANSVERSAL_NOTE)]]),
});
