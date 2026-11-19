import type { Locator } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, isVisible, waitUntil } from '../../support/browser';
import { ACCOUNT_OF, bearer, loginAs, sendRun, verdict } from '../api/common';
import { upload } from '../api/files';
import { downloadName, firstRunId, interact, onWeb, prepareCase, readRunRow, runRowOf, runsTable, type Blocked, type RunRowRead } from './common';

// US-VER-EJECUCION-007 — Historial de ejecuciones con sus evidencias y descargas, en la web. Preparación de cada fila: reinicio de
// alumno01; la persona entra como consultor@sigpro.test y abre /verification/TC-001. La E4 registra antes RUN-051 con la API (alumno01).
// Las celdas de cada fila se leen en UNA evaluación (texto, imágenes con su estado, pies de figura); la descarga se observa por el
// nombre sugerido por el navegador, no por el de la evidencia.

/** Resultado de la celda, con el texto que muestra el historial (el mismo que el selector). */
const RESULTADO: ReadonlyMap<string, string> = new Map<string, string>([
  ['«Bloqueado»', 'Bloqueado'], // strict: 007/E1/resultado
  ['«Superado»', 'Superado'],
]);

/** Notas de cada ejecución del seed (texto exacto). */
const NOTAS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Ejecución bloqueada: el entorno de pruebas no estaba disponible.', 'Ejecución bloqueada: el entorno de pruebas no estaba disponible.'], // strict: 007/E1/notas
  ['Resultado conforme con el criterio de aceptación.', 'Resultado conforme con el criterio de aceptación.'],
]);

/** Evidencias de la celda: ninguna («Sin evidencias»), o la captura del seed (nombre de su archivo). */
const EVIDENCIAS: ReadonlyMap<string, string | undefined> = new Map<string, string | undefined>([
  ['«Sin evidencias»', undefined], // strict: 007/E1/evidencias
  ['la captura TC-001-001.png', 'TC-001-001.png'],
]);

/** Identificador de la ejecución (fila del historial). */
const EJECUCION: ReadonlyMap<string, string> = new Map<string, string>([
  ['RUN-002', 'RUN-002'], // strict: 007/E1/ejecucion
  ['RUN-001', 'RUN-001'], // strict: 007/E3/ejecucion
  ['RUN-051', 'RUN-051'], // strict: 007/E4/ejecucion
]);

/** Nombre del archivo de una evidencia de imagen (E3) o PDF (E4). */
const ARCHIVO: ReadonlyMap<string, string> = new Map<string, string>([
  ['TC-001-001.png', 'TC-001-001.png'], // strict: 007/E3/nombre
  ['informe.pdf', 'informe.pdf'], // strict: 007/E4/evidencia
]);

/** Primera y segunda fila del orden (E2). */
const ORDEN: ReadonlyMap<string, string> = new Map<string, string>([
  ['RUN-002', 'RUN-002'], // strict: 007/E2/primera
  ['RUN-001', 'RUN-001'], // strict: 007/E2/segunda
]);

/** Quién registró las ejecuciones del seed. */
const REGISTRO = 'Lucía Fernández';

/** Espera (con techo) a que las miniaturas de la fila dejen de cargar; devuelve la lectura de la fila. */
const settledRow = async (row: Locator): Promise<RunRowRead | undefined> => {
  await waitUntil(async () => {
    const read = await readRunRow(row);
    return read !== undefined && read.images.every((image) => image.state !== 'loading' && image.state !== null);
  });
  return readRunRow(row);
};

/** Distintivo «PDF»: el icono de la evidencia es una imagen SVG en data URI cuyo texto contiene «PDF». */
const pdfBadgeOf = (src: string | null): boolean => {
  if (src === null) return false;
  const comma = src.indexOf(',');
  if (comma < 0) return false;
  try {
    return decodeURIComponent(src.slice(comma + 1)).includes('>PDF<');
  } catch {
    return false;
  }
};

// --- E1: cada ejecución muestra su resultado, sus notas, sus evidencias y quién la registró -----------------------------------------

const muestra: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `la fila de ${cell(row, 'ejecucion')} muestra su resultado, sus notas y sus evidencias`;
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const id = strict('ejecucion', EJECUCION, cell(row, 'ejecucion'));
  const result = strict('resultado', RESULTADO, cell(row, 'resultado'));
  const notes = strict('notas', NOTAS, cell(row, 'notas'));
  const evidence = strict('evidencias', EVIDENCIAS, cell(row, 'evidencias'));
  const target = runRowOf(page, id);
  await waitUntil(() => isVisible(target));
  const read = await settledRow(target);
  const checks: Check[] = [
    check(read?.cells[1] === result, `resultado «${result}»`, `resultado «${read?.cells[1] ?? '(sin leer)'}»`),
    check(read?.cells[2] === notes, `notas «${notes}»`, `notas «${read?.cells[2] ?? '(sin leer)'}»`),
    check(read?.cells[4] === REGISTRO, `registrada por ${REGISTRO}`, `registrada por «${read?.cells[4] ?? '(sin leer)'}»`),
  ];
  if (evidence === undefined) {
    checks.push(check(read?.cells[3] === 'Sin evidencias', 'en la columna de evidencias «Sin evidencias»', `columna de evidencias «${read?.cells[3] ?? '(sin leer)'}»`));
  } else {
    const thumb = read?.images.find((image) => image.alt === 'Evidencia TC-001');
    checks.push(check(read?.captions.includes(evidence) === true, `la captura ${evidence} en la columna de evidencias`, `pies de evidencia: ${read?.captions.join(' | ') || 'ninguno'}`));
    checks.push(check(thumb !== undefined && thumb.state === 'ready', 'la miniatura «Evidencia TC-001» cargada', `miniatura ${thumb === undefined ? 'sin «Evidencia TC-001»' : `con estado ${thumb.state ?? '(sin estado)'}`}`));
  }
  return verdict(checks);
};

// --- E2: las ejecuciones van de la más reciente a la más antigua -----------------------------------------------------------------------

const ordenDe: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `${cell(row, 'primera')} aparece encima de ${cell(row, 'segunda')}`;
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const first = strict('primera', ORDEN, cell(row, 'primera'));
  const second = strict('segunda', ORDEN, cell(row, 'segunda'));
  await waitUntil(async () => (await firstRunId(page)) !== undefined);
  const ids: readonly string[] = await runsTable(page)
    .evaluate((table) => Array.from(table.querySelectorAll('tbody tr')).map((tr) => tr.getAttribute('data-testid') ?? ''), undefined, { timeout: 2_000 })
    .catch(() => []);
  const indexOf = (id: string): number => ids.indexOf(`run-row-${id}`);
  return verdict([
    check(indexOf(first) >= 0 && indexOf(second) >= 0 && indexOf(first) < indexOf(second), `${first} aparece encima de ${second}`, `filas en pantalla: ${ids.map((id) => id.replace(/^run-row-/, '')).join(', ') || 'ninguna'}`),
  ]);
};

// --- E3: una evidencia de imagen se identifica, se ve y se descarga con su nombre --------------------------------------------------------

const descargaImagen: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const expected = `pulsar «Descargar» en ${cell(row, 'ejecucion')} guarda ${cell(row, 'nombre')}`;
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const id = strict('ejecucion', EJECUCION, cell(row, 'ejecucion'));
  const name = strict('nombre', ARCHIVO, cell(row, 'nombre'));
  const target = runRowOf(page, id);
  await settledRow(target);
  const button = target.getByRole('button', { name: `Descargar ${name}`, exact: true });
  const clicked: { blocked?: Blocked } = {};
  const saved = await downloadName(page, async () => {
    clicked.blocked = await interact(button, `pulsar «Descargar ${name}» en ${id}`, (element) => element.click(ACTION));
  }).catch(() => undefined);
  const thumbShown = await isVisible(target.getByRole('img', { name: 'Evidencia TC-001', exact: true }));
  const read = await readRunRow(target);
  return verdict(
    [
      check(saved === name, `el navegador guarda el archivo ${name}`, saved === undefined ? `no se descargó ningún archivo${clicked.blocked === undefined ? '' : ` (${clicked.blocked.message})`}` : `el navegador guarda ${saved}`),
      check(thumbShown, 'la miniatura de la evidencia está identificada como «Evidencia TC-001»', thumbShown ? 'miniatura «Evidencia TC-001» visible' : `imágenes de la fila: ${read?.images.map((image) => image.alt ?? '(sin texto)').join(', ') || 'ninguna'}`),
    ],
    clicked.blocked?.note,
  );
};

// --- E4: una evidencia PDF se muestra con su distintivo y se descarga con su nombre -------------------------------------------------

const descargaPdf: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const name = strict('evidencia', ARCHIVO, cell(row, 'evidencia'));
  const expected = `RUN-051 muestra el distintivo «PDF» y ${name}; pulsar «Descargar» guarda ${name}`;
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return preparationFailedWeb(expected, 'alumno01 no obtiene accessToken en alumno01');
  const sent = await sendRun({ tenant: TENANT_A, code: 'TC-001', fields: { result: 'fail', notes: 'Adjunto informe' }, files: [upload(name, 'application/pdf', 'pdf', 1024)], headers: bearer(session.token) });
  if (sent.status !== 201) return preparationFailedWeb(expected, `la ejecución RUN-051 con ${name} responde ${sent.status} (no 201)`);
  const prepared = await prepareCase(page, 'consultor');
  if (prepared !== undefined) return preparationFailedWeb(expected, prepared);
  const target = runRowOf(page, 'RUN-051');
  await settledRow(target);
  const read = await readRunRow(target);
  const pdf = read?.images.find((image) => image.alt === `Documento PDF ${name}`);
  const badge = pdfBadgeOf(pdf?.src ?? null);
  const button = target.getByRole('button', { name: `Descargar ${name}`, exact: true });
  const clicked: { blocked?: Blocked } = {};
  const saved = await downloadName(page, async () => {
    clicked.blocked = await interact(button, `pulsar «Descargar ${name}» en RUN-051`, (element) => element.click(ACTION));
  }).catch(() => undefined);
  return verdict(
    [
      check(pdf !== undefined && badge && read?.captions.includes(name) === true, `la evidencia de RUN-051 muestra el distintivo «PDF» y el nombre ${name}`, `imagen «${pdf?.alt ?? '(sin imagen)'}» ${badge ? 'con distintivo PDF' : 'sin distintivo PDF'}; pie: ${read?.captions.join(' | ') || 'ninguno'}`),
      check(saved === name, `el navegador guarda el archivo ${name}`, saved === undefined ? `no se descargó ningún archivo${clicked.blocked === undefined ? '' : ` (${clicked.blocked.message})`}` : `el navegador guarda ${saved}`),
    ],
    clicked.blocked?.note,
  );
};

defineBrowserRows({
  story: 'US-VER-EJECUCION-007',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(muestra)],
    [2, onWeb(ordenDe)],
    [3, onWeb(descargaImagen)],
    [4, onWeb(descargaPdf)],
  ]),
});
