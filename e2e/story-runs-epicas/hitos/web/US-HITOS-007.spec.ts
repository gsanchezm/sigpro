import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { HITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  attrOne,
  enterAndOpen,
  milestoneNamesOf,
  nameCellOf,
  newButton,
  noSaveToastFor,
  prepFailed,
  runSteps,
  seen,
  seenCheck,
  settledMilestones,
  textCheck,
  waitToast,
  withCookieNote,
  type Step,
} from './common';

// US-HITOS-007 — Crear un hito en el diálogo «Nuevo hito» y editar su nombre o su fecha en la tabla (web). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después, inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 y
// apertura de /programs/PRG-001 con la pestaña «Hitos».

const NOMBRE_TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['A', 'A'],
  ['(81 caracteres)', 'x'.repeat(81)],
  ['Revisión de diseño', 'Revisión de diseño'],
  ['SRR', 'SRR'],
]);

const FECHA_TEXTO: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2027-03-15', '2027-03-15'],
]);

// --- Esquema 1: el diálogo «Nuevo hito» valida el nombre y la fecha antes de crear ---------------------------------------------

type ResultadoAlta = { readonly tipo: 'error'; readonly campo: 'name' | 'dueDate'; readonly motivo: string } | { readonly tipo: 'creado' };

const RESULTADO_ALTA: ReadonlyMap<string, ResultadoAlta> = new Map<string, ResultadoAlta>([
  ['ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre» y el diálogo sigue abierto', { tipo: 'error', campo: 'name', motivo: 'El nombre debe tener al menos 2 caracteres' }],
  ['ve «El nombre es demasiado largo (máx. 80 caracteres)» debajo de «Nombre» y el diálogo sigue abierto', { tipo: 'error', campo: 'name', motivo: 'El nombre es demasiado largo (máx. 80 caracteres)' }],
  ['ve «Indica una fecha válida» debajo de «Fecha límite» y el diálogo sigue abierto', { tipo: 'error', campo: 'dueDate', motivo: 'Indica una fecha válida' }],
  ['el diálogo se cierra, ve el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10» y la fila «Revisión de diseño» es la última de la tabla', { tipo: 'creado' }],
]);

const createDialog: BrowserRowHandler = async (row, { page }) => {
  const nombre = strict('nombre', NOMBRE_TEXTO, cell(row, 'nombre'));
  const fecha = strict('fecha', FECHA_TEXTO, cell(row, 'fecha'));
  const resultado = strict('resultado', RESULTADO_ALTA, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const dialogo = page.getByTestId(HITOS_TESTIDS.MILESTONE_NEW_DIALOG);
  const filled = await runSteps([
    ['abrir «Nuevo hito»', () => newButton(page).click(ACTION)],
    ['escribir el nombre', () => dialogo.getByLabel('Nombre', { exact: true }).fill(nombre, ACTION)],
    ['escribir la fecha límite', () => dialogo.getByLabel('Fecha límite', { exact: true }).fill(fecha, ACTION)],
    ['pulsar «Crear hito»', () => dialogo.getByRole('button', { name: 'Crear hito', exact: true }).click(ACTION)],
  ]);
  if (filled) return actionMissing(expected, filled);

  if (resultado.tipo === 'creado') {
    const aviso = await waitToast(page, 'Hito creado', 'Revisión de diseño · PRG-001-M10');
    const cerrado = await waitUntil(async () => (await seen(dialogo)) === false);
    const nombres = await milestoneNamesOf(page);
    return conclude([
      check(aviso, 'el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10»', aviso ? 'aviso «Hito creado» visible' : 'sin ese aviso'),
      check(cerrado.reached, 'el diálogo se cierra', cerrado.reached ? 'el diálogo se cerró' : 'el diálogo sigue abierto'),
      check(nombres[nombres.length - 1] === 'Revisión de diseño', 'la fila «Revisión de diseño» es la última', `la última es ${nombres[nombres.length - 1] ?? '(ninguna)'}`),
    ]);
  }
  const motivo = page.getByTestId(resultado.campo === 'name' ? HITOS_TESTIDS.MILESTONE_NEW_NAME_ERROR : HITOS_TESTIDS.MILESTONE_NEW_DATE_ERROR);
  const mostrado = await waitUntil(() => seen(motivo).then((value) => value === true));
  return conclude([
    check(mostrado.reached, `el motivo «${resultado.motivo}» debajo del campo`, mostrado.reached ? 'motivo visible' : 'sin motivo visible'),
    await textCheck(motivo, resultado.motivo, `el motivo debajo de ${resultado.campo === 'name' ? '«Nombre»' : '«Fecha límite»'} es`),
    await seenCheck(dialogo, 'el diálogo sigue abierto', 'el diálogo'),
  ]);
};

// --- Esquema 2: editar el nombre en la tabla guarda solo un nombre válido -------------------------------------------------------

type Cierre = 'Enter' | 'Escape' | 'blur';

interface AccionNombre {
  readonly como: 'dobleClic' | 'f2';
  /** Texto que se escribe (si lo hay): reemplaza el valor que trae la celda. */
  readonly texto?: string;
  readonly cierre: Cierre;
}

const ACCION_NOMBRE: ReadonlyMap<string, AccionNombre> = new Map<string, AccionNombre>([
  ['hace doble clic, escribe Revisión PDR y pulsa Intro', { como: 'dobleClic', texto: 'Revisión PDR', cierre: 'Enter' }],
  ['hace doble clic, escribe Revisión PDR y pulsa Esc', { como: 'dobleClic', texto: 'Revisión PDR', cierre: 'Escape' }],
  ['hace doble clic, escribe Revisión PDR y saca el foco de la celda', { como: 'dobleClic', texto: 'Revisión PDR', cierre: 'blur' }],
  ['hace doble clic, deja «SRR» tal cual y pulsa Intro', { como: 'dobleClic', cierre: 'Enter' }],
  ['pulsa F2, escribe A y pulsa Intro', { como: 'f2', texto: 'A', cierre: 'Enter' }],
]);

type ResultadoNombre = 'guardado' | 'vuelve' | 'noValido';

const RESULTADO_NOMBRE: ReadonlyMap<string, ResultadoNombre> = new Map<string, ResultadoNombre>([
  ['ve el aviso «Hito actualizado» con «Revisión PDR · nombre actualizado» y la celda muestra «Revisión PDR»', 'guardado'],
  ['la celda vuelve a mostrar «SRR» y no aparece ningún aviso de guardado', 'vuelve'],
  ['la celda sigue mostrando «SRR» y no aparece ningún aviso de guardado', 'vuelve'],
  ['el campo sigue abierto, marcado como no válido, con el motivo «El nombre debe tener al menos 2 caracteres» al pasar el ratón por él, y no aparece ningún aviso de guardado', 'noValido'],
]);

const MOTIVO_NOMBRE = 'El nombre debe tener al menos 2 caracteres';

/** Campo de edición del nombre (aparece al abrir la celda). */
const nameInput = (page: Page): Locator => page.getByLabel('Nombre del hito', { exact: true });

const nameEdit: BrowserRowHandler = async (row, { page }) => {
  const accion = strict('accion', ACCION_NOMBRE, cell(row, 'accion'));
  const resultado = strict('resultado', RESULTADO_NOMBRE, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const celda = nameCellOf(page, 'PRG-001', 'SRR');
  const steps: Step[] = [
    ['abrir la edición del nombre de SRR', () => (accion.como === 'f2' ? celda.press('F2', ACTION) : celda.dblclick(ACTION))],
    ['escribir el nombre', () => (accion.texto === undefined ? Promise.resolve() : nameInput(page).fill(accion.texto, ACTION))],
    ['cerrar la edición', () => closeEdit(page, accion.cierre)],
  ];
  const stepFailure = await runSteps(steps);
  if (stepFailure) return actionMissing(expected, stepFailure);

  if (resultado === 'guardado') {
    const aviso = await waitToast(page, 'Hito actualizado', 'Revisión PDR · nombre actualizado');
    const mostrada = await waitUntil(() => seen(nameCellOf(page, 'PRG-001', 'Revisión PDR')).then((value) => value === true));
    return conclude([
      check(aviso, 'el aviso «Hito actualizado» con «Revisión PDR · nombre actualizado»', aviso ? 'aviso visible' : 'sin ese aviso'),
      check(mostrada.reached, 'la celda muestra «Revisión PDR»', mostrada.reached ? 'la celda muestra «Revisión PDR»' : 'la celda no muestra «Revisión PDR»'),
    ]);
  }
  if (resultado === 'vuelve') {
    const sinAviso = await noSaveToastFor(page);
    const vuelve = await waitUntil(() => seen(nameCellOf(page, 'PRG-001', 'SRR')).then((value) => value === true));
    return conclude([
      check(vuelve.reached, 'la celda vuelve a mostrar «SRR»', vuelve.reached ? 'la celda muestra «SRR»' : 'la celda no muestra «SRR»'),
      check(sinAviso, 'no aparece ningún aviso de guardado', sinAviso ? 'ningún aviso de guardado' : 'aparece un aviso de guardado'),
    ]);
  }
  const invalido = await waitUntil(async () => (await attrOne(nameInput(page), 'aria-invalid')) === 'true');
  const motivo = await attrOne(nameInput(page), 'title');
  const sinAviso = await noSaveToastFor(page);
  return conclude([
    check(invalido.reached, 'el campo sigue abierto y marcado como no válido', invalido.reached ? 'aria-invalid verdadero' : 'el campo no está marcado como no válido'),
    check(motivo === MOTIVO_NOMBRE, `el motivo al pasar el ratón «${MOTIVO_NOMBRE}»`, `motivo «${motivo ?? '(sin motivo)'}»`),
    check(sinAviso, 'no aparece ningún aviso de guardado', sinAviso ? 'ningún aviso de guardado' : 'aparece un aviso de guardado'),
  ]);
};

/** Cierra la edición del nombre como la persona: Intro, Esc o sacar el foco de la celda (clic en el título de la sección). */
const closeEdit = (page: Page, cierre: Cierre): Promise<unknown> => {
  if (cierre === 'blur') return page.getByRole('heading', { name: 'Hitos del programa', exact: true }).click(ACTION);
  return nameInput(page).press(cierre === 'Enter' ? 'Enter' : 'Escape', ACTION);
};

// --- Esquema 3: editar la fecha límite en la tabla guarda solo una fecha válida -------------------------------------------------

type ResultadoFecha = 'guardado' | 'noValido';

const RESULTADO_FECHA: ReadonlyMap<string, ResultadoFecha> = new Map<string, ResultadoFecha>([
  ['ve el aviso «Hito actualizado» con «SRR · fecha límite 15/03/2027» y la fila de «SRR» pasa a ser la última de la tabla', 'guardado'],
  ['el campo sigue abierto, marcado como no válido, con el motivo «Indica una fecha válida» al pasar el ratón por él, y no aparece ningún aviso de guardado', 'noValido'],
]);

const dateEdit: BrowserRowHandler = async (row, { page }) => {
  const fecha = strict('fecha', FECHA_TEXTO, cell(row, 'fecha'));
  const resultado = strict('resultado', RESULTADO_FECHA, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  // La celda de la fecha es el segundo botón de la fila de SRR (el primero es el nombre)
  const celdaFecha = page.getByRole('table', { name: 'Hitos de PRG-001', exact: true }).getByRole('row').filter({ has: nameCellOf(page, 'PRG-001', 'SRR') }).locator('td').nth(1).getByRole('button');
  const campo = page.getByLabel('Fecha límite', { exact: true });
  const stepFailure = await runSteps([
    ['abrir la edición de la fecha de SRR', () => celdaFecha.dblclick(ACTION)],
    ['cambiar la fecha límite', () => campo.fill(fecha, ACTION)],
    ['pulsar Intro', () => campo.press('Enter', ACTION)],
  ]);
  if (stepFailure) return actionMissing(expected, stepFailure);

  if (resultado === 'guardado') {
    const aviso = await waitToast(page, 'Hito actualizado', 'SRR · fecha límite 15/03/2027');
    const nombres = await milestoneNamesOf(page);
    return conclude([
      check(aviso, 'el aviso «Hito actualizado» con «SRR · fecha límite 15/03/2027»', aviso ? 'aviso visible' : 'sin ese aviso'),
      check(nombres[nombres.length - 1] === 'SRR', 'la fila de «SRR» es la última', `la última es ${nombres[nombres.length - 1] ?? '(ninguna)'}`),
    ]);
  }
  const invalido = await waitUntil(async () => (await attrOne(campo, 'aria-invalid')) === 'true');
  const motivo = await attrOne(campo, 'title');
  const sinAviso = await noSaveToastFor(page);
  return conclude([
    check(invalido.reached, 'el campo sigue abierto y marcado como no válido', invalido.reached ? 'aria-invalid verdadero' : 'el campo no está marcado como no válido'),
    check(motivo === 'Indica una fecha válida', 'el motivo al pasar el ratón «Indica una fecha válida»', `motivo «${motivo ?? '(sin motivo)'}»`),
    check(sinAviso, 'no aparece ningún aviso de guardado', sinAviso ? 'ningún aviso de guardado' : 'aparece un aviso de guardado'),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(createDialog)],
    [2, withCookieNote(nameEdit)],
    [3, withCookieNote(dateEdit)],
  ]),
});
