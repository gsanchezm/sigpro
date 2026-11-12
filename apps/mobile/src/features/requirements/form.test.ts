import { ApiError, sanitizeRichText, type RequirementDto } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { buildChanges, createInputOf, descriptionChanged, descriptionToText, draftOf, fieldErrorsOf, hasChanges, normalizeText, textChanged, textToDescription, validateCreate, validateUpdate, withoutErrors } from './form';

// Fixture de un requisito con la descripción que guarda la API (HTML saneado)
const item = (overrides: Partial<RequirementDto> = {}): RequirementDto => ({
  code: 'REQ-017',
  programCode: 'PRG-002',
  parentCode: 'REQ-015',
  title: 'Disponibilidad del subsistema 017',
  description: '',
  priority: 'low',
  state: 'draft',
  tags: ['security'],
  position: 1,
  testCaseCodes: [],
  tests: [],
  ncs: [],
  ...overrides,
});

describe('descriptionToText', () => {
  it('convierte cada párrafo en una línea y descarta el HTML', () => {
    expect(descriptionToText('<p>Primera</p><p>Segunda</p>')).toBe('Primera\nSegunda');
    expect(descriptionToText('<p><strong>Negrita</strong> y <em>cursiva</em></p>')).toBe('Negrita y cursiva');
  });

  it('marca los elementos de lista con «• » y decodifica las entidades', () => {
    expect(descriptionToText('<ul><li>Uno</li><li>Dos &amp; tres</li></ul>')).toBe('• Uno\n• Dos & tres');
    expect(descriptionToText('<p>a &lt;b&gt; &quot;c&quot; &#39;d&#39;</p>')).toBe('a <b> "c" \'d\'');
  });

  it('una descripción vacía sigue vacía', () => {
    expect(descriptionToText('')).toBe('');
  });
});

describe('textToDescription', () => {
  it('genera un párrafo por línea no vacía y escapa el texto', () => {
    expect(textToDescription('Uno\n\n  Dos & <tres>  ')).toBe('<p>Uno</p><p>Dos &amp; &lt;tres&gt;</p>');
  });

  it('texto vacío produce HTML vacío', () => {
    expect(textToDescription('   \n  ')).toBe('');
  });

  it('idempotente tras el saneado de la API: lo que se envía es lo que se guarda', () => {
    const html = textToDescription('Requisito con & y <b>etiqueta</b>\nSegundo párrafo');
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('ida y vuelta: texto → HTML → texto conserva los párrafos', () => {
    const text = 'Primera línea\nSegunda: con & y "comillas"\nTercera <aviso>';
    expect(descriptionToText(sanitizeRichText(textToDescription(text)))).toBe(normalizeText(text));
  });
});

describe('normalizeText', () => {
  it('recorta cada línea y quita las vacías', () => {
    expect(normalizeText('  a \n\n b  \n')).toBe('a\nb');
  });
});

describe('buildChanges (solo lo que cambió)', () => {
  const base = item({ description: '<p><strong>Texto con formato</strong></p>', priority: 'low' });

  it('sin cambios no envía nada y no hay nada que guardar', () => {
    const changes = buildChanges(base, draftOf(base));
    expect(changes).toEqual({});
    expect(hasChanges(changes)).toBe(false);
  });

  it('cambiar solo la prioridad no reenvía la descripción (así no vuelve a borrador)', () => {
    const changes = buildChanges(base, { ...draftOf(base), priority: 'high' });
    expect(changes).toEqual({ priority: 'high' });
    expect(textChanged(base, { ...draftOf(base), priority: 'high' })).toBe(false);
  });

  it('cambiar solo el título envía el título', () => {
    const draft = { ...draftOf(base), title: 'Disponibilidad revisada' };
    expect(buildChanges(base, draft)).toEqual({ title: 'Disponibilidad revisada' });
    expect(textChanged(base, draft)).toBe(true);
  });

  it('los saltos de línea y espacios sobrantes no cuentan como cambio de texto', () => {
    const draft = { ...draftOf(base), description: `${draftOf(base).description}  \n\n` };
    expect(descriptionChanged(base, draft)).toBe(false);
  });

  it('cambiar el texto de la descripción la envía como HTML de párrafos', () => {
    const draft = { ...draftOf(base), description: 'Texto nuevo' };
    expect(buildChanges(base, draft)).toEqual({ description: '<p>Texto nuevo</p>' });
  });

  it('las etiquetas se comparan como conjunto (el orden no cambia nada)', () => {
    const two = item({ tags: ['security', 'safety'] });
    expect(buildChanges(two, { ...draftOf(two), tags: ['safety', 'security'] })).toEqual({});
    expect(buildChanges(two, { ...draftOf(two), tags: ['safety'] })).toEqual({ tags: ['safety'] });
  });
});

describe('validación con los esquemas de la API', () => {
  it('el alta exige un título de al menos 3 caracteres (clave i18n)', () => {
    const result = validateCreate(createInputOf('PRG-002', null, { title: 'ab', description: '', priority: 'medium', tags: [] }));
    expect(result).toEqual({ success: false, errors: { title: 'titleShort' } });
  });

  it('el alta válida sale con padre nulo y la descripción en HTML', () => {
    const result = validateCreate(createInputOf('PRG-002', null, { title: 'Requisito de prueba', description: 'Hola', priority: 'high', tags: ['safety', 'safety'] }));
    expect(result).toEqual({
      success: true,
      data: { programCode: 'PRG-002', parentCode: null, title: 'Requisito de prueba', description: '<p>Hola</p>', priority: 'high', tags: ['safety'], },
    });
  });

  it('la edición valida el título con el mismo esquema', () => {
    const changes = buildChanges(item(), { ...draftOf(item()), title: 'x' });
    expect(validateUpdate(changes)).toEqual({ success: false, errors: { title: 'titleShort' } });
  });

  it('fieldErrorsOf solo reconoce los 422 de la API', () => {
    const body = { statusCode: 422, error: 'Unprocessable Entity', message: 'validation_failed', errors: { title: 'titleShort' } };
    expect(fieldErrorsOf(new ApiError(422, body, 'PATCH /api/requirements/REQ-017 → 422 Unprocessable Entity'))).toEqual({ title: 'titleShort' });
    expect(fieldErrorsOf(new ApiError(409, { statusCode: 409, error: 'Conflict', message: 'invalid_transition' }, 'x'))).toBeNull();
    expect(fieldErrorsOf(new Error('red caída'))).toBeNull();
  });

  it('withoutErrors quita solo los campos que cambiaron', () => {
    expect(withoutErrors({ title: 'titleShort', description: 'descLong' }, ['title'])).toEqual({ description: 'descLong' });
  });
});
