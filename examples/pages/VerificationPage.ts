import { expect, type Locator, type Page } from '@playwright/test';

/** Resultados de una ejecución, con la etiqueta que pinta la pantalla (radio «Superado», «Fallido» o «Bloqueado»). */
export type RunResult = 'Superado' | 'Fallido' | 'Bloqueado';

/**
 * Page Object de Verificación: la lista de casos (`/verification`) y el formulario de ejecución de un caso (`/verification/:code`).
 *
 * Los locators siguen el orden del curso: rol y etiqueta primero, `data-testid` solo como respaldo.
 * Las aserciones viven en los specs; aquí solo hay las esperas necesarias para que la página esté lista.
 */
export class VerificationPage {
  readonly heading: Locator;
  readonly rows: Locator;
  readonly count: Locator;
  readonly search: Locator;
  readonly programFilter: Locator;
  readonly reportButton: Locator;
  readonly runForm: Locator;
  readonly notes: Locator;
  /** Entrada de un solo archivo (`setInputFiles` va directo al `<input>`, aunque esté oculto por estilos). */
  readonly attachOne: Locator;
  /** Entrada múltiple: acepta varios archivos a la vez. */
  readonly attachMany: Locator;
  readonly dropzone: Locator;
  /** Archivos elegidos para la ejecución en curso (cada uno, un `listitem`). */
  readonly fileItems: Locator;
  readonly fileErrors: Locator;
  readonly noFiles: Locator;
  readonly submitRun: Locator;
  /** Historial de ejecuciones del caso que está abierto. */
  readonly runHistory: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Verificación' });
    this.rows = page.getByTestId(/^testcase-row-TC-\d+$/); // `\d+`: no coincide con testcase-row-menu-TC-001 (el botón ⋯)
    this.count = page.getByTestId('verification-count');
    this.search = page.getByRole('searchbox', { name: 'Buscar casos de prueba' });
    this.programFilter = page.getByLabel('Programa');
    this.reportButton = page.getByRole('button', { name: 'Descargar informe PDF' });
    this.runForm = page.getByTestId('run-form');
    this.notes = page.getByLabel('Notas');
    this.attachOne = page.getByLabel('Adjuntar un archivo');
    this.attachMany = page.getByLabel('Adjuntar varios archivos');
    this.dropzone = page.getByTestId('run-dropzone');
    this.fileItems = page.getByTestId('run-files').getByRole('listitem');
    this.fileErrors = page.getByTestId('run-files-error');
    this.noFiles = page.getByText('Ningún archivo seleccionado');
    this.submitRun = this.runForm.getByRole('button', { name: 'Registrar ejecución' });
    this.runHistory = page.getByTestId('testcase-runs');
  }

  /** La lista de casos, sin filtros salvo los que pases en la query (`?q=...`). */
  async goto(query = ''): Promise<void> {
    await this.page.goto(`/verification${query}`);
    await expect(this.heading).toBeVisible();
  }

  /** La ficha de un caso con su formulario de ejecución. */
  async gotoCase(code: string): Promise<void> {
    await this.page.goto(`/verification/${code}`);
    await expect(this.runForm).toBeVisible();
  }

  /** Radio del resultado de la ejecución. */
  result(label: RunResult): Locator {
    return this.page.getByRole('radio', { name: label });
  }

  /** Fila del historial que contiene una nota. Con una nota única, localiza SU ejecución sin depender del orden. */
  runWithNote(marker: string): Locator {
    return this.runHistory.getByRole('row').filter({ hasText: marker });
  }

  /** Fila de un caso en la lista. */
  row(code: string): Locator {
    return this.page.getByTestId(`testcase-row-${code}`);
  }
}
