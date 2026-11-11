import { expect, test } from '../fixtures';
import { RequirementsPage } from '../pages/RequirementsPage';
import type { Api } from '../support/api';
import { API_URL, ROLES, TENANT } from '../support/env';
import { apiOn, loginOn } from '../support/tenant-login';

// SESIÓN 8 · API testing con `request`, setup por API
// Ejercicio tipo: crear datos por API y verificarlos en UI.
//
// Qué se practica:
//  - Login por API con el segundo paso MFA (el admin lo necesita; el consultor, no).
//  - Códigos de estado: 401 sin token, 403 por rol, 404, 409 por transición inválida y 422 con `errors` por campo.
//  - Crear un requisito por API y comprobar, desde la UI, que aparece en el árbol.
//  - Aislamiento entre tenants con la cabecera `x-tenant`. `demo` se usa SOLO para leer.
//  - La auditoría: cada mutación deja su evento, y el borrado también.
//  - `GET /health` y `GET /config`, públicos, y la limpieza de lo que creas.
//
// Datos compartidos: cada test crea SUS requisitos en PRG-001 con un título único y los borra al terminar (`finally`),
// también si una aserción falla. No se toca REQ-017 ni PRG-002 (los usan otros specs) ni los usuarios del seed:
// no se desactiva a nadie ni se le cambia el rol.

const PROGRAM = 'PRG-001';
const DEMO = 'demo';

/** Título único por ejecución: así un requisito de otro test (o de otra ejecución) nunca se confunde con el tuyo. */
const uniqueTitle = (label: string): string => `Prueba s08 ${label} ${Date.now()}`;

interface ErrorBody {
  readonly code?: string;
  readonly errors?: Record<string, string>;
}

interface RequirementBody {
  readonly code: string;
  readonly title: string;
  readonly state: string;
}

interface AuditBody {
  readonly items: readonly { readonly action: string; readonly entityId: string; readonly diff: Record<string, unknown> | null }[];
}

/** Crea un requisito en borrador en PRG-001 y devuelve su código. El código lo asigna el servidor: no se inventa. */
const createRequirement = async (api: Api, title: string): Promise<string> => {
  const response = await api.post('/requirements', { programCode: PROGRAM, title });
  expect(response.status()).toBe(201);
  return ((await response.json()) as RequirementBody).code;
};

/** Borra un requisito. Va en `finally`: no afirma nada, para no tapar el error original del test. */
const removeRequirement = async (api: Api, code: string): Promise<void> => {
  await api.delete(`/requirements/${code}`);
};

/** Eventos de auditoría de UN requisito: filtro por código, sin fechas, para no depender del día en que corra. */
const auditOf = async (api: Api, code: string): Promise<AuditBody> => {
  const response = await api.get('/audit', { entity: 'requirement', q: code, limit: 100 });
  expect(response.status()).toBe(200);
  return (await response.json()) as AuditBody;
};

test.describe('la API antes que la UI', () => {
  test('login por API con MFA: el admin necesita el segundo paso y el consultor no; /auth/me confirma la sesión', async ({ request }) => {
    const headers = { 'x-tenant': TENANT };

    // Primer paso: usuario y contraseña. El admin tiene MFA, así que la respuesta es un `mfaToken`, no un token de acceso
    const first = await request.post(`${API_URL}/auth/login`, { headers, data: { email: ROLES.admin.email, password: ROLES.admin.password, remember: true } });
    expect(first.status()).toBe(200);
    const step = (await first.json()) as { mfaRequired: boolean; mfaToken?: string; accessToken?: string };
    expect(step).toMatchObject({ mfaRequired: true });
    expect(step.accessToken).toBeUndefined();

    // Segundo paso: el código del segundo factor canjea el `mfaToken` por el token de acceso
    const second = await request.post(`${API_URL}/auth/mfa`, { headers, data: { mfaToken: step.mfaToken, code: ROLES.admin.mfa } });
    expect(second.status()).toBe(200);
    const { accessToken } = (await second.json()) as { accessToken: string };

    // `/auth/me` dice quién es la sesión: el token y la cabecera deben apuntar al mismo usuario
    const me = await request.get(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}`, ...headers } });
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({ email: ROLES.admin.email, role: 'admin' });

    // El consultor no tiene MFA: el login devuelve el token de acceso directamente
    const consultant = await request.post(`${API_URL}/auth/login`, { headers, data: { email: ROLES.consultant.email, password: ROLES.consultant.password, remember: true } });
    expect(await consultant.json()).toMatchObject({ mfaRequired: false, accessToken: expect.any(String) });
  });

  test('401 sin token (o con uno falso) y 403 cuando el rol no puede: el rol decide, no el token', async ({ request, apiAs }) => {
    // Sin token: 401. Un token inventado también es 401
    const noToken = await request.get(`${API_URL}/programs/${PROGRAM}/requirements`, { headers: { 'x-tenant': TENANT } });
    expect(noToken.status()).toBe(401);
    const fake = await request.get(`${API_URL}/programs/${PROGRAM}/requirements`, { headers: { Authorization: 'Bearer no-es-un-token', 'x-tenant': TENANT } });
    expect(fake.status()).toBe(401);

    // Con token válido, el rol manda: el consultor no puede leer la auditoría ni listar usuarios
    const consultant = await apiAs('consultant');
    const audit = await consultant.get('/audit');
    expect(audit.status()).toBe(403);
    expect(((await audit.json()) as ErrorBody).code).toBe('forbidden');

    const manager = await apiAs('program_manager');
    expect((await manager.get('/admin/users')).status()).toBe(403);
  });

  test('404 para lo que no existe; 422 con `errors` por campo cuando el cuerpo no es válido', async ({ apiAs }) => {
    const admin = await apiAs('admin');

    // 404: el requisito y el programa no existen (no se crea nada en ninguno de los dos casos)
    expect((await admin.get('/requirements/REQ-999')).status()).toBe(404);
    expect((await admin.post('/requirements', { programCode: 'PRG-999', title: 'Programa que no existe' })).status()).toBe(404);

    // 422: el título es demasiado corto. El servidor dice qué campo falla y el motivo, para que el test lo compruebe campo a campo
    const invalid = await admin.post('/requirements', { programCode: PROGRAM, title: 'ab' });
    expect(invalid.status()).toBe(422);
    expect(((await invalid.json()) as ErrorBody).errors).toEqual({ title: 'titleShort' });
  });

  test('409: la máquina de estados no admite borrador → validado; el paso que sí existe (borrador → aprobado) funciona', async ({ apiAs }) => {
    const admin = await apiAs('admin');
    const code = await createRequirement(admin, uniqueTitle('transición'));
    try {
      // Un salto que la máquina de estados no tiene es un conflicto (409), no un error del servidor
      const skip = await admin.post(`/requirements/${code}/transition`, { to: 'validated' });
      expect(skip.status()).toBe(409);
      expect(((await skip.json()) as ErrorBody).code).toBe('invalid_transition');

      // El paso que sí existe: lo da el gestor (el consultor recibiría 403 por no tener ese permiso)
      const manager = await apiAs('program_manager');
      const approved = await manager.post(`/requirements/${code}/transition`, { to: 'approved' });
      expect(approved.status()).toBe(200);
      expect(((await approved.json()) as RequirementBody).state).toBe('approved');
    } finally {
      await removeRequirement(admin, code);
    }
  });

  test('crear por API (como consultor) y comprobar en la UI que el requisito aparece en el árbol', async ({ apiAs, page }) => {
    const title = uniqueTitle('árbol');
    const consultant = await apiAs('consultant');
    const code = await createRequirement(consultant, title);
    try {
      // La UI corre como admin (la fixture `page` por defecto). El buscador filtra el árbol: solo queda este requisito
      const requirements = new RequirementsPage(page);
      await requirements.goto(PROGRAM);
      await requirements.search.fill(title);
      await expect(requirements.item(code, title)).toBeVisible();
    } finally {
      await removeRequirement(await apiAs('admin'), code);
    }
  });

  test('aislamiento: lo creado aquí no aparece en demo (solo lectura), y el JWT manda sobre la cabecera x-tenant', async ({ request, apiAs }) => {
    const admin = await apiAs('admin');
    const title = uniqueTitle('aislado');
    const code = await createRequirement(admin, title);
    try {
      // Lectura en `demo`: login con el admin de demo y la cabecera `x-tenant: demo`. Sin escribir nada allí
      const demoToken = await loginOn(request, DEMO, ROLES.admin);
      const demoList = (await (await apiOn(request, DEMO, demoToken).get(`/programs/${PROGRAM}/requirements`)).json()) as { items: RequirementBody[] };
      expect(demoList.items.map((item) => item.title)).not.toContain(title);

      // El JWT manda: un token de TU tenant con la cabecera de demo sigue viendo TUS datos
      const ownToken = await loginOn(request, TENANT, ROLES.admin);
      const crossed = await apiOn(request, DEMO, ownToken).get(`/requirements/${code}`);
      expect(crossed.status()).toBe(200);
      expect(((await crossed.json()) as RequirementBody).title).toBe(title);
    } finally {
      await removeRequirement(admin, code);
    }
  });

  test('auditoría: la creación y el borrado dejan su evento, localizado por el código del requisito', async ({ apiAs }) => {
    const admin = await apiAs('admin');
    const consultant = await apiAs('consultant');
    const title = uniqueTitle('auditado');
    const code = await createRequirement(consultant, title); // lo crea el consultor: el evento lo atribuye a él
    try {
      // `q` busca por código de la entidad y `entity` acota a requisitos. El diff de `requirement.created` lleva el título
      const created = await auditOf(admin, code);
      const event = created.items.find((item) => item.action === 'requirement.created' && item.diff?.title === title);
      expect(event?.entityId).toBe(code);

      // Borrar también es una mutación: deja su propio evento, y el requisito ya no existe
      const deleted = await admin.delete(`/requirements/${code}`);
      expect(deleted.status()).toBe(204);
      const afterDelete = await auditOf(admin, code);
      expect(afterDelete.items.map((item) => item.action)).toEqual(expect.arrayContaining(['requirement.created', 'requirement.deleted']));
      expect((await admin.get(`/requirements/${code}`)).status()).toBe(404);
    } finally {
      await removeRequirement(admin, code);
    }
  });

  test('GET /health y GET /config son públicos: sin token responden, y /config dice en qué tenant estás', async ({ request }) => {
    // Health: lo usa Render para saber si la API vive. No pide token
    const health = await request.get(`${API_URL}/health`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'ok' });

    // Config: la cabecera `x-tenant` decide de qué tenant es la configuración que devuelve
    const config = await request.get(`${API_URL}/config`, { headers: { 'x-tenant': TENANT } });
    expect(config.status()).toBe(200);
    expect(await config.json()).toMatchObject({ tenant: TENANT, version: expect.any(String), env: expect.any(String) });
  });
});
