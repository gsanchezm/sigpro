import { DETALLE_TESTIDS, CSV_FILENAME, VERIFICACION_TESTIDS } from '@sigpro/shared';

/** Descarga un CSV con un <a download> temporal (`programs-csv-download`) → `page.waitForEvent('download')`. */
export const downloadCsv = (csv: string, filename: string = CSV_FILENAME): void => {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.setAttribute('data-testid', DETALLE_TESTIDS.PROGRAMS_CSV_DOWNLOAD);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Descarga un archivo binario (PDF, evidencia) con un <a download> temporal (`download-anchor`) → `page.waitForEvent('download')`. */
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.setAttribute('data-testid', VERIFICACION_TESTIDS.DOWNLOAD_ANCHOR);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
