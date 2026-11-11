import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object del Perfil (`/profile`). En la sesión 10 se usa su botón «Guardar» bajo el modo caos, cuyo texto alterna
 * entre «Guardar» y «Guardar cambios» cada 2,5 s.
 *
 * Dos locators para el mismo botón, a propósito:
 *  - `save`: resiliente, acepta los dos textos.
 *  - `saveExact`: frágil (contraejemplo). Solo acierta con «Guardar» exacto; bajo el caos parpadea.
 */
export class ProfilePage {
  readonly heading: Locator;
  readonly save: Locator;
  readonly saveExact: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Perfil' });
    this.save = page.getByRole('button', { name: /^Guardar( cambios)?$/ });
    this.saveExact = page.getByRole('button', { name: 'Guardar', exact: true });
  }

  /** Abre el perfil y espera a que el encabezado sea visible. */
  async goto(): Promise<void> {
    await this.page.goto('/profile');
    await expect(this.heading).toBeVisible();
  }
}
