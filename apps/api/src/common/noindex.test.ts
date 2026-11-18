import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { NOINDEX_VALUE, ROBOTS_TXT, noindexHeader } from './noindex';

describe('noindexHeader', () => {
  it('añade X-Robots-Tag y deja pasar la petición', () => {
    const setHeader = vi.fn();
    const next = vi.fn();
    noindexHeader({} as Request, { setHeader } as unknown as Response, next as NextFunction);
    expect(setHeader).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow');
    expect(NOINDEX_VALUE).toBe('noindex, nofollow');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('robots.txt prohíbe el rastreo completo', () => {
    expect(ROBOTS_TXT).toBe('User-agent: *\nDisallow: /\n');
  });
});
