import type { Locator, Page } from '@playwright/test';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { ACTION, HOLD_MS, valueOf, waitUntil } from '../../support/browser';
import { cell, check, preparationFailedWeb, sleep, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { verdictOf } from '../verdict';
import { act, actionFailed, countNow, countText, presenceOf, linesIn, resetAlumno, waitCount, watchAuditRequests, type AuditRequests } from '../web/common';
import { clearFilters, clearField, entityValue, fromError, fromField, onExpoWeb, openPath, pickEntity, searchField, signIn, toError, toField, typeInto, type Typed } from './common';

// US-AUDITORIA-009 — Filtrar y buscar en /audit con las fechas escritas a mano (app móvil, Expo web a 390 px). Preparación de cada fila:
// alumno01 reiniciado con el token de su administrador; la app en /login sin sesión, con alumno01 en «Tenant de trabajo», y
// auditor@sigpro.test entra y abre /audit. Las fechas se escriben tecla a tecla con retardo y se relee el valor: si las teclas se
// pierden, la fila lo registra como hallazgo con evidencia. Cada filtro se comprueba por el recuento, por el aviso bajo su campo y por
// la última petición que hizo la pantalla (lo que la API recibió), no solo por la lista.

const UNFILTERED = countText(20, 130);
const INVALID_DATE = 'Indica una fecha válida';
const REVERSED = 'La fecha «Hasta» no puede ser anterior a «Desde»';

/** Última consulta `GET /api/audit` que hizo la pantalla: la que decide la lista. */
const lastQuery = (requests: AuditRequests): URL | undefined => {
  const last = requests.urls[requests.urls.length - 1];
  return last === undefined ? undefined : new URL(last);
};

/** Texto del aviso de un campo de fecha: vacío si no se ve, el texto si se ve, `undefined` si no se puede leer. */
const errorText = async (target: Locator): Promise<string | undefined> => {
  const state = await presenceOf(target);
  if (state === 'unknown') return undefined;
  if (state === 'hidden') return '';
  return (await linesIn(target)).join(' ');
};

/** Columnas «desde» y «hasta»: `(vacío)` es el campo sin escribir. */
const DATE: ReadonlyMap<string, string> = new Map<string, string>([
  ['(vacío)', ''],
  ['2026-01-19', '2026-01-19'],
  ['2026-01-06', '2026-01-06'],
]);
/** Columna «desde» del Esquema 2: fechas que no existen o no tienen la forma AAAA-MM-DD. */
const INVALID: ReadonlyMap<string, string> = new Map<string, string>([
  ['2026-02-30', '2026-02-30'],
  ['2026-13-01', '2026-13-01'],
  ['2026-1-5', '2026-1-5'],
]);

/** Abre /audit con auditor@sigpro.test y espera al recuento sin filtros (control de partida). */
const openAsAuditor = async (page: Page, expected: string): Promise<{ readonly failure?: string; readonly requests?: AuditRequests }> => {
  await resetAlumno();
  const entered = await signIn(page, 'auditor@sigpro.test', 'Audit1234!');
  if (entered !== undefined) return { failure: `auditor@sigpro.test entra en /login con alumno01: ${entered} (${expected})` };
  const requests = watchAuditRequests(page);
  const opened = await openPath(page, '/audit');
  if (opened !== undefined) return { failure: opened };
  if (!(await waitCount(page, UNFILTERED))) return { failure: `el recuento no llega a «${UNFILTERED}» antes de filtrar (control)` };
  return { requests };
};

/** Escritura de una fecha con su relectura: el valor guardado y la posible pérdida de teclas (hallazgo con evidencia). */
interface Written {
  readonly ok: boolean;
  readonly value?: string;
  readonly note?: string;
  readonly blocked?: Typed['blocked'];
}
const writeDate = async (target: Locator, text: string, label: string): Promise<Written> => {
  const typed = await typeInto(target, text);
  if (typed.blocked !== undefined) return { ok: false, note: `${typed.blocked.message} (${typed.blocked.note})`, blocked: typed.blocked };
  if (typed.lost) return { ok: false, value: typed.value, note: `se perdieron teclas en «${label}» (escrito ${text}, leído «${typed.value ?? '(sin leer)'}») con retardo de 40 ms por tecla: hallazgo con evidencia` };
  return { ok: true, value: typed.value };
};

/** Esquema 1: una fecha completa y real se aplica al registro (y no aparece aviso bajo los campos). */
const validDates: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const desde = strict('desde', DATE, cell(row, 'desde'));
  const hasta = strict('hasta', DATE, cell(row, 'hasta'));
  const contador = cell(row, 'contador');
  const expected = `Desde ${cell(row, 'desde')} y Hasta ${cell(row, 'hasta')} → «${contador}», sin aviso bajo las fechas`;
  const opened = await openAsAuditor(page, expected);
  if (opened.failure !== undefined) return preparationFailedWeb(expected, opened.failure);
  const checks: Check[] = [];
  const notes: string[] = [];
  if (desde !== '') {
    const from = await writeDate(fromField(page), desde, 'Desde');
    if (from.blocked !== undefined) return actionFailed(expected, from.blocked);
    if (from.note !== undefined) notes.push(from.note);
    checks.push(check(from.ok && from.value === desde, `«Desde» guarda ${desde}`, `«Desde» guarda «${from.value ?? '(sin leer)'}»`));
  }
  const to = await writeDate(toField(page), hasta, 'Hasta');
  if (to.blocked !== undefined) return actionFailed(expected, to.blocked);
  if (to.note !== undefined) notes.push(to.note);
  checks.push(check(to.ok && to.value === hasta, `«Hasta» guarda ${hasta}`, `«Hasta» guarda «${to.value ?? '(sin leer)'}»`));
  const reached = await waitCount(page, contador);
  const count = await countNow(page);
  const fromAlert = await errorText(fromError(page));
  const toAlert = await errorText(toError(page));
  checks.push(check(reached && count === contador, `contador «${contador}»`, `contador «${count ?? '(sin leer)'}»`));
  checks.push(check(fromAlert === '' && toAlert === '', 'no aparece ningún aviso bajo los campos de fecha', `avisos: «${fromAlert ?? '(sin leer)'}» / «${toAlert ?? '(sin leer)'}»`));
  return verdictOf(checks, notes.length === 0 ? {} : { note: notes.join(' ') });
});

/** Esquema 2: una fecha que no existe no se aplica y lo indica bajo su campo (la lista sigue con los 130 eventos). */
const invalidDate: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const fecha = strict('desde', INVALID, cell(row, 'desde'));
  const expected = `«Desde» ${cell(row, 'desde')} → aviso «${INVALID_DATE}» bajo el campo y contador «${UNFILTERED}»`;
  const opened = await openAsAuditor(page, expected);
  if (opened.failure !== undefined || opened.requests === undefined) return preparationFailedWeb(expected, opened.failure ?? 'sin registro de peticiones');
  const requests = opened.requests;
  const write = await writeDate(fromField(page), fecha, 'Desde');
  if (write.blocked !== undefined) return actionFailed(expected, write.blocked);
  const alert = await waitUntil(async () => (await errorText(fromError(page))) === INVALID_DATE);
  const shown = await errorText(fromError(page));
  await sleep(HOLD_MS); // pausa de la búsqueda (250 ms) y una holgura: la última petición debe haberse hecho
  const last = lastQuery(requests);
  const count = await countNow(page);
  const verdict = verdictOf(
    [
      check(write.value === fecha, `«Desde» guarda ${fecha}`, `«Desde» guarda «${write.value ?? '(sin leer)'}»`),
      check(alert.reached && shown === INVALID_DATE, `aviso «${INVALID_DATE}» bajo «Desde»`, `aviso bajo «Desde»: «${shown ?? '(sin leer)'}»`),
      check(last !== undefined && !last.searchParams.has('from') && !last.searchParams.has('to'), 'ninguna petición lleva la fecha no válida', last === undefined ? 'sin peticiones' : `última consulta: ${last.search || '(sin parámetros)'}`),
      check(count === UNFILTERED, `contador «${UNFILTERED}»`, `contador «${count ?? '(sin leer)'}»`),
    ],
    write.note === undefined ? {} : { note: write.note },
  );
  // Control (fuera del veredicto): en la misma sesión una fecha válida sí se aplica, así que «sin filtro» no es un fallo del arnés
  const cleared = await clearField(fromField(page));
  const control = cleared === undefined ? await writeDate(fromField(page), '2026-01-19', 'Desde (control)') : undefined;
  const controlFiltered = await waitCount(page, countText(9, 9));
  return { ...verdict, evidence: { ...(verdict.evidence ?? {}), controlFecha: control?.value ?? null, controlAplicado: controlFiltered } };
});

/** Esquema 3: «Hasta» anterior a «Desde» no aplica ninguna de las dos fechas y lo indica bajo «Hasta». */
const reversedRange: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const desde = cell(row, 'desde');
  const hasta = cell(row, 'hasta');
  const expected = `Desde ${desde} y Hasta ${hasta} → aviso «${REVERSED}» bajo «Hasta» y contador «${UNFILTERED}»`;
  const opened = await openAsAuditor(page, expected);
  if (opened.failure !== undefined || opened.requests === undefined) return preparationFailedWeb(expected, opened.failure ?? 'sin registro de peticiones');
  const requests = opened.requests;
  const from = await writeDate(fromField(page), desde, 'Desde');
  if (from.blocked !== undefined) return actionFailed(expected, from.blocked);
  const to = await writeDate(toField(page), hasta, 'Hasta');
  if (to.blocked !== undefined) return actionFailed(expected, to.blocked);
  const alert = await waitUntil(async () => (await errorText(toError(page))) === REVERSED);
  const shown = await errorText(toError(page));
  await sleep(HOLD_MS);
  const last = lastQuery(requests);
  const count = await countNow(page);
  const notes = [from.note, to.note].filter((note): note is string => note !== undefined);
  const verdict = verdictOf(
    [
      check(from.ok && from.value === desde && to.ok && to.value === hasta, `«Desde» ${desde} y «Hasta» ${hasta} quedan escritos`, `«Desde» «${from.value ?? '(sin leer)'}» y «Hasta» «${to.value ?? '(sin leer)'}»`),
      check(alert.reached && shown === REVERSED, `aviso «${REVERSED}» bajo «Hasta»`, `aviso bajo «Hasta»: «${shown ?? '(sin leer)'}»`),
      check(last !== undefined && !last.searchParams.has('from') && !last.searchParams.has('to'), 'ninguna de las dos fechas se aplica', last === undefined ? 'sin peticiones' : `última consulta: ${last.search || '(sin parámetros)'}`),
      check(count === UNFILTERED, `contador «${UNFILTERED}»`, `contador «${count ?? '(sin leer)'}»`),
    ],
    notes.length === 0 ? {} : { note: notes.join(' ') },
  );
  // Control (fuera del veredicto): «Hasta» corregido a un día posterior a «Desde» vuelve a aplicar el rango
  const cleared = await clearField(toField(page));
  const controlWrite = cleared === undefined ? await writeDate(toField(page), '2026-01-19', 'Hasta (control)') : undefined;
  const controlApplied = await waitCount(page, countText(9, 9));
  return { ...verdict, evidence: { ...(verdict.evidence ?? {}), controlHasta: controlWrite?.value ?? null, controlAplicado: controlApplied } };
});

/** Esquema 4: entidad y texto se combinan, y «Limpiar filtros» vuelve a la lista completa. */
const combineAndClear: BrowserRowHandler = onExpoWeb(async (row, { page }) => {
  const entidad = cell(row, 'entidad');
  const texto = cell(row, 'texto');
  const contador = cell(row, 'contador');
  const expected = `entidad ${entidad} y texto ${texto} → «${contador}»; «Limpiar filtros» → «${UNFILTERED}»`;
  const opened = await openAsAuditor(page, expected);
  if (opened.failure !== undefined) return preparationFailedWeb(expected, opened.failure);
  const picked = await pickEntity(page, entidad);
  if (picked !== undefined) return actionFailed(expected, picked);
  const entityOk = (await entityValue(page))?.includes(entidad) === true;
  const typed = await typeInto(searchField(page), texto);
  if (typed.blocked !== undefined) return actionFailed(expected, typed.blocked);
  const combined = await waitCount(page, contador);
  const countCombined = await countNow(page);
  const clearWas = await presenceOf(clearFilters(page));
  const cleared = await act(clearFilters(page), 'pulsar «Limpiar filtros»', (element) => element.click(ACTION));
  if (cleared !== undefined) return actionFailed(expected, cleared);
  const back = await waitCount(page, UNFILTERED);
  const countCleared = await countNow(page);
  const clearGone = await waitUntil(async () => (await presenceOf(clearFilters(page))) === 'hidden');
  const searchAfter = await valueOf(searchField(page));
  return verdictOf([
    check(entityOk, `«Entidad» muestra ${entidad}`, `«Entidad» vale «${(await entityValue(page)) ?? '(sin leer)'}»`),
    check(!typed.lost && typed.value === texto, `«Buscar en la auditoría» guarda ${texto}`, typed.lost ? `se perdieron teclas: «${typed.value ?? '(sin leer)'}»` : `guarda «${typed.value ?? '(sin leer)'}»`),
    check(combined && countCombined === contador, `combinados: «${contador}»`, `combinados: «${countCombined ?? '(sin leer)'}»`),
    check(clearWas === 'visible', '«Limpiar filtros» aparece con filtros escritos', `«Limpiar filtros» ${clearWas === 'visible' ? 'visible' : clearWas === 'hidden' ? 'no visible' : 'sin leer'}`),
    check(back && countCleared === UNFILTERED && clearGone.reached && searchAfter === '', `tras «Limpiar filtros»: «${UNFILTERED}», sin «Limpiar filtros» y búsqueda vacía`, `tras «Limpiar filtros»: «${countCleared ?? '(sin leer)'}», búsqueda «${searchAfter ?? '(sin leer)'}»`),
  ]);
});

defineBrowserRows({
  story: 'US-AUDITORIA-009',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, validDates],
    [2, invalidDate],
    [3, reversedRange],
    [4, combineAndClear],
  ]),
});
