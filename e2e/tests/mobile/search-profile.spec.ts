import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { loginByApi, openAs, resetTenant, type RoleName } from '../../support/auth';

// Perfil (cuenta, permisos del rol y preferencias con «Guardar») y búsqueda global en el móvil: paridad con `profile.spec.ts` y
// `search.spec.ts` de la web. Mismos textos, ids y reglas. Tenant propio (alumno24), restaurado antes y después.
// Locators por rol y nombre primero; el `testID` (que React Native Web pinta como `data-testid`) como respaldo, p. ej. en los
// interruptores, cuyo nodo con `role=switch` repite el nombre en un input interno.

const TENANT = 'alumno24';
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

test.afterAll(async ({ request }) => {
  await resetTenant(request, TENANT);
});

const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const toast = (page: Page, tone: 'ok' | 'info' | 'danger', text: string) => page.getByTestId(`toast-${tone}`).filter({ hasText: text });
const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const storage = (page: Page, key: string) => page.evaluate((name) => localStorage.getItem(name), key);

/** Elige una opción de un selector (`combobox` → hoja con opciones `radio`). */
const choose = async (page: Page, field: string, option: string) => {
  await page.getByRole('combobox', { name: field, exact: true }).click();
  await page.getByRole('dialog', { name: field, exact: true }).getByRole('radio', { name: option, exact: true }).click();
  await expect(page.getByRole('dialog', { name: field, exact: true })).toBeHidden();
};

/**
 * Sesión por API y solo tenant y sesión en el almacenamiento: el tema y el idioma los decide la app. No se usa `openAs`: su
 * script de inicio reescribe tema e idioma en cada carga y taparía la persistencia de las preferencias.
 */
const signIn = async (page: Page, request: APIRequestContext, role: RoleName = 'admin'): Promise<void> => {
  const { refreshToken } = await loginByApi(request, role, TENANT);
  await page.context().addInitScript(
    ({ token, tenant }) => {
      localStorage.setItem('sigpro.tenant', tenant);
      localStorage.setItem('sigpro.session', JSON.stringify({ refreshToken: token, remember: true }));
      localStorage.setItem('sigpro.cookies', 'accepted');
    },
    { token: refreshToken, tenant: TENANT },
  );
};

// --- Perfil ----------------------------------------------------------------------------------------------------------

const saveButton = (page: Page) => page.getByRole('button', { name: /^(Guardar|Save)$/ });
const liveSwitch = (page: Page) => page.getByTestId('profile-live');
const digestBox = (page: Page) => page.getByRole('checkbox', { name: /resumen semanal|weekly summary/i });

test.describe('Móvil · Perfil', () => {
  test('se abre desde «Más» y muestra la cuenta: avatar con nombre, nombre, correo, rol traducido y tenant', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/programs');
    await tab(page, 'Más').click();
    await page.getByRole('link', { name: 'Perfil', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(h1(page, 'Perfil')).toBeVisible();
    await expect(page.getByText('Tu cuenta y tus preferencias en este navegador.')).toBeVisible();

    await expect(page.getByTestId('profile-avatar').getByRole('img', { name: 'Marta Ruiz' })).toBeVisible();
    await expect(page.getByTestId('profile-name')).toHaveText('Marta Ruiz');
    await expect(page.getByTestId('profile-email')).toHaveText('admin@sigpro.test');
    await expect(page.getByTestId('profile-role')).toHaveText('Admin');
    await expect(page.getByTestId('profile-tenant')).toHaveText(TENANT);

    // Estructura accesible: la zona de tema es un grupo con su nombre y las secciones tienen su encabezado
    const theme = page.getByRole('radiogroup', { name: 'Tema', exact: true });
    await expect(theme).toBeVisible();
    await expect(theme.getByRole('radio')).toHaveText(['Claro', 'Oscuro']);
    for (const name of ['Cuenta', 'Qué puedes hacer con tu rol', 'Preferencias']) await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
  });

  test('permisos del rol: la lista marca lo que se puede hacer (✓ / —) y lo anuncia con texto', async ({ page }) => {
    const allowed = (): Promise<string[]> =>
      page
        .getByTestId('profile-permissions')
        .getByRole('listitem')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-allowed') ?? ''));
    const expected: Readonly<Record<RoleName, string[]>> = {
      // nc.create · nc.transition · nc.close · milestone.edit · users.manage · audit.view
      admin: ['true', 'true', 'true', 'true', 'true', 'true'],
      program_manager: ['true', 'true', 'true', 'true', 'false', 'false'],
      consultant: ['true', 'true', 'false', 'false', 'false', 'false'],
      auditor: ['true', 'false', 'false', 'false', 'false', 'true'],
    };
    const roleLabel: Readonly<Record<RoleName, string>> = { admin: 'Admin', program_manager: 'Gestor de programas', consultant: 'Consultor', auditor: 'Auditor' };

    for (const role of ['admin', 'program_manager', 'consultant', 'auditor'] as const) {
      await openAs(page, role, '/profile', { tenant: TENANT });
      await expect(page.getByTestId('profile-role')).toHaveText(roleLabel[role]);
      await expect(page.getByTestId('profile-permissions').getByRole('listitem')).toHaveCount(6);
      expect(await allowed(), `permisos de ${role}`).toEqual(expected[role]);
    }

    // El consultor no puede cerrar NC: la fila lo dice con texto
    await openAs(page, 'consultant', '/profile', { tenant: TENANT });
    const close = page.getByRole('listitem').filter({ hasText: 'Cerrar no conformidades' });
    await expect(close).toContainText('No permitido');
    await expect(close).toHaveAttribute('data-allowed', 'false');
    await expect(page.getByRole('listitem').filter({ hasText: 'Mover no conformidades' })).toContainText('Permitido');
  });

  test('preferencias: son un borrador, «Guardar» las aplica todas y persisten al recargar', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/profile');
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByTestId('profile-page').getByText('No hay cambios que guardar')).toBeVisible(); // el motivo, a la vista
    await expect(page.getByRole('combobox', { name: 'Idioma de la interfaz', exact: true })).toContainText('Español');
    await expect(page.getByRole('radio', { name: 'Claro', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'false');

    // Cambios en el borrador: nada se aplica todavía
    await choose(page, 'Idioma de la interfaz', 'English');
    await page.getByRole('radio', { name: 'Oscuro', exact: true }).click();
    await liveSwitch(page).click();
    await digestBox(page).click();
    await expect(saveButton(page)).toBeEnabled();
    await expect(h1(page, 'Perfil')).toBeVisible();
    await expect(tab(page, 'Más')).toBeVisible();
    expect(await storage(page, 'sigpro.live')).toBeNull();
    expect(await storage(page, 'sigpro.theme')).toBeNull();
    expect(await storage(page, 'sigpro.lang')).toBeNull();

    await saveButton(page).click();
    // El aviso sale en el idioma anterior (como la web) y todo se aplica a la vez
    await expect(toast(page, 'ok', 'Preferencias guardadas')).toBeVisible();
    await expect(h1(page, 'Profile')).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Interface language', exact: true })).toContainText('English');
    await expect(saveButton(page)).toBeDisabled();
    await expect(page.getByTestId('profile-page').getByText('There are no changes to save')).toBeVisible();

    // Persisten: mismas claves y valores que la web, y el estado tras recargar
    expect(await storage(page, 'sigpro.live')).toBe('off');
    expect(await storage(page, 'sigpro.digest')).toBe('on');
    expect(await storage(page, 'sigpro.theme')).toBe('dark');
    expect(await storage(page, 'sigpro.lang')).toBe('en');
    await page.reload();
    await expect(h1(page, 'Profile')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeDisabled(); // sin parpadeo: lo guardado ya es lo aplicado
  });

  test('volver al valor guardado desactiva «Guardar» (interruptor, casilla, idioma y tema)', async ({ page, request }) => {
    await signIn(page, request);
    await page.goto('/profile');
    await liveSwitch(page).click();
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(saveButton(page)).toBeEnabled();
    await liveSwitch(page).click();
    await expect(liveSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeDisabled();

    await digestBox(page).click();
    await expect(digestBox(page)).toHaveAttribute('aria-checked', 'true');
    await expect(saveButton(page)).toBeEnabled();
    await digestBox(page).click();
    await expect(saveButton(page)).toBeDisabled();

    await choose(page, 'Idioma de la interfaz', 'English');
    await expect(saveButton(page)).toBeEnabled();
    await choose(page, 'Idioma de la interfaz', 'Español');
    await expect(saveButton(page)).toBeDisabled();

    await page.getByRole('radio', { name: 'Oscuro', exact: true }).click();
    await expect(saveButton(page)).toBeEnabled();
    await page.getByRole('radio', { name: 'Claro', exact: true }).click();
    await expect(saveButton(page)).toBeDisabled();
  });

  test('cerrar sesión desde el perfil vuelve a Acceso y borra la sesión guardada', async ({ page, request }) => {
    await signIn(page, request, 'consultant');
    await page.goto('/profile');
    await expect(page.getByTestId('profile-name')).toHaveText('Lucía Fernández');
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('login-form')).toBeVisible();
    expect(await storage(page, 'sigpro.session')).toBeNull();
  });

  test('sin sesión, /profile redirige a Acceso', async ({ page }) => {
    await page.context().addInitScript(() => localStorage.setItem('sigpro.cookies', 'accepted'));
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
  });
});

// --- Búsqueda global -------------------------------------------------------------------------------------------------
// Seed: «disponibilidad» → 5 requisitos y 4 casos; «sistema» → 24 programas y 40 requisitos; PRG-005 = «Centro de control de misión CCM».

const searchbox = (page: Page) => page.getByRole('textbox', { name: 'Búsqueda global', exact: true });
const results = (page: Page) => page.getByTestId('global-search-results');
const status = (page: Page) => page.getByTestId('global-search-status');
const group = (page: Page, name: RegExp) => results(page).getByRole('group', { name });
const searchResponse = (page: Page, q: string) =>
  page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname.endsWith('/api/search') && url.searchParams.get('q') === q;
  });
const trackSearches = (page: Page): string[] => {
  const queries: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('/api/search')) queries.push(url.searchParams.get('q') ?? '');
  });
  return queries;
};
/** Busca `q` y espera a la respuesta del servidor. */
const search = async (page: Page, q: string) => {
  const answered = searchResponse(page, q);
  await searchbox(page).fill(q);
  await answered;
};
const openSearch = async (page: Page, role: RoleName = 'admin') => {
  await openAs(page, role, '/search', { tenant: TENANT });
  await expect(page.getByTestId('search-page')).toBeVisible();
};

test.describe('Móvil · Búsqueda global', () => {
  test('«Más» la ofrece la primera y lleva a la pantalla de búsqueda, con el campo a la vista', async ({ page }) => {
    await openAs(page, 'consultant', '/programs', { tenant: TENANT });
    await tab(page, 'Más').click();
    const entries = page.getByTestId('more-page').getByRole('link');
    await expect(entries.first()).toHaveAttribute('aria-label', 'Búsqueda global');
    await entries.first().click();
    await expect(page).toHaveURL(/\/search$/);
    await expect(h1(page, 'Búsqueda global')).toBeVisible();
    await expect(searchbox(page)).toHaveAttribute('placeholder', 'Buscar código o nombre…');
    await expect(searchbox(page)).toBeFocused(); // el campo se abre con el foco
    await expect(page.getByTestId('global-search-results')).toHaveCount(0); // sin texto, solo la pista
    await expect(page.getByText('Escribe al menos 2 caracteres')).toBeVisible();
  });

  test('mínimo de caracteres: con 1 solo avisa y no hay petición; con 2 ya busca', async ({ page }) => {
    await openSearch(page);
    const queries = trackSearches(page);
    await searchbox(page).fill('c');
    await expect(status(page)).toHaveText('Escribe al menos 2 caracteres');
    await page.waitForTimeout(500); // más que el retraso: no debe salir ninguna petición
    expect(queries).toEqual([]);

    await search(page, 'cc');
    await expect(results(page).getByRole('link').first()).toBeVisible();
    await searchbox(page).fill(' c ');
    await expect(status(page)).toHaveText('Escribe al menos 2 caracteres');
    await expect(results(page).getByRole('link')).toHaveCount(0); // los resultados de «cc» ya no se enseñan
  });

  test('resultados agrupados: espera el retraso, una sola petición, grupos con encabezado y recuento', async ({ page }) => {
    await openSearch(page);
    const queries = trackSearches(page);
    const answered = searchResponse(page, 'disponibilidad');
    await searchbox(page).pressSequentially('disponibilidad', { delay: 35 });
    await answered;

    const list = results(page).getByRole('list', { name: 'Resultados de la búsqueda' });
    await expect(list).toBeVisible();
    await expect(list.getByRole('group')).toHaveCount(2);
    const requirements = group(page, /Requisitos/);
    const testCases = group(page, /Casos de prueba/);
    await expect(requirements.getByRole('link')).toHaveCount(5);
    await expect(testCases.getByRole('link')).toHaveCount(4);
    await expect(requirements.getByRole('link').first()).toContainText('REQ-001');
    await expect(requirements.getByRole('link').first()).toContainText('Disponibilidad del subsistema 001');
    await expect(testCases.getByRole('link').first()).toContainText('TC-001');
    await expect(status(page)).toHaveText('9 resultados en 2 grupos');
    // El retraso descarta las pulsaciones intermedias: una sola petición con el texto final
    expect(queries).toEqual(['disponibilidad']);
    // Orden fijo (requisitos antes que casos) y los grupos sin resultados no aparecen
    await expect(list.getByRole('group').first()).toContainText('Requisitos');
    await expect(list.getByRole('group', { name: /Programas|No conformidades|Documentos/ })).toHaveCount(0);
    await expect(page.getByTestId('global-search-group-total-requirement')).toHaveText('5');
    await expect(page.getByTestId('global-search-group-more-requirement')).toHaveCount(0); // se enseñan todos: sin «N más»
  });

  test('máximo de 5 ítems por grupo: el encabezado muestra «5 / total», «N más» y el resumen cuenta todo', async ({ page }) => {
    await openSearch(page);
    await search(page, 'sistema');
    await expect(group(page, /Programas/).getByRole('link')).toHaveCount(5);
    await expect(page.getByTestId('global-search-group-total-program')).toHaveText('5 / 24');
    await expect(page.getByTestId('global-search-group-total-requirement')).toHaveText('5 / 40');
    await expect(page.getByTestId('global-search-group-more-program')).toHaveText('19 más');
    await expect(page.getByTestId('global-search-group-more-requirement')).toHaveText('35 más');
    await expect(group(page, /Programas/).getByRole('link').last()).toContainText('PRG-005');
    await expect(status(page)).toHaveText('64 resultados en 2 grupos');
  });

  test('tocar un resultado abre su pantalla: programa, requisito, caso de prueba, NC y documento', async ({ page }) => {
    await openSearch(page);

    await search(page, 'ccm');
    const option = results(page).getByRole('link', { name: /PRG-005/ });
    await expect(option).toContainText('Centro de control de misión CCM');
    await option.click();
    await expect(page).toHaveURL(/\/programs\/PRG-005$/);
    await expect(page.getByTestId('program-detail-page')).toBeVisible();

    // Un requisito abre su programa con el detalle abierto (`?select=` lo consume y lo quita de la URL)
    await openSearch(page);
    await search(page, 'REQ-017');
    await results(page).getByTestId('global-search-item-requirement-REQ-017').click();
    await expect(page).toHaveURL(/\/programs\/PRG-002\/requirements(\?select=REQ-017)?$/);
    await expect(page.getByRole('dialog', { name: 'Detalle del requisito' })).toContainText('REQ-017');

    // Un caso de prueba abre su detalle (el segundo de «disponibilidad» es TC-009)
    await openSearch(page);
    await search(page, 'disponibilidad');
    await expect(group(page, /Casos de prueba/).getByRole('link').nth(1)).toContainText('TC-009');
    await group(page, /Casos de prueba/).getByRole('link').nth(1).click();
    await expect(page).toHaveURL(/\/verification\/TC-009$/);
    await expect(page.getByTestId('testcase-detail')).toContainText('TC-009');

    // Una NC abre el tablero con su detalle (la web tiene /nc/NC-001; el móvil, `?select=` y una hoja)
    await openSearch(page);
    await search(page, 'NC-001');
    await results(page).getByTestId('global-search-item-nc-NC-001').click();
    await expect(page).toHaveURL(/\/nc(\?select=NC-001)?$/);
    await expect(page.getByRole('dialog', { name: 'Detalle de NC-001', exact: true })).toBeVisible();

    // Con la pestaña de NC ya montada (no es una carga en frío) el mismo resultado vuelve a abrir el detalle: el parámetro se quita al usarlo.
    // «Más» vuelve a la pantalla donde se quedó o al menú, según la pila; en los dos casos el campo de búsqueda está vacío (la web lo vacía al navegar)
    await page.getByRole('dialog', { name: 'Detalle de NC-001', exact: true }).getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Detalle de NC-001', exact: true })).toBeHidden();
    await tab(page, 'Más').click();
    const entry = page.getByTestId('more-item-search');
    await expect(searchbox(page).or(entry)).toBeVisible();
    if (await entry.isVisible()) await entry.click();
    await expect(searchbox(page)).toHaveValue('');
    await search(page, 'NC-001');
    await results(page).getByTestId('global-search-item-nc-NC-001').click();
    await expect(page.getByRole('dialog', { name: 'Detalle de NC-001', exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/nc$/);

    // Un documento abre su ficha
    await openSearch(page);
    await search(page, 'especificación');
    await group(page, /Documentos/).getByRole('link').first().click();
    await expect(page).toHaveURL(/\/documents\/DOC-\d+$/);
    await expect(page.getByTestId('document-detail-page')).toBeVisible();
  });

  test('sin resultados: aviso con el texto buscado y sin lista', async ({ page }) => {
    await openSearch(page);
    await search(page, 'zzzzz');
    await expect(page.getByTestId('global-search-empty')).toHaveText('Sin resultados para «zzzzz»');
    await expect(results(page).getByRole('list')).toHaveCount(0);
    await expect(results(page).getByRole('link')).toHaveCount(0);
  });

  test('carga y error: «Buscando…» con aria-busy, 503 con aviso y reintento, y los resultados viejos no se enseñan', async ({ page }) => {
    await openSearch(page);
    await search(page, 'ccm');
    await expect(results(page).getByRole('link')).toHaveCount(1);

    await page.route(/\/api\/search\?q=radar/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
    await searchbox(page).fill('radar');
    await expect(page.getByTestId('global-search-loading')).toHaveText('Buscando…');
    await expect(results(page)).toHaveAttribute('aria-busy', 'true');
    await expect(results(page).getByRole('link')).toHaveCount(0); // los de «ccm» ya no se enseñan mientras llega «radar»
    await expect(results(page)).toHaveAttribute('aria-busy', 'false');
    await expect(page.getByTestId('global-search-loading')).toHaveCount(0);
    await page.unroute(/\/api\/search\?q=radar/);

    await page.route(/\/api\/search\?q=fallo/, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ statusCode: 503, error: 'Service Unavailable', message: 'down' }) }));
    await searchbox(page).fill('fallo');
    await expect(page.getByTestId('global-search-error')).toHaveText('No se pudo buscar');
    await expect(results(page).getByRole('list')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); // sigue fallando: vuelve a avisar
    await expect(page.getByTestId('global-search-error')).toBeVisible();
    await page.unroute(/\/api\/search\?q=fallo/);
    await page.getByRole('button', { name: 'Reintentar', exact: true }).click(); // ya responde: sin coincidencias para «fallo»
    await expect(page.getByTestId('global-search-empty')).toHaveText('Sin resultados para «fallo»');

    await searchbox(page).fill('ccm'); // se recupera al reescribir
    await expect(results(page).getByRole('link')).toHaveCount(1);
  });

  test('documentos restringidos: el consultor no los ve (ni el recuento) y el admin sí', async ({ page }) => {
    await openSearch(page, 'consultant');
    await search(page, 'especificación');
    await expect(page.getByTestId('global-search-group-total-document')).toHaveText('4');
    await expect(group(page, /Documentos/).getByRole('link')).toHaveCount(4);
    await expect(page.getByTestId('global-search-item-document-DOC-006')).toHaveCount(0);

    await openSearch(page, 'admin');
    await search(page, 'especificación');
    await expect(page.getByTestId('global-search-group-total-document')).toHaveText('5 / 6');
    await expect(page.getByTestId('global-search-group-more-document')).toHaveText('1 más');
    await expect(page.getByTestId('global-search-item-document-DOC-006')).toBeVisible(); // restringido
  });

  test('en inglés los grupos y los avisos cambian de idioma', async ({ page }) => {
    await openAs(page, 'admin', '/search', { tenant: TENANT, lang: 'en' });
    await expect(h1(page, 'Global search')).toBeVisible();
    await expect(page.getByText('Type at least 2 characters')).toBeVisible();
    const box = page.getByRole('textbox', { name: 'Global search', exact: true });
    const find = async (q: string) => {
      const answered = searchResponse(page, q);
      await box.fill(q);
      await answered;
    };
    await find('disponibilidad');
    await expect(group(page, /Requirements/)).toBeVisible();
    await expect(group(page, /Test cases/)).toBeVisible();
    await expect(status(page)).toHaveText('9 results in 2 groups');
    await find('zzzzz');
    await expect(page.getByTestId('global-search-empty')).toHaveText('No results for “zzzzz”');
  });
});
