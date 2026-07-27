import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  type Language,
  normalizeStoredLanguage,
} from './localePolicy';

export interface LanguageStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PreferenceTransport {
  get(
    url: string,
    config?: { headers?: Record<string, string> },
  ): Promise<{ data?: { language?: unknown } }>;
  put(
    url: string,
    data: { language: Language },
    config?: { headers?: Record<string, string> },
  ): Promise<unknown>;
}

function browserStorage(): LanguageStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function writeLanguageMirror(
  language: Language,
  storage: LanguageStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The in-memory language remains authoritative for this browser session.
  }
}

export function readLanguageMirror(
  storage: LanguageStorage | null = browserStorage(),
): Language {
  let stored: unknown = null;
  try {
    stored = storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null;
  } catch {
    return DEFAULT_LANGUAGE;
  }

  const normalized = normalizeStoredLanguage(stored);
  if (stored !== normalized) writeLanguageMirror(normalized, storage);
  return normalized;
}

/**
 * Apply the signed-in user's server preference and refresh the first-paint
 * mirror. Unsupported server values are normalized lazily through the same
 * existing preferences endpoint.
 */
export async function syncServerLanguagePreference(
  transport: PreferenceTransport,
  options?: {
    storage?: LanguageStorage | null;
    token?: string;
  },
): Promise<Language> {
  const config = options?.token
    ? { headers: { Authorization: `Bearer ${options.token}` } }
    : undefined;
  const response = await transport.get('/api/auth/me/preferences', config);
  const stored = response.data?.language;
  const normalized = normalizeStoredLanguage(stored);

  writeLanguageMirror(
    normalized,
    options?.storage === undefined ? browserStorage() : options.storage,
  );

  if (stored !== normalized) {
    await transport.put(
      '/api/auth/me/preferences',
      { language: normalized },
      config,
    );
  }

  return normalized;
}

export async function saveServerLanguagePreference(
  transport: PreferenceTransport,
  language: Language,
): Promise<void> {
  await transport.put('/api/auth/me/preferences', { language });
}

/**
 * Apply a selection optimistically. Persistence failures are reported without
 * rolling back either the in-memory value or the first-paint mirror.
 */
export async function applyLanguageSelection(options: {
  requested: Language;
  transport?: PreferenceTransport | null;
  storage?: LanguageStorage | null;
  onApply(language: Language): void;
  onSaveFailure(language: Language): void;
}): Promise<void> {
  const language = normalizeStoredLanguage(options.requested);
  options.onApply(language);
  writeLanguageMirror(
    language,
    options.storage === undefined ? browserStorage() : options.storage,
  );

  if (!options.transport) return;
  try {
    await saveServerLanguagePreference(options.transport, language);
  } catch {
    options.onSaveFailure(language);
  }
}
