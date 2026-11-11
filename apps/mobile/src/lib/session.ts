/** Sesión guardada en AsyncStorage (`sigpro.session`): el mismo formato que la web con «Mantener la sesión». */
export interface StoredSession {
  readonly refreshToken: string;
  readonly remember: boolean;
}

/** Lee el JSON guardado; cualquier cosa que no sea un objeto con `refreshToken` de texto es «sin sesión». */
export const parseStoredSession = (raw: string | null): StoredSession | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession> | null;
    return parsed && typeof parsed.refreshToken === 'string' ? { refreshToken: parsed.refreshToken, remember: parsed.remember === true } : null;
  } catch {
    return null;
  }
};
