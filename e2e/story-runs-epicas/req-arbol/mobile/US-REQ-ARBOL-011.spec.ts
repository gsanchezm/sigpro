import type { Page } from '@playwright/test';
import { DEMO, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS, REQUISITOS_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, eq, interact, norm, onExpoWeb, openMobile, prepareMobile, quotedOr, searchField, sheet, tab, textOf , sheetOpen } from './common';

// US-REQ-ARBOL-011 — Ver las cifras del programa y leer el documento de requisitos (app móvil, Expo web a 390 px). Preparación de cada fila: reinicio
// de alumno01 con su administrador; la app en /login sin sesión, con alumno01 en «Tenant de trabajo», gestor@sigpro.test, «Entrar» y Programas.

const prepare = (page: Page): Promise<string | undefined> => prepareMobile(page, DEMO.gestor);

/** Tarjeta de cifras (su id de prueba: la cifra no tiene otro rastro propio): la línea de valor y la línea auxiliar. */
const METRIC: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Requisitos»', REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_TOTAL],
  ['«Cobertura de verificación»', REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_COVERAGE],
  ['«Pendientes de aprobación»', REQUISITOS_TESTIDS.REQUIREMENTS_METRIC_PENDING],
]);

const metricLines = async (page: Page, testId: string): Promise<readonly string[]> =>
  ((await textOf(page.getByTestId(testId))) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');

// --- Esquema 1: las cifras del programa muestran sus valores y sus textos auxiliares ------------------------------------------------

const figures: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const cifra = cell(row, 'cifra');
  const testId = strict('cifra', METRIC, cifra);
  const valor = quotedOr(cell(row, 'valor'));
  const texto = quotedOr(cell(row, 'texto'));
  const expected = `la cifra ${quotedOr(cifra)} muestra ${valor} con el texto ${texto} (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `${programa}/requirements`);
  await waitUntil(async () => (await metricLines(page, testId)).length > 0 && (await metricLines(page, testId))[1] !== '…');
  const lines = await metricLines(page, testId);
  return conclude([
    check(norm(lines[1]) === norm(valor), `la cifra muestra ${valor}`, `la cifra muestra ${lines[1] ?? '(no legible)'}`),
    eq('el texto auxiliar', lines[lines.length - 1], texto),
  ]);
};

// --- Esquema 2: la pestaña Documento numera los requisitos según su lugar en el árbol ------------------------------------------------

/** Líneas visibles de la sección del documento de un requisito. */
const docLines = async (page: Page, code: string): Promise<readonly string[]> =>
  ((await textOf(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.DOC_SECTION(code)))) ?? '').split('\n').map((line) => norm(line) ?? '').filter((line) => line !== '');

const numbering: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const numero = quotedOr(cell(row, 'numero'));
  const titulo = quotedOr(cell(row, 'titulo'));
  const expected = `ve el título ${titulo} precedido del número ${numero} (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-002/requirements');
  const opened = await interact(tab(page, 'document'), 'elegir la pestaña «Documento»', (el) => el.click(ACTION));
  if (opened) return actionFailed(expected, opened);
  await waitUntil(async () => (await docLines(page, codigo)).length > 0);
  const lines = await docLines(page, codigo);
  // El texto visible puede ir en una o en dos líneas; la etiqueta accesible de la sección lleva número y título juntos (se usa como respaldo)
  const label = await page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.DOC_SECTION(codigo)).getAttribute('aria-label', { timeout: 2000 }).catch(() => null);
  const wanted = `${numero} ${titulo}`;
  return conclude([check(lines.includes(wanted) || label === wanted, `ve «${wanted}»`, `ve «${lines.join(' · ') || '(nada)'}» (etiqueta «${label ?? '(sin etiqueta)'}»)`)]);
};

const numberingUnderSearch: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `con la búsqueda 017 el documento numera REQ-015 con «1» y REQ-017 con «1.1» (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, `/programs/${programa}/requirements`);
  const opened = await interact(tab(page, 'document'), 'elegir la pestaña «Documento»', (el) => el.click(ACTION));
  if (opened) return actionFailed(expected, opened);
  const typed = await interact(searchField(page), 'escribir 017 en «Buscar requisitos»', (el) => el.fill('017', ACTION));
  if (typed) return actionFailed(expected, typed);
  await waitUntil(async () => (await docLines(page, 'REQ-017')).length > 0);
  const first = (await docLines(page, 'REQ-015')).find((line) => line.endsWith('Registro de eventos del subsistema 015')) ?? '';
  const second = (await docLines(page, 'REQ-017')).find((line) => line.endsWith('Disponibilidad del subsistema 017')) ?? '';
  const numberOf = (text: string): string => text.split(' ')[0] ?? '';
  return conclude([
    check(numberOf(first) === '1', 'REQ-015 con el número «1»', `REQ-015 con el número «${numberOf(first)}»`),
    check(numberOf(second) === '1.1', 'REQ-017 con el número «1.1»', `REQ-017 con el número «${numberOf(second)}»`),
  ]);
};

// --- Esquema 4: pulsar el título de un requisito del documento abre su hoja de detalle ----------------------------------------------

const documentOpens: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const expected = `la hoja «Detalle del requisito» muestra el código ${codigo}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openMobile(page, '/programs/PRG-002/requirements');
  const opened = await interact(tab(page, 'document'), 'elegir la pestaña «Documento»', (el) => el.click(ACTION));
  if (opened) return actionFailed(expected, opened);
  const pressed = await interact(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.DOC_OPEN(codigo)), `pulsar el título de ${codigo} en el documento`, (el) => el.click(ACTION));
  if (pressed) return actionFailed(expected, pressed);
  await waitUntil(async () => (await sheetOpen(page)));
  const shown = (await textOf(sheet(page).getByTestId(REQUISITOS_TESTIDS.REQUIREMENT_CODE))) ?? '(no legible)';
  const checks: Check[] = [eq('el código de la hoja', shown, codigo)];
  return conclude(checks);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-011',
  surface: 'expo-web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onExpoWeb(figures)],
    [2, onExpoWeb(numbering)],
    [3, onExpoWeb(numberingUnderSearch)],
    [4, onExpoWeb(documentOpens)],
  ]),
});
