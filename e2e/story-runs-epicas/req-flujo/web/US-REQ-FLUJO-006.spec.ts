import { cell, check, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACCOUNT_CELLS, BUTTON_CELLS, COOKIE_NOTE, attrOf, disabledOf, openDetail, prepareWeb, readFlow, transitionButton, verdictWeb, webPrepFailed, type StepRead } from './common';

// US-REQ-FLUJO-006 — Botones de transición en el detalle (web, escritorio 1440 px). Solo el paso actual contiene botones; un botón que el rol no
// puede pulsar queda deshabilitado y su explicación va en el atributo `title` (el tooltip nativo no se ve en pantalla: la lectura es del
// atributo). Preparación de cada fila: reinicio de alumno01, inicio de sesión de la cuenta de la fila en /login?tenant=alumno01 y apertura
// del detalle desde el árbol de /programs/<programa>/requirements.

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

/** Explicación de un botón deshabilitado (su texto va en `title`); «(ninguna)» si el botón está habilitado. */
const EXPLANATION_CELLS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['(ninguna)', undefined],
  ['«Solo el gestor de programa o el admin pueden aprobar»', 'Solo el gestor de programa o el admin pueden aprobar'],
  ['«Solo el consultor o el admin pueden verificar»', 'Solo el consultor o el admin pueden verificar'],
  ['«Solo el gestor de programa o el admin pueden devolver a borrador»', 'Solo el gestor de programa o el admin pueden devolver a borrador'],
  ['«Solo el auditor o el admin pueden validar»', 'Solo el auditor o el admin pueden validar'],
]);

/** Requisitos de las celdas (los del seed). */
const REQUIREMENT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-017', 'REQ-017'],
  ['REQ-001', 'REQ-001'],
  ['REQ-002', 'REQ-002'],
  ['REQ-003', 'REQ-003'],
]);

/** Programas de las celdas (los del seed). */
const PROGRAM_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-002', 'PRG-002'],
]);

/** Lista de nombres de botones, o «(no legible)» si la lectura falló. */
const listOf = (names: readonly string[] | undefined): string => (names === undefined ? '(no legible)' : names.length === 0 ? '(ninguno)' : names.map((name) => `«${name}»`).join(' y '));

const sameNames = (actual: readonly string[] | undefined, expected: readonly string[]): boolean =>
  actual !== undefined && actual.length === expected.length && actual.every((name, index) => name === expected[index]);

/** Esquema 1: solo el paso actual contiene botones de transición, y son los que dice la celda. */
const currentStepButtons: BrowserRowHandler = async (row, { page }) => {
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const expectedStep = strict('paso', STEP_CELLS, cell(row, 'paso'));
  const buttonNames = strict('botones', BUTTON_LIST_CELLS, cell(row, 'botones'));
  const expected = `el paso actual es ${cell(row, 'paso')} y contiene los botones ${cell(row, 'botones')}; ningún otro paso contiene botones de transición`;

  const failure = await prepareWeb(page, strict('cuenta', ACCOUNT_CELLS, 'alumno01@sigpro.lab'));
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);

  const flow = await readFlow(page);
  const current = flow.filter((step) => step.status === 'current');
  const onCurrent: StepRead | undefined = current.length === 1 ? current[0] : undefined;
  const others = flow.filter((step) => step.state !== expectedStep);
  const unreadable = others.some((step) => step.buttons === undefined);
  // Un paso cuyo estado no se lee no cuenta como «sin botones»: se exige que los cuatro pasos tengan línea de estado legible.
  const readable = flow.filter((step) => step.status !== undefined).length;
  const otherButtons = others.reduce<number>((total, step) => total + (step.buttons?.length ?? 0), 0);

  return verdictWeb([
    check(
      onCurrent?.state === expectedStep,
      `el paso actual es ${cell(row, 'paso')}`,
      `el paso actual es ${onCurrent === undefined ? `(${current.length} pasos actuales)` : (onCurrent.name ?? '(nombre no legible)')}`,
    ),
    check(onCurrent?.name === cell(row, 'paso'), `el nombre del paso actual en la interfaz es ${cell(row, 'paso')}`, `el nombre del paso actual en la interfaz es «${onCurrent?.name ?? '(no legible)'}»`),
    check(sameNames(onCurrent?.visibleButtons, buttonNames), `contiene los botones ${cell(row, 'botones')}`, `contiene los botones ${listOf(onCurrent?.visibleButtons)}`),
    check(!unreadable && otherButtons === 0, 'ningún otro paso contiene botones de transición', unreadable ? 'botones de otro paso no legibles' : `otros pasos con botones: ${otherButtons}`),
    check(readable === flow.length, 'los cuatro pasos del flujo son legibles', `pasos legibles: ${readable} de ${flow.length}`),
  ]);
};

/** Esquema 2: un botón del paso actual, habilitado o deshabilitado, con su explicación en `title`. */
const enabledOrDenied: BrowserRowHandler = async (row, { page }) => {
  const account = strict('cuenta', ACCOUNT_CELLS, cell(row, 'cuenta'));
  const requirementCode = strict('requisito', REQUIREMENT_CELLS, cell(row, 'requisito'));
  const programCode = strict('programa', PROGRAM_CELLS, cell(row, 'programa'));
  const buttonName = strict('boton', BUTTON_CELLS, cell(row, 'boton'));
  const enabled = strict('habilitado', ENABLED_CELLS, cell(row, 'habilitado'));
  const explanation = strict('explicacion', EXPLANATION_CELLS, cell(row, 'explicacion'));
  const expected = `el botón ${buttonName} ${enabled ? 'está habilitado' : 'está deshabilitado'} y su explicación es ${cell(row, 'explicacion')}`;

  const failure = await prepareWeb(page, account);
  if (failure !== undefined) return webPrepFailed(expected, failure);
  const opened = await openDetail(page, programCode, requirementCode);
  if (opened !== undefined) return webPrepFailed(expected, opened);

  const button = transitionButton(page, buttonName);
  const found = await button.count();
  if (found !== 1) {
    return verdictWeb([check(false, `aparece el botón ${buttonName} en el paso actual`, found === 0 ? `no aparece el botón ${buttonName} en el paso actual` : `aparecen ${found} botones ${buttonName}`)]);
  }
  const disabled = await disabledOf(button);
  // `title` ausente (null) significa «sin explicación»; una lectura fallida (undefined) no cuenta como ausente.
  const titleRead = await attrOf(button, 'title');
  const explanationRead = titleRead === undefined ? '(no legible)' : titleRead === null ? '(ninguna)' : titleRead;

  return verdictWeb(
    [
      check(
        disabled === !enabled,
        `el botón ${buttonName} ${enabled ? 'está habilitado' : 'está deshabilitado'}`,
        disabled === undefined ? `el botón ${buttonName} no se puede leer` : `el botón ${buttonName} ${disabled ? 'está deshabilitado' : 'está habilitado'}`,
      ),
      check(
        titleRead !== undefined && (explanation === undefined ? titleRead === null : titleRead === explanation),
        `explicación ${explanation ?? '(ninguna)'}`,
        `explicación ${explanationRead}`,
      ),
    ],
    `${COOKIE_NOTE} La explicación se lee del atributo title del botón: el tooltip nativo no es observable en pantalla.`,
  );
};

defineBrowserRows({
  story: 'US-REQ-FLUJO-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, currentStepButtons],
    [2, enabledOrDenied],
  ]),
});
