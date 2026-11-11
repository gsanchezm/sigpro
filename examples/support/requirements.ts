import type { APIResponse } from '@playwright/test';
import type { Api } from './api';

// Ayudantes de Requisitos por API para la sesión 6. Preparan el estado de cada test (arrange) y lo dejan como estaba (cleanup),
// de modo que un test puede repetirse sin reiniciar el tenant.

/** Programa de trabajo de la sesión 6 (sus requisitos son los únicos que tocan estos specs). */
export const REQUIREMENTS_PROGRAM = 'PRG-002';

/** Hermanos de REQ-015 en su orden original del seed. Son los únicos que se reordenan en la sesión 6. */
export const SIBLINGS_UNDER_REQ_015 = ['REQ-016', 'REQ-017', 'REQ-019'] as const;

/** Prefijo de los requisitos que crea un test; el cleanup los borra. */
export const TEMP_PREFIX = 's06-';

export interface RequirementDto {
  readonly code: string;
  readonly parentCode: string | null;
  readonly title: string;
  readonly state: string;
  readonly position: number;
}

const ensureOk = async (response: APIResponse, action: string): Promise<void> => {
  if (!response.ok()) throw new Error(`${action} → ${response.status()} ${await response.text()}`);
};

/** Lista plana de requisitos del programa de trabajo (el árbol se reconstruye con `parentCode`). */
export const fetchRequirements = async (api: Api): Promise<RequirementDto[]> => {
  const response = await api.get(`/programs/${REQUIREMENTS_PROGRAM}/requirements`);
  await ensureOk(response, `GET /programs/${REQUIREMENTS_PROGRAM}/requirements`);
  return ((await response.json()) as { items: RequirementDto[] }).items;
};

/** Un requisito tal y como lo guarda el servidor (para comprobar lo que la UI no enseña). */
export const fetchRequirement = async (api: Api, code: string): Promise<RequirementDto> => {
  const response = await api.get(`/requirements/${code}`);
  await ensureOk(response, `GET /requirements/${code}`);
  return (await response.json()) as RequirementDto;
};

/** Crea un requisito RAÍZ temporal (sin padre). Su título lleva el prefijo para que el cleanup lo reconozca. */
export const createTempRequirement = async (api: Api, label: string): Promise<{ code: string; title: string }> => {
  const title = `${TEMP_PREFIX}${label} ${Date.now().toString(36)}`;
  const response = await api.post('/requirements', { programCode: REQUIREMENTS_PROGRAM, title, priority: 'low' });
  await ensureOk(response, 'POST /requirements');
  const created = (await response.json()) as { code: string };
  return { code: created.code, title };
};

/** Hermanos de REQ-015 ordenados por posición: lo que la UI muestra con `aria-posinset`. */
const siblingsOrder = (items: RequirementDto[]): string[] =>
  items
    .filter((item) => item.parentCode === 'REQ-015')
    .sort((a, b) => a.position - b.position)
    .map((item) => item.code);

/**
 * Deja el programa como en el seed para los hermanos de REQ-015 y REQ-017 en borrador:
 *  1. borra los requisitos temporales de la sesión (raíces con el prefijo; el borrado es en cascada);
 *  2. devuelve REQ-017 a borrador (el admin puede dar cualquier paso y desde cualquier estado se llega a borrador);
 *  3. recoloca REQ-016 y REQ-019 alrededor de REQ-017. Con esas dos órdenes, cualquier permutación acaba en [016, 017, 019].
 */
export const restoreSeedRequirements = async (api: Api): Promise<void> => {
  const temporary = (await fetchRequirements(api)).filter((item) => item.parentCode === null && item.title.startsWith(TEMP_PREFIX));
  for (const root of temporary) await ensureOk(await api.delete(`/requirements/${root.code}`), `DELETE /requirements/${root.code}`);

  const req17 = await fetchRequirement(api, 'REQ-017');
  if (req17.state !== 'draft') {
    await ensureOk(await api.post('/requirements/REQ-017/transition', { to: 'draft' }), 'REQ-017 → draft');
  }

  if (siblingsOrder(await fetchRequirements(api)).join() !== SIBLINGS_UNDER_REQ_015.join()) {
    await ensureOk(await api.post('/requirements/REQ-016/move', { targetCode: 'REQ-017', placement: 'before' }), 'mover REQ-016');
    await ensureOk(await api.post('/requirements/REQ-019/move', { targetCode: 'REQ-017', placement: 'after' }), 'mover REQ-019');
  }

  const restored = siblingsOrder(await fetchRequirements(api));
  if (restored.join() !== SIBLINGS_UNDER_REQ_015.join()) throw new Error(`No se restauró el orden de REQ-015: ${restored.join(', ')}`);
};
