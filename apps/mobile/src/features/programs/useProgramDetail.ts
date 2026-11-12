import { formatTrace, type ProgramDto } from '@sigpro/shared';
import { useAuth } from '../../state/auth';
import { useResource, type Resource } from '../../lib/resource';
import { isNotFound } from './view';

/** Resultado de buscar un programa: existe, o la API ha respondido 404 (con su traza). */
export type ProgramLookup = { readonly kind: 'found'; readonly program: ProgramDto } | { readonly kind: 'missing'; readonly trace: string };

export interface ProgramDetailData {
  readonly program: Resource<ProgramLookup>;
}

/** Programa del detalle. Un 404 no es un error de carga: la pantalla muestra «Programa no encontrado». Los hitos y los
 * proveedores los pide cada panel por su cuenta. */
export const useProgramDetail = (code: string): ProgramDetailData => {
  const { api } = useAuth();

  const program = useResource<ProgramLookup>(async () => {
    try {
      return { kind: 'found', program: await api.programs.get(code) };
    } catch (failure) {
      if (isNotFound(failure)) return { kind: 'missing', trace: formatTrace(failure) };
      throw failure;
    }
  }, [api, code]);

  return { program };
};
