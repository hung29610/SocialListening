import { vi } from './locales/vi';
import { en } from './locales/en';
import type { Language } from './localePolicy';

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_BOOTSTRAP_SCRIPT,
  LANGUAGE_STORAGE_KEY,
  RETIRED_LANGUAGES,
  SUPPORTED_LANGUAGES,
  interpolateTranslation,
  isSupportedLanguage,
  normalizeStoredLanguage,
} from './localePolicy';
export type { Language, TranslationParams } from './localePolicy';

export const dictionaries = {
  vi,
  en,
};

export type Dictionary = typeof vi;

export const languageNames: Record<Language, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
};
