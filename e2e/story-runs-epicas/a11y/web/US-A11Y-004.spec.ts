import type { Locator } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, attrOf, safe, textOf } from '../../support/browser';
import { check, cell, conclude, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  COOKIE_NOTE,
  NETWORK_MS,
  ambiguityOutcome,
  ncCard,
  prepFailed,
  programRow,
  quietCookies,
  resetAlumno,
  runStepsLogged,
  settle,
  signInToPrograms,
  withRoutesReleased,
} from './common';

// US-A11Y-004 — Insignias y barras de progreso con su valor escrito (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 y sesión de gestor@sigpro.test desde el formulario de acceso.
// El estado y la severidad se LEEN como texto de su celda o de su tarjeta (la celda de estado es la cuarta de la fila; la insignia de
// severidad es el `span` de la tarjeta). La barra se localiza por su nombre accesible esperado (debe haber exactamente una); su
// `aria-valuenow` debe ser el número visible junto a ella (la historia pide que lo anunciado sea lo visible).

const PROGRESS_CELL = 7;
const STATUS_CELL = 3;
const NOT_EVALUATED_NOTE = 'Reglas sin fila (no evaluadas): el color acompaña al texto y no lo sustituye (no se mide el color); el contraste lo cubre EP-TEMA.';

const ROW_STATUS: ReadonlyMap<string, string> = new Map([
  ['«Activo»', 'Activo'],
  ['«Borrador»', 'Borrador'],
  ['«En pausa»', 'En pausa'],
  ['«Cerrado»', 'Cerrado'],
  ['«Cancelado»', 'Cancelado'],
]);

const SEVERITY: ReadonlyMap<string, string> = new Map([
  ['«Menor»', 'Menor'],
  ['«Mayor»', 'Mayor'],
  ['«Crítica»', 'Crítica'],
]);

/** Texto de la celda de estado de la fila: la insignia es la única parte con texto en esa celda. */
const statusTextOf = (row: Locator): Promise<string | undefined> => textOf(row.locator('td').nth(STATUS_CELL));

/** Cuenta de elementos que casan (-1 si la lectura falla). */
const countOf = (locator: Locator): Promise<number> => safe(() => locator.count(), -1);

// --- Esquema 1: el estado de un programa se lee como texto en su fila ---------------------------------------------------------

const programStatus: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const wanted = strict('estado', ROW_STATUS, cell(row, 'estado'));
  const expected = `el estado de la fila de ${code} se lee como «${wanted}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const measured = await settle(() => statusTextOf(programRow(page, code)), (text) => text === wanted);
  return conclude([check(measured.ok, `el estado de la fila se lee como «${wanted}»`, measured.value === undefined ? `la celda de estado de ${code} no se lee` : `el estado de la fila se lee como «${measured.value}»`)], {
    note: `${COOKIE_NOTE} ${NOT_EVALUATED_NOTE}`,
  });
};

// --- Esquema 2: la severidad se lee como texto en su tarjeta -------------------------------------------------------------------

const severityLabel: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const wanted = strict('severidad', SEVERITY, cell(row, 'severidad'));
  const expected = `la severidad de ${code} se lee como «${wanted}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const navigated = await runStepsLogged([
    ['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })],
    [`ver la tarjeta de ${code}`, () => ncCard(page, code).waitFor({ timeout: CEILING_MS })],
  ]);
  if (navigated) return prepFailed(expected, navigated);
  // La insignia es el `span` con severidad de la tarjeta; el `li` de la tarjeta también lleva el atributo, por eso se acota a `span`
  const badge = ncCard(page, code).locator('span[data-severity]');
  const ambiguous = await ambiguityOutcome(badge, expected, `la insignia de ${code}`);
  if (ambiguous) return ambiguous;
  const measured = await settle(() => textOf(badge), (text) => text === wanted);
  return conclude([check(measured.ok, `la severidad se lee como «${wanted}»`, measured.value === undefined ? `la insignia de ${code} no se lee` : `la severidad se lee como «${measured.value}»`)], {
    note: `${COOKIE_NOTE} ${NOT_EVALUATED_NOTE}`,
  });
};

// --- Esquema 3: la barra de avance de la tabla se anuncia con el programa y su porcentaje y su valor es el visible -----------

const progressRow: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const percent = cell(row, 'porcentaje');
  const expectedName = `Programa ${code}: ${percent}%`;
  const expected = `la barra se anuncia como «${expectedName}», su valor anunciado es ${percent} y el número visible junto a ella es «${percent}%»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  // La barra se localiza por el nombre que la historia espera; debe haber exactamente una
  const bar = programRow(page, code).getByRole('progressbar', { name: expectedName, exact: true });
  const ambiguous = await ambiguityOutcome(bar, expected, `la barra de ${code}`);
  if (ambiguous) return ambiguous;
  const named = await settle(() => countOf(bar), (count) => count === 1, NETWORK_MS);
  const valueNow = named.ok ? await attrOf(bar, 'aria-valuenow') : undefined;
  const visible =await settle(() => textOf(programRow(page, code).locator('td').nth(PROGRESS_CELL)), (text) => text === `${percent}%`);
  return conclude(
    [
      check(named.ok, `la barra se anuncia como «${expectedName}»`, named.ok ? `la barra se anuncia como «${expectedName}»` : `ninguna barra de ${code} se anuncia con ese nombre (${named.value} coincidencias)`),
      check(valueNow === percent, `su valor anunciado es ${percent}`, valueNow === undefined ? 'sin valor anunciado (aria-valuenow)' : `su valor anunciado es ${valueNow}`),
      check(visible.ok, `el número visible junto a la barra es «${percent}%»`, visible.value === undefined ? `sin número visible en la celda de avance de ${code}` : `el número visible es «${visible.value}»`),
    ],
    { note: `${COOKIE_NOTE} ${NOT_EVALUATED_NOTE}` },
  );
};

// --- Esquema 4: la barra de avance de la ficha se anuncia con el programa y su porcentaje --------------------------------------

const detailProgress: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const percent = cell(row, 'porcentaje');
  const expectedName = `Programa ${code}: ${percent}%`;
  const expected = `la barra de la ficha se anuncia como «${expectedName}» con valor anunciado ${percent}`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const opened = await runStepsLogged([
    [`abrir /programs/${code}`, () => page.goto(`/programs/${code}`, { timeout: CEILING_MS })],
    ['ver las barras de avance de la ficha', () => page.getByRole('progressbar').first().waitFor({ timeout: CEILING_MS })],
  ]);
  if (opened) return prepFailed(expected, opened);
  const bar = page.getByRole('progressbar', { name: expectedName, exact: true });
  const ambiguous = await ambiguityOutcome(bar, expected, `la barra de la ficha de ${code}`);
  if (ambiguous) return ambiguous;
  const named = await settle(() => countOf(bar), (count) => count === 1, NETWORK_MS);
  const valueNow = named.ok ? await attrOf(bar, 'aria-valuenow') : undefined;
  const nameCheck: Check = check(named.ok, `la barra se anuncia como «${expectedName}»`, named.ok ? `la barra se anuncia como «${expectedName}»` : `ninguna barra de la ficha se anuncia con ese nombre (${named.value} coincidencias)`);
  return conclude(
    [
      nameCheck,
      check(valueNow === percent, `su valor anunciado es ${percent}`, valueNow === undefined ? 'sin valor anunciado (aria-valuenow)' : `su valor anunciado es ${valueNow}`),
    ],
    { note: `${COOKIE_NOTE} ${NOT_EVALUATED_NOTE}` },
  );
};

defineBrowserRows({
  story: 'US-A11Y-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, withRoutesReleased(programStatus)],
    [2, withRoutesReleased(severityLabel)],
    [3, withRoutesReleased(progressRow)],
    [4, withRoutesReleased(detailProgress)],
  ]),
});
