import type { MilestoneDto } from '@sigpro/shared';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';
import { sortMilestones } from './view';

// Hitos de un programa. El panel conserva la lista en local: una edición, un alta o un borrado se aplican sin volver a pedir
// todo (como la web), y el avance del programa se refresca aparte con `onChanged`.

export type MilestonesState = { readonly status: 'loading' } | { readonly status: 'error'; readonly error: unknown } | { readonly status: 'ready'; readonly items: readonly MilestoneDto[] };

export interface MilestonesData {
  readonly state: MilestonesState;
  readonly reload: () => void;
  /** Sustituye un hito por su versión de la API (edición o avance). */
  readonly put: (milestone: MilestoneDto) => void;
  /** Añade un hito recién creado. */
  readonly append: (milestone: MilestoneDto) => void;
  /** Quita un hito borrado. */
  readonly remove: (id: string) => void;
}

export const useMilestones = (programCode: string): MilestonesData => {
  const { api } = useAuth();
  const [state, setState] = useState<MilestonesState>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    // Solo cuenta la última petición: si cambia el programa mientras otra respuesta viaja, la antigua se descarta
    let alive = true;
    setState({ status: 'loading' });
    api.milestones.list(programCode).then(
      (items) => {
        if (alive) setState({ status: 'ready', items: sortMilestones(items) });
      },
      (error: unknown) => {
        if (alive) setState({ status: 'error', error });
      },
    );
    return () => {
      alive = false;
    };
  }, [api, programCode, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  const update = useCallback((transform: (items: readonly MilestoneDto[]) => readonly MilestoneDto[]) => {
    setState((current) => (current.status === 'ready' ? { status: 'ready', items: sortMilestones(transform(current.items)) } : current));
  }, []);

  const put = useCallback((milestone: MilestoneDto) => update((items) => items.map((item) => (item.id === milestone.id ? milestone : item))), [update]);
  const append = useCallback((milestone: MilestoneDto) => update((items) => [...items, milestone]), [update]);
  const remove = useCallback((id: string) => update((items) => items.filter((item) => item.id !== id)), [update]);

  return { state, reload, put, append, remove };
};
