export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export const ERROR_CODE_TRANSLATIONS = {
  bad_request: 'errors.code.bad_request',
  not_found: 'errors.code.not_found',
  forbidden: 'errors.code.forbidden',
  conflict: 'errors.code.conflict',
  internal_error: 'errors.code.internal_error',
  invalid_credentials: 'errors.code.invalid_credentials',
  email_already_registered: 'errors.code.email_already_registered',
  password_too_short: 'errors.code.password_too_short',
} as const;

export type KnownErrorCode = keyof typeof ERROR_CODE_TRANSLATIONS;

const STATUS_TRANSLATIONS: Record<number, string> = {
  400: 'errors.status.badRequest',
  401: 'errors.status.unauthorized',
  403: 'errors.status.unauthorized',
  404: 'errors.status.notFound',
  409: 'errors.status.conflict',
  413: 'errors.status.tooLarge',
  422: 'errors.status.validation',
  429: 'errors.status.rateLimited',
};

function readErrorCode(error: any): string | null {
  const bodyCode = error?.response?.data?.error_code;
  if (typeof bodyCode === 'string' && bodyCode.trim()) return bodyCode.trim();

  const headers = error?.response?.headers;
  const headerCode =
    headers?.['x-error-code'] ??
    headers?.['X-Error-Code'] ??
    (typeof headers?.get === 'function' ? headers.get('x-error-code') : null);
  return typeof headerCode === 'string' && headerCode.trim()
    ? headerCode.trim()
    : null;
}

function readRawMessage(error: any): string | null {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return null;
}

export interface LocalizedApiError {
  message: string;
  code: string | null;
  status?: number;
  usedRawMessage: boolean;
}

/**
 * Prefer a stable backend code, then an HTTP-status translation. Existing
 * prose-only responses remain compatible through the raw-message fallback.
 */
export function getLocalizedApiError(
  error: any,
  t: Translate,
  options?: { fallbackKey?: string },
): LocalizedApiError {
  const response = error?.response;
  const status =
    typeof response?.status === 'number' ? response.status : undefined;
  const code = readErrorCode(error);

  if (!response) {
    return {
      message: t('errors.network'),
      code: 'network',
      status,
      usedRawMessage: false,
    };
  }

  const normalizedCode = code?.toLowerCase() ?? null;
  if (normalizedCode && normalizedCode in ERROR_CODE_TRANSLATIONS) {
    return {
      message: t(ERROR_CODE_TRANSLATIONS[normalizedCode as KnownErrorCode]),
      code,
      status,
      usedRawMessage: false,
    };
  }

  const rawMessage = readRawMessage(error);
  if (rawMessage) {
    return {
      message: rawMessage,
      code,
      status,
      usedRawMessage: true,
    };
  }

  const statusKey =
    status !== undefined
      ? STATUS_TRANSLATIONS[status] ??
        (status >= 500 ? 'errors.status.server' : undefined)
      : undefined;
  if (statusKey) {
    return {
      message: t(statusKey),
      code,
      status,
      usedRawMessage: false,
    };
  }

  return {
    message: t(options?.fallbackKey ?? 'errors.unknown'),
    code,
    status,
    usedRawMessage: false,
  };
}

export function localizedApiErrorMessage(
  error: any,
  t: Translate,
  options?: { fallbackKey?: string },
): string {
  return getLocalizedApiError(error, t, options).message;
}
