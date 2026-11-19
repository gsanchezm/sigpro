import type { Locator, Page } from '@playwright/test';
import { DEMO, resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { REQUISITOS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { ACTION, waitUntil } from '../../support/browser';
import { cell, check, conclude, preparationFailedWeb, strict } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { actionFailed, armDownload, countText, csvOf, eq, interact, norm, onWeb, openPath, quotedOr, signIn, textOf, waitToast } from './common';

// US-REQ-ARBOL-007 — Ver las cifras del programa, leer el documento de requisitos y descargar el CSV (web, 1440 px). Preparación de cada fila:
// reinicio de alumno01 con su administrador, inicio de sesión de gestor@sigpro.test en /login?tenant=alumno01 y llegada a Programas.

const prepare = async (page: Page): Promise<string | undefined> => {
  await resetTenants([TENANT_A]);
  return signIn(page, DEMO.gestor, '1440 px');
};

/** Tarjeta de cifras por su nombre accesible (grupo con el nombre de la cifra). */
const card = (page: Page, label: string): Locator => page.getByRole('group', { name: label, exact: true });

/** Nombre de la tarjeta de la historia → nombre accesible de la cifra. */
const CARD: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Requisitos»', 'Requisitos'],
  ['«Cobertura de verificación»', 'Cobertura de verificación'],
  ['«Pendientes de aprobación»', 'Pendientes de aprobación'],
]);

/** Lo que muestra una tarjeta: su cifra (segunda línea) y su texto auxiliar (última línea). */
const cardText = async (page: Page, label: string): Promise<{ readonly value: string | undefined; readonly aux: string | undefined }> => ({
  value: await textOf(card(page, label).locator('.metric-value')),
  aux: await textOf(card(page, label).locator('.metric-aux')),
});

// --- Esquema 1: las cuatro tarjetas muestran las cifras del programa --------------------------------------------------------------------

const figures: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const tarjeta = strict('tarjeta', CARD, cell(row, 'tarjeta'));
  const valor = quotedOr(cell(row, 'valor'));
  const texto = quotedOr(cell(row, 'texto'));
  const expected = `la tarjeta ${tarjeta} muestra ${valor} con el texto ${texto} (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `${programa}/requirements`);
  await waitUntil(async () => (await cardText(page, tarjeta)).value !== '…');
  const shown = await cardText(page, tarjeta);
  return conclude([
    check(norm(shown.value) === norm(valor), `la tarjeta ${tarjeta} muestra ${valor}`, `la tarjeta ${tarjeta} muestra ${shown.value ?? '(no legible)'}`),
    eq(`el texto de la tarjeta ${tarjeta}`, shown.aux, texto),
  ]);
};

// --- Esquema 2: las cifras no cambian con la búsqueda ni con el filtro de estado ---------------------------------------------------------

const figuresUnderFilter: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = 'la tarjeta «Requisitos» sigue mostrando 14 con el texto «validados: 3» tras escribir 005 y elegir «Validado»';
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const typed = await interact(page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true }), 'escribir 005 en «Buscar requisitos»', (el) => el.fill('005', ACTION));
  if (typed) return actionFailed(expected, typed);
  const picked = await interact(page.getByLabel('Estado', { exact: true }), 'elegir «Validado» en el filtro «Estado»', (el) => el.selectOption({ label: 'Validado' }, ACTION));
  if (picked) return actionFailed(expected, picked);
  await waitUntil(async () => (await page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true }).inputValue({ timeout: 2000 })) === '005');
  // El efecto de la búsqueda y del filtro se mide: con 005 y «Validado» no queda ningún requisito (REQ-005 es aprobado)
  const effect = await waitUntil(async () => (await countText(page)) === '0 de 14 requisitos');
  const counter = await countText(page);
  const noMatch = (await page.getByText('Sin coincidencias', { exact: true }).count()) > 0;
  const chosen = await page.getByLabel('Estado', { exact: true }).inputValue({ timeout: 2000 }).catch(() => undefined);
  const shown = await cardText(page, 'Requisitos');
  return conclude([
    check(effect.reached && noMatch, 'el efecto del filtro: «0 de 14 requisitos» y el aviso «Sin coincidencias»', `contador «${counter ?? '(no legible)'}», aviso «Sin coincidencias» ${noMatch ? 'visible' : 'no visible'}`),
    check(chosen === 'validated', 'el filtro «Estado» tiene «Validado» elegido', `el filtro «Estado» tiene «${chosen ?? '(no legible)'}»`),
    check(shown.value === '14', 'la tarjeta «Requisitos» sigue mostrando 14', `la tarjeta «Requisitos» muestra ${shown.value ?? '(no legible)'}`),
    eq('el texto de la tarjeta «Requisitos»', shown.aux, 'validados: 3'),
  ]);
};

// --- Esquema 3 y 4: la pestaña Documento numera los requisitos según su lugar en el árbol ------------------------------------------------

/** Texto visible del título del documento («número título»), leído del botón que abre el requisito. */
const docTitleOf = (page: Page, code: string): Promise<string | undefined> => textOf(page.getByTestId(REQUISITOS_DYNAMIC_TESTIDS.DOC_OPEN(code)));

const numbering: BrowserRowHandler = async (row, { page }) => {
  const codigo = cell(row, 'codigo');
  const numero = quotedOr(cell(row, 'numero'));
  const titulo = quotedOr(cell(row, 'titulo'));
  const expected = `ve el número ${numero} delante del título ${titulo} (${codigo})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const tab = await interact(page.getByRole('tab', { name: 'Documento', exact: true }), 'elegir la pestaña «Documento»', (el) => el.click(ACTION));
  if (tab) return actionFailed(expected, tab);
  await waitUntil(async () => (await docTitleOf(page, codigo)) !== undefined);
  const observed = (await docTitleOf(page, codigo)) ?? '(no legible)';
  return conclude([check(observed === `${numero} ${titulo}`, `ve «${numero} ${titulo}»`, `ve «${observed}»`)]);
};

const numberingUnderSearch: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `con la búsqueda 017 el documento numera REQ-015 con «1» y REQ-017 con «1.1» (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const tab = await interact(page.getByRole('tab', { name: 'Documento', exact: true }), 'elegir la pestaña «Documento»', (el) => el.click(ACTION));
  if (tab) return actionFailed(expected, tab);
  const typed = await interact(page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true }), 'escribir 017 en «Buscar requisitos»', (el) => el.fill('017', ACTION));
  if (typed) return actionFailed(expected, typed);
  await waitUntil(async () => (await docTitleOf(page, 'REQ-017')) !== undefined);
  const first = (await docTitleOf(page, 'REQ-015')) ?? '';
  const second = (await docTitleOf(page, 'REQ-017')) ?? '';
  const numberOf = (text: string): string => text.split(' ')[0] ?? '';
  return conclude([
    check(numberOf(first) === '1', 'REQ-015 con el número «1»', `REQ-015 con el número «${numberOf(first)}»`),
    check(numberOf(second) === '1.1', 'REQ-017 con el número «1.1»', `REQ-017 con el número «${numberOf(second)}»`),
  ]);
};

// --- Esquema 5 y 6: exportar CSV descarga todos los requisitos del programa ---------------------------------------------------------------

const exportCsv: BrowserRowHandler = async (row, { page }) => {
  const filas = quotedOr(cell(row, 'filas'));
  const expected = `se descarga «sigpro-requisitos.csv», su primera línea es code;title;state;priority;parent;tags;tests y ve el aviso «CSV generado» con ${filas}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const typed = await interact(page.getByRole('searchbox', { name: 'Buscar requisitos', exact: true }), 'escribir 017 en «Buscar requisitos»', (el) => el.fill('017', ACTION));
  if (typed) return actionFailed(expected, typed);
  const downloaded = armDownload(page);
  const clicked = await interact(page.getByRole('button', { name: 'Exportar CSV', exact: true }), 'pulsar «Exportar CSV»', (el) => el.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  const file = await csvOf(await downloaded);
  const toast = await waitToast(page, 'info', 'CSV generado', filas);
  const lines = (file?.text ?? '').split('\n').filter((line) => line.trim() !== '');
  return conclude([
    check(file?.name === 'sigpro-requisitos.csv', 'se descarga «sigpro-requisitos.csv»', file === undefined ? 'no se descargó ningún archivo' : `se descarga «${file.name}»`),
    check(lines[0] === 'code;title;state;priority;parent;tags;tests', 'su primera línea es code;title;state;priority;parent;tags;tests', `su primera línea es ${lines[0] ?? '(vacía)'}`),
    check(lines.length === 15, 'todos los requisitos: 14 líneas tras la cabecera, aunque haya búsqueda', `${lines.length - 1} líneas de requisitos`),
    check(toast.found, `ve el aviso «CSV generado» con «${filas}»`, toast.found ? 've el aviso «CSV generado»' : `avisos de tono info: ${toast.seen.map((entry) => `${entry.title} / ${entry.body}`).join(' · ') || '(ninguno)'}`),
  ]);
};

/** Líneas del CSV que la historia da como texto exacto. */
const LINES: ReadonlyMap<string, string> = new Map<string, string>([
  ['REQ-015;"Registro de eventos del subsistema 015";validated;medium;;;TC-010', 'REQ-015;"Registro de eventos del subsistema 015";validated;medium;;;TC-010'],
  ['REQ-017;"Disponibilidad del subsistema 017";draft;low;REQ-015;security;TC-012', 'REQ-017;"Disponibilidad del subsistema 017";draft;low;REQ-015;security;TC-012'],
]);

const csvLine: BrowserRowHandler = async (row, { page }) => {
  const linea = strict('linea', LINES, cell(row, 'linea'));
  const expected = `una línea del CSV es ${linea}`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, '/programs/PRG-002/requirements');
  const downloaded = armDownload(page);
  const clicked = await interact(page.getByRole('button', { name: 'Exportar CSV', exact: true }), 'pulsar «Exportar CSV»', (el) => el.click(ACTION));
  if (clicked) return actionFailed(expected, clicked);
  const file = await csvOf(await downloaded);
  const lines = (file?.text ?? '').split('\n').map((line) => line.replace(/\r$/, ''));
  const found = lines.find((line) => line.startsWith(linea.split(';')[0] ?? '')) ?? '(sin línea)';
  return conclude([check(lines.includes(linea), `una línea es ${linea}`, `la línea del código es ${found}`)], {
    evidence: { lineas: lines.length },
    note: 'La fila no ejerce el separador «|» (etiquetas y casos separados): REQ-015 y REQ-017 tienen una sola etiqueta o un solo caso, y la historia no fija una fila con varios.',
  });
};

// --- Esquema 7: exportar CSV no está disponible en un programa sin requisitos -------------------------------------------------------------

const disabledExport: BrowserRowHandler = async (row, { page }) => {
  const programa = cell(row, 'programa');
  const expected = `el botón «Exportar CSV» está deshabilitado (${programa})`;
  const failure = await prepare(page);
  if (failure) return preparationFailedWeb(expected, failure);
  await openPath(page, `/programs/${programa}/requirements`);
  const button = page.getByRole('button', { name: 'Exportar CSV', exact: true });
  await waitUntil(async () => (await button.count()) > 0 && (await page.getByText('0 de 0 requisitos', { exact: true }).count()) > 0);
  const disabled = await button.isDisabled({ timeout: 2000 }).catch(() => false);
  return conclude([check(disabled, 'el botón «Exportar CSV» está deshabilitado', disabled ? 'el botón «Exportar CSV» está deshabilitado' : 'el botón «Exportar CSV» está habilitado')]);
};

defineBrowserRows({
  story: 'US-REQ-ARBOL-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(figures)],
    [2, onWeb(figuresUnderFilter)],
    [3, onWeb(numbering)],
    [4, onWeb(numberingUnderSearch)],
    [5, onWeb(exportCsv)],
    [6, onWeb(csvLine)],
    [7, onWeb(disabledExport)],
  ]),
});
