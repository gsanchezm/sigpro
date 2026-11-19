import type { Page } from '@playwright/test';
import { DEMO, TENANT_A, type Credentials } from '../../../story-runs/support/prepare';
import { EDITAR_PROGRAMA_TESTIDS } from '../../../../packages/shared/src/testids';
import { isVisible, textOf, waitUntil, ACTION } from '../../support/browser';
import { check, cell, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  absentCheck,
  actionFailed,
  alertCheck,
  editDenied,
  editForm,
  editEndField,
  editNameField,
  editNotFound,
  editPath,
  editSaveButton,
  editSettled,
  editStartField,
  fillField,
  interact,
  NET_MS,
  onWeb,
  openPath,
  programNow,
  signIn,
  textCheck,
  visibleCheck,
  waitForOkToast,
} from './common';

// US-PROG-ALTA-011 — Avisos y accesos de la edición de un programa (web). Preparación de cada fila: reinicio de alumno01; la cuenta de la
// fila entra desde /login?tenant=alumno01 y llega a /programs. Lo que se guarda se comprueba en el tenant por API (administrador).

const NAME_SEED = 'Sistema de mando táctico Ártemis';
const DUPLICATE_TEXT = 'Ya existe un programa con ese nombre';
const END_TEXT = 'La fecha de fin debe ser posterior al inicio';
const DENIED_TEXT = 'Tu rol no permite modificar programas. Puedes ver el detalle, pero no guardar cambios.';

/** Cuentas de la tabla del Esquema 3 (consultor y auditor; sus contraseñas son las de la historia). */
const DENIED_ACCOUNT: ReadonlyMap<string, Credentials> = new Map<string, Credentials>([
  ['consultor@sigpro.test', DEMO.consultor],
  ['auditor@sigpro.test', DEMO.auditor],
]);

/** Abre la edición de PRG-001 con gestor (preparación); devuelve el motivo si no se llega. */
const gestorOnEdit = async (page: Page): Promise<string | undefined> => {
  const signed = await signIn(page);
  if (signed) return signed;
  const opened = await openPath(page, editPath('PRG-001'));
  if (opened) return opened;
  return (await editSettled(page)) ? undefined : 'la edición de PRG-001 no se muestra';
};

// --- Esquema 1: un nombre repetido no se guarda y lo dice en el formulario -----------------------------------------------------

const duplicateName: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el aviso «422 · ${DUPLICATE_TEXT}» arriba y el mismo texto bajo «Nombre», y el programa no cambia`;
  const prepared = await gestorOnEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const typed = await fillField(editNameField(page), cell(row, 'nombre'), 'Nombre');
  if (typed) return actionFailed(expected, typed);
  const saved = await interact(editSaveButton(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved) return actionFailed(expected, saved);
  // Primero los avisos (la respuesta de red llega antes); después el tenant, que no debe cambiar
  const alerts = [
    await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_SERVER_ERROR), `422 · ${DUPLICATE_TEXT}`, 'el aviso de arriba', NET_MS),
    await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_NAME_ERROR), DUPLICATE_TEXT, 'el aviso bajo «Nombre»', NET_MS),
  ];
  const stored = await programNow('PRG-001');
  return conclude([...alerts, check(stored?.name === NAME_SEED, 'PRG-001 conserva su nombre', `PRG-001 tiene el nombre «${String(stored?.name)}»`)]);
};

// --- Esquema 2: un fin que no es posterior al inicio no se guarda -------------------------------------------------------------

/** Par de fechas de la fila → las fechas que se escriben y si el formulario debe rechazarlo (fin no posterior al inicio). */
const ENDS: ReadonlyMap<string, { readonly start: string; readonly end: string; readonly rejected: boolean }> = new Map<string, { readonly start: string; readonly end: string; readonly rejected: boolean }>([
  ['2024-07-02|2024-07-01', { start: '2024-07-02', end: '2024-07-01', rejected: true }],
  ['2024-06-30|2024-07-01', { start: '2024-06-30', end: '2024-07-01', rejected: false }],
]);

const endRule: BrowserRowHandler = async (row, { page }) => {
  const expected = cell(row, 'resultado');
  // Cuenta las peticiones de guardado: una fila que no guarda nada no debe enviar ningún PATCH
  let patches = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && new URL(request.url()).pathname === '/api/programs/PRG-001') patches += 1;
  });
  const prepared = await gestorOnEdit(page);
  if (prepared) return preparationFailedWeb(expected, prepared);
  const pair = strict('inicio|fin', ENDS, `${cell(row, 'inicio')}|${cell(row, 'fin')}`);
  const typedStart = await fillField(editStartField(page), pair.start, 'Fecha de inicio');
  if (typedStart) return actionFailed(expected, typedStart);
  const typedEnd = await fillField(editEndField(page), pair.end, 'Fecha de fin');
  if (typedEnd) return actionFailed(expected, typedEnd);
  const saved = await interact(editSaveButton(page), 'pulsar «Guardar»', (element) => element.click(ACTION));
  if (saved) return actionFailed(expected, saved);
  if (pair.rejected) {
    const shown = await alertCheck(page.getByTestId(EDITAR_PROGRAMA_TESTIDS.PROGRAM_EDIT_END_ERROR), END_TEXT, 'el aviso bajo «Fecha de fin»');
    const stored = await programNow('PRG-001');
    return conclude([
      shown,
      check(patches === 0, 'no se envía ninguna edición', `se enviaron ${patches} peticiones PATCH`),
      check(stored?.startDate === '2023-01-01' && stored?.endDate === '2024-07-01', 'no se guarda nada', `PRG-001 tiene ${String(stored?.startDate)} y ${String(stored?.endDate)}`),
    ]);
  }
  const toast = await waitForOkToast(page, 'Programa actualizado', 'PRG-001 se guardó correctamente', NET_MS);
  const stored = await programNow('PRG-001');
  return conclude([
    check(toast, 'se guarda y ve el aviso «Programa actualizado»', 'no aparece el aviso «Programa actualizado»'),
    check(stored?.startDate === '2024-06-30', 'PRG-001 guardado con inicio 2024-06-30', `PRG-001 tiene inicio ${String(stored?.startDate)}`),
  ]);
};

// --- Esquema 3: quien no puede editar ve por qué y no ve el formulario ---------------------------------------------------------

const deniedRole: BrowserRowHandler = async (row, { page }) => {
  const expected = `ve el título «Editar programa», el texto «${DENIED_TEXT}» y el enlace «Volver al detalle», y no ve ningún campo para editar`;
  const credentials = strict('cuenta', DENIED_ACCOUNT, cell(row, 'cuenta'));
  const signed = await signIn(page, credentials);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openPath(page, editPath('PRG-001'));
  if (opened) return preparationFailedWeb(expected, opened);
  if (!(await editSettled(page))) return preparationFailedWeb(expected, 'el aviso de permiso no se muestra');
  const denied = editDenied(page);
  const message = await textOf(denied.locator('p'));
  return conclude([
    await visibleCheck(page.getByRole('heading', { name: 'Editar programa', level: 1, exact: true }), 'el título «Editar programa»'),
    textCheck(message, DENIED_TEXT, 'el texto'),
    await visibleCheck(page.getByRole('link', { name: 'Volver al detalle', exact: true }), 'el enlace «Volver al detalle»'),
    await absentCheck(editForm(page), 'formulario de edición'),
    await absentCheck(editNameField(page), 'campo «Nombre» para editar'),
    await absentCheck(editSaveButton(page), 'botón «Guardar»'),
  ]);
};

// --- Esquema 4: un programa que no existe en el tenant muestra el aviso de no encontrado ------------------------------------

const notFound: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `ve el aviso «No se encontró el programa» y el enlace «Volver a Programas» (${codigo})`;
  const signed = await signIn(page);
  if (signed) return preparationFailedWeb(expected, signed);
  const opened = await openPath(page, editPath(codigo));
  if (opened) return preparationFailedWeb(expected, opened);
  if (!(await waitUntil(() => isVisible(editNotFound(page)), NET_MS)).reached) return conclude([check(false, 'el aviso de no encontrado', 'no se ve el aviso de no encontrado')]);
  return conclude([
    await visibleCheck(page.getByRole('heading', { name: 'No se encontró el programa', level: 1, exact: true }), 'el aviso «No se encontró el programa»'),
    await visibleCheck(page.getByRole('link', { name: 'Volver a Programas', exact: true }), 'el enlace «Volver a Programas»'),
  ]);
};

defineBrowserRows({
  story: 'US-PROG-ALTA-011',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(duplicateName)],
    [2, onWeb(endRule)],
    [3, onWeb(deniedRole)],
    [4, onWeb(notFound)],
  ]),
});
