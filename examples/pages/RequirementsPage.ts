import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object del árbol de requisitos de un programa (`/programs/:code/requirements`): filas, buscador, asas de
 * arrastre, menú contextual y panel de detalle. Mismas reglas que `ProgramsPage`: locators de solo lectura creados
 * en el constructor, métodos que describen acciones del usuario y las aserciones en los specs.
 */
export class RequirementsPage {
  /** El árbol es un `role="tree"` con nombre accesible propio. */
  readonly tree: Locator;
  /** Panel lateral con el detalle del requisito abierto (`role="complementary"`). */
  readonly detail: Locator;
  /** Filtro del árbol (conserva a los ancestros de cada coincidencia). */
  readonly search: Locator;
  readonly count: Locator;

  constructor(readonly page: Page) {
    this.tree = page.getByRole('tree', { name: 'Árbol de requisitos' });
    this.detail = page.getByRole('complementary', { name: 'Detalle del requisito' });
    this.search = page.getByRole('searchbox', { name: 'Buscar requisitos' });
    this.count = page.getByTestId('requirements-count');
  }

  /** Abre el árbol de un programa y espera a que tenga filas (llegan por API). */
  async goto(programCode = 'PRG-002'): Promise<void> {
    await this.page.goto(`/programs/${programCode}/requirements`);
    await expect(this.tree.getByRole('treeitem').first()).toBeVisible();
  }

  /**
   * Fila de un requisito. Su nombre accesible es «REQ-017 título»: el espacio final de la expresión hace que
   * `REQ-01` no coincida con `REQ-017`.
   */
  row(code: string): Locator {
    return this.tree.getByRole('treeitem', { name: new RegExp(`^${code} `) });
  }

  /** Fila por código y título (nombre accesible exacto): útil cuando el título es único, como en los datos creados por API. */
  item(code: string, title: string): Locator {
    return this.tree.getByRole('treeitem', { name: `${code} ${title}`, exact: true });
  }

  /** Asa de arrastre de la fila: un `role="img"` con nombre (no un botón), que es lo que se arrastra. */
  handle(code: string): Locator {
    return this.page.getByRole('img', { name: `Arrastrar ${code} para reordenar` });
  }

  /** Badge de estado del requisito abierto en el panel (lleva `data-state`). */
  stateBadge(): Locator {
    return this.detail.getByTestId('requirement-state-badge');
  }

  /** Abre el detalle con un clic en la fila y espera a que muestre su código. */
  async open(code: string): Promise<void> {
    await this.row(code).click();
    await expect(this.detail.getByTestId('requirement-code')).toHaveText(code);
  }

  /** Menú contextual (clic derecho sobre la fila). Devuelve el menú para encadenar `getByRole('menuitem')`. */
  async openContextMenu(code: string): Promise<Locator> {
    await this.row(code).click({ button: 'right' });
    const menu = this.page.getByRole('menu', { name: `Acciones para ${code}` });
    await expect(menu).toBeVisible();
    return menu;
  }

  /**
   * Orden entre hermanos tal como lo lee un lector de pantallas: `aria-posinset` (1 = primero) y `aria-setsize`.
   * Cada aserción reintenta sola hasta que la vista optimista o la recarga se hayan asentado.
   */
  async expectSiblingOrder(codes: readonly string[]): Promise<void> {
    for (const [index, code] of codes.entries()) {
      await expect(this.row(code), `posición de ${code}`).toHaveAttribute('aria-posinset', String(index + 1));
      await expect(this.row(code), `tamaño del grupo de ${code}`).toHaveAttribute('aria-setsize', String(codes.length));
    }
  }
}
