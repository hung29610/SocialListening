'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import {
  DEFAULT_LANGUAGE,
  type Language,
  type TranslationParams,
  dictionaries,
  interpolateTranslation,
} from '@/i18n';
import {
  applyLanguageSelection,
  readLanguageMirror,
  syncServerLanguagePreference,
  writeLanguageMirror,
} from '@/i18n/languagePreferences';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (keyPath: string, params?: TranslationParams) => string;
}

function translate(
  language: Language,
  keyPath: string,
  params?: TranslationParams,
): string {
  const read = (locale: Language): unknown =>
    keyPath
      .split('.')
      .reduce<unknown>(
        (current, key) =>
          current && typeof current === 'object' && key in current
            ? (current as Record<string, unknown>)[key]
            : undefined,
        dictionaries[locale],
      );

  const value = read(language) ?? read(DEFAULT_LANGUAGE);
  return typeof value === 'string'
    ? interpolateTranslation(value, params)
    : keyPath;
}

const LanguageContext = createContext<LanguageContextType>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: keyPath => keyPath,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [mirrorApplied, setMirrorApplied] = useState(false);
  const selectionVersion = useRef(0);

  useLayoutEffect(() => {
    const mirroredLanguage = readLanguageMirror();
    setLanguageState(mirroredLanguage);
    setMirrorApplied(true);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.lang = language;
    if (mirrorApplied) {
      delete document.documentElement.dataset.i18nPending;
    }
  }, [language, mirrorApplied]);

  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem('access_token');
    } catch {
      console.warn('[i18n] Browser storage is unavailable; using the session language only.');
    }
    if (!token) return;

    const versionAtRequest = selectionVersion.current;
    void syncServerLanguagePreference(api, { token, storage: null })
      .then(serverLanguage => {
        if (selectionVersion.current === versionAtRequest) {
          writeLanguageMirror(serverLanguage);
          setLanguageState(serverLanguage);
        }
      })
      .catch(error => {
        console.warn(
          '[i18n] Unable to load the server language preference; keeping the browser mirror.',
          error,
        );
      });
  }, []);

  const setLanguage = useCallback((requested: Language) => {
    selectionVersion.current += 1;
    let signedIn = false;
    try {
      signedIn = Boolean(localStorage.getItem('access_token'));
    } catch {
      // Storage can be unavailable; the in-memory selection still applies.
    }
    void applyLanguageSelection({
      requested,
      transport: signedIn ? api : null,
      onApply: setLanguageState,
      onSaveFailure: language => {
        toast.error(translate(language, 'i18n.languageSaveFailed'));
      },
    });
  }, []);

  const t = useCallback(
    (keyPath: string, params?: TranslationParams) =>
      translate(language, keyPath, params),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
