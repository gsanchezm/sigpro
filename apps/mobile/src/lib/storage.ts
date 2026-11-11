import AsyncStorage from '@react-native-async-storage/async-storage';

// AsyncStorage con las MISMAS claves que la web. En la versión web AsyncStorage es `localStorage` con la clave tal cual,
// así que las ayudas de Playwright del monorepo (`seedStorage`, `openAs`) funcionan sin cambios contra `:8081`.
export const STORAGE_KEYS = {
  theme: 'sigpro.theme',
  lang: 'sigpro.lang',
  tenant: 'sigpro.tenant',
  session: 'sigpro.session',
} as const;

export const readStorage = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

export const writeStorage = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // sin almacenamiento: la app sigue funcionando sin persistir
  }
};

export const removeStorage = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignorado a propósito
  }
};
