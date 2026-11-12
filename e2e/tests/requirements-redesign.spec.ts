import { expect, test, type Page } from '@playwright/test';
import { API_URL, openAs, resetTenant } from '../support/auth';
import { authHeaders } from '../support/admin';

// Rediseño «1a Ciruela», fase 4 — Requisitos: tarjetas de métricas, árbol-tabla (Pruebas n/m y NC), chip de estado,
// panel con flujo de aprobación y trazabilidad, vista Documento y matriz con el resultado de cada caso.
// Tenant: alumno22 (se reinicia antes y después). Programa de trabajo: PRG-002 (REQ-015 … REQ-028, 9 casos, NC-006 y NC-008).

const TENANT = 'alumno22';
const PROGRAM = '/programs/PRG-002/requirements';
test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ request }) => resetTenant(request, TENANT));
test.afterAll(async ({ request }) => resetTenant(request, TENANT));

type Role = 'admin' | 'program_manager' | 'consultant' | 'auditor';
const open = (page: Page, role: Role = 'admin', path = PROGRAM) => openAs(page, role, path, { tenant: TENANT });
const tree = (page: Page) => page.getByRole('tree', { name: 'Árbol de requisitos' });
const row = (page: Page, code: string) => tree(page).getByRole('treeitem', { name: new RegExp(`^${code} `) });
const detail = (page: Page) => page.getByRole('complementary', { name: 'Detalle del requisito' });
const step = (page: Page, state: string) => page.getByTestId(`requirement-flow-step-${state}`);

test('los textos que otros specs ya fijan no se repiten con el panel abierto ni en la matriz', async ({ page }) => {
  await open(page);
  await row(page, 'REQ-021').click();
  await expect(detail(page)).toBeVisible();
  // Las tarjetas están siempre a la vista: ningún texto suyo puede coincidir con estos
  await expect(page.getByText('14 de 14 requisitos')).toHaveCount(1);
  await expect(page.getByLabel('Prioridad')).toHaveCount(1);
  await expect(page.getByLabel('Título')).toHaveCount(1);
  await expect(page.getByRole('combobox', { name: 'Etiquetas' })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Ciberseguridad' })).toHaveCount(0); // el desplegable de etiquetas está cerrado

  await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
  await expect(page.getByText('13 de 14 requisitos con cobertura')).toHaveCount(1);
  await expect(page.getByText('Sin cobertura')).toHaveCount(1);
});

test.describe('tarjetas de métricas', () => {
  test('cuatro tarjetas con las cifras del programa, independientes de los filtros', async ({ page, request }) => {
    const headers = await authHeaders(request, 'admin', TENANT);
    const list = (await (await request.get(`${API_URL}/programs/PRG-002/requirements`, { headers })).json()) as { items: { state: string }[] };
    const drafts = list.items.filter((item) => item.state === 'draft').length;
    const validated = list.items.filter((item) => item.state === 'validated').length;

    await open(page);
    const metrics = page.getByTestId('requirements-metrics');
    await expect(metrics.getByRole('group')).toHaveCount(4);
    await expect(page.getByTestId('requirements-metric-total')).toContainText('14');
    await expect(page.getByTestId('requirements-metric-total')).toContainText(`validados: ${validated}`);
    // 13 de 14 requisitos tienen casos enlazados → 93 %; la barra cumple la regla de testabilidad (title y aria-valuenow)
    await expect(page.getByTestId('requirements-metric-coverage')).toContainText('93 %');
    await expect(page.getByTestId('requirements-metric-coverage')).toContainText('13 de 14 con pruebas');
    const bar = page.getByTestId('requirements-metric-coverage').getByRole('progressbar');
    await expect(bar).toHaveAttribute('aria-valuenow', '93');
    await expect(bar).toHaveAttribute('title', '93 %');
    await expect(page.getByTestId('requirements-metric-pending')).toContainText(String(drafts));
    // NC-006 (crítica) cuelga de REQ-015 y REQ-022, NC-008 (mayor) de REQ-018 y REQ-025: 2 NC abiertas en 4 requisitos
    await expect(page.getByTestId('requirements-metric-nc')).toContainText('2');
    await expect(page.getByTestId('requirements-metric-nc')).toContainText('requisitos afectados: 4');

    // Filtrar el árbol no cambia las cifras
    await page.getByLabel('Estado').selectOption('approved');
    await expect(page.getByTestId('requirements-count')).not.toContainText('14 de 14 requisitos');
    await expect(page.getByTestId('requirements-metric-total')).toContainText('14');
    await expect(page.getByTestId('requirements-metric-pending')).toContainText(String(drafts));
  });

  test('mientras cargan, las tarjetas muestran «…» y marcan aria-busy', async ({ page }) => {
    await page.route('**/api/programs/PRG-002/requirements', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await open(page);
    await expect(page.getByTestId('requirements-metrics')).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('requirements-metric-total')).toContainText('…');
    await expect(page.getByTestId('requirements-metrics')).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('requirements-metric-total')).toContainText('14');
  });
});

test.describe('árbol-tabla', () => {
  test('cabecera de columnas y, por fila, «Pruebas n/m» y el código de la NC abierta', async ({ page }) => {
    await open(page);
    const header = page.getByTestId('requirements-tree-header');
    for (const column of ['Requisito', 'Estado', 'Pruebas', 'NC']) await expect(header).toContainText(column);

    const tests = (code: string) => page.getByTestId(`requirement-row-tests-${code}`);
    const nc = (code: string) => page.getByTestId(`requirement-row-nc-${code}`);
    // Una prueba que falla y una NC en análisis
    await expect(tests('REQ-018')).toHaveText('0/1');
    await expect(tests('REQ-018')).toHaveAttribute('title', 'Pruebas que pasan: 0 de 1');
    await expect(nc('REQ-018')).toHaveText('NC-008');
    await expect(nc('REQ-018')).toHaveAttribute('title', 'NC abiertas: NC-008');
    // Dos pruebas (pasa una) y una NC crítica
    await expect(tests('REQ-022')).toHaveText('1/2');
    await expect(nc('REQ-022')).toHaveText('NC-006');
    // Todo pasa
    await expect(tests('REQ-019')).toHaveText('1/1');
    await expect(nc('REQ-019')).toHaveText('—');
    // Un caso bloqueado no cuenta como superado
    await expect(tests('REQ-021')).toHaveText('0/1');
    // Sin casos enlazados: guion y el mismo motivo que el panel
    await expect(tests('REQ-028')).toHaveText('—');
    await expect(tests('REQ-028')).toHaveAttribute('title', 'Sin casos de prueba enlazados');

    // La NC va en el color de peligro del design system (token, no un hex)
    const danger = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--danger)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(nc('REQ-018')).toHaveCSS('color', danger);
  });

  test('sangría de 22 px por nivel y los requisitos raíz en 600', async ({ page }) => {
    await open(page);
    const x = async (code: string) => (await page.getByTestId(`requirement-handle-${code}`).boundingBox())?.x ?? 0;
    expect((await x('REQ-016')) - (await x('REQ-015'))).toBe(22);
    await expect(page.getByTestId('requirement-open-REQ-015')).toHaveCSS('font-weight', '600');
    await expect(page.getByTestId('requirement-open-REQ-016')).toHaveCSS('font-weight', '400');
  });

  test('con el panel abierto, «Pruebas» y «NC» se quedan si caben y, si la tabla queda estrecha, pasan al panel', async ({ page }) => {
    await open(page);
    await row(page, 'REQ-018').click();
    await expect(detail(page)).toBeVisible();
    // 1440 px: las cinco columnas caben junto al panel de 380 px
    await expect(page.getByTestId('requirement-row-tests-REQ-018')).toBeVisible();
    await expect(page.getByTestId('requirement-row-nc-REQ-018')).toBeVisible();

    // 1100 px (el escritorio más estrecho): la tabla mide menos de 640 px y esas dos columnas se ocultan; el panel ya las muestra
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page.getByTestId('requirement-row-tests-REQ-018')).toBeHidden();
    await expect(page.getByTestId('requirement-row-nc-REQ-018')).toBeHidden();
    await expect(page.getByTestId('requirement-state-badge').first()).toBeVisible();
    await expect(detail(page).getByTestId('requirement-trace-nc-NC-008')).toBeVisible();
  });
});

test.describe('chip de estado', () => {
  test('«+ Estado» filtra con selectOption, se activa y su «×» lo quita; «Limpiar filtros» quita también la búsqueda', async ({ page }) => {
    await open(page);
    const state = page.getByLabel('Estado');
    await expect(state).toHaveValue('');
    await expect(state.locator('option:checked')).toHaveText('+ Estado');
    const chip = page.locator('.chip').filter({ has: state });
    await expect(chip).toHaveAttribute('data-active', 'false');

    await state.selectOption('validated');
    await expect(chip).toHaveAttribute('data-active', 'true');
    // Quedan los validados y, para no perder el camino, sus ancestros
    const badges = tree(page).getByTestId('requirement-state-badge');
    await expect(badges.filter({ hasText: 'Validado' })).not.toHaveCount(0);
    await expect(tree(page).getByTestId('requirement-row-tests-REQ-028')).toHaveCount(0);

    await page.getByRole('button', { name: 'Quitar «Validado»' }).click();
    await expect(state).toHaveValue('');
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14 requisitos');

    await state.selectOption('approved');
    await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('interfaz');
    await expect(page.getByTestId('requirements-filters-clear')).toBeVisible();
    await page.getByTestId('requirements-filters-clear').click();
    await expect(state).toHaveValue('');
    await expect(page.getByRole('searchbox', { name: 'Buscar requisitos' })).toHaveValue('');
    await expect(page.getByTestId('requirements-count')).toContainText('14 de 14 requisitos');
  });
});

test.describe('panel: flujo de aprobación y trazabilidad', () => {
  test('el flujo marca cada paso (hecho, actual, futuro) y el actual lleva los botones de siempre', async ({ page }) => {
    await open(page);
    await row(page, 'REQ-021').click(); // aprobado
    const statuses = async () => Promise.all(['draft', 'approved', 'verified', 'validated'].map((state) => step(page, state).getAttribute('data-status')));
    expect(await statuses()).toEqual(['done', 'current', 'future', 'future']);
    await expect(step(page, 'approved')).toHaveAttribute('aria-current', 'step');
    // Los botones están dentro del paso actual y conservan nombre y testid
    const current = step(page, 'approved');
    await expect(current.getByRole('button', { name: 'Marcar como verificado' })).toBeEnabled();
    await expect(current.getByRole('button', { name: 'Volver a borrador' })).toBeEnabled();
    await expect(step(page, 'draft').getByRole('button')).toHaveCount(0);
    await expect(page.getByTestId('requirement-transitions')).toHaveCount(1);
    await expect(page.getByTestId('requirement-transition-verified')).toBeVisible();
  });

  test('cada rol ve habilitados solo los pasos que le corresponden, con el motivo en los demás (auditor)', async ({ page }) => {
    await open(page, 'auditor');
    await row(page, 'REQ-021').click();
    const verify = detail(page).getByRole('button', { name: 'Marcar como verificado' });
    await expect(verify).toBeDisabled();
    await expect(verify).toHaveAttribute('title', 'Solo el consultor o el admin pueden verificar');
    const back = detail(page).getByRole('button', { name: 'Volver a borrador' });
    await expect(back).toBeDisabled();
    await expect(back).toHaveAttribute('title', 'Solo el gestor de programa o el admin pueden devolver a borrador');
  });

  test('aprobar avanza el flujo: borrador pasa a «hecho» y el paso «Aprobación» queda como actual', async ({ page }) => {
    await open(page);
    await row(page, 'REQ-017').click();
    await expect(step(page, 'draft')).toHaveAttribute('data-status', 'current');
    await detail(page).getByRole('button', { name: 'Aprobar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-017' }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('toast-ok')).toContainText('REQ-017 → Aprobado');
    await expect(step(page, 'draft')).toHaveAttribute('data-status', 'done');
    await expect(step(page, 'approved')).toHaveAttribute('data-status', 'current');
    await expect(detail(page).getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'approved');
  });

  test('trazabilidad: cada caso con su resultado y cada NC con su severidad, con enlaces a Verificación y NC', async ({ page }) => {
    await open(page);
    await row(page, 'REQ-022').click();
    const trace = detail(page).getByTestId('requirement-trace');
    await expect(trace.getByTestId('requirement-trace-test-TC-010')).toHaveText('Superado');
    await expect(trace.getByTestId('requirement-trace-test-TC-010')).toHaveAttribute('data-state', 'pass');
    await expect(trace.getByTestId('requirement-trace-test-TC-017')).toHaveText('Fallido');
    await expect(trace.getByTestId('requirement-test-TC-017')).toHaveAttribute('href', '/verification/TC-017');
    await expect(trace.getByTestId('requirement-trace-nc-NC-006')).toHaveAttribute('href', '/nc/NC-006');
    await expect(trace.getByTestId('requirement-trace-nc-badge-NC-006')).toHaveAttribute('data-severity', 'critical');
    await expect(trace.getByTestId('requirement-trace-nc-badge-NC-006')).toHaveText('Crítica');

    await row(page, 'REQ-028').click();
    await expect(page.getByTestId('requirement-code')).toHaveText('REQ-028');
    await expect(detail(page).getByText('Sin casos de prueba enlazados')).toBeVisible();
    await expect(detail(page).getByText('Sin no conformidades')).toBeVisible();
  });

  test('cambiar de estado no pierde Pruebas ni NC: la fila se sustituye con la respuesta completa de la API', async ({ page }) => {
    await open(page, 'auditor');
    await row(page, 'REQ-018').click(); // verificado, con una prueba fallida y NC-008
    await detail(page).getByRole('button', { name: 'Validar', exact: true }).click();
    await page.getByRole('dialog', { name: 'Cambiar el estado de REQ-018' }).getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByTestId('toast-ok')).toContainText('REQ-018 → Validado');
    await expect(detail(page).getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'validated');
    await expect(detail(page).getByTestId('requirement-trace-nc-NC-008')).toBeVisible();
    await expect(detail(page).getByTestId('requirement-trace-test-TC-013')).toHaveText('Fallido');
    // Y al cerrar el panel, la fila conserva sus columnas
    await page.getByTestId('requirement-detail-close').click();
    await expect(page.getByTestId('requirement-row-nc-REQ-018')).toHaveText('NC-008');
    await expect(page.getByTestId('requirement-row-tests-REQ-018')).toHaveText('0/1');
  });
});

test.describe('vista Documento', () => {
  test('numera los requisitos como un texto (1, 1.1, 1.2…), con el código en el margen y su estado; un clic abre el panel', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Documento' }).click();
    await expect(page.getByRole('tab', { name: 'Documento' })).toHaveAttribute('aria-selected', 'true');
    const doc = page.getByTestId('requirements-document');
    await expect(doc).toBeVisible();
    await expect(doc.getByRole('article')).toHaveCount(14);

    // REQ-015 es raíz y REQ-016/017/019 sus hijos, por posición
    await expect(page.getByTestId('requirement-doc-REQ-015').locator('.doc-margin')).toContainText('1');
    await expect(page.getByTestId('requirement-doc-REQ-015').locator('.doc-margin')).toContainText('REQ-015');
    await expect(page.getByTestId('requirement-doc-open-REQ-016')).toContainText('1.1');
    await expect(page.getByTestId('requirement-doc-open-REQ-017')).toContainText('1.2');
    await expect(page.getByTestId('requirement-doc-open-REQ-019')).toContainText('1.3');
    // (REQ-017 ya la aprobó un test anterior de este archivo, en serie; REQ-021 sigue aprobado del seed)
    await expect(page.getByTestId('requirement-doc-REQ-021').getByTestId('requirement-state-badge')).toHaveAttribute('data-state', 'approved');
    // La descripción sale del HTML saneado (con su negrita)
    await expect(page.getByTestId('requirement-doc-REQ-017').locator('strong')).toHaveText('disponibilidad');

    await page.getByRole('button', { name: 'Abrir REQ-018' }).click();
    await expect(page.getByTestId('requirement-code')).toHaveText('REQ-018');
  });

  test('comparte el buscador y el chip de estado con el árbol', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Documento' }).click();
    await page.getByLabel('Estado').selectOption('validated');
    const articles = page.getByTestId('requirements-document').getByRole('article');
    await expect(articles.first()).toBeVisible();
    expect(await articles.count()).toBeLessThan(14);
    await page.getByTestId('requirements-filters-clear').click();
    await expect(articles).toHaveCount(14);
    await page.getByRole('searchbox', { name: 'Buscar requisitos' }).fill('zzz-no-existe');
    await expect(page.getByTestId('requirements-no-match')).toBeVisible();
  });
});

test.describe('matriz de trazabilidad', () => {
  test('cada casilla lleva el resultado del caso (✓ ✕ !), «sin ejecutar» o «sin relación», con una etiqueta legible', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
    const matrix = page.getByRole('table', { name: 'Matriz de trazabilidad' });
    const cell = (requirement: string, testCase: string) => matrix.getByTestId(`matrix-cell-${requirement}-${testCase}`);

    await expect(cell('REQ-015', 'TC-010')).toHaveAttribute('data-result', 'pass');
    await expect(cell('REQ-018', 'TC-013')).toHaveAttribute('data-result', 'fail');
    await expect(cell('REQ-021', 'TC-016')).toHaveAttribute('data-result', 'blocked');
    await expect(cell('REQ-016', 'TC-010')).toHaveAttribute('data-result', 'unlinked');
    // Etiqueta accesible con requisito, caso y estado; el nombre corto sigue sirviendo para localizarla
    await expect(matrix.getByRole('checkbox', { name: 'REQ-018 ↔ TC-013, Fallido' })).toBeChecked();
    await expect(matrix.getByRole('checkbox', { name: 'REQ-016 ↔ TC-010, sin relación' })).not.toBeChecked();
    await expect(matrix.getByRole('checkbox', { name: 'REQ-018 ↔ TC-013' })).toHaveCount(1);

    // El color sale de los tokens: ok-soft / danger-soft / --surface-2
    const token = (name: string) =>
      page.evaluate((variable) => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = `var(${variable})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return color;
      }, name);
    await expect(cell('REQ-015', 'TC-010')).toHaveCSS('background-color', await token('--ok-soft'));
    await expect(cell('REQ-018', 'TC-013')).toHaveCSS('background-color', await token('--danger-soft'));
    await expect(cell('REQ-016', 'TC-010')).toHaveCSS('background-color', await token('--surface-2'));

    // Enlazar un hueco sigue funcionando y la etiqueta refleja el nuevo estado
    await cell('REQ-028', 'TC-013').check();
    await expect(page.getByTestId('toast-ok')).toContainText('Enlace creado');
    await expect(cell('REQ-028', 'TC-013')).toHaveAttribute('data-result', 'fail');
    await cell('REQ-028', 'TC-013').uncheck();
    await expect(cell('REQ-028', 'TC-013')).toHaveAttribute('data-result', 'unlinked');
  });

  test('leyenda de la matriz con los tres resultados y «sin ejecutar»', async ({ page }) => {
    await open(page);
    await page.getByRole('tab', { name: 'Matriz de trazabilidad' }).click();
    const key = page.getByRole('list', { name: 'Leyenda de la matriz' });
    await expect(key.getByRole('listitem')).toHaveText(['✓Superado', '✕Fallido', '!Bloqueado', '·Sin ejecutar']);
  });
});
