import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  actionMissing,
  attrOne,
  countLine,
  enterAndOpen,
  failMilestoneWrite,
  hasToast,
  headerPercentText,
  headerProgress,
  literal,
  prepFailed,
  runSteps,
  settledMilestones,
  sliderOf,
  statusOfRow,
  textOne,
  waitToast,
  withCookieNote,
} from './common';

// US-HITOS-008 — Mover el avance de un hito con el deslizador (web). Preparación de cada fila: reinicio de alumno01 con el token de su
// administrador; después, inicio de sesión de gestor@sigpro.test y apertura de /programs/PRG-001 con la pestaña «Hitos». La fila de error
// responde 500 a PATCH /api/milestones/PRG-001-M02 antes de mover el deslizador.

/** Id de cada hito de PRG-001 que aparece en las filas, por su nombre. */
const HITO_ID: ReadonlyMap<string, string> = new Map<string, string>([
  ['PDR', 'PRG-001-M02'],
  ['SRR', 'PRG-001-M01'],
  ['CDR', 'PRG-001-M03'],
]);

/** Número entero de una celda («100», «11»). Cualquier otro texto lanza. */
const intOf = (text: string): number => {
  if (!/^\d+$/.test(text)) throw new Error(`celda sin interpretación: número «${text}»`);
  return Number(text);
};

// --- Esquema 1: mover el deslizador guarda el avance y actualiza el estado, el recuento y la cabecera ----------------------

const moveSlider: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const valor = intOf(cell(row, 'valor'));
  const aviso = literal(cell(row, 'aviso'));
  const estado = literal(cell(row, 'estado'));
  const recuento = literal(cell(row, 'recuento'));
  const avance = intOf(cell(row, 'avance'));
  const expected = `mover el avance de ${hito} a ${valor}: aviso ${aviso}, estado ${estado}, recuento ${recuento} y cabecera ${avance}%`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  const movido = await runSteps([[`mover el avance de ${hito} a ${valor}`, () => sliderOf(page, hito).fill(String(valor), ACTION)]]);
  if (movido) return actionMissing(expected, movido);

  const avisoVisible = await waitToast(page, 'Hito actualizado', aviso);
  const estadoVisible = await statusOfRow(page, 'PRG-001', hito);
  const recuentoVisible = await textOne(countLine(page));
  // La cabecera se refresca tras el guardado (recarga del programa): se espera a los dos datos, el de la barra y el visible «N%»
  const cabecera = await waitUntil(async () => (await attrOne(headerProgress(page), 'aria-valuenow')) === String(avance) && (await headerPercentText(page)) === `${avance}%`);
  const visible = await headerPercentText(page);
  const barra = await attrOne(headerProgress(page), 'aria-valuenow');
  return conclude([
    check(avisoVisible, `el aviso «Hito actualizado» con «${aviso}»`, avisoVisible ? 'aviso visible' : 'sin ese aviso'),
    check(estadoVisible === estado, `el estado de ${hito} es ${estado}`, `el estado de ${hito} es ${estadoVisible ?? '(sin leer)'}`),
    check(recuentoVisible === recuento, `el recuento dice ${recuento}`, `el recuento dice ${recuentoVisible ?? '(sin leer)'}`),
    check(cabecera.reached, `la cabecera del programa muestra ${avance}%`, `la cabecera muestra ${visible ?? '(sin leer)'} (barra ${barra ?? '(sin leer)'})`),
  ]);
};

// --- Esquema 2: un avance que el servidor rechaza vuelve al valor anterior ---------------------------------------------------

const rejectedMove: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const id = strict('hito', HITO_ID, hito);
  const expected = `el aviso «No se pudo guardar el hito», el deslizador de ${hito} vuelve a 10 % y el estado de ${hito} sigue «En curso»`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledMilestones(page);
  await failMilestoneWrite(page, id, 'PATCH');
  const movido = await runSteps([[`mover el avance de ${hito} a 60`, () => sliderOf(page, hito).fill('60', ACTION)]]);
  if (movido) return actionMissing(expected, movido);

  const aviso = await waitUntil(() => hasToast(page, 'No se pudo guardar el hito'));
  const vuelve = await waitUntil(async () => (await attrOne(sliderOf(page, hito), 'aria-valuetext')) === '10 %');
  const estado = await statusOfRow(page, 'PRG-001', hito);
  return conclude([
    check(aviso.reached, 'el aviso «No se pudo guardar el hito»', aviso.reached ? 'aviso visible' : 'sin ese aviso'),
    check(vuelve.reached, `el deslizador de ${hito} vuelve a 10 %`, `el deslizador de ${hito} muestra ${String(await attrOne(sliderOf(page, hito), 'aria-valuetext'))}`),
    check(estado === 'En curso', `el estado de ${hito} sigue «En curso»`, `el estado de ${hito} es ${estado ?? '(sin leer)'}`),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-008',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withCookieNote(moveSlider)],
    [2, withCookieNote(rejectedMove)],
  ]),
});
