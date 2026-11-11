import { expect, type Locator, type Page } from '@playwright/test';
import { TENANT, type Credentials } from '../support/env';

/** Page Object de la pantalla de acceso (`/login`). Locators por rol y por etiqueta; sin `data-testid` salvo donde no hay alternativa. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly remember: Locator;
  readonly submit: Locator;
  readonly mfaCode: Locator;
  readonly mfaSubmit: Locator;
  /** Mensaje de error (`role="alert"`) con la traza HTTP. */
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel('Correo electrónico');
    // «Contraseña» convive con «Mostrar contraseña» (aria-label del botón de icono): `exact` evita la ambigüedad
    this.password = page.getByLabel('Contraseña', { exact: true });
    this.remember = page.getByLabel('Mantener la sesión en este equipo');
    this.submit = page.getByRole('button', { name: 'Entrar' });
    this.mfaCode = page.getByLabel('Código de verificación');
    this.mfaSubmit = page.getByTestId('mfa-submit');
    this.error = page.getByRole('alert');
  }

  /** `?tenant=` fija el tenant de la sesión (la web lo guarda en `localStorage`, y por tanto en el `storageState`). */
  async goto(tenant: string = TENANT): Promise<void> {
    await this.page.goto(`/login?tenant=${tenant}`);
    await expect(this.page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  }

  async fill(credentials: Pick<Credentials, 'email' | 'password'>): Promise<void> {
    await this.email.fill(credentials.email);
    await this.password.fill(credentials.password);
  }

  /** Rellena y envía. «Mantener la sesión» guarda el token en `localStorage`; sin él, `storageState` no lo vería. */
  async signIn(credentials: Credentials, options: { remember?: boolean } = {}): Promise<void> {
    await this.fill(credentials);
    if (options.remember ?? true) await this.remember.check();
    await this.submit.click();
    if (credentials.mfa) {
      await this.mfaCode.fill(credentials.mfa);
      await this.mfaSubmit.click();
    }
  }
}
