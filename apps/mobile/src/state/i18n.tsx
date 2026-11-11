import { DEFAULT_LANG, LANGS, createTranslator, type Lang, type Translator } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';

// Textos ES/EN del paquete compartido (los mismos que la web). `sigpro.lang` guarda la preferencia.

interface I18nValue {
  readonly lang: Lang;
  readonly t: Translator;
  readonly setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

const isLang = (value: string | null): value is Lang => (LANGS as readonly string[]).includes(value ?? '');

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    void readStorage(STORAGE_KEYS.lang).then((value) => isLang(value) && setLangState(value));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    void writeStorage(STORAGE_KEYS.lang, next);
  }, []);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const value = useMemo<I18nValue>(() => ({ lang, t, setLang }), [lang, t, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n debe usarse dentro de I18nProvider');
  return value;
};
