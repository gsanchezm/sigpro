import type { Locator, Page } from '@playwright/test';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { HITOS_TESTIDS, MOVIL_PROGRAMS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { attrOne, buttonNamed, cardOf, enterAndOpen, menuOf, newButton, onExpoWeb, renameItem, settledCards, textbox, visibleText } from './common';
import { enabledOne, prepFailed, seen, textOne, waitToast } from '../web/common';

// US-HITOS-011 — Crear un hito y editar su nombre o su fecha en una hoja (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio
// de alumno01 con el token de su administrador; después, inicio de sesión de gestor@sigpro.test con «alumno01» en «Tenant de trabajo»,
// la ficha de PRG-001 y la opción «Hitos». Las hojas se abren con «Nuevo hito» y con «Renombrar» del menú ⋯ de SRR.

const NOMBRE_ALTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['(81 caracteres)', 'x'.repeat(81)],
  ['Revisión de diseño', 'Revisión de diseño'],
]);

const FECHA_ALTA: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2027-03-15', '2027-03-15'],
]);

type ResultadoAlta = { readonly error: 'name' | 'dueDate'; readonly motivo: string } | 'creado';

const RESULTADO_ALTA: ReadonlyMap<string, ResultadoAlta> = new Map<string, ResultadoAlta>([
  ['ve «El nombre debe tener al menos 2 caracteres» debajo de «Nombre» y la hoja sigue abierta', { error: 'name', motivo: 'El nombre debe tener al menos 2 caracteres' }],
  ['ve «El nombre es demasiado largo (máx. 80 caracteres)» debajo de «Nombre» y la hoja sigue abierta', { error: 'name', motivo: 'El nombre es demasiado largo (máx. 80 caracteres)' }],
  ['ve «Indica una fecha válida» debajo de «Fecha límite» y la hoja sigue abierta', { error: 'dueDate', motivo: 'Indica una fecha válida' }],
  ['la hoja se cierra, ve el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10» y la tarjeta «Revisión de diseño» es la última de la lista', 'creado'],
]);

const CAMBIO: ReadonlyMap<string, { readonly campo?: 'nombre' | 'fecha'; readonly valor?: string }> = new Map<string, { readonly campo?: 'nombre' | 'fecha'; readonly valor?: string }>([
  ['cambia «Nombre del hito» a Revisión PDR y pulsa «Guardar hito»', { campo: 'nombre', valor: 'Revisión PDR' }],
  ['cambia «Fecha límite» a 2027-03-15 y pulsa «Guardar hito»', { campo: 'fecha', valor: '2027-03-15' }],
  ['no cambia ningún campo', {}],
  ['cambia «Nombre del hito» a A y pulsa «Guardar hito»', { campo: 'nombre', valor: 'A' }],
]);

/** Nombres de las tarjetas, en orden, leídos en una sola lectura (el nombre accesible de cada tarjeta). */
const cardNamesOf = (page: Page): Promise<readonly string[]> =>
  page
    .evaluate(() => Array.from(document.querySelectorAll('[data-testid^="milestone-row-"]')).map((card) => card.getAttribute('aria-label') ?? ''))
    .catch(() => []);

const sheet = (page: Page, testId: string): Locator => page.getByTestId(testId);

// --- Esquema 1: la hoja «Nuevo hito» valida el nombre y la fecha antes de crear ----------------------------------------------

const createSheet: BrowserRowHandler = async (row, { page }) => {
  const nombre = strict('nombre', NOMBRE_ALTA, cell(row, 'nombre'));
  const fecha = strict('fecha', FECHA_ALTA, cell(row, 'fecha'));
  const resultado = strict('resultado', RESULTADO_ALTA, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  await newButton(page).click(ACTION);
  const hoja = sheet(page, HITOS_TESTIDS.MILESTONE_NEW_DIALOG);
  await waitUntil(() => seen(hoja).then((value) => value === true));
  await textbox(page, 'Nombre').fill(nombre, ACTION);
  await textbox(page, 'Fecha límite').fill(fecha, ACTION);
  await buttonNamed(page, 'Crear hito').click(ACTION);

  if (resultado === 'creado') {
    const aviso = await waitToast(page, 'Hito creado', 'Revisión de diseño · PRG-001-M10');
    const cerrada = await waitUntil(() => seen(hoja).then((value) => value === false));
    const nombres = await cardNamesOf(page);
    return conclude([
      check(aviso, 'el aviso «Hito creado» con «Revisión de diseño · PRG-001-M10»', aviso ? 'aviso visible' : 'sin ese aviso'),
      check(cerrada.reached, 'la hoja se cierra', cerrada.reached ? 'la hoja se cerró' : 'la hoja sigue abierta'),
      check(nombres[nombres.length - 1] === 'Revisión de diseño', 'la tarjeta «Revisión de diseño» es la última', `la última es ${nombres[nombres.length - 1] ?? '(ninguna)'}`),
    ]);
  }
  const motivo = sheet(page, resultado.error === 'name' ? HITOS_TESTIDS.MILESTONE_NEW_NAME_ERROR : HITOS_TESTIDS.MILESTONE_NEW_DATE_ERROR);
  const mostrado = await waitUntil(() => seen(motivo).then((value) => value === true));
  return conclude([
    check(mostrado.reached, `el motivo «${resultado.motivo}» debajo del campo`, mostrado.reached ? 'motivo visible' : 'sin motivo visible'),
    await visibleText(motivo, resultado.motivo, 'el motivo debajo del campo es'),
    check((await seen(hoja)) === true, 'la hoja sigue abierta', (await seen(hoja)) === true ? 'la hoja sigue abierta' : 'la hoja se cerró'),
  ]);
};

// --- Esquema 2: la hoja de edición cambia el nombre o la fecha y valida lo que cambia -----------------------------------

const editSheet: BrowserRowHandler = async (row, { page }) => {
  const cambio = strict('cambio', CAMBIO, cell(row, 'cambio'));
  const textoCambio = cell(row, 'cambio');
  const resultado = cell(row, 'resultado');
  const expected = resultado;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  await menuOf(page, 'SRR').click(ACTION);
  await renameItem(page).click(ACTION);
  const hoja = sheet(page, MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_DIALOG);
  await waitUntil(() => seen(hoja).then((value) => value === true));
  if (cambio.campo === 'nombre' && cambio.valor !== undefined) await textbox(page, 'Nombre del hito').fill(cambio.valor, ACTION);
  if (cambio.campo === 'fecha' && cambio.valor !== undefined) await textbox(page, 'Fecha límite').fill(cambio.valor, ACTION);
  const guardar = buttonNamed(page, 'Guardar hito');

  if (cambio.campo === undefined) {
    // Sin cambios: «Guardar hito» deshabilitado y el motivo visible
    // El motivo se ve como texto. La app lo deja además en `aria-description` (no visible): se anota como evidencia, no cuenta.
    const habilitado = await enabledOne(guardar);
    const motivo = 'No hay cambios que guardar';
    const visible = await textOne(page.getByText(motivo, { exact: true }));
    const descripcion = await attrOne(guardar, 'aria-description');
    return conclude([
      check(habilitado === false, '«Guardar hito» deshabilitado', `«Guardar hito» ${String(habilitado)}`),
      check(visible === motivo, `el motivo «${motivo}» se ve`, `texto visible: «${visible ?? '(ninguno)'}»; aria-description: «${descripcion ?? '(ninguno)'}»`),
    ]);
  }
  await guardar.click(ACTION);

  if (cambio.campo === 'nombre' && cambio.valor === 'A') {
    const error = await visibleText(sheet(page, MOVIL_PROGRAMS_TESTIDS.MILESTONE_EDIT_NAME_ERROR), 'El nombre debe tener al menos 2 caracteres', 'bajo «Nombre del hito» aparece');
    const abierta = (await seen(hoja)) === true;
    const sigue = (await seen(cardOf(page, 'SRR'))) === true;
    return conclude([error, check(abierta, 'la hoja sigue abierta', abierta ? 'la hoja sigue abierta' : 'la hoja se cerró'), check(sigue, 'la tarjeta sigue mostrando «SRR»', sigue ? 'la tarjeta muestra «SRR»' : 'la tarjeta no muestra «SRR»')]);
  }
  const titulo = 'Hito actualizado';
  const detalle = cambio.campo === 'nombre' ? 'Revisión PDR · nombre actualizado' : 'SRR · fecha límite 15/03/2027';
  const aviso = await waitToast(page, titulo, detalle);
  const cerrada = await waitUntil(() => seen(hoja).then((value) => value === false));
  const nombres = await cardNamesOf(page);
  const ultimo = cambio.campo === 'fecha' ? nombres[nombres.length - 1] === 'SRR' : nombres.includes('Revisión PDR');
  return conclude([
    check(aviso, `el aviso «${titulo}» con «${detalle}»`, aviso ? 'aviso visible' : `sin ese aviso (${textoCambio})`),
    check(cerrada.reached, 'la hoja se cierra', cerrada.reached ? 'la hoja se cerró' : 'la hoja sigue abierta'),
    check(ultimo, cambio.campo === 'fecha' ? 'la tarjeta de «SRR» pasa a ser la última' : 'la tarjeta muestra «Revisión PDR»', `tarjetas: ${nombres.join(', ')}`),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(createSheet)],
    [2, onExpoWeb(editSheet)],
  ]),
});
