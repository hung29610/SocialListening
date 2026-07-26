import { vi } from './locales/vi';
import { en } from './locales/en';

/**
 * Nope360 ships exactly two product languages: Vietnamese and English.
 *
 * Anything else (previously th/ja/ko/zh) is retired: not selectable, not loaded
 * and not a valid persisted preference. `resolveLanguage` is the single place
 * that turns an arbitrary stored/detected value into a supported language, so a
 * stale cookie, localStorage entry or Accept-Language header can never leave the
 * UI in a half-translated state.
 */
export const dictionaries = {
  vi,
  en,
};

export type Language = keyof typeof dictionaries;
export type Dictionary = typeof vi;

export const DEFAULT_LANGUAGE: Language = 'vi';

export const SUPPORTED_LANGUAGES: Language[] = ['vi', 'en'];

/** Locales that used to be selectable and must never come back silently. */
export const RETIRED_LANGUAGES = ['th', 'ja', 'ko', 'zh'] as const;

export const languageNames: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};

export const LANGUAGE_STORAGE_KEY = 'app_language';

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as string[]).includes(value);
}

/**
 * Resolve any locale-ish input to a supported language.
 *
 * Accepts exact tags ("vi", "en"), regional tags ("vi-VN", "en-US", "en_GB")
 * and mixed casing. Unsupported, retired or unparseable values fall back to the
 * project default (Vietnamese).
 */
export function resolveLanguage(value: unknown, fallback: Language = DEFAULT_LANGUAGE): Language {
  if (typeof value !== 'string') return fallback;

  const normalized = value.trim().toLowerCase().replace('_', '-');
  if (!normalized) return fallback;

  if (isSupportedLanguage(normalized)) return normalized;

  const base = normalized.split('-')[0];
  if (isSupportedLanguage(base)) return base;

  return fallback;
}

/**
 * Pick the best supported language from a browser language list.
 * Returns the default when nothing in the list is supported.
 */
export function detectBrowserLanguage(
  candidates: readonly string[] | undefined,
  fallback: Language = DEFAULT_LANGUAGE,
): Language {
  for (const candidate of candidates ?? []) {
    const normalized = typeof candidate === 'string' ? candidate.trim().toLowerCase().replace('_', '-') : '';
    if (!normalized) continue;
    if (isSupportedLanguage(normalized)) return normalized;
    const base = normalized.split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return fallback;
}
