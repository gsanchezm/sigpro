import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { API_URL, loginByApi, openAs, resetTenant } from '../support/auth';
import { bigPng, jpeg, pdf, png, text } from '../support/files';

// Spec de humo del módulo Verificación (fase 2): casos de prueba con filtros/orden/paginación/selección, informe PDF,
// detalle con historial y miniaturas (getByAltText), ejecución con radio y evidencias (upload simple, múltiple y zona de arrastre).
// Trabaja en su propio tenant (alumno12), restaurado antes y después.

const TENANT = 'alumno12';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

interface Case {
  code: string;
  programCode: string;
  title: string;
  runCount: number;
  lastResult: 'pass' | 'fail' | 'blocked' | null;
}

/** Los 25 casos del seed leídos por API: sirven para contrastar lo que pinta la UI sin fijar a mano cada resultado. */
const allCases = async (request: APIRequestContext): Promise<Case[]> => {
  const { accessToken } = await loginByApi(request, 'admin', TENANT);
  const response = await request.get(`${API_URL}/test-cases?pageSize=100`, { headers: { Authorization: `Bearer ${accessToken}`, 'x-tenant': TENANT } });
  return ((await response.json()) as { items: Case[] }).items;
};

// d+ evita coincidir con testcase-row-menu-TC-001 (el botón ⋯ de cada fila)
const rows = (page: Page) => page.getByTestId(/^testcase-row-TC-\d+$/);
const codes = (page: Page) => page.getByTestId(/^testcase-link-/).evaluateAll((links) => links.map((link) => link.textContent));

test('lista: subtítulo, 10 filas por página, orden por columna (aria-sort), paginación y estado en la URL', async ({ page, request }) => {
  const cases = await allCases(request);
  const totalRuns = cases.reduce((sum, c) => sum + c.runCount, 0);
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });

  await expect(page.getByRole('heading', { level: 1, name: 'Verificación' })).toBeVisible();
  await expect(page.getByText(`25 casos de prueba · ${totalRuns} ejecuciones`)).toBeVisible();
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByTestId('verification-count')).toHaveText('1–10 de 25');
  await expect(codes(page)).resolves.toEqual(['TC-001', 'TC-002', 'TC-003', 'TC-004', 'TC-005', 'TC-006', 'TC-007', 'TC-008', 'TC-009', 'TC-010']);

  // Orden por código descendente (aria-sort) y por último resultado (los fallidos, primero)
  const codeHeader = page.getByRole('columnheader', { name: 'Código' });
  await expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
  await page.getByRole('button', { name: 'Código' }).click();
  await expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
  await expect(codes(page)).resolves.toEqual(['TC-025', 'TC-024', 'TC-023', 'TC-022', 'TC-021', 'TC-020', 'TC-019', 'TC-018', 'TC-017', 'TC-016']);
  await expect(page).toHaveURL(/dir=desc/);

  await page.getByRole('button', { name: 'Último resultado' }).click();
  const firstResult = page.getByTestId('testcase-result-badge').first();
  await expect(firstResult).toHaveAttribute('data-state', 'fail');

  // Paginación (anterior / números / siguiente) y estado compartible por URL
  await page.getByRole('button', { name: 'Código' }).click();
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByTestId('verification-count')).toHaveText('11–20 de 25');
  await page.getByRole('button', { name: 'Página 3' }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();
  await expect(page).toHaveURL(/page=3/);
  await page.reload();
  await expect(page.getByTestId('verification-count')).toHaveText('21–25 de 25');
});

test('filtros: búsqueda con debounce, programa y último resultado, combinados, vacío y limpiar', async ({ page, request }) => {
  const cases = await allCases(request);
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(10);

  // «cifrado» está en los casos 003, 011 y 019
  await page.getByRole('searchbox', { name: 'Buscar casos de prueba' }).fill('cifrado');
  await expect(rows(page)).toHaveCount(3);
  await expect(page).toHaveURL(/q=cifrado/);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(rows(page)).toHaveCount(10);

  await page.getByLabel('Programa').selectOption('PRG-002');
  await expect(page.getByTestId('verification-count')).toHaveText('1–9 de 9');
  await expect(rows(page).first().getByTestId(/^testcase-link-/)).toHaveText('TC-010');

  const fails = cases.filter((c) => c.programCode === 'PRG-002' && c.lastResult === 'fail').length;
  await page.getByLabel('Último resultado').selectOption('fail');
  await expect(rows(page)).toHaveCount(fails);
  await expect(page.getByTestId('testcase-result-badge').first()).toHaveAttribute('data-state', 'fail');

  await page.getByRole('searchbox', { name: 'Buscar casos de prueba' }).fill('zzz-no-existe');
  await expect(page.getByTestId('verification-empty')).toContainText('Sin casos de prueba');
  await page.getByTestId('verification-empty').getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(rows(page)).toHaveCount(10);

  // «Sin ejecutar»: ningún caso del seed está sin ejecutar
  await page.getByLabel('Último resultado').selectOption('none');
  await expect(page.getByTestId('verification-empty')).toBeVisible();
});

test('selección múltiple, barra de acciones e informe PDF de la selección (descarga)', async ({ page }) => {
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(10);
  const selectAll = page.getByRole('checkbox', { name: 'Seleccionar todos los casos de la página' });

  await page.getByRole('checkbox', { name: 'Seleccionar TC-001' }).check();
  await page.getByRole('checkbox', { name: 'Seleccionar TC-003' }).check();
  await expect(page.getByTestId('verification-bulk-bar')).toContainText('2 seleccionados');
  await expect(selectAll).not.toBeChecked();
  expect(await selectAll.evaluate((input: HTMLInputElement) => input.indeterminate)).toBe(true);
  await expect(page.getByRole('row', { name: /TC-001/ })).toHaveAttribute('aria-selected', 'true');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Informe de la selección' }).click()]);
  expect(download.suggestedFilename()).toBe('informe-verificacion-seleccion.pdf');
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const content = bytes.toString('latin1');
  expect(content).toContain('TC-001');
  expect(content).toContain('TC-003');
  expect(content).not.toContain('TC-002');
  expect(content).toContain('Selecci\xf3n de 2 caso\\(s\\)'); // en un PDF los paréntesis del texto van escapados
  await expect(page.getByTestId('toast-info')).toContainText('Informe generado');

  await selectAll.check();
  await expect(page.getByTestId('verification-bulk-bar')).toContainText('10 seleccionados');
  await page.getByRole('button', { name: 'Quitar selección' }).click();
  await expect(page.getByTestId('verification-bulk-bar')).toBeHidden();
});

test('informe PDF del plan: todos los casos o los del programa filtrado', async ({ page }) => {
  await openAs(page, 'auditor', '/verification', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(10);

  const [all] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar informe PDF' }).click()]);
  expect(all.suggestedFilename()).toBe('informe-verificacion.pdf');
  expect((await readFile(await all.path())).toString('latin1')).toContain('Todos los programas');

  await page.getByLabel('Programa').selectOption('PRG-003');
  await expect(page.getByTestId('verification-count')).toHaveText('1–7 de 7');
  const [program] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar informe PDF' }).click()]);
  expect(program.suggestedFilename()).toBe('informe-verificacion-prg-003.pdf');
  const content = (await readFile(await program.path())).toString('latin1');
  expect(content).toContain('Programa PRG-003');
  expect(content).toContain('TC-019');
  expect(content).not.toContain('TC-001 ');
});

test('detalle: pasos, requisitos enlazados, historial con miniaturas (getByAltText) y descarga de evidencia', async ({ page }) => {
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });
  await page.getByRole('link', { name: 'TC-001' }).click();
  await expect(page).toHaveURL(/\/verification\/TC-001$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Verificar disponibilidad (caso 001)' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Migas de pan' }).getByRole('link', { name: 'Verificación' })).toBeVisible();

  const steps = page.getByTestId('testcase-steps').getByRole('listitem');
  await expect(steps).toHaveText(['Preparar el entorno de pruebas', 'Ejecutar el escenario nominal', 'Registrar las mediciones']);
  await expect(page.getByTestId('testcase-expected')).toContainText('umbral definido en el requisito');

  // Historial: RUN-001 (con captura) y RUN-002; la imagen se descarga con el token y se pinta como blob
  const history = page.getByRole('table', { name: 'Historial de ejecuciones' });
  await expect(history.getByRole('row')).toHaveCount(3); // cabecera + 2 ejecuciones
  const thumb = page.getByAltText('Evidencia TC-001');
  await expect(thumb).toHaveCount(1);
  await expect(thumb).toHaveAttribute('data-state', 'ready');
  await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);
  await expect(thumb).toHaveAttribute('src', /^blob:/);
  await expect(page.getByTestId('run-row-RUN-001').getByTestId('run-result-badge-RUN-001')).toHaveAttribute('data-state', /pass|fail|blocked/);
  await expect(page.getByTestId('run-row-RUN-002')).toContainText('Sin evidencias');

  const [evidence] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar TC-001-001.png' }).click()]);
  expect(evidence.suggestedFilename()).toBe('TC-001-001.png');
  expect((await readFile(await evidence.path())).subarray(1, 4).toString('latin1')).toBe('PNG');

  // Requisitos verificados: el enlace abre el detalle del requisito en su programa
  await page.getByTestId('testcase-requirements').getByRole('link', { name: 'REQ-001' }).click();
  await expect(page).toHaveURL(/\/programs\/PRG-001\/requirements/);
  await expect(page.getByRole('complementary', { name: 'Detalle del requisito' }).getByTestId('requirement-code')).toHaveText('REQ-001');

  await page.goBack();
  const [report] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar informe PDF' }).click()]);
  expect(report.suggestedFilename()).toBe('informe-verificacion-seleccion.pdf');
});

test('registrar ejecución: el resultado es obligatorio (radio) y el formulario valida antes de enviar', async ({ page }) => {
  await openAs(page, 'consultant', '/verification/TC-005', { tenant: TENANT });
  const form = page.getByTestId('run-form');
  await expect(page.getByRole('group', { name: /Resultado/ })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: 'Superado' })).not.toBeChecked();

  await form.getByRole('button', { name: 'Registrar ejecución' }).click();
  await expect(page.getByTestId('run-result-error')).toHaveText('Selecciona un resultado');
  await expect(page.getByRole('radio', { name: 'Superado' })).toBeFocused();
  await expect(page.getByTestId('toast-ok')).toHaveCount(0);

  await page.getByRole('radio', { name: 'Fallido' }).check();
  await expect(page.getByTestId('run-result-error')).toBeHidden();
  await expect(page.getByRole('radio', { name: 'Fallido' })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Superado' })).not.toBeChecked();
});

test('evidencias: upload simple, múltiple y zona de arrastre, con validación de tipo, tamaño y máximo de 5', async ({ page }) => {
  await openAs(page, 'consultant', '/verification/TC-005', { tenant: TENANT });
  const files = page.getByTestId('run-files');
  const errors = page.getByTestId('run-files-error');
  await expect(page.getByText('Ningún archivo seleccionado')).toBeVisible();
  await expect(page.getByText(/PNG, JPEG o PDF · máx\. 2 MB por archivo · hasta 5 archivos/)).toBeVisible();

  // setInputFiles: simple (un archivo) y múltiple
  await page.getByLabel('Adjuntar un archivo').setInputFiles(png('captura-1.png'));
  await expect(files.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByAltText('Vista previa de captura-1.png')).toBeVisible();
  await page.getByLabel('Adjuntar varios archivos').setInputFiles([jpeg('foto.jpg'), pdf('informe.pdf')]);
  await expect(files.getByRole('listitem')).toHaveCount(3);
  await expect(files.getByRole('listitem').nth(2)).toContainText('informe.pdf');

  // Validación en el cliente: tipo, tamaño y duplicados (los rechazados no se añaden)
  await page.getByLabel('Adjuntar un archivo').setInputFiles(text('notas.txt'));
  await expect(errors).toContainText('notas.txt: solo se admiten PNG, JPEG o PDF');
  await page.getByLabel('Adjuntar un archivo').setInputFiles(bigPng('enorme.png'));
  await expect(errors).toContainText('enorme.png: supera los 2 MB');
  await expect(files.getByRole('listitem')).toHaveCount(3);
  await page.getByLabel('Adjuntar un archivo').setInputFiles(png('captura-1.png')); // mismo nombre y tamaño que uno ya elegido
  await expect(files.getByRole('listitem')).toHaveCount(3);

  // Quitar uno y volver a añadirlo
  await page.getByRole('button', { name: 'Quitar foto.jpg' }).click();
  await expect(files.getByRole('listitem')).toHaveCount(2);

  // Zona de arrastre: se suelta un DataTransfer con dos archivos (Playwright no arrastra desde el sistema de archivos)
  const dropzone = page.getByTestId('run-dropzone');
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'arrastrado-1.png', { type: 'image/png' }));
    data.items.add(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], 'arrastrado-2.png', { type: 'image/png' }));
    return data;
  });
  await dropzone.dispatchEvent('dragover', { dataTransfer: transfer });
  await expect(dropzone).toHaveAttribute('data-over', 'true');
  await dropzone.dispatchEvent('drop', { dataTransfer: transfer });
  await expect(dropzone).toHaveAttribute('data-over', 'false');
  await expect(files.getByRole('listitem')).toHaveCount(4);
  await expect(files.getByRole('listitem').filter({ hasText: 'arrastrado-1.png' })).toHaveCount(1);

  // Máximo de 5 archivos: el sexto se rechaza con aviso; el selector de archivos nativo (filechooser) también añade
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), dropzone.click()]);
  await chooser.setFiles([png('quinto.png'), png('sexto.png')].map((file) => ({ ...file, buffer: Buffer.concat([file.buffer, Buffer.from(file.name)]) })));
  await expect(files.getByRole('listitem')).toHaveCount(5);
  await expect(errors).toContainText('Máximo 5 archivos por ejecución');
  await page.getByRole('button', { name: 'Quitar quinto.png' }).click();
  await expect(errors).toBeHidden();
  await expect(files.getByRole('listitem')).toHaveCount(4);
});

test('enviar la ejecución con evidencias: toast, historial con miniaturas (imagen y PDF) y reflejo en la lista', async ({ page }) => {
  await openAs(page, 'consultant', '/verification/TC-005', { tenant: TENANT });
  // TC-005 tiene 3 ejecuciones en el seed: cabecera + 3 filas
  await expect(page.getByTestId('testcase-runs').getByRole('row')).toHaveCount(4);

  await page.getByRole('radio', { name: 'Bloqueado' }).check();
  await page.getByLabel('Notas').fill('Entorno de pruebas no disponible durante la ventana.');
  await page.getByLabel('Adjuntar varios archivos').setInputFiles([png('captura-bloqueo.png'), pdf('informe-bloqueo.pdf')]);
  await page.getByTestId('run-form').getByRole('button', { name: 'Registrar ejecución' }).click();

  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Ejecución registrada');
  await expect(toast).toContainText('TC-005: Bloqueado');
  await expect(toast).toContainText('RUN-051');

  // El formulario se limpia y la nueva ejecución aparece la primera del historial
  await expect(page.getByRole('radio', { name: 'Bloqueado' })).not.toBeChecked();
  await expect(page.getByText('Ningún archivo seleccionado')).toBeVisible();
  const history = page.getByTestId('testcase-runs');
  await expect(history.getByRole('row')).toHaveCount(5);
  const run = page.getByTestId('run-row-RUN-051');
  await expect(history.getByRole('row').nth(1)).toHaveAttribute('data-testid', 'run-row-RUN-051');
  await expect(run.getByTestId('run-result-badge-RUN-051')).toHaveText('Bloqueado');
  await expect(run).toContainText('Entorno de pruebas no disponible');
  await expect(run).toContainText('Lucía Fernández');

  // getByAltText: la captura como imagen real y el PDF con su propio alt
  const image = run.getByAltText('Evidencia TC-005');
  await expect(image).toHaveAttribute('data-state', 'ready');
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
  await expect(run.getByAltText('Documento PDF informe-bloqueo.pdf')).toBeVisible();

  const [evidence] = await Promise.all([page.waitForEvent('download'), run.getByRole('button', { name: 'Descargar informe-bloqueo.pdf' }).click()]);
  expect(evidence.suggestedFilename()).toBe('informe-bloqueo.pdf');
  expect((await readFile(await evidence.path())).subarray(0, 5).toString('latin1')).toBe('%PDF-');

  // La lista refleja la nueva ejecución: último resultado «Bloqueado» y una ejecución más
  await page.goto('/verification?q=TC-005');
  const row = page.getByTestId('testcase-row-TC-005');
  await expect(row.getByTestId('testcase-result-badge')).toHaveAttribute('data-state', 'blocked');
});

test('permisos: gestor y auditor ven el formulario deshabilitado con su motivo; el menú de la fila también', async ({ page }) => {
  await openAs(page, 'auditor', '/verification/TC-007', { tenant: TENANT });
  await expect(page.getByTestId('run-denied')).toContainText('Tu rol no permite registrar ejecuciones');
  const submit = page.getByTestId('run-form').getByRole('button', { name: 'Registrar ejecución' });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute('title', 'Tu rol no permite registrar ejecuciones');
  await expect(page.getByRole('radio', { name: 'Superado' })).toBeDisabled();
  await expect(page.getByLabel('Adjuntar un archivo')).toBeDisabled();
  await expect(page.getByTitle('Tu rol no permite registrar ejecuciones').first()).toBeVisible();

  await openAs(page, 'program_manager', '/verification', { tenant: TENANT });
  await page.getByRole('button', { name: 'Acciones para TC-007' }).click();
  await expect(page.getByRole('menuitem', { name: 'Registrar ejecución' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Registrar ejecución' })).toHaveAttribute('title', 'Tu rol no permite registrar ejecuciones');
  await page.keyboard.press('Escape');
});

test('menú ⋯ de fila: ver detalle, registrar ejecución (#run) e informe PDF del caso', async ({ page }) => {
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });
  await page.getByRole('button', { name: 'Acciones para TC-003' }).click();
  const menu = page.getByRole('menu', { name: 'Acciones para TC-003' });
  await expect(menu.getByRole('menuitem')).toHaveText(['Ver detalle', 'Registrar ejecución', 'Informe PDF']);

  const [download] = await Promise.all([page.waitForEvent('download'), menu.getByRole('menuitem', { name: 'Informe PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('informe-verificacion-seleccion.pdf');

  await page.getByRole('button', { name: 'Acciones para TC-003' }).click();
  await page.getByRole('menuitem', { name: 'Registrar ejecución' }).click();
  await expect(page).toHaveURL(/\/verification\/TC-003#run$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Registrar ejecución' })).toBeInViewport();

  await page.goto('/verification');
  await page.getByRole('button', { name: 'Acciones para TC-004' }).click();
  await page.getByRole('menuitem', { name: 'Ver detalle' }).click();
  await expect(page).toHaveURL(/\/verification\/TC-004$/);
});

test('móvil (390 px): tarjetas en lugar de tabla, sin selección múltiple', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAs(page, 'consultant', '/verification', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(10);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByTestId('testcase-row-TC-001')).toContainText('Verificar disponibilidad');
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByTestId('verification-count')).toHaveText('11–20 de 25');
});

test('carga lenta (skeleton + aria-busy), error 503 con traza y reintento, y caso inexistente', async ({ page }) => {
  await openAs(page, 'consultant', '/programs', { tenant: TENANT });

  await page.route('**/api/test-cases?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.goto('/verification');
  await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
  await expect(page.getByTestId('verification-table')).toHaveAttribute('aria-busy', 'true');
  await expect(rows(page)).toHaveCount(10, { timeout: 8000 });
  await page.unroute('**/api/test-cases?*');

  await page.route('**/api/test-cases?*', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }),
  );
  await page.goto('/verification');
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los casos de prueba' });
  await expect(alert).toContainText('503');
  await page.unroute('**/api/test-cases?*');
  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await expect(rows(page)).toHaveCount(10);

  await page.goto('/verification/TC-999');
  await expect(page.getByRole('alert').filter({ hasText: 'No se encontró el caso de prueba' })).toBeVisible();
});
