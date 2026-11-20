import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { DOCS_NOTE, judge, prepareAlumno, raw, show, statusCheck } from './common';

// US-API-PLATAFORMA-005 — Publicar la documentación OpenAPI en /api/docs. Preparación de cada fila: alumno01 reiniciado y caos apagado.
// Los Esquemas 1 a 3 necesitan que la API no tenga credenciales de documentación (la pila aislada no las tiene). El Esquema 4 las exige
// configuradas: la pila aislada se lanza sin DOCS_BASIC_AUTH (docs/story-runs/entorno/env.sh), así que se devuelve notExecutable.
// Las reglas sin Esquema (descripción general, esquemas de seguridad, cabecera x-tenant en las operaciones) se comprueban sobre el
// mismo JSON que ya se descarga en los Esquemas 2 y 3, y sus fallos son discrepancias como cualquier otra comprobación.

const DOCS_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/docs', '/api/docs'],
  ['/api/docs-json', '/api/docs-json'],
]);

/** Marca de la página de Swagger UI (contenedor que la plantilla estándar de swagger-ui-dist trae). */
const SWAGGER_MARK = 'id="swagger-ui"';
/** Aproximación declarada: la historia no define «interactiva»; se mide el contenedor de Swagger UI, no que el JavaScript de la página corra. */
const SWAGGER_NOTE =
  'Aproximación: la historia no define «página de documentación interactiva»; se mide que el HTML trae el contenedor de Swagger UI (id="swagger-ui"), no que su JavaScript se ejecute.';

// --- Esquema 1: la documentación es pública sin credenciales configuradas ----------------------------------------------------

const CONTENTS: ReadonlyMap<string, 'html' | 'json'> = new Map<string, 'html' | 'json'>([
  ['la página de documentación interactiva', 'html'],
  ['el documento OpenAPI en JSON', 'json'],
]);

const publicDocs: ApiRowHandler = async (row) => {
  const route = strict('ruta', DOCS_ROUTES, cell(row, 'ruta'));
  const kind = strict('contenido', CONTENTS, cell(row, 'contenido'));
  await prepareAlumno();
  // raw() no sigue redirecciones: una 3xx se ve como tal (estado y location)
  const res = await raw('GET', route);
  const type = res.headers.get('content-type') ?? '(sin content-type)';
  const evidence = { status: res.status, location: res.headers.get('location') };
  if (kind === 'html') {
    const marker = res.text.includes(SWAGGER_MARK);
    return judge(
      [
        statusCheck(res, 200),
        check(type.includes('text/html'), 'página HTML', `content-type ${type}`),
        check(marker, 'página de documentación interactiva (contenedor de Swagger UI)', `el HTML ${marker ? 'trae' : 'no trae'} el contenedor #swagger-ui (${res.text.length} caracteres)`),
      ],
      { note: SWAGGER_NOTE, evidence },
    );
  }
  const isObject = typeof res.body === 'object' && res.body !== null;
  return judge(
    [
      statusCheck(res, 200),
      check(type.includes('application/json') && isObject, 'documento JSON', `content-type ${type}, cuerpo ${isObject ? 'JSON' : 'no JSON'}`),
      check(typeof field(res.body, 'openapi') === 'string', 'documento OpenAPI (campo openapi)', `openapi ${show(field(res.body, 'openapi'))}`),
    ],
    { evidence },
  );
};

// --- Esquema 2: el documento identifica la API -------------------------------------------------------------------------------

const FIELDS: ReadonlyMap<string, readonly string[]> = new Map<string, readonly string[]>([
  ['info.title', ['info', 'title']],
  ['info.version', ['info', 'version']],
]);

const identifiesApi: ApiRowHandler = async (row) => {
  const path = strict('campo', FIELDS, cell(row, 'campo'));
  const wanted = cell(row, 'valor');
  await prepareAlumno();
  const res = await raw('GET', '/api/docs-json');
  let value: unknown = res.body;
  for (const key of path) value = field(value, key);
  // Regla sin Esquema, del mismo JSON: la descripción general dice que cada alumno trabaja en su tenant con la cabecera x-tenant
  const description = field(field(res.body, 'info'), 'description');
  const describesTenant = typeof description === 'string' && description.includes('Cada alumno trabaja en su tenant') && description.includes('x-tenant');
  return judge([
    statusCheck(res, 200),
    check(value === wanted, `${cell(row, 'campo')} ${wanted}`, `${cell(row, 'campo')} ${show(value)}`),
    check(describesTenant, 'la descripción general dice que cada alumno trabaja en su tenant con la cabecera x-tenant', `info.description ${show(description)}`),
  ]);
};

// --- Esquema 3: el documento agrupa cada ruta por su etiqueta ----------------------------------------------------------------

const OPERATIONS: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/health', '/api/health'],
  ['/api/config', '/api/config'],
  ['/api/config/tenants', '/api/config/tenants'],
  ['/api/config/test-users', '/api/config/test-users'],
  ['/api/auth/me', '/api/auth/me'],
  ['/api/programs', '/api/programs'],
]);

const groupedByTag: ApiRowHandler = async (row) => {
  const route = strict('ruta', OPERATIONS, cell(row, 'ruta'));
  const label = cell(row, 'etiqueta');
  await prepareAlumno();
  const res = await raw('GET', '/api/docs-json');
  const operation = field(field(field(res.body, 'paths'), route), 'get');
  const tags = field(operation, 'tags');
  // Reglas sin Esquema, del mismo JSON: el parámetro x-tenant es opcional con ayuda que dice que el valor por defecto es demo
  const parameters: readonly unknown[] = Array.isArray(field(operation, 'parameters')) ? (field(operation, 'parameters') as readonly unknown[]) : [];
  const tenantParam = parameters.find((entry) => field(entry, 'name') === 'x-tenant');
  const tenantOptional =
    field(tenantParam, 'in') === 'header' && field(tenantParam, 'required') !== true && String(field(tenantParam, 'description') ?? '').includes('demo');
  // Y los dos esquemas de seguridad: bearer (Authorization) y admin-key (cabecera X-Admin-Key)
  const schemes = field(field(res.body, 'components'), 'securitySchemes');
  const bearer = field(schemes, 'bearer');
  const adminKey = field(schemes, 'admin-key');
  return judge([
    statusCheck(res, 200),
    check(operation !== undefined, `contiene la operación GET ${route}`, operation === undefined ? `no contiene GET ${route}` : `contiene GET ${route}`),
    check(JSON.stringify(tags) === JSON.stringify([label]), `la operación GET ${route} va en la etiqueta ${label}`, `etiquetas ${show(tags)}`),
    check(tenantOptional, 'x-tenant aparece como opcional, con ayuda que dice que el valor por defecto es demo', `parámetro x-tenant ${show(tenantParam)}`),
    check(field(bearer, 'type') === 'http' && field(bearer, 'scheme') === 'bearer', 'esquema de seguridad bearer (token en Authorization)', `bearer ${show(bearer)}`),
    check(
      field(adminKey, 'type') === 'apiKey' && field(adminKey, 'in') === 'header' && String(field(adminKey, 'name') ?? '').toLowerCase() === 'x-admin-key',
      'esquema de seguridad admin-key (cabecera X-Admin-Key)',
      `admin-key ${show(adminKey)}`,
    ),
  ]);
};

// --- Esquema 4: con credenciales de documentación configuradas, las rutas piden HTTP Basic ----------------------------------------

const CREDENTIALS: ReadonlyMap<string, string> = new Map<string, string>([
  ['(sin credenciales)', '(sin credenciales)'],
  ['(credenciales incorrectas)', '(credenciales incorrectas)'],
  ['(las credenciales configuradas)', '(las credenciales configuradas)'],
]);

const docsWithCredentials: ApiRowHandler = async (row) => {
  const route = strict('ruta', DOCS_ROUTES, cell(row, 'ruta'));
  strict('credenciales', CREDENTIALS, cell(row, 'credenciales'));
  const expected = `${route} responde ${cell(row, 'respuesta')}`;
  // La pila aislada no define DOCS_BASIC_AUTH: no hay credenciales configuradas que probar (no es un fallo del arnés)
  return notExecutable(expected, DOCS_NOTE);
};

defineApiRows({
  story: 'US-API-PLATAFORMA-005',
  surface: 'api',
  tenants: [TENANT_A],
  handlers: new Map<number, ApiRowHandler>([
    [1, publicDocs],
    [2, identifiesApi],
    [3, groupedByTag],
    [4, docsWithCredentials],
  ]),
});
