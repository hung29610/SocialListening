import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          elevated: 'hsl(var(--surface-elevated))',
          muted: 'hsl(var(--surface-muted))',
          glass: 'hsla(var(--surface-glass))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          'item-active': 'var(--sidebar-item-active)',
          'item-hover': 'var(--sidebar-item-hover)',
        },
        editorial: {
          accent: 'hsl(var(--editorial-accent))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
        },
        'chart-1': 'hsl(var(--chart-1))',
        'chart-2': 'hsl(var(--chart-2))',
        'chart-3': 'hsl(var(--chart-3))',
        'chart-4': 'hsl(var(--chart-4))',
        'chart-5': 'hsl(var(--chart-5))',
        'chart-6': 'hsl(var(--chart-6))',
        'chart-7': 'hsl(var(--chart-7))',
        'chart-8': 'hsl(var(--chart-8))',
        /* ── SIGNAL tokens (Epic SIGNAL, ADR 0002 — src/styles/tokens.css) ── */
        void: {
          DEFAULT: 'hsl(var(--void) / <alpha-value>)',
          surface: 'hsl(var(--void-surface) / <alpha-value>)',
          raised: 'hsl(var(--void-raised) / <alpha-value>)',
        },
        paper: {
          DEFAULT: 'hsl(var(--paper) / <alpha-value>)',
          muted: 'hsl(var(--paper-muted) / <alpha-value>)',
          faint: 'hsl(var(--paper-faint) / <alpha-value>)',
        },
        signal: {
          DEFAULT: 'hsl(var(--signal) / <alpha-value>)',
          bright: 'hsl(var(--signal-bright) / <alpha-value>)',
          deep: 'hsl(var(--signal-deep) / <alpha-value>)',
        },
        sentiment: {
          positive: 'hsl(var(--sentiment-positive) / <alpha-value>)',
          negative: 'hsl(var(--sentiment-negative) / <alpha-value>)',
          neutral: 'hsl(var(--sentiment-neutral) / <alpha-value>)',
        },
        edge: {
          DEFAULT: 'hsl(var(--edge) / <alpha-value>)',
          strong: 'hsl(var(--edge-strong) / <alpha-value>)',
        },
      },
      fontFamily: {
        /* SIGNAL display face — Space Grotesk via next/font (--font-display
           set on <body> in src/app/layout.tsx); Inter fallback keeps SSR/
           no-JS rendering sane. */
        display: ['var(--font-display)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['var(--text-display-2xl)', { lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-display)' }],
        'display-xl': ['var(--text-display-xl)', { lineHeight: 'var(--leading-display)', letterSpacing: 'var(--tracking-display)' }],
        'display-lg': ['var(--text-display-lg)', { lineHeight: '1', letterSpacing: 'var(--tracking-display)' }],
        'display-md': ['var(--text-display-md)', { lineHeight: '1.05', letterSpacing: 'var(--tracking-display)' }],
        'metric-lg': ['var(--text-metric-lg)', { lineHeight: '1', letterSpacing: 'var(--tracking-metric)' }],
        metric: ['var(--text-metric)', { lineHeight: '1', letterSpacing: 'var(--tracking-metric)' }],
        eyebrow: ['var(--text-eyebrow)', { lineHeight: '1.2', letterSpacing: 'var(--tracking-eyebrow)' }],
      },
      letterSpacing: {
        display: 'var(--tracking-display)',
        metric: 'var(--tracking-metric)',
        eyebrow: 'var(--tracking-eyebrow)',
      },
      lineHeight: {
        display: 'var(--leading-display)',
      },
      boxShadow: {
        'glow-signal': 'var(--glow-signal)',
        'glow-signal-sm': 'var(--glow-signal-sm)',
        tile: 'var(--shadow-tile)',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        marketing: '24px',
        pill: '9999px',
        tile: 'var(--radius-tile)',
      },
      spacing: {
        '4.5': '1.125rem',
        /* 8px-grid additions for SIGNAL section rhythm */
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
        band: 'var(--space-band)',
      },
    },
  },
  plugins: [],
}
export default config
