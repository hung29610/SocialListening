'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Display } from '@/components/ui/Display';
import {
  AuthShell,
  authErrorClass,
  authInputClass,
  authLabelClass,
  authLinkClass,
  authSubmitClass,
} from '@/components/auth/AuthShell';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu không khớp');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
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
        toast.success('Đăng ký thành công! Vui lòng đăng nhập.');
        router.push('/login');
      } else {
        const data = await response.json();
        setError(data.detail || 'Đăng ký thất bại');
      }
    } catch (err) {
      setError('Không thể kết nối đến server');
      console.error('Register error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      /* COPY_TBD: draft brand-zone copy below — pending human copywriting */
      brandEyebrow="Nope360 · Social listening"
      brandHeadline="Tách tín hiệu khỏi nhiễu, từ hôm nay."
      brandBody="Tạo tài khoản để thiết lập dự án, quét mentions và nhận cảnh báo sớm khi có rủi ro."
    >
      <div>
        <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
          Nope360 workspace
        </p>
        <Display as="h1" size="md" className="mt-3 break-words text-paper">
          Đăng ký tài khoản
        </Display>
        <p className="mt-2 text-sm text-paper-muted">
          Hoặc{' '}
          <Link href="/login" className={authLinkClass}>
            đăng nhập nếu đã có tài khoản
          </Link>
        </p>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div id="register-error" role="alert" className={authErrorClass}>
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="full_name" className={authLabelClass}>
              Họ và tên
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              aria-describedby={error ? 'register-error' : undefined}
              className={authInputClass}
              placeholder="Nguyễn Văn A"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="email" className={authLabelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-describedby={error ? 'register-error' : undefined}
              className={authInputClass}
              placeholder="email@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="password" className={authLabelClass}>
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby={error ? 'register-error' : undefined}
              className={authInputClass}
              placeholder="Ít nhất 6 ký tự"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className={authLabelClass}>
              Xác nhận mật khẩu
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-describedby={error ? 'register-error' : undefined}
              className={authInputClass}
              placeholder="Nhập lại mật khẩu"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>
        </div>

        <div>
          <button type="submit" disabled={loading} className={authSubmitClass}>
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
