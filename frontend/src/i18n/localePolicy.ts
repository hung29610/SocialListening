export const SUPPORTED_LANGUAGES = ['vi', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'vi';
export const RETIRED_LANGUAGES = ['th', 'ja', 'ko', 'zh'] as const;
export const LANGUAGE_STORAGE_KEY = 'app_language';

/**
 * Runs in <head> before the body paints. English-mirror browsers hide the
 * Vietnamese SSR body until React hydrates it in English; Vietnamese remains
 * immediately visible. The provider removes the pending marker after applying
 * the same normalization policy.
 */
export const LANGUAGE_BOOTSTRAP_SCRIPT = `(() => {
  const key = ${JSON.stringify(LANGUAGE_STORAGE_KEY)};
  const retired = ${JSON.stringify(RETIRED_LANGUAGES)};
  let stored = null;
  try { stored = localStorage.getItem(key); } catch {}
  const language = stored === 'en' || retired.includes(stored)
    ? 'en'
    : ${JSON.stringify(DEFAULT_LANGUAGE)};
  try { localStorage.setItem(key, language); } catch {}
  document.documentElement.lang = language;
  if (language === 'en') {
    document.documentElement.dataset.i18nPending = 'true';
  }
})();`;

export type TranslationParams = Record<string, string | number>;

export function isSupportedLanguage(value: unknown): value is Language {
  return value === 'vi' || value === 'en';
}

/**
 * Normalize a persisted preference according to the product migration policy.
 *
 * The four retired values represent an intentional non-Vietnamese choice and
 * therefore migrate to English. Missing or otherwise invalid data defaults to
 * Vietnamese. Locale negotiation is deliberately not performed here.
 */
export function normalizeStoredLanguage(value: unknown): Language {
  if (isSupportedLanguage(value)) return value;
  if (
    typeof value === 'string' &&
    (RETIRED_LANGUAGES as readonly string[]).includes(value)
  ) {
    return 'en';
  }
  return DEFAULT_LANGUAGE;
}

export function interpolateTranslation(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : placeholder,
  );
}
