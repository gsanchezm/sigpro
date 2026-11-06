import { DETALLE_TESTIDS, CSV_FILENAME } from '@sigpro/shared';

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
