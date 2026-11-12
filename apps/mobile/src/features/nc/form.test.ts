import type { NcDetailDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_NEW_DRAFT, buildChanges, createInputOf, descriptionChanged, editDraftOf, hasChanges, validateCreate, validateUpdate } from './form';

const nc = (patch: Partial<NcDetailDto> = {}): NcDetailDto => ({
  code: 'NC-012',
  programCode: 'PRG-002',
  programName: 'Sistema de navegación',
  severity: 'critical',
  description: '<p>Fallo del enlace de datos</p><ul><li>Primer punto</li><li>Segundo punto</li></ul>',
  state: 'open',
  assigneeId: 'u1',
  assigneeName: 'Javier Ortega',
  testRunId: null,
  commentCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  comments: [],
  transitions: ['in_analysis'],
  ...patch,
});

describe('alta', () => {
  it('sin elegir nada, el esquema devuelve las tres claves de la web', () => {
    const result = validateCreate(createInputOf(EMPTY_NEW_DRAFT));
    expect(result).toEqual({ success: false, errors: { programCode: 'programRequired', severity: 'severityRequired', description: 'descShort' } });
  });

  it('una descripción de menos de 10 caracteres es descShort aunque lleve espacios', () => {
    const result = validateCreate(createInputOf({ programCode: 'PRG-002', severity: 'major', description: '   corta   ' }));
    expect(result).toEqual({ success: false, errors: { description: 'descShort' } });
  });

  it('un alta válida lleva el texto como párrafos, sin asignar y con la severidad elegida', () => {
    const result = validateCreate(createInputOf({ programCode: 'PRG-002', severity: 'critical', description: 'Fallo intermitente del enlace\n\nSegunda línea' }));
    expect(result).toEqual({
      success: true,
      data: { programCode: 'PRG-002', severity: 'critical', description: '<p>Fallo intermitente del enlace</p><p>Segunda línea</p>', assigneeId: null },
    });
  });

  it('escapa el HTML de lo escrito', () => {
    const body = createInputOf({ programCode: 'PRG-002', severity: 'minor', description: 'x < y & <b>negrita</b> larga' });
    expect(body.description).toBe('<p>x &lt; y &amp; &lt;b&gt;negrita&lt;/b&gt; larga</p>');
  });
});

describe('edición: borrador y cambios', () => {
  it('el borrador parte de la NC: texto plano con viñetas y «sin asignar» como cadena vacía', () => {
    expect(editDraftOf(nc())).toEqual({ severity: 'critical', description: 'Fallo del enlace de datos\n• Primer punto\n• Segundo punto', assigneeId: 'u1' });
    expect(editDraftOf(nc({ assigneeId: null })).assigneeId).toBe('');
  });

  it('sin tocar nada no hay cambios', () => {
    const item = nc();
    const changes = buildChanges(item, editDraftOf(item));
    expect(changes).toEqual({});
    expect(hasChanges(changes)).toBe(false);
  });

  it('solo viaja la severidad si solo cambió la severidad: la descripción regenerada no se reenvía', () => {
    const item = nc();
    const changes = buildChanges(item, { ...editDraftOf(item), severity: 'major' });
    expect(changes).toEqual({ severity: 'major' });
  });

  it('los saltos de línea sobrantes de la descripción no cuentan como cambio', () => {
    const item = nc();
    const draft = { ...editDraftOf(item), description: '  Fallo del enlace de datos \n\n• Primer punto\n• Segundo punto\n\n' };
    expect(descriptionChanged(item, draft)).toBe(false);
    expect(buildChanges(item, draft)).toEqual({});
  });

  it('cambiar el texto envía la descripción entera como párrafos', () => {
    const item = nc();
    const changes = buildChanges(item, { ...editDraftOf(item), description: 'Texto nuevo de la descripción' });
    expect(changes).toEqual({ description: '<p>Texto nuevo de la descripción</p>' });
  });

  it('quitar la asignación envía null; asignar a otra persona, su id; dejarla igual, nada', () => {
    const item = nc();
    expect(buildChanges(item, { ...editDraftOf(item), assigneeId: '' })).toEqual({ assigneeId: null });
    expect(buildChanges(item, { ...editDraftOf(item), assigneeId: 'u2' })).toEqual({ assigneeId: 'u2' });
    expect(buildChanges(nc({ assigneeId: null }), { ...editDraftOf(nc({ assigneeId: null })), assigneeId: '' })).toEqual({});
  });

  it('varios cambios viajan juntos', () => {
    const item = nc();
    expect(buildChanges(item, { severity: 'minor', description: 'Descripción distinta y más larga', assigneeId: '' })).toEqual({
      severity: 'minor',
      description: '<p>Descripción distinta y más larga</p>',
      assigneeId: null,
    });
  });
});

describe('edición: validación', () => {
  it('un PATCH vacío es «nothingToUpdate»', () => {
    expect(validateUpdate({})).toEqual({ success: false, errors: { '': 'nothingToUpdate' } });
  });

  it('una descripción corta se rechaza con descShort', () => {
    expect(validateUpdate({ description: '<p>corta</p>' })).toEqual({ success: false, errors: { description: 'descShort' } });
  });

  it('los cambios válidos pasan tal cual, incluida la asignación a null', () => {
    expect(validateUpdate({ severity: 'major', assigneeId: null })).toEqual({ success: true, data: { severity: 'major', assigneeId: null } });
  });
});
