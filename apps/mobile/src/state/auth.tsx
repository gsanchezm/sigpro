import { createApiClient, type ApiClient, type SessionResponse, type SessionUser } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { API_URL, DEFAULT_TENANT, tenantFromUrl } from '../lib/env';
import { parseStoredSession, type StoredSession } from '../lib/session';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '../lib/storage';

// Sesión de la app móvil: access token en memoria y refresh token en AsyncStorage (`sigpro.session`, el mismo formato que
// la web con «Mantener la sesión»). Al arrancar se recupera con `/auth/refresh`. El tenant viaja en la cabecera `x-tenant`.

type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

interface AuthValue {
  readonly status: AuthStatus;
  readonly user: SessionUser | null;
  /** Cliente HTTP con el token de la sesión y reintento automático con refresh. */
  readonly api: ApiClient;
  /** Cliente sin sesión (login, MFA, configuración pública). */
  readonly publicApi: ApiClient;
  readonly tenant: string;
  readonly setTenant: (tenant: string) => void;
  readonly signIn: (session: SessionResponse) => void;
  readonly signOut: () => Promise<void>;
  /** Access token vigente (o null): el handshake de Socket.IO lo lee en cada conexión. */
  readonly getToken: () => string | null;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenantState] = useState<string>(tenantFromUrl() ?? DEFAULT_TENANT);
  const tenantRef = useRef(tenant);
  const accessToken = useRef<string | null>(null);
  const stored = useRef<StoredSession | null>(null);
  const inflight = useRef<Promise<string | null> | null>(null);

  const getTenant = useCallback(() => tenantRef.current, []);
  const publicApi = useMemo(() => createApiClient({ baseUrl: API_URL, getTenant }), [getTenant]);

  const setTenant = useCallback((next: string) => {
    const value = next.trim() || DEFAULT_TENANT;
    tenantRef.current = value;
    setTenantState(value);
    void writeStorage(STORAGE_KEYS.tenant, value);
  }, []);

  const apply = useCallback((session: SessionResponse) => {
    accessToken.current = session.accessToken;
    stored.current = { refreshToken: session.refreshToken, remember: true };
    void writeStorage(STORAGE_KEYS.session, JSON.stringify(stored.current));
    setUser(session.user);
    setStatus('authenticated');
  }, []);

  const drop = useCallback(() => {
    accessToken.current = null;
    stored.current = null;
    void removeStorage(STORAGE_KEYS.session);
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
        apply(session);
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

  const api = useMemo(() => createApiClient({ baseUrl: API_URL, getTenant, getToken: () => accessToken.current, onUnauthorized: refresh }), [getTenant, refresh]);

  // Al arrancar: el tenant guardado (si la URL no trae uno) y la sesión guardada
  useEffect(() => {
    let alive = true;
    void (async () => {
      const fromUrl = tenantFromUrl();
      const [savedTenant, savedSession] = await Promise.all([readStorage(STORAGE_KEYS.tenant), readStorage(STORAGE_KEYS.session)]);
      if (!alive) return;
      const resolved = fromUrl ?? savedTenant ?? DEFAULT_TENANT;
      tenantRef.current = resolved;
      setTenantState(resolved);
      if (fromUrl) void writeStorage(STORAGE_KEYS.tenant, fromUrl);
      stored.current = parseStoredSession(savedSession);
      if (!stored.current) {
        setStatus('anonymous');
        return;
      }
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  const signOut = useCallback(async () => {
    const refreshToken = stored.current?.refreshToken ?? null;
    drop();
    await publicApi.auth.logout(refreshToken).catch(() => undefined);
  }, [drop, publicApi]);

  const getToken = useCallback(() => accessToken.current, []);
  const value = useMemo<AuthValue>(
    () => ({ status, user, api, publicApi, tenant, setTenant, signIn: apply, signOut, getToken }),
    [status, user, api, publicApi, tenant, setTenant, apply, signOut, getToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
};
