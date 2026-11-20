import type { Locator } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { CEILING_MS, textOf } from '../../support/browser';
import { cell, check, conclude, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { COOKIE_NOTE, ambiguityOutcome, describeNamed, namedOf, ncCard, prepFailed, programRow, quietCookies, resetAlumno, settle, signInToPrograms, runStepsLogged } from './common';
import { DETALLE_TESTIDS } from '../../../../packages/shared/src/testids';

// US-A11Y-004 — Insignias y barras de progreso con su valor escrito (web, 1440 px).
// Preparación de cada fila: reinicio de alumno01 y sesión de gestor@sigpro.test desde el formulario de acceso.
// El estado y la severidad se LEEN como texto de su celda o de su tarjeta (la celda de estado es la cuarta de la fila; la insignia
// de severidad es el `span` de la tarjeta). La barra se lee por su nombre accesible y su número visible, que es la celda de avance.

const PROGRESS_CELL = 7;
const STATUS_CELL = 3;

const ROW_STATUS: ReadonlyMap<string, string> = new Map([
  ['«Activo»', 'Activo'],
  ['«Borrador»', 'Borrador'],
  ['«En pausa»', 'En pausa'],
  ['«Cerrado»', 'Cerrado'],
  ['«Cancelado»', 'Cancelado'],
]);

/** Texto de la celda de estado de la fila: la insignia es la única parte con texto en esa celda. */
const statusTextOf = (row: Locator): Promise<string | undefined> => textOf(row.locator('td').nth(STATUS_CELL));

// --- Esquema 1: el estado de un programa se lee como texto en su fila ---------------------------------------------------------

const programStatus: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const expected = `el estado de la fila de ${code} se lee como ${cell(row, 'estado')}`;
  const wanted = strict('estado', ROW_STATUS, cell(row, 'estado'));
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const measured = await settle(() => statusTextOf(programRow(page, code)), (text) => text === wanted);
  return conclude([check(measured.ok, `el estado de la fila se lee como «${wanted}»`, measured.value === undefined ? `la celda de estado de ${code} no se lee` : `el estado de la fila se lee como «${measured.value}»`)], { note: COOKIE_NOTE });
};

// --- Esquema 2: la severidad se lee como texto en su tarjeta -------------------------------------------------------------------

const SEVERITY: ReadonlyMap<string, string> = new Map([
  ['«Menor»', 'Menor'],
  ['«Mayor»', 'Mayor'],
  ['«Crítica»', 'Crítica'],
]);

const severityLabel: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const wanted = strict('severidad', SEVERITY, cell(row, 'severidad'));
  const expected = `la severidad de ${code} se lee como «${wanted}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const navigated = await runStepsLogged([['abrir /nc', () => page.goto('/nc', { timeout: CEILING_MS })], ['ver «No conformidades»', () => ncCard(page, code).waitFor({ timeout: CEILING_MS })]]);
  if (navigated) return prepFailed(expected, navigated);
  // La insignia es el `span` con severidad de la tarjeta; el `li` de la tarjeta también lleva el atributo, por eso se acota a `span`
  const badge = ncCard(page, code).locator('span[data-severity]');
  const measured = await settle(() => textOf(badge), (text) => text === wanted);
  return conclude([check(measured.ok, `la severidad se lee como «${wanted}»`, measured.value === undefined ? `la insignia de ${code} no se lee` : `la severidad se lee como «${measured.value}»`)], { note: COOKIE_NOTE });
};

// --- Esquema 3: la barra de avance de la tabla se anuncia con el programa y su porcentaje ----------------------------------

const progressRow: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const percent = cell(row, 'porcentaje');
  const expectedName = `Programa ${code}: ${percent}%`;
  const expected = `la barra se anuncia como «${expectedName}» y el número visible es «${percent}%»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  const bar = programRow(page, code).getByRole('progressbar');
  const ambiguous = await ambiguityOutcome(bar, expected, `la barra de ${code}`);
  if (ambiguous) return ambiguous;
  const name = await settle(() => namedOf(bar), (value) => value?.name === expectedName);
  const visibleCell = await settle(() => textOf(programRow(page, code).locator('td').nth(PROGRESS_CELL)), (text) => text === `${percent}%`);
  return conclude(
    [
      check(name.ok, `la barra se anuncia como «${expectedName}»`, name.value === undefined ? `la barra de ${code} no se lee como barra de progreso` : `la barra se anuncia como ${describeNamed(name.value)}`),
      check(visibleCell.ok, `el número visible junto a la barra es «${percent}%»`, visibleCell.value === undefined ? `sin número visible en la celda de avance de ${code}` : `el número visible es «${visibleCell.value}»`),
    ],
    { note: COOKIE_NOTE },
  );
};

// --- Esquema 4: la barra de avance de la ficha se anuncia con el programa y su porcentaje ---------------------------------

const detailProgress: BrowserRowHandler = async (row, { page, context }) => {
  const code = cell(row, 'codigo');
  const percent = cell(row, 'porcentaje');
  const expectedName = `Programa ${code}: ${percent}%`;
  const expected = `la barra de la ficha se anuncia como «${expectedName}»`;
  await quietCookies(context);
  await resetAlumno();
  const signed = await signInToPrograms(page, DEMO.gestor.email, DEMO.gestor.password);
  if (signed) return prepFailed(expected, signed);
  // La barra del encabezado de la ficha (sin contar las de los hitos) se localiza por su identificador de prueba de respaldo
  const bar = page.getByTestId(DETALLE_TESTIDS.PROGRAM_DETAIL_PROGRESS);
  const opened = await runStepsLogged([
    [`abrir /programs/${code}`, () => page.goto(`/programs/${code}`, { timeout: CEILING_MS })],
    ['ver la barra de avance de la ficha', () => bar.waitFor({ timeout: CEILING_MS })],
  ]);
  if (opened) return prepFailed(expected, opened);
  const name = await settle(() => namedOf(bar), (value) => value?.name === expectedName);
  return conclude([check(name.ok, `la barra se anuncia como «${expectedName}»`, name.value === undefined ? 'la barra de la ficha no se lee como barra de progreso' : `la barra se anuncia como ${describeNamed(name.value)}`)], {
    note: `${COOKIE_NOTE} La barra de la ficha se localiza por su identificador de prueba (respaldo): es la del encabezado, antes de los paneles de hitos.`,
  });
};

defineBrowserRows({
  story: 'US-A11Y-004',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, programStatus],
    [2, severityLabel],
    [3, progressRow],
    [4, detailProgress],
  ]),
});
