import { messages } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { ACCESS_LABEL, ACCESS_ROLES, LAB_ENDPOINTS, docsLinks } from './endpoints';

describe('lista de endpoints de /lab', () => {
  it('cada endpoint tiene un id único y una ruta absoluta', () => {
    const ids = LAB_ENDPOINTS.map((endpoint) => endpoint.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const endpoint of LAB_ENDPOINTS) {
      expect(endpoint.path.startsWith('/')).toBe(true);
      expect(endpoint.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('no repite método + ruta', () => {
    const keys = LAB_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('todas las descripciones y niveles de acceso existen en los dos idiomas', () => {
    for (const lang of ['es', 'en'] as const) {
      const lab = messages[lang].lab;
      for (const endpoint of LAB_ENDPOINTS) {
        expect(lab[endpoint.description], `${lang}:${endpoint.description}`).toBeTruthy();
        expect(lab[ACCESS_LABEL[endpoint.access]], `${lang}:${endpoint.access}`).toBeTruthy();
      }
    }
  });

  it('el admin puede llamar a todos los endpoints', () => {
    for (const endpoint of LAB_ENDPOINTS) {
      const roles = ACCESS_ROLES[endpoint.access];
      expect(roles === 'all' || roles.includes('admin')).toBe(true);
    }
  });

  it('cubre los endpoints que usan las sesiones del curso', () => {
    const keys = new Set(LAB_ENDPOINTS.map((endpoint) => `${endpoint.method} ${endpoint.path}`));
    for (const expected of ['POST /auth/login', 'GET /programs', 'POST /admin/reset', 'PATCH /admin/chaos', 'GET /verification/report', 'POST /mission/tick']) {
      expect(keys.has(expected), expected).toBe(true);
    }
  });
});

describe('docsLinks', () => {
  it('con la API relativa de desarrollo apunta a /api/docs', () => {
    expect(docsLinks('/api')).toEqual({ swagger: '/api/docs', json: '/api/docs-json' });
  });

  it('con la API absoluta de Render apunta al servicio de la API, no a la web estática', () => {
    expect(docsLinks('https://sigpro-api.onrender.com/api/')).toEqual({
      swagger: 'https://sigpro-api.onrender.com/api/docs',
      json: 'https://sigpro-api.onrender.com/api/docs-json',
    });
  });
});
