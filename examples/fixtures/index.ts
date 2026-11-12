import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { ProgramsPage } from '../pages/ProgramsPage';
import { createApi, loginByApi, type Api } from '../support/api';
import { authFile, type RoleName } from '../support/env';
import { isResponsiveWidth } from '../support/responsive';

// Fixtures del curso (sesión 3). Se importa `test` y `expect` de AQUÍ, no de '@playwright/test':
//
//   import { test, expect } from '../fixtures';
//
// 1) `role` + `storageState`: elige con quién se ejecuta un archivo o un bloque, y `page` ya llega autenticada.
//        test.use({ role: 'auditor' });                       // todo el archivo como auditor
//        test.describe('gestor', () => { test.use({ role: 'program_manager' }); … });
//    Por defecto, `admin`. `test.use({ role: 'anonymous' })` abre el navegador SIN sesión (pantallas de acceso).
// 2) `pageAs(role)` y `adminPage`, `managerPage`, `consultantPage`, `auditorPage`: abren OTRO contexto con la sesión de
//    ese rol, para comparar permisos dentro de un mismo test (dos usuarios a la vez).
// 3) `apiAs(role)`: cliente de la API con el token de ese rol, para preparar o comprobar datos sin pasar por la UI.
// 4) `programsPage`: el Page Object de Programas, ya construido sobre `page`.
// 5) `isResponsive` (sesión 13): `true` si el viewport del test es < 1024 px (diseño responsive). Se calcula al empezar el test;
//    si cambias el tamaño dentro del test, usa `isResponsiveNow(page)` de support/responsive.ts.

/** Un rol del seed o `anonymous` (sin sesión iniciada). */
export type TestRole = RoleName | 'anonymous';

interface RoleFixtures {
  /** Rol con el que corre el test (opción: se cambia con `test.use({ role })`). */
  role: TestRole;
  pageAs: (role: RoleName) => Promise<Page>;
  adminPage: Page;
  managerPage: Page;
  consultantPage: Page;
  auditorPage: Page;
  apiAs: (role: RoleName) => Promise<Api>;
  programsPage: ProgramsPage;
  /** El test corre en el diseño responsive (< 1024 px): decide qué id de prueba y qué flujo usar (`tid`). */
  isResponsive: boolean;
}

export const test = base.extend<RoleFixtures>({
  role: ['admin', { option: true }],

  // `page` hereda la sesión del rol: es la sobrescritura de la opción `storageState` de Playwright
  storageState: async ({ role }, use) => {
    await use(role === 'anonymous' ? undefined : authFile(role));
  },

  pageAs: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (role) => {
      // `browser.newContext()` aplica las opciones del proyecto (baseURL, idioma, viewport…)
      const context = await browser.newContext({ storageState: authFile(role) });
      contexts.push(context);
      return context.newPage();
    });
    await Promise.all(contexts.map((context) => context.close()));
  },

  adminPage: async ({ pageAs }, use) => use(await pageAs('admin')),
  managerPage: async ({ pageAs }, use) => use(await pageAs('program_manager')),
  consultantPage: async ({ pageAs }, use) => use(await pageAs('consultant')),
  auditorPage: async ({ pageAs }, use) => use(await pageAs('auditor')),

  apiAs: async ({ request }, use) => {
    await use(async (role) => createApi(request, (await loginByApi(request, role)).accessToken));
  },

  programsPage: async ({ page }, use) => use(new ProgramsPage(page)),

  // `viewport` es una opción de Playwright: sale del proyecto o de `test.use({ viewport })`
  isResponsive: async ({ viewport }, use) => use(isResponsiveWidth(viewport?.width ?? 1280)),
});

export { expect };
