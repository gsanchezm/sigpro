// Verifica DESDE FUERA que un despliegue de SIGPRO (API + web) está endurecido como se espera. Pensado para ejecutarse contra Render
// después de activar las variables, y también contra una pila local.
//
//   pnpm verify:hardening --api=<url> --web=<url> --expect=noindex|full [--app-env=qa|staging]
//
//   --api       URL de la API; con o sin el /api final (https://sigpro-api.onrender.com/api).
//   --web       URL de la web (https://sigpro-web.onrender.com).
//   --expect    noindex → solo lo que se aplica al fusionar render.yaml (sin indexar) + la lista de tenants privada.
//               full    → lo anterior + correos reales rechazados, sin credenciales de demo sin sesión, bundle limpio y APP_ENV.
//   --app-env   OBLIGATORIO con `full`: el APP_ENV que debe devolver GET /api/config (`qa` en QA, `staging` en Staging).
//
// SOLO LECTURA. Todo son peticiones GET salvo cuatro POST que no pueden escribir nada:
//   - POST /auth/forgot: responde 202 y NO hace nada (ni lee ni escribe), exista o no el correo; con la restricción de correos activa,
//     responde 422 sin tocar nada.
//   - POST /auth/register contra un tenant que NO EXISTE: la restricción se comprueba antes de buscar el tenant, así que, o responde 422
//     (restringido), o responde 404 `tenant_not_found` (sin restricción) antes de escribir. Nunca se crea un usuario.
// No lleva ni envía ninguna clave. No imprime el contenido de ninguna respuesta (solo estados, códigos y recuentos).
//
// Código de salida: 0 todo correcto · 1 alguna comprobación falla · 2 uso incorrecto.
//
// LO QUE NO COMPRUEBA (necesita un navegador): que /lab sin sesión redirija a /login ni cómo se pinta la pantalla de acceso. Lo que SÍ se
// comprueba es lo que decide eso: lo que la API entrega sin sesión (`/config`, `/config/test-users`) y lo que lleva el JavaScript publicado.
// Con la web cerrada, ese comportamiento lo cubre el e2e `e2e/tests/hardened/lab-web.spec.ts` (en local).
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { checkFiles, collectSite } from './check-bundle.mjs';

const NOINDEX = /noindex/i;
const DISALLOW_ALL = /^Disallow:\s*\/\s*$/m;
const looksLikeHtml = (contentType, body) => /text\/html/i.test(contentType ?? '') || /^\s*<(!doctype|html)\b/i.test(body.slice(0, 200));

/** Dominio reservado (RFC 2606): no es de nadie y no está en ninguna lista de correos permitidos. */
const FORBIDDEN_DOMAIN_EMAIL = 'comprobacion@dominio-no-permitido.invalid';
/** El dominio que usa el propio seed para los administradores de alumno: tiene que estar admitido. */
const ALLOWED_DOMAIN_EMAIL = 'comprobacion@sigpro.lab';

class Failure extends Error {}
const fail = (message) => {
  throw new Failure(message);
};

/** Cliente mínimo: nunca lanza por estados HTTP, solo por red; devuelve `{ status, headers, text, json }`. */
const makeClient = (fetchImpl, timeoutMs) => async (url, init = {}) => {
  const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), ...init, headers: { 'user-agent': 'sigpro-verify-hardening', ...init.headers } });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* no es JSON */
  }
  return { status: response.status, headers: response.headers, text, json };
};

const registerBody = (email) => ({ first: 'Comprobacion', last: 'Endurecimiento', email, org: 'Verificacion', role: 'auditor', password: 'Abcdefghij1!', confirm: 'Abcdefghij1!', terms: true });

/** Las comprobaciones. `level`: `noindex` las corre siempre; `full` solo con --expect=full. */
const CHECKS = [
  {
    id: 'api-x-robots-tag',
    level: 'noindex',
    title: 'API: cabecera X-Robots-Tag noindex en todas las respuestas',
    run: async ({ call, api }) => {
      const seen = [];
      for (const path of ['/health', '/config/tenants']) {
        const response = await call(`${api}${path}`);
        if (!NOINDEX.test(response.headers.get('x-robots-tag') ?? '')) fail(`GET ${path} (${response.status}) no lleva X-Robots-Tag con noindex (ROBOTS_NOINDEX en la API)`);
        seen.push(response.status);
      }
      return `presente en /health y /config/tenants (estados ${seen.join(', ')})`;
    },
  },
  {
    id: 'api-robots-txt',
    level: 'noindex',
    title: 'API: /robots.txt con Disallow total',
    run: async ({ call, origin }) => {
      const response = await call(`${origin}/robots.txt`);
      if (response.status !== 200) fail(`GET /robots.txt → ${response.status} (la API sirve robots.txt en la raíz, con ROBOTS_NOINDEX=true)`);
      if (looksLikeHtml(response.headers.get('content-type'), response.text)) fail('GET /robots.txt devuelve HTML, no un robots.txt');
      if (!DISALLOW_ALL.test(response.text)) fail('GET /robots.txt no prohíbe todo el rastreo (falta «Disallow: /»)');
      return 'robots.txt real con «Disallow: /»';
    },
  },
  {
    id: 'web-x-robots-tag',
    level: 'noindex',
    title: 'Web: cabecera X-Robots-Tag noindex (headers del sitio estático)',
    run: async ({ call, web }) => {
      for (const path of ['/', '/lab']) {
        const response = await call(`${web}${path}`);
        if (!NOINDEX.test(response.headers.get('x-robots-tag') ?? '')) fail(`GET ${path} (${response.status}) no lleva X-Robots-Tag con noindex (bloque headers: de render.yaml)`);
      }
      return 'presente en / y en /lab';
    },
  },
  {
    id: 'web-robots-txt',
    level: 'noindex',
    title: 'Web: /robots.txt es un archivo real (no el index.html de la reescritura)',
    run: async ({ call, web }) => {
      const response = await call(`${web}/robots.txt`);
      if (response.status !== 200) fail(`GET /robots.txt → ${response.status}`);
      if (looksLikeHtml(response.headers.get('content-type'), response.text)) fail('GET /robots.txt devuelve index.html: la reescritura /* → /index.html tapa el archivo (¿compilada sin VITE_NOINDEX=true?)');
      if (!DISALLOW_ALL.test(response.text)) fail('GET /robots.txt no prohíbe todo el rastreo (falta «Disallow: /»)');
      return `robots.txt real con «Disallow: /» (${response.headers.get('content-type') ?? 'sin content-type'})`;
    },
  },
  {
    id: 'web-meta-noindex',
    level: 'noindex',
    title: 'Web: <meta name="robots" content="noindex…"> en index.html',
    run: async ({ call, web }) => {
      const response = await call(`${web}/`);
      if (response.status !== 200) fail(`GET / → ${response.status}`);
      if (!/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(response.text)) fail('index.html no lleva la meta robots noindex (compilar con VITE_NOINDEX=true)');
      return 'meta robots noindex presente';
    },
  },
  {
    id: 'api-tenants-privado',
    level: 'noindex',
    title: 'API: GET /config/tenants sin clave responde 403',
    run: async ({ call, api }) => {
      const response = await call(`${api}/config/tenants`);
      if (response.status === 200) {
        const count = Array.isArray(response.json) ? response.json.length : '?';
        fail(`responde 200 con ${count} tenants: la lista es PÚBLICA. Se vuelve privada con TENANT_SUFFIX_SEED o con LAB_PUBLIC=false`);
      }
      if (response.status !== 403) fail(`responde ${response.status} (se esperaba 403 admin_key_required)`);
      return `403${response.json?.code ? ` ${response.json.code}` : ''}`;
    },
  },
  {
    id: 'api-registro-dominio',
    level: 'full',
    title: 'API: register con un correo de otro dominio → 422 (y con sigpro.lab, no)',
    run: async ({ call, api, ghostTenant }) => {
      const post = (email) => call(`${api}/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-tenant': ghostTenant }, body: JSON.stringify(registerBody(email)) });
      const refused = await post(FORBIDDEN_DOMAIN_EMAIL);
      if (refused.status === 404) fail('con un dominio no permitido responde 404 tenant_not_found: la restricción de correos está APAGADA (RESTRICT_EMAIL_DOMAINS=true)');
      if (refused.status !== 422 || refused.json?.code !== 'email_domain_not_allowed') fail(`con un dominio no permitido responde ${refused.status} ${refused.json?.code ?? ''}`.trim() + ' (se esperaba 422 email_domain_not_allowed)');
      const control = await post(ALLOWED_DOMAIN_EMAIL);
      if (control.json?.code === 'email_domain_not_allowed') fail('el dominio sigpro.lab (el de los usuarios de alumno) también se rechaza: revisa ALLOWED_EMAIL_DOMAINS');
      if (control.status !== 404) fail(`el control con sigpro.lab responde ${control.status} ${control.json?.code ?? ''}`.trim() + ' (se esperaba 404 tenant_not_found: el tenant de la sonda no existe)');
      return '422 email_domain_not_allowed con un dominio no permitido; con sigpro.lab pasa el filtro (404 tenant_not_found, sin escribir nada)';
    },
  },
  {
    id: 'api-forgot-dominio',
    level: 'full',
    title: 'API: forgot con un correo de otro dominio → 422 (y con sigpro.lab → 202)',
    run: async ({ call, api }) => {
      const post = (email) => call(`${api}/auth/forgot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const refused = await post(FORBIDDEN_DOMAIN_EMAIL);
      if (refused.status === 202) fail('con un dominio no permitido responde 202: la restricción de correos está APAGADA (RESTRICT_EMAIL_DOMAINS=true)');
      if (refused.status !== 422 || refused.json?.code !== 'email_domain_not_allowed') fail(`con un dominio no permitido responde ${refused.status} ${refused.json?.code ?? ''}`.trim());
      const control = await post(ALLOWED_DOMAIN_EMAIL);
      if (control.status !== 202) fail(`con sigpro.lab responde ${control.status} ${control.json?.code ?? ''}`.trim() + ' (se esperaba 202): «olvidé mi contraseña» fallaría con los usuarios de alumno');
      return '422 con un dominio no permitido; 202 con sigpro.lab';
    },
  },
  {
    id: 'api-sin-credenciales-anonimas',
    level: 'full',
    title: 'API: sin sesión no entrega usuarios de prueba (lo que alimenta /lab y la pantalla de acceso)',
    run: async ({ call, api }) => {
      const users = await call(`${api}/config/test-users`, { headers: { 'x-tenant': 'demo' } });
      if (users.status !== 200) fail(`GET /config/test-users → ${users.status}`);
      if (!Array.isArray(users.json)) fail('GET /config/test-users no devuelve una lista');
      if (users.json.length > 0) fail(`GET /config/test-users devuelve ${users.json.length} usuarios de demo SIN sesión (LAB_PUBLIC=false)`);
      const config = await call(`${api}/config`, { headers: { 'x-tenant': 'demo' } });
      if (config.status !== 200) fail(`GET /config → ${config.status}`);
      if (config.json?.testUsers !== false) fail('GET /config anuncia testUsers distinto de false: la pantalla de acceso mostraría el panel de usuarios de prueba (LAB_PUBLIC=false)');
      return '/config/test-users → [] y /config → testUsers:false';
    },
  },
  {
    id: 'api-app-env',
    level: 'full',
    title: 'API: GET /config devuelve el APP_ENV esperado',
    run: async ({ call, api, appEnv }) => {
      const config = await call(`${api}/config`, { headers: { 'x-tenant': 'demo' } });
      if (config.status !== 200) fail(`GET /config → ${config.status}`);
      if (config.json?.env !== appEnv) fail(`env «${config.json?.env ?? '(sin campo)'}» ≠ esperado «${appEnv}»`);
      return `env = ${appEnv}`;
    },
  },
  {
    id: 'web-bundle',
    level: 'full',
    title: 'Web: lo publicado no lleva credenciales de demo ni el zip del material (rastreo del bundle publicado)',
    run: async ({ web, fetchImpl, timeoutMs }) => {
      const { files, notes } = await collectSite(web, { fetchImpl, timeoutMs });
      const incomplete = notes.filter((note) => /no se pudo descargar|tope de/.test(note));
      if (incomplete.length > 0) fail(`rastreo incompleto, no se puede dar por limpio: ${incomplete.join('; ')}`);
      if (!files.some((file) => file.name.endsWith('.js'))) fail('el rastreo no encontró ningún JavaScript: no se pudo inspeccionar el bundle');
      const problems = checkFiles(files, { closed: true, noindex: true });
      if (problems.length > 0) fail(`${problems.length} problema(s): ${problems.join('; ')}`);
      return `${files.length} archivos descargados (${files.filter((file) => file.name.endsWith('.js')).length} JS): ni contraseñas, ni correos de demo, ni código MFA, ni zip`;
    },
  },
];

/**
 * Ejecuta las comprobaciones de `expect` y devuelve `[{ id, title, ok, detail }]`. Una comprobación que falla por red se informa como
 * fallo (no se interrumpe el resto).
 */
export const verifyHardening = async ({ api, web, expect, appEnv, fetchImpl = fetch, timeoutMs = 30_000 }) => {
  const apiUrl = new URL(api);
  const apiBase = `${apiUrl.origin}${apiUrl.pathname.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
  const webBase = new URL(web).toString().replace(/\/+$/, '');
  const context = {
    api: apiBase,
    origin: apiUrl.origin,
    web: webBase,
    appEnv,
    fetchImpl,
    timeoutMs,
    call: makeClient(fetchImpl, timeoutMs),
    ghostTenant: `comprobacion-${randomBytes(4).toString('hex')}`, // un tenant que no existe
  };
  const results = [];
  for (const check of CHECKS.filter((item) => item.level === 'noindex' || expect === 'full')) {
    try {
      results.push({ id: check.id, title: check.title, ok: true, detail: await check.run(context) });
    } catch (error) {
      const detail = error instanceof Failure ? error.message : `error de red o inesperado: ${error instanceof Error ? error.message : String(error)}`;
      results.push({ id: check.id, title: check.title, ok: false, detail });
    }
  }
  return results;
};

const USAGE = 'Uso: pnpm verify:hardening --api=<url> --web=<url> --expect=noindex|full [--app-env=qa|staging]\n       (con --expect=full, --app-env es obligatorio)';

/** Lee `--clave=valor` y `--clave valor`. */
export const parseArgs = (argv) => {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const match = /^--([a-z-]+)(?:=(.*))?$/.exec(argv[index] ?? '');
    if (!match) return { error: `argumento no reconocido: ${argv[index]}` };
    values[match[1]] = match[2] ?? argv[(index += 1)];
  }
  return { values };
};

const isHttpUrl = (value) => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const main = async () => {
  const { values, error } = parseArgs(process.argv.slice(2));
  const problem =
    error ??
    (!values.api || !isHttpUrl(values.api) ? '--api debe ser una URL http(s)' : null) ??
    (!values.web || !isHttpUrl(values.web) ? '--web debe ser una URL http(s)' : null) ??
    (!['noindex', 'full'].includes(values.expect ?? '') ? '--expect debe ser noindex o full' : null) ??
    (values.expect === 'full' && !values['app-env'] ? '--expect=full exige --app-env=<valor> (el APP_ENV esperado en /api/config)' : null);
  if (problem) {
    console.error(`${problem}\n${USAGE}`);
    process.exit(2);
  }
  const options = { api: values.api, web: values.web, expect: values.expect, appEnv: values['app-env'] };
  console.log(`verify:hardening (solo lectura)\n  API ${options.api}\n  Web ${options.web}\n  Esperado: ${options.expect}${options.expect === 'full' ? ` · APP_ENV=${options.appEnv}` : ''}\n`);
  const results = await verifyHardening(options);
  for (const result of results) console.log(`  ${result.ok ? '✓' : '✗'} ${result.id.padEnd(30)} ${result.ok ? result.detail : `${result.title}\n      → ${result.detail}`}`);
  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length} comprobaciones · ${results.length - failed.length} correctas · ${failed.length} fallidas`);
  if (failed.length > 0) {
    console.error('FALLO: este despliegue NO cumple lo esperado.');
    // `process.exitCode` y no `process.exit()`: en Windows, salir de golpe con conexiones de `fetch` abiertas aborta Node (0xC0000409)
    // y el código de salida deja de ser 1.
    process.exitCode = 1;
    return;
  }
  console.log('OK: este despliegue cumple lo esperado.');
  if (options.expect === 'full') console.log('(No comprueba la redirección de /lab a /login ni la pantalla de acceso renderizada: ver la cabecera de apps/web/scripts/verify-hardening.mjs.)');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
