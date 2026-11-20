import type { Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, HOLD_MS, holdsFor, valueOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { verdictOf } from '../verdict';
import {
  AUDIT_PATH,
  act,
  actionFailed,
  clearButton,
  countNow,
  countText,
  emptyOf,
  entitySelect,
  errorOf,
  failAuditRequests,
  failureEvidence,
  fromInput,
  linesIn,
  onWeb,
  openPath,
  presenceOf,
  presenceText,
  resetAlumno,
  retryOf,
  searchInput,
  signIn,
  toInput,
  waitCount,
  watchAuditRequests,
  type Failure,
} from './common';

// US-AUDITORIA-007 — Filtrar, buscar y limpiar el registro de auditoría en /audit (web). Preparación de cada fila: alumno01 reiniciado
// con el token de su administrador; auditor@sigpro.test entra en /login?tenant=alumno01 sin sesión previa y abre /audit. Cada filtro se
// comprueba por el recuento, por el estado vacío y por el propio valor del control (un filtro que no cambia la lista no prueba nada).

const UNFILTERED = countText(20, 130);
const EMPTY_TITLE = 'Sin eventos';
const EMPTY_HINT = 'Ningún evento coincide con los filtros aplicados.';

/** Columna «entidad»: el texto que se elige en «Entidad» y su valor de control (la clave de la entidad en el selector). */
const ENTITY: ReadonlyMap<string, string> = new Map<string, string>([
  ['Requisito', 'requirement'],
  ['No conformidad', 'nc'],
]);

/** Columna «estado_vacio»: si el estado vacío debe verse. */
const EMPTY_STATE: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['no aparece «Sin eventos»', false],
  ['aparece «Sin eventos» y «Ningún evento coincide con los filtros aplicados.»', true],
]);

/** Columnas «desde» y «hasta»: `(vacío)` es el campo sin escribir; lo demás, una fecha AAAA-MM-DD. */
const DATE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2026-01-19', '2026-01-19'],
  ['2026-01-06', '2026-01-06'],
]);

/**
 * Abre /audit con auditor@sigpro.test y espera al recuento sin filtros (control: la lista de partida es la de 20 de 130). `before`
 * prepara algo antes de abrir la página (p. ej. una prueba de fallo). Devuelve el motivo si no se llega a la partida.
 */
const openAsAuditor = async (page: Page, expected: string, before?: () => Promise<unknown>): Promise<string | undefined> => {
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return `auditor@sigpro.test entra en /login?tenant=alumno01: ${entered} (${expected})`;
  await before?.();
  const opened = await openPath(page, AUDIT_PATH);
  if (opened !== undefined) return opened;
  const control = await waitCount(page, UNFILTERED);
  return control ? undefined : `el recuento no llega a «${UNFILTERED}» antes de filtrar (control)`;
};

/** Esquema 1: la entidad elegida deja solo sus eventos (y, con cero, el estado vacío). */
const entityFilter: BrowserRowHandler = onWeb(async (row, { page }) => {
  const entidad = cell(row, 'entidad');
  const contador = cell(row, 'contador');
  const vacio = strict('estado_vacio', EMPTY_STATE, cell(row, 'estado_vacio'));
  const valor = strict('entidad', ENTITY, entidad);
  const expected = `elegir ${entidad} → contador «${contador}»; ${cell(row, 'estado_vacio')}`;
  const opened = await openAsAuditor(page, expected);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const picked = await act(entitySelect(page), `elegir «${entidad}» en «Entidad»`, (element) => element.selectOption({ label: entidad }, { timeout: 5_000 }));
  if (picked !== undefined) return actionFailed(expected, picked);
  const reached = await waitCount(page, contador);
  const select = await valueOf(entitySelect(page));
  const count = await countNow(page);
  const empty = await presenceOf(emptyOf(page));
  const emptyLines = await linesIn(emptyOf(page));
  const emptyOk = vacio ? empty === 'visible' && emptyLines.includes(EMPTY_TITLE) && emptyLines.includes(EMPTY_HINT) : empty === 'hidden';
  return verdictOf([
    check(reached && count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
    check(select === valor, `«Entidad» muestra ${entidad}`, `«Entidad» vale ${select ?? '(sin leer)'}`),
    check(emptyOk, cell(row, 'estado_vacio'), `estado vacío ${empty === 'visible' ? `visible con «${emptyLines.join(' | ')}»` : presenceText(empty)}`),
  ]);
});

/** Esquema 2: «Desde» y «Hasta» incluyen los días completos (control: los campos guardan lo escrito). */
const dateRange: BrowserRowHandler = onWeb(async (row, { page }) => {
  const desde = strict('desde', DATE, cell(row, 'desde'));
  const hasta = strict('hasta', DATE, cell(row, 'hasta'));
  const contador = cell(row, 'contador');
  const expected = `Desde ${cell(row, 'desde')} y Hasta ${cell(row, 'hasta')} → «${contador}»`;
  const opened = await openAsAuditor(page, expected);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  if (desde !== '') {
    const typedFrom = await act(fromInput(page), 'escribir «Desde»', (element) => element.fill(desde, ACTION));
    if (typedFrom !== undefined) return actionFailed(expected, typedFrom);
  }
  const typedTo = await act(toInput(page), 'escribir «Hasta»', (element) => element.fill(hasta, ACTION));
  if (typedTo !== undefined) return actionFailed(expected, typedTo);
  const reached = await waitCount(page, contador);
  const fromValue = await valueOf(fromInput(page));
  const toValue = await valueOf(toInput(page));
  const count = await countNow(page);
  return verdictOf([
    check(reached && count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
    check(fromValue === desde && toValue === hasta, `los campos guardan ${desde || '(vacío)'} y ${hasta}`, `«Desde» vale «${fromValue ?? '(sin leer)'}», «Hasta» vale «${toValue ?? '(sin leer)'}»`),
  ]);
});

/** Esquema 3: el texto busca en la acción y en el código de la entidad (el campo guarda lo escrito). */
const searchText: BrowserRowHandler = onWeb(async (row, { page }) => {
  const texto = cell(row, 'texto');
  const contador = cell(row, 'contador');
  const vacio = strict('estado_vacio', EMPTY_STATE, cell(row, 'estado_vacio'));
  const expected = `escribir ${texto} → «${contador}»; ${cell(row, 'estado_vacio')}`;
  const opened = await openAsAuditor(page, expected);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const typed = await act(searchInput(page), `escribir ${texto} en «Buscar en la auditoría»`, (element) => element.fill(texto, ACTION));
  if (typed !== undefined) return actionFailed(expected, typed);
  const reached = await waitCount(page, contador);
  const value = await valueOf(searchInput(page));
  const count = await countNow(page);
  const empty = await presenceOf(emptyOf(page));
  const emptyLines = await linesIn(emptyOf(page));
  const emptyOk = vacio ? empty === 'visible' && emptyLines.includes(EMPTY_TITLE) && emptyLines.includes(EMPTY_HINT) : empty === 'hidden';
  return verdictOf([
    check(reached && count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`),
    check(value === texto, `el campo guarda «${texto}»`, `el campo guarda «${value ?? '(sin leer)'}»`),
    check(emptyOk, cell(row, 'estado_vacio'), `estado vacío ${empty === 'visible' ? `visible con «${emptyLines.join(' | ')}»` : presenceText(empty)}`),
  ]);
});

/** Esquema 4: los filtros se combinan, y «Limpiar filtros» devuelve la lista completa. */
const combineAndClear: BrowserRowHandler = onWeb(async (row, { page }) => {
  const entidad = cell(row, 'entidad');
  const dia = cell(row, 'dia');
  const expected = `entidad ${entidad} y día ${dia} en Desde y Hasta → Mostrando 5 de 5 eventos; «Limpiar filtros» → ${UNFILTERED}`;
  const opened = await openAsAuditor(page, expected);
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const picked = await act(entitySelect(page), `elegir «${entidad}» en «Entidad»`, (element) => element.selectOption({ label: entidad }, { timeout: 5_000 }));
  if (picked !== undefined) return actionFailed(expected, picked);
  const typedFrom = await act(fromInput(page), 'escribir el día en «Desde»', (element) => element.fill(dia, ACTION));
  if (typedFrom !== undefined) return actionFailed(expected, typedFrom);
  const typedTo = await act(toInput(page), 'escribir el día en «Hasta»', (element) => element.fill(dia, ACTION));
  if (typedTo !== undefined) return actionFailed(expected, typedTo);
  const combined = await waitCount(page, countText(5, 5));
  const countCombined = await countNow(page);
  const clearWas = await presenceOf(clearButton(page));
  const cleared1 = await act(clearButton(page), 'pulsar «Limpiar filtros»', (element) => element.click(ACTION));
  if (cleared1 !== undefined) return actionFailed(expected, cleared1);
  const cleared = await waitCount(page, UNFILTERED);
  const countCleared = await countNow(page);
  const clearAfter = await holdsFor(async () => (await presenceOf(clearButton(page))) === 'hidden', HOLD_MS);
  const entityAfter = await valueOf(entitySelect(page));
  return verdictOf([
    check(combined && countCombined === countText(5, 5), `combinados: «${countText(5, 5)}»`, `combinados: «${countCombined ?? '(sin leer)'}»`),
    check(clearWas === 'visible', '«Limpiar filtros» aparece con filtros escritos', `«Limpiar filtros» ${presenceText(clearWas)}`),
    check(cleared && countCleared === UNFILTERED, `tras «Limpiar filtros»: «${UNFILTERED}»`, `tras «Limpiar filtros»: «${countCleared ?? '(sin leer)'}»`),
    check(clearAfter.held && entityAfter === '', '«Limpiar filtros» deja de aparecer y «Entidad» vuelve a todas', `«Limpiar filtros» ${clearAfter.held ? 'no aparece' : 'sigue apareciendo'}; «Entidad» vale «${entityAfter ?? '(sin leer)'}»`),
  ]);
});

/** Esquema 5: un fallo al filtrar muestra el aviso y «Reintentar» vuelve a pedir la lista con los filtros actuales. */
const filterFailure: BrowserRowHandler = onWeb(async (row, { page }) => {
  const entidad = cell(row, 'entidad');
  const contador = cell(row, 'contador');
  const expected = `elegir ${entidad} con la API fallando → aviso «No se pudo cargar la auditoría»; «Reintentar» → ${contador}`;
  const failure: Failure = { on: true, failed: 0, passed: 0 };
  const requests = watchAuditRequests(page);
  const opened = await openAsAuditor(page, expected, () => failAuditRequests(page, (url) => url.searchParams.get('entity') === 'requirement', failure));
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const picked = await act(entitySelect(page), `elegir «${entidad}» en «Entidad»`, (element) => element.selectOption({ label: entidad }, { timeout: 5_000 }));
  if (picked !== undefined) return actionFailed(expected, picked);
  const shown = await waitUntil(async () => (await presenceOf(errorOf(page))) === 'visible');
  const title = (await linesIn(errorOf(page)))[0];
  const retry = await presenceOf(retryOf(page));
  failure.on = false;
  const pressed = await act(retryOf(page), 'pulsar «Reintentar»', (element) => element.click(ACTION));
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const back = await waitCount(page, contador);
  const count = await countNow(page);
  const verdictChecks: Check[] = [
    check(shown.reached && title === 'No se pudo cargar la auditoría', 'aviso «No se pudo cargar la auditoría»', shown.reached ? `aviso «${title ?? '(vacío)'}»` : 'no aparece el aviso'),
    check(retry === 'visible', 'botón «Reintentar»', `botón «Reintentar» ${presenceText(retry)}`),
    check(back && count === contador, `contador «${contador}» tras «Reintentar»`, `contador «${count ?? '(sin leer)'}»`),
  ];
  return verdictOf(verdictChecks, { evidence: failureEvidence(failure, requests) });
});

defineBrowserRows({
  story: 'US-AUDITORIA-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, entityFilter],
    [2, dateRange],
    [3, searchText],
    [4, combineAndClear],
    [5, filterFailure],
  ]),
});
