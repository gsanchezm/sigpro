import { NC_SEVERITIES } from '@sigpro/shared';
import { describe, expect, it } from 'vitest';
import { isChosen, isSeverity, pick } from './severity';

describe('isSeverity', () => {
  it('acepta las tres severidades y nada más', () => {
    NC_SEVERITIES.forEach((severity) => expect(isSeverity(severity)).toBe(true));
    expect(isSeverity('blocker')).toBe(false);
    expect(isSeverity('')).toBe(false);
    expect(isSeverity(null)).toBe(false);
    expect(isSeverity(3)).toBe(false);
  });
});

describe('isChosen', () => {
  it('sin valor (alta) ninguna opción está elegida', () => {
    expect(NC_SEVERITIES.some((severity) => isChosen(null, severity))).toBe(false);
  });

  it('solo la opción del valor está elegida', () => {
    expect(NC_SEVERITIES.filter((severity) => isChosen('major', severity))).toEqual(['major']);
  });
});

describe('pick', () => {
  it('avisa del cambio a otra severidad', () => {
    expect(pick(null, 'critical')).toBe('critical');
    expect(pick('minor', 'major')).toBe('major');
  });

  it('no avisa al pulsar la que ya está elegida ni con valores que no son severidades', () => {
    expect(pick('major', 'major')).toBeNull();
    expect(pick('major', 'otra')).toBeNull();
    expect(pick(null, undefined)).toBeNull();
  });
});
