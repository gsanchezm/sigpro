import type { Locator, Page } from '@playwright/test';
import { ACTION, CEILING_MS, attrOf, isVisible, waitUntil } from '../../support/browser';
import { cell, check, strict, type Check } from '../../support/checks';
import { defineBrowserRows, notExecutable, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  ADMIN_TESTIDS,
  AUDITORIA_TESTIDS,
  HITOS_DYNAMIC_TESTIDS,
  HITOS_TESTIDS,
  REQUISITOS_DYNAMIC_TESTIDS,
  REQUISITOS_TESTIDS,
} from '../../../../packages/shared/src/testids';
import { ROLE_LOGIN, blocked, conclude, interact, loginAs, parseWebState, quotedItems, resetAlumno01, stateCheck, stateOf } from './common';

// US-MULTITENANT-PERMISOS-008 — Acciones por rol en la web (1440 px). Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador, /login?tenant=alumno01 en un contexto sin sesión y entrada con la cuenta del rol. Un control se mide por su estado
// (aria-disabled / disabled) y por el motivo en su atributo `title`, que es lo que la web muestra al pasar el ratón. Si la pantalla
// correcta no se alcanza (ruta o marca) o falla un clic o un localizador, la fila es `no-ejecutable` con el error como evidencia; si la
// pantalla está y el control no aparece o su estado no coincide, es un hallazgo.

const expectedOf = (text: string): 'habilitado' | { readonly disabledWith: string } => {
  const state = parseWebState(text);
  return state.enabled ? 'habilitado' : { disabledWith: state.reason };
};

/** Espera el control (su aparición o su ausencia dentro del techo) y compara su estado con la celda. */
const inspect = async (control: Locator, label: string, expected: string): Promise<Outcome> => {
  await waitUntil(() => isVisible(control));
  return conclude([stateCheck(await stateOf(control), label, expectedOf(expected))]);
};

/** Abre una ruta y comprueba la marca de la pantalla antes de mirar ningún control: sin marca la pantalla no se alcanzó. */
const openScreen = async (page: Page, path: string, marker: string, expected: string): Promise<Outcome | undefined> => {
  const opened = await interact([[`abrir ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);
  if (opened) return blocked(expected, opened);
  const shown = await waitUntil(() => isVisible(page.getByText(marker, { exact: true })));
  return shown.reached ? undefined : notExecutable(expected, `no se ve «${marker}» en ${path}: la pantalla no se alcanzó`);
};

/** Entra con la cuenta del rol; devuelve el resultado bloqueado si no llega a /programs. */
const enter = async (page: Page, role: string, expected: string): Promise<Outcome | undefined> => {
  const login = await loginAs(page, strict('rol', ROLE_LOGIN, role));
  return login ? blocked(expected, login) : undefined;
};

// --- Esquema 1: eliminar un programa desde la lista ---------------------------------------------------------------------------

const deleteFromList: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const menu = page.getByRole('button', { name: 'Acciones para PRG-001', exact: true });
  const opened = await interact([['abrir las acciones de PRG-001', () => menu.click(ACTION)]]);
  if (opened) return blocked(expected, opened);
  return inspect(page.getByRole('menuitem', { name: 'Eliminar', exact: true }), 'Eliminar', expected);
};

// --- Esquema 2: aprobar un requisito en borrador -------------------------------------------------------------------------------

const approveDraft: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const opened = await interact([
    ['abrir /programs/PRG-002/requirements', () => page.goto('/programs/PRG-002/requirements', { timeout: CEILING_MS })],
    ['abrir el requisito REQ-017', () => page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.REQUIREMENT_OPEN('REQ-017')).click(ACTION)],
  ]);
  if (opened) return blocked(expected, opened);
  // El panel debe ser el de REQ-017 (el árbol anida hijos bajo sus padres): si muestra otro código, la pantalla no es la de la fila
  const panel = page.getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_DETAIL);
  const panelUp = await waitUntil(() => isVisible(panel));
  if (!panelUp.reached) return notExecutable(expected, 'el detalle de REQ-017 no se abrió tras el clic: la pantalla no se alcanzó');
  const shownCode = await attrOf(panel, 'data-code');
  if (shownCode !== 'REQ-017') return notExecutable(expected, `el panel abierto muestra ${shownCode ?? '(sin código)'} y no REQ-017: la pantalla no se alcanzó`);
  return inspect(panel.getByRole('button', { name: 'Aprobar', exact: true }), 'Aprobar', expected);
};

// --- Esquema 3: registrar una ejecución de TC-001 ------------------------------------------------------------------------------

const runForm: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const screen = await openScreen(page, '/verification/TC-001', 'TC-001', expected);
  if (screen) return screen;
  return inspect(page.getByRole('button', { name: 'Registrar ejecución', exact: true }), 'Registrar ejecución', expected);
};

// --- Esquema 4: publicar una versión de DOC-001 ---------------------------------------------------------------------------------

const publishVersion: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const screen = await openScreen(page, '/documents/DOC-001', 'DOC-001', expected);
  if (screen) return screen;
  return inspect(page.getByRole('button', { name: 'Publicar nueva versión', exact: true }), 'Publicar nueva versión', expected);
};

// --- Esquema 5: cerrar NC-003 (paso «Pasar a «Cerrada»») -------------------------------------------------------------------------

const closeNc: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const screen = await openScreen(page, '/nc/NC-003', 'NC-003', expected);
  if (screen) return screen;
  const dialog = page.getByRole('dialog', { name: 'Detalle de NC-003', exact: true });
  const dialogUp = await waitUntil(() => isVisible(dialog));
  if (!dialogUp.reached) return notExecutable(expected, 'el detalle de NC-003 no se abrió en /nc/NC-003: la pantalla no se alcanzó');
  return inspect(dialog.getByRole('button', { name: 'Pasar a «Cerrada»', exact: true }), 'Pasar a «Cerrada»', expected);
};

// --- Esquema 6: eliminar el hito PRG-001-M01 ------------------------------------------------------------------------------------

const deleteMilestone: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'estado');
  await resetAlumno01();
  const blockedAt = await enter(page, cell(row, 'rol'), expected);
  if (blockedAt) return blockedAt;
  const screen = await openScreen(page, '/programs/PRG-001', 'PRG-001', expected);
  if (screen) return screen;
  const opened = await interact([
    ['abrir la pestaña «Hitos»', () => page.getByRole('tab', { name: 'Hitos', exact: true }).click(ACTION)],
    // El ⋯ del hito se nombra con el nombre del hito («SRR»); su id de prueba es el respaldo
    [
      'abrir las acciones del hito PRG-001-M01',
      () =>
        page
          .getByRole('button', { name: 'Acciones para el hito SRR', exact: true })
          .or(page.getByTestId(HITOS_DYNAMIC_TESTIDS.MILESTONE_ROW_MENU('PRG-001-M01')))
          .click(ACTION),
    ],
  ]);
  if (opened) return blocked(expected, opened);
  return inspect(
    page.getByRole('menuitem', { name: 'Eliminar', exact: true }).or(page.getByTestId(HITOS_TESTIDS.MILESTONE_MENU_DELETE)),
    'Eliminar',
    expected,
  );
};

// --- Esquemas 7 y 8: enlaces del menú lateral y su página directa -----------------------------------------------------------------

const MENU_CELL = /^(aparece|no aparece) «(.+)»$/;

/** Menú lateral (escritorio) y página de la dirección: el registro o la pantalla si el rol la tiene; si no, el aviso de permiso. */
const accessRow = (label: string, path: string, pageTestId: string, forbiddenTestId: string): BrowserRowHandler => {
  return async (row, { page }) => {
    const menu = MENU_CELL.exec(cell(row, 'menu'));
    if (!menu || menu[2] !== label) throw new Error(`celda sin interpretación: menú «${cell(row, 'menu')}» para «${label}»`);
    const wantShown = menu[1] === 'aparece';
    const view = cell(row, 'vista');
    const expected = `${cell(row, 'menu')}; ${view}`;
    await resetAlumno01();
    const blockedAt = await enter(page, cell(row, 'rol'), expected);
    if (blockedAt) return blockedAt;
    // Antes de afirmar que un enlace no está, el menú lateral debe estar montado: se espera a que haya algún enlace visible
    await waitUntil(() => isVisible(page.getByRole('link').first()));
    const shown = await isVisible(page.getByRole('link', { name: label, exact: true }));
    const checks: Check[] = [check(shown === wantShown, cell(row, 'menu'), `«${label}» ${shown ? 'aparece' : 'no aparece'} en el menú lateral`)];
    const opened = await interact([[`abrir la dirección ${path}`, () => page.goto(path, { timeout: CEILING_MS })]]);
    if (opened) return blocked(expected, opened);
    if (view === 'el registro de auditoría' || view === 'la pantalla de administración del tenant') {
      const landed = await waitUntil(() => isVisible(page.getByTestId(pageTestId)));
      checks.push(check(landed.reached, view, landed.reached ? view : `no se ve ${view} en ${path}`));
      return conclude(checks);
    }
    const alert = page.getByTestId(forbiddenTestId);
    const alertUp = await waitUntil(() => isVisible(alert));
    checks.push(check(alertUp.reached, 'el aviso de permiso denegado', alertUp.reached ? 'se ve el aviso de permiso denegado' : `no se ve el aviso en ${path}`));
    for (const text of quotedItems(view)) {
      const seen = await isVisible(alert.getByText(text, { exact: true }));
      checks.push(check(seen, `el aviso muestra «${text}»`, seen ? `muestra «${text}»` : `no muestra «${text}»`));
    }
    return conclude(checks);
  };
};

const auditAccess = accessRow('Auditoría', '/audit', AUDITORIA_TESTIDS.AUDIT_PAGE, AUDITORIA_TESTIDS.AUDIT_FORBIDDEN);
const adminAccess = accessRow('Administración', '/admin', ADMIN_TESTIDS.ADMIN_PAGE, ADMIN_TESTIDS.ADMIN_FORBIDDEN);

defineBrowserRows({
  story: 'US-MULTITENANT-PERMISOS-008',
  surface: 'web',
  tenants: ['alumno01'],
  handlers: new Map<number, BrowserRowHandler>([
    [1, deleteFromList],
    [2, approveDraft],
    [3, runForm],
    [4, publishVersion],
    [5, closeNc],
    [6, deleteMilestone],
    [7, auditAccess],
    [8, adminAccess],
  ]),
});
