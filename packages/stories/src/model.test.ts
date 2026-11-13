import { describe, expect, it } from 'vitest';
import {
  EXTRA_LABELS,
  LABEL_DEFS,
  PLATFORM_LABELS,
  TITLE_PREFIX,
  VERIFICATION,
  epicFrontmatterSchema,
  storyFrontmatterSchema,
  type StoryFile,
} from './model';

// Front matter del ejemplo de la spec (US-LOGIN-003)
const validStory = {
  id: 'US-LOGIN-003',
  tipo: 'historia',
  epica: 'EP-LOGIN',
  titulo: '[Web] Bloquear la cuenta tras 5 intentos fallidos',
  etiquetas: ['web'],
  relacionadas: ['US-LOGIN-002'],
  verificacion: 'ejecutada',
};

const validEpic = {
  id: 'EP-LOGIN',
  tipo: 'epica',
  titulo: 'Acceso y sesión',
  etiquetas: ['epic'],
};

describe('storyFrontmatterSchema', () => {
  it('acepta el ejemplo de la spec', () => {
    expect(storyFrontmatterSchema.safeParse(validStory).success).toBe(true);
  });

  it('acepta los campos opcionales cubre y permisos', () => {
    const result = storyFrontmatterSchema.safeParse({
      ...validStory,
      etiquetas: ['api'],
      titulo: '[API] Iniciar sesión',
      cubre: ['POST /api/auth/login'],
      permisos: ['program.create'],
    });
    expect(result.success).toBe(true);
  });

  it('acepta una historia sin relacionadas', () => {
    const { relacionadas: _omitted, ...withoutRelated } = validStory;
    expect(storyFrontmatterSchema.safeParse(withoutRelated).success).toBe(true);
  });

  it.each(['US-LOGIN-3', 'US-LOGIN-0003', 'US-login-003', 'EP-LOGIN', 'US-003'])('rechaza el id %s', (id) => {
    expect(storyFrontmatterSchema.safeParse({ ...validStory, id }).success).toBe(false);
  });

  it('rechaza una verificación desconocida', () => {
    expect(storyFrontmatterSchema.safeParse({ ...validStory, verificacion: 'otra' }).success).toBe(false);
  });

  it('rechaza una clave desconocida', () => {
    expect(storyFrontmatterSchema.safeParse({ ...validStory, extra: 'x' }).success).toBe(false);
  });

  it('rechaza un tipo distinto de historia', () => {
    expect(storyFrontmatterSchema.safeParse({ ...validStory, tipo: 'epica' }).success).toBe(false);
  });

  it('rechaza una épica con formato de id inválido', () => {
    expect(storyFrontmatterSchema.safeParse({ ...validStory, epica: 'LOGIN' }).success).toBe(false);
  });
});

describe('epicFrontmatterSchema', () => {
  it('acepta una épica con la etiqueta epic', () => {
    expect(epicFrontmatterSchema.safeParse(validEpic).success).toBe(true);
  });

  it('rechaza una épica con etiquetas de plataforma', () => {
    expect(epicFrontmatterSchema.safeParse({ ...validEpic, etiquetas: ['web'] }).success).toBe(false);
  });

  it('rechaza una épica con epic más otra etiqueta o sin etiquetas', () => {
    expect(epicFrontmatterSchema.safeParse({ ...validEpic, etiquetas: ['epic', 'web'] }).success).toBe(false);
    expect(epicFrontmatterSchema.safeParse({ ...validEpic, etiquetas: [] }).success).toBe(false);
  });

  it('rechaza un id de épica con formato de historia y una clave desconocida', () => {
    expect(epicFrontmatterSchema.safeParse({ ...validEpic, id: 'US-LOGIN-003' }).success).toBe(false);
    expect(epicFrontmatterSchema.safeParse({ ...validEpic, extra: 'x' }).success).toBe(false);
  });
});

describe('constantes', () => {
  it('TITLE_PREFIX cubre cada plataforma con su prefijo', () => {
    expect(TITLE_PREFIX.get('movil')).toBe('[Móvil]');
    expect(PLATFORM_LABELS.map((p) => TITLE_PREFIX.get(p))).toEqual(['[API]', '[Web]', '[Móvil]', '[iOS]', '[Android]', '[Transversal]']);
  });

  it('VERIFICATION lista los cuatro valores', () => {
    expect([...VERIFICATION]).toEqual(['ejecutada', 'codigo', 'pendiente-nativo', 'no-ejecutable']);
  });

  it('LABEL_DEFS contiene exactamente las 8 etiquetas globales', () => {
    const expected = ['epic', 'api', 'web', 'movil', 'ios', 'android', 'transversal', 'no-implementada'];
    expect(LABEL_DEFS.map((l) => l.name).sort()).toEqual([...expected].sort());
    expect([...EXTRA_LABELS, ...PLATFORM_LABELS].sort()).toEqual([...expected].sort());
  });

  it('cada definición tiene color hexadecimal y descripción corta en español', () => {
    LABEL_DEFS.forEach((l) => {
      expect(l.color).toMatch(/^[0-9a-f]{6}$/);
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.description.length).toBeLessThanOrEqual(100); // límite de GitHub
    });
  });
});

describe('StoryFile', () => {
  it('es una unión discriminada por kind', () => {
    const file: StoryFile = { kind: 'epic', path: 'docs/user-stories/login/epic.md', fm: epicFrontmatterSchema.parse(validEpic), body: '' };
    // Solo compila si el estrechamiento por kind da el front matter de épica
    expect(file.kind === 'epic' ? file.fm.etiquetas[0] : undefined).toBe('epic');
  });
});
