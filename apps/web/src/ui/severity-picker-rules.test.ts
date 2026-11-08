import { describe, expect, it } from 'vitest';
import { DEFAULT_SEVERITY_LABELS, isSelectKey, isSeverity, moveFocusIndex, parseSeverityLabels, tabStopIndex } from './severity-picker-rules';

describe('isSeverity', () => {
  it('acepta solo las tres severidades', () => {
    expect(['minor', 'major', 'critical'].every(isSeverity)).toBe(true);
    expect(isSeverity('enorme')).toBe(false);
    expect(isSeverity(null)).toBe(false);
    expect(isSeverity(2)).toBe(false);
  });
});

describe('parseSeverityLabels', () => {
  it('lee el JSON del atributo', () => {
    expect(parseSeverityLabels('{"minor":"Minor","major":"Major","critical":"Critical"}')).toEqual({ minor: 'Minor', major: 'Major', critical: 'Critical' });
  });

  it('completa lo que falte y descarta lo que no sea texto', () => {
    expect(parseSeverityLabels('{"critical":"Grave","major":3}')).toEqual({ minor: 'Menor', major: 'Mayor', critical: 'Grave' });
  });

  it('cae en los valores por defecto si falta o está roto', () => {
    expect(parseSeverityLabels(null)).toBe(DEFAULT_SEVERITY_LABELS);
    expect(parseSeverityLabels('no es json')).toBe(DEFAULT_SEVERITY_LABELS);
    expect(parseSeverityLabels('[1,2]')).toEqual(DEFAULT_SEVERITY_LABELS);
  });
});

describe('moveFocusIndex', () => {
  it('flechas derecha/abajo avanzan y dan la vuelta', () => {
    expect(moveFocusIndex('ArrowRight', 0, 3)).toBe(1);
    expect(moveFocusIndex('ArrowDown', 2, 3)).toBe(0);
  });

  it('flechas izquierda/arriba retroceden y dan la vuelta', () => {
    expect(moveFocusIndex('ArrowLeft', 1, 3)).toBe(0);
    expect(moveFocusIndex('ArrowUp', 0, 3)).toBe(2);
  });

  it('Inicio y Fin saltan a los extremos', () => {
    expect(moveFocusIndex('Home', 2, 3)).toBe(0);
    expect(moveFocusIndex('End', 0, 3)).toBe(2);
  });

  it('otras teclas no mueven el foco', () => {
    expect(moveFocusIndex('a', 0, 3)).toBeNull();
    expect(moveFocusIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

describe('teclas de selección y tabindex itinerante', () => {
  it('Enter y Espacio eligen', () => {
    expect(isSelectKey('Enter')).toBe(true);
    expect(isSelectKey(' ')).toBe(true);
    expect(isSelectKey('Tab')).toBe(false);
  });

  it('el tabindex 0 va a la opción elegida o, sin elección, a la primera', () => {
    expect(tabStopIndex('major')).toBe(1);
    expect(tabStopIndex('critical')).toBe(2);
    expect(tabStopIndex(null)).toBe(0);
  });
});
