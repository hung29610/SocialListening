import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert, XCircle, Info } from 'lucide-react';
import { SeverityBadge } from './Badges';
import DashboardQuickActionButton from './DashboardQuickActionButton';
import { alerts } from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface AlertCardProps {
  alert: any;
  onActionComplete: () => void;
  userRole?: string;
}

export default function AlertCard({ alert, onActionComplete, userRole }: AlertCardProps) {
  const { t } = useLanguage();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const canAcknowledge = ['analyst', 'manager', 'admin', 'super_admin'].includes(userRole || '');
  const canEscalate = ['manager', 'admin', 'super_admin'].includes(userRole || '');

  const handleAction = async (action: string, apiCall: () => Promise<any>, successMsg: string) => {
    setLoadingAction(action);
    try {
      await apiCall();
      toast.success(successMsg);
      onActionComplete();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('reputationPage.alertCard.genericError'));
    } finally {
      setLoadingAction(null);
    }
  };

  const isResolved = alert.status === 'resolved' || alert.status === 'ignored';

  return (
    <div className={`rounded-xl border p-4 transition-colors duration-150 motion-reduce:transition-none ${
      alert.severity === 'critical' ? 'bg-destructive/5 border-destructive/20' :
      alert.severity === 'high' ? 'bg-warning/5 border-warning/20' :
      'bg-void-surface border-edge'
    } ${isResolved ? 'opacity-75' : ''}`}>

      <div className="flex items-start space-x-3">
        <div className={`mt-0.5 p-2 rounded-xl border ${
          alert.severity === 'critical' ? 'bg-destructive/10 text-destructive border-destructive/25' :
          alert.severity === 'high' ? 'bg-warning/10 text-warning border-warning/25' :
          alert.severity === 'medium' ? 'bg-warning/[0.06] text-warning border-warning/20' :
          'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25'
        }`}>
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-paper tracking-wide truncate pr-2">
              {alert.title}
            </h3>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p className="mt-1.5 text-sm text-paper-muted line-clamp-2">
            {alert.message || alert.reason || t('reputationPage.alertCard.noDescription')}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-paper-faint">
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-2 ${
                alert.status === 'new' ? 'bg-signal' :
                alert.status === 'acknowledged' ? 'bg-warning' :
                alert.status === 'resolved' ? 'bg-success' :
                'bg-paper-faint'
              }`}></span>
              {alert.status.toUpperCase()}
            </span>
            <span className="text-paper-faint">•</span>
            <span className="tracking-wide tabular-nums">{new Date(alert.created_at).toLocaleString('vi-VN')}</span>
            {alert.mention_id && (
              <>
                <span className="text-paper-faint">•</span>
                <a href={`/dashboard/mentions/${alert.mention_id}`} target="_blank" rel="noopener noreferrer" className="text-signal dark:text-signal-bright hover:underline flex items-center transition-colors duration-150 motion-reduce:transition-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  {t('reputationPage.alertCard.viewMention')} <Info className="w-3 h-3 ml-1" />
                </a>
              </>
            )}
          </div>

          {!isResolved && (
            <div className="mt-4 pt-4 border-t border-edge flex flex-wrap gap-3">
              {alert.status === 'new' && canAcknowledge && (
                <DashboardQuickActionButton
                  label={t('reputationPage.alertCard.acknowledge')}
                  icon={CheckCircle}
                  onClick={() => handleAction('ack', () => alerts.acknowledge(alert.id), t('reputationPage.alertCard.acknowledged'))}
                  isLoading={loadingAction === 'ack'}
                  variant="primary"
                />
              )}
              
              {canEscalate && (
                <DashboardQuickActionButton
                  label={t('reputationPage.incidents.create')}
                  icon={ShieldAlert}
                  onClick={() => handleAction('incident', () => alerts.createIncident(alert.id), t('reputationPage.alertCard.incidentCreated'))}
                  isLoading={loadingAction === 'incident'}
                  variant="danger"
                />
              )}
              
              {canEscalate && (
                <DashboardQuickActionButton
                  label={t('reputationPage.alertCard.ignore')}
                  icon={XCircle}
                  onClick={() => handleAction('ignore', () => alerts.ignore(alert.id), t('reputationPage.alertCard.ignored'))}
                  isLoading={loadingAction === 'ignore'}
                  variant="ghost"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
