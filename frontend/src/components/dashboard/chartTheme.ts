import type { CSSProperties } from 'react';

/**
 * SIGNAL chart theme — central recharts styling on the SIGNAL tokens
 * (Epic SIGNAL, ADR 0002; see src/styles/README.md + src/styles/tokens.css).
 *
 * Every value resolves through a CSS custom property, so charts follow
 * the active theme (dark void / light studio-paper) automatically and
 * no chart file ever hardcodes a palette value.
 *
 * Color discipline:
 * - `accent` is THE signal accent — reserve it for the single
 *   primary/total series of a chart, never for more than one series.
 * - Sentiment series MUST use the sentiment tokens (data encoding).
 * - `warning` covers alert/at-risk series (legacy semantic token).
 * - Everything else stays neutral (`ink*`).
 */

export const chartColors = {
  /** Primary / total series — the one signal accent, used sparingly. */
  accent: 'hsl(var(--signal))',
  /** Hover / active emphasis of the accent series. */
  accentBright: 'hsl(var(--signal-bright))',

  /** Sentiment data encoding. */
  positive: 'hsl(var(--sentiment-positive))',
  negative: 'hsl(var(--sentiment-negative))',
  neutral: 'hsl(var(--sentiment-neutral))',

  /** Neutral series (volume, reach, secondary lines, unknown buckets). */
  ink: 'hsl(var(--paper))',
  inkMuted: 'hsl(var(--paper-muted))',
  inkFaint: 'hsl(var(--paper-faint))',

  /** Alert / at-risk series (non-sentiment status; legacy semantic token). */
  warning: 'hsl(var(--warning))',
} as const;

/** CartesianGrid props. */
export const chartGrid = {
  stroke: 'hsl(var(--edge))',
  strokeDasharray: '3 3',
} as const;

/** XAxis/YAxis `tick` prop. */
export const chartAxisTick = {
  fill: 'hsl(var(--paper-faint))',
  fontSize: 12,
} as const;

/** Tooltip `contentStyle`. */
export const chartTooltipStyle: CSSProperties = {
  backgroundColor: 'hsl(var(--void-surface))',
  border: '1px solid hsl(var(--edge-strong))',
  borderRadius: '12px',
  boxShadow: 'var(--shadow-tile)',
  color: 'hsl(var(--paper))',
  fontSize: '12px',
};

/** Tooltip `itemStyle`. */
export const chartTooltipItemStyle: CSSProperties = {
  color: 'hsl(var(--paper-muted))',
};

/** Tooltip `labelStyle`. */
export const chartTooltipLabelStyle: CSSProperties = {
  color: 'hsl(var(--paper))',
  fontWeight: 600,
};

/** Legend `wrapperStyle`. */
export const chartLegendStyle: CSSProperties = {
  color: 'hsl(var(--paper-muted))',
  fontSize: '12px',
};

/** Reference/cursor line stroke for hover cursors. */
export const chartCursor = {
  stroke: 'hsl(var(--edge-strong))',
} as const;
