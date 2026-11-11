import { expect, type Locator, type Page } from '@playwright/test';

export type ProgramStatus = 'draft' | 'active' | 'on_hold' | 'closed' | 'cancelled';

/**
 * Page Object de la lista de programas (`/programs`).
 *
 * Reglas del POM que se practican en el curso:
 *  - los locators son propiedades de solo lectura, creadas una vez en el constructor;
 *  - los métodos describen acciones del usuario («filterByStatus»), no clics sueltos;
 *  - las aserciones viven en los specs; aquí solo hay las esperas necesarias para que la página esté lista.
 */
export class ProgramsPage {
  readonly heading: Locator;
  readonly table: Locator;
  readonly rowLinks: Locator;
  readonly count: Locator;
  readonly search: Locator;
  readonly statusFilter: Locator;
  readonly newProgram: Locator;
  readonly nextPage: Locator;
  readonly previousPage: Locator;
  readonly empty: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Programas', level: 1 });
    this.table = page.getByTestId('programs-table'); // respaldo: la tabla no tiene nombre accesible propio
    this.rowLinks = page.getByTestId(/^programs-link-/);
    this.count = page.getByTestId('programs-count');
    this.search = page.getByPlaceholder('Buscar código o nombre');
    this.statusFilter = page.getByLabel('Estado');
    this.newProgram = page.getByRole('button', { name: /Nuevo programa/ });
    this.nextPage = page.getByRole('button', { name: 'Página siguiente' });
    this.previousPage = page.getByRole('button', { name: 'Página anterior' });
    this.empty = page.getByTestId('programs-empty');
  }

  /** Abre la lista (con filtros opcionales en la URL) y espera a que termine de cargar. */
  async goto(query = ''): Promise<void> {
    await this.page.goto(`/programs${query}`);
    await this.waitUntilLoaded();
  }

  async waitUntilLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.table).toHaveAttribute('aria-busy', 'false');
  }

  /** Fila de un programa por su código. */
  row(code: string): Locator {
    return this.page.getByTestId(`programs-row-${code}`);
  }

  /** Códigos de las filas visibles, en orden. */
  async codes(): Promise<string[]> {
    return this.rowLinks.allTextContents();
  }

  async filterByStatus(status: ProgramStatus | ''): Promise<void> {
    await this.statusFilter.selectOption(status);
  }

  async searchFor(text: string): Promise<void> {
    await this.search.fill(text);
  }

  /** Cabecera ordenable: pulsa el botón con el nombre de la columna. */
  async sortBy(column: 'Nombre' | 'Presupuesto'): Promise<void> {
    await this.page.getByRole('button', { name: new RegExp(`^${column}`) }).click();
  }

  /** Abre el menú ⋯ de una fila (`aria-label="Acciones para PRG-004"`). */
  async openRowMenu(code: string): Promise<Locator> {
    await this.page.getByRole('button', { name: `Acciones para ${code}` }).click();
    return this.page.getByRole('menu');
  }

  async openWizard(): Promise<Locator> {
    await this.newProgram.click();
    const wizard = this.page.getByRole('dialog', { name: 'Nuevo programa' });
    await expect(wizard).toBeVisible();
    return wizard;
  }
}
