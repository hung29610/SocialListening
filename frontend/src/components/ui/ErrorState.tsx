'use client';

import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { AppButton } from './AppButton';
import { useLanguage } from '@/contexts/LanguageContext';

interface ErrorStateProps {
  /** Optional override; defaults to the localized generic error title. */
  title?: string;
  message: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  onRetry,
  isRetrying = false,
}) => {
  const { t } = useLanguage();
  const resolvedTitle = title ?? t('common.errorTitle');

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px] rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-500/20 shadow-sm">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-rose-100/50 dark:bg-rose-500/10 flex items-center justify-center border border-rose-200/50 dark:border-rose-500/20 text-rose-500 shadow-sm">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h3 className="text-base font-bold text-rose-800 dark:text-rose-400 mb-1.5 tracking-wide">
        {resolvedTitle}
      </h3>
      <p className="text-xs text-rose-600/80 dark:text-rose-300/80 max-w-sm mb-6 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <AppButton
          variant="destructive"
          size="sm"
          onClick={onRetry}
          isLoading={isRetrying}
          leftIcon={<RefreshCcw className="w-3.5 h-3.5" />}
        >
          {t('common.retry')}
        </AppButton>
      )}
    </div>
  );
};
