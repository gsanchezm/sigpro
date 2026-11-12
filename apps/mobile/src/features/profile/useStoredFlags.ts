import { useCallback, useEffect, useState } from 'react';
import { STORAGE_KEYS, readStorage, writeStorage } from '../../lib/storage';
import { flagValue, parseDigest, parseLive } from './view';

/** Preferencias del Perfil que solo se guardan (no cambian nada más en la app): avisos en tiempo real y resumen semanal. */
export interface StoredFlags {
  readonly live: boolean;
  readonly digest: boolean;
}

/**
 * Lee `sigpro.live` y `sigpro.digest` (mismas claves y valores `on`/`off` que la web). Mientras se leen, `flags` es `null`:
 * el formulario no se pinta hasta tenerlas, para que «Guardar» no parpadee entre desactivado y activado.
 *
 * En la web `live` decide si la campana cuenta los avisos que llegan por WebSocket; el móvil no tiene campana, así que
 * la preferencia se guarda (y se respeta si el usuario abre la web con el mismo almacenamiento) sin otro efecto.
 */
export const useStoredFlags = () => {
  const [flags, setFlags] = useState<StoredFlags | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([readStorage(STORAGE_KEYS.live), readStorage(STORAGE_KEYS.digest)]).then(([live, digest]) => {
      if (alive) setFlags({ live: parseLive(live), digest: parseDigest(digest) });
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = useCallback(async (next: StoredFlags): Promise<void> => {
    await Promise.all([writeStorage(STORAGE_KEYS.live, flagValue(next.live)), writeStorage(STORAGE_KEYS.digest, flagValue(next.digest))]);
    setFlags(next);
  }, []);

  return { flags, save };
};
