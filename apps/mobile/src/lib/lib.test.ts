import { describe, expect, it } from 'vitest';
import { PALETTES, toneColors, type Tone } from '../theme/tokens';
import { parseStoredSession } from './session';
import { initials } from './text';

describe('parseStoredSession', () => {
  it('lee la sesión guardada con el formato de la web', () => {
    expect(parseStoredSession('{"refreshToken":"abc","remember":true}')).toEqual({ refreshToken: 'abc', remember: true });
    expect(parseStoredSession('{"refreshToken":"abc"}')).toEqual({ refreshToken: 'abc', remember: false });
  });

  it('trata como «sin sesión» lo ilegible o incompleto', () => {
    for (const raw of [null, '', 'no es json', '{}', '{"refreshToken":42}', 'null', '[]']) {
      expect(parseStoredSession(raw), String(raw)).toBeNull();
    }
  });
});

describe('initials', () => {
  it('toma las dos primeras palabras', () => {
    expect(initials('Marta Ruiz')).toBe('MR');
    expect(initials('  lucía   fernández  gómez ')).toBe('LF');
    expect(initials('Ana')).toBe('A');
    expect(initials('')).toBe('');
  });
});

describe('tema', () => {
  it('claro y oscuro definen exactamente los mismos tokens', () => {
    expect(Object.keys(PALETTES.dark).sort()).toEqual(Object.keys(PALETTES.light).sort());
  });

  it('cada tono tiene color de texto y de fondo distintos en los dos temas', () => {
    const tones: readonly Tone[] = ['neutral', 'info', 'ok', 'warn', 'danger', 'purple'];
    for (const scheme of ['light', 'dark'] as const) {
      for (const tone of tones) {
        const { fg, bg } = toneColors(PALETTES[scheme], tone);
        expect(fg, `${scheme}:${tone}`).not.toBe(bg);
      }
    }
  });
});
