import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';

// Guardián de los Blueprints de Render. `render.yaml` está sincronizado con los servicios VIVOS de QA («Blueprint managed» sobre
// main): lo que se escriba aquí se aplica solo al fusionar. Estas pruebas fijan lo que no debe cambiar por descuido.
// (La validez frente al esquema oficial de Render, https://render.com/schema/render.yaml.json, se comprobó aparte: no se descarga aquí.)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (name) => load(readFileSync(join(ROOT, name), 'utf8'));
const qa = read('render.yaml');
const staging = read('render.staging.yaml');

/** Medidas de endurecimiento que se activan A MANO en el panel: con `value:` en un Blueprint se aplicarían solas y pisarían el panel. */
const HAND_SWITCHES = ['TENANT_SUFFIX_SEED', 'TENANT_SUFFIX_LENGTH', 'LAB_PUBLIC', 'RESTRICT_EMAIL_DOMAINS', 'ALLOWED_EMAIL_DOMAINS', 'VITE_LAB_PUBLIC'];
/** Secretos: nunca con valor en el repositorio. */
const SECRETS = ['JWT_SECRET', 'ADMIN_KEY', 'DOCS_BASIC_AUTH', 'TENANT_SUFFIX_SEED'];

const byName = (document) => Object.fromEntries([...(document.services ?? []), ...(document.databases ?? [])].map((resource) => [resource.name, resource]));
const envVars = (service) => service.envVars ?? [];
const env = (service, key) => envVars(service).find((variable) => variable.key === key);

describe.each([
  ['render.yaml (QA)', qa, { db: 'sigpro-db', api: 'sigpro-api', web: 'sigpro-web', cron: 'sigpro-reset' }],
  ['render.staging.yaml (Staging)', staging, { db: 'sigpro-staging-db', api: 'sigpro-staging-api', web: 'sigpro-staging-web', cron: 'sigpro-staging-reset' }],
])('%s', (_label, document, names) => {
  const resources = byName(document);

  it('define exactamente la base, la API, la web y el cron, con estos nombres', () => {
    expect(Object.keys(resources).sort()).toEqual(Object.values(names).sort());
  });

  it('la base, la API y el cron declaran region: oregon de forma explícita', () => {
    for (const name of [names.db, names.api, names.cron]) expect(resources[name].region, name).toBe('oregon');
  });

  it('el sitio estático NO declara region ni plan (el esquema de Render los prohíbe)', () => {
    expect(resources[names.web]).not.toHaveProperty('region');
    expect(resources[names.web]).not.toHaveProperty('plan');
  });

  it('los planes de la base y de la API son los vigentes', () => {
    expect(resources[names.db].plan).toBe('basic-256mb');
    expect(resources[names.api].plan).toBe('starter');
  });

  it('ninguna medida de endurecimiento se declara con value: (se activan a mano en el panel)', () => {
    for (const service of document.services) {
      for (const key of HAND_SWITCHES) expect(env(service, key), `${service.name}.${key}`).toBeUndefined();
    }
  });

  it('los secretos son sync: false y no llevan valor', () => {
    for (const service of document.services) {
      for (const variable of envVars(service).filter((item) => SECRETS.includes(item.key))) {
        expect(variable.sync, `${service.name}.${variable.key}`).toBe(false);
        expect(variable, `${service.name}.${variable.key}`).not.toHaveProperty('value');
      }
    }
    expect(env(resources[names.api], 'JWT_SECRET')).toBeDefined();
    expect(env(resources[names.api], 'ADMIN_KEY')).toBeDefined();
    expect(env(resources[names.cron], 'ADMIN_KEY')).toBeDefined();
  });

  it('sin indexar: cabecera X-Robots-Tag en el sitio estático, VITE_NOINDEX en su compilación y ROBOTS_NOINDEX en la API', () => {
    expect(resources[names.web].headers).toEqual([{ path: '/*', name: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
    expect(env(resources[names.web], 'VITE_NOINDEX')?.value).toBe('true');
    expect(env(resources[names.api], 'ROBOTS_NOINDEX')?.value).toBe('true');
  });

  it('conserva la reescritura /* → /index.html del router y la base compartida por fromDatabase', () => {
    expect(resources[names.web].routes).toEqual([{ type: 'rewrite', source: '/*', destination: '/index.html' }]);
    expect(env(resources[names.api], 'DATABASE_URL')?.fromDatabase).toEqual({ name: names.db, property: 'connectionString' });
  });
});

describe('render.yaml (QA): lo que ya existe no cambia', () => {
  const resources = byName(qa);
  it('el cron sigue sin plan declarado (Render conserva el actual) y el reset sigue a las 03:00 UTC', () => {
    expect(resources['sigpro-reset']).not.toHaveProperty('plan');
    expect(resources['sigpro-reset'].schedule).toBe('0 3 * * *');
  });

  it('APP_ENV y PLANTED_BUGS de QA conservan sus valores (el material del curso los lee)', () => {
    expect(env(resources['sigpro-api'], 'APP_ENV')?.value).toBe('staging');
    expect(env(resources['sigpro-api'], 'PLANTED_BUGS')?.value).toBe('true');
  });

  it('no hay ningún servicio de Staging dentro de este archivo: fusionarlo los crearía', () => {
    expect(Object.keys(resources).filter((name) => /staging/i.test(name))).toEqual([]);
  });
});

describe('render.staging.yaml (Staging)', () => {
  const resources = byName(staging);

  it('Staging: APP_ENV=staging y PLANTED_BUGS=false, en la misma región que QA', () => {
    expect(env(resources['sigpro-staging-api'], 'APP_ENV')?.value).toBe('staging');
    expect(env(resources['sigpro-staging-api'], 'PLANTED_BUGS')?.value).toBe('false');
    expect(resources['sigpro-staging-db'].region).toBe(byName(qa)['sigpro-db'].region);
  });

  it('sus URLs apuntan a Staging y no a QA (CORS_ORIGIN, VITE_API_URL, API_URL)', () => {
    expect(env(resources['sigpro-staging-api'], 'CORS_ORIGIN')?.value).toBe('https://sigpro-staging-web.onrender.com');
    expect(env(resources['sigpro-staging-web'], 'VITE_API_URL')?.value).toBe('https://sigpro-staging-api.onrender.com/api');
    expect(env(resources['sigpro-staging-reset'], 'API_URL')?.value).toBe('https://sigpro-staging-api.onrender.com/api');
  });

  it('no comparte con QA ningún nombre de recurso (no puede «adoptar» servicios de QA)', () => {
    const qaNames = new Set(Object.keys(byName(qa)));
    expect(Object.keys(resources).filter((name) => qaNames.has(name))).toEqual([]);
  });

  it('el cron de Staging, que es un recurso NUEVO, declara plan starter', () => {
    expect(resources['sigpro-staging-reset'].plan).toBe('starter');
  });
});
