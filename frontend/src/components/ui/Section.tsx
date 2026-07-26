import React from 'react';
import { Display } from './Display';

/**
 * Section — SIGNAL layout band (Epic SIGNAL, ADR 0002).
 *
 * A full-width band with an inner max-width container, vertical rhythm
 * on the 8px grid (`--space-band` section clamp), and optional
 * eyebrow / heading / intro slots in the SIGNAL editorial style.
 * Colors are token-driven; the band itself stays transparent so pages
 * compose it over `bg-void` / `bg-void-surface` canvases.
 */

type SectionSpacing = 'none' | 'compact' | 'default' | 'spacious';
type SectionWidth = 'narrow' | 'default' | 'wide' | 'full';
type SectionTag = 'section' | 'div' | 'header' | 'footer' | 'article';
type HeadingTag = 'h1' | 'h2' | 'h3';

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  as?: SectionTag;
  /** Small-caps kicker rendered above the heading. */
  eyebrow?: React.ReactNode;
  /** Editorial display heading (rendered via `Display`). */
  heading?: React.ReactNode;
  /** Supporting intro copy under the heading. */
  intro?: React.ReactNode;
  headingLevel?: HeadingTag;
  headingSize?: '2xl' | 'xl' | 'lg' | 'md';
  spacing?: SectionSpacing;
  width?: SectionWidth;
  align?: 'start' | 'center';
}

const spacings: Record<SectionSpacing, string> = {
  none: '',
  compact: 'py-12 md:py-16',
  default: 'py-band',
  spacious: 'py-band lg:py-40',
};

const widths: Record<SectionWidth, string> = {
  narrow: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
  full: 'max-w-none',
};

export const Section: React.FC<SectionProps> = ({
  as: Tag = 'section',
  eyebrow,
  heading,
  intro,
  headingLevel = 'h2',
  headingSize = 'xl',
  spacing = 'default',
  width = 'default',
  align = 'start',
  className = '',
  children,
  ...props
}) => {
  const hasHeader = Boolean(eyebrow || heading || intro);
  const centered = align === 'center';

  return (
    <Tag className={`relative w-full ${spacings[spacing]} ${className}`.trim()} {...props}>
      <div className={`mx-auto w-full px-6 md:px-8 ${widths[width]}`}>
        {hasHeader && (
          <div className={`mb-10 md:mb-16 ${centered ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}`}>
            {eyebrow && (
              <p className="mb-4 text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
                {eyebrow}
              </p>
            )}
            {heading && (
              <Display as={headingLevel} size={headingSize} balance>
                {heading}
              </Display>
            )}
            {intro && (
              <p className="mt-6 text-lg leading-relaxed text-paper-muted">
                {intro}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </Tag>
  );
};
