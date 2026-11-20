import type { Page } from '@playwright/test';
import { MOVIL_PROGRAMS_TESTIDS, PROGRAMAS_DYNAMIC_TESTIDS } from '../../../../packages/shared/src/testids';
import { DEMO, TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { ACTION, attrOf, quoted, safe, waitUntil, type Step } from '../../support/browser';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { defineBrowserRows, type BrowserRowHandler, type Outcome } from '../../core/framework';
import {
  COOKIE_NOTE,
  MOBILE_NOTE,
  MOBILE_URL,
  actionMissing,
  browserOf,
  conclude,
  describeCount,
  reachable,
  runStepsLogged,
  unreachableMobile,
  visibleCount,
  withNote,
  type Lang,
} from './common';
import { PLATFORMS, TRANSVERSAL_NOTE, openContext, signInFor, type Platform } from './transversal';

// US-I18N-002 — Fechas, importes y avances con el formato del idioma (TRANSVERSAL: web a 1440 px y app móvil servida como web de Expo
// a 390 px; NO nativa). Preparación de cada fila: reinicio de alumno01; gestor@sigpro.test entra con el idioma de la fila (el inglés se
// elige en Acceso antes de entrar). La Regla del espacio no separable se mide EXACTA: en las filas en español el separador entre la cifra
// y «€» debe ser U+00A0 (la app lo emite con Intl; la celda de la historia lleva espacio ASCII por tipografía).

const IDIOMA: ReadonlyMap<string, Lang> = new Map<string, Lang>([
  ['español', 'es'],
  ['inglés', 'en'],
]);

const DETAIL_PATH = /\/programs\/PRG-003/;

const NBSP_NOTE = 'La celda de la historia lleva espacio ASCII por tipografía; la Regla pide el espacio no separable U+00A0 entre la cifra y «€», y la comparación es exacta con U+00A0.';

const HOURS_NOTE = 'La Regla de horas (hh:mm:ss, 24 h) y la de «otros números» no tienen Esquema en esta historia: no se miden aquí.';

/** Abre el detalle de PRG-003 desde la lista, como lo haría una persona. */
const openDetail = (platform: Platform, page: Page): readonly Step[] => [
  [
    'abrir el detalle de PRG-003',
    () => (platform === 'web' ? page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_LINK('PRG-003')) : page.getByRole('link', { name: /^PRG-003 · / })).click(ACTION),
  ],
  ['llegar a /programs/PRG-003', () => page.waitForURL(DETAIL_PATH, ACTION)],
];

/** Textos crudos de los `dd` visibles de la página (la web muestra cada dato como par `dt`/`dd`). Sin normalizar: el espacio cuenta. */
const ddTexts = (page: Page): Promise<readonly string[]> => safe<readonly string[]>(() => page.locator('dd').filter({ visible: true }).allInnerTexts(), []);

/** Texto crudo del elemento de la app móvil (`innerText`, sin normalizar); vacío si no se puede leer. */
const rawTextOf = (page: Page, testId: string): Promise<string> => safe(() => page.getByTestId(testId).innerText({ timeout: 1_000 }), '');

/** Cómo se muestra un valor crudo: el espacio no separable se hace visible como [U+00A0]. */
const show = (value: string): string => value.replace(/\u00a0/g, '[U+00A0]');

/** Comprueba que algún valor visible es EXACTAMENTE el esperado (sin normalizar); lo observado son los valores visibles. */
const exactValueCheck = async (read: () => Promise<readonly string[]>, label: string, expected: string): Promise<Check> => {
  await waitUntil(async () => (await read()).includes(expected));
  const values = (await read()).map(show).filter((value) => value !== '');
  const found = (await read()).includes(expected);
  return check(found, `${label} «${show(expected)}»`, found ? `${label} «${show(expected)}»` : `${label}: ningún valor exacto; visibles: ${values.join(' | ') || '(ninguno)'}`);
};

/** Caracteres fuera de ASCII de un texto (p. ej. U+00A0 entre la cifra y «€»): la evidencia del espacio real. */
const nonAsciiOf = (text: string): readonly string[] =>
  Array.from(text)
    .filter((char) => char.charCodeAt(0) > 127)
    .map((char) => `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);

/** Añade varias notas a un resultado, en orden, sin perder las que ya tenga. */
const withNotes = (result: Outcome, notes: readonly string[]): Outcome => notes.reduce((acc, note) => withNote(acc, note), result);

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
    // Español: el separador entre la cifra y «€» debe ser U+00A0 exacto. Inglés: «€» pegado a la cifra, sin separador.
    const expectedImporte = lang === 'es' ? importe.replace(' ', '\u00a0') : importe;
    const checks: Check[] =
      platform === 'web'
        ? [await exactValueCheck(() => ddTexts(page), 'importe', expectedImporte), await exactValueCheck(() => ddTexts(page), 'fechas', fechas)]
        : [
            await exactValueCheck(async () => [await rawTextOf(page, MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET)], 'importe', expectedImporte),
            await exactValueCheck(async () => [await rawTextOf(page, MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_DATES)], 'fechas', fechas),
          ];
    // La evidencia se lee DESPUÉS de esperar a los valores: el carácter real del importe mostrado
    const shownImporte = platform === 'web' ? ((await ddTexts(page)).find((value) => value.includes('€')) ?? '') : await rawTextOf(page, MOVIL_PROGRAMS_TESTIDS.PROGRAM_DETAIL_BUDGET);
    const notes = [
      ...(lang === 'es' ? [NBSP_NOTE] : []),
      HOURS_NOTE,
      ...(platform === 'web' ? [COOKIE_NOTE] : [MOBILE_NOTE, TRANSVERSAL_NOTE]),
    ];
    return withNotes(conclude(checks, { evidence: { caracteresDelImporte: nonAsciiOf(shownImporte) } }), notes);
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
    // Web: el `title` de la barra; app móvil: su nombre accesible (`aria-label`). Debe haber UNA barra en la fila de PRG-001.
    const bar = page.getByTestId(PROGRAMAS_DYNAMIC_TESTIDS.PROGRAMS_ROW('PRG-001')).locator('[role="progressbar"]');
    const attribute = platform === 'web' ? 'title' : 'aria-label';
    const reached = await waitUntil(async () => (await visibleCount(bar)) === 1 && (await attrOf(bar, attribute)) === texto);
    const count = await visibleCount(bar);
    const measured = await attrOf(bar, attribute);
    const result = conclude([
      check(
        reached.reached,
        `barra «${texto}» (una sola en la fila de PRG-001)`,
        count === 1 ? `barra «${measured ?? '(sin descripción)'}»` : `${describeCount(count)} barras de progreso en la fila de PRG-001`,
      ),
    ]);
    const notes = [HOURS_NOTE, ...(platform === 'web' ? [COOKIE_NOTE] : [MOBILE_NOTE, TRANSVERSAL_NOTE])];
    return withNotes(result, notes);
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
