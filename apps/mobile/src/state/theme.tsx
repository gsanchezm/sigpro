import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';
import { PALETTES, type Palette, type Scheme } from '../theme/tokens';

// Tema claro/oscuro: la preferencia guardada (`sigpro.theme`, igual que la web) gana al esquema del sistema.

interface ThemeValue {
  readonly scheme: Scheme;
  readonly colors: Palette;
  readonly toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const isScheme = (value: string | null): value is Scheme => value === 'light' || value === 'dark';

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const system = useColorScheme();
  const [stored, setStored] = useState<Scheme | null>(null);

  useEffect(() => {
    void readStorage(STORAGE_KEYS.theme).then((value) => isScheme(value) && setStored(value));
  }, []);

  const scheme: Scheme = stored ?? (system === 'dark' ? 'dark' : 'light');
  const toggleTheme = useCallback(() => {
    const next: Scheme = scheme === 'dark' ? 'light' : 'dark';
    setStored(next);
    void writeStorage(STORAGE_KEYS.theme, next);
  }, [scheme]);

  const value = useMemo<ThemeValue>(() => ({ scheme, colors: PALETTES[scheme], toggleTheme }), [scheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme debe usarse dentro de ThemeProvider');
  return value;
};
