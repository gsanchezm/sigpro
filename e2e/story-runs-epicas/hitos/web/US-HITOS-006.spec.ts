import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { PROGRAMAS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import {
  attrCheck,
  attrOne,
  countLine,
  delayMilestones,
  deleteAllMilestones,
  emptyLine,
  enabledCheck,
  enterAndOpen,
  errorBox,
  failingMilestones,
  gestorToken,
  literal,
  milestoneNamesOf,
  newButton,
  openHitos,
  prepFailed,
  rowOf,
  seenCheck,
  settledMilestones,
  signIn,
  sliderOf,
  tableOf,
  textCheck,
  textOne,
  withCookieNote,
} from './common';

// US-HITOS-006 — Ver la pestaña «Hitos»: tabla, recuento, estados y permisos de cada rol (web). Preparación de cada fila: reinicio de
// alumno01 con el token de su administrador; después, inicio de sesión en /login?tenant=alumno01 en un navegador sin sesión y apertura
// de /programs/<programa> con la pestaña «Hitos». Las filas de carga y de error preparan la petición de la lista ANTES de abrir la
// pestaña (la petición sale al elegirla): la prueba retrasa o falla GET /api/programs/PRG-001/milestones.

const PROGRAMAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['PRG-001', 'PRG-001'],
  ['PRG-004', 'PRG-004'],
]);

const PROGRAMAS_VACIOS: ReadonlyMap<string, string> = new Map<string, string>([['PRG-003', 'PRG-003']]);

const COLUMNAS: ReadonlyMap<string, 'Avance' | 'Estado'> = new Map<string, 'Avance' | 'Estado'>([
  ['«Avance»', 'Avance'],
  ['«Estado»', 'Estado'],
]);

const CUENTAS: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['gestor@sigpro.test', DEMO.gestor],
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Lo que cada fila de rol dice que puede hacer, leído de la celda «resultado» (texto exacto de la historia). */
const RESULTADO_ROL: ReadonlyMap<string, 'edita' | 'solo lectura'> = new Map<string, 'edita' | 'solo lectura'>([
  ['el texto «Doble clic para editar · Intro guarda · Esc cancela» y «Nuevo hito» habilitado', 'edita'],
  ['el texto «Tu rol no permite modificar hitos», «Nuevo hito» deshabilitado y los deslizadores de avance sin poder moverse', 'solo lectura'],
]);

const ESPERA: ReadonlyMap<string, number> = new Map<string, number>([['3 segundos', 3_000]]);

/** Orden de los hitos de PRG-001 y PRG-004 según la historia (los nombres del seed, por fecha límite). */
const SECUENCIA: readonly string[] = ['SRR', 'PDR', 'CDR', 'TRR', 'FAT', 'SAT', 'Entrega', 'Cierre', 'Garantía'];

const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((value, index) => value === b[index]);

// --- Esquema 1: la tabla muestra cada hito con su avance y su estado -------------------------------------------------------------

const cellValues: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const columna = strict('columna', COLUMNAS, cell(row, 'columna'));
  const valor = cell(row, 'valor');
  const expected = `en la fila de ${hito}, la columna ${columna} muestra ${literal(valor)}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const checks: Check[] =
    columna === 'Avance'
      ? [await seenCheck(sliderOf(page, hito), `el deslizador de ${hito}`, `el deslizador de ${hito}`), await attrCheck(sliderOf(page, hito), 'aria-valuetext', literal(valor), `la columna Avance de ${hito} muestra`)]
      : [await textCheck(rowOf(page, 'PRG-001', hito).getByTestId(/^milestone-status-/), valor, `la columna Estado de ${hito} muestra`)];
  return conclude(checks);
};

// --- Esquema 2: los hitos van por fecha límite y el recuento dice cuántos están cumplidos ----------------------------------

const orderAndCount: BrowserRowHandler = async (row, { page }) => {
  const programa = strict('programa', PROGRAMAS, cell(row, 'programa'));
  const primero = literal(cell(row, 'primero'));
  const ultimo = literal(cell(row, 'ultimo'));
  const recuento = literal(cell(row, 'recuento'));
  const expected = `la secuencia ${SECUENCIA.join(', ')}; el primer hito es ${primero}, el último ${ultimo} y el recuento dice ${recuento}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, programa);
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const nombres = await milestoneNamesOf(page);
  const texto = await textOne(countLine(page));
  return conclude([
    check(same(nombres, SECUENCIA), `la secuencia ${SECUENCIA.join(', ')}`, `la secuencia ${nombres.join(', ') || '(ninguna)'}`),
    check(nombres[0] === primero, `el primero es ${primero}`, `el primero es ${nombres[0] ?? '(ninguno)'}`),
    check(nombres[nombres.length - 1] === ultimo, `el último es ${ultimo}`, `el último es ${nombres[nombres.length - 1] ?? '(ninguno)'}`),
    check(texto === recuento, `el recuento dice ${recuento}`, `el recuento dice ${texto ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 3: cada rol ve la tabla con lo que su rol permite -------------------------------------------------------------------

const roleView: BrowserRowHandler = async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const credenciales = strict('cuenta', CUENTAS, cuenta);
  const modo = strict('resultado', RESULTADO_ROL, cell(row, 'resultado'));
  const expected = `${cuenta} ve ${cell(row, 'resultado')}`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, credenciales, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const edita = modo === 'edita';
  const hint = edita ? 'Doble clic para editar · Intro guarda · Esc cancela' : 'Tu rol no permite modificar hitos';
  const checks: Check[] = [await seenCheck(page.getByText(hint, { exact: true }), `el texto «${hint}»`, `el texto «${hint}»`), await enabledCheck(newButton(page), edita, '«Nuevo hito»')];
  if (!edita) {
    checks.push(await enabledCheck(sliderOf(page, 'SRR'), false, 'el deslizador de avance de SRR'));
    checks.push(await enabledCheck(sliderOf(page, 'PDR'), false, 'el deslizador de avance de PDR'));
  }
  return conclude(checks);
};

// --- Esquema 4: la pestaña muestra el estado vacío cuando el programa no tiene hitos ----------------------------------------

const emptyProgram: BrowserRowHandler = async (row, { page }) => {
  const programa = strict('programa', PROGRAMAS_VACIOS, cell(row, 'programa'));
  const expected = 'el aviso «Este programa todavía no tiene hitos.» y el recuento dice «0 de 0 hitos cumplidos»';
  await resetTenants([TENANT_A]);
  const token = await gestorToken();
  if (token === undefined) return outcome(false, expected, 'la preparación no se cumplió: gestor@sigpro.test no inicia sesión por HTTP', { note: 'Preparación por HTTP fallida.' });
  const borrado = await deleteAllMilestones(token, programa);
  if (borrado !== undefined) return outcome(false, expected, `la preparación no se cumplió: DELETE de los hitos de ${programa} responde ${borrado.status}`, { note: 'Preparación por HTTP fallida.' });
  const failure = await enterAndOpen(page, DEMO.gestor, programa);
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  return conclude([
    await textCheck(emptyLine(page), 'Este programa todavía no tiene hitos.', 'el aviso'),
    await textCheck(countLine(page), '0 de 0 hitos cumplidos', 'el recuento dice'),
  ]);
};

// --- Esquema 5: mientras llega la lista se ven filas de carga y el recuento solo dice «…» ---------------------------------

/** Una sola lectura de la tabla de PRG-001 mientras carga: `aria-busy`, filas de carga, filas de hito y el recuento. */
const loadingSnapshot = (page: Page, skeletonTestId: string) =>
  page.evaluate(
    ({ tableName, skeleton }) => {
      const table = document.querySelector(`table[aria-label="${tableName}"]`);
      return {
        busy: table?.getAttribute('aria-busy') ?? '(sin tabla)',
        skeletons: document.querySelectorAll(`[data-testid="${skeleton}"]`).length,
        rows: document.querySelectorAll('tr[data-testid^="milestone-row-"]').length,
        count: (document.querySelector('[data-testid="milestones-count"]')?.textContent ?? '').trim(),
      };
    },
    { tableName: 'Hitos de PRG-001', skeleton: skeletonTestId },
  );

const loading: BrowserRowHandler = async (row, { page }) => {
  const ms = strict('espera', ESPERA, cell(row, 'espera'));
  const expected = 'mientras llega la lista, filas de carga, ninguna fila de hito y el recuento «…»; al llegar, los 9 hitos de PRG-001';
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  await delayMilestones(page, 'PRG-001', ms);
  const opened = await openHitos(page, 'PRG-001');
  if (opened) return prepFailed(expected, opened);
  const busy = await waitUntil(async () => (await attrOne(tableOf(page, 'PRG-001'), 'aria-busy')) === 'true');
  const snapshot = await loadingSnapshot(page, PROGRAMAS_TESTIDS.SKELETON_ROW);
  const alLlegar = await settledMilestones(page);
  const nombres = await milestoneNamesOf(page);
  return conclude([
    check(busy.reached, 'la tabla se marca como ocupada mientras carga', `aria-busy ${snapshot.busy}`),
    check(snapshot.skeletons > 0, 'filas de carga mientras llega la respuesta', `${snapshot.skeletons} filas de carga`),
    check(snapshot.rows === 0, 'ninguna fila de hito mientras llega la respuesta', `${snapshot.rows} filas de hito`),
    check(snapshot.count === '…', 'el recuento solo dice «…»', `el recuento dice «${snapshot.count}»`),
    check(alLlegar && nombres.length === 9, 'al llegar la respuesta, los 9 hitos del programa', `${nombres.length} hitos al llegar`),
  ]);
};

// --- Esquema 6: un fallo al cargar la lista se muestra con «Reintentar» -----------------------------------------------------

const failedLoad: BrowserRowHandler = async (row, { page }) => {
  const programa = strict('programa', PROGRAMAS, cell(row, 'programa'));
  const expected = 'el aviso «No se pudieron cargar los hitos» con «Reintentar» y ninguna fila; al reintentar sin el 500, los 9 hitos';
  await resetTenants([TENANT_A]);
  const signed = await signIn(page, DEMO.gestor);
  if (signed) return prepFailed(expected, signed);
  const switchOn = await failingMilestones(page, programa);
  const opened = await openHitos(page, programa);
  if (opened) return prepFailed(expected, opened);
  const shown = await waitUntil(() => isVisible(errorBox(page)));
  const titulo = await seenCheck(errorBox(page).getByText('No se pudieron cargar los hitos', { exact: true }), 'el aviso «No se pudieron cargar los hitos»', 'el aviso «No se pudieron cargar los hitos»');
  const boton = await seenCheck(errorBox(page).getByRole('button', { name: 'Reintentar', exact: true }), 'el botón «Reintentar»', 'el botón «Reintentar»');
  const filasAntes = (await milestoneNamesOf(page)).length;
  const sinFilas = check(filasAntes === 0, 'ninguna fila de hito', `${filasAntes} filas de hito`);
  switchOn.on = false;
  await errorBox(page).getByRole('button', { name: 'Reintentar', exact: true }).click(ACTION);
  await settledMilestones(page);
  const nueve = (await milestoneNamesOf(page)).length;
  return conclude([check(shown.reached, 'aviso de error visible', shown.reached ? 'aviso de error visible' : 'sin aviso de error'), titulo, boton, sinFilas, check(nueve === 9, 'al reintentar, los 9 hitos del programa', `${nueve} hitos tras reintentar`)]);
};

defineBrowserRows({
  story: 'US-HITOS-006',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(cellValues)],
    [2, withCookieNote(orderAndCount)],
    [3, withCookieNote(roleView)],
    [4, withCookieNote(emptyProgram)],
    [5, withCookieNote(loading)],
    [6, withCookieNote(failedLoad)],
  ]),
});
