import React from 'react';
import { Loader2 } from 'lucide-react';

interface QuickActionButtonProps {
  label: string;
  icon?: React.ElementType;
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  tooltip?: string;
}

export default function DashboardQuickActionButton({
  label,
  icon: Icon,
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'secondary',
  tooltip
}: QuickActionButtonProps) {
  
  const baseClasses = "inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70";

  const variants = {
    primary: "bg-signal text-white hover:bg-signal-deep dark:hover:bg-signal-bright focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50",
    secondary: "bg-void-surface text-paper-muted border border-edge-strong hover:bg-void-raised hover:text-paper disabled:opacity-50",
    danger: "bg-void-surface text-destructive border border-destructive/30 hover:bg-destructive/10 disabled:opacity-50",
    ghost: "bg-transparent text-paper-muted hover:bg-paper/[0.04] hover:text-paper disabled:opacity-50"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variants[variant]}`}
      title={tooltip}
    >
      {isLoading ? (
        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
      ) : Icon ? (
        <Icon className="w-3.5 h-3.5 mr-1.5" />
      ) : null}
      {label}
    </button>
  );
}
