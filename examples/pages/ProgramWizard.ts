import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page Object del asistente «Nuevo programa» (modal de 3 pasos sobre `/programs`).
 *
 * Todos los locators salen de `dialog`: así un `getByLabel('Nombre')` no choca con campos de otras partes de la página.
 * Los errores de cada campo llevan `data-testid` porque el mensaje va en un `<p>` sin rol propio (respaldo, como en el curso).
 */
export class ProgramWizard {
  readonly dialog: Locator;
  readonly name: Locator;
  readonly description: Locator;
  readonly owner: Locator;
  readonly initialStatus: Locator;
  readonly startDate: Locator;
  readonly endDate: Locator;
  readonly budget: Locator;
  readonly next: Locator;
  readonly back: Locator;
  readonly submit: Locator;
  readonly nameError: Locator;
  readonly ownerError: Locator;
  readonly startError: Locator;
  readonly endError: Locator;
  readonly budgetError: Locator;
  readonly serverError: Locator;
  readonly summary: Locator;

  constructor(private readonly page: Page) {
    this.dialog = page.getByRole('dialog', { name: 'Nuevo programa' });
    // La etiqueta visible es «Nombre *»: el asterisco es decorativo y el nombre accesible del campo es «Nombre»
    this.name = this.dialog.getByRole('textbox', { name: 'Nombre', exact: true });
    this.description = this.dialog.getByLabel('Descripción');
    this.owner = this.dialog.getByRole('combobox', { name: /Responsable/ });
    this.initialStatus = this.dialog.getByLabel('Estado inicial');
    this.startDate = this.dialog.getByLabel('Fecha de inicio');
    this.endDate = this.dialog.getByLabel('Fecha de fin');
    this.budget = this.dialog.getByLabel(/Presupuesto/);
    this.next = this.dialog.getByRole('button', { name: 'Siguiente' });
    this.back = this.dialog.getByRole('button', { name: 'Atrás' });
    this.submit = this.dialog.getByRole('button', { name: 'Crear programa' });
    this.nameError = page.getByTestId('programs-wizard-name-error');
    this.ownerError = page.getByTestId('programs-wizard-owner-error');
    this.startError = page.getByTestId('programs-wizard-start-error');
    this.endError = page.getByTestId('programs-wizard-end-error');
    this.budgetError = page.getByTestId('programs-wizard-budget-error');
    this.serverError = page.getByTestId('programs-wizard-server-error');
    this.summary = page.getByTestId('programs-wizard-summary');
  }

  /** Abre el asistente con el botón de la cabecera de Programas y espera a que esté visible. */
  async open(): Promise<void> {
    await this.page.getByRole('button', { name: /Nuevo programa/ }).click();
    await expect(this.dialog).toBeVisible();
  }

  /** Indicador de paso («Paso 1 de 3»): el paso activo lleva `aria-current="step"`. */
  step(n: 1 | 2 | 3): Locator {
    return this.page.getByTestId(`programs-wizard-step-${n}`);
  }

  /** Elige un responsable del combobox ARIA 1.2: se escribe para filtrar y se pulsa la opción. */
  async pickOwner(fullName: string): Promise<void> {
    await this.owner.fill(fullName.split(' ')[0] ?? fullName);
    await this.page.getByRole('option', { name: fullName }).click();
    await expect(this.owner).toHaveValue(fullName);
  }

  /** Paso 1 completo y válido: nombre, descripción, responsable y estado inicial. */
  async fillStepOne(name: string, owner: string, status: 'draft' | 'active'): Promise<void> {
    await this.name.fill(name);
    await this.description.fill('Creado desde el asistente en la sesión 4.');
    await this.pickOwner(owner);
    await this.initialStatus.selectOption(status);
    await this.next.click();
    await expect(this.step(2)).toHaveAttribute('aria-current', 'step');
  }

  /** Cierra el asistente con Esc (no crea nada). */
  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.dialog).toBeHidden();
  }
}
