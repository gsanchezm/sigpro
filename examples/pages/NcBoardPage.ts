import { expect, type Locator, type Page } from '@playwright/test';
import { tid } from '../support/responsive';

/**
 * Page Object del tablero de no conformidades (`/nc`), para la sesión 11 (emulación móvil y captura del kanban).
 * Es de solo lectura: los métodos abren menús o miran tarjetas, pero no mueven ninguna NC.
 *
 * Tiene dos variantes (sesión 13): con `responsive = false` (≥ 1024 px) son las cinco columnas con arrastrar y soltar; con
 * `responsive = true` (< 1024 px, como un iPhone 14) son pestañas por estado y un botón «Mover a…» en cada tarjeta, y sus ids
 * acaban en `-mobile`. El resto del Page Object habla de «tablero», «columna», «tarjeta» y «menú» sin importar cuál sea.
 */
export class NcBoardPage {
  readonly heading: Locator;
  readonly board: Locator;
  readonly count: Locator;
  readonly commentBadges: Locator;
  readonly navBadge: Locator;

  constructor(
    readonly page: Page,
    readonly responsive = false,
  ) {
    this.heading = page.getByRole('heading', { level: 1, name: 'No conformidades' });
    this.board = page.getByTestId(tid('nc-board', responsive)); // respaldo: el tablero se nombra con un texto traducible
    this.count = page.getByTestId('nc-count');
    this.commentBadges = page.getByTestId(/^nc-card-comments-/);
    this.navBadge = page.getByTestId('nav-badge-nc');
  }

  /** Abre el tablero y espera a que termine de cargar (`aria-busy="false"`). */
  async goto(path = '/nc'): Promise<void> {
    await this.page.goto(path);
    await expect(this.board).toHaveAttribute('aria-busy', 'false');
  }

  /**
   * Columna del tablero por su estado (`open`, `in_analysis`, `corrective_action`, `closed`, `rejected`). En responsive es el panel
   * de la pestaña: solo existe el del estado elegido (`tab(state)` lo cambia).
   */
  column(state: string): Locator {
    return this.page.getByTestId(tid(`nc-column-${state}`, this.responsive));
  }

  /** Solo responsive: la pestaña de un estado (`nc-tab-<estado>-mobile`). */
  tab(state: string): Locator {
    return this.page.getByTestId(`nc-tab-${state}-mobile`);
  }

  /** Tarjeta de una NC. Su `data-state` indica en qué columna está. */
  card(code: string): Locator {
    return this.page.getByTestId(tid(`nc-card-${code}`, this.responsive));
  }

  /** Códigos de las tarjetas de una columna, en el orden en que aparecen. */
  async codesIn(state: string): Promise<string[]> {
    const pattern = this.responsive ? /^nc-card-NC-\d+-mobile$/ : /^nc-card-NC-\d+$/;
    return this.column(state)
      .getByTestId(pattern)
      .evaluateAll((cards) => cards.map((card) => (card.getAttribute('data-testid') ?? '').replace('nc-card-', '').replace(/-mobile$/, '')));
  }

  /**
   * Abre el menú de una tarjeta y lo devuelve; no elige ninguna acción. En escritorio es el botón ⋯ («Acciones para NC-001») y un
   * `menu`; en responsive es «Mover a… (NC-001)» y una hoja inferior (`dialog`) con botones.
   */
  async openMenu(code: string): Promise<Locator> {
    if (this.responsive) {
      await this.page.getByRole('button', { name: `Mover a… (${code})` }).click();
      return this.page.getByRole('dialog', { name: `Mover ${code} a…` });
    }
    await this.page.getByRole('button', { name: `Acciones para ${code}` }).click();
    return this.page.getByRole('menu', { name: `Acciones para ${code}` });
  }
}
