import { expect, test } from '@playwright/test';
import { openAs, resetTenant } from '../../support/auth';
import { WRITE_TENANT, isResponsive } from '../../support/responsive';

// Familia 10 · Kanban de NC: cinco columnas con drag & drop (escritorio) → pestañas por estado + «Mover a…» por tarjeta (responsive).

const STATES = ['open', 'in_analysis', 'corrective_action', 'closed', 'rejected'] as const;

test.describe('Familia 10 · kanban de no conformidades', () => {
  test('solo existe la variante esperada', async ({ page }) => {
    await openAs(page, 'admin', '/nc');
    const responsive = isResponsive(page);
    await expect(page.getByTestId(responsive ? 'nc-board-mobile' : 'nc-board')).toBeVisible();
    await expect(page.getByTestId(responsive ? 'nc-board' : 'nc-board-mobile')).toHaveCount(0);
    await expect(page.getByTestId('nc-board-tabs-mobile')).toHaveCount(responsive ? 1 : 0);
    // Columnas de escritorio: cinco; responsive: ninguna con su id de escritorio y UNA (la pestaña activa) con el sufijo
    for (const state of STATES) await expect(page.getByTestId(`nc-column-${state}`)).toHaveCount(responsive ? 0 : 1);
    await expect(page.locator('[data-testid^="nc-column-"][data-testid$="-mobile"][data-state]')).toHaveCount(responsive ? 1 : 0);
  });

  test('el rol cambia: regiones por columna en escritorio, pestañas y panel en responsive', async ({ page }) => {
    await openAs(page, 'admin', '/nc');
    const responsive = isResponsive(page);
    await expect(page.getByRole('tab')).toHaveCount(responsive ? 5 : 0);
    await expect(page.getByRole('tabpanel')).toHaveCount(responsive ? 1 : 0);
    await expect(page.getByRole('region')).toHaveCount(responsive ? 0 : 5);
    if (responsive) await expect(page.getByRole('tab', { name: /Abierta/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('escritorio: todas las tarjetas están en el DOM; responsive: solo las del estado elegido', async ({ page }) => {
    await openAs(page, 'admin', '/nc');
    const responsive = isResponsive(page);
    const cards = page.locator('li[data-severity]');
    // El recuento llega con los datos: mientras carga la insignia enseña «…»
    const countOf = async (state: string) => {
      const count = page.getByTestId(responsive ? `nc-column-count-${state}-mobile` : `nc-column-count-${state}`);
      await expect(count).toHaveText(/^\d+$/);
      return Number(await count.innerText());
    };
    await expect(cards.first()).toBeVisible();
    if (!responsive) {
      let total = 0;
      for (const state of STATES) total += await countOf(state);
      await expect(cards).toHaveCount(total);
      return;
    }
    // Responsive: cada pestaña monta solo su lista y las tarjetas llevan el id con sufijo
    for (const state of STATES) {
      await page.getByTestId(`nc-tab-${state}-mobile`).click();
      await expect(page.getByTestId(`nc-column-${state}-mobile`)).toBeVisible();
      const expected = await countOf(state);
      await expect(cards).toHaveCount(expected);
      if (expected > 0) await expect(cards.first()).toHaveAttribute('data-state', state);
    }
    await expect(page.locator('li[data-testid^="nc-card-NC-"]:not([data-testid$="-mobile"])')).toHaveCount(0);
  });

  test.describe('mover una tarjeta con «Mover a…»', () => {
    test.beforeAll(async ({ request }, testInfo) => {
      await resetTenant(request, WRITE_TENANT[testInfo.project.name] ?? 'alumno22');
    });
    test.afterAll(async ({ request }, testInfo) => {
      await resetTenant(request, WRITE_TENANT[testInfo.project.name] ?? 'alumno22');
    });

    test('responsive: «Mover a…» abre una hoja con los destinos y la tarjeta pasa a la otra pestaña', async ({ page }, testInfo) => {
      test.skip(!isResponsive(page), 'En escritorio las tarjetas se mueven arrastrando (ver nc.spec.ts)');
      await openAs(page, 'admin', '/nc', { tenant: WRITE_TENANT[testInfo.project.name] });
      const countOf = async (state: string) => {
        const count = page.getByTestId(`nc-column-count-${state}-mobile`);
        await expect(count).toHaveText(/^\d+$/);
        return Number(await count.innerText());
      };
      const open = await countOf('open');
      const analysis = await countOf('in_analysis');

      const card = page.locator('[data-testid="nc-column-open-mobile"] li[data-state="open"]').first();
      const code = ((await card.getAttribute('data-testid')) ?? '').replace(/^nc-card-/, '').replace(/-mobile$/, '');
      expect(code).toMatch(/^NC-\d{3}$/);

      // El botón se localiza por rol y nombre; su id es nc-card-move-<código>-mobile
      await card.getByRole('button', { name: /Mover a…/ }).click();
      const sheet = page.getByRole('dialog', { name: `Mover ${code} a…` });
      await expect(sheet).toBeVisible();
      await expect(page.getByTestId('nc-menu-mobile')).toBeVisible();
      // En escritorio ese menú es role=menu con menuitem; aquí son botones con el mismo nombre
      await expect(page.getByRole('menu')).toHaveCount(0);
      await sheet.getByRole('button', { name: 'Mover a «En análisis»' }).click();

      await expect(page.getByTestId('toast-ok')).toBeVisible();
      await expect(page.getByTestId('nc-column-count-open-mobile')).toHaveText(String(open - 1));
      await expect(page.getByTestId('nc-column-count-in_analysis-mobile')).toHaveText(String(analysis + 1));
      await page.getByTestId('nc-tab-in_analysis-mobile').click();
      await expect(page.getByTestId(`nc-card-${code}-mobile`)).toBeVisible();
    });

    test('responsive: un rol sin permiso ve «Mover a…» deshabilitado con su motivo', async ({ page }) => {
      test.skip(!isResponsive(page), 'Solo existe en el diseño responsive');
      await openAs(page, 'auditor', '/nc');
      const move = page.locator('[data-testid="nc-column-open-mobile"] li').first().getByRole('button', { name: /Mover a…/ });
      await expect(move).toBeDisabled();
      await expect(move).toHaveAttribute('title', /rol no permite/i);
    });
  });
});
