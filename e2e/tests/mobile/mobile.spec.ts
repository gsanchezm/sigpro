import { expect, test, type Page } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { API_URL, loginByApi, openAs, resetTenant, seedStorage } from '../../support/auth';

// Spec de humo de la app móvil (Expo web a 390 px): acceso con MFA, Programas (tarjetas y filtros), No conformidades (kanban),
// Panel de misión (tiempo real) y, en solo lectura, Requisitos y Documentos. Mismas rutas e ids que la web.
// Locators por rol / etiqueta primero (`getByRole('tab')`, `getByRole('radio')`…); `getByTestId` (el `testID` de React Native
// se pinta como `data-testid`) como respaldo. Trabaja en su propio tenant (alumno24), restaurado antes y después.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await chaosOff(request, TENANT);
  await resetTenant(request, TENANT);
});

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('Móvil · acceso', () => {
  test.beforeEach(async ({ page }) => {
    await seedStorage(page.context(), { tenant: TENANT });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesión', level: 1 })).toBeVisible();
  });

  test('login del admin con segundo paso MFA: código incorrecto y luego el bueno', async ({ page }) => {
    await page.getByRole('radio', { name: /admin$/ }).click(); // usuario de prueba: rellena correo y contraseña
    await expect(page.getByLabel('Correo electrónico')).toHaveValue('admin@sigpro.test');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Verificación en dos pasos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeDisabled();
    await page.getByLabel('Código de verificación').fill('00000');
    await expect(page.getByRole('button', { name: 'Verificar' })).toBeDisabled(); // faltan dígitos
    await page.getByLabel('Código de verificación').fill('000000');
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page.getByTestId('mfa-error')).toContainText('POST /api/auth/mfa → 401 Unauthorized');

    await page.getByLabel('Código de verificación').fill('123456');
    await page.getByRole('button', { name: 'Verificar' }).click();
    await expect(page).toHaveURL(/\/programs$/);
    // Pestañas inferiores = las rutas de la web; el nombre accesible es el completo aunque la etiqueta visible sea más corta
    await expect(page.getByRole('tab')).toHaveCount(5);
    for (const name of ['Programas', 'No conformidades', 'Panel de misión', 'Documentos', 'Perfil']) await expect(tab(page, name)).toBeVisible();
    await expect(page.getByRole('tab', { name: /Administración/ })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('sigpro.tenant'))).toBe(TENANT);
    expect(await page.evaluate(() => localStorage.getItem('sigpro.session'))).toContain('refreshToken');
  });

  test('errores de acceso: 401 con el nº de intentos y 423 de la cuenta bloqueada', async ({ page }) => {
    await page.getByLabel('Correo electrónico').fill(`nadie-${Date.now()}@sigpro.test`);
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('POST /api/auth/login → 401 Unauthorized · attempts=1');

    await page.getByLabel('Correo electrónico').fill('bloqueado@sigpro.test');
    await page.getByLabel('Contraseña', { exact: true }).fill('Block1234!');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('alert')).toContainText('423 Locked');
  });

  test('validación de cliente y campo de tenant', async ({ page }) => {
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByTestId('login-email-error')).toHaveText('Campo obligatorio');
    await expect(page.getByLabel('Tenant de trabajo')).toHaveValue(TENANT);
  });

  test('una ruta protegida sin sesión lleva a /login', async ({ page }) => {
    await page.goto('/nc');
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Móvil · programas', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs', { tenant: TENANT });
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
  });

  test('lista en tarjetas: 10 por página y «Cargar más»', async ({ page }) => {
    const cards = page.getByTestId(/^programs-row-PRG-\d+$/);
    await expect(cards).toHaveCount(10);
    await expect(cards.first()).toContainText('PRG-001');
    await expect(cards.first().getByRole('progressbar')).toHaveAttribute('aria-valuenow', '11'); // PRG-001: 11 % completado

    await page.getByRole('button', { name: /Cargar más/ }).click();
    await expect(cards).toHaveCount(20);
    await expect(page.getByTestId('programs-count')).toHaveText('1–20 de 24');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('filtros: chips de estado (radio), búsqueda y estado vacío; el filtro vive en la URL', async ({ page }) => {
    const cards = page.getByTestId(/^programs-row-PRG-\d+$/);
    await page.getByRole('radio', { name: 'En pausa' }).click();
    await expect(page.getByRole('radio', { name: 'En pausa' })).toHaveAttribute('aria-checked', 'true');
    await expect(cards).toHaveCount(3);
    await expect(page.getByTestId('programs-row-PRG-004')).toBeVisible();
    await expect(page.getByTestId('programs-row-PRG-004').getByTestId('programs-state-badge')).toHaveAttribute('data-state', 'on_hold');
    await expect(page).toHaveURL(/status=on_hold/);

    await page.getByPlaceholder('Buscar código o nombre…').fill('gestión');
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText('PRG-012');

    await page.getByLabel('Buscar programas').fill('zzzz-no-existe');
    await expect(page.getByTestId('programs-empty')).toContainText('Ningún programa coincide con los filtros aplicados.');
    await page.getByTestId('programs-empty-clear').click();
    await expect(page.getByTestId('programs-count')).toHaveText('1–10 de 24');
  });

  test('error de la API con traza y reintento', async ({ page }) => {
    await page.route('**/api/programs?*', (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down', traceId: '7f3a-c21d' }) }),
    );
    await page.getByRole('radio', { name: 'Activo' }).click();
    await expect(page.getByTestId('programs-error')).toContainText('GET /api/programs → 503 Service Unavailable · trace 7f3a-c21d');
    await page.unroute('**/api/programs?*');
    await page.getByTestId('programs-error-retry').click();
    await expect(page.getByTestId('programs-error')).toBeHidden();
    await expect(page.getByTestId('programs-count')).toContainText('de 12'); // 12 programas activos
  });

  test('detalle del programa: hitos de solo lectura y enlace a sus requisitos', async ({ page }) => {
    await page.getByTestId('programs-row-PRG-002').click();
    await expect(page).toHaveURL(/\/programs\/PRG-002$/);
    await expect(page.getByTestId('program-detail-state-badge')).toHaveAttribute('data-state', 'active');
    await expect(page.getByTestId(/^milestone-row-PRG-002-M\d+$/)).toHaveCount(6);
    await expect(page.getByRole('button', { name: /Editar|Eliminar|Archivar/ })).toHaveCount(0); // solo lectura

    await page.getByRole('button', { name: 'Ver requisitos' }).click();
    await expect(page).toHaveURL(/\/programs\/PRG-002\/requirements$/);
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');
  });
});

test.describe('Móvil · requisitos (solo lectura)', () => {
  test.beforeEach(async ({ page }) => {
    await openAs(page, 'admin', '/programs/PRG-002/requirements', { tenant: TENANT });
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14');
  });

  test('árbol: niveles, estados con data-state, plegar y filtro con ancestros', async ({ page }) => {
    const rows = page.getByTestId(/^requirement-row-REQ-\d+$/);
    await expect(rows).toHaveCount(14);
    await expect(page.getByTestId('requirement-row-state-REQ-017')).toHaveAttribute('data-state', 'draft');
    await expect(page.getByRole('listitem', { name: /^REQ-017 / })).toBeVisible();

    await page.getByRole('button', { name: 'Contraer REQ-015' }).click();
    await expect(page.getByTestId('requirement-row-REQ-016')).toBeHidden(); // hijo de REQ-015
    await page.getByRole('button', { name: 'Expandir REQ-015' }).click();
    await expect(page.getByTestId('requirement-row-REQ-016')).toBeVisible();

    await page.getByLabel('Buscar requisitos').fill('Disponibilidad');
    await expect(page.getByTestId('requirement-row-REQ-017')).toBeVisible();
    await expect(page.getByTestId('requirement-row-REQ-015')).toBeVisible(); // el ancestro se conserva
    await expect(page.getByTestId('requirement-row-REQ-018')).toBeHidden();
  });

  test('detalle en una hoja inferior y ninguna acción de edición', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir detalle de REQ-017' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toContainText('REQ-017');
    await expect(sheet).toContainText('Borrador');
    await expect(page.getByRole('button', { name: /Aprobar|Marcar como verificado|Validar|Guardar|Eliminar/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toBeHidden();
  });
});

test.describe('Móvil · no conformidades (kanban)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTenant(request, TENANT); // este bloque mueve tarjetas
  });

  test('tablero: 5 columnas con su recuento y tarjetas con severidad y asignado', async ({ page }) => {
    await openAs(page, 'admin', '/nc', { tenant: TENANT });
    const board = page.getByRole('group', { name: 'Tablero de no conformidades' });
    await expect(board.getByRole('region')).toHaveCount(5);
    for (const [state, count] of [['open', '4'], ['in_analysis', '2'], ['corrective_action', '2'], ['closed', '2'], ['rejected', '2']] as const) {
      await expect(page.getByTestId(`nc-column-count-${state}`)).toHaveText(count);
    }
    await expect(page.getByTestId('nc-card-severity-NC-003')).toHaveAttribute('data-severity', 'critical');
    // Tarjetas sin asignado: no llevan avatar (`role="img"`), como el kanban de la web (`filter({ hasNot })`)
    const unassigned = page.getByRole('listitem').filter({ hasNot: page.getByRole('img') }).filter({ hasText: 'NC-' });
    await expect(unassigned).toHaveCount(2); // NC-005 y NC-010
    expect(await noHorizontalOverflow(page)).toBe(true); // el desplazamiento horizontal lo absorbe el tablero

    await page.getByRole('radio', { name: 'Crítica' }).click();
    await expect(page.getByTestId(/^nc-card-NC-\d+$/)).toHaveCount(4);
  });

  test('«Mover a…» (la alternativa móvil al arrastre) cambia la tarjeta de columna', async ({ page }) => {
    await openAs(page, 'admin', '/nc', { tenant: TENANT });
    await page.getByTestId('nc-card-open-NC-001').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByTestId('nc-state-badge')).toHaveAttribute('data-state', 'open');
    await expect(sheet.getByRole('button', { name: /^Mover a/ })).toHaveText(['Mover a «En análisis»']);
    await sheet.getByRole('button', { name: 'Mover a «En análisis»' }).click();

    await expect(page.getByRole('region', { name: /En análisis/ }).getByTestId('nc-card-NC-001')).toBeVisible();
    await expect(page.getByTestId('nc-column-count-open')).toHaveText('3');
    await expect(page.getByTestId('nc-column-count-in_analysis')).toHaveText('3');
    await expect(page.getByTestId('toast-ok')).toBeVisible();
  });

  test('cerrar exige un comentario de cierre de al menos 20 caracteres', async ({ page }) => {
    await openAs(page, 'admin', '/nc', { tenant: TENANT });
    await page.getByTestId('nc-card-open-NC-003').click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'Mover a «Cerrada»' }).click();

    await sheet.getByRole('button', { name: 'Cerrar no conformidad' }).click();
    await expect(sheet.getByTestId('nc-close-error')).toBeVisible();
    await sheet.getByLabel('Comentario de cierre').fill('Corto');
    await expect(sheet.getByTestId('nc-close-counter')).toContainText('5 / 20');
    await sheet.getByRole('button', { name: 'Cerrar no conformidad' }).click();
    await expect(sheet.getByTestId('nc-close-error')).toBeVisible();

    await sheet.getByLabel('Comentario de cierre').fill('Se corrigió la configuración y se repitió la prueba.');
    await sheet.getByRole('button', { name: 'Cerrar no conformidad' }).click();
    await expect(page.getByRole('region', { name: /Cerrada/ }).getByTestId('nc-card-NC-003')).toBeVisible();
    await expect(page.getByTestId('nc-column-count-closed')).toHaveText('3');
  });

  test('el auditor puede comentar pero no mover (botón deshabilitado con su motivo)', async ({ page }) => {
    await openAs(page, 'auditor', '/nc', { tenant: TENANT });
    await page.getByTestId('nc-card-open-NC-001').click();
    const sheet = page.getByRole('dialog');
    const move = sheet.getByRole('button', { name: 'Mover a «En análisis»' });
    await expect(move).toBeDisabled();
    // React Native no tiene `title`: el motivo va en `data-reason` (web) y, además, como texto visible junto al botón
    await expect(move).toHaveAttribute('data-reason', 'Tu rol no permite mover no conformidades');
    await expect(sheet.getByTestId('nc-transition-reason')).toHaveText('Tu rol no permite mover no conformidades');

    await sheet.getByLabel('Añadir comentario').fill('Revisado por auditoría desde el móvil.');
    await sheet.getByRole('button', { name: 'Comentar' }).click();
    await expect(sheet.getByTestId('nc-comments')).toContainText('Revisado por auditoría desde el móvil.');
  });
});

test.describe('Móvil · panel de misión (tiempo real)', () => {
  test('KPIs, gráficas, conexión en vivo y evento de prueba en el feed', async ({ page }) => {
    await openAs(page, 'admin', '/mission', { tenant: TENANT });
    await expect(page.getByTestId('mission-kpis').getByRole('button', { name: /Qué mide/ })).toHaveCount(4);
    await expect(page.getByTestId('mission-kpi-value-programs')).toHaveText('12');
    await expect(page.getByTestId('mission-connection')).toHaveAttribute('data-state', 'connected', { timeout: 15_000 });
    await expect(page.getByTestId('mission-bar-nc-critical')).toBeVisible();

    const events = page.getByTestId(/^mission-event-\d+$/);
    const before = await events.count();
    await page.getByRole('button', { name: 'Emitir evento de prueba' }).click();
    await expect.poll(() => events.count()).toBeGreaterThan(before);

    // Pausa: lo visible no cambia mientras llegan eventos; al reanudar aparecen
    await page.getByTestId('mission-pause').click();
    await expect(page.getByTestId('mission-pause')).toHaveAttribute('aria-pressed', 'true');
    const paused = await events.count();
    // La respuesta se espera ANTES de pulsar: si llega rápido, `waitForResponse` registrado después se la perdería
    await Promise.all([
      page.waitForResponse((response) => response.url().includes('/mission/tick') && response.ok()),
      page.getByRole('button', { name: 'Emitir evento de prueba' }).click(),
    ]);
    await expect(events).toHaveCount(paused);
    await page.getByTestId('mission-pause').click();
    await expect.poll(() => events.count()).toBeGreaterThan(paused);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('un evento real (mover una NC por API) actualiza el KPI sin recargar', async ({ page, request }) => {
    await openAs(page, 'admin', '/mission', { tenant: TENANT });
    await expect(page.getByTestId('mission-connection')).toHaveAttribute('data-state', 'connected', { timeout: 15_000 });
    const kpi = page.getByTestId('mission-kpi-value-nc');
    const open = Number(await kpi.textContent());

    const { accessToken } = await loginByApi(request, 'admin', TENANT);
    // «NC abiertas» cuenta las que no están cerradas ni rechazadas: rechazar NC-008 (en análisis) baja el KPI en uno
    const response = await request.post(`${API_URL}/nc/NC-008/transition`, {
      headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT },
      data: { to: 'rejected' },
    });
    expect(response.ok()).toBe(true);
    await expect(kpi).toHaveText(String(open - 1));
  });

  test('el consultor no puede emitir eventos de prueba (deshabilitado con motivo)', async ({ page }) => {
    await openAs(page, 'consultant', '/mission', { tenant: TENANT });
    const simulate = page.getByRole('button', { name: 'Emitir evento de prueba' });
    await expect(simulate).toBeDisabled();
    await expect(page.getByTestId('mission-simulate-reason')).toHaveText('Solo admin puede emitir eventos de prueba');
  });
});

test.describe('Móvil · documentos (solo lectura)', () => {
  test('el admin ve los 12 documentos; el consultor, 8 y un aviso con el recuento de ocultos', async ({ page }) => {
    await openAs(page, 'admin', '/documents', { tenant: TENANT });
    await expect(page.getByTestId(/^document-row-DOC-\d+$/)).toHaveCount(12);
    await expect(page.getByTestId('document-row-DOC-003').getByTestId('document-class-badge')).toHaveAttribute('data-state', 'restricted');

    await openAs(page, 'consultant', '/documents', { tenant: TENANT });
    await expect(page.getByTestId(/^document-row-DOC-\d+$/)).toHaveCount(8);
    await expect(page.getByTestId('documents-hidden-note')).toContainText('4 documentos restringidos no son visibles para tu rol.');
  });

  test('ficha: versiones y contenido; un restringido da 403 al consultor', async ({ page }) => {
    await openAs(page, 'admin', '/documents/DOC-004', { tenant: TENANT });
    await expect(page.getByRole('radio', { name: 'Versión 3 · última' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByTestId('viewer-page-1')).toBeVisible();
    await page.getByRole('radio', { name: 'Versión 1' }).click();
    await expect(page.getByRole('radio', { name: 'Versión 1' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('button', { name: /Descargar|Publicar|Comparar/ })).toHaveCount(0); // solo lectura

    await openAs(page, 'consultant', '/documents/DOC-003', { tenant: TENANT });
    await expect(page.getByTestId('document-forbidden')).toContainText('No tienes permiso para ver este documento');
    await expect(page.getByTestId('document-forbidden')).toContainText('GET /api/documents/DOC-003 → 403 Forbidden');
  });
});

test.describe('Móvil · perfil y alcance', () => {
  test('perfil: idioma, tema y cierre de sesión', async ({ page }) => {
    await openAs(page, 'admin', '/programs', { tenant: TENANT });
    await tab(page, 'Perfil').click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('profile-role')).toHaveText('admin');
    await expect(page.getByTestId('profile-tenant')).toHaveText(TENANT);

    await page.getByRole('radio', { name: 'EN', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Programs' })).toBeVisible();
    await page.getByRole('radio', { name: 'ES', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Programas' })).toBeVisible();

    await page.getByRole('button', { name: /^Cambiar tema/ }).click();
    expect(await page.evaluate(() => localStorage.getItem('sigpro.theme'))).toBe('dark');

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('sigpro.session'))).toBeNull();
  });

  test('la sesión sobrevive a recargar y no existe administración en el móvil', async ({ page }) => {
    await openAs(page, 'admin', '/nc', { tenant: TENANT });
    await expect(page.getByTestId('nc-board')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('nc-board')).toBeVisible();
    await expect(page).toHaveURL(/\/nc$/);

    await expect(page.getByRole('tab', { name: /Administración/ })).toHaveCount(0);
    await page.goto('/admin');
    await expect(page.getByTestId('admin-page')).toHaveCount(0);
  });
});
