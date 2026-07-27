'use client';

/**
 * PublicSiteShell — SIGNAL public-site chrome (Epic SIGNAL, ADR 0002 — W-C).
 *
 * Nav + crafted footer shared by `/`, `/about` and `/features`.
 * Structure adapted from the read-only reference worktree
 * (`workspaces/nope360-public-experience-v2` → PublicSiteShell.tsx),
 * fully restyled to the SIGNAL token system (src/styles/tokens.css).
 *
 * Language: the public pages ship static Vietnamese-first copy exactly
 * like the pre-SIGNAL landing page did (the app-wide LanguageProvider
 * in layout.tsx keeps wrapping everything; the dashboard consumes it,
 * public pages do not — mechanism preserved, see W-C result notes).
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, MoonStar, SunMedium, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const NAV_LINKS = [
  { href: '/', label: 'Trang chủ' },
  { href: '/features', label: 'Tính năng' },
  { href: '/about', label: 'Giới thiệu' },
] as const;

/* Static waveform motif — the SIGNAL signature, rendered as pure CSS
   bars (no canvas, no motion): noise resolving into one signal spike. */
const WAVE_BARS = [
  18, 30, 22, 44, 26, 56, 34, 24, 62, 38, 28, 74, 46, 30, 88, 54, 36, 100,
  64, 42, 30, 52, 26, 40, 20, 32, 16,
] as const;

export function SignalWaveMark({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-end gap-[3px] ${className}`.trim()}
    >
      {WAVE_BARS.map((height, index) => (
        <span
          key={index}
          className={`w-[3px] rounded-full ${
            height === 100 ? 'bg-signal' : 'bg-signal/25'
          }`}
          style={{ height: `${Math.max(4, Math.round(height * 0.4))}px` }}
        />
      ))}
    </div>
  );
}

function ThemeChip() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const label = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-void-raised/70 text-paper-muted transition-colors hover:border-edge-strong hover:text-paper"
    >
      {mounted ? (
        isDark ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />
      ) : (
        <MoonStar className="h-4 w-4" />
      )}
    </button>
  );
}

function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-edge/60 bg-void/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6 md:px-8">
        <Link
          href="/"
          aria-label="Nope360 — trang chủ"
          className="group inline-flex min-w-0 items-center gap-3 rounded-full"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-signal font-display text-sm font-bold text-white shadow-glow-signal-sm">
            N
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-bold tracking-eyebrow text-paper">
              NOPE360
            </span>
            <span className="block text-[11px] leading-tight text-paper-faint">
              Social listening
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Điều hướng chính">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`text-sm font-medium transition-colors ${
                  active
                    ? 'text-paper'
                    : 'text-paper-muted hover:text-paper'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <ThemeChip />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-paper-muted transition-colors hover:text-paper sm:block"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="hidden items-center rounded-full bg-signal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-signal-bright lg:inline-flex"
          >
            Bắt đầu
          </Link>
          <button
            type="button"
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={open}
            aria-controls="public-nav-mobile"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-void-raised/70 text-paper lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="public-nav-mobile"
          aria-label="Điều hướng di động"
          className="border-t border-edge/60 bg-void-surface/95 px-6 py-4 backdrop-blur-xl lg:hidden"
        >
          <ul className="space-y-1">
            {[...NAV_LINKS, { href: '/login', label: 'Đăng nhập' }, { href: '/register', label: 'Bắt đầu' }].map(
              (link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={pathname === link.href ? 'page' : undefined}
                    className={`block rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      pathname === link.href
                        ? 'bg-signal/10 text-signal dark:text-signal-bright'
                        : 'text-paper-muted hover:bg-void-raised hover:text-paper'
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

/* ── Footer — a designed moment, not an afterthought ──────────────── */

function PublicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-edge bg-void-surface">
      <div className="mx-auto w-full max-w-7xl px-6 py-20 md:px-8 md:py-28">
        <div className="grid gap-14 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
          <div className="min-w-0">
            <SignalWaveMark className="mb-8" />
            <p className="max-w-xl text-balance font-display text-display-md font-bold text-paper">
              Internet là nhiễu.
              <br />
              <span className="text-signal dark:text-signal-bright">
                Tín hiệu là của bạn.
              </span>
            </p>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-paper-muted">
              Nope360 theo dõi các nguồn public, phân tích sắc thái thảo luận
              bằng AI hiểu ngữ cảnh tiếng Việt và chuyển tín hiệu rủi ro thành
              cảnh báo, sự cố và báo cáo — trong một không gian làm việc duy nhất.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-14">
            <nav aria-label="Sản phẩm">
              <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
                Sản phẩm
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link href="/" className="text-paper-muted transition-colors hover:text-paper">
                    Trang chủ
                  </Link>
                </li>
                <li>
                  <Link href="/features" className="text-paper-muted transition-colors hover:text-paper">
                    Tính năng
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="text-paper-muted transition-colors hover:text-paper">
                    Giới thiệu
                  </Link>
                </li>
              </ul>
            </nav>
            <nav aria-label="Truy cập">
              <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
                Truy cập
              </p>
              <ul className="mt-5 space-y-3 text-sm">
                <li>
                  <Link href="/login" className="text-paper-muted transition-colors hover:text-paper">
                    Đăng nhập
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-paper-muted transition-colors hover:text-paper">
                    Đăng ký
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-paper-muted transition-colors hover:text-paper">
                    Vào workspace
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-edge pt-8 text-xs text-paper-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Nope360 · Nền tảng social listening cho thị trường Việt Nam.</p>
          <p className="font-display uppercase tracking-eyebrow">Noise in · Signal out</p>
        </div>
      </div>
    </footer>
  );
}

/* ── Shell ────────────────────────────────────────────────────────── */

export default function PublicSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-void text-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-signal focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Bỏ qua điều hướng
      </a>
      <PublicNav />
      {/* pt-16 offsets the fixed 4rem nav to keep zero CLS */}
      <main id="main-content" className="flex-1 pt-16">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
