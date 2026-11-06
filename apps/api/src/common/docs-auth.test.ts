import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { docsBasicAuth, hasBasicCredentials } from './docs-auth';

const basic = (credentials: string) => `Basic ${Buffer.from(credentials).toString('base64')}`;

describe('hasBasicCredentials', () => {
  it('acepta solo usuario:contraseña exactos con esquema Basic', () => {
    expect(hasBasicCredentials(basic('curso:docs'), 'curso:docs')).toBe(true);
    expect(hasBasicCredentials(basic('curso:otra'), 'curso:docs')).toBe(false);
    expect(hasBasicCredentials(basic('curso'), 'curso:docs')).toBe(false);
    expect(hasBasicCredentials(`Bearer ${Buffer.from('curso:docs').toString('base64')}`, 'curso:docs')).toBe(false);
    expect(hasBasicCredentials(undefined, 'curso:docs')).toBe(false);
    expect(hasBasicCredentials('Basic', 'curso:docs')).toBe(false);
  });
});

describe('docsBasicAuth', () => {
  const run = (authorization?: string) => {
    const setHeader = vi.fn();
    const send = vi.fn();
    const status = vi.fn(() => ({ send }));
    const next = vi.fn();
    docsBasicAuth('curso:docs')({ headers: { authorization } } as Request, { setHeader, status } as unknown as Response, next as NextFunction);
    return { setHeader, status, send, next };
  };

  it('deja pasar con credenciales válidas', () => {
    const { next, status } = run(basic('curso:docs'));
    expect(next).toHaveBeenCalledOnce();
    expect(status).not.toHaveBeenCalled();
  });

  it('responde 401 con el reto WWW-Authenticate sin credenciales o con credenciales erróneas', () => {
    for (const header of [undefined, basic('curso:mal')]) {
      const { next, status, setHeader } = run(header);
      expect(next).not.toHaveBeenCalled();
      expect(status).toHaveBeenCalledWith(401);
      expect(setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="SIGPRO API docs"');
    }
  });
});
