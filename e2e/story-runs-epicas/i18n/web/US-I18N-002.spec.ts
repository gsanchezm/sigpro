import type { Page } from '@playwright/test';
import { MOVIL_PROGRAMS_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, quoted, safe, waitUntil, type Step } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import {
  conclude,
  COOKIE_NOTE,
  MOBILE_NOTE,
  MOBILE_URL,
  actionMissing,
  browserOf,
  normalizeSpaces,
  reachable,
  runStepsLogged,
  textCheck,
  unreachableMobile,
  withNote,
  type Lang,
} from './common';
import { PLATFORMS, openContext, signInFor, type Platform } from './transversal';

// US-I18N-002 — Fechas, importes y avances con el formato del idioma (TRANSVERSAL: web a 1440 px y app móvil servida como web de Expo
// a 390 px; NO nativa). Preparación de cada fila: reinicio de alumno01; gestor@sigpro.test entra con el idioma de la fila (el inglés se
// elige en Acceso antes de entrar). El espacio entre la cifra y «€» llega de Intl como espacio no separable: la comparación normaliza
// solo la tipografía de los espacios, y el carácter real se anota en la evidencia.

const IDIOMA: ReadonlyMap<string, Lang> = new Map<string, Lang>([
  ['español', 'es'],
  ['inglés', 'en'],
]);

const DETAIL_PATH = /\/programs\/PRG-003/;

/** Abre el detalle de PRG-003 desde la lista, como lo haría una persona. */
const openDetail = (platform: Platform, page: Page): readonly Step[] => [
  [
    'abrir el detalle de PRG-003',
    () => (platform === 'web' ? page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_LINK('PRG-003')) : page.getByRole('link', { name: /^PRG-003 · / })).click(ACTION),
  ],
  ['llegar a /programs/PRG-003', () => page.waitForURL(DETAIL_PATH, ACTION)],
];

/** Textos de los `dd` de la página (la web muestra cada dato como par `dt`/`dd`; el nombre de cada etiqueta no hace falta). */
const ddTexts = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => page.locator('dd').allInnerTexts(), []);

/** Comprueba que algún valor visible es exactamente el esperado (espacios normalizados); lo observado son los valores visibles. */
const valueListCheck = async (read: () => Promise<readonly string[]>, label: string, expected: string): Promise<Check> => {
  await waitUntil(async () => (await read()).map(normalizeSpaces).includes(expected));
  const values = (await read()).map(normalizeSpaces).filter((value) => value !== '');
  const found = values.find((value) => value === expected);
  return check(found !== undefined, `${label} «${expected}»`, found !== undefined ? `${label} «${found}»` : `${label}: ningún valor igual; visibles: ${values.join(' | ') || '(ninguno)'}`);
};

/** Caracteres fuera de ASCII de un texto (p. ej. U+00A0 entre la cifra y «€»): la evidencia del espacio real. */
const nonAsciiOf = (text: string): readonly string[] =>
  Array.from(text)
    .filter((char) => char.charCodeAt(0) > 127)
    .map((char) => `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

// --- Esquema 1: el detalle de un programa muestra su importe y sus fechas con el formato del idioma ---------------------------

const detailFormats: BrowserRowHandler = async (row, { context }) => {
  const lang = strict('idioma', IDIOMA, cell(row, 'idioma'));
  const platform: Platform = strict('plataforma', PLATFORMS, cell(row, 'plataforma'));
  const importe = cell(row, 'importe');
  const fechas = cell(row, 'fechas');
  const expected = `ve el importe ${importe} y las fechas ${fechas}`;
  if (platform === 'movil' && !(await reachable(`${MOBILE_URL}/login`))) return unreachableMobile(expected);
  await resetTenants([TENANT_A]);
  const own = await openContext(browserOf(context), platform, 'es-ES', platform === 'web');
  try {
    const page = await own.newPage();
    const prepared = await runStepsLogged(signInFor(platform, page, lang, DEMO.gestor.email, DEMO.gestor.password));
    if (prepared) return preparationFailedWeb(expected, prepared);
    const opened = await runStepsLogged(openDetail(platform, page));
    if (opened) return actionMissing(expected, opened);
    if (platform === 'web') {
      const rawWeb = await ddTexts(page);
      const withEuro = rawWeb.find((value) => value.includes('€')) ?? '';
      return conclude(
        [await valueListCheck(() => ddTexts(page), 'importe', importe), await valueListCheck(() => ddTexts(page), 'fechas', fechas)],
        { note: COOKIE_NOTE, evidence: { caracteresDelImporte: nonAsciiOf(withEuro) } },
      );
    }
    const rawMobile = await safe(() => page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET).innerText({ timeout: 1_000 }), '');
    return conclude(
      [
        await textCheck(page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET), 'importe', importe),
        await textCheck(page.getByTestId(MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DATES), 'fechas', fechas),
      ],
      { note: MOBILE_NOTE, evidence: { caracteresDelImporte: nonAsciiOf(rawMobile) } },
    );
  } finally {
    await own.close();
  }
};

// --- Esquema 2: la barra de avance de un programa se describe con el idioma elegido -------------------------------------------

const progressBar: BrowserRowHandler = async (row, { context }) => {
  const lang = strict('idioma', IDIOMA, cell(row, 'idioma'));
  const platform: Platform = strict('plataforma', PLATFORMS, cell(row, 'plataforma'));
  const texto = quoted(cell(row, 'texto'));
  const expected = `la barra de PRG-001 en la lista de programas se describe como «${texto}»`;
  if (platform === 'movil' && !(await reachable(`${MOBILE_URL}/login`))) return unreachableMobile(expected);
  await resetTenants([TENANT_A]);
  const own = await openContext(browserOf(context), platform, 'es-ES', platform === 'web');
  try {
    const page = await own.newPage();
    const prepared = await runStepsLogged(signInFor(platform, page, lang, DEMO.gestor.email, DEMO.gestor.password));
    if (prepared) return preparationFailedWeb(expected, prepared);
    // Web: el `title` de la barra; app móvil: su nombre accesible (`aria-label`). La barra es la de la fila de PRG-001.
    const bar = page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW('PRG-001')).locator('[role="progressbar"]');
    const attribute = platform === 'web' ? 'title' : 'aria-label';
    await waitUntil(async () => (await attrOf(bar, attribute)) === texto);
    const measured = await attrOf(bar, attribute);
    const result = conclude([
      check(measured === texto, `barra «${texto}»`, measured === undefined ? 'barra: sin descripción legible en la fila de PRG-001' : `barra «${measured}»`),
    ]);
    if (platform === 'web') return withNote(result, COOKIE_NOTE);
    return withNote(result, MOBILE_NOTE);
  } finally {
    await own.close();
  }
};

defineBrowserRows({
  story: 'US-I18N-002',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, detailFormats],
    [2, progressBar],
  ]),
});
