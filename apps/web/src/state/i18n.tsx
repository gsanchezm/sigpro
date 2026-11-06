import { DEFAULT_LANG, LANGS, createTranslator, type Lang, type Translator } from '@sigpro/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE_KEYS, readStorage, writeStorage } from '../lib/storage';

interface I18nValue {
  readonly lang: Lang;
  readonly setLang: (lang: Lang) => void;
  readonly t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

const isLang = (value: string | null): value is Lang => (LANGS as readonly string[]).includes(value ?? '');

const initialLang = (): Lang => {
  const stored = readStorage(STORAGE_KEYS.lang);
  return isLang(stored) ? stored : DEFAULT_LANG;
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    writeStorage(STORAGE_KEYS.lang, next);
  }, []);

  const t = useMemo(() => createTranslator(lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n debe usarse dentro de I18nProvider');
  return value;
};

export const isSupportedLang = isLang;
