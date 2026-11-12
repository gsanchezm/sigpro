import type { AdminUserDto, UpdateUserInput } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useResource } from '../../lib/resource';
import { useAuth } from '../../state/auth';
import { FLAKY_LABEL_MS, applyChange, replaceUser } from './view';

const NO_USERS: readonly AdminUserDto[] = [];

export type ChangeResult = { readonly ok: true; readonly saved: AdminUserDto } | { readonly ok: false; readonly failure: unknown };

/**
 * Usuarios del tenant con cambios optimistas (web: `UsersPanel`): al cambiar el rol o el interruptor de activo se ve el
 * resultado al instante; si la API responde, se queda lo que devuelve, y si la rechaza se vuelve al valor anterior.
 */
export const useAdminUsers = () => {
  const { api } = useAuth();
  const resource = useResource(() => api.admin.users(), [api]);
  const { data } = resource;
  // Copia local con los cambios ya hechos; cada lectura nueva de la API la sustituye
  const [local, setLocal] = useState<readonly AdminUserDto[] | null>(null);
  const items = local ?? data ?? NO_USERS;

  useEffect(() => setLocal(null), [data]);

  const replace = useCallback(
    (id: string, apply: (user: AdminUserDto) => AdminUserDto) => setLocal((current) => replaceUser(current ?? data ?? NO_USERS, id, apply)),
    [data],
  );

  const change = useCallback(
    async (target: AdminUserDto, input: UpdateUserInput): Promise<ChangeResult> => {
      replace(target.id, (item) => applyChange(item, input));
      try {
        const saved = await api.admin.updateUser(target.id, input);
        replace(target.id, () => saved);
        return { ok: true, saved };
      } catch (failure) {
        replace(target.id, () => target);
        return { ok: false, failure };
      }
    },
    [api, replace],
  );

  return { items, loaded: data !== null, loading: resource.loading, error: resource.error, reload: resource.reload, change };
};

/**
 * Fase (0 o 1) de los textos alternos del modo caos: con ellos activos cambia cada 2,5 s («Guardar» / «Guardar cambios»);
 * sin ellos se queda en 0. Es la parte móvil de `useSaveLabel` de la web, limitada al botón de ejemplo del panel.
 */
export const useFlakyPhase = (active: boolean): 0 | 1 => {
  const [phase, setPhase] = useState<0 | 1>(0);
  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    const timer = setInterval(() => setPhase((current) => (current === 0 ? 1 : 0)), FLAKY_LABEL_MS);
    return () => clearInterval(timer);
  }, [active]);
  return phase;
};
