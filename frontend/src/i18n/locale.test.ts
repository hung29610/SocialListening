/**
 * Locale policy unit tests: supported set, resolution, browser detection.
 * Mirrors scripts/check-locale-behavior.mjs so a regression fails in `npm test`
 * as well as in the standalone check.
 */
import {
  DEFAULT_LANGUAGE,
  RETIRED_LANGUAGES,
  SUPPORTED_LANGUAGES,
  detectBrowserLanguage,
  dictionaries,
  isSupportedLanguage,
  languageNames,
  resolveLanguage,
} from './index';

describe('locale policy', () => {
  it('supports exactly Vietnamese and English', () => {
    expect([...SUPPORTED_LANGUAGES].sort()).toEqual(['en', 'vi']);
  });

  it('defaults to Vietnamese', () => {
    expect(DEFAULT_LANGUAGE).toBe('vi');
  });

  it('loads only the supported dictionaries', () => {
    expect(Object.keys(dictionaries).sort()).toEqual(['en', 'vi']);
  });

  it('exposes exactly the supported languages in the selector map', () => {
    expect(Object.keys(languageNames).sort()).toEqual(['en', 'vi']);
    expect(languageNames.vi).toBe('Tiếng Việt');
    expect(languageNames.en).toBe('English');
  });

  it('does not load or accept retired locales', () => {
    for (const retired of RETIRED_LANGUAGES) {
      expect((dictionaries as Record<string, unknown>)[retired]).toBeUndefined();
      expect(isSupportedLanguage(retired)).toBe(false);
    }
  });
});

describe('resolveLanguage', () => {
  it('passes through exact supported tags', () => {
    expect(resolveLanguage('vi')).toBe('vi');
    expect(resolveLanguage('en')).toBe('en');
  });

  it('maps regional tags to their base language', () => {
    expect(resolveLanguage('vi-VN')).toBe('vi');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('en-GB')).toBe('en');
    expect(resolveLanguage('en_AU')).toBe('en');
  });

  it('normalises casing and whitespace', () => {
    expect(resolveLanguage('  EN  ')).toBe('en');
    expect(resolveLanguage('Vi-Vn')).toBe('vi');
  });

  it('falls back to Vietnamese for retired locales', () => {
    for (const retired of RETIRED_LANGUAGES) {
      expect(resolveLanguage(retired)).toBe('vi');
    }
    expect(resolveLanguage('zh-CN')).toBe('vi');
    expect(resolveLanguage('ja-JP')).toBe('vi');
  });

  it('falls back to Vietnamese for unknown or malformed values', () => {
    for (const value of ['fr', '', '   ', null, undefined, 42, {}, []]) {
      expect(resolveLanguage(value as unknown)).toBe('vi');
    }
  });

  it('honours an explicit fallback', () => {
    expect(resolveLanguage('th', 'en')).toBe('en');
    expect(resolveLanguage(null, 'en')).toBe('en');
  });
});

describe('detectBrowserLanguage', () => {
  it('picks the first supported entry', () => {
    expect(detectBrowserLanguage(['ja-JP', 'ko-KR', 'en-US', 'vi-VN'])).toBe('en');
    expect(detectBrowserLanguage(['vi-VN', 'en-US'])).toBe('vi');
  });

  it('falls back when nothing is supported', () => {
    expect(detectBrowserLanguage(['th-TH', 'zh-CN'])).toBe('vi');
    expect(detectBrowserLanguage([])).toBe('vi');
    expect(detectBrowserLanguage(undefined)).toBe('vi');
  });
});

describe('dictionary integrity', () => {
  const flatten = (obj: unknown, prefix = ''): string[] => {
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      typeof value === 'object' && value !== null
        ? flatten(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  };

  it('has identical key sets in vi and en', () => {
    const viKeys = flatten(dictionaries.vi).sort();
    const enKeys = flatten(dictionaries.en).sort();
    expect(enKeys).toEqual(viKeys);
  });

  it('has no empty values', () => {
    for (const locale of SUPPORTED_LANGUAGES) {
      const entries = flatten(dictionaries[locale]);
      expect(entries.length).toBeGreaterThan(0);
    }
  });

  it('translates the auth section differently in each language', () => {
    expect(dictionaries.vi.auth.loginTitle).not.toBe(dictionaries.en.auth.loginTitle);
    expect(dictionaries.vi.auth.errorInvalidCredentials).not.toBe(
      dictionaries.en.auth.errorInvalidCredentials,
    );
  });
});
