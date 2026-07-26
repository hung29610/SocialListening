import React from 'react';

/**
 * GlassTile — SIGNAL glass surface with believable depth (Epic SIGNAL, ADR 0002).
 *
 * Composes the `.signal-glass` surface from src/styles/tokens.css:
 * translucent body + backdrop blur, hairline token edge, inner top
 * light and a deep tile shadow. Without `backdrop-filter` support the
 * body degrades to an opaque surface (`--glass-surface-opaque`) while
 * the edge/light/shadow stack keeps the depth reading.
 */

type GlassTileTag = 'div' | 'article' | 'li' | 'section';
type GlassTilePadding = 'none' | 'sm' | 'md' | 'lg';

interface GlassTileProps extends React.HTMLAttributes<HTMLElement> {
  as?: GlassTileTag;
  padding?: GlassTilePadding;
  /** Adds the tokenized signal glow (soft ink shadow in light mode). */
  glow?: boolean;
  /** Hover lift for clickable tiles (disabled under reduced motion). */
  interactive?: boolean;
}

const paddings: Record<GlassTilePadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const GlassTile: React.FC<GlassTileProps> = ({
  as: Tag = 'div',
  padding = 'md',
  glow = false,
  interactive = false,
  className = '',
  children,
  ...props
}) => {
  const interactiveStyles = interactive
    ? 'transition-[transform,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[color:var(--glass-edge-strong)] motion-reduce:transition-none motion-reduce:hover:translate-y-0'
    : '';

  return (
    <Tag
      className={`signal-glass ${glow ? 'signal-glass--glow' : ''} relative isolate min-w-0 overflow-hidden rounded-tile text-paper ${paddings[padding]} ${interactiveStyles} ${className}`.trim()}
      {...props}
    >
      {children}
    </Tag>
  );
};
