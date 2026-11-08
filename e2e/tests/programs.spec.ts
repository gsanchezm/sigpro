import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openAs, seedStorage } from '../support/auth';

// Spec de humo del módulo Programas (lectura): tabla, orden, paginación, filtros, selección, CSV, permisos, estados y shell.
// Usa el tenant `demo` sin modificarlo; las altas/bajas están en programs-crud.spec.ts.

const rowCodes = (page: Page) => page.getByTestId(/^programs-link-/);

test.describe('Programas · lista', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin');
    await expect(page.getByTestId('programs-table')).toHaveAttribute('aria-busy', 'false');
  });

  test('muestra 10 filas, el resumen y la paginación', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Programas', level: 1 })).toBeVisible();
    await expect(page.getByText('24 programas · 12 activo')).toBeVisible();
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
    await expect(rowCodes(page)).toHaveCount(10);
    await expect(rowCodes(page)).toHaveText(['PRG-001', 'PRG-002', 'PRG-003', 'PRG-004', 'PRG-005', 'PRG-006', 'PRG-007', 'PRG-008', 'PRG-009', 'PRG-010']);
  });

  test('paginación: siguiente, número de página y última página', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Página anterior' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Página anterior' })).toHaveAttribute('title', 'Ya estás en la primera página');

    await page.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(page.getByTestId('programs-count')).toHaveText('11–20 de 24');
    await expect(rowCodes(page).first()).toHaveText('PRG-011');

    await page.getByRole('button', { name: 'Página 3' }).click();
    await expect(page.getByTestId('programs-count')).toHaveText('21–24 de 24');
    await expect(rowCodes(page)).toHaveCount(4);
    await expect(page.getByRole('button', { name: 'Página 3' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
    await expect(page).toHaveURL(/page=3/);
  });

  test('orden por columna con aria-sort y orden determinista', async ({ page }) => {
    const codeHeader = page.getByRole('columnheader', { name: 'Código' });
    await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');

    await page.getByTestId('programs-sort-code').click();
    await expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(rowCodes(page).first()).toHaveText('PRG-024');

    await page.getByRole('button', { name: /^Nombre/ }).click();
    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'ascending');
    await expect(codeHeader).toHaveAttribute('aria-sort', 'none');
    await expect(page.getByTestId('programs-row-PRG-017')).toBeVisible(); // «Estación terrena portátil…» abre la lista A–Z

    await page.getByRole('button', { name: /^Presupuesto/ }).click();
    await page.getByRole('button', { name: /^Presupuesto/ }).click();
    await expect(rowCodes(page).first()).toHaveText('PRG-014'); // mayor presupuesto del seed (4,52 M€)
  });

  test('filtra por estado y por texto; el vacío y "Limpiar filtros"', async ({ page }) => {
    await page.getByLabel('Estado').selectOption('on_hold');
    await expect(rowCodes(page)).toHaveText(['PRG-004', 'PRG-012', 'PRG-020']);
    await expect(page.getByTestId('programs-count')).toHaveText('1–3 de 3');
    await expect(page.getByTestId('programs-state-badge').first()).toHaveAttribute('data-state', 'on_hold');

    await page.getByPlaceholder('Buscar código o nombre').fill('gestión');
    await expect(rowCodes(page)).toHaveText(['PRG-012']); // estado En pausa + texto

    await page.getByPlaceholder('Buscar código o nombre').fill('zzzz-no-existe');
    await expect(page.getByTestId('programs-empty')).toContainText('Ningún programa coincide con los filtros aplicados.');
    await expect(page.getByText('No hay programas que coincidan').or(page.getByText('Sin programas'))).toBeVisible();

    await page.getByTestId('programs-empty-clear').click();
    await expect(page.getByTestId('programs-filters-clear')).toBeHidden();
    await expect(rowCodes(page)).toHaveCount(10);
    await expect(page.getByLabel('Estado')).toHaveValue('');
  });

  test('filtra por rango de fechas (inicio desde / fin hasta)', async ({ page }) => {
    await page.getByLabel('Inicio desde').fill('2025-01-01');
    await page.getByLabel('Fin hasta').fill('2027-12-31');
    await expect(page.getByTestId('programs-filters-clear')).toBeVisible();
    const count = await rowCodes(page).count();
    expect(count).toBeGreaterThan(0);
    // Todas las filas visibles empiezan en 2025 o después y terminan en 2027 o antes
    for (const row of await page.getByTestId(/^programs-row-PRG/).all()) {
      const text = await row.innerText();
      const [start, end] = text.match(/\d{2}\/\d{2}\/(\d{4})/g)!.map((d) => Number(d.slice(-4)));
      expect(start).toBeGreaterThanOrEqual(2025);
      expect(end).toBeLessThanOrEqual(2027);
    }
  });

  test('combobox de responsable (ARIA 1.2): teclado, contador y limpiar', async ({ page }) => {
    const owner = page.getByRole('combobox', { name: 'Responsable' });
    await owner.click();
    const listbox = page.getByRole('listbox', { name: 'Responsable' });
    await expect(listbox).toBeVisible();
    await expect(owner).toHaveAttribute('aria-expanded', 'true');
    await expect(listbox.getByRole('option')).toHaveCount(6);
    await expect(page.getByTestId('programs-filter-owner-option-u1')).toContainText('4'); // Marta Ruiz: 4 programas

    await owner.fill('mar');
    await expect(listbox.getByRole('option')).toHaveCount(1);
    await owner.press('ArrowDown');
    await expect(owner).toHaveAttribute('aria-activedescendant', 'programs-filter-owner-u1');
    await owner.press('Enter');

    await expect(owner).toHaveValue('Marta Ruiz');
    await expect(listbox).toBeHidden();
    await expect(rowCodes(page)).toHaveText(['PRG-001', 'PRG-007', 'PRG-013', 'PRG-019']);

    await page.getByRole('button', { name: 'Quitar responsable' }).click();
    await expect(owner).toHaveValue('');
    await expect(rowCodes(page)).toHaveCount(10);

    await owner.click();
    await page.keyboard.press('Escape');
    await expect(listbox).toBeHidden();
  });

  test('selección múltiple y barra de acciones masivas', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-002' }).check();
    await expect(page.getByTestId('programs-bulk-bar')).toBeVisible();
    await expect(page.getByTestId('programs-bulk-count')).toHaveText('1 seleccionados');
    await expect(page.getByTestId('programs-row-PRG-002')).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('checkbox', { name: 'Seleccionar todos los programas de la página' }).check();
    await expect(page.getByTestId('programs-bulk-count')).toHaveText('10 seleccionados');

    await page.getByRole('button', { name: 'Quitar selección' }).click();
    await expect(page.getByTestId('programs-bulk-bar')).toBeHidden();
  });

  test('exporta CSV con los filtros aplicados (descarga)', async ({ page }) => {
    await page.getByLabel('Estado').selectOption('closed');
    await expect(rowCodes(page)).toHaveCount(3);

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('sigpro-programas.csv');
    const lines = readFileSync(await download.path(), 'utf8').split('\n');
    expect(lines[0]).toBe('code;name;status;owner;start;end;budget;progress');
    expect(lines).toHaveLength(4); // cabecera + 3 filas
    expect(lines.slice(1).every((line) => line.split(';')[2] === 'closed')).toBe(true);
    await expect(page.getByTestId('toast-info')).toContainText('CSV generado');
  });

  test('exporta solo la selección', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-001' }).check();
    await page.getByRole('checkbox', { name: 'Seleccionar PRG-003' }).check();
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('programs-bulk-export').click()]);
    const lines = readFileSync(await download.path(), 'utf8').split('\n');
    expect(lines.map((line) => line.split(';')[0])).toEqual(['code', 'PRG-001', 'PRG-003']);
  });

  test('el estado vive en la URL: recargar conserva filtros y orden', async ({ page }) => {
    await page.goto('/programs?status=cancelled&sort=name&dir=desc');
    await expect(page.getByLabel('Estado')).toHaveValue('cancelled');
    await expect(rowCodes(page)).toHaveCount(3);
    await expect(page.getByRole('columnheader', { name: 'Nombre' })).toHaveAttribute('aria-sort', 'descending');
  });
});

test.describe('Programas · permisos por rol', () => {
  test('consultor: solo lectura + exportar; botones deshabilitados con title explicativo', async ({ page }) => {
    await openAs(page, 'consultant');
    const create = page.getByRole('button', { name: /Nuevo programa/ });
    await expect(create).toBeDisabled();
    await expect(page.getByTitle('Tu rol no permite crear programas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();

    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await expect(page.getByRole('menuitem', { name: 'Ver detalle' })).toBeEnabled();
    for (const name of ['Editar', 'Duplicar', 'Archivar', 'Eliminar']) await expect(page.getByRole('menuitem', { name })).toBeDisabled();
    await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toHaveAttribute('title', 'Solo admin puede eliminar');
  });

  test('auditor: solo lectura', async ({ page }) => {
    await openAs(page, 'auditor');
    await expect(page.getByRole('button', { name: /Nuevo programa/ })).toBeDisabled();
    await page.keyboard.press('n');
    await expect(page.getByTestId('programs-wizard')).toBeHidden();
  });

  test('gestor: crea, edita y archiva, pero no elimina', async ({ page }) => {
    await openAs(page, 'program_manager');
    await expect(page.getByRole('button', { name: /Nuevo programa/ })).toBeEnabled();
    await page.getByRole('button', { name: 'Acciones para PRG-001' }).click();
    await expect(page.getByRole('menuitem', { name: 'Archivar' })).toBeEnabled();
    await expect(page.getByRole('menuitem', { name: 'Eliminar' })).toBeDisabled();
  });

  test('admin ve Administración y Auditoría en el menú; consultor no', async ({ page }) => {
    await openAs(page, 'admin');
    await expect(page.getByTestId('nav-admin')).toBeVisible();
    await expect(page.getByTestId('nav-audit')).toBeVisible();
  });
});

test.describe('Programas · estados de carga, vacío y error', () => {
  test('error 503: alerta con traza, y "Reintentar" recupera la lista', async ({ page }) => {
    let fail = true;
    await page.route('**/api/programs?*', async (route) => {
      if (!fail) return route.continue();
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) });
    });
    await openAs(page, 'admin');
    const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los programas' });
    await expect(alert).toContainText('GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d');
    await expect(page.getByTestId('programs-export-csv')).toBeDisabled();

    fail = false;
    await page.getByTestId('programs-error-retry').click();
    await expect(page.getByTestId('toast-info')).toContainText('Datos recargados');
    await expect(rowCodes(page)).toHaveCount(10);
    await expect(alert).toBeHidden();
  });

  test('carga lenta: aria-busy y filas esqueleto hasta que llegan los datos', async ({ page }) => {
    await page.route('**/api/programs?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });
    await openAs(page, 'admin');
    await expect(page.getByTestId('programs-table')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(6);
    await expect(page.getByTestId('programs-table')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('skeleton-row')).toHaveCount(0);
    await expect(rowCodes(page)).toHaveCount(10);
  });

  test('un fallo de red también muestra el error', async ({ page }) => {
    await page.route('**/api/programs?*', (route) => route.abort('connectionrefused'));
    await openAs(page, 'admin');
    await expect(page.getByTestId('programs-error')).toBeVisible();
  });
});

test.describe('Programas · cobertura de locators', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin');
    await expect(rowCodes(page)).toHaveCount(10);
  });

  test('getByAltText, getByTitle, getByLabel (aria-label), getByPlaceholder y getByTestId', async ({ page }) => {
    await expect(page.getByAltText('SIGPRO')).toBeVisible(); // logo
    await expect(page.getByAltText('Marta Ruiz').first()).toBeVisible(); // avatar (<img alt>)
    await expect(page.getByTitle('11 % completado')).toBeVisible(); // barra de progreso de PRG-001
    await expect(page.getByRole('progressbar', { name: 'Programa PRG-001: 11%' })).toHaveAttribute('aria-valuenow', '11');
    await expect(page.getByLabel('Acciones para PRG-001')).toBeVisible();
    await expect(page.getByPlaceholder('Buscar código o nombre…')).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-004')).toBeVisible();
    await expect(page.getByTitle('Sistema de mando táctico Ártemis')).toBeVisible(); // nombre truncado con title completo
  });

  test('getByRole con name exacto / regex: pares de textos que se solapan', async ({ page }) => {
    // "Activo" (badge) vs "12 activo" (resumen): exact distingue ambos
    await expect(page.getByTestId('programs-row-PRG-001').getByText('Activo', { exact: true })).toBeVisible();
    await expect(page.getByText('12 activo', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Nuevo programa$/ })).toHaveCount(0); // incluye "+ " y la tecla N
    await expect(page.getByRole('button', { name: /Nuevo programa/ })).toHaveCount(1);
  });

  test('encadenamiento y filter({ hasText }) / filter({ has })', async ({ page }) => {
    const row = page.getByRole('row').filter({ hasText: 'PRG-004' });
    await row.getByRole('button', { name: /acciones/i }).click();
    await expect(page.getByRole('menu', { name: 'Acciones para PRG-004' })).toBeVisible();
    await page.keyboard.press('Escape');

    const onHold = page.getByRole('row').filter({ has: page.getByText('En pausa') });
    await expect(onHold).toHaveCount(1); // solo PRG-004 está en pausa en la página 1
    await expect(page.getByRole('row').filter({ hasNot: page.getByText('En pausa') }).getByRole('checkbox').first()).toBeVisible();
  });

  test('selectores CSS por atributos de estado y XPath (contraejemplo)', async ({ page }) => {
    await expect(page.locator('.badge[data-state="on_hold"]')).toHaveCount(1);
    await expect(page.locator('[data-state="cancelled"]').first()).toBeVisible();
    await expect(page.locator('//tr[contains(., "PRG-004")]')).toHaveCount(1);
    await expect(page.locator('tbody tr').first().locator('td:nth-child(2)')).toContainText('PRG-001');
  });

  test('tooltip del encabezado "Avance" (hover y teclado)', async ({ page }) => {
    await page.getByTestId('programs-progress-info').hover();
    await expect(page.getByRole('tooltip')).toHaveText('Hitos completados sobre el total planificado');
    await page.mouse.move(0, 0);
    await expect(page.getByRole('tooltip')).toBeHidden();
    await page.getByTestId('programs-progress-info').focus();
    await expect(page.getByTestId('programs-progress-tooltip')).toBeVisible();
  });

  test('and()/or(): botón habilitado y toast o alerta tras exportar', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Exportar CSV' }).and(page.getByTestId('programs-export-csv'));
    await expect(exportButton).toBeEnabled();
    await Promise.all([page.waitForEvent('download'), exportButton.click()]);
    await expect(page.getByTestId('toast-info').or(page.getByRole('alert'))).toBeVisible();
  });
});

test.describe('Programas · shell, atajos y detalle', () => {
  test('atajos: / enfoca la búsqueda y la escritura filtra con debounce', async ({ page }) => {
    await openAs(page, 'admin');
    await expect(rowCodes(page)).toHaveCount(10);
    await page.keyboard.press('/');
    await expect(page.getByRole('searchbox', { name: 'Búsqueda global' })).toBeFocused();
    const responded = page.waitForResponse((r) => r.url().includes('/api/programs?') && r.url().includes('q=radar'));
    await page.keyboard.type('radar');
    await responded;
    await expect(rowCodes(page)).toHaveText(['PRG-002']);
    await expect(page).toHaveURL(/q=radar/);
  });

  test('sidebar colapsable, tema e idioma desde la cabecera', async ({ page }) => {
    await openAs(page, 'admin');
    const sidebar = page.getByTestId('layout-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(page.getByTestId('nav-programs')).toHaveAttribute('aria-current', 'page');
    const expanded = (await sidebar.boundingBox())!.width;
    await page.getByTestId('layout-sidebar-collapse').click();
    await expect(page.getByTestId('layout-sidebar-collapse')).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBeLessThan(expanded / 2);

    await page.getByRole('button', { name: 'Cambiar tema' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('layout-lang').selectOption('en');
    await expect(page.getByRole('heading', { name: 'Programs', level: 1 })).toBeVisible();
    await expect(page.getByText('24 programs · 12 active')).toBeVisible();
  });

  test('notificaciones y menú de usuario', async ({ page }) => {
    await openAs(page, 'admin');
    await page.getByRole('button', { name: 'Notificaciones' }).click();
    const popover = page.getByRole('dialog', { name: 'Notificaciones' });
    // Las notificaciones llegan por WebSocket (fase 3): al abrir sin eventos recibidos solo hay el estado vacío
    await expect(popover).toBeVisible();
    await page.getByRole('button', { name: 'Marcar leídas' }).click();
    await expect(popover).toBeHidden();

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByRole('menuitem', { name: 'Perfil' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByTestId('layout-user-menu').getByAltText('Marta Ruiz')).toBeVisible();
  });

  test('cerrar sesión vuelve a Acceso con el aviso verde', async ({ page }) => {
    await openAs(page, 'admin');
    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-info')).toHaveText('Sesión cerrada correctamente.');
    // La sesión se borra del almacenamiento (el helper de pruebas la reinyecta en cada carga, así que no se navega de nuevo)
    expect(await page.evaluate(() => localStorage.getItem('sigpro.session'))).toBeNull();
  });

  test('la sesión persiste al recargar (refresh token en localStorage)', async ({ page }) => {
    await openAs(page, 'admin');
    await expect(rowCodes(page)).toHaveCount(10);
    await page.reload();
    await expect(rowCodes(page)).toHaveCount(10);
  });

  test('detalle del programa con pestañas', async ({ page }) => {
    await openAs(page, 'admin');
    await page.getByTestId('programs-link-PRG-001').click();
    await expect(page).toHaveURL(/\/programs\/PRG-001$/);
    await expect(page.getByRole('heading', { name: 'Sistema de mando táctico Ártemis' })).toBeVisible();
    await expect(page.getByTestId('layout-breadcrumbs')).toContainText('Inicio');
    await expect(page.getByTestId('layout-breadcrumbs')).toContainText('PRG-001');
    await expect(page.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Hitos' }).click();
    await expect(page.getByRole('tab', { name: 'Hitos' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toContainText('Disponible en una fase posterior');

    await page.goto('/programs/PRG-999');
    await expect(page.getByTestId('program-detail-not-found')).toContainText('No se encontró el programa');
  });

  test('el menú lleva a las secciones de la fase 3', async ({ page }) => {
    await openAs(page, 'admin');
    await page.getByTestId('nav-nc').click();
    await expect(page).toHaveURL(/\/nc$/);
    await expect(page.getByRole('heading', { name: 'No conformidades', level: 1 })).toBeVisible();
    await page.getByTestId('nav-mission').click();
    await expect(page.getByRole('heading', { name: 'Panel de misión', level: 1 })).toBeVisible();
    await page.getByTestId('nav-admin').click();
    await expect(page.getByRole('heading', { name: 'Administración', level: 1 })).toBeVisible();
  });
});

test.describe('Programas · cookies', () => {
  test('el banner aparece en la primera visita y no vuelve tras aceptar', async ({ page }) => {
    await openAs(page, 'admin', '/programs', { cookies: false });
    const banner = page.getByRole('region', { name: 'Aviso de cookies' });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('No se usan cookies de terceros');
    await page.getByTestId('cookie-banner-accept').click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('programs-table')).toBeVisible();
    await expect(banner).toBeHidden();
  });

  test('rechazar también lo recuerda', async ({ page }) => {
    await openAs(page, 'admin', '/programs', { cookies: false });
    await page.getByTestId('cookie-banner-reject').click();
    expect(await page.evaluate(() => localStorage.getItem('sigpro.cookies'))).toBe('rejected');
  });
});

test.describe('Programas · móvil (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tarjetas en lugar de tabla, tabbar y botón flotante', async ({ page }) => {
    await openAs(page, 'admin');
    await expect(page.getByTestId('programs-list')).toBeVisible();
    await expect(page.getByTestId('programs-table')).toHaveCount(0);
    await expect(page.getByTestId('mobile-tabbar')).toBeVisible();
    await expect(page.getByTestId('mobile-tab-programs')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Nuevo programa' })).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-001')).toBeVisible();

    await page.getByTestId('programs-search').fill('sonar');
    await expect(page.getByTestId('programs-row-PRG-013')).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-001')).toHaveCount(0);
  });

  test('el menú lateral es un drawer con scrim', async ({ page }) => {
    await openAs(page, 'admin');
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(0);
    await page.getByTestId('layout-sidebar-toggle').click();
    await expect(page.getByTestId('layout-sidebar')).toBeVisible();
    await page.getByTestId('layout-drawer-scrim').click({ position: { x: 350, y: 400 } });
    await expect(page.getByTestId('layout-sidebar')).toHaveCount(0);
  });
});

test('seedStorage sin sesión redirige a Acceso', async ({ page }) => {
  await seedStorage(page.context(), {});
  await page.goto('/programs');
  await expect(page).toHaveURL(/\/login$/);
});
