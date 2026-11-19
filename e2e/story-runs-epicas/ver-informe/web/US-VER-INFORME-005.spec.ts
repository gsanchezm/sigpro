import { defineBrowserRows, type BrowserRowHandler } from '../../core/framework';
import { cell, check, preparationFailedWeb, strict } from '../../support/checks';
import { TENANT_A, resetTenants } from '../../../story-runs/support/prepare';
import { CASE_CELLS, done, numberOf } from '../api/common';
import {
  NETWORK_CAUSE,
  TRACE_READING,
  actionFailed,
  armToasts,
  clickIn,
  detailReportButton,
  exactTextCheck,
  failNextReport,
  firstDownload,
  linesOfPdf,
  onWeb,
  openPath,
  pdfLineCheck,
  quietCheck,
  quietWindow,
  signIn,
  toastCheck,
  toastShown,
  traceCheck,
  watchDownloads,
} from '../web/common';

// US-VER-INFORME-005 — Descargar el informe de un caso desde su detalle (web, 1440 px). Preparación de cada fila: reinicio de alumno01
// con el token de su administrador; gestor@sigpro.test entra y llega a /programs; después se abre el detalle del caso de la fila.

const SELECTION_NAME = 'informe-verificacion-seleccion.pdf';
const COUNT_LINE = 'Casos de prueba: 1 · Ejecutados: 1 · Sin ejecutar: 0';

/** Resultado del último caso con la etiqueta que muestra la ficha. */
const RESULT_CELLS: ReadonlyMap<string, string> = new Map<string, string>([
  ['Fallido', 'Fallido'],
  ['Superado', 'Superado'],
]);

/** Detalle del aviso de fallo: la traza de la petición fallida, o el texto de red exacto. */
type Detail = { readonly kind: 'trace' } | { readonly kind: 'text'; readonly text: string };

const DETAIL_CELLS: ReadonlyMap<string, Detail> = new Map<string, Detail>([
  ['la traza de la petición fallida', { kind: 'trace' }],
  ['el texto «No se pudo contactar con el servidor»', { kind: 'text', text: 'No se pudo contactar con el servidor' }],
]);

const FAILURE_CELLS: ReadonlyMap<string, 'status500' | 'noResponse'> = new Map<string, 'status500' | 'noResponse'>([
  ['responda con error 500', 'status500'],
  ['no obtenga respuesta del servidor', 'noResponse'],
]);

// --- Esquema 1: el botón del detalle descarga el informe de ese caso ---------------------------------------------------------------

const detailDownloads: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const caso = strict('caso', CASE_CELLS, cell(row, 'caso'));
  const resultado = strict('resultado', RESULT_CELLS, cell(row, 'resultado'));
  const fecha = cell(row, 'fecha');
  const ejecuciones = numberOf(cell(row, 'ejecuciones'));
  const fichaLine = `Último resultado: ${resultado} (${fecha}) · Ejecuciones: ${ejecuciones}`;
  const expected = `se descarga ${SELECTION_NAME} con el PDF «${COUNT_LINE}» y «${fichaLine}», y aviso «Informe generado» con ${SELECTION_NAME}`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openPath(page, `/verification/${caso}`, 'detail');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  const downloads = watchDownloads(page);
  await armToasts(page);
  const pressed = await clickIn(detailReportButton, 'pulsar «Descargar informe PDF» en el detalle')(page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const file = await firstDownload(downloads);
  const toast = await toastShown(page, 'Informe generado');
  return done([
    check(file?.name === SELECTION_NAME, `se descarga el archivo «${SELECTION_NAME}»`, `se descarga «${file?.name ?? '(ninguna descarga)'}»`),
    pdfLineCheck(linesOfPdf(file?.bytes), COUNT_LINE, 'Casos de prueba:'),
    pdfLineCheck(linesOfPdf(file?.bytes), fichaLine, 'Último resultado:'),
    toastCheck(toast, 'Informe generado', SELECTION_NAME),
  ]);
};

// --- Esquema 2: si la petición del informe falla, aparece el aviso de error y no se descarga nada ----------------------------------

const detailFailure: BrowserRowHandler = async (row, { page }) => {
  await resetTenants([TENANT_A]);
  const fallo = strict('fallo', FAILURE_CELLS, cell(row, 'fallo'));
  const detalle = strict('detalle', DETAIL_CELLS, cell(row, 'detalle'));
  const expected = `aviso «No se pudo generar el informe» con ${cell(row, 'detalle')}, y no se descarga ningún archivo`;
  const signed = await signIn(page, 1440);
  if (signed !== undefined) return preparationFailedWeb(expected, signed);
  const opened = await openPath(page, '/verification/TC-002', 'detail');
  if (opened !== undefined) return preparationFailedWeb(expected, opened);
  await failNextReport(page, fallo);
  const downloads = watchDownloads(page);
  await armToasts(page);
  const pressed = await clickIn(detailReportButton, 'pulsar «Descargar informe PDF» en el detalle')(page);
  if (pressed !== undefined) return actionFailed(expected, pressed);
  const toast = await toastShown(page, 'No se pudo generar el informe');
  await quietWindow();
  const body = toast.entry?.body;
  const detailCheck = detalle.kind === 'trace' ? traceCheck(body) : exactTextCheck(body, detalle.text);
  return done(
    [check(toast.entry !== undefined, 'aviso «No se pudo generar el informe»', toast.observed), detailCheck, quietCheck(downloads.count(), 'ningún archivo descargado')],
    {
      reading: detalle.kind === 'trace' ? TRACE_READING : undefined,
      cause: detalle.kind === 'text' && body !== undefined && body.includes('network error') ? NETWORK_CAUSE : undefined,
    },
  );
};

defineBrowserRows({
  story: 'US-VER-INFORME-005',
  surface: 'web',
  tenants: [TENANT_A],
  handlers: new Map<number, BrowserRowHandler>([
    [1, onWeb(detailDownloads)],
    [2, onWeb(detailFailure)],
  ]),
});
