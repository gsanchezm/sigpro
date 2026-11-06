// localStorage / sessionStorage pueden lanzar (modo privado, datos bloqueados): todo va envuelto.

type Store = 'local' | 'session';

const area = (store: Store): Storage | null => {
  try {
    return store === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const readStorage = (key: string, store: Store = 'local'): string | null => {
  try {
    return area(store)?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

export const writeStorage = (key: string, value: string, store: Store = 'local'): void => {
  try {
    area(store)?.setItem(key, value);
  } catch {
    // sin almacenamiento: la app sigue funcionando sin persistir
  }
};

export const removeStorage = (key: string, store: Store = 'local'): void => {
  try {
    area(store)?.removeItem(key);
  } catch {
    // ignorado a propósito
  }
};

export const STORAGE_KEYS = {
  theme: 'sigpro.theme',
  lang: 'sigpro.lang',
  tenant: 'sigpro.tenant',
  session: 'sigpro.session',
  cookies: 'sigpro.cookies',
} as const;
