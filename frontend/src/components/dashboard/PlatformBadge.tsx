'use client';

import React from 'react';

interface PlatformBadgeProps {
  platform: string;
  size?: 'sm' | 'md';
}

/**
 * PlatformBadge — quiet neutral chip for social media platforms
 * (Epic SIGNAL, W-D). Platform brand hues were dropped: identity is
 * conveyed by icon + label, not color. All platforms share the same
 * neutral surface chip on the SIGNAL tokens.
 */

const PLATFORM_ICON: Record<string, string> = {
  Facebook: '📘',
  TikTok: '🎵',
  YouTube: '🎬',
  News: '📰',
};

export default function PlatformBadge({ platform, size = 'sm' }: PlatformBadgeProps) {
  const icon = PLATFORM_ICON[platform] || PLATFORM_ICON.News;

  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-xs'
    : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`
        inline-flex items-center gap-1
        ${sizeClasses}
        bg-void-raised border border-edge text-paper-muted
        rounded-full font-medium
        whitespace-nowrap
      `}
    >
      <span>{icon}</span>
      {platform}
    </span>
  );
}
