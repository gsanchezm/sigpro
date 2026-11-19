import type { Locator, Page } from '@playwright/test';
import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { resetTenants, TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, preparationFailedWeb, strict, type Check } from '../../support/checks';
import { ACTION, isVisible, linesOf, waitUntil } from '../../support/browser';
import { ACCOUNT_OF, bearer, getRaw, loginAs, sendRun, verdict } from '../api/common';
import { upload } from '../api/files';
import {
  downloadBytes,
  firstRunId,
  interact,
  onWeb,
  prepareCase,
  readRunRow,
  readTableHeaders,
  runRowOf,
  runsTable,
  type Blocked,
  type RunRowRead,
} from './common';

// US-VER-EJECUCION-007 — Historial de ejecuciones con sus evidencias y descargas, en la web. Preparación de cada fila: reinicio de
// alumno01; la persona entra como consultor@sigpro.test y abre /verification/TC-001. La E4 registra antes RUN-051 con la API (alumno01).
// Las celdas de cada fila se leen en UNA evaluación (texto, imágenes con su estado, pies de figura). El pie de la evidencia se compara
// por su primera línea (el nombre). La descarga se comprueba por el nombre sugerido y por los BYTES del archivo guardado, comparados
// con los que guarda la API.

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

/** Bytes que guarda la API para una evidencia, leídos con la cuenta de alumno01 (`undefined` si no se pueden leer). */
const apiBytesOf = async (id: string): Promise<Buffer | undefined> => {
  const session = await loginAs(strict('cuenta', ACCOUNT_OF, 'alumno01@sigpro.lab'));
  if (session.token === undefined) return undefined;
  const fetched = await getRaw(`/evidence/${id}`, TENANT_A, bearer(session.token));
  return fetched.status === 200 ? fetched.bytes : undefined;
};

/** Descarga de una evidencia desde su fila: nombre sugerido, bytes guardados y el bloqueo del clic si lo hubo. */
const downloadFrom = async (page: Page, button: Locator, label: string): Promise<{ readonly name?: string; readonly bytes?: Buffer; readonly blocked?: Blocked; readonly error?: string }> => {
  const clicked: { blocked?: Blocked } = {};
  try {
    const saved = await downloadBytes(page, async () => {
      clicked.blocked = await interact(button, label, (element) => element.click(ACTION));
    });
    return { name: saved.name, bytes: saved.bytes, ...(clicked.blocked === undefined ? {} : { blocked: clicked.blocked }) };
  } catch (failure) {
    return { ...(clicked.blocked === undefined ? {} : { blocked: clicked.blocked }), error: failure instanceof Error ? (failure.message.split('\n')[0] ?? 'error') : String(failure) };
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
  const columns = await readTableHeaders(page);
  const checks: Check[] = [
    check(columns !== undefined && JSON.stringify(columns) === JSON.stringify(['Fecha', 'Resultado', 'Notas', 'Evidencias', 'Ejecutado por']), 'columnas del historial «Fecha», «Resultado», «Notas», «Evidencias» y «Ejecutado por»', `columnas ${columns === undefined ? '(sin leer)' : columns.join(', ')}`),
    check(read?.cells[1] === result, `resultado «${result}» (columna «Resultado»)`, `resultado «${read?.cells[1] ?? '(sin leer)'}»`),
    check(read?.cells[2] === notes, `notas «${notes}» (columna «Notas»)`, `notas «${read?.cells[2] ?? '(sin leer)'}»`),
    check(read?.cells[4] === REGISTRO, `registrada por ${REGISTRO} (columna «Ejecutado por»)`, `registrada por «${read?.cells[4] ?? '(sin leer)'}»`),
  ];
  if (evidence === undefined) {
    checks.push(check(read?.cells[3] === 'Sin evidencias', 'en la columna de evidencias «Sin evidencias»', `columna de evidencias «${read?.cells[3] ?? '(sin leer)'}»`));
  } else {
    const thumb = read?.images.find((image) => image.alt === 'Evidencia TC-001');
    // El pie de la evidencia: su primera línea es el nombre del archivo (el resto son el tamaño y el botón)
    const captionName = read?.captions.map((caption) => linesOf(caption)[0]);
    checks.push(check(captionName?.includes(evidence) === true, `la captura ${evidence} en la columna de evidencias`, `nombres de evidencia: ${captionName?.join(' | ') || 'ninguno'}`));
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
  const download = await downloadFrom(page, button, `pulsar «Descargar ${name}» en ${id}`);
  const apiBytes = await apiBytesOf('EV-001');
  const thumbShown = await isVisible(target.getByRole('img', { name: 'Evidencia TC-001', exact: true }));
  const read = await readRunRow(target);
  const same = download.bytes !== undefined && apiBytes !== undefined && download.bytes.equals(apiBytes);
  return verdict(
    [
      check(download.name === name, `el navegador guarda el archivo ${name} (nombre sugerido)`, download.name === undefined ? `no se descargó ningún archivo${download.error === undefined ? '' : ` (${download.error})`}${download.blocked === undefined ? '' : ` · ${download.blocked.message}`}` : `el navegador guarda ${download.name}`),
      check(same, `los bytes guardados son los de la evidencia EV-001 que guarda la API`, download.bytes === undefined ? 'sin bytes descargados' : apiBytes === undefined ? 'la API no devuelve EV-001 con alumno01 (no hay bytes de referencia)' : `bytes guardados ${download.bytes.length}; bytes de la API ${apiBytes.length}; ${same ? 'idénticos' : 'distintos'}`),
      check(thumbShown, 'la miniatura de la evidencia está identificada como «Evidencia TC-001»', thumbShown ? 'miniatura «Evidencia TC-001» visible' : `imágenes de la fila: ${read?.images.map((image) => image.alt ?? '(sin texto)').join(', ') || 'ninguna'}`),
    ],
    download.blocked === undefined ? undefined : download.blocked.note,
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
  // El distintivo PDF se pinta como un icono (imagen con texto «PDF»): se comprueba que el elemento se ve, no su contenido
  const badgeShown = await isVisible(target.getByRole('img', { name: `Documento PDF ${name}`, exact: true }));
  const captionName = read?.captions.map((caption) => linesOf(caption)[0]);
  const button = target.getByRole('button', { name: `Descargar ${name}`, exact: true });
  const download = await downloadFrom(page, button, `pulsar «Descargar ${name}» en RUN-051`);
  const apiBytes = await apiBytesOf('EV-014');
  const same = download.bytes !== undefined && apiBytes !== undefined && download.bytes.equals(apiBytes);
  return verdict(
    [
      check(badgeShown && captionName?.includes(name) === true, `la evidencia de RUN-051 se pinta con el distintivo «PDF» y el nombre ${name}`, `distintivo ${badgeShown ? 'visible' : 'no visible'}; nombres de evidencia: ${captionName?.join(' | ') || 'ninguno'}`),
      check(download.name === name, `el navegador guarda el archivo ${name} (nombre sugerido)`, download.name === undefined ? `no se descargó ningún archivo${download.error === undefined ? '' : ` (${download.error})`}${download.blocked === undefined ? '' : ` · ${download.blocked.message}`}` : `el navegador guarda ${download.name}`),
      check(same, 'los bytes guardados son los de la evidencia EV-014 que guarda la API', download.bytes === undefined ? 'sin bytes descargados' : apiBytes === undefined ? 'la API no devuelve EV-014 con alumno01 (no hay bytes de referencia)' : `bytes guardados ${download.bytes.length}; bytes de la API ${apiBytes.length}; ${same ? 'idénticos' : 'distintos'}`),
    ],
    download.blocked === undefined ? undefined : download.blocked.note,
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
