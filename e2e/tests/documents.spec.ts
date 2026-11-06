import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openAs, resetTenant } from '../support/auth';

// Spec de humo del módulo Documentos (fase 2): lista con clasificación por rol, visor en <iframe title="Visor de documento">
// (frameLocator), enlace a nueva pestaña (target=_blank), descarga de PDF, comparación de versiones y publicación de versiones.
// Trabaja en su propio tenant (alumno18), restaurado antes y después.
//
// Seed: DOC-001…012 en los programas 1–6; restringidos DOC-003, 006, 009 y 012; versiones 3,1,2,3,1,2,3,1,2,3,1,2.

const TENANT = 'alumno18';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

// La lista se pide sin query string cuando no hay filtros: el patrón cubre ambas formas
const LIST_URL = /\/api\/documents(\?.*)?$/;
const rows = (page: Page) => page.getByTestId(/^document-row-DOC-\d+$/);
const viewer = (page: Page) => page.frameLocator('[title="Visor de documento"]');

test('lista por rol: el consultor no ve los restringidos (y se le avisa); el resto ve los 12', async ({ page }) => {
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  await expect(page.getByRole('heading', { level: 1, name: 'Documentos' })).toBeVisible();
  await expect(rows(page)).toHaveCount(12);
  await expect(page.getByText('12 documentos', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('documents-hidden-note')).toHaveCount(0);

  // CSS por atributo de estado: los restringidos son DOC-003, 006, 009 y 012
  const restricted = page.locator('tr[data-state="restricted"]');
  await expect(restricted).toHaveCount(4);
  await expect(page.locator('.badge[data-state="restricted"]')).toHaveCount(4);
  await expect(restricted.first().getByTestId('document-class-badge')).toHaveText('Restringido');

  for (const role of ['program_manager', 'auditor'] as const) {
    await openAs(page, role, '/documents', { tenant: TENANT });
    await expect(rows(page)).toHaveCount(12);
  }

  await openAs(page, 'consultant', '/documents', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(8);
  await expect(page.locator('tr[data-state="restricted"]')).toHaveCount(0);
  await expect(page.getByTestId('documents-hidden-note')).toHaveText('4 documentos restringidos no son visibles para tu rol.');
  await expect(page.getByTestId('document-row-DOC-003')).toHaveCount(0);

  // Filtrar por «Restringido» no deja nada para el consultor
  await page.getByLabel('Clasificación').selectOption('restricted');
  await expect(page.getByTestId('documents-empty')).toContainText('Sin documentos');
});

test('filtros: texto, programa y clasificación, combinados, vacío y limpiar', async ({ page }) => {
  await openAs(page, 'admin', '/documents', { tenant: TENANT });
  await expect(rows(page)).toHaveCount(12);

  await page.getByRole('searchbox', { name: 'Buscar documentos' }).fill('especificación');
  await expect(rows(page)).toHaveCount(6);
  await page.getByLabel('Programa').selectOption('PRG-002');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('DOC-004');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(rows(page)).toHaveCount(12);

  await page.getByLabel('Clasificación').selectOption('restricted');
  await expect(rows(page)).toHaveCount(4);
  await page.getByRole('searchbox', { name: 'Buscar documentos' }).fill('zzz-no-existe');
  await expect(page.getByTestId('documents-empty')).toContainText('Ningún documento coincide con los filtros aplicados.');
  await page.getByTestId('documents-empty').getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(rows(page)).toHaveCount(12);
});

test('visor en iframe (frameLocator): título, páginas y contenido; cambiar de versión recarga el iframe', async ({ page }) => {
  await openAs(page, 'consultant', '/documents', { tenant: TENANT });
  await page.getByRole('link', { name: 'DOC-001' }).click();
  await expect(page).toHaveURL(/\/documents\/DOC-001$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Plan de verificación PRG-001' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Migas de pan' }).getByRole('link', { name: 'Documentos' })).toBeVisible();

  const frame = page.locator('iframe[title="Visor de documento"]');
  await expect(frame).toHaveAttribute('src', '/documents/DOC-001/view?version=3');
  const content = viewer(page);
  await expect(content.getByRole('heading', { level: 1 })).toHaveText('Plan de verificación PRG-001');
  await expect(content.getByTestId('viewer-version')).toHaveText('Versión 3');
  await expect(content.getByTestId('viewer-class')).toHaveAttribute('data-state', 'public');
  await expect(content.getByText('Página 1 de 2')).toBeVisible();
  await expect(content.getByText('Página 2 de 2')).toBeVisible();
  // 12 líneas por página: el alcance está en la 1 y el reparto de responsabilidades termina en la 2
  await expect(content.getByTestId('viewer-page-1')).toContainText('Aplica a todos los subsistemas del programa.');
  await expect(content.getByTestId('viewer-page-2')).toContainText('El director técnico supervisa la ejecución.');
  await expect(content.getByTestId('viewer-page-2')).toContainText('Anexo A: matriz de trazabilidad.');
  await expect(content.getByText('Se excluyen los equipos de apoyo en tierra')).toHaveCount(0); // se eliminó en v3
  await expect(content.getByTestId('viewer-page-3')).toHaveCount(0);

  // Cambiar a la versión 1: el iframe carga otra URL con otro contenido
  await page.getByLabel('Versión').selectOption('1');
  await expect(frame).toHaveAttribute('src', '/documents/DOC-001/view?version=1');
  await expect(content.getByTestId('viewer-version')).toHaveText('Versión 1');
  await expect(content.getByText('Se excluyen los equipos de apoyo en tierra.', { exact: true })).toBeVisible();
  await expect(content.getByText('El director técnico supervisa la ejecución.')).toHaveCount(0);
  await expect(content.getByText('Página 2 de 2')).toBeVisible();

  // El contentFrame del <iframe> también es accesible como Frame
  const handle = await frame.elementHandle();
  const inner = await handle?.contentFrame();
  expect(inner?.url()).toContain('/documents/DOC-001/view?version=1');

  // Historial de versiones
  const history = page.getByTestId('document-versions').getByRole('listitem');
  await expect(history).toHaveCount(3);
  await expect(history.first()).toContainText('v3');
  await expect(history.first()).toContainText('Nuevos criterios de aceptación y anexos');
  await expect(history.last()).toContainText('Versión inicial');
});

test('nueva pestaña: el enlace «Abrir en nueva pestaña» (target=_blank) abre el visor con la sesión compartida', async ({ page, context }) => {
  await openAs(page, 'auditor', '/documents/DOC-003', { tenant: TENANT }); // restringido: el auditor sí lo ve
  const link = page.getByRole('link', { name: 'Abrir en nueva pestaña' });
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('href', '/documents/DOC-003/view?version=2');

  const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await popup.waitForLoadState();
  await expect(popup).toHaveURL(/\/documents\/DOC-003\/view\?version=2$/);
  await expect(popup.getByRole('heading', { level: 1 })).toHaveText('Plan de verificación PRG-002');
  await expect(popup.getByTestId('viewer-class')).toHaveAttribute('data-state', 'restricted');
  await expect(popup.getByTestId('viewer-page-1')).toBeVisible();
  await popup.close();

  // Desde el menú ⋯ de la lista también
  await page.goto('/documents');
  await page.getByRole('button', { name: 'Acciones para DOC-001' }).click();
  const [second] = await Promise.all([context.waitForEvent('page'), page.getByRole('menuitem', { name: 'Abrir en nueva pestaña' }).click()]);
  await second.waitForLoadState();
  await expect(second).toHaveURL(/\/documents\/DOC-001\/view$/);
  await expect(second.getByRole('heading', { level: 1 })).toHaveText('Plan de verificación PRG-001');
  await second.close();

  // La versión elegida viaja en el enlace
  await page.goto('/documents/DOC-001');
  await page.getByLabel('Versión').selectOption('2');
  await expect(page.getByRole('link', { name: 'Abrir en nueva pestaña' })).toHaveAttribute('href', '/documents/DOC-001/view?version=2');
});

test('descarga de PDF: nombre con la versión y contenido de la versión elegida (detalle y menú de la lista)', async ({ page }) => {
  await openAs(page, 'consultant', '/documents/DOC-004', { tenant: TENANT });
  const [latest] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
  expect(latest.suggestedFilename()).toBe('DOC-004-v3.pdf');
  const bytes = await readFile(await latest.path());
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const text = bytes.toString('latin1');
  expect(text).toContain('Especificaci\xf3n t\xe9cnica PRG-002');
  expect(text).toContain('Anexo A: matriz de trazabilidad.');
  await expect(page.getByTestId('toast-info')).toContainText('Descarga iniciada');

  await page.getByLabel('Versión').selectOption('1');
  const [first] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar PDF' }).click()]);
  expect(first.suggestedFilename()).toBe('DOC-004-v1.pdf');
  expect((await readFile(await first.path())).toString('latin1')).not.toContain('Anexo A');

  await page.goto('/documents');
  await page.getByRole('button', { name: 'Acciones para DOC-001' }).click();
  const [fromMenu] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: 'Descargar PDF' }).click()]);
  expect(fromMenu.suggestedFilename()).toBe('DOC-001-v3.pdf');
});

test('comparación de versiones: filas añadidas, eliminadas y modificadas resaltadas (data-diff, <ins> y <del>)', async ({ page }) => {
  await openAs(page, 'consultant', '/documents/DOC-001', { tenant: TENANT });
  await expect(page.getByLabel('Desde')).toHaveValue('2');
  await expect(page.getByLabel('Hasta')).toHaveValue('3');

  // v2 → v3: se elimina una línea, se modifica otra y se añaden tres
  const table = page.getByRole('table', { name: 'Comparar versiones' });
  await expect(page.getByTestId('document-diff-stats')).toHaveText('3 añadidas · 1 eliminadas · 1 modificadas');
  await expect(table.locator('tr[data-diff="added"]')).toHaveCount(3);
  await expect(table.locator('tr[data-diff="removed"]')).toHaveCount(1);
  await expect(table.locator('tr[data-diff="changed"]')).toHaveCount(1);
  await expect(table.getByRole('columnheader')).toHaveText(['Versión 2', 'Versión 3']);

  const changed = table.getByRole('row').filter({ has: page.locator('ins') }).filter({ has: page.locator('del') });
  await expect(changed).toHaveCount(1);
  await expect(changed.locator('del')).toHaveText('Todas las pruebas deben terminar en estado superado.');
  await expect(changed.locator('ins')).toHaveText('Al menos el 95 % de las pruebas debe terminar en estado superado.');
  const removed = table.locator('tr[data-diff="removed"]');
  await expect(removed.locator('del')).toHaveText('Se excluyen los equipos de apoyo en tierra y los simuladores.');
  await expect(removed.locator('ins')).toHaveCount(0);
  await expect(table.locator('tr[data-diff="added"]').getByText('5. Anexos')).toBeVisible();
  // El resaltado es real (no solo un atributo)
  await expect(table.locator('tr[data-diff="added"]').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(table.locator('tr[data-diff="same"]').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  // v1 → v3 y la misma versión en ambos lados
  await page.getByLabel('Desde').selectOption('1');
  await expect(page.getByTestId('document-diff-stats')).toHaveText('4 añadidas · 1 eliminadas · 1 modificadas');
  await page.getByLabel('Hasta').selectOption('1');
  await expect(page.getByText('Elige dos versiones distintas para compararlas.')).toBeVisible();
  await expect(table).toHaveCount(0);

  // Un documento con una sola versión no se puede comparar
  await page.goto('/documents/DOC-002');
  await expect(page.getByTestId('document-compare-one')).toHaveText('Este documento solo tiene una versión: no hay nada que comparar.');
  await expect(page.getByLabel('Desde')).toHaveCount(0);
});

test('permisos sobre restringidos: 403 en la ficha y en el visor del consultor; page.route() simula 403 y 500', async ({ page }) => {
  await openAs(page, 'consultant', '/documents/DOC-003', { tenant: TENANT });
  const forbidden = page.getByTestId('document-forbidden');
  await expect(forbidden).toContainText('No tienes permiso para ver este documento');
  await expect(forbidden).toContainText('403');
  await expect(page.locator('iframe[title="Visor de documento"]')).toHaveCount(0);

  await page.goto('/documents/DOC-003/view?version=2');
  const error = page.getByTestId('viewer-error');
  await expect(error).toHaveAttribute('data-status', '403');
  await expect(error).toContainText('No tienes permiso para ver este documento');

  // Un documento público devuelve 403/500 si el servidor lo dice (interceptación de red)
  await page.route('**/api/documents/DOC-001', (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ statusCode: 403, error: 'Forbidden', message: 'forbidden' }) }));
  await page.goto('/documents/DOC-001');
  await expect(page.getByTestId('document-forbidden')).toBeVisible();
  await page.unroute('**/api/documents/DOC-001');

  await page.route('**/api/documents/DOC-001', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'boom' }) }));
  await page.goto('/documents/DOC-001');
  await expect(page.getByRole('alert').filter({ hasText: 'Ha ocurrido un error inesperado' })).toContainText('500');
  await page.unroute('**/api/documents/DOC-001');

  await page.goto('/documents/DOC-999');
  await expect(page.getByTestId('document-not-found')).toContainText('No se encontró el documento');
});

test('publicar versión: solo admin y gestor; el diálogo valida, publica la v2 y la ficha se actualiza', async ({ page }) => {
  // El consultor y el auditor ven el botón deshabilitado con su motivo
  for (const role of ['consultant', 'auditor'] as const) {
    await openAs(page, role, '/documents/DOC-002', { tenant: TENANT });
    const disabled = page.getByRole('button', { name: 'Publicar nueva versión' });
    await expect(disabled).toBeDisabled();
    await expect(disabled).toHaveAttribute('title', 'Solo admin y gestor pueden publicar versiones');
  }

  await openAs(page, 'program_manager', '/documents/DOC-002', { tenant: TENANT });
  await expect(page.getByTestId('document-versions').getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: 'Publicar nueva versión' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva versión de DOC-002' });
  const text = dialog.getByLabel('Contenido (una línea por fila)');
  await expect(text).toHaveValue(/^Especificación técnica PRG-001\n/); // parte del contenido de la última versión
  await expect(text).toBeFocused();

  // Validación: contenido vacío, demasiadas líneas y línea demasiado larga
  await text.fill('');
  await dialog.getByRole('button', { name: 'Publicar versión' }).click();
  await expect(page.getByTestId('document-publish-text-error')).toHaveText('El contenido no puede estar vacío');
  await text.fill(Array.from({ length: 81 }, (_, i) => `línea ${i}`).join('\n'));
  await dialog.getByRole('button', { name: 'Publicar versión' }).click();
  await expect(page.getByTestId('document-publish-text-error')).toHaveText('Máximo 80 líneas');
  await text.fill(`corta\n${'x'.repeat(201)}`);
  await dialog.getByRole('button', { name: 'Publicar versión' }).click();
  await expect(page.getByTestId('document-publish-text-error')).toHaveText('Cada línea admite hasta 200 caracteres');

  await text.fill('Especificación técnica PRG-001\n\n1. Objeto\nTexto nuevo de la versión dos.\n\n2. Anexos\nAnexo B: glosario.');
  await dialog.getByLabel('Nota de cambios').fill('Se reescribe el objeto y se añade un glosario');
  await dialog.getByRole('button', { name: 'Publicar versión' }).click();

  const toast = page.getByTestId('toast-ok');
  await expect(toast).toContainText('Versión publicada');
  await expect(toast).toContainText('DOC-002 → versión 2');
  await expect(dialog).toBeHidden();

  // La ficha muestra la versión nueva: selector, iframe, historial y comparación
  await expect(page.getByLabel('Versión')).toHaveValue('2');
  await expect(page.getByLabel('Versión').locator('option').first()).toHaveText('Versión 2 (última)');
  await expect(viewer(page).getByTestId('viewer-version')).toHaveText('Versión 2');
  await expect(viewer(page).getByText('Texto nuevo de la versión dos.')).toBeVisible();
  const history = page.getByTestId('document-versions').getByRole('listitem');
  await expect(history).toHaveCount(2);
  await expect(history.first()).toContainText('Se reescribe el objeto y se añade un glosario');
  await expect(history.first()).toContainText('por Javier Ortega');
  await expect(page.getByLabel('Desde')).toHaveValue('1');
  await expect(page.getByLabel('Hasta')).toHaveValue('2');
  await expect(page.getByTestId('document-diff-stats')).toContainText('añadidas');

  // La lista refleja la nueva versión
  await page.goto('/documents');
  await expect(page.getByTestId('document-row-DOC-002')).toContainText('v2');
});

test('carga lenta (skeleton + aria-busy), error 503 con reintento y tarjetas en móvil (390 px)', async ({ page }) => {
  await openAs(page, 'consultant', '/programs', { tenant: TENANT });

  await page.route(LIST_URL, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue().catch(() => undefined);
  });
  await page.goto('/documents');
  await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
  await expect(page.getByTestId('documents-table')).toHaveAttribute('aria-busy', 'true');
  await expect(rows(page)).toHaveCount(8, { timeout: 8000 });
  await page.unroute(LIST_URL);

  await page.route(LIST_URL, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
  await page.goto('/documents');
  const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los documentos' });
  await expect(alert).toContainText('503');
  await page.unroute(LIST_URL);
  await alert.getByRole('button', { name: 'Reintentar' }).click();
  await expect(rows(page)).toHaveCount(8);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/documents');
  await expect(rows(page)).toHaveCount(8);
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(page.getByTestId('document-row-DOC-001')).toContainText('Plan de verificación PRG-001');
});
