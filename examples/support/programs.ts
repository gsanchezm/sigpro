import type { Api } from './api';

// Ayudantes de datos de Programas por API. Sirven para PREPARAR (crear un programa con el que probar la edición)
// y para LIMPIAR (borrar lo que el test creó) sin pasar por la interfaz.

/** Etiqueta única por test: va en el nombre de cada programa que crea el test, para encontrarlo y borrarlo después. */
export const uniqueTag = (prefix: string): string => `${prefix}-${Date.now().toString(36)}`;

/** Cuerpo válido de `POST /programs` (mismo esquema que el asistente). Por defecto: estado `draft`, responsable u4. */
export const programBody = (name: string, overrides: Record<string, unknown> = {}) => ({
  name,
  description: 'Programa creado por un spec de prueba.',
  ownerId: 'u4', // Andrés Molina: no es Marta Ruiz, para no alterar el filtro de responsable de los specs de lista
  status: 'draft',
  startDate: '2026-03-01',
  endDate: '2027-09-30',
  budget: 250000,
  priority: 'medium',
  classified: false,
  notify: false,
  ...overrides,
});

/** Crea un programa y devuelve su código (PRG-0NN). Lanza un error legible si el servidor responde mal. */
export const createProgram = async (api: Api, body: Record<string, unknown>): Promise<{ code: string; name: string }> => {
  const response = await api.post('/programs', body);
  if (!response.ok()) throw new Error(`POST /programs → ${response.status()} ${await response.text()}`);
  return (await response.json()) as { code: string; name: string };
};

/**
 * Borra los programas cuyo nombre contiene la etiqueta. Es idempotente: si no hay ninguno, no hace nada.
 * La búsqueda `q` busca por código o por nombre, así que basta con la etiqueta.
 */
export const deleteProgramsTagged = async (api: Api, tag: string): Promise<void> => {
  const response = await api.get('/programs', { q: tag, pageSize: 50 });
  if (!response.ok()) throw new Error(`GET /programs?q=${tag} → ${response.status()}`);
  const { items } = (await response.json()) as { items: { code: string; name: string }[] };
  for (const { code, name } of items) {
    if (!name.includes(tag)) continue;
    const removed = await api.delete(`/programs/${code}`);
    if (removed.status() !== 204) throw new Error(`DELETE /programs/${code} → ${removed.status()}`);
  }
};

/** Cuántos programas con la etiqueta existen ahora (para afirmar que un flujo cancelado no creó nada). */
export const countProgramsTagged = async (api: Api, tag: string): Promise<number> => {
  const response = await api.get('/programs', { q: tag, pageSize: 50 });
  if (!response.ok()) throw new Error(`GET /programs?q=${tag} → ${response.status()}`);
  const { items } = (await response.json()) as { items: { name: string }[] };
  return items.filter((item) => item.name.includes(tag)).length;
};
