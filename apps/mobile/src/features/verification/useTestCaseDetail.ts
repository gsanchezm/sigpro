import { ApiError, formatTrace, type TestCaseDetailDto } from '@sigpro/shared';
import { useResource, type Resource } from '../../lib/resource';
import { useAuth } from '../../state/auth';

/** Resultado de buscar un caso: existe, o la API ha respondido 404 (con su traza). */
export type CaseLookup = { readonly kind: 'found'; readonly testCase: TestCaseDetailDto } | { readonly kind: 'missing'; readonly trace: string };

/**
 * Detalle de un caso de prueba (pasos, requisitos, historial con evidencias). Un 404 no es un error de carga: la pantalla muestra
 * «No se encontró el caso de prueba». `reload` conserva el caso a la vista mientras llega el nuevo (así el formulario y el scroll
 * no se reinician al guardar una ejecución).
 */
export const useTestCaseDetail = (code: string): Resource<CaseLookup> => {
  const { api } = useAuth();
  return useResource<CaseLookup>(async () => {
    try {
      return { kind: 'found', testCase: await api.testCases.get(code) };
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) return { kind: 'missing', trace: formatTrace(failure) };
      throw failure;
    }
  }, [api, code]);
};
