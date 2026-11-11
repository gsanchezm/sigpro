import { expect, test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ROLES, ROLE_NAMES, authFile } from '../support/env';

// Proyecto `setup`: inicia sesión UNA VEZ por rol a través de la pantalla de acceso y guarda el estado del navegador
// (`localStorage` con la sesión y el tenant) en `.auth/<tenant>-<rol>.json`. El resto de specs arrancan ya autenticados
// con `storageState` (ver fixtures/index.ts), sin repetir el login ni pagar su pantalla de redirección.
//
// No reinicia datos: los reinicios van aparte (`npm run reset`) para que dos ejecuciones en paralelo (shards) no se pisen.

for (const role of ROLE_NAMES) {
  setup(`autenticar como ${role}`, async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(ROLES[role]);
    await expect(page).toHaveURL(/\/programs$/);

    // El aviso de cookies aparece en la primera visita; aceptarlo aquí evita que tape controles en todos los specs
    const cookies = page.getByRole('button', { name: 'Aceptar', exact: true });
    if (await cookies.isVisible()) await cookies.click();

    await page.context().storageState({ path: authFile(role) });
  });
}
