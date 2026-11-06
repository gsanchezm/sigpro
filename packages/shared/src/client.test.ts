import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient } from './client';

type Call = { url: string; init: RequestInit };

/** fetch falso que responde con la cola de respuestas dada y registra las llamadas. */
const fakeFetch = (responses: Response[]) => {
  const calls: Call[] = [];
  const impl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    const next = responses.shift();
    if (!next) throw new Error('sin respuesta preparada');
    return next;
  };
  return { impl, calls };
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const headersOf = (call: Call) => new Headers(call.init.headers);

describe('createApiClient', () => {
  it('envía token, tenant y query string', async () => {
    const { impl, calls } = fakeFetch([jsonResponse(200, { items: [], total: 0 })]);
    const api = createApiClient({ baseUrl: '/api', fetchImpl: impl, getToken: () => 'tok', getTenant: () => 'alumno07' });

    await api.programs.list({ q: 'radar', page: 2, status: undefined });

    const [call] = calls;
    expect(call?.url).toBe('/api/programs?q=radar&page=2');
    expect(headersOf(call!).get('authorization')).toBe('Bearer tok');
    expect(headersOf(call!).get('x-tenant')).toBe('alumno07');
  });

  it('lanza ApiError con cuerpo y traza HTTP', async () => {
    const body = { statusCode: 401, error: 'Unauthorized', message: 'bad', code: 'invalid_credentials', attempts: 2 };
    const { impl } = fakeFetch([jsonResponse(401, body)]);
    const api = createApiClient({ baseUrl: '/api', fetchImpl: impl });

    const error = await api.auth.login({ email: 'a@b.co', password: 'x', remember: true }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).body.attempts).toBe(2);
    expect((error as ApiError).trace).toBe('POST /api/auth/login → 401 Unauthorized');
  });

  it('reintenta una vez con el token nuevo cuando onUnauthorized lo devuelve', async () => {
    const { impl, calls } = fakeFetch([jsonResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'expired' }), jsonResponse(200, [])]);
    let token = 'viejo';
    const api = createApiClient({
      baseUrl: '/api',
      fetchImpl: impl,
      getToken: () => token,
      onUnauthorized: async () => {
        token = 'nuevo';
        return token;
      },
    });

    await api.users.owners();

    expect(calls).toHaveLength(2);
    expect(headersOf(calls[1]!).get('authorization')).toBe('Bearer nuevo');
  });

  it('no reintenta en endpoints anónimos (login)', async () => {
    const { impl, calls } = fakeFetch([jsonResponse(401, { statusCode: 401, error: 'Unauthorized', message: 'bad' })]);
    const api = createApiClient({ baseUrl: '/api', fetchImpl: impl, onUnauthorized: async () => 'x' });

    await expect(api.auth.login({ email: 'a@b.co', password: 'x', remember: true })).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(1);
  });

  it('convierte un fallo de red en ApiError con status 0', async () => {
    const impl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const api = createApiClient({ baseUrl: '/api', fetchImpl: impl });

    const error = await api.health().catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(0);
  });
});
