import { describe, expect, it } from 'vitest';
import { buildTenantSeed, tenantIds } from './data';
import { tenantRows, toCsv, toTable } from './tenants-list';

const options = { seed: '0123456789abcdef', length: 4 } as const;
const ids = tenantIds(3, options);

describe('tenantRows', () => {
  it('lista solo los tenants de alumno: demo es público y no se reparte', () => {
    expect(tenantRows(ids).map((row) => row.tenant)).toEqual(ids.slice(1));
  });

  it('el correo del administrador coincide con el que crea el seed (una sola fuente de verdad)', () => {
    for (const row of tenantRows(ids)) {
      const student = buildTenantSeed(row.tenant, (plain) => `h(${plain})`).users.find((user) => user.id === 'u7');
      expect(student?.email).toBe(row.email);
    }
  });

  it('añade el enlace de acceso solo si se da la URL de la web, sin barras de más', () => {
    expect(tenantRows(ids)[0]?.url).toBe('');
    expect(tenantRows(ids, 'https://web.example/')[0]?.url).toBe(`https://web.example/login?tenant=${ids[1]}`);
  });
});

describe('formatos', () => {
  const rows = tenantRows(ids, 'https://web.example');

  it('toTable alinea las columnas y no deja columnas vacías', () => {
    const table = toTable(tenantRows(ids)).split('\n');
    expect(table[0]).toMatch(/^tenant\s+email$/);
    expect(table).toHaveLength(2 + 3);
  });

  it('toCsv escribe cabecera y una fila por tenant, sin comillas si no hacen falta', () => {
    const csv = toCsv(rows).split('\n');
    expect(csv[0]).toBe('tenant,email,url');
    expect(csv).toHaveLength(4);
    expect(csv[1]).toBe(`${ids[1]},${ids[1]}@sigpro.lab,https://web.example/login?tenant=${ids[1]}`);
  });

  it('toCsv entrecomilla lo que lleve comas o comillas', () => {
    expect(toCsv([{ tenant: 'a,b', email: 'c"d', url: '' }])).toBe('tenant,email,url\n"a,b","c""d",');
  });
});
