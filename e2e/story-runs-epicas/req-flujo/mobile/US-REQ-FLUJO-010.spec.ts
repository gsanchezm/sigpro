import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { ACCOUNT_CELLS, BUTTON_CELLS, TARGET_OF_BUTTON, webPrepFailed } from '../web/common';
import { describeReason, disabledMobile, openRequirements, openSheet, prepareMobile, readFlowMobile, reasonOfButton, transitionButtonM, transitionContainers, verdictMobile, type MobileStep } from './common';

// US-REQ-FLUJO-010 — Botones de transición en la hoja del requisito (app móvil en Expo web, 390 px). Solo el paso actual contiene botones; un
// botón que el rol no puede pulsar queda deshabilitado y su motivo va como texto visible debajo. Preparación de cada fila: reinicio de alumno01,
// inicio de sesión en la app con alumno01 en «Tenant de trabajo» y apertura de la hoja desde la lista de /programs/<programa>/requirements.

/** Paso del flujo de la celda «paso» → su estado. */
const STEP_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Redacción', 'draft'],
  ['Aprobación', 'approved'],
  ['Verificación', 'verified'],
  ['Validación', 'validated'],
]);

/** Lista de botones de la celda «botones», en el orden en que los muestra el paso. */
const BUTTON_LIST_CELLS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['«Aprobar»', ['Aprobar']],
  ['«Marcar como verificado» y «Volver a borrador»', ['Marcar como verificado', 'Volver a borrador']],
  ['«Validar» y «Volver a borrador»', ['Validar', 'Volver a borrador']],
  ['«Volver a borrador»', ['Volver a borrador']],
]);

/** Celda «habilitado». */
const ENABLED_CELLS: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['está habilitado', true],
  ['está deshabilitado', false],
]);

/** Motivo visible debajo del botón; «(ninguno)» si el botón está habilitado (no se muestra motivo). */
const REASON_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(ninguno)', undefined],
  ['«Solo el gestor de programa o el admin pueden aprobar»', 'Solo el gestor de programa o el admin pueden aprobar'],
  ['«Solo el consultor o el admin pueden verificar»', 'Solo el consultor o el admin pueden verificar'],
  ['«Solo el gestor de programa o el admin pueden devolver a borrador»', 'Solo el gestor de programa o el admin pueden devolver a borrador'],
  ['«Solo el auditor o el admin pueden validar»', 'Solo el auditor o el admin pueden validar'],
]);

const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
  ['REQ-003', 'REQ-003'],
]);
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

const listOf = (names: readonly string[] | undefined): string => (names === undefined ? '(no legible)' : names.length === 0 ? '(ninguno)' : names.map((name) => `«${name}»`).join(' y '));
const sameNames = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((name, index) => name === expected[index]);

/** Esquema 1: solo el paso actual de la hoja contiene los botones de transición, y son los que dice la celda. */
const currentStepButtonsMobile: BrowserRowHandler = async (row, { page }) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedStep = strict('paso', STEP_CELLS, cell(row, 'paso'));
  const buttonNames = strict('botones', BUTTON_LIST_CELLS, cell(row, 'botones'));
  const expected = `el paso actual es ${cell(row, 'paso')} y contiene los botones ${cell(row, 'botones')}; ningún otro paso contiene botones de transición`;

  const failure = await prepareMobile(page, strict('cuenta', ACCOUNT_CELLS, 'alumno01@sigpro.lab'));
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const listed = await openRequirements(page, programCode);
  if (listed !== undefined) return webPrepFailed(expected, listed);
  const opened = await openSheet(page, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);

  const flow: readonly MobileStep[] = await readFlowMobile(page);
  const containers = await transitionContainers(page);
  const current = flow.filter((step) => step.status === 'current');
  const readableSteps = flow.filter((step) => step.status !== undefined).length;
  const onCurrent = current.length === 1 ? current[0] : undefined;
  const others = flow.filter((step) => step.state !== expectedStep);
  const otherUnreadable = others.some((step) => step.buttons === undefined);
  const otherButtons = others.reduce<number>((total, step) => total + (step.buttons?.length ?? 0), 0);

  return verdictMobile([
    check(
      onCurrent?.state === expectedStep,
      `el paso actual es ${cell(row, 'paso')}`,
      `el paso actual es ${onCurrent === undefined ? `(${current.length} pasos actuales)` : (onCurrent.name ?? '(nombre no legible)')}`,
    ),
    check(onCurrent?.name === cell(row, 'paso'), `el nombre del paso actual en la interfaz es ${cell(row, 'paso')}`, `el nombre del paso actual en la interfaz es «${onCurrent?.name ?? '(no legible)'}»`),
    check(sameNames(onCurrent?.visibleButtons, buttonNames), `contiene los botones ${cell(row, 'botones')}`, `contiene los botones ${listOf(onCurrent?.visibleButtons)}`),
    check(!otherUnreadable && otherButtons === 0 && containers === 1, 'ningún otro paso contiene botones de transición', otherUnreadable ? 'botones de otro paso no legibles' : `botones fuera del paso actual: ${otherButtons}; contenedores de botones: ${containers}`),
    check(readableSteps === flow.length, 'los cuatro pasos del flujo son legibles', `pasos legibles: ${readableSteps} de ${flow.length}`),
  ]);
};

/** Esquema 2: un botón del paso actual, habilitado o deshabilitado, con su motivo visible debajo. */
const enabledOrDeniedMobile: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const enabled = strict('habilitado', ENABLED_CELLS, cell(row, 'habilitado'));
  const expectedReason = strict('motivo', REASON_CELLS, cell(row, 'motivo'));
  const expected = `el botón ${buttonName} ${enabled ? 'está habilitado' : 'está deshabilitado'} y el motivo visible es ${cell(row, 'motivo')}`;

  const failure = await prepareMobile(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const listed = await openRequirements(page, programCode);
  if (listed !== undefined) return webPrepFailed(expected, listed);
  const opened = await openSheet(page, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);

  const button = transitionButtonM(page, buttonName);
  const found = await button.count();
  if (found !== 1) return verdictMobile([check(false, `aparece el botón ${buttonName} en el paso actual`, found === 0 ? `no aparece el botón ${buttonName} en el paso actual` : `aparecen ${found} botones ${buttonName}`)]);
  const disabled = await disabledMobile(button);
  const reading = await reasonOfButton(page, TARGET_OF_BUTTON.get(buttonName) ?? '');
  const reasonOk = expectedReason === undefined ? reading.kind === 'ninguno' : reading.kind === 'visible' && reading.text === expectedReason;

  return verdictMobile([
    check(
      disabled === !enabled,
      `el botón ${buttonName} ${enabled ? 'está habilitado' : 'está deshabilitado'}`,
      disabled === undefined ? `el botón ${buttonName} no se puede leer` : `el botón ${buttonName} ${disabled ? 'está deshabilitado' : 'está habilitado'}`,
    ),
    check(reasonOk, `motivo visible ${expectedReason ?? '(ninguno)'}`, `motivo visible ${describeReason(reading)}`),
  ]);
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-010',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, currentStepButtonsMobile],
    [2, enabledOrDeniedMobile],
  ]),
});
