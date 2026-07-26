/**
 * Locale persistence and switching behaviour, including migration of a stored
 * locale that is no longer supported.
 *
 * Uses plain textContent assertions so no extra matcher package is needed.
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { LANGUAGE_STORAGE_KEY } from '@/i18n';
import { LanguageProvider, useLanguage } from './LanguageContext';

function Probe() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="title">{t('auth.loginTitle')}</span>
      <button onClick={() => setLanguage('en')}>to-en</button>
      <button onClick={() => setLanguage('vi')}>to-vi</button>
    </div>
  );
}

function renderProbe() {
  return render(
    <LanguageProvider>
      <Probe />
    </LanguageProvider>,
  );
}

const text = (testId: string) => screen.getByTestId(testId).textContent;

function setNavigatorLanguages(languages: string[]) {
  Object.defineProperty(window.navigator, 'languages', {
    value: languages,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'language', {
    value: languages[0] ?? 'vi-VN',
    configurable: true,
  });
}

describe('LanguageProvider persistence', () => {
  it('defaults to Vietnamese when nothing is stored and the browser prefers Vietnamese', async () => {
    setNavigatorLanguages(['vi-VN']);
    renderProbe();
    await screen.findByTestId('lang');
    expect(text('lang')).toBe('vi');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
  });

  it('adopts English when the browser prefers English and nothing is stored', async () => {
    setNavigatorLanguages(['en-US', 'vi-VN']);
    renderProbe();
    await screen.findByTestId('lang');
    expect(text('lang')).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  });

  it('restores a valid stored language', async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    setNavigatorLanguages(['vi-VN']);
    renderProbe();
    await screen.findByTestId('lang');
    expect(text('lang')).toBe('en');
  });

  it.each(['th', 'ja', 'ko', 'zh', 'zh-CN', 'xx-YY', 'not-a-locale'])(
    'migrates the unsupported stored locale %s to the default',
    async stored => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, stored);
      setNavigatorLanguages(['en-US']);
      renderProbe();
      await screen.findByTestId('lang');

      expect(text('lang')).toBe('vi');
      // The stale value must be rewritten, not merely ignored.
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    },
  );

  it('persists an explicit switch and keeps <html lang> in sync', async () => {
    setNavigatorLanguages(['vi-VN']);
    renderProbe();
    await screen.findByTestId('lang');
    expect(text('lang')).toBe('vi');

    await act(async () => {
      screen.getByText('to-en').click();
    });

    expect(text('lang')).toBe('en');
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.documentElement.lang).toBe('en');

    await act(async () => {
      screen.getByText('to-vi').click();
    });
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('vi');
    expect(document.documentElement.lang).toBe('vi');
  });

  it('renders different text per language', async () => {
    setNavigatorLanguages(['vi-VN']);
    renderProbe();
    await screen.findByTestId('title');
    const viTitle = text('title');

    await act(async () => {
      screen.getByText('to-en').click();
    });
    const enTitle = text('title');

    expect(viTitle).toBeTruthy();
    expect(enTitle).toBeTruthy();
    expect(viTitle).not.toBe(enTitle);
  });
});

describe('t()', () => {
  function EdgeCaseProbe() {
    const { t } = useLanguage();
    return (
      <div>
        <span data-testid="missing">{t('does.not.exist')}</span>
        <span data-testid="object">{t('auth')}</span>
        <span data-testid="interpolated">{t('auth.slowHintStarting', { unused: 1 })}</span>
      </div>
    );
  }

  it('returns the key path for a missing key and never renders [object Object]', async () => {
    render(
      <LanguageProvider>
        <EdgeCaseProbe />
      </LanguageProvider>,
    );
    await screen.findByTestId('missing');
    expect(text('missing')).toBe('does.not.exist');
    expect(text('object')).toBe('auth');
    expect(text('interpolated')).not.toContain('[object');
  });
});
