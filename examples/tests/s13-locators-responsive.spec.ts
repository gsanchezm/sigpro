import { test, expect } from '../fixtures';
import { isResponsiveNow, tid } from '../support/responsive';

// SESIÓN 13 · Locators que cambian en modo responsive
// Ejercicio tipo: automatizar UN mismo flujo que funcione en escritorio (≥ 1024 px) y en móvil o tablet (< 1024 px).
//
// El flujo: filtrar Programas por «En pausa» → abrir las acciones de PRG-004 → «Ver detalle» → pestaña «Hitos».
//
// SIGPRO tiene un solo corte de diseño (1024 px) y React monta una variante u otra de cada familia de componentes, nunca las dos:
//   - la lista de programas es una TABLA (filas) en escritorio y una LISTA DE TARJETAS (listitem) en responsive;
//   - el menú ⋯ de la fila es un `menu` con `menuitem`, y en responsive una hoja inferior (`dialog`) con botones;
//   - las pestañas del detalle son un `tablist` y en responsive un `<select>` nativo;
//   - los filtros son una barra en línea y en responsive un botón «Filtros» que abre un panel inferior.
// Los data-testid de escritorio no cambian; los de la variante responsive acaban en «-mobile» (`tid()` los calcula).
//
// El mismo flujo, resuelto de DOS formas, y cada una a los dos anchos (4 tests):
//   A · `getByRole` + nombre accesible: casi no distingue anchos. Solo dos pasos cambian de ACCIÓN (abrir el panel de filtros
//       y elegir la pestaña), y dos de ROL (`menuitem` ↔ enlace; fila ↔ tarjeta), que se resuelven con `.or()`.
//   B · `getByTestId`: necesita `tid(id, isResponsive)` en cada id que tiene pareja.
//
// Solo lectura: no crea ni modifica nada. Supone que «En pausa» = PRG-004, PRG-012 y PRG-020 (como en la sesión 5).

const WIDTHS = [
  { name: 'escritorio (1440 px)', viewport: { width: 1440, height: 900 } },
  { name: 'móvil (390 px)', viewport: { width: 390, height: 844 } },
] as const;

for (const { name, viewport } of WIDTHS) {
  test.describe(`mismo flujo en ${name}`, () => {
    test.use({ viewport });

    test('A · con getByRole: los mismos locators sirven en los dos anchos', async ({ page, isResponsive }) => {
      await page.goto('/programs');

      // 1) Filtrar. «Estado» es una etiqueta (`getByLabel`) en las dos variantes; en responsive vive dentro del panel «Filtros»
      if (isResponsive) await page.getByRole('button', { name: 'Filtros' }).click();
      await page.getByLabel('Estado').selectOption('on_hold');
      if (isResponsive) await page.getByRole('button', { name: 'Listo' }).click();

      // 2) La entrada de PRG-004: una fila (`row`) o una tarjeta (`listitem`). `.or()` acepta cualquiera de las dos
      const entry = page.getByRole('row').or(page.getByRole('listitem')).filter({ hasText: 'PRG-004' });
      await expect(entry).toHaveCount(1);

      // 3) El botón ⋯ se llama igual en las dos variantes
      await page.getByRole('button', { name: 'Acciones para PRG-004' }).click();

      // 4) «Ver detalle»: `menuitem` en el menú de escritorio, enlace en la hoja inferior. El nombre es el mismo
      await page.getByRole('menuitem', { name: 'Ver detalle' }).or(page.getByRole('link', { name: 'Ver detalle' })).click();
      await expect(page).toHaveURL(/\/programs\/PRG-004$/);

      // 5) La pestaña «Hitos»: se pulsa (tab) en escritorio y se elige en el select en responsive. Mismo texto visible
      if (isResponsive) await page.getByLabel('Detalle del programa').selectOption({ label: 'Hitos' });
      else await page.getByRole('tab', { name: 'Hitos' }).click();
      await expect(page.getByRole('table', { name: /Hitos de PRG-004/ })).toBeVisible();
    });

    test('B · con getByTestId: cada id con pareja necesita tid()', async ({ page, isResponsive }) => {
      await page.goto('/programs');

      // 1) `programs-filters` es la barra de escritorio; su pareja `programs-filters-mobile` es el botón «Filtros»
      if (isResponsive) await page.getByTestId(tid('programs-filters', isResponsive)).click();
      // Los CAMPOS de formulario no cambian de id: el mismo `programs-filter-status` en los dos anchos
      await page.getByTestId('programs-filter-status').selectOption('on_hold');
      // `programs-filters-apply-mobile` solo existe en responsive (no tiene pareja de escritorio)
      if (isResponsive) await page.getByTestId('programs-filters-apply-mobile').click();

      // 2) Fila o tarjeta: programs-row-PRG-004 ↔ programs-row-PRG-004-mobile
      await expect(page.getByTestId(tid('programs-row-PRG-004', isResponsive))).toBeVisible();

      // 3) Botón ⋯ y opción del menú, con su pareja cada uno
      await page.getByTestId(tid('programs-row-menu-PRG-004', isResponsive)).click();
      await page.getByTestId(tid('programs-row-menu-view', isResponsive)).click();
      await expect(page).toHaveURL(/\/programs\/PRG-004$/);

      // 4) Pestañas: `program-detail-tab-milestones` (escritorio) o el `<select>` `program-detail-tabs-mobile` (responsive)
      if (isResponsive) await page.getByTestId(tid('program-detail-tabs', isResponsive)).selectOption('milestones');
      else await page.getByTestId('program-detail-tab-milestones').click();
      await expect(page.getByTestId(tid('program-detail-panel-milestones', isResponsive))).toBeVisible();
    });

    test('solo existe una variante: la contraria no está en el DOM', async ({ page, isResponsive }) => {
      await page.goto('/programs');
      await expect(page.getByTestId(tid('programs-table', isResponsive))).toBeVisible();
      for (const id of ['programs-table', 'programs-row-PRG-004', 'programs-new', 'programs-filters', 'layout-sidebar-toggle']) {
        await expect(page.getByTestId(tid(id, isResponsive)).first()).toBeVisible();
        // `!isResponsive`: el id de la OTRA variante. No se oculta con CSS: no existe
        await expect(page.getByTestId(tid(id, !isResponsive))).toHaveCount(0);
      }
      // `<html data-layout>` confirma el diseño, pero NO se usa para decidir el locator (si la app se equivocara, daría la razón a la app)
      await expect(page.locator('html')).toHaveAttribute('data-layout', isResponsive ? 'mobile' : 'desktop');
    });
  });
}

test.describe('cambiar el tamaño dentro del test', () => {
  test('la fixture isResponsive se fija al empezar: tras setViewportSize usa isResponsiveNow(page)', async ({ page, isResponsive }) => {
    // El proyecto corre a 1440 px: escritorio
    expect(isResponsive).toBe(false);
    await page.goto('/programs');
    await expect(page.getByTestId(tid('programs-table', isResponsiveNow(page)))).toBeVisible();

    // React desmonta la tabla y monta la lista de tarjetas: la fixture sigue diciendo «escritorio», el ancho ya no
    await page.setViewportSize({ width: 390, height: 844 });
    expect(isResponsive).toBe(false);
    expect(isResponsiveNow(page)).toBe(true);
    await expect(page.getByTestId(tid('programs-table', isResponsiveNow(page)))).toBeVisible();
    await expect(page.getByTestId('programs-table')).toHaveCount(0);

    // Y al volver, la tabla regresa
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId(tid('programs-table', isResponsiveNow(page)))).toBeVisible();
    await expect(page.getByTestId('programs-table-mobile')).toHaveCount(0);
  });

  test('1023 px es responsive y 1024 px es escritorio', async ({ page }) => {
    await page.goto('/programs');
    for (const [width, expected] of [
      [1023, true],
      [1024, false],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      expect(isResponsiveNow(page)).toBe(expected);
      await expect(page.getByTestId(tid('programs-table', expected))).toBeVisible();
    }
  });
});
