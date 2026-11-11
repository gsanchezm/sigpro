import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object del tablero de no conformidades (`/nc`), para la sesión 11 (emulación móvil y captura del kanban).
 * Es de solo lectura: los métodos abren menús o miran tarjetas, pero no mueven ninguna NC.
 */
export class NcBoardPage {
  readonly heading: Locator;
  readonly board: Locator;
  readonly count: Locator;
  readonly commentBadges: Locator;
  readonly navBadge: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'No conformidades' });
    this.board = page.getByTestId('nc-board'); // respaldo: el tablero se nombra con un texto traducible
    this.count = page.getByTestId('nc-count');
    this.commentBadges = page.getByTestId(/^nc-card-comments-/);
    this.navBadge = page.getByTestId('nav-badge-nc');
  }

  /** Abre el tablero y espera a que termine de cargar (`aria-busy="false"`). */
  async goto(path = '/nc'): Promise<void> {
    await this.page.goto(path);
    await expect(this.board).toHaveAttribute('aria-busy', 'false');
  }

  /** Columna del tablero por su estado (`open`, `in_analysis`, `corrective_action`, `closed`, `rejected`). */
  column(state: string): Locator {
    return this.page.getByTestId(`nc-column-${state}`);
  }

  /** Tarjeta de una NC. Su `data-state` indica en qué columna está. */
  card(code: string): Locator {
    return this.page.getByTestId(`nc-card-${code}`);
  }

  /** Códigos de las tarjetas de una columna, en el orden en que aparecen. */
  async codesIn(state: string): Promise<string[]> {
    return this.column(state)
      .getByTestId(/^nc-card-NC-\d+$/)
      .evaluateAll((cards) => cards.map((card) => (card.getAttribute('data-testid') ?? '').replace('nc-card-', '')));
  }

  /** Abre el menú ⋯ de una tarjeta («Acciones para NC-001») y devuelve el menú. No elige ninguna acción. */
  async openMenu(code: string): Promise<Locator> {
    await this.page.getByRole('button', { name: `Acciones para ${code}` }).click();
    return this.page.getByRole('menu', { name: `Acciones para ${code}` });
  }
}
