import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPIProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  colorClass: string;
}

export default function DashboardKpiCard({ title, value, icon: Icon, colorClass }: KPIProps) {
  // Map legacy colorClass hints onto the SIGNAL semantic tokens
  // (one-accent rule: blue/purple/indigo hints all collapse into `signal`).
  const isGreen = colorClass.includes('green');
  const isRed = colorClass.includes('red');
  const isYellow = colorClass.includes('yellow');
  const isAccent =
    colorClass.includes('blue') || colorClass.includes('purple') || colorClass.includes('indigo');

  let iconColor = 'text-paper-muted';
  let iconBg = 'bg-void-raised border-edge';

  if (isAccent) { iconColor = 'text-signal dark:text-signal-bright'; iconBg = 'bg-signal/10 border-signal/25'; }
  else if (isGreen) { iconColor = 'text-success'; iconBg = 'bg-success/10 border-success/25'; }
  else if (isRed) { iconColor = 'text-destructive'; iconBg = 'bg-destructive/10 border-destructive/25'; }
  else if (isYellow) { iconColor = 'text-warning'; iconBg = 'bg-warning/10 border-warning/25'; }

  return (
    <div className="relative overflow-hidden bg-void-surface rounded-2xl border border-edge p-6 flex items-center justify-between transition-all duration-200 motion-reduce:transition-none hover:-translate-y-1 motion-reduce:hover:translate-y-0 hover:shadow-tile hover:border-edge-strong group">
      <div>
        <p className="text-eyebrow font-semibold uppercase text-paper-faint mb-1">{title}</p>
        <p className="text-3xl font-black text-paper tracking-tight tabular-nums">{value}</p>
      </div>

      <div className={`p-3.5 rounded-2xl border ${iconBg} flex items-center justify-center transition-transform duration-200 motion-reduce:transition-none group-hover:scale-105`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  );
}
