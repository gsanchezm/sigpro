import { field } from '../../../story-runs/support/api';
import { TENANT_A } from '../../../story-runs/support/prepare';
import { cell, check, strict } from '../../support/checks';
import { defineApiRows, notExecutable, type ApiRowHandler } from '../../core/framework';
import { DOCS_NOTE, prepareAlumno, raw, show, statusCheck, judge } from './common';

// US-API-PLATAFORMA-005 — Publicar la documentación OpenAPI en /api/docs. Preparación de cada fila: alumno01 reiniciado y caos apagado.
// Los Esquemas 1 a 3 necesitan que la API no tenga credenciales de documentación (la pila aislada no las tiene). El Esquema 4 las exige
// configuradas: la pila aislada se lanza sin DOCS_BASIC_AUTH (docs/story-runs/entorno/env.sh), así que se devuelve notExecutable.
// Las reglas sin Esquema (descripción, esquemas de seguridad, cabecera x-tenant en las operaciones) no dan veredicto: no se ejecutan aquí.

const DOCS_ROUTES: ReadonlyMap<string, string> = new Map<string, string>([
  ['/api/docs', '/api/docs'],
  ['/api/docs-json', '/api/docs-json'],
]);

// --- Esquema 1: la documentación es pública sin credenciales configuradas ----------------------------------------------------

const CONTENTS: ReadonlyMap<string, 'html' | 'json'> = new Map<string, 'html' | 'json'>([
  ['la página de documentación interactiva', 'html'],
  ['el documento OpenAPI en JSON', 'json'],
]);

const publicDocs: ApiRowHandler = async (row) => {
  const route = strict('ruta', DOCS_ROUTES, cell(row, 'ruta'));
  const kind = strict('contenido', CONTENTS, cell(row, 'contenido'));
  await prepareAlumno();
  const res = await raw('GET', route);
  const type = res.headers.get('content-type') ?? '(sin content-type)';
  if (kind === 'html') {
    const swagger = res.text.toLowerCase().includes('swagger');
    return judge([
      statusCheck(res, 200),
      check(type.includes('text/html'), 'página HTML', `content-type ${type}`),
      check(swagger, 'página de documentación interactiva (Swagger UI)', `el HTML ${swagger ? 'menciona' : 'no menciona'} Swagger (${res.text.length} caracteres)`),
    ]);
  }
  const isObject = typeof res.body === 'object' && res.body !== null;
  return judge([
    statusCheck(res, 200),
    check(type.includes('application/json') && isObject, 'documento JSON', `content-type ${type}, cuerpo ${isObject ? 'JSON' : 'no JSON'}`),
    check(typeof field(res.body, 'openapi') === 'string', 'documento OpenAPI (campo openapi)', `openapi ${show(field(res.body, 'openapi'))}`),
  ]);
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
  return judge([statusCheck(res, 200), check(value === wanted, `${cell(row, 'campo')} ${wanted}`, `${cell(row, 'campo')} ${show(value)}`)]);
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
  return judge([
    statusCheck(res, 200),
    check(operation !== undefined, `contiene la operación GET ${route}`, operation === undefined ? `no contiene GET ${route}` : `contiene GET ${route}`),
    check(JSON.stringify(tags) === JSON.stringify([label]), `la operación GET ${route} va en la etiqueta ${label}`, `etiquetas ${show(tags)}`),
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
