'use client';

import React from 'react';
import { AlertTriangle, Shield, Zap } from 'lucide-react';

interface ActionItem {
  step: number;
  title: string;
  description: string;
  priority: string; // critical, high, medium, low
}

interface AiCrisisPanelProps {
  keyword: string;
  crisisSummary: string;
  riskLevel: string;          // Low, Medium, High
  actionItems: ActionItem[];
  negativeMentionsCount: number;
  totalMentions: number;
  isLoading: boolean;
}

/**
 * AiCrisisPanel — AI Insight panel on the SIGNAL tokens (Epic SIGNAL, W-D).
 * Hiển thị cảnh báo khủng hoảng AI và các bước hành động.
 *
 * Chỉ hiển thị khi risk_level là "Medium" hoặc "High".
 * Risk ladder uses the semantic status tokens (destructive/warning/success);
 * multi-hue gradients were replaced with flat quiet tints.
 */
export default function AiCrisisPanel({
  keyword,
  crisisSummary,
  riskLevel,
  actionItems,
  negativeMentionsCount,
  totalMentions,
  isLoading,
}: AiCrisisPanelProps) {
  // Chỉ hiển thị khi risk >= Medium
  if (!isLoading && riskLevel === 'Low') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-edge bg-void-surface p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-void-raised rounded-xl animate-pulse motion-reduce:animate-none" />
          <div className="h-5 w-48 bg-void-raised rounded animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-void-raised rounded animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-3/4 bg-void-raised rounded animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const isHigh = riskLevel === 'High';

  // Risk level badge config (semantic status tokens; flat tints, no gradients)
  const riskConfig = {
    High: {
      tint: 'bg-destructive/5',
      borderColor: 'border-destructive/30',
      badgeBg: 'bg-destructive text-destructive-foreground',
      badgeText: 'Cao',
      icon: AlertTriangle,
      iconColor: 'text-destructive',
      iconBg: 'bg-destructive/10',
    },
    Medium: {
      tint: 'bg-warning/5',
      borderColor: 'border-warning/30',
      badgeBg: 'bg-warning text-white',
      badgeText: 'Trung bình',
      icon: Zap,
      iconColor: 'text-warning',
      iconBg: 'bg-warning/10',
    },
    Low: {
      tint: 'bg-success/5',
      borderColor: 'border-success/30',
      badgeBg: 'bg-success text-white',
      badgeText: 'Thấp',
      icon: Shield,
      iconColor: 'text-success',
      iconBg: 'bg-success/10',
    },
  };

  const config = riskConfig[riskLevel as keyof typeof riskConfig] || riskConfig.Low;
  const RiskIcon = config.icon;

  // Priority badge colors (severity ladder on the status tokens)
  const priorityColors: Record<string, string> = {
    critical: 'bg-destructive/10 text-destructive border border-destructive/25',
    high: 'bg-warning/10 text-warning border border-warning/25',
    medium: 'bg-warning/[0.06] text-warning border border-warning/20',
    low: 'bg-sentiment-neutral/10 text-sentiment-neutral border border-sentiment-neutral/25',
  };

  return (
    <div
      className={`
        relative rounded-2xl overflow-hidden
        border ${config.borderColor}
        ${config.tint}
        backdrop-blur-sm
        transition-colors duration-200 motion-reduce:transition-none
      `}
      style={{
        animation: 'fadeSlideUp 0.5s ease-out',
      }}
    >
      {/* Animated border emphasis for High risk */}
      {isHigh && (
        <div className="absolute inset-0 rounded-2xl border-2 border-destructive/40 animate-pulse motion-reduce:animate-none pointer-events-none" />
      )}

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div
              className={`
                p-2.5 rounded-xl
                ${config.iconBg} ${isHigh ? 'animate-pulse motion-reduce:animate-none' : ''}
              `}
            >
              <RiskIcon className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-paper">
                🤖 Phân Tích AI — Cảnh Báo Khủng Hoảng
              </h3>
              <p className="text-xs text-paper-muted">
                Từ khóa: <span className="font-medium">{keyword}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`
                px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                ${config.badgeBg}
              `}
            >
              {config.badgeText}
            </span>
            <span className="text-xs text-paper-muted tabular-nums">
              {negativeMentionsCount}/{totalMentions} tiêu cực
            </span>
          </div>
        </div>

        {/* Crisis Summary */}
        <div className="bg-void-surface/60 backdrop-blur-sm rounded-xl p-4 mb-5 border border-edge">
          <p className="text-sm text-paper leading-relaxed">
            {crisisSummary}
          </p>
        </div>

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-paper-muted mb-3 flex items-center gap-2">
              <span>📋</span> Hành Động Đề Xuất
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {actionItems.map((item) => (
                <div
                  key={item.step}
                  className="
                    bg-void-surface/80 backdrop-blur-sm
                    rounded-xl p-4
                    border border-edge
                    hover:shadow-md transition-shadow duration-200 motion-reduce:transition-none
                    group
                  "
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-signal text-white text-xs font-bold tabular-nums">
                      {item.step}
                    </span>
                    <span
                      className={`
                        px-2 py-0.5 rounded text-[10px] font-semibold uppercase
                        ${priorityColors[item.priority] || priorityColors.low}
                      `}
                    >
                      {item.priority === 'critical'
                        ? 'Khẩn cấp'
                        : item.priority === 'high'
                        ? 'Cao'
                        : item.priority === 'medium'
                        ? 'Vừa'
                        : 'Thấp'}
                    </span>
                  </div>
                  <h5 className="text-sm font-semibold text-paper mb-1">
                    {item.title}
                  </h5>
                  <p className="text-xs text-paper-muted leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
