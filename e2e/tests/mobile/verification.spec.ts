import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { chaosOff } from '../../support/admin';
import { API_URL, loginByApi, openAs, resetTenant, type RoleName } from '../../support/auth';
import { PNG_BUFFER, bigPng, fakePng, jpeg, pdf, png, type UploadFile } from '../../support/files';

// Verificación en el móvil (paridad funcional con la web): lista de casos de prueba con filtros, orden y «Cargar más»; menú ⋯
// de cada tarjeta, selección múltiple e informe PDF; detalle con pasos, requisitos, historial y evidencias (miniaturas
// que se piden con el Bearer y se amplían en una hoja); y «Registrar ejecución» con validación, permisos y subida multipart
// de imágenes y PDF. Cada prueba parte de los datos del seed (`resetTenant` antes de cada una). Tenant propio (alumno24).
// Locators por rol y nombre primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo.
//
// El selector de imágenes de Expo en web crea un `<input type=file>` y lo pulsa: se atiende con el evento `filechooser`.
// El informe y las descargas se abren con `Linking.openURL(blob:)` → `window.open`: se intercepta y se lee el blob.

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

const open = (page: Page, role: RoleName = 'consultant', path = '/verification') => openAs(page, role, path, { tenant: TENANT });
/** Tarjetas de la lista: solo `testcase-row-TC-…`, no sus subelementos (`testcase-row-menu-TC-…`). */
const rows = (page: Page) => page.getByTestId(/^testcase-row-TC-\d+$/);
const codes = (page: Page) => rows(page).evaluateAll((cards) => cards.map((card) => (card.getAttribute('data-testid') ?? '').replace('testcase-row-', '')));
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const rowMenu = (page: Page, code: string) => page.getByRole('dialog', { name: `Acciones para ${code}`, exact: true });

interface Case {
  readonly code: string;
  readonly programCode: string;
  readonly runCount: number;
  readonly lastResult: 'pass' | 'fail' | 'blocked' | null;
}

const authHeaders = async (request: APIRequestContext, role: RoleName) => ({ Authorization: `Bearer ${(await loginByApi(request, role, TENANT)).accessToken}`, 'x-tenant': TENANT });

/** Los casos del seed leídos por API: sirven para contrastar lo que pinta la UI sin fijar a mano cada resultado. */
const allCases = async (request: APIRequestContext): Promise<Case[]> => {
  const response = await request.get(`${API_URL}/test-cases?pageSize=100`, { headers: await authHeaders(request, 'admin') });
  return ((await response.json()) as { items: Case[] }).items;
};

interface Evidence {
  readonly id: string;
  readonly filename: string;
  readonly mimeType: string;
  readonly size: number;
}
interface Run {
  readonly id: string;
  readonly result: string;
  readonly notes: string;
  readonly evidences: Evidence[];
}

const caseDetail = async (request: APIRequestContext, code: string): Promise<{ runs: Run[] }> => {
  const response = await request.get(`${API_URL}/test-cases/${code}`, { headers: await authHeaders(request, 'admin') });
  return (await response.json()) as { runs: Run[] };
};

/** `Linking.openURL` en web es `window.open(url, '_blank', 'noopener')`: se guarda la URL en lugar de abrir una pestaña. */
const stubOpen = (page: Page) =>
  page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = ((url?: string | URL) => {
      opened.push(String(url));
      return null;
    }) as typeof window.open;
  });
const openedUrls = (page: Page) => page.evaluate(() => (window as unknown as { __opened?: string[] }).__opened ?? []);
/** Cabecera y tamaño de lo que hay detrás de un `blob:` abierto (el informe o la evidencia que se entregó). */
const blobInfo = (page: Page, url: string) =>
  page.evaluate(async (blobUrl) => {
    const blob = await (await fetch(blobUrl)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return { head: String.fromCharCode(...bytes.slice(0, 8)), size: bytes.length, type: blob.type };
  }, url);

/** Elige un valor en un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await page.getByRole('dialog', { name: field, exact: true }).getByRole('radio', { name: option, exact: true }).click();
  await expect(page.getByRole('dialog', { name: field, exact: true })).toBeHidden();
};

/** Adjunta archivos con el selector de Expo: pulsa el botón y atiende el selector de archivos del navegador. */
const attach = async (page: Page, button: string, files: UploadFile | UploadFile[]) => {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: button, exact: true }).click()]);
  await chooser.setFiles(files);
};

const gif = (name = 'animado.gif'): UploadFile => ({ name, mimeType: 'image/gif', buffer: Buffer.from('GIF89a\x01\x00\x01\x00') });
/** PNG distintos entre sí (el cliente no admite dos archivos con el mismo nombre y tamaño). */
const distinctPng = (name: string): UploadFile => ({ ...png(name), buffer: Buffer.concat([PNG_BUFFER, Buffer.from(name)]) });

const runForm = (page: Page) => page.getByTestId('run-form');
const files = (page: Page) => page.getByTestId('run-files');
const submit = (page: Page) => page.getByRole('button', { name: 'Registrar ejecución', exact: true });
/** Cuántas ejecuciones lleva el historial del detalle. */
const runRows = (page: Page) => page.getByTestId(/^run-row-RUN-\d+$/);

test.describe('Móvil · verificación: lista', () => {
  test('subtítulo, 10 tarjetas con su resultado, «Cargar más» hasta agotar y sin desbordar la pantalla', async ({ page, request }) => {
    const cases = await allCases(request);
    const totalRuns = cases.reduce((sum, item) => sum + item.runCount, 0);
    await open(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Verificación' })).toBeVisible();
    await expect(page.getByText(`25 casos de prueba · ${totalRuns} ejecuciones`)).toBeVisible();
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId('verification-count')).toHaveText('1–10 de 25');
    await expect.poll(() => codes(page)).toEqual(['TC-001', 'TC-002', 'TC-003', 'TC-004', 'TC-005', 'TC-006', 'TC-007', 'TC-008', 'TC-009', 'TC-010']);
    // Cada tarjeta lleva su último resultado en `data-state` y el badge con el mismo estado
    for (const item of cases.slice(0, 10)) {
      const card = page.getByTestId(`testcase-row-${item.code}`);
      await expect(card).toHaveAttribute('data-state', item.lastResult ?? 'none');
      if (item.lastResult) await expect(card.getByTestId('testcase-result-badge')).toHaveAttribute('data-state', item.lastResult);
      await expect(card).toContainText(item.programCode);
    }
    await expect(page.getByTestId('testcase-row-TC-001')).toContainText('Verificar disponibilidad');
    expect(await noHorizontalOverflow(page)).toBe(true);

    await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
    await expect(page.getByTestId('verification-count')).toHaveText('1–20 de 25');
    await expect(rows(page)).toHaveCount(20);
    await page.getByRole('button', { name: 'Cargar más', exact: true }).click();
    await expect(page.getByTestId('verification-count')).toHaveText('1–25 de 25');
    await expect(rows(page)).toHaveCount(25);
    await expect(page.getByTestId('verification-load-more')).toBeHidden();
  });

  test('orden por columna (pulsar la activa invierte el sentido), estado en la URL y vuelta a empezar al recargar', async ({ page }) => {
    await open(page);
    await expect(rows(page)).toHaveCount(10);
    const code = page.getByRole('radio', { name: 'Código', exact: false });
    await expect(code).toHaveAttribute('aria-checked', 'true');

    await code.click();
    await expect.poll(() => codes(page)).toEqual(['TC-025', 'TC-024', 'TC-023', 'TC-022', 'TC-021', 'TC-020', 'TC-019', 'TC-018', 'TC-017', 'TC-016']);
    await expect(page).toHaveURL(/dir=desc/);
    // Segunda pulsación: vuelve al ascendente y la URL deja de llevar el orden
    await code.click();
    await expect.poll(() => codes(page)).toContain('TC-001');
    await expect(page).not.toHaveURL(/dir=/);

    // Por último resultado: los fallidos primero (como la web)
    await page.getByRole('radio', { name: 'Último resultado', exact: false }).click();
    await expect(rows(page).first()).toHaveAttribute('data-state', 'fail');
    await expect(page).toHaveURL(/sort=result/);
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Último resultado', exact: false })).toHaveAttribute('aria-checked', 'true');
    await expect(rows(page).first()).toHaveAttribute('data-state', 'fail');
  });

  test('filtros: búsqueda con debounce, programa y último resultado combinados, vacío con «Limpiar filtros» y sin ejecutar', async ({ page, request }) => {
    const cases = await allCases(request);
    await open(page);
    await expect(rows(page)).toHaveCount(10);
    // El placeholder es distinto de la etiqueta
    await expect(page.getByPlaceholder('Buscar código o título…')).toBeVisible();

    // «cifrado» está en los casos 003, 011 y 019
    await page.getByLabel('Buscar casos de prueba', { exact: true }).fill('cifrado');
    await expect(rows(page)).toHaveCount(3);
    await expect(page).toHaveURL(/q=cifrado/);
    await expect(page.getByTestId('verification-count')).toHaveText('1–3 de 3');
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByLabel('Buscar casos de prueba', { exact: true })).toHaveValue('');

    await choose(page, 'Programa', 'PRG-002');
    await expect(page.getByTestId('verification-count')).toHaveText('1–9 de 9');
    await expect.poll(async () => (await codes(page))[0]).toBe('TC-010');
    await expect(page).toHaveURL(/program=PRG-002/);

    const fails = cases.filter((item) => item.programCode === 'PRG-002' && item.lastResult === 'fail').length;
    await choose(page, 'Último resultado', 'Fallido');
    await expect(rows(page)).toHaveCount(fails);
    await expect(rows(page).first()).toHaveAttribute('data-state', 'fail');

    await page.getByLabel('Buscar casos de prueba', { exact: true }).fill('zzz-no-existe');
    const empty = page.getByTestId('verification-empty');
    await expect(empty).toContainText('Sin casos de prueba');
    await expect(empty).toContainText('Ningún caso coincide con los filtros aplicados.');
    await empty.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await expect(rows(page)).toHaveCount(10);

    // «Sin ejecutar»: ningún caso del seed está sin ejecutar
    await choose(page, 'Último resultado', 'Sin ejecutar');
    await expect(page.getByTestId('verification-empty')).toBeVisible();
    await expect(page).toHaveURL(/result=none/);
  });

  test('selección múltiple: casillas, barra de acciones y un solo informe con los casos elegidos', async ({ page }) => {
    await stubOpen(page);
    await open(page);
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar TC-001', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Seleccionar TC-003', exact: true }).click();
    await expect(page.getByTestId('verification-bulk-bar')).toContainText('2 seleccionados');
    await expect(page.getByRole('checkbox', { name: 'Seleccionar TC-001', exact: true })).toHaveAttribute('aria-checked', 'true');

    const request = page.waitForRequest((candidate) => candidate.url().includes('/verification/report'));
    await page.getByRole('button', { name: 'Informe de la selección', exact: true }).click();
    expect(decodeURIComponent(new URL((await request).url()).searchParams.get('codes') ?? '')).toBe('TC-001,TC-003');
    await expect(page.getByTestId('toast-info').filter({ hasText: 'Informe generado' })).toContainText('informe-verificacion-seleccion.pdf');
    const [url] = await openedUrls(page);
    expect(url).toMatch(/^blob:/);
    const report = await blobInfo(page, url ?? '');
    expect(report.head.slice(0, 5)).toBe('%PDF-');

    // «Seleccionar todos los casos de la página» marca los 10 y «Quitar selección» vacía la barra
    await page.getByRole('button', { name: 'Seleccionar todos los casos de la página', exact: true }).click();
    await expect(page.getByTestId('verification-bulk-bar')).toContainText('10 seleccionados');
    await page.getByRole('button', { name: 'Quitar selección', exact: true }).click();
    await expect(page.getByTestId('verification-bulk-bar')).toBeHidden();
  });

  test('informe PDF del plan: todo el tenant o el programa filtrado; deshabilitado sin casos, con su motivo visible', async ({ page }) => {
    await stubOpen(page);
    await open(page, 'auditor');
    await expect(rows(page)).toHaveCount(10);
    const reportButton = page.getByRole('button', { name: 'Descargar informe PDF', exact: true });

    const all = page.waitForRequest((candidate) => candidate.url().includes('/verification/report'));
    await reportButton.click();
    expect(new URL((await all).url()).searchParams.has('program')).toBe(false);
    await expect(page.getByTestId('toast-info').filter({ hasText: 'Informe generado' })).toContainText('informe-verificacion.pdf');

    await choose(page, 'Programa', 'PRG-003');
    await expect(page.getByTestId('verification-count')).toHaveText('1–7 de 7');
    const program = page.waitForRequest((candidate) => candidate.url().includes('/verification/report?'));
    await reportButton.click();
    expect(new URL((await program).url()).searchParams.get('program')).toBe('PRG-003');
    await expect.poll(async () => (await openedUrls(page)).length).toBe(2);
    const second = await blobInfo(page, (await openedUrls(page))[1] ?? '');
    expect(second.head.slice(0, 5)).toBe('%PDF-');

    await page.getByLabel('Buscar casos de prueba', { exact: true }).fill('zzz-no-existe');
    await expect(page.getByTestId('verification-empty')).toBeVisible();
    await expect(reportButton).toBeDisabled();
    await expect(page.getByTestId('verification-report-reason')).toHaveText('No hay casos de prueba para el informe');
  });

  test('menú ⋯ de la tarjeta: ver detalle, registrar ejecución (lleva al formulario) e informe PDF del caso', async ({ page }) => {
    await stubOpen(page);
    await open(page);
    await page.getByRole('button', { name: 'Acciones para TC-003', exact: true }).click();
    const menu = rowMenu(page, 'TC-003');
    await expect(menu.getByRole('button')).toHaveText(['Ver detalle', 'Registrar ejecución', 'Informe PDF', 'Cerrar']);

    const report = page.waitForRequest((candidate) => candidate.url().includes('/verification/report'));
    await menu.getByRole('button', { name: 'Informe PDF', exact: true }).click();
    expect(new URL((await report).url()).searchParams.get('codes')).toBe('TC-003');
    await expect(menu).toBeHidden();
    await expect(page.getByTestId('toast-info').filter({ hasText: 'Informe generado' })).toBeVisible();

    await page.getByRole('button', { name: 'Acciones para TC-003', exact: true }).click();
    await rowMenu(page, 'TC-003').getByRole('button', { name: 'Registrar ejecución', exact: true }).click();
    await expect(page).toHaveURL(/\/verification\/TC-003\?run=1$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Registrar ejecución' })).toBeInViewport();

    await page.goto('/verification');
    await page.getByRole('button', { name: 'Acciones para TC-004', exact: true }).click();
    await rowMenu(page, 'TC-004').getByRole('button', { name: 'Ver detalle', exact: true }).click();
    await expect(page).toHaveURL(/\/verification\/TC-004$/);
    await expect(page.getByTestId('testcase-detail')).toBeVisible();
  });

  test('permisos: el gestor ve «Registrar ejecución» del menú deshabilitado, con su motivo visible', async ({ page }) => {
    await open(page, 'program_manager');
    await page.getByRole('button', { name: 'Acciones para TC-007', exact: true }).click();
    const menu = rowMenu(page, 'TC-007');
    await expect(menu.getByRole('button', { name: 'Registrar ejecución', exact: true })).toBeDisabled();
    await expect(page.getByTestId('testcase-menu-run-reason')).toHaveText('Tu rol no permite registrar ejecuciones');
    await expect(menu.getByRole('button', { name: 'Ver detalle', exact: true })).toBeEnabled();
    await expect(menu.getByRole('button', { name: 'Informe PDF', exact: true })).toBeEnabled();
  });

  test('carga lenta (aria-busy), error 503 con traza y reintento', async ({ page }) => {
    await open(page, 'consultant', '/programs');

    await page.route('**/api/test-cases?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue().catch(() => undefined);
    });
    await page.goto('/verification');
    await expect(page.getByTestId('verification-loading')).toHaveAttribute('aria-busy', 'true');
    await expect(rows(page)).toHaveCount(10, { timeout: 8000 });
    await page.unroute('**/api/test-cases?*');

    await page.route('**/api/test-cases?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
    await page.goto('/verification');
    const alert = page.getByRole('alert').filter({ hasText: 'No se pudieron cargar los casos de prueba' });
    await expect(alert).toContainText('GET /api/test-cases → 503');
    await expect(page.getByRole('button', { name: 'Descargar informe PDF', exact: true })).toBeDisabled();
    await page.unroute('**/api/test-cases?*');
    await alert.getByRole('button', { name: 'Reintentar', exact: true }).click();
    await expect(rows(page)).toHaveCount(10);
    await expect(page.getByTestId('verification-error')).toBeHidden();
  });
});

test.describe('Móvil · verificación: detalle', () => {
  test('pasos, resultado esperado, requisitos enlazados (abren el requisito en su programa) e historial', async ({ page, request }) => {
    await open(page);
    await page.getByRole('link', { name: 'TC-001', exact: false }).click();
    await expect(page).toHaveURL(/\/verification\/TC-001$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Verificar disponibilidad (caso 001)' })).toBeVisible();
    await expect(page.getByTestId('testcase-detail')).toContainText('PRG-001');
    await expect(page.getByTestId('testcase-detail').getByTestId('testcase-result-badge')).toHaveAttribute('data-state', /pass|fail|blocked/);

    await expect(page.getByTestId('testcase-steps').getByRole('listitem')).toHaveText(['1.Preparar el entorno de pruebas', '2.Ejecutar el escenario nominal', '3.Registrar las mediciones']);
    await expect(page.getByTestId('testcase-expected')).toContainText('umbral definido en el requisito');

    // Historial: las ejecuciones del seed, la más reciente primero, con fecha, notas y quién la ejecutó
    const detail = await caseDetail(request, 'TC-001');
    await expect(runRows(page)).toHaveCount(detail.runs.length);
    for (const run of detail.runs) {
      await expect(page.getByTestId(`run-row-${run.id}`)).toHaveAttribute('data-state', run.result);
      await expect(page.getByTestId(`run-result-badge-${run.id}`)).toHaveAttribute('data-state', run.result);
    }
    const withoutEvidence = detail.runs.find((run) => run.evidences.length === 0);
    if (withoutEvidence) await expect(page.getByTestId(`run-row-${withoutEvidence.id}`)).toContainText('Sin evidencias');

    // Requisitos verificados: tocar uno lo abre en la pantalla de requisitos de su programa, con el detalle abierto
    await page.getByTestId('testcase-requirements').getByRole('link', { name: 'REQ-001', exact: false }).click();
    await expect(page).toHaveURL(/\/programs\/PRG-001\/requirements/);
    const sheet = page.getByRole('dialog', { name: 'Detalle del requisito' });
    await expect(sheet.getByTestId('requirement-code')).toHaveText('REQ-001');
    await expect(page).not.toHaveURL(/select=/);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('evidencia: la miniatura se pide con el token y se pinta como imagen; al tocarla se amplía en una hoja', async ({ page, request }) => {
    await stubOpen(page);
    await open(page, 'consultant', '/verification/TC-001');
    const detail = await caseDetail(request, 'TC-001');
    const evidence = detail.runs.flatMap((run) => run.evidences).find((item) => item.mimeType === 'image/png');
    if (!evidence) throw new Error('El seed deja una captura en TC-001');

    const thumb = page.getByTestId(`evidence-thumb-${evidence.id}`);
    await expect(thumb).toHaveAttribute('data-state', 'ready');
    // `<Image>` no lleva el Bearer: la miniatura es una `data:` URI y su texto alternativo está en el DOM
    const image = page.getByAltText('Evidencia TC-001');
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(160);
    await expect(thumb).toHaveAccessibleName(/Evidencia TC-001/);

    await thumb.click();
    const zoom = page.getByRole('dialog', { name: evidence.filename, exact: true });
    await expect(zoom).toBeVisible();
    await expect(zoom.getByRole('img', { name: 'Evidencia TC-001' })).toBeVisible();
    await expect(zoom.getByTestId('evidence-zoom-image')).toBeVisible();
    await zoom.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(zoom).toBeHidden();

    // «Descargar» entrega el archivo original (aquí se abre el blob: en una pestaña)
    await page.getByRole('button', { name: `Descargar ${evidence.filename}`, exact: true }).click();
    await expect.poll(async () => (await openedUrls(page)).length).toBe(1);
    const downloaded = await blobInfo(page, (await openedUrls(page))[0] ?? '');
    expect(downloaded.head.slice(1, 4)).toBe('PNG');
    expect(downloaded.size).toBe(evidence.size);
  });

  test('descargar una evidencia abre de verdad una pestaña nueva con el archivo (sin interceptar window.open)', async ({ page, request }) => {
    await open(page, 'consultant', '/verification/TC-001');
    const evidence = (await caseDetail(request, 'TC-001')).runs.flatMap((run) => run.evidences).find((item) => item.mimeType === 'image/png');
    if (!evidence) throw new Error('El seed deja una captura en TC-001');
    await expect(page.getByTestId(`evidence-thumb-${evidence.id}`)).toHaveAttribute('data-state', 'ready');

    const [popup] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('button', { name: `Descargar ${evidence.filename}`, exact: true }).click()]);
    await popup.waitForURL(/^blob:/);
    const bytes = await popup.evaluate(async () => Array.from(new Uint8Array(await (await fetch(location.href)).arrayBuffer()).slice(0, 4)));
    expect(bytes).toEqual([0x89, 0x50, 0x4e, 0x47]);
    await popup.close();
  });

  test('evidencia que no carga: miniatura en error con su aviso, sin romper el resto del detalle', async ({ page, request }) => {
    const detail = await caseDetail(request, 'TC-001');
    const evidence = detail.runs.flatMap((run) => run.evidences)[0];
    if (!evidence) throw new Error('El seed deja una captura en TC-001');
    await open(page, 'consultant', '/programs');
    await page.route('**/api/evidence/*', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ statusCode: 500, error: 'Internal Server Error', message: 'boom' }) }));
    await page.goto('/verification/TC-001');
    await expect(page.getByTestId(`evidence-thumb-${evidence.id}`)).toHaveAttribute('data-state', 'error');
    await expect(page.getByRole('alert').filter({ hasText: 'No se pudo cargar la evidencia' })).toBeVisible();
    await expect(runRows(page).first()).toBeVisible();
  });

  test('caso inexistente (404 con traza y «Volver») y error de carga (503) con reintento', async ({ page }) => {
    await open(page, 'consultant', '/verification/TC-999');
    const missing = page.getByTestId('testcase-not-found');
    await expect(missing).toContainText('No se encontró el caso de prueba');
    await expect(missing).toContainText('GET /api/test-cases/TC-999 → 404');
    await missing.getByRole('button', { name: 'Volver a Verificación', exact: true }).click();
    await expect(page).toHaveURL(/\/verification$/);
    await expect(rows(page)).toHaveCount(10);

    await page.route('**/api/test-cases/TC-001', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
    await page.goto('/verification/TC-001');
    await expect(page.getByTestId('testcase-error')).toContainText('503');
    await page.unroute('**/api/test-cases/TC-001');
    await page.getByTestId('testcase-error-retry').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Verificar disponibilidad (caso 001)' })).toBeVisible();
  });

  test('informe PDF del caso desde su ficha', async ({ page }) => {
    await stubOpen(page);
    await open(page, 'auditor', '/verification/TC-002');
    const report = page.waitForRequest((candidate) => candidate.url().includes('/verification/report'));
    await page.getByRole('button', { name: 'Descargar informe PDF', exact: true }).click();
    expect(new URL((await report).url()).searchParams.get('codes')).toBe('TC-002');
    await expect(page.getByTestId('toast-info').filter({ hasText: 'Informe generado' })).toBeVisible();
    await expect.poll(async () => (await openedUrls(page)).length).toBe(1);
    expect((await blobInfo(page, (await openedUrls(page))[0] ?? '')).head.slice(0, 5)).toBe('%PDF-');
  });
});

test.describe('Móvil · verificación: registrar ejecución', () => {
  test('el resultado es obligatorio y las notas admiten hasta 1000 caracteres: el formulario valida antes de enviar', async ({ page, request }) => {
    await open(page, 'consultant', '/verification/TC-005');
    const before = (await caseDetail(request, 'TC-005')).runs.length;
    await expect(page.getByRole('radiogroup', { name: 'Resultado', exact: true }).getByRole('radio')).toHaveCount(3);
    await expect(page.getByRole('radio', { name: 'Superado', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByLabel('Notas', { exact: true })).toBeEditable();
    await expect(page.getByPlaceholder('Observaciones de la ejecución…')).toBeVisible();

    await submit(page).click();
    await expect(page.getByTestId('run-result-error')).toHaveText('Selecciona un resultado');
    await expect(page.getByTestId('toast-ok')).toHaveCount(0);

    await page.getByRole('radio', { name: 'Fallido', exact: true }).click();
    await expect(page.getByTestId('run-result-error')).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Fallido', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: 'Superado', exact: true })).toHaveAttribute('aria-checked', 'false');

    await page.getByLabel('Notas', { exact: true }).fill('x'.repeat(1001));
    await submit(page).click();
    await expect(page.getByTestId('run-notes-error')).toHaveText('Las notas admiten hasta 1000 caracteres');
    expect((await caseDetail(request, 'TC-005')).runs.length).toBe(before);
  });

  test('evidencias: imagen, varias imágenes y PDF con validación de tipo, tamaño, repetidos y máximo de 5', async ({ page }) => {
    await open(page, 'consultant', '/verification/TC-005');
    const list = files(page);
    const errors = page.getByTestId('run-files-error');
    await expect(page.getByText('Ningún archivo seleccionado')).toBeVisible();
    await expect(page.getByText(/PNG, JPEG o PDF · máx\. 2 MB por archivo · hasta 5 archivos/)).toBeVisible();

    await attach(page, 'Adjuntar un archivo', png('captura-1.png'));
    await expect(list.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByAltText('Vista previa de captura-1.png')).toHaveCount(1);
    await attach(page, 'Adjuntar varios archivos', [jpeg('foto.jpg'), distinctPng('captura-2.png')]);
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await attach(page, 'Adjuntar PDF', pdf('informe.pdf'));
    await expect(list.getByRole('listitem')).toHaveCount(4);
    await expect(list.getByRole('listitem').nth(3)).toContainText('informe.pdf');
    await expect(errors).toBeHidden();

    // Validación en el cliente: tipo (también el de un GIF, que el selector de imágenes sí deja elegir), tamaño y repetidos
    await attach(page, 'Adjuntar un archivo', gif('animado.gif'));
    await expect(errors).toContainText('animado.gif: solo se admiten PNG, JPEG o PDF');
    await attach(page, 'Adjuntar un archivo', bigPng('enorme.png'));
    await expect(errors).toContainText('enorme.png: supera los 2 MB');
    await expect(list.getByRole('listitem')).toHaveCount(4);
    await attach(page, 'Adjuntar un archivo', png('captura-1.png'));
    await expect(list.getByRole('listitem')).toHaveCount(4);

    // Quitar uno borra los avisos y deja sitio para otro
    await page.getByRole('button', { name: 'Quitar foto.jpg', exact: true }).click();
    await expect(list.getByRole('listitem')).toHaveCount(3);
    await expect(errors).toBeHidden();

    // Máximo de 5: de seis archivos entran dos más y el resto se rechaza con un solo aviso
    await attach(page, 'Adjuntar varios archivos', ['a', 'b', 'c', 'd'].map((name) => distinctPng(`extra-${name}.png`)));
    await expect(list.getByRole('listitem')).toHaveCount(5);
    await expect(errors).toHaveText('Máximo 5 archivos por ejecución');
    await page.getByRole('button', { name: 'Quitar extra-a.png', exact: true }).click();
    await expect(errors).toBeHidden();
    await expect(list.getByRole('listitem')).toHaveCount(4);
  });

  test('enviar con evidencias: aviso, historial con miniaturas (imagen y PDF) y lo subido llega íntegro a la API', async ({ page, request }) => {
    await stubOpen(page);
    await open(page, 'consultant', '/verification/TC-005');
    const before = await caseDetail(request, 'TC-005');
    await expect(runRows(page)).toHaveCount(before.runs.length);
    const nextRun = `RUN-${String((await allCases(request)).reduce((sum, item) => sum + item.runCount, 0) + 1).padStart(3, '0')}`;

    await page.getByRole('radio', { name: 'Bloqueado', exact: true }).click();
    await page.getByLabel('Notas', { exact: true }).fill('Entorno de pruebas no disponible durante la ventana.');
    await attach(page, 'Adjuntar varios archivos', [png('captura-bloqueo.png')]);
    await attach(page, 'Adjuntar PDF', pdf('informe-bloqueo.pdf'));
    await expect(files(page).getByRole('listitem')).toHaveCount(2);
    await submit(page).click();

    const toast = page.getByTestId('toast-ok');
    await expect(toast).toContainText('Ejecución registrada');
    await expect(toast).toContainText('TC-005: Bloqueado');
    await expect(toast).toContainText(nextRun);
    await expect(toast).toContainText('con 2 archivo(s) de evidencia');

    // El formulario se limpia y la ejecución nueva sale la primera del historial
    await expect(page.getByRole('radio', { name: 'Bloqueado', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByLabel('Notas', { exact: true })).toHaveValue('');
    await expect(page.getByText('Ningún archivo seleccionado')).toBeVisible();
    await expect(runRows(page)).toHaveCount(before.runs.length + 1);
    const run = page.getByTestId(`run-row-${nextRun}`);
    await expect(runRows(page).first()).toHaveAttribute('data-testid', `run-row-${nextRun}`);
    await expect(run.getByTestId(`run-result-badge-${nextRun}`)).toHaveText('Bloqueado');
    await expect(run).toContainText('Entorno de pruebas no disponible');
    await expect(run).toContainText('Lucía Fernández');

    // La captura como imagen real y el PDF con su propio nombre accesible
    const image = run.getByAltText('Evidencia TC-005');
    await expect(image).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    await expect(run.getByRole('img', { name: 'Documento PDF informe-bloqueo.pdf' })).toBeVisible();
    await run.getByRole('button', { name: 'Descargar informe-bloqueo.pdf', exact: true }).click();
    await expect.poll(async () => (await openedUrls(page)).length).toBe(1);
    expect((await blobInfo(page, (await openedUrls(page))[0] ?? '')).head.slice(0, 5)).toBe('%PDF-');

    // Lo que guardó la API: nombres originales, tipos y bytes exactos de lo que se eligió
    const saved = (await caseDetail(request, 'TC-005')).runs.find((candidate) => candidate.id === nextRun);
    expect(saved?.result).toBe('blocked');
    expect(saved?.notes).toBe('Entorno de pruebas no disponible durante la ventana.');
    expect(saved?.evidences.map((evidence) => [evidence.filename, evidence.mimeType])).toEqual([
      ['captura-bloqueo.png', 'image/png'],
      ['informe-bloqueo.pdf', 'application/pdf'],
    ]);
    const png001 = saved?.evidences[0];
    const bytes = await request.get(`${API_URL}/evidence/${png001?.id}`, { headers: await authHeaders(request, 'consultant') });
    expect((await bytes.body()).equals(PNG_BUFFER)).toBe(true);
  });

  test('al volver a la lista, el caso muestra su nuevo último resultado y una ejecución más', async ({ page }) => {
    await open(page);
    const card = page.getByTestId('testcase-row-TC-005');
    await expect(card).toBeVisible();
    const runsBefore = Number(((await card.textContent()) ?? '').match(/(\d+) ejecuciones/)?.[1]);

    await page.getByTestId('testcase-link-TC-005').click();
    await expect(page).toHaveURL(/\/verification\/TC-005$/);
    await page.getByRole('radio', { name: 'Bloqueado', exact: true }).click();
    await submit(page).click();
    await expect(page.getByTestId('toast-ok')).toContainText('Ejecución registrada');
    await page.getByRole('button', { name: 'Volver a Verificación', exact: true }).click();

    await expect(page).toHaveURL(/\/verification$/);
    await expect(page.getByTestId('testcase-row-TC-005')).toHaveAttribute('data-state', 'blocked');
    await expect(page.getByTestId('testcase-row-TC-005')).toContainText(`${runsBefore + 1} ejecuciones`);
  });

  test('errores del servidor: 422 (el tipo real del archivo), 413 y 503, con su código y sin guardar nada', async ({ page, request }) => {
    await open(page, 'consultant', '/verification/TC-005');
    const before = (await caseDetail(request, 'TC-005')).runs.length;
    await page.getByRole('radio', { name: 'Superado', exact: true }).click();

    // 422: un «png» que no lo es (el cliente solo mira el tipo declarado; el servidor, la firma)
    await attach(page, 'Adjuntar un archivo', fakePng('falso.png'));
    await expect(files(page).getByRole('listitem')).toHaveCount(1);
    await submit(page).click();
    const serverError = page.getByTestId('run-server-error');
    await expect(serverError).toContainText('422');
    await expect(serverError).toContainText('Solo se admiten archivos PNG, JPEG o PDF');
    await expect(page.getByTestId('toast-ok')).toHaveCount(0);
    // Lo elegido se conserva para corregirlo
    await expect(files(page).getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('radio', { name: 'Superado', exact: true })).toHaveAttribute('aria-checked', 'true');

    // 413: el límite del servidor antes de validar (simulado: el cliente ya rechaza lo que pasa de 2 MB)
    await page.route('**/api/test-cases/TC-005/runs', (route) => route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ statusCode: 413, error: 'Payload Too Large', message: 'File too large' }) }));
    await submit(page).click();
    await expect(serverError).toContainText('413');
    await expect(serverError).toContainText('Un archivo supera los 2 MB');
    await page.unroute('**/api/test-cases/TC-005/runs');

    // 503: la traza HTTP
    await page.route('**/api/test-cases/TC-005/runs', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
    await submit(page).click();
    await expect(serverError).toContainText('503');
    await expect(serverError).toContainText('POST /api/test-cases/TC-005/runs → 503');
    await page.unroute('**/api/test-cases/TC-005/runs');

    expect((await caseDetail(request, 'TC-005')).runs.length).toBe(before);
  });

  test('permisos: el auditor ve el formulario deshabilitado con su motivo en texto; el consultor y el admin pueden registrar', async ({ page }) => {
    await open(page, 'auditor', '/verification/TC-007');
    await expect(page.getByTestId('run-denied')).toContainText('Tu rol no permite registrar ejecuciones');
    const send = submit(page);
    await expect(send).toBeDisabled();
    await expect(send).toHaveAttribute('data-reason', 'Tu rol no permite registrar ejecuciones');
    for (const name of ['Superado', 'Fallido', 'Bloqueado']) await expect(page.getByRole('radio', { name, exact: true })).toBeDisabled();
    await expect(page.getByLabel('Notas', { exact: true })).not.toBeEditable();
    for (const name of ['Adjuntar un archivo', 'Adjuntar varios archivos', 'Adjuntar PDF']) await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    // El auditor puede, en cambio, pedir el informe del caso
    await expect(page.getByRole('button', { name: 'Descargar informe PDF', exact: true })).toBeEnabled();

    await open(page, 'program_manager', '/verification/TC-007');
    await expect(page.getByTestId('run-denied')).toBeVisible();
    await expect(submit(page)).toBeDisabled();

    for (const role of ['consultant', 'admin'] as const) {
      await open(page, role, '/verification/TC-007');
      await expect(runForm(page)).toBeVisible();
      await expect(page.getByTestId('run-denied')).toHaveCount(0);
      await expect(submit(page)).toBeEnabled();
    }
  });

  test('el admin registra una ejecución sin evidencias ni notas (solo el resultado)', async ({ page, request }) => {
    await open(page, 'admin', '/verification/TC-009');
    const before = (await caseDetail(request, 'TC-009')).runs.length;
    await page.getByRole('radio', { name: 'Superado', exact: true }).click();
    await submit(page).click();
    await expect(page.getByTestId('toast-ok')).toContainText('TC-009: Superado');
    await expect(runRows(page)).toHaveCount(before + 1);
    await expect(runRows(page).first().getByTestId(/^run-result-badge-/)).toHaveAttribute('data-state', 'pass');
    await expect(runRows(page).first()).toContainText('Sin evidencias');
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});
