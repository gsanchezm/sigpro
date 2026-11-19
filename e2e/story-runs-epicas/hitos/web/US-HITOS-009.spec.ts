import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants, type Credentials } from '../../../story-runs/support/prepare';
import { HITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, isVisible, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  armToasts,
  attrCheck,
  attrOne,
  countLine,
  enabledCheck,
  enterAndOpen,
  failMilestoneWrite,
  hasToast,
  headerPercentText,
  headerProgress,
  literal,
  menuButtonOf,
  noRecordedToastFor,
  prepFailed,
  rowOf,
  runSteps,
  seen,
  settledMilestones,
  textCheck,
  waitToast,
  withCookieNote,
} from './common';

// US-HITOS-009 — Borrar un hito desde su menú con confirmación (web). Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador; después, inicio de sesión de la cuenta de la fila en /login?tenant=alumno01 y apertura de /programs/PRG-001 con la
// pestaña «Hitos». La fila de error responde 500 a DELETE /api/milestones/PRG-001-M02 antes de confirmar.

const ACCION: ReadonlyMap<string, 'Cancelar' | 'Eliminar'> = new Map<string, 'Cancelar' | 'Eliminar'>([
  ['pulsa «Cancelar»', 'Cancelar'],
  ['pulsa «Eliminar»', 'Eliminar'],
]);

type Resultado = 'sigue' | 'borradoPDR' | 'borradoSRR';

const RESULTADO: ReadonlyMap<string, Resultado> = new Map<string, Resultado>([
  ['el diálogo se cierra, «PDR» sigue en la tabla y no aparece ningún aviso', 'sigue'],
  ['«PDR» desaparece de la tabla, aparece el aviso «Hito eliminado» con «PDR» y el recuento dice «1 de 8 hitos cumplidos»', 'borradoPDR'],
  ['«SRR» desaparece de la tabla, el recuento dice «0 de 8 hitos cumplidos» y la cabecera del programa muestra 0%', 'borradoSRR'],
]);

const CUENTAS_SIN_PERMISO: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Diálogo de confirmación «Eliminar hito». */
const dialogo = (page: Page) => page.getByTestId(HITOS_TESTIDS.MILESTONE_DELETE_DIALOG);

/** Abre el menú ⋯ del hito y elige «Eliminar»: queda el diálogo de confirmación abierto. */
const openDelete = (page: Page, hito: string) =>
  runSteps([
    [`abrir el menú de ${hito}`, () => menuButtonOf(page, hito).click(ACTION)],
    ['elegir «Eliminar» en el menú', () => page.getByRole('menuitem', { name: 'Eliminar', exact: true }).click(ACTION)],
    [
      'ver el diálogo «Eliminar hito»',
      async () => {
        if (!(await waitUntil(() => isVisible(dialogo(page)))).reached) throw new Error('el diálogo «Eliminar hito» no aparece');
      },
    ],
  ]);

// --- Esquema 1: confirmar o cancelar el borrado de un hito -------------------------------------------------------------------

const confirmOrCancel: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const accion = strict('accion', ACCION, cell(row, 'accion'));
  const resultado = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  await armToasts(page);
  const opened = await openDelete(page, hito);
  if (opened) return actionMissing(expected, opened);
  const pulsado = await runSteps([[`pulsar «${accion}» en el diálogo`, () => dialogo(page).getByRole('button', { name: accion, exact: true }).click(ACTION)]]);
  if (pulsado) return actionMissing(expected, pulsado);

  if (resultado === 'sigue') {
    const cerrado = await waitUntil(async () => (await seen(dialogo(page))) === false);
    const sigue = await waitUntil(async () => (await seen(rowOf(page, 'PRG-001', hito))) === true);
    const sinAviso = await noRecordedToastFor(page, 'Hito eliminado');
    return conclude([
      check(cerrado.reached, 'el diálogo se cierra', cerrado.reached ? 'el diálogo se cerró' : 'el diálogo sigue abierto'),
      check(sigue.reached, `«${hito}» sigue en la tabla`, sigue.reached ? `«${hito}» sigue en la tabla` : `«${hito}» ya no está en la tabla`),
      check(sinAviso, 'no aparece ningún aviso', sinAviso ? 'ningún aviso' : 'aparece un aviso'),
    ]);
  }
  const quitado = await waitUntil(async () => (await seen(rowOf(page, 'PRG-001', hito))) === false);
  const aviso = await waitToast(page, 'Hito eliminado', hito);
  if (resultado === 'borradoPDR') {
    return conclude([
      check(quitado.reached, `«${hito}» desaparece de la tabla`, quitado.reached ? `«${hito}» desaparece de la tabla` : `«${hito}» sigue en la tabla`),
      check(aviso, `el aviso «Hito eliminado» con «${hito}»`, aviso ? 'aviso visible' : 'sin ese aviso'),
      await textCheck(countLine(page), '1 de 8 hitos cumplidos', 'el recuento dice'),
    ]);
  }
  // La cabecera se refresca tras el borrado: se espera a los dos datos (la barra y el «0%» visible) antes de leerla
  const cabecera = await waitUntil(async () => (await attrOne(headerProgress(page), 'aria-valuenow')) === '0' && (await headerPercentText(page)) === '0%');
  const visible = await headerPercentText(page);
  return conclude([
    check(quitado.reached, `«${hito}» desaparece de la tabla`, quitado.reached ? `«${hito}» desaparece de la tabla` : `«${hito}» sigue en la tabla`),
    await textCheck(countLine(page), '0 de 8 hitos cumplidos', 'el recuento dice'),
    check(cabecera.reached, 'la cabecera del programa muestra 0%', `la cabecera muestra ${visible ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 2: un rol sin permiso de borrado no puede eliminar desde el menú ------------------------------------------------

const roleCannotDelete: BrowserRowHandler = async (row, { page }) => {
  const cuenta = cell(row, 'cuenta');
  const credenciales = strict('cuenta', CUENTAS_SIN_PERMISO, cuenta);
  const expected = `${cuenta}: «Eliminar» deshabilitado y con el motivo «Tu rol no permite eliminar hitos»`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, credenciales, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const opened = await runSteps([
    ['abrir el menú de «SRR»', () => menuButtonOf(page, 'SRR').click(ACTION)],
    [
      'ver el menú de «SRR»',
      async () => {
        if (!(await waitUntil(() => isVisible(page.getByRole('menuitem', { name: 'Eliminar', exact: true })))).reached) throw new Error('el menú no aparece');
      },
    ],
  ]);
  if (opened) return actionMissing(expected, opened);
  const eliminar = page.getByRole('menuitem', { name: 'Eliminar', exact: true });
  return conclude(
    [await enabledCheck(eliminar, false, '«Eliminar»'), await attrCheck(eliminar, 'title', 'Tu rol no permite eliminar hitos', 'el motivo al pasar el ratón es')],
    { note: 'El motivo se lee del atributo title (el tooltip): no se hace hover real sobre la opción.' },
  );
};

// --- Esquema 3: un borrado que el servidor rechaza deja el hito en la tabla -------------------------------------------------

const rejectedDelete: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const expected = `el aviso «No se pudo guardar el hito» y «${hito}» sigue en la tabla`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  await failMilestoneWrite(page, 'PRG-001-M02', 'DELETE');
  const opened = await openDelete(page, hito);
  if (opened) return actionMissing(expected, opened);
  const pulsado = await runSteps([['pulsar «Eliminar» en el diálogo', () => dialogo(page).getByRole('button', { name: 'Eliminar', exact: true }).click(ACTION)]]);
  if (pulsado) return actionMissing(expected, pulsado);
  const aviso = await waitUntil(() => hasToast(page, 'No se pudo guardar el hito'));
  const sigue = await seen(rowOf(page, 'PRG-001', hito));
  return conclude([
    check(aviso.reached, 'el aviso «No se pudo guardar el hito»', aviso.reached ? 'aviso visible' : 'sin ese aviso'),
    check(sigue === true, `«${hito}» sigue en la tabla`, sigue === true ? `«${hito}» sigue en la tabla` : `«${hito}» no está en la tabla`),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-009',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(confirmOrCancel)],
    [2, withCookieNote(roleCannotDelete)],
    [3, withCookieNote(rejectedDelete)],
  ]),
});
