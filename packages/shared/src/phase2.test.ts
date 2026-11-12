import { describe, expect, it, vi } from 'vitest';
import type { RequirementDto } from './api-types';
import { createApiClient, filenameFromDisposition } from './client';
import { requirementsToCsv } from './csv';
import { can } from './permissions';
import { createRequirementSchema, moveRequirementSchema, publishVersionSchema, runFieldsSchema, transitionRequirementSchema, updateProgramSchema, updateRequirementSchema } from './schemas';

describe('permisos de la fase 2', () => {
  it('requisitos: crear/editar para admin, gestor y consultor; eliminar solo admin y gestor', () => {
    for (const role of ['admin', 'program_manager', 'consultant'] as const) {
      expect(can(role, 'requirement.create')).toBe(true);
      expect(can(role, 'requirement.edit')).toBe(true);
    }
    expect(can('auditor', 'requirement.create')).toBe(false);
    expect(can('auditor', 'requirement.edit')).toBe(false);
    expect(can('admin', 'requirement.delete')).toBe(true);
    expect(can('program_manager', 'requirement.delete')).toBe(true);
    expect(can('consultant', 'requirement.delete')).toBe(false);
  });

  it('verificar: admin y consultor; ejecutar casos: admin y consultor; publicar versiones: admin y gestor', () => {
    expect(can('consultant', 'requirement.verify')).toBe(true);
    expect(can('program_manager', 'requirement.verify')).toBe(false);
    expect(can('auditor', 'requirement.verify')).toBe(false);
    expect(can('consultant', 'testrun.execute')).toBe(true);
    expect(can('auditor', 'testrun.execute')).toBe(false);
    expect(can('program_manager', 'document.publish')).toBe(true);
    expect(can('consultant', 'document.publish')).toBe(false);
  });
});

describe('esquemas de requisitos', () => {
  it('createRequirementSchema aplica valores por defecto, deduplica etiquetas y sanea la descripción', () => {
    const parsed = createRequirementSchema.parse({
      programCode: 'PRG-001',
      title: '  Cifrado del enlace  ',
      description: '<div><b>Texto</b><script>alert(1)</script></div>',
      tags: ['security', 'security', 'safety'],
    });
    expect(parsed).toMatchObject({ title: 'Cifrado del enlace', parentCode: null, priority: 'medium', tags: ['security', 'safety'], description: '<p><strong>Texto</strong></p>' });
  });

  it('los errores son claves i18n del espacio requisitos', () => {
    const short = createRequirementSchema.safeParse({ programCode: 'PRG-001', title: 'ab' });
    expect(short.success ? [] : short.error.issues.map((i) => i.message)).toEqual(['titleShort']);
    const tag = createRequirementSchema.safeParse({ programCode: 'PRG-001', title: 'Válido', tags: ['inexistente'] });
    expect(tag.success).toBe(false);
    const long = createRequirementSchema.safeParse({ programCode: 'PRG-001', title: 'Válido', description: 'x'.repeat(4001) });
    expect(long.success ? [] : long.error.issues.map((i) => i.message)).toEqual(['descLong']);
  });

  it('updateRequirementSchema exige al menos un campo', () => {
    expect(updateRequirementSchema.safeParse({}).success).toBe(false);
    expect(updateRequirementSchema.safeParse({ priority: 'high' }).success).toBe(true);
    expect(updateRequirementSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it('transición y movimiento', () => {
    expect(transitionRequirementSchema.safeParse({ to: 'approved' }).success).toBe(true);
    expect(transitionRequirementSchema.safeParse({ to: 'done' }).success).toBe(false);
    expect(moveRequirementSchema.safeParse({ targetCode: 'REQ-002', placement: 'after' }).success).toBe(true);
    expect(moveRequirementSchema.safeParse({ targetCode: 'REQ-002', placement: 'inside' }).success).toBe(false);
  });
});

describe('otros esquemas de la fase 2', () => {
  it('updateProgramSchema valida igual que el alta (fin posterior al inicio, presupuesto > 0)', () => {
    const base = { name: 'Programa editado', ownerId: 'u1', startDate: '2026-01-01', endDate: '2026-12-31', budget: 1000 };
    expect(updateProgramSchema.safeParse(base).success).toBe(true);
    const bad = updateProgramSchema.safeParse({ ...base, endDate: '2026-01-01', budget: 0 });
    expect(bad.success ? [] : bad.error.issues.map((i) => i.message).sort()).toEqual(['budgetPositive', 'endAfterStart']);
  });

  it('runFieldsSchema exige resultado y limita las notas', () => {
    expect(runFieldsSchema.safeParse({ result: 'pass' }).success).toBe(true);
    const missing = runFieldsSchema.safeParse({ notes: 'x' });
    expect(missing.success ? [] : missing.error.issues.map((i) => i.message)).toEqual(['resultRequired']);
    expect(runFieldsSchema.safeParse({ result: 'fail', notes: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('publishVersionSchema pide entre 1 y 80 líneas', () => {
    expect(publishVersionSchema.safeParse({ lines: ['a'] }).success).toBe(true);
    expect(publishVersionSchema.safeParse({ lines: [] }).success).toBe(false);
    expect(publishVersionSchema.safeParse({ lines: Array.from({ length: 81 }, () => 'x') }).success).toBe(false);
  });
});

describe('requirementsToCsv', () => {
  const requirement: RequirementDto = {
    code: 'REQ-017',
    programCode: 'PRG-002',
    parentCode: 'REQ-015',
    title: 'Cifrado "extremo a extremo"',
    description: '<p>x</p>',
    priority: 'high',
    state: 'draft',
    tags: ['security', 'safety'],
    position: 0,
    testCaseCodes: ['TC-017'],
    tests: [{ code: 'TC-017', lastResult: 'pass' }],
    ncs: [],
  };

  it('cabecera en inglés, título entrecomillado y listas separadas por |', () => {
    expect(requirementsToCsv([requirement])).toBe('code;title;state;priority;parent;tags;tests\nREQ-017;"Cifrado ""extremo a extremo""";draft;high;REQ-015;security|safety;TC-017');
  });
});

describe('cliente HTTP', () => {
  it('filenameFromDisposition entiende filename y filename*', () => {
    expect(filenameFromDisposition('attachment; filename="informe-PRG-001.pdf"')).toBe('informe-PRG-001.pdf');
    expect(filenameFromDisposition("attachment; filename*=UTF-8''Informe%20t%C3%A9cnico.pdf")).toBe('Informe técnico.pdf');
    expect(filenameFromDisposition(null)).toBeNull();
    expect(filenameFromDisposition('inline')).toBeNull();
  });

  it('envía FormData sin Content-Type (lo pone el navegador) y el resto como JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 'RUN-1' }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const api = createApiClient({ baseUrl: '/api', fetchImpl: fetchImpl as unknown as typeof fetch, getToken: () => 't' });
    const form = new FormData();
    form.set('result', 'pass');
    await api.testCases.execute('TC-001', form);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/test-cases/TC-001/runs');
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t');

    await api.requirements.transition('REQ-017', 'approved');
    const [, jsonInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(jsonInit.body).toBe('{"to":"approved"}');
    expect((jsonInit.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('las descargas devuelven el blob y el nombre de la cabecera', async () => {
    const fetchImpl = vi.fn(
      async () => new Response('%PDF-', { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="informe.pdf"' } }),
    );
    const api = createApiClient({ baseUrl: '/api', fetchImpl: fetchImpl as unknown as typeof fetch });
    const download = await api.testCases.report({ program: 'PRG-001' });
    expect(download.filename).toBe('informe.pdf');
    expect(await download.blob.text()).toBe('%PDF-');
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe('/api/verification/report?program=PRG-001');
  });
});

describe('updateProgramSchema (PATCH parcial)', () => {
  it('no inyecta valores por defecto: un campo ausente sigue ausente', () => {
    const parsed = updateProgramSchema.parse({ name: 'Nombre nuevo' });
    expect(parsed).toEqual({ name: 'Nombre nuevo' });
  });

  it('un cuerpo vacío es inválido y las fechas incoherentes se detectan si llegan las dos', () => {
    const empty = updateProgramSchema.safeParse({});
    expect(empty.success ? [] : empty.error.issues.map((i) => i.message)).toEqual(['nothingToUpdate']);
    expect(updateProgramSchema.safeParse({ startDate: '2026-05-01' }).success).toBe(true);
    expect(updateProgramSchema.safeParse({ startDate: '2026-05-01', endDate: '2026-04-01' }).success).toBe(false);
  });
});
