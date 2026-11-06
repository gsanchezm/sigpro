import { createApiClient, type ApiClient, type SessionResponse, type SessionUser } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { API_URL, getTenant } from '../lib/env';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '../lib/storage';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface StoredSession {
  readonly refreshToken: string;
  readonly remember: boolean;
}

interface AuthValue {
  readonly status: AuthStatus;
  readonly user: SessionUser | null;
  /** Cliente HTTP con el token de la sesión y reintento automático con refresh. */
  readonly api: ApiClient;
  /** Cliente sin sesión (login, registro, configuración pública). */
  readonly publicApi: ApiClient;
  readonly signIn: (session: SessionResponse, remember: boolean) => void;
  readonly signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

// El refresh token vive en localStorage solo con "mantener la sesión"; si no, en sessionStorage.
// Así Playwright puede enseñar `storageState` (guarda localStorage, no sessionStorage).
const readStored = (): StoredSession | null => {
  const raw = readStorage(STORAGE_KEYS.session) ?? readStorage(STORAGE_KEYS.session, 'session');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return typeof parsed.refreshToken === 'string' ? { refreshToken: parsed.refreshToken, remember: parsed.remember === true } : null;
  } catch {
    return null;
  }
};

const persist = (session: StoredSession): void => {
  removeStorage(STORAGE_KEYS.session);
  removeStorage(STORAGE_KEYS.session, 'session');
  writeStorage(STORAGE_KEYS.session, JSON.stringify(session), session.remember ? 'local' : 'session');
};

const clearStored = (): void => {
  removeStorage(STORAGE_KEYS.session);
  removeStorage(STORAGE_KEYS.session, 'session');
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const accessToken = useRef<string | null>(null);
  const stored = useRef<StoredSession | null>(readStored());
  const inflight = useRef<Promise<string | null> | null>(null);

  const publicApi = useMemo(() => createApiClient({ baseUrl: API_URL, getTenant }), []);

  const apply = useCallback((session: SessionResponse, remember: boolean) => {
    accessToken.current = session.accessToken;
    stored.current = { refreshToken: session.refreshToken, remember };
    persist(stored.current);
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const drop = useCallback(() => {
    accessToken.current = null;
    stored.current = null;
    clearStored();
    setUser(null);
    setStatus('anonymous');
  }, []);

  /** Renueva el access token con el refresh guardado; comparte la petición si ya hay una en vuelo. */
  const refresh = useCallback((): Promise<string | null> => {
    const current = stored.current;
    if (!current) return Promise.resolve(null);
    inflight.current ??= publicApi.auth
      .refresh(current.refreshToken)
      .then((session) => {
        apply(session, current.remember);
        return session.accessToken;
      })
      .catch(() => {
        drop();
        return null;
      })
      .finally(() => {
        inflight.current = null;
      });
    return inflight.current;
  }, [publicApi, apply, drop]);

  const api = useMemo(() => createApiClient({ baseUrl: API_URL, getTenant, getToken: () => accessToken.current, onUnauthorized: refresh }), [refresh]);

  // Al arrancar: si hay sesión guardada, la recupera con el refresh token
  useEffect(() => {
    if (!stored.current) {
      setStatus('anonymous');
      return;
    }
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const refreshToken = stored.current?.refreshToken ?? null;
    drop();
    await publicApi.auth.logout(refreshToken).catch(() => undefined);
  }, [drop, publicApi]);

  const value = useMemo<AuthValue>(() => ({ status, user, api, publicApi, signIn: apply, signOut }), [status, user, api, publicApi, apply, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
};
