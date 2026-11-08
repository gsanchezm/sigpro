import type { PublicConfig } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { useI18n } from './i18n';

// Configuración pública del tenant que la web consume en caliente: los textos alternos del modo caos (`flakyLabels`) y
// `plantedBugs` (la parte web de los defectos plantados). Se lee al iniciar sesión y se vuelve a leer tras aplicar el caos.

/** Cada cuántos ms alternan los textos de botón con el modo caos activo. */
export const FLAKY_LABEL_MS = 2500;

interface ConfigValue {
  readonly config: PublicConfig | null;
  readonly flakyLabels: boolean;
  /** Fase actual de los textos alternos (0 = «Guardar», 1 = «Guardar cambios»). */
  readonly flakyPhase: 0 | 1;
  readonly plantedBugs: boolean;
  /** Vuelve a leer `/api/config` (el panel de caos lo llama tras aplicar los cambios). */
  readonly refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigValue | null>(null);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const { status, publicApi } = useAuth();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [flakyPhase, setFlakyPhase] = useState<0 | 1>(0);

  const refresh = useCallback(async () => {
    try {
      setConfig(await publicApi.config.get());
    } catch {
      // sin configuración: la app sigue con los textos normales
    }
  }, [publicApi]);

  useEffect(() => {
    if (status === 'authenticated') void refresh();
    else setConfig(null);
  }, [status, refresh]);

  const flakyLabels = config?.chaos.flakyLabels ?? false;
  useEffect(() => {
    if (!flakyLabels) {
      setFlakyPhase(0);
      return;
    }
    const timer = setInterval(() => setFlakyPhase((phase) => (phase === 0 ? 1 : 0)), FLAKY_LABEL_MS);
    return () => clearInterval(timer);
  }, [flakyLabels]);

  const value = useMemo<ConfigValue>(
    () => ({ config, flakyLabels, flakyPhase, plantedBugs: config?.plantedBugs ?? false, refresh }),
    [config, flakyLabels, flakyPhase, refresh],
  );
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};

export const useConfig = (): ConfigValue => {
  const value = useContext(ConfigContext);
  if (!value) throw new Error('useConfig debe usarse dentro de ConfigProvider');
  return value;
};

/**
 * Texto del botón «Guardar». Con los textos alternos del modo caos activos alterna entre «Guardar» y «Guardar cambios»
 * cada 2,5 s (los specs resilientes usan `getByRole('button', { name: /^Guardar( cambios)?$/ })`).
 */
export const useSaveLabel = (): string => {
  const { t } = useI18n();
  const { flakyLabels, flakyPhase } = useConfig();
  return flakyLabels && flakyPhase === 1 ? t('common', 'saveAlt') : t('programas', 'save');
};
