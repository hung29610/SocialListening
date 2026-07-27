import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AppCard } from '@/components/ui/AppCard';
import AlertCard from './AlertCard';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RiskAlertsPanel({ 
  alerts, 
  isLoading, 
  userRole, 
  onActionComplete 
}: { 
  alerts: any[]; 
  isLoading: boolean;
  userRole: string;
  onActionComplete: () => void;
}) {
  const { t } = useLanguage();
  return (
    <AppCard
      variant="glass"
      className="flex flex-col h-[600px]"
      header={
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-paper tracking-wide">{t('dashboard.panels.riskAlerts')}</h2>
          <span className="text-[10px] font-bold tracking-eyebrow uppercase bg-destructive/10 border border-destructive/25 text-destructive px-3 py-1.5 rounded-lg animate-pulse motion-reduce:animate-none">Top 10</span>
        </div>
      }
    >
      <div className="h-full overflow-y-auto space-y-3 custom-scrollbar pr-2 -mr-2">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse motion-reduce:animate-none flex space-x-4 p-4 border border-edge rounded-lg bg-void-raised">
                <div className="rounded-full bg-paper/10 h-10 w-10"></div>
                <div className="flex-1 space-y-3 py-1">
                  <div className="h-2 bg-paper/10 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-2 bg-paper/10 rounded"></div>
                    <div className="h-2 bg-paper/10 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-paper-muted font-medium tracking-wide pb-10">
            <div className="w-16 h-16 mb-4 rounded-2xl bg-void-raised flex items-center justify-center border border-edge">
              <AlertTriangle className="w-8 h-8 text-paper-faint" />
            </div>
            <p className="text-sm text-paper-muted">{t('dashboard.panels.noActiveAlerts')}</p>
          </div>
        ) : (
          alerts.map((alert: any) => (
            <AlertCard 
              key={alert.id} 
              alert={alert} 
              userRole={userRole}
              onActionComplete={onActionComplete} 
            />
          ))
        )}
      </div>
    </AppCard>
  );
}
