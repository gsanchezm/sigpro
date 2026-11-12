import { expect, test, type Page, type Route } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { chaosOff } from '../../support/admin';
import { openAs, resetTenant, type RoleName } from '../../support/auth';

// Documentos en el móvil (paridad funcional con la web): publicar una versión (contenido en líneas y nota, solo admin y
// gestor), comparar dos versiones (diff alineado, apilado para 390 px) y descargar el PDF de una versión. Mismos textos, ids
// y límites que `documents.spec.ts` de la web. Cada prueba parte del seed (`resetTenant` antes de cada una). Tenant propio
// (alumno24). Locators por rol y nombre primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo.
//
// Seed: DOC-001…012; restringidos DOC-003, 006, 009 y 012; versiones 3,1,2,3,1,2,3,1,2,3,1,2 (DOC-001 v3, DOC-002 v1,
// DOC-003 v2, DOC-004 v3). La descarga en la web es un `<a download>`: se atiende con el evento `download` del navegador.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await chaosOff(request, TENANT);
});

test.beforeEach(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const open = async (page: Page, role: RoleName, path: string) => {
  await openAs(page, role, path, { tenant: TENANT });
};
const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });
const toast = (page: Page, tone: 'ok' | 'info' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const table = (page: Page) => page.getByRole('table', { name: 'Comparar versiones', exact: true });
const publishButton = (page: Page) => page.getByRole('button', { name: 'Publicar nueva versión', exact: true });
const downloadButton = (page: Page) => page.getByRole('button', { name: 'Descargar PDF', exact: true });

const failWith = (status: number, error: string, body: Record<string, unknown> = {}) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ statusCode: status, error, message: error.toLowerCase(), ...body }) });

/** Elige una versión en un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: 'Desde' | 'Hasta', option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await dialog(page, field).getByRole('radio', { name: option, exact: true }).click();
  await expect(dialog(page, field)).toBeHidden();
};

/** Pulsa «Descargar PDF» y devuelve el archivo que entregó el navegador: nombre y contenido. */
const downloaded = async (page: Page, trigger: () => Promise<void>) => {
  const [file] = await Promise.all([page.waitForEvent('download'), trigger()]);
  const bytes = await readFile(await file.path());
  return { name: file.suggestedFilename(), head: bytes.subarray(0, 5).toString('latin1'), text: bytes.toString('latin1') };
};

/** Cuerpo del POST que publica una versión. */
const publishBody = (page: Page, id: string) =>
  page.waitForRequest((request) => request.method() === 'POST' && request.url().includes(`/api/documents/${id}/versions`)).then((request) => request.postDataJSON() as unknown);

const NEW_TEXT = 'Especificación técnica PRG-001\n\n1. Objeto\nTexto nuevo de la versión dos.\n\n2. Anexos\nAnexo B: glosario.';

test.describe('Móvil · documentos: publicar versión', () => {
  test('solo admin y gestor: el consultor y el auditor ven el botón deshabilitado con su motivo visible; el admin y el gestor, no', async ({ page }) => {
    for (const role of ['consultant', 'auditor'] as const) {
      await open(page, role, '/documents/DOC-002');
      await expect(publishButton(page)).toBeDisabled();
      await expect(publishButton(page)).toHaveAttribute('data-reason', 'Solo admin y gestor pueden publicar versiones');
      await expect(page.getByTestId('document-publish-reason')).toHaveText('Solo admin y gestor pueden publicar versiones');
    }
    for (const role of ['admin', 'program_manager'] as const) {
      await open(page, role, '/documents/DOC-002');
      await expect(publishButton(page)).toBeEnabled();
      await expect(page.getByTestId('document-publish-reason')).toHaveCount(0);
    }
  });

  test('el diálogo parte del contenido de la última versión, valida contenido y nota y publica la v2: la ficha y la lista se actualizan', async ({ page }) => {
    await open(page, 'program_manager', '/documents/DOC-002');
    await expect(page.getByRole('radio', { name: /^Versión/ })).toHaveCount(1);
    await publishButton(page).click();
    const form = dialog(page, 'Nueva versión de DOC-002');
    await expect(form).toBeVisible();
    const text = form.getByLabel('Contenido (una línea por fila)', { exact: true });
    await expect(text).toHaveValue(/^Especificación técnica PRG-001\n/); // parte del contenido de la última versión
    await expect(form.getByLabel('Nota de cambios', { exact: true })).toHaveAttribute('placeholder', 'Qué cambia en esta versión…');
    expect(await noHorizontalOverflow(page)).toBe(true);

    // Validación: contenido vacío, demasiadas líneas y línea demasiado larga; el aviso desaparece al corregir
    const error = form.getByTestId('document-publish-text-error');
    await text.fill('');
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(error).toHaveText('El contenido no puede estar vacío');
    await text.fill(Array.from({ length: 81 }, (_, index) => `línea ${index}`).join('\n'));
    await expect(error).toBeHidden();
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(error).toHaveText('Máximo 80 líneas');
    await text.fill(`corta\n${'x'.repeat(201)}`);
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(error).toHaveText('Cada línea admite hasta 200 caracteres');
    await form.getByLabel('Nota de cambios', { exact: true }).fill('n'.repeat(201));
    await text.fill(NEW_TEXT);
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(form.getByText('La nota admite hasta 200 caracteres', { exact: true })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Versión/ })).toHaveCount(1); // nada se envió

    await form.getByLabel('Nota de cambios', { exact: true }).fill('Se reescribe el objeto y se añade un glosario');
    const body = publishBody(page, 'DOC-002');
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    expect(await body).toEqual({
      lines: ['Especificación técnica PRG-001', '', '1. Objeto', 'Texto nuevo de la versión dos.', '', '2. Anexos', 'Anexo B: glosario.'],
      note: 'Se reescribe el objeto y se añade un glosario',
    });

    await expect(toast(page, 'ok', 'Versión publicada')).toContainText('DOC-002 → versión 2');
    await expect(form).toBeHidden();
    // La ficha muestra la versión nueva: chip, contenido, autor y nota, y la comparación «anterior → última»
    await expect(page.getByRole('radio', { name: 'Versión 2 · última' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: /^Versión/ })).toHaveCount(2);
    await expect(page.getByTestId('viewer-page-1')).toContainText('Texto nuevo de la versión dos.');
    await expect(page.getByTestId('document-version-note')).toHaveText('Se reescribe el objeto y se añade un glosario');
    await expect(page.getByTestId('document-version-meta')).toContainText('por Javier Ortega');
    await expect(page.getByRole('combobox', { name: 'Desde', exact: true })).toContainText('Versión 1');
    await expect(page.getByRole('combobox', { name: 'Hasta', exact: true })).toContainText('Versión 2');
    await expect(page.getByTestId('document-diff-stats')).toContainText('añadidas');

    // La lista refleja la nueva versión
    await page.goto('/documents');
    await expect(page.getByTestId('document-row-DOC-002')).toContainText('v2');
  });

  test('errores del servidor: un 422 se pinta bajo el campo; un 503 muestra la traza; el diálogo queda abierto y Cancelar no publica nada', async ({ page }) => {
    await open(page, 'admin', '/documents/DOC-002');
    await publishButton(page).click();
    const form = dialog(page, 'Nueva versión de DOC-002');
    await expect(form.getByLabel('Contenido (una línea por fila)', { exact: true })).toHaveValue(/^Especificación técnica/);

    const versions = (url: URL) => url.pathname === '/api/documents/DOC-002/versions';
    await page.route(versions, failWith(422, 'Unprocessable Entity', { errors: { lines: 'linesMax' } }));
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(form.getByTestId('document-publish-text-error')).toHaveText('Máximo 80 líneas');
    await expect(form.getByTestId('document-publish-server-error')).toHaveText('Máximo 80 líneas');
    await page.unroute(versions);

    await page.route(versions, failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }));
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    await expect(form.getByTestId('document-publish-server-error')).toHaveText('POST /api/documents/DOC-002/versions → 503 Service Unavailable · trace 7f3a-c21d');
    await expect(form).toBeVisible();
    await page.unroute(versions);

    await form.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(form).toBeHidden();
    await expect(page.getByRole('radio', { name: /^Versión/ })).toHaveCount(1);
  });

  test('si el contenido anterior no llega, el campo queda vacío y editable: se puede escribir desde cero y publicar', async ({ page }) => {
    await open(page, 'admin', '/documents/DOC-002');
    // El visor pide el contenido con `?version=`; el diálogo, sin versión: solo falla la petición del diálogo
    await page.route(
      (url) => url.pathname === '/api/documents/DOC-002/content' && !url.searchParams.has('version'),
      failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }),
    );
    await publishButton(page).click();
    const form = dialog(page, 'Nueva versión de DOC-002');
    const text = form.getByLabel('Contenido (una línea por fila)', { exact: true });
    await expect(form.getByTestId('document-publish-loading')).toBeHidden();
    await expect(text).toHaveValue('');
    await text.fill('Contenido escrito desde cero\nSegunda línea');
    const body = publishBody(page, 'DOC-002');
    await form.getByRole('button', { name: 'Publicar versión', exact: true }).click();
    expect(await body).toEqual({ lines: ['Contenido escrito desde cero', 'Segunda línea'], note: '' });
    await expect(toast(page, 'ok', 'Versión publicada')).toBeVisible();
  });
});

test.describe('Móvil · documentos: comparar versiones', () => {
  test('v2 → v3 por defecto: filas añadidas, eliminadas y modificadas con su `data-diff`, línea antigua tachada y resaltado real', async ({ page }) => {
    await open(page, 'consultant', '/documents/DOC-001');
    await expect(page.getByRole('combobox', { name: 'Desde', exact: true })).toContainText('Versión 2');
    await expect(page.getByRole('combobox', { name: 'Hasta', exact: true })).toContainText('Versión 3');

    await expect(page.getByTestId('document-diff-stats')).toHaveText('3 añadidas · 1 eliminadas · 1 modificadas');
    await expect(table(page).locator('[data-diff="added"]')).toHaveCount(3);
    await expect(table(page).locator('[data-diff="removed"]')).toHaveCount(1);
    await expect(table(page).locator('[data-diff="changed"]')).toHaveCount(1);
    await expect(table(page).getByRole('columnheader')).toHaveText(['Versión 2', 'Versión 3']);

    const changed = table(page).locator('[data-diff="changed"]');
    await expect(changed).toContainText('Modificada');
    await expect(changed.getByTestId(/^document-diff-old-\d+$/)).toHaveText('Todas las pruebas deben terminar en estado superado.');
    await expect(changed.getByTestId(/^document-diff-new-\d+$/)).toHaveText('Al menos el 95 % de las pruebas debe terminar en estado superado.');
    await expect(changed.getByTestId(/^document-diff-old-\d+$/)).toHaveCSS('text-decoration-line', 'line-through');
    await expect(changed.getByTestId(/^document-diff-new-\d+$/)).not.toHaveCSS('text-decoration-line', 'line-through');

    const removed = table(page).locator('[data-diff="removed"]');
    await expect(removed.getByTestId(/^document-diff-old-\d+$/)).toHaveText('Se excluyen los equipos de apoyo en tierra y los simuladores.');
    await expect(removed.getByTestId(/^document-diff-new-\d+$/)).toHaveCount(0);
    await expect(table(page).locator('[data-diff="added"]').getByText('5. Anexos')).toBeVisible();
    // El resaltado es real (no solo un atributo): las filas iguales no tienen fondo
    await expect(table(page).locator('[data-diff="added"]').first()).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(table(page).locator('[data-diff="same"]').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('cambiar «Desde» recalcula; elegir la misma versión en los dos lados no pide nada y avisa; un documento con una versión no se compara', async ({ page }) => {
    const compares: string[] = [];
    page.on('request', (request) => request.url().includes('/compare') && compares.push(request.url()));
    await open(page, 'consultant', '/documents/DOC-001');
    await expect(page.getByTestId('document-diff-stats')).toHaveText('3 añadidas · 1 eliminadas · 1 modificadas');
    expect(compares).toHaveLength(1);
    expect(new URL(compares[0] ?? '').searchParams.get('from')).toBe('2');
    expect(new URL(compares[0] ?? '').searchParams.get('to')).toBe('3');

    await choose(page, 'Desde', 'Versión 1');
    await expect(page.getByTestId('document-diff-stats')).toHaveText('4 añadidas · 1 eliminadas · 1 modificadas');
    await expect(table(page).getByRole('columnheader')).toHaveText(['Versión 1', 'Versión 3']);
    expect(compares).toHaveLength(2);

    await choose(page, 'Hasta', 'Versión 1');
    await expect(page.getByTestId('document-compare-same')).toHaveText('Elige dos versiones distintas para compararlas.');
    await expect(table(page)).toHaveCount(0);
    await expect(page.getByTestId('document-diff-stats')).toHaveCount(0);
    expect(compares).toHaveLength(2); // dos versiones iguales no se piden

    await open(page, 'consultant', '/documents/DOC-002');
    await expect(page.getByTestId('document-compare-one')).toHaveText('Este documento solo tiene una versión: no hay nada que comparar.');
    await expect(page.getByRole('combobox', { name: 'Desde', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Hasta', exact: true })).toHaveCount(0);
  });

  test('un fallo al calcular la comparación se muestra con su traza y el resto de la ficha sigue funcionando', async ({ page }) => {
    await page.route((url) => url.pathname === '/api/documents/DOC-001/compare', failWith(503, 'Service Unavailable', { traceId: '7f3a-c21d' }));
    await open(page, 'admin', '/documents/DOC-001');
    await expect(page.getByTestId('document-compare-error')).toContainText('→ 503 Service Unavailable · trace 7f3a-c21d');
    await expect(table(page)).toHaveCount(0);
    await expect(page.getByTestId('viewer-page-1')).toBeVisible();
  });

  test('en 390 px las filas apiladas no desbordan la pantalla', async ({ page }) => {
    await open(page, 'admin', '/documents/DOC-001');
    await expect(table(page)).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    const cells = page.getByTestId(/^document-diff-(old|new|same)-\d+$/);
    expect(await cells.count()).toBeGreaterThan(5);
    const rights = await cells.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
    expect(Math.max(...rights)).toBeLessThanOrEqual(390);
  });
});

test.describe('Móvil · documentos: descargar', () => {
  test('el PDF de la versión elegida llega con su nombre y su contenido (la última por defecto, la 1 al elegirla); toast «Descarga iniciada»', async ({ page }) => {
    await open(page, 'consultant', '/documents/DOC-004');
    const latest = await downloaded(page, () => downloadButton(page).click());
    expect(latest.name).toBe('DOC-004-v3.pdf');
    expect(latest.head).toBe('%PDF-');
    expect(latest.text).toContain('Especificaci\xf3n t\xe9cnica PRG-002');
    expect(latest.text).toContain('Anexo A: matriz de trazabilidad.');
    await expect(toast(page, 'info', 'Descarga iniciada')).toContainText('DOC-004-v3.pdf');

    await page.getByRole('radio', { name: 'Versión 1', exact: true }).click();
    const first = await downloaded(page, () => downloadButton(page).click());
    expect(first.name).toBe('DOC-004-v1.pdf');
    expect(first.text).not.toContain('Anexo A');
  });

  test('desde la lista: el menú ⋯ de la tarjeta ofrece «Ver documento» y «Descargar PDF» (la última versión)', async ({ page }) => {
    await open(page, 'consultant', '/documents');
    await page.getByRole('button', { name: 'Acciones para DOC-001', exact: true }).click();
    const menu = dialog(page, 'Acciones para DOC-001');
    await expect(menu.getByRole('button')).toHaveText(['Ver documento', 'Descargar PDF', 'Cerrar']);
    const file = await downloaded(page, () => menu.getByRole('button', { name: 'Descargar PDF', exact: true }).click());
    expect(file.name).toBe('DOC-001-v3.pdf');
    expect(file.head).toBe('%PDF-');
    await expect(menu).toBeHidden();
    await expect(toast(page, 'info', 'Descarga iniciada')).toContainText('DOC-001-v3.pdf');

    await page.getByRole('button', { name: 'Acciones para DOC-001', exact: true }).click();
    await dialog(page, 'Acciones para DOC-001').getByRole('button', { name: 'Ver documento', exact: true }).click();
    await expect(page).toHaveURL(/\/documents\/DOC-001$/);
    await expect(page.getByTestId('document-detail')).toBeVisible();
  });

  test('un fallo de la descarga (500) avisa con la traza y no deja nada a medias', async ({ page }) => {
    await open(page, 'admin', '/documents/DOC-004');
    await page.route((url) => url.pathname === '/api/documents/DOC-004/download', failWith(500, 'Internal Server Error', { traceId: '5b2d-91ce' }));
    await downloadButton(page).click();
    await expect(toast(page, 'danger', 'No se pudo descargar el documento')).toContainText('→ 500 Internal Server Error · trace 5b2d-91ce');
    await expect(downloadButton(page)).toBeEnabled(); // el botón vuelve a estar disponible
  });
});

test.describe('Móvil · documentos: restringidos', () => {
  test('el admin compara y descarga un restringido; el auditor lo ve pero no publica; el consultor recibe 403 y ninguna acción', async ({ page }) => {
    await open(page, 'admin', '/documents/DOC-003');
    await expect(page.getByTestId('document-class-badge')).toHaveAttribute('data-state', 'restricted');
    await expect(page.getByTestId('document-diff-stats')).toContainText('añadidas'); // v1 → v2
    const file = await downloaded(page, () => downloadButton(page).click());
    expect(file.name).toBe('DOC-003-v2.pdf');

    await open(page, 'auditor', '/documents/DOC-003');
    await expect(page.getByTestId('document-detail')).toBeVisible();
    await expect(publishButton(page)).toBeDisabled();
    await expect(downloadButton(page)).toBeEnabled();

    await open(page, 'consultant', '/documents/DOC-003');
    await expect(page.getByTestId('document-forbidden')).toContainText('No tienes permiso para ver este documento');
    await expect(downloadButton(page)).toHaveCount(0);
    await expect(publishButton(page)).toHaveCount(0);
    await expect(page.getByTestId('document-compare')).toHaveCount(0);
  });
});
