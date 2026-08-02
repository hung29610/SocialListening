'use client';

import { AlertTriangle, Camera } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConnectorCapabilities } from '@/hooks/useConnectorCapabilities';

export function InfographicExportNotice() {
  const { t } = useLanguage();
  const { data } = useConnectorCapabilities();
  const previewOnly = data?.exports.infographic.preview_only !== false;

  return (
    <div className="flex items-start gap-3 bg-warning/10 border border-warning/25 rounded-xl px-4 py-3 text-sm">
      <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-warning">
          {previewOnly ? t('connectorContract.infographicPreviewTitle') : t('connectorContract.infographicUnavailableTitle')}
        </p>
        <p className="text-paper-muted mt-0.5">{t('connectorContract.reasons.INFOGRAPHIC_PREVIEW_ONLY')}</p>
      </div>
      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-paper-faint bg-void-raised border border-edge" aria-disabled="true">
        <Camera className="w-3.5 h-3.5" />
        {t('connectorContract.preview')}
      </span>
    </div>
  );
}
