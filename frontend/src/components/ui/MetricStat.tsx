import React from 'react';

/**
 * MetricStat — giant metric numeral + small-caps label (Epic SIGNAL, ADR 0002).
 *
 * Editorial stat for metric bands: clamp-scaled numeral
 * (`--text-metric` / `--text-metric-lg`) with tabular figures so
 * columns of stats align, an eyebrow-styled label, and an optional
 * hint line. Truthful data only — unknown values must ship as
 * `COPY_TBD`, never invented (Design Constitution).
 */

interface MetricStatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The numeral itself, e.g. "12.4k", "98%", "COPY_TBD". */
  value: React.ReactNode;
  /** Small-caps label under the numeral. */
  label: React.ReactNode;
  /** Optional supporting line (source, timeframe, delta). */
  hint?: React.ReactNode;
  size?: 'md' | 'lg';
  align?: 'start' | 'center';
}

export const MetricStat: React.FC<MetricStatProps> = ({
  value,
  label,
  hint,
  size = 'md',
  align = 'start',
  className = '',
  ...props
}) => {
  const centered = align === 'center';

  return (
    <div
      className={`flex min-w-0 flex-col gap-3 ${centered ? 'items-center text-center' : 'items-start'} ${className}`.trim()}
      {...props}
    >
      <p
        className={`${size === 'lg' ? 'text-metric-lg' : 'text-metric'} font-extrabold tabular-nums text-paper`}
      >
        {value}
      </p>
      <p className="text-eyebrow font-semibold uppercase text-paper-muted">
        {label}
      </p>
      {hint && <p className="text-sm text-paper-faint">{hint}</p>}
    </div>
  );
};
