import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Activity, Clock, FileText, Link2, AlertTriangle, MessageSquare } from 'lucide-react';
import { incidents as incidentsApi, mentions as mentionsApi, getErrorMessage } from '@/lib/api';
import { getSafeVisitUrl } from '@/lib/visit-url';
import { RiskBadge, CrisisLevelBadge } from '@/components/dashboard/Badges';
import { SentimentBadge } from '@/components/ui/SentimentBadge';
import toast from 'react-hot-toast';

interface CrisisWarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: any;
}

const eyebrow = 'text-[10px] font-bold text-paper-faint uppercase tracking-eyebrow';
const panel = 'bg-void-surface border border-edge rounded-xl p-5';

export default function CrisisWarRoomModal({ isOpen, onClose, incident }: CrisisWarRoomModalProps) {
  const [loading, setLoading] = useState(false);
  const [mention, setMention] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && incident) {
      fetchData();
    } else {
      setMention(null);
      setLogs([]);
    }
  }, [isOpen, incident]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch logs
      const logsData = await incidentsApi.getLogs(incident.id);
      setLogs(logsData || []);

      // Fetch origin mention if exists
      if (incident.mention_id) {
        const mentionData = await mentionsApi.get(incident.mention_id);
        setMention(mentionData);
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tải dữ liệu War Room');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper/25 dark:bg-void/75 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-void rounded-2xl shadow-tile border border-edge flex flex-col h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-edge bg-void-surface rounded-t-2xl shrink-0">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/25">
              <ShieldAlert className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-paper tracking-wide">Crisis War Room</h2>
                <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded bg-void-raised text-paper-muted border border-edge tabular-nums">
                  INCIDENT #{incident.id}
                </span>
              </div>
              <p className="text-sm text-paper-muted mt-1 font-medium">{incident.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-paper-muted hover:text-paper hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-paper-muted font-medium">Đang thiết lập phòng chỉ huy...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Main Column */}
              <div className="lg:col-span-2 space-y-6">

                {/* Status & Deadline */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={panel}>
                    <h4 className={`${eyebrow} mb-2`}>Trạng Thái Hiện Tại</h4>
                    <span className="text-lg font-bold text-paper uppercase">{incident.status.replace('_', ' ')}</span>
                  </div>
                  <div className={panel}>
                    <h4 className={`${eyebrow} mb-2`}>Thời Hạn Xử Lý</h4>
                    <span className={`text-lg font-bold tabular-nums ${incident.is_overdue ? 'text-destructive' : 'text-signal dark:text-signal-bright'}`}>
                      {incident.deadline ? new Date(incident.deadline).toLocaleString('vi-VN') : 'Không có'}
                    </span>
                  </div>
                </div>

                {/* Description */}
                {incident.description && (
                  <div className={panel}>
                    <h4 className={`${eyebrow} mb-3 flex items-center`}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Mô Tả Sự Cố
                    </h4>
                    <p className="text-sm text-paper-muted leading-relaxed bg-void-raised p-4 rounded-lg border border-edge">
                      {incident.description}
                    </p>
                  </div>
                )}

                {/* Timeline */}
                <div className={panel}>
                  <h4 className={`${eyebrow} mb-4 flex items-center`}>
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    Timeline Sự Kiện
                  </h4>
                  <div className="space-y-4">
                    <div className="relative border-l-2 border-signal/30 ml-3 pl-5 py-2">
                      <div className="absolute w-3 h-3 bg-signal rounded-full -left-[7px] top-3 ring-4 ring-void-surface"></div>
                      <span className="text-[10px] font-bold text-signal dark:text-signal-bright tabular-nums">{new Date(incident.created_at).toLocaleString('vi-VN')}</span>
                      <p className="text-sm font-medium text-paper mt-1">Phát hiện và ghi nhận sự cố</p>
                    </div>
                    {logs.map((log) => (
                      <div key={log.id} className="relative border-l-2 border-edge-strong ml-3 pl-5 py-2">
                        <div className="absolute w-3 h-3 bg-paper-faint rounded-full -left-[7px] top-3 ring-4 ring-void-surface"></div>
                        <span className="text-[10px] font-bold text-paper-faint tabular-nums">{new Date(log.created_at).toLocaleString('vi-VN')}</span>
                        <p className="text-sm font-medium text-paper mt-1 uppercase">{log.action}</p>
                        {log.notes && <p className="text-xs text-paper-muted mt-1">{log.notes}</p>}
                        {(log.old_status || log.new_status) && (
                          <div className="text-[10px] font-medium text-paper-faint mt-2 bg-void-raised inline-block px-2 py-1 rounded border border-edge">
                            {log.old_status} <span className="mx-1">→</span> {log.new_status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Sidebar Column */}
              <div className="space-y-6">

                {/* AI Analysis of Origin Mention */}
                {mention && mention.ai_analysis ? (
                  <div className={panel}>
                    <h4 className={`${eyebrow} mb-4 flex items-center`}>
                      <Activity className="w-3.5 h-3.5 mr-1.5" />
                      Phân tích Nguồn Gốc (AI)
                    </h4>

                    <div className="flex flex-col items-center justify-center p-4 bg-void-raised rounded-xl border border-edge mb-4">
                      <span className="text-metric font-extrabold tabular-nums text-destructive">{mention.ai_analysis.risk_score}</span>
                      <span className={`${eyebrow} mt-1`}>Risk Score</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-edge">
                        <span className="text-xs text-paper-muted font-medium">Crisis Level</span>
                        <CrisisLevelBadge level={mention.ai_analysis.crisis_level} />
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-edge">
                        <span className="text-xs text-paper-muted font-medium">Sentiment</span>
                        <SentimentBadge sentiment={mention.ai_analysis.sentiment} size="sm" />
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-edge">
                        <span className="text-xs text-paper-muted font-medium">Khẩn cấp</span>
                        <span className="text-xs font-bold text-destructive uppercase">{mention.ai_analysis.urgency}</span>
                      </div>
                      {mention.ai_analysis.escalation_needed && (
                        <div className="mt-4 p-2 bg-destructive/10 border border-destructive/25 rounded text-center">
                          <span className="text-xs font-bold text-destructive flex items-center justify-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Yêu cầu leo thang
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`${panel} text-center`}>
                    <p className="text-sm text-paper-faint font-medium tracking-wide">Không có dữ liệu AI cho sự kiện gốc</p>
                  </div>
                )}

                {/* Origin Mention Details */}
                {mention && (
                  <div className={panel}>
                    <h4 className={`${eyebrow} mb-4 flex items-center`}>
                      <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                      Nội Dung Gốc
                    </h4>
                    <p className="text-sm text-paper-muted bg-void-raised p-3 rounded-lg border border-edge line-clamp-4 leading-relaxed mb-4">
                      {mention.content}
                    </p>
                    {getSafeVisitUrl(mention.canonical_url || mention.url) && (<a
                      href={getSafeVisitUrl(mention.canonical_url || mention.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center px-4 py-2.5 bg-void-raised hover:bg-paper/[0.06] text-paper text-xs font-semibold rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1.5" /> Xem Tại Nguồn
                    </a>)}
                  </div>
                )}

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
