import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebouncedValue } from '../lib/hooks';

const DEBOUNCE_MS = 250;

/**
 * Búsqueda global de cabecera EN `/programs`: filtra la tabla de Programas por código o nombre (`/programs?q=…`).
 * El valor se aplica con debounce de 250 ms; si la URL cambia desde fuera ("Limpiar filtros") el campo la sigue.
 * En el resto de rutas la cabecera enseña resultados agrupados (`GlobalSearch`) y este hook no navega.
 */
export const useGlobalSearch = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const onPrograms = location.pathname === '/programs';
  const urlQuery = onPrograms ? (new URLSearchParams(location.search).get('q') ?? '') : '';

  const [draft, setDraft] = useState(urlQuery);
  const lastPushed = useRef(urlQuery);
  const debounced = useDebouncedValue(draft, DEBOUNCE_MS);

  // URL → campo (solo si el cambio no lo provocamos nosotros)
  useEffect(() => {
    if (urlQuery === lastPushed.current) return;
    lastPushed.current = urlQuery;
    setDraft(urlQuery);
  }, [urlQuery]);

  // campo → URL
  useEffect(() => {
    // Fuera de /programs la búsqueda no navega: abre el popover de resultados agrupados
    if (!onPrograms) return;
    const next = debounced.trim();
    if (next === lastPushed.current) return;
    lastPushed.current = next;
    const params = new URLSearchParams(onPrograms ? location.search : '');
    if (next) params.set('q', next);
    else params.delete('q');
    params.delete('page');
    const search = params.toString();
    navigate({ pathname: '/programs', search: search ? `?${search}` : '' }, { replace: true });
    // `location.search` se lee al ejecutar; depender de él reiniciaría el efecto en cada navegación
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return { draft, setDraft };
};
