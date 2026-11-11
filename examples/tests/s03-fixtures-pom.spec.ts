import { ProgramsPage } from '../pages/ProgramsPage';
import { test, expect } from '../fixtures';
import { TENANT } from '../support/env';

// SESIÓN 3 · Fixtures, `storageState` y Page Object Model
// Ejercicio tipo: un fixture por rol y un POM de la lista de programas.
//
// Aquí no hay login: `fixtures/index.ts` entrega `page` ya autenticada con la sesión que guardó el proyecto `setup`.
// Estos tests son de solo lectura (no modifican datos), así que pueden correr en paralelo con cualquier otro spec.

test.describe('storageState: la sesión llega hecha', () => {
  test('`page` entra directamente en Programas sin pasar por /login', async ({ page, programsPage }) => {
    await programsPage.goto();
    await expect(page).toHaveURL(/\/programs$/);
    // El menú de usuario confirma quién es: el rol por defecto del fixture es `admin`
    await expect(page.getByRole('button', { name: 'Menú de usuario' })).toBeVisible();
  });

  test('el estado guardado incluye el tenant y no vuelve a salir el aviso de cookies', async ({ page, programsPage }) => {
    await programsPage.goto();
    await expect(page.getByTestId('cookie-banner')).toHaveCount(0);
    const tenant = await page.evaluate(() => localStorage.getItem('sigpro.tenant'));
    expect(tenant).toBe(TENANT);
  });
});

test.describe('Page Object de Programas', () => {
  test('la lista abre con 10 filas por página y los primeros códigos del seed', async ({ programsPage }) => {
    await programsPage.goto();
    await expect(programsPage.rowLinks).toHaveCount(10);
    // Los códigos del seed son fijos (PRG-001…): por eso un ejercicio puede decir «abre PRG-004» y funciona para todos
    expect((await programsPage.codes()).slice(0, 3)).toEqual(['PRG-001', 'PRG-002', 'PRG-003']);
    await expect(programsPage.count).toContainText('1–10 de');
  });

  test('filterByStatus + row: las filas «En pausa» del seed', async ({ programsPage }) => {
    await programsPage.goto();
    await programsPage.filterByStatus('on_hold');
    await expect(programsPage.row('PRG-004')).toBeVisible();
    await expect(programsPage.row('PRG-004').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'on_hold');
    await expect(programsPage.row('PRG-001')).toHaveCount(0); // PRG-001 está activo
  });

  test('searchFor y el estado vacío', async ({ programsPage }) => {
    await programsPage.goto();
    await programsPage.searchFor('zzzz-no-existe');
    await expect(programsPage.empty).toContainText('Ningún programa coincide con los filtros aplicados.');
  });

  test('openRowMenu: encadena fila → menú ⋯ → opciones', async ({ programsPage }) => {
    await programsPage.goto();
    const menu = await programsPage.openRowMenu('PRG-004');
    await expect(menu.getByRole('menuitem')).toHaveText(['Ver detalle', 'Editar', 'Duplicar', 'Archivar', 'Eliminar']);
  });
});

test.describe('fixtures por rol', () => {
  test('dos usuarios a la vez: el admin puede crear programas y el consultor no', async ({ adminPage, consultantPage }) => {
    const admin = new ProgramsPage(adminPage);
    const consultant = new ProgramsPage(consultantPage);
    await Promise.all([admin.goto(), consultant.goto()]);

    await expect(admin.newProgram).toBeEnabled();
    await expect(consultant.newProgram).toBeDisabled();
    // El motivo está en el atributo `title` del botón deshabilitado: getByTitle lo localiza
    await expect(consultantPage.getByTitle('Tu rol no permite crear programas')).toBeVisible();
  });

  test('matriz de permisos: quién puede pulsar «Nuevo programa»', async ({ pageAs }) => {
    const expected = { admin: true, program_manager: true, consultant: false, auditor: false } as const;
    for (const [role, allowed] of Object.entries(expected) as [keyof typeof expected, boolean][]) {
      const programs = new ProgramsPage(await pageAs(role));
      await programs.goto();
      if (allowed) await expect(programs.newProgram, `rol ${role}`).toBeEnabled();
      else await expect(programs.newProgram, `rol ${role}`).toBeDisabled();
    }
  });

  test.describe('bloque como auditor', () => {
    // `test.use` aplica la opción al bloque entero: `page` y `programsPage` ya son del auditor
    test.use({ role: 'auditor' });

    test('el auditor ve la lista pero no puede crear', async ({ programsPage }) => {
      await programsPage.goto();
      await expect(programsPage.rowLinks).toHaveCount(10);
      await expect(programsPage.newProgram).toBeDisabled();
    });
  });
});
