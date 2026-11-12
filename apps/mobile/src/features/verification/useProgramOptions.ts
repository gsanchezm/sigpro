import type { ProgramDto } from '@sigpro/shared';
import { useEffect, useState } from 'react';
import { useAuth } from '../../state/auth';

const NO_PROGRAMS: readonly ProgramDto[] = [];

/** Programas para el filtro de la lista: los 50 primeros por código, igual que la web. Si falla, el filtro queda solo con «Todos». */
export const useProgramOptions = (): readonly ProgramDto[] => {
  const { api } = useAuth();
  const [programs, setPrograms] = useState<readonly ProgramDto[]>(NO_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    api.programs.list({ sort: 'code', dir: 'asc', pageSize: 50 }).then(
      (response) => !cancelled && setPrograms(response.items),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [api]);
  return programs;
};
