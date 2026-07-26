'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  DEFAULT_LANGUAGE,
  Dictionary,
  LANGUAGE_STORAGE_KEY,
  Language,
  detectBrowserLanguage,
  dictionaries,
  isSupportedLanguage,
  resolveLanguage,
} from '@/i18n';

/** Values that may be interpolated into a translation. */
export type TranslationParams = Record<string, string | number>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /**
   * Translate a dot-separated key. Optional `params` replace `{name}`
   * placeholders, so a sentence stays a single translatable unit instead of
   * being concatenated from fragments in JSX.
   */
  t: (keyPath: string, params?: TranslationParams) => string;
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

const defaultLanguage: Language = DEFAULT_LANGUAGE;

const LanguageContext = createContext<LanguageContextType>({
  language: defaultLanguage,
  setLanguage: () => {},
  t: () => '',
});

/**
 * Read the persisted preference and migrate it if needed.
 *
 * Accounts created while th/ja/ko/zh were selectable still have those values in
 * localStorage. Rather than silently ignoring them (which left the switcher and
 * the rendered text disagreeing), the stored value is rewritten to the resolved
 * supported language on first load.
 */
function readPersistedLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;

  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return defaultLanguage;
  }

  if (isSupportedLanguage(stored)) return stored;

  // Nothing stored yet: fall back to the browser preference, still constrained
  // to the two supported languages.
  const resolved = stored
    ? resolveLanguage(stored, defaultLanguage)
    : detectBrowserLanguage(navigator?.languages ?? [navigator?.language ?? ''], defaultLanguage);

  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
  } catch {
    /* storage unavailable (private mode): resolved value is still applied in-memory */
  }
  return resolved;
}

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLanguageState(readPersistedLanguage());
  }, []);

  // Keep <html lang> honest for screen readers and browser translation prompts.
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    document.documentElement.lang = language;
  }, [language, mounted]);

  const setLanguage = useCallback((lang: Language) => {
    const resolved = resolveLanguage(lang, defaultLanguage);
    setLanguageState(resolved);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, resolved);
      } catch {
        /* ignore storage failures; the in-memory switch already happened */
      }
    }
  }, []);

  const t = useCallback((keyPath: string, params?: TranslationParams): string => {
    const keys = keyPath.split('.');
    let current: any = dictionaries[language] || dictionaries[defaultLanguage];

    for (const key of keys) {
      if (current === undefined || current === null || current[key] === undefined) {
        // Fallback to default language if key is missing in current language
        let fallbackCurrent: any = dictionaries[defaultLanguage];
        for (const fbKey of keys) {
          if (fallbackCurrent === undefined || fallbackCurrent === null || fallbackCurrent[fbKey] === undefined) {
            return keyPath; // Return key path if fully missing
          }
          fallbackCurrent = fallbackCurrent[fbKey];
        }
        return typeof fallbackCurrent === 'string' ? interpolate(fallbackCurrent, params) : keyPath;
      }
      current = current[key];
    }

    return typeof current === 'string' ? interpolate(current, params) : keyPath;
  }, [language]);

  // Render the default language until mounted so the server-rendered HTML and
  // the first client paint agree (avoids hydration mismatch).
  return (
    <LanguageContext.Provider value={{ language: mounted ? language : defaultLanguage, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
