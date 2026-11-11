import { expect, type FrameLocator, type Locator, type Page } from '@playwright/test';

/**
 * Page Object de Documentos: la lista (`/documents`) y la ficha de un documento (`/documents/:id`).
 *
 * La ficha incluye el visor en `<iframe title="Visor de documento">`: `viewerIframe` es el propio iframe (sus atributos)
 * y `viewerFrame` es su contenido, para localizar dentro con `frameLocator`.
 */
export class DocumentsPage {
  readonly table: Locator;
  readonly rows: Locator;
  readonly search: Locator;
  readonly programFilter: Locator;
  readonly classFilter: Locator;
  /** Aviso de error de la lista (`role="alert"`), con su traza HTTP. */
  readonly errorAlert: Locator;
  readonly errorRetry: Locator;
  readonly versionSelect: Locator;
  /** Enlace real con `target="_blank"` (no un `window.open` por JS). */
  readonly openInNewTab: Locator;
  readonly downloadPdf: Locator;
  readonly viewerIframe: Locator;
  readonly viewerFrame: FrameLocator;

  constructor(readonly page: Page) {
    this.table = page.getByTestId('documents-table');
    this.rows = page.getByTestId(/^document-row-DOC-\d+$/);
    this.search = page.getByRole('searchbox', { name: 'Buscar documentos' });
    this.programFilter = page.getByLabel('Programa');
    this.classFilter = page.getByLabel('Clasificación');
    this.errorAlert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los documentos' });
    this.errorRetry = page.getByTestId('documents-error-retry');
    this.versionSelect = page.getByLabel('Versión');
    this.openInNewTab = page.getByRole('link', { name: 'Abrir en nueva pestaña' });
    this.downloadPdf = page.getByRole('button', { name: 'Descargar PDF' });
    this.viewerIframe = page.locator('iframe[title="Visor de documento"]');
    this.viewerFrame = page.frameLocator('iframe[title="Visor de documento"]');
  }

  /** La lista. Navega y espera a que la tabla termine de cargar. */
  async goto(): Promise<void> {
    await this.page.goto('/documents');
    await this.waitUntilLoaded();
  }

  /** Espera a que la tabla deje de estar ocupada (`aria-busy="false"`). */
  async waitUntilLoaded(): Promise<void> {
    await expect(this.table).toHaveAttribute('aria-busy', 'false');
  }

  /** La ficha de un documento, con su título visible. */
  async openDetail(id: string): Promise<void> {
    await this.page.goto(`/documents/${id}`);
    await expect(this.page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  /** Fila de un documento por su código. */
  row(id: string): Locator {
    return this.page.getByTestId(`document-row-${id}`);
  }
}
