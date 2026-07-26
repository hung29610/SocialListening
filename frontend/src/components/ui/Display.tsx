import React from 'react';

/**
 * Display — oversized editorial display text (Epic SIGNAL, ADR 0002).
 *
 * Renders the clamp-scaled display type (`--text-display-*`,
 * ~3.5rem → 8rem at `2xl`) with tight tracking and compressed leading.
 * Color is inherited so the surrounding band decides ink vs paper;
 * pass `text-paper` / `text-signal` etc. via className when needed.
 */

type DisplaySize = '2xl' | 'xl' | 'lg' | 'md';
type DisplayTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div';

interface DisplayProps extends React.HTMLAttributes<HTMLElement> {
  as?: DisplayTag;
  size?: DisplaySize;
  /** Balance ragged line breaks (maps to the existing `.text-balance` utility). */
  balance?: boolean;
}

const sizes: Record<DisplaySize, string> = {
  '2xl': 'text-display-2xl',
  xl: 'text-display-xl',
  lg: 'text-display-lg',
  md: 'text-display-md',
};

export const Display: React.FC<DisplayProps> = ({
  as: Tag = 'h2',
  size = 'xl',
  balance = false,
  className = '',
  children,
  ...props
}) => {
  return (
    <Tag
      className={`font-bold ${sizes[size]} ${balance ? 'text-balance' : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  );
};
