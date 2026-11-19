import type { Locator, Page } from '@playwright/test';
import { call } from '../../../story-runs/support/api';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { HITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, outcome, type BrowserRowHandler } from '../../core/framework';
import { buttonNamed, cardOf, countLine, decOf, deleteItem, enterAndOpen, failMilestoneWrite, gestorToken, incOf, literal, menuOf, onExpoWeb, settledCards, sliderOf, statusInCard } from './common';
import { attrOne, enabledOne, hasToast, prepFailed, seen, textOne, waitToast, noToastFor } from '../web/common';

// US-HITOS-012 — Mover el avance de un hito de 5 en 5 y borrarlo con confirmación (app móvil, Expo web a 390 px). Preparación de cada fila:
// reinicio de alumno01 con el token de su administrador; después, inicio de sesión de gestor@sigpro.test con «alumno01» en «Tenant de
// trabajo», la ficha de PRG-001 y la opción «Hitos». Las filas que necesitan un avance concreto lo fijan antes por HTTP (PATCH con el
// token de gestor). La fila de error responde 500 a PATCH /api/milestones/PRG-001-M02 antes de pulsar.

const PREPARACION: ReadonlyMap<string, 'seed' | 'parche95'> = new Map<string, 'seed' | 'parche95'>([
  ['PDR tiene el avance del seed (10 %)', 'seed'],
  ['CDR tiene el avance del seed (0 %)', 'seed'],
  ['SRR tiene el avance del seed (100 %)', 'seed'],
  ['PDR se ha llevado a 95 % con PATCH /api/milestones/PRG-001-M02', 'parche95'],
]);

/** Botón de la celda, normalizado el signo menos (U+2212 o guion) a «-». */
const BOTON: ReadonlyMap<string, 'mas' | 'menos'> = new Map<string, 'mas' | 'menos'>([
  ['«+»', 'mas'],
  ['«-»', 'menos'],
]);

interface Efecto {
  readonly deshabilitado?: boolean;
  readonly avance: string;
  readonly estado?: string;
  readonly recuento?: string;
}

const RESULTADO_AVANCE: ReadonlyMap<string, Efecto> = new Map<string, Efecto>([
  ['el avance de PDR pasa a 15 % y su estado sigue «En curso»', { avance: '15 %', estado: 'En curso' }],
  ['el botón «−» está deshabilitado y el avance de CDR sigue en 0 %', { deshabilitado: true, avance: '0 %' }],
  ['el botón «+» está deshabilitado y el avance de SRR sigue en 100 %', { deshabilitado: true, avance: '100 %' }],
  ['el avance de SRR pasa a 95 %, su estado pasa a «En curso» y el recuento dice «0 de 9 hitos cumplidos»', { avance: '95 %', estado: 'En curso', recuento: '0 de 9 hitos cumplidos' }],
  ['el avance de PDR pasa a 100 %, su estado pasa a «Cumplido» y el recuento dice «2 de 9 hitos cumplidos»', { avance: '100 %', estado: 'Cumplido', recuento: '2 de 9 hitos cumplidos' }],
]);

const avanceOf = (page: Page, hito: string): Promise<string | undefined> => attrOne(sliderOf(page, hito), 'aria-valuetext');

// --- Esquema 1: los botones − y + mueven el avance de 5 en 5 sin salirse de 0 a 100 -----------------------------------------

const stepButtons: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const prep = strict('preparacion', PREPARACION, cell(row, 'preparacion'));
  const boton = strict('boton', BOTON, cell(row, 'boton').replace(/−/g, '-'));
  const efecto = strict('resultado', RESULTADO_AVANCE, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  if (prep === 'parche95') {
    const token = await gestorToken();
    if (token === undefined) return outcome(false, expected, 'la preparación no se cumplió: gestor@sigpro.test no inicia sesión por HTTP', { note: 'Preparación por HTTP fallida.' });
    const parche = await call('PATCH', '/milestones/PRG-001-M02', { tenant: TENANT_A, token, body: { progress: 95 } });
    if (parche.status !== 200) return outcome(false, expected, `la preparación no se cumplió: PATCH de PDR a 95 responde ${parche.status}`, { note: 'Preparación por HTTP fallida.' });
  }
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);

  const control: Locator = boton === 'mas' ? incOf(page, hito) : decOf(page, hito);
  const simbolo = boton === 'mas' ? '+' : '−';
  if (efecto.deshabilitado) {
    const habilitado = await enabledOne(control);
    const avance = await avanceOf(page, hito);
    return conclude([
      check(habilitado === false, `el botón «${simbolo}» de ${hito} está deshabilitado`, `el botón «${simbolo}» ${String(habilitado)}`),
      check(avance === efecto.avance, `el avance de ${hito} sigue en ${efecto.avance}`, `el avance de ${hito} es ${avance ?? '(sin leer)'}`),
    ]);
  }
  await control.click(ACTION);
  await waitUntil(async () => (await avanceOf(page, hito)) === efecto.avance);
  const checks: Check[] = [check((await avanceOf(page, hito)) === efecto.avance, `el avance de ${hito} pasa a ${efecto.avance}`, `el avance de ${hito} es ${(await avanceOf(page, hito)) ?? '(sin leer)'}`)];
  if (efecto.estado !== undefined) {
    const estado = await statusInCard(page, hito);
    checks.push(check(estado === efecto.estado, `el estado de ${hito} es ${efecto.estado}`, `el estado de ${hito} es ${estado ?? '(sin leer)'}`));
  }
  if (efecto.recuento !== undefined) {
    const recuento = await textOne(countLine(page));
    checks.push(check(recuento === efecto.recuento, `el recuento dice ${efecto.recuento}`, `el recuento dice ${recuento ?? '(sin leer)'}`));
  }
  return conclude(checks);
};

// --- Esquema 2: un avance que el servidor rechaza vuelve al valor anterior ----------------------------------------------------

const rejectedStep: BrowserRowHandler = async (row, { page }) => {
  const hito = literal(cell(row, 'hito'));
  const expected = `el aviso «No se pudo guardar el hito», el avance de ${hito} vuelve a 10 % y su estado sigue «En curso»`;
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  await failMilestoneWrite(page, 'PRG-001-M02', 'PATCH');
  await incOf(page, hito).click(ACTION);
  const aviso = await waitUntil(() => hasToast(page, 'No se pudo guardar el hito'));
  const vuelve = await waitUntil(async () => (await avanceOf(page, hito)) === '10 %');
  const estado = await statusInCard(page, hito);
  return conclude([
    check(aviso.reached, 'el aviso «No se pudo guardar el hito»', aviso.reached ? 'aviso visible' : 'sin ese aviso'),
    check(vuelve.reached, `el avance de ${hito} vuelve a 10 %`, `el avance de ${hito} es ${(await avanceOf(page, hito)) ?? '(sin leer)'}`),
    check(estado === 'En curso', `el estado de ${hito} sigue «En curso»`, `el estado de ${hito} es ${estado ?? '(sin leer)'}`),
  ]);
};

// --- Esquema 3: eliminar un hito desde su menú pide confirmación ----------------------------------------------------------------

const DECISION: ReadonlyMap<string, 'cancelar' | 'eliminar'> = new Map<string, 'cancelar' | 'eliminar'>([
  ['pulsa «Cancelar»', 'cancelar'],
  ['pulsa «Eliminar»', 'eliminar'],
]);

const RESULTADO_BORRADO: ReadonlyMap<string, 'sigue' | 'borrado'> = new Map<string, 'sigue' | 'borrado'>([
  ['la hoja se cierra y «PDR» sigue en la lista sin ningún aviso', 'sigue'],
  ['«PDR» desaparece de la lista, aparece el aviso «Hito eliminado» con «PDR» y el recuento dice «1 de 8 hitos cumplidos»', 'borrado'],
]);

const removeFromMenu: BrowserRowHandler = async (row, { page }) => {
  const decision = strict('accion', DECISION, cell(row, 'accion'));
  const resultado = strict('resultado', RESULTADO_BORRADO, cell(row, 'resultado'));
  const expected = cell(row, 'resultado');
  await resetTenants([TENANT_A]);
  const failure = await enterAndOpen(page, DEMO.gestor, 'PRG-001');
  if (failure) return prepFailed(expected, failure);
  await settledCards(page);
  await menuOf(page, 'PDR').click(ACTION);
  await deleteItem(page).click(ACTION);
  const hoja = page.getByTestId(HITOS_TESTIDS.MILESTONE_DELETE_DIALOG);
  await waitUntil(() => seen(hoja).then((value) => value === true));
  await buttonNamed(page, decision === 'cancelar' ? 'Cancelar' : 'Eliminar').click(ACTION);

  if (resultado === 'sigue') {
    const cerrada = await waitUntil(() => seen(hoja).then((value) => value === false));
    const sigue = await seen(cardOf(page, 'PDR'));
    const sinAviso = await noToastFor(page, 'Hito eliminado');
    return conclude([
      check(cerrada.reached, 'la hoja se cierra', cerrada.reached ? 'la hoja se cerró' : 'la hoja sigue abierta'),
      check(sigue === true, '«PDR» sigue en la lista', sigue === true ? '«PDR» sigue en la lista' : '«PDR» no está en la lista'),
      check(sinAviso, 'ningún aviso', sinAviso ? 'ningún aviso' : 'aparece un aviso'),
    ]);
  }
  const aviso = await waitToast(page, 'Hito eliminado', 'PDR');
  const quitada = await waitUntil(() => seen(cardOf(page, 'PDR')).then((value) => value === false));
  const recuento = await textOne(countLine(page));
  return conclude([
    check(aviso, 'el aviso «Hito eliminado» con «PDR»', aviso ? 'aviso visible' : 'sin ese aviso'),
    check(quitada.reached, '«PDR» desaparece de la lista', quitada.reached ? '«PDR» desaparece de la lista' : '«PDR» sigue en la lista'),
    check(recuento === '1 de 8 hitos cumplidos', 'el recuento dice «1 de 8 hitos cumplidos»', `el recuento dice ${recuento ?? '(sin leer)'}`),
  ]);
};

defineBrowserRows({
  story: 'US-HITOS-012',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(stepButtons)],
    [2, onExpoWeb(rejectedStep)],
    [3, onExpoWeb(removeFromMenu)],
  ]),
});
