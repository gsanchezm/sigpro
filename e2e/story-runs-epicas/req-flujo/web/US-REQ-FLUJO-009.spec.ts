import { REQUISITOS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, STATE_CELLS, STATE_LABEL, detailState, eqCheck, flowOf, openDetail, prepareWeb, readFlow, verdictWeb, webPrepFailed, type StepRead } from './common';

// US-REQ-FLUJO-009 — Estado con su nombre y flujo de aprobación en sus cuatro pasos (web). Los pasos anteriores al estado figuran hechos; el
// del estado figura como paso actual y los posteriores como pendientes. El indicador de un paso hecho muestra ✓ en lugar de su número (la
// historia lo pide así, tras corregir su redacción con el sistema de diseño). Preparación: reinicio de alumno01, inicio de sesión de gestor@sigpro.test y detalle abierto.

/** Requisitos y programas de las celdas (los del seed). */
const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
  ['REQ-003', 'REQ-003'],
]);
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-002', 'PRG-002'],
  ['PRG-001', 'PRG-001'],
]);

/** Celdas de cada paso: «paso actual», «hecho» o «pendiente» (la línea de estado del paso). */
const STEP_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['paso actual', 'current'],
  ['hecho', 'done'],
  ['pendiente', 'future'],
]);

/** Texto con el que se lee cada línea de estado (el mismo de la historia). */
const PHRASE_OF: ReadonlyMap<string, string> = new Map<string, string>([
  ['done', 'hecho'],
  ['current', 'paso actual'],
  ['future', 'pendiente'],
]);

/** Los cuatro pasos en orden: columna de la tabla, estado del paso y nombre en la interfaz. */
const STEPS: readonly { readonly column: string; readonly state: string; readonly name: string; readonly number: number }[] = [
  { column: 'redaccion', state: 'draft', name: 'Redacción', number: 1 },
  { column: 'aprobacion', state: 'approved', name: 'Aprobación', number: 2 },
  { column: 'verificacion', state: 'verified', name: 'Verificación', number: 3 },
  { column: 'validacion', state: 'validated', name: 'Validación', number: 4 },
];

const phraseOf = (status: string | undefined): string => (status === undefined ? '(no legible)' : (PHRASE_OF.get(status) ?? status));

/** Estado del requisito con su nombre y los cuatro pasos del flujo, según lo que muestra el detalle. */
const flowAdvance: BrowserRowHandler = async (row, { page }) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedState = strict('estado', STATE_CELLS, cell(row, 'estado'));
  const expected = `el estado se lee ${cell(row, 'estado')}; Redacción ${cell(row, 'redaccion')}, Aprobación ${cell(row, 'aprobacion')}, Verificación ${cell(row, 'verificacion')} y Validación ${cell(row, 'validacion')}`;

  const failure = await prepareWeb(page, strict('cuenta', ACCOUNT_CELLS, 'gestor@sigpro.test'));
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);

  const badge = await detailState(page);
  const flow = await readFlow(page);
  const current = flow.filter((step) => step.status === 'current');

  // Cada celda se lee por su columna literal: el mapa de cada paso sale de la fila, no de una variable.
  const wantedStatus: ReadonlyMap<string, string> = new Map<string, string>([
    ['draft', strict('redaccion', STEP_CELLS, cell(row, 'redaccion'))],
    ['approved', strict('aprobacion', STEP_CELLS, cell(row, 'aprobacion'))],
    ['verified', strict('verificacion', STEP_CELLS, cell(row, 'verificacion'))],
    ['validated', strict('validacion', STEP_CELLS, cell(row, 'validacion'))],
  ]);
  // Los cuatro pasos deben aparecer en el DOM en este orden (la historia dice «en este orden»).
  const order = await flowOf(page).locator('[data-testid^="requirement-flow-step-"]').evaluateAll((items) => items.map((item) => item.getAttribute('data-testid') ?? ''));
  const expectedOrder = STEPS.map((step) => REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_FLOW_STEP(step.state));
  const orderName = (testId: string): string => STEPS.find((step) => testId.endsWith(step.state))?.name ?? testId;

  const stepChecks = STEPS.flatMap((step) => {
    const wanted = wantedStatus.get(step.state) ?? '(sin celda)';
    const read: StepRead | undefined = flow.find((entry) => entry.state === step.state);
    const status = check(read?.status === wanted, `${step.name} ${cell(row, step.column)}`, `${step.name} ${phraseOf(read?.status)}`);
    // La historia pide ✓ en el punto del paso hecho, en lugar de su número: el indicador debe ser exactamente ✓.
    const indicator =
      wanted === 'done'
        ? [
            check(
              read?.dot !== undefined && read.dot.trim() === '✓',
              `el indicador de ${step.name} muestra ✓ en lugar de su número`,
              `el indicador de ${step.name} muestra «${read?.dot ?? '(no legible)'}»`,
            ),
          ]
        : [];
    return [status, ...indicator];
  });

  return verdictWeb([
    eqCheck('el estado se lee', badge.label, STATE_LABEL.get(expectedState) ?? expectedState),
    check(
      JSON.stringify(order) === JSON.stringify(expectedOrder),
      'los cuatro pasos aparecen en orden: Redacción, Aprobación, Verificación y Validación',
      `orden en pantalla: ${order.length === 0 ? '(ninguno)' : order.map(orderName).join(', ')}`,
    ),
    check(current.length === 1, 'exactamente un paso actual', `pasos actuales: ${current.length}`),
    ...stepChecks,
  ]);
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([[1, flowAdvance]]),
});
