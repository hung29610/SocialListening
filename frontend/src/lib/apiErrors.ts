/**
 * Localized API error messages.
 *
 * The backend now returns a stable `error_code` (in the JSON body and the
 * `X-Error-Code` header) alongside its existing Vietnamese `detail`. The code is
 * what we branch on: the user-visible sentence is chosen here, in the language
 * the user selected, instead of being fixed on the server.
 *
 * Fallback order:
 *   1. a translation for the specific `error_code`
 *   2. a translation for the HTTP status
 *   3. the backend `detail` — but only when the UI language is Vietnamese, since
 *      `detail` is always Vietnamese and would otherwise put Vietnamese text in
 *      an English UI
 *   4. a generic localized message
 */
import type { Language } from '@/i18n';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Every code the backend can emit that has a dedicated translation. */
export const KNOWN_ERROR_CODES = [
  // generic
  'bad_request',
  'not_found',
  'forbidden',
  'conflict',
  'internal_error',
  // sources
  'source_not_found',
  'source_group_not_found',
  'source_duplicate_url',
  'source_invalid_feed',
  'source_create_failed',
  'source_update_failed',
  'source_list_failed',
  // feed URL guards
  'invalid_url',
  'unsupported_scheme',
  'credentials_in_url',
  'blocked_port',
  'unresolvable_host',
  'blocked_target',
  'too_many_redirects',
  'timeout',
  'tls_error',
  'http_error',
  'fetch_failed',
  'too_large',
  'invalid_xml',
  'parse_failed',
  // OPML
  'opml_bad_extension',
  'opml_empty_file',
  'opml_too_large',
  'opml_doctype_forbidden',
  'opml_invalid_xml',
  'opml_not_opml',
  'opml_no_feeds',
  // auth
  'invalid_credentials',
  'email_already_registered',
  'password_too_short',
] as const;

export type KnownErrorCode = (typeof KNOWN_ERROR_CODES)[number];

const KNOWN = new Set<string>(KNOWN_ERROR_CODES);

export function isKnownErrorCode(code: unknown): code is KnownErrorCode {
  return typeof code === 'string' && KNOWN.has(code);
}

/** Read the error code from the response body or the X-Error-Code header. */
export function extractErrorCode(error: any): string | null {
  const fromBody = error?.response?.data?.error_code;
  if (typeof fromBody === 'string' && fromBody) return fromBody;

  const headers = error?.response?.headers;
  const fromHeader =
    headers?.['x-error-code'] ??
    headers?.['X-Error-Code'] ??
    (typeof headers?.get === 'function' ? headers.get('x-error-code') : undefined);
  if (typeof fromHeader === 'string' && fromHeader) return fromHeader;

  return null;
}

function statusKey(status: number | undefined): string | null {
  if (!status) return null;
  if (status === 400) return 'errors.status.badRequest';
  if (status === 401 || status === 403) return 'errors.status.unauthorized';
  if (status === 404) return 'errors.status.notFound';
  if (status === 409) return 'errors.status.conflict';
  if (status === 413) return 'errors.status.tooLarge';
  if (status === 422) return 'errors.status.validation';
  if (status === 429) return 'errors.status.rateLimited';
  if (status >= 500) return 'errors.status.server';
  return null;
}

export interface LocalizedApiError {
  message: string;
  code: string | null;
  status?: number;
  /** True when the text came from the backend rather than the dictionary. */
  usedBackendDetail: boolean;
}

/**
 * Turn an axios-style error into a message in the active language.
 *
 * `language` is required so the Vietnamese-only backend `detail` is never shown
 * inside an English UI.
 */
export function getLocalizedApiError(
  error: any,
  t: Translate,
  language: Language,
  options?: { fallbackKey?: string },
): LocalizedApiError {
  const status: number | undefined = error?.response?.status;
  const code = extractErrorCode(error);
  const detail = error?.response?.data?.detail;
  const detailText = typeof detail === 'string' ? detail.trim() : '';

  // No response at all: network layer failure.
  if (!error?.response) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      message: t(offline ? 'errors.offline' : 'errors.network'),
      code: offline ? 'offline' : 'network',
      status,
      usedBackendDetail: false,
    };
  }

  if (isKnownErrorCode(code)) {
    return { message: t(`errors.code.${code}`), code, status, usedBackendDetail: false };
  }

  const byStatus = statusKey(status);
  if (byStatus) {
    // Prefer the backend's specific sentence when the UI is already Vietnamese.
    if (language === 'vi' && detailText) {
      return { message: detailText, code, status, usedBackendDetail: true };
    }
    return { message: t(byStatus), code, status, usedBackendDetail: false };
  }

  if (language === 'vi' && detailText) {
    return { message: detailText, code, status, usedBackendDetail: true };
  }

  return {
    message: t(options?.fallbackKey || 'errors.unknown'),
    code,
    status,
    usedBackendDetail: false,
  };
}

/** Convenience wrapper when only the string is needed. */
export function localizedApiErrorMessage(
  error: any,
  t: Translate,
  language: Language,
  options?: { fallbackKey?: string },
): string {
  return getLocalizedApiError(error, t, language, options).message;
}
