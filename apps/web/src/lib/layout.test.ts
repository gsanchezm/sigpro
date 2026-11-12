import { describe, expect, it, vi } from 'vitest';
import { LAYOUT_ATTRIBUTE, applyLayout, layoutOf, startLayoutSync, type MediaSource } from './layout';

/** `MediaQueryList` de pega: se puede cambiar `matches` y avisar a quien escucha. */
const fakeMedia = (matches: boolean) => {
  const listeners = new Set<() => void>();
  const source = {
    matches,
    addEventListener: (_type: 'change', listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: 'change', listener: () => void) => void listeners.delete(listener),
  } satisfies MediaSource;
  const set = (next: boolean) => {
    (source as { matches: boolean }).matches = next;
    listeners.forEach((listener) => listener());
  };
  return { source, set, listeners };
};

const fakeRoot = () => {
  const attributes = new Map<string, string>();
  return { setAttribute: (name: string, value: string) => void attributes.set(name, value), get: (name: string) => attributes.get(name) } as const;
};

describe('layoutOf', () => {
  it('escritorio si la consulta se cumple, responsive si no', () => {
    expect(layoutOf({ matches: true })).toBe('desktop');
    expect(layoutOf({ matches: false })).toBe('mobile');
  });
});

describe('applyLayout', () => {
  it('escribe data-layout en el elemento raíz', () => {
    const root = fakeRoot();
    expect(applyLayout(root as unknown as HTMLElement, { matches: false })).toBe('mobile');
    expect(root.get(LAYOUT_ATTRIBUTE)).toBe('mobile');
  });
});

describe('startLayoutSync', () => {
  it('pone el atributo al empezar y lo actualiza con cada cambio del corte', () => {
    const { source, set, listeners } = fakeMedia(true);
    const root = fakeRoot();
    const stop = startLayoutSync(root as unknown as HTMLElement, source);
    expect(root.get(LAYOUT_ATTRIBUTE)).toBe('desktop');
    set(false);
    expect(root.get(LAYOUT_ATTRIBUTE)).toBe('mobile');
    set(true);
    expect(root.get(LAYOUT_ATTRIBUTE)).toBe('desktop');
    stop();
    expect(listeners.size).toBe(0);
  });

  it('tras parar ya no reacciona', () => {
    const { source, set } = fakeMedia(true);
    const root = fakeRoot();
    const setAttribute = vi.spyOn(root, 'setAttribute');
    startLayoutSync(root as unknown as HTMLElement, source)();
    setAttribute.mockClear();
    set(false);
    expect(setAttribute).not.toHaveBeenCalled();
  });
});
