'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Display } from '@/components/ui/Display';
import {
  AuthShell,
  authErrorClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authSubmitClass,
} from '@/components/auth/AuthShell';

/** Matches the backend floor in POST /api/auth/register. */
const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  // Stored as a translation key (or a raw backend detail) so the message follows
  // the active language rather than the one selected when it was set.
  const [errorKey, setErrorKey] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const [loading, setLoading] = useState(false);

  const failWith = (key: string) => {
    setErrorKey(key);
    setErrorDetail('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorKey('');
    setErrorDetail('');

    if (formData.password !== formData.confirmPassword) {
      failWith('auth.errorPasswordMismatch');
      return;
    }

    if (formData.password.length < MIN_PASSWORD_LENGTH) {
      failWith('auth.errorPasswordTooShort');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name
        }),
      });

      if (response.ok) {
        // Registration successful, redirect to login
        toast.success(t('auth.registerSuccess'));
        router.push('/login');
      } else {
        const data = await response.json().catch(() => ({}));
        const detail = typeof data?.detail === 'string' ? data.detail.trim() : '';
        if (detail) {
          setErrorKey('');
          setErrorDetail(detail);
        } else {
          failWith('auth.errorRegisterFailed');
        }
      }
    } catch (err) {
      failWith('auth.errorTimeout');
      // Never log the submitted credentials, only the transport failure.
      console.error('Register request failed');
    } finally {
      setLoading(false);
    }
  };

  const errorMessage = errorKey ? t(errorKey) : errorDetail;

  return (
    <AuthShell
      brandEyebrow="Nope360 · Social listening"
      brandHeadline="Tách tín hiệu khỏi nhiễu, từ hôm nay."
      brandBody="Tạo tài khoản để thiết lập dự án, quét mentions và nhận cảnh báo sớm khi có rủi ro."
    >
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>
      <div>
        <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
          {t('auth.workspaceTag')}
        </p>
        <Display as="h1" size="md" className="mt-3 break-words text-paper">
          {t('auth.registerTitle')}
        </Display>
        <p className="mt-2 text-sm text-paper-muted">
          {t('auth.haveAccount')}{' '}
          <Link href="/login" className={authLinkClass}>
            {t('auth.loginNow')}
          </Link>
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {errorMessage && (
          <div id="register-error" role="alert" className={authErrorClass}>
            {errorMessage}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="full_name" className={authLabelClass}>
              {t('auth.fullNameLabel')}
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              autoComplete="name"
              required
              aria-describedby={errorMessage ? 'register-error' : undefined}
              className={authInputClass}
              placeholder={t('auth.fullNamePlaceholder')}
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="email" className={authLabelClass}>
              {t('auth.emailLabel')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              required
              aria-describedby={errorMessage ? 'register-error' : undefined}
              className={authInputClass}
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="password" className={authLabelClass}>
              {t('auth.passwordLabel')}
            </label>
            <input
              id="password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-describedby={errorMessage ? 'register-error' : undefined}
              className={authInputClass}
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <p id="password-hint" className="mt-1 text-xs text-paper-muted">
              {t('auth.passwordHint')}
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className={authLabelClass}>
              {t('auth.confirmPasswordLabel')}
            </label>
            <input
              id="confirmPassword"
              name="confirm-new-password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
              aria-describedby={errorMessage ? 'register-error' : undefined}
              className={authInputClass}
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>
        </div>

        <div>
          <button type="submit" disabled={loading} className={authSubmitClass}>
            {loading ? t('auth.registering') : t('auth.registerButton')}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
