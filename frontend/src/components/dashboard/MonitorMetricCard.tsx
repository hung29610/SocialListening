'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MonitorMetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient: string;       // Legacy prop (kept for API compatibility; no longer rendered)
  iconBg: string;         // Legacy prop (kept for API compatibility; no longer rendered)
  textColor?: string;     // Legacy prop (kept for API compatibility; no longer rendered)
  pulse?: boolean;        // Pulse animation for critical metrics
}

/**
 * MonitorMetricCard — KPI card on the SIGNAL tokens (Epic SIGNAL, W-D).
 * Thẻ hiển thị chỉ số quan trọng trên nền quiet surface.
 *
 * The legacy `gradient` / `iconBg` / `textColor` props are still accepted so
 * existing call sites keep compiling, but color now comes exclusively from
 * the design tokens (one-accent rule; multi-hue gradients were dropped).
 */
export default function MonitorMetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  pulse = false,
}: MonitorMetricCardProps) {
  return (
    <div
      className="
        relative overflow-hidden rounded-2xl p-6
        bg-void-surface border border-edge
        transition-shadow duration-200 motion-reduce:transition-none
        hover:shadow-tile
        group
      "
    >
      <div className="relative flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-paper-muted mb-1">{title}</p>
          <p
            className={`text-3xl font-bold text-paper tracking-tight tabular-nums ${
              pulse ? 'animate-pulse motion-reduce:animate-none' : ''
            }`}
          >
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
          </p>
          {subtitle && (
            <p className="text-xs text-paper-faint mt-1">{subtitle}</p>
          )}
        </div>

        <div
          className="
            bg-signal/10 border border-signal/25 rounded-xl p-3
            transition-transform duration-200 motion-reduce:transition-none
            group-hover:scale-105
          "
        >
          <Icon className="w-6 h-6 text-signal dark:text-signal-bright" />
        </div>
      </div>
    </div>
  );
}
