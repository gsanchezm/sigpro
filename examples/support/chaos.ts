import { expect, type APIRequestContext } from '@playwright/test';
import { createApi, loginByApi, type Api } from './api';

// Modo caos del tenant (sesión 10): `PATCH /api/admin/chaos` con { latencyMs, errorRate, flakyLabels }.
//
// Es del TENANT entero, no de un test. Mientras un spec lo tiene encendido, los demás specs del mismo tenant siguen
// corriendo. Por eso este módulo solo permite el caos «seguro» (`sharedChaos`): latencia acotada y textos alternos,
// nunca `errorRate`. Para simular un 500 se usa `page.route` (sesión 9), que solo afecta al navegador del test.

/** Configuración del caos tal como la acepta y la devuelve la API. */
export interface ChaosConfig {
  readonly latencyMs: number;
  readonly errorRate: number;
  readonly flakyLabels: boolean;
}

/** Sin caos: el estado normal del tenant. */
export const CHAOS_OFF: ChaosConfig = { latencyMs: 0, errorRate: 0, flakyLabels: false };

/** Techo de latencia para un tenant compartido (la API admite hasta 5000 ms; nosotros no). */
export const MAX_SHARED_LATENCY_MS = 400;

/**
 * Caos apto para un tenant compartido. Rechaza en tiempo de ejecución lo que no lo sea: un límite escrito solo en un
 * comentario se incumple sin que nadie se entere.
 */
export const sharedChaos = (options: { readonly latencyMs: number; readonly flakyLabels?: boolean }): ChaosConfig => {
  const { latencyMs, flakyLabels = true } = options;
  if (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > MAX_SHARED_LATENCY_MS) {
    throw new RangeError(`latencyMs ${latencyMs} fuera del límite compartido (0–${MAX_SHARED_LATENCY_MS} ms)`);
  }
  return { latencyMs, errorRate: 0, flakyLabels };
};

/** Cliente de la API como admin, para usarlo en `beforeAll`/`afterAll` (donde no se puede pedir el fixture `apiAs`). */
export const adminApi = async (request: APIRequestContext): Promise<Api> => createApi(request, (await loginByApi(request, 'admin')).accessToken);

/** Aplica una configuración del caos y comprueba que la API la acepta. */
export const setChaos = async (api: Api, config: ChaosConfig): Promise<void> => {
  const response = await api.patch('/admin/chaos', config);
  expect(response.status(), 'PATCH /admin/chaos').toBe(200);
};

/** Lee el caos que ve la web: `GET /api/config` es público y es lo que consume la pantalla. */
export const readChaos = async (api: Api): Promise<ChaosConfig> => {
  const response = await api.get('/config');
  expect(response.status(), 'GET /config').toBe(200);
  return ((await response.json()) as { chaos: ChaosConfig }).chaos;
};

/**
 * Enciende el caos, ejecuta el cuerpo y lo apaga SIEMPRE: el `finally` corre también si el cuerpo lanza un error.
 * Así un test roto no deja el tenant sucio para los demás.
 */
export const withChaos = async <T>(api: Api, config: ChaosConfig, body: () => Promise<T>): Promise<T> => {
  await setChaos(api, config);
  try {
    return await body();
  } finally {
    await setChaos(api, CHAOS_OFF);
  }
};
