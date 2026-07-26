/**
 * Localized API error mapping.
 *
 * The important property: an English UI must never be handed the backend's
 * Vietnamese `detail`.
 */
import { en } from '@/i18n/locales/en';
import { vi } from '@/i18n/locales/vi';
import {
  KNOWN_ERROR_CODES,
  extractErrorCode,
  getLocalizedApiError,
  isKnownErrorCode,
  localizedApiErrorMessage,
} from './apiErrors';

type Dict = Record<string, unknown>;

function makeT(dict: Dict) {
  return (key: string, params?: Record<string, string | number>) => {
    const value = key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Dict)[part];
      return undefined;
    }, dict);
    if (typeof value !== 'string') return key;
    if (!params) return value;
    return value.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  };
}

const tVi = makeT(vi as unknown as Dict);
const tEn = makeT(en as unknown as Dict);

const axiosError = (options: {
  status?: number;
  code?: string;
  detail?: string;
  headers?: Record<string, string>;
  noResponse?: boolean;
}) => {
  if (options.noResponse) return { message: 'Network Error' };
  return {
    response: {
      status: options.status ?? 400,
      data: {
        ...(options.detail ? { detail: options.detail } : {}),
        ...(options.code ? { error_code: options.code } : {}),
      },
      headers: options.headers ?? {},
    },
  };
};

describe('extractErrorCode', () => {
  it('reads the code from the response body', () => {
    expect(extractErrorCode(axiosError({ code: 'blocked_target' }))).toBe('blocked_target');
  });

  it('falls back to the X-Error-Code header', () => {
    expect(
      extractErrorCode(axiosError({ headers: { 'x-error-code': 'source_not_found' } })),
    ).toBe('source_not_found');
  });

  it('supports a Headers-like object', () => {
    const error = {
      response: {
        status: 404,
        data: {},
        headers: { get: (name: string) => (name === 'x-error-code' ? 'not_found' : undefined) },
      },
    };
    expect(extractErrorCode(error)).toBe('not_found');
  });

  it('returns null when no code is present', () => {
    expect(extractErrorCode(axiosError({ detail: 'Lỗi' }))).toBeNull();
  });
});

describe('every known code has a translation in both languages', () => {
  it.each(KNOWN_ERROR_CODES)('%s', code => {
    const viMessage = tVi(`errors.code.${code}`);
    const enMessage = tEn(`errors.code.${code}`);
    expect(viMessage).not.toBe(`errors.code.${code}`);
    expect(enMessage).not.toBe(`errors.code.${code}`);
    expect(viMessage.trim().length).toBeGreaterThan(0);
    expect(enMessage.trim().length).toBeGreaterThan(0);
  });
});

describe('getLocalizedApiError', () => {
  it('uses the code translation when the code is known', () => {
    const error = axiosError({ status: 400, code: 'blocked_target', detail: 'URL trỏ tới địa chỉ nội bộ nên không được phép.' });

    const viResult = getLocalizedApiError(error, tVi, 'vi');
    expect(viResult.message).toBe(tVi('errors.code.blocked_target'));
    expect(viResult.usedBackendDetail).toBe(false);

    const enResult = getLocalizedApiError(error, tEn, 'en');
    expect(enResult.message).toBe(tEn('errors.code.blocked_target'));
    expect(enResult.message).toMatch(/internal address/i);
  });

  it('never shows the Vietnamese backend detail in an English UI', () => {
    const vietnameseDetail = 'Nguồn với URL này đã tồn tại';
    const error = axiosError({ status: 409, detail: vietnameseDetail });

    const enResult = getLocalizedApiError(error, tEn, 'en');
    expect(enResult.message).not.toContain('Nguồn');
    expect(enResult.usedBackendDetail).toBe(false);
    expect(enResult.message).toBe(tEn('errors.status.conflict'));
  });

  it('prefers the specific backend detail in a Vietnamese UI when no code matches', () => {
    const vietnameseDetail = 'Nguồn với URL này đã tồn tại';
    const error = axiosError({ status: 409, detail: vietnameseDetail });

    const viResult = getLocalizedApiError(error, tVi, 'vi');
    expect(viResult.message).toBe(vietnameseDetail);
    expect(viResult.usedBackendDetail).toBe(true);
  });

  it('maps HTTP statuses when there is no code and no detail', () => {
    expect(getLocalizedApiError(axiosError({ status: 404 }), tEn, 'en').message).toBe(
      tEn('errors.status.notFound'),
    );
    expect(getLocalizedApiError(axiosError({ status: 500 }), tEn, 'en').message).toBe(
      tEn('errors.status.server'),
    );
    expect(getLocalizedApiError(axiosError({ status: 403 }), tEn, 'en').message).toBe(
      tEn('errors.status.unauthorized'),
    );
  });

  it('reports a network failure without a response', () => {
    const result = getLocalizedApiError(axiosError({ noResponse: true }), tEn, 'en');
    expect(result.code).toBe('network');
    expect(result.message).toBe(tEn('errors.network'));
  });

  it('ignores an unknown code and falls back by status', () => {
    const error = axiosError({ status: 400, code: 'some_future_code' });
    const result = getLocalizedApiError(error, tEn, 'en');
    expect(isKnownErrorCode('some_future_code')).toBe(false);
    expect(result.message).toBe(tEn('errors.status.badRequest'));
    expect(result.code).toBe('some_future_code');
  });

  it('supports a custom fallback key', () => {
    const error = { response: { status: 299, data: {}, headers: {} } };
    const result = getLocalizedApiError(error, tEn, 'en', { fallbackKey: 'errors.unknown' });
    expect(result.message).toBe(tEn('errors.unknown'));
  });

  it('localizedApiErrorMessage returns just the string', () => {
    const error = axiosError({ status: 404, code: 'source_not_found' });
    expect(localizedApiErrorMessage(error, tVi, 'vi')).toBe(tVi('errors.code.source_not_found'));
  });
});
