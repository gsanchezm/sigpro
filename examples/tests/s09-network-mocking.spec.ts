import { expect, test } from '../fixtures';
import { DocumentsPage } from '../pages/DocumentsPage';
import { TENANT } from '../support/env';

// SESIÓN 9 · Interceptación de red, `page.route`, mocks
// Ejercicio tipo: simular 403 y 500 y verificar los mensajes de error.
//
// Qué se practica:
//  - `page.route` + `route.fulfill`: 403, 500 y 503 (con reintento) en la ficha de un documento y en la lista.
//  - `route.abort`: la petición nunca llega al servidor.
//  - Una respuesta lenta, retenida y liberada a voluntad (sin esperas fijas): skeleton y `aria-busy`.
//  - `route.fetch()` + `route.fulfill({ response, json })`: pedir la respuesta REAL y cambiar solo una parte.
//  - `page.waitForResponse` y `page.waitForRequest`: esperar a la petición y a la respuesta, no al tiempo.
//  - El 403 REAL del consultor sobre un documento restringido, frente a un 403 simulado.
//
// TODO es de lectura: ningún test publica versiones ni escribe datos. Puede correr junto a cualquier otro spec.

const DOC = 'DOC-001'; // público: visible para todos los roles
const DETAIL = `**/api/documents/${DOC}`; // solo la ficha; no atrapa /content ni /view
const LIST = /\/api\/documents(\?.*)?$/; // la lista, con o sin filtros en la query

/**
 * Respuesta de error «a mano»: el mismo cuerpo que daría la API, pero SIN `traceId`.
 * Ese identificador lo añade el filtro de excepciones del servidor, así que es la forma de distinguir un error real de uno simulado.
 */
const problem = (status: number, error: string) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, error, message: 'simulado con page.route' }),
});

test.describe('ficha de un documento', () => {
  test('un 403 simulado muestra el aviso de permiso con su traza, y no pinta el visor', async ({ page }) => {
    await page.route(DETAIL, (route) => route.fulfill(problem(403, 'Forbidden')));

    await page.goto(`/documents/${DOC}`);
    const forbidden = page.getByTestId('document-forbidden');
    await expect(forbidden).toContainText('No tienes permiso para ver este documento');
    await expect(forbidden).toContainText('GET /api/documents/DOC-001 → 403 Forbidden');
    await expect(forbidden).not.toContainText('· trace'); // el mock no trae traceId
    await expect(page.locator('iframe[title="Visor de documento"]')).toHaveCount(0);
  });

  test('un 500 simulado muestra el error genérico con la traza, aunque el testid sea el de «no encontrado»', async ({ page }) => {
    await page.route(DETAIL, (route) => route.fulfill(problem(500, 'Internal Server Error')));

    await page.goto(`/documents/${DOC}`);
    // Los errores que no son 403 se pintan con el mismo contenedor que el 404: se localizan por rol y texto, no por testid
    const alert = page.getByRole('alert').filter({ hasText: 'Ha ocurrido un error inesperado' });
    await expect(alert).toContainText('GET /api/documents/DOC-001 → 500 Internal Server Error');
    await expect(page.getByTestId('document-forbidden')).toHaveCount(0);
  });
});

test.describe('lista de documentos', () => {
  test('un 403 y un 500 simulados se ven como error con su traza, y la tabla no pinta filas', async ({ page }) => {
    const documents = new DocumentsPage(page);

    // Dos respuestas de error seguidas: el mismo aviso, con el código que venga en cada caso
    for (const [status, error] of [
      [403, 'Forbidden'],
      [500, 'Internal Server Error'],
    ] as const) {
      await page.route(LIST, (route) => route.fulfill(problem(status, error)));
      await page.goto('/documents');
      await expect(documents.errorAlert).toContainText(`GET /api/documents → ${status} ${error}`);
      await expect(documents.rows).toHaveCount(0);
      await page.unroute(LIST);
    }
  });

  test('un 503 con reintento: la primera respuesta falla y, al pulsar «Reintentar», la petición llega al servidor real', async ({ page }) => {
    const documents = new DocumentsPage(page);
    let failing = true; // mientras sea true, el «servidor» responde 503; después, pasa la petición al servidor real

    await page.route(LIST, (route) => (failing ? route.fulfill(problem(503, 'Service Unavailable')) : route.continue()));
    await page.goto('/documents');
    await expect(documents.errorAlert).toContainText('GET /api/documents → 503 Service Unavailable');

    failing = false; // el servidor «se recupera»
    await documents.errorRetry.click();
    await expect(documents.row(DOC)).toBeVisible();
    await expect(documents.errorAlert).toHaveCount(0);
  });

  test('route.abort: si la petición nunca llega, la traza dice «network error» (no hay código HTTP)', async ({ page }) => {
    const documents = new DocumentsPage(page);
    await page.route(LIST, (route) => route.abort('failed'));

    await page.goto('/documents');
    await expect(documents.errorAlert).toContainText('No se pudieron cargar los documentos');
    await expect(documents.errorAlert).toContainText('GET /api/documents → network error');
  });

  test('respuesta lenta: mientras llega se ven el skeleton y aria-busy; al liberarla, aparecen las filas', async ({ page }) => {
    const documents = new DocumentsPage(page);

    // Pausa controlada: la petición se queda esperando hasta que el test decide soltarla. Así no hay esperas fijas
    let openTheGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openTheGate = () => resolve();
    });
    await page.route(LIST, async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto('/documents');
    await expect(documents.table).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByTestId('skeleton-row').first()).toBeVisible();
    await expect(documents.rows).toHaveCount(0);

    openTheGate();
    await documents.waitUntilLoaded();
    await expect(documents.row(DOC)).toBeVisible();
  });

  test('route.fetch() + fulfill: la respuesta es la real con un solo campo cambiado, y el servidor no se entera', async ({ page }) => {
    const documents = new DocumentsPage(page);
    const MOCK_TITLE = 'Título cambiado por el mock';

    await page.route(LIST, async (route) => {
      // Pide la respuesta REAL (con su Authorization y su tenant) y la modifica antes de devolverla
      const response = await route.fetch();
      const body = (await response.json()) as { items: { id: string; title: string }[]; hiddenCount: number };
      const items = body.items.map((item) => (item.id === DOC ? { ...item, title: MOCK_TITLE } : item));
      await route.fulfill({ response, json: { ...body, items } });
    });

    await page.goto('/documents');
    await expect(documents.row(DOC)).toContainText(MOCK_TITLE);

    // Sin el mock, el título es el del servidor: el cambio vivía solo en la respuesta interceptada
    await page.unroute(LIST);
    await page.reload();
    await documents.waitUntilLoaded();
    await expect(documents.row(DOC)).toBeVisible();
    await expect(documents.row(DOC)).not.toContainText(MOCK_TITLE);
  });

  test('waitForRequest y waitForResponse: la petición lleva tu sesión y tu tenant; un filtro espera a su respuesta', async ({ page }) => {
    const documents = new DocumentsPage(page);

    // Esperamos a la petición Y a la respuesta del mismo arranque, sin fijar un tiempo
    const [outgoing, response] = await Promise.all([
      page.waitForRequest((request) => LIST.test(request.url()) && request.method() === 'GET'),
      page.waitForResponse((res) => LIST.test(res.url()) && res.status() === 200),
      page.goto('/documents'),
    ]);
    expect(outgoing.headers()['authorization']).toMatch(/^Bearer /);
    expect(outgoing.headers()['x-tenant']).toBe(TENANT);
    const body = (await response.json()) as { items: unknown[] };
    await documents.waitUntilLoaded();
    await expect(documents.rows).toHaveCount(body.items.length);

    // Cambiar el filtro de programa dispara una petición nueva: esperamos a que llegue su respuesta
    const filtered = page.waitForResponse((res) => /\/api\/documents\?.*program=PRG-001/.test(res.url()) && res.status() === 200);
    await Promise.all([filtered, documents.programFilter.selectOption('PRG-001')]);
    await documents.waitUntilLoaded();
    await expect(documents.row(DOC)).toBeVisible();
  });
});

test.describe('403 real frente a 403 simulado', () => {
  test('el consultor recibe un 403 del servidor sobre un restringido; el simulado no trae la misma traza', async ({ consultantPage, page }) => {
    // REAL: el consultor pide DOC-003 (restringido) y la API responde 403. Escuchamos la respuesta ANTES de navegar
    const real = consultantPage.waitForResponse((res) => res.url().endsWith('/api/documents/DOC-003'));
    await consultantPage.goto('/documents/DOC-003');
    const response = await real;
    expect(response.status()).toBe(403);
    expect(((await response.json()) as { code?: string }).code).toBe('forbidden');
    // El servidor añade un traceId a cada error: la UI lo muestra al final de la traza
    await expect(consultantPage.getByTestId('document-forbidden')).toContainText(/· trace \S+/);

    // SIMULADO: el mismo 403 escrito por el test, sobre un documento que el admin sí ve
    await page.route(DETAIL, (route) => route.fulfill(problem(403, 'Forbidden')));
    await page.goto(`/documents/${DOC}`);
    const mocked = page.getByTestId('document-forbidden');
    await expect(mocked).toContainText('GET /api/documents/DOC-001 → 403 Forbidden');
    await expect(mocked).not.toContainText('· trace');
  });
});
