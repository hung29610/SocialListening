'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X, Plus, FileText, RefreshCw, Play, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { alerts as alertsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import { useProject } from '@/contexts/ProjectContext';

const SEVERITIES = [
  { value: 'low', label: 'Thấp' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'high', label: 'Cao' },
  { value: 'critical', label: 'Nghiêm trọng' },
];

const RULE_TYPES = [
  { value: 'mention_spike', label: 'Mention Spike', description: 'Alert when mentions exceed threshold' },
  { value: 'negative_spike', label: 'Negative Spike', description: 'Alert when negative sentiment exceeds threshold' },
  { value: 'high_risk', label: 'High Risk', description: 'Alert when risk score exceeds threshold' },
];

export default function AlertsPage() {
  const { activeProject } = useProject();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showRuleCheck, setShowRuleCheck] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingRules, setCheckingRules] = useState(false);
  const [form, setForm] = useState({
    title: '',
    severity: 'high',
    message: '',
    mention_id: '',
  });
  const [ruleForm, setRuleForm] = useState({
    name: '',
    rule_type: 'mention_spike',
    threshold: 10,
    window_hours: 24,
    is_active: true,
  });

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (filter !== 'all') params.status = filter;
      const data = await alertsApi.list(params);
      setAlerts(data.items || []);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tải danh sách cảnh báo');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('Vui lòng nhập tiêu đề cảnh báo');
      return;
    }
    setSubmitting(true);
    try {
      await alertsApi.create({
        title: form.title,
        severity: form.severity,
        message: form.message || undefined,
        mention_id: form.mention_id ? parseInt(form.mention_id) : undefined,
      });
      toast.success('Tạo cảnh báo thành công!');
      setShowCreate(false);
      setForm({ title: '', severity: 'high', message: '', mention_id: '' });
      fetchAlerts();
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tạo cảnh báo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alertsApi.acknowledge(id);
      toast.success('Đã xác nhận cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi xác nhận cảnh báo');
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alertsApi.resolve(id);
      toast.success('Đã giải quyết cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi giải quyết cảnh báo');
    }
  };

  const handleCheckRules = async () => {
    try {
      setCheckingRules(true);
      const result = await alertsApi.checkRules({
        project_id: activeProject?.id,
        name: ruleForm.name || 'Manual Check',
        rule_type: ruleForm.rule_type,
        threshold: ruleForm.threshold,
        window_hours: ruleForm.window_hours,
        is_active: ruleForm.is_active,
      });
      toast.success(`Đã kiểm tra rules. Tạo ${result.alerts_created || 0} cảnh báo mới.`);
      fetchAlerts();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi kiểm tra rules');
    } finally {
      setCheckingRules(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    if (severity === 'critical') return 'bg-destructive/10 text-destructive border-destructive/25';
    if (severity === 'high') return 'bg-warning/10 text-warning border-warning/25';
    if (severity === 'medium') return 'bg-warning/[0.06] text-warning border-warning/20';
    return 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25';
  };

  const getSeverityBorder = (severity: string) => {
    if (severity === 'critical') return 'border-l-destructive';
    if (severity === 'high') return 'border-l-warning';
    if (severity === 'medium') return 'border-l-warning/60';
    return 'border-l-sentiment-neutral';
  };

  const getSeverityLabel = (s: string) =>
    SEVERITIES.find((x) => x.value === s)?.label || s;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted font-medium tracking-wide">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">Cảnh Báo</h1>
          <p className="text-sm text-paper-muted mt-1">Quản lý các cảnh báo từ hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRuleCheck(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-void-surface text-paper border border-edge-strong rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <Play className="w-4 h-4" />
            <span>Manual Check</span>
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo cảnh báo</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
              filter === f
                ? 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25'
                : 'bg-void-surface text-paper-muted border-edge hover:text-paper hover:bg-void-raised'
            }`}
          >
            {f === 'all' ? 'Tất cả' : f === 'new' ? 'Mới' : f === 'acknowledged' ? 'Đã xác nhận' : 'Đã giải quyết'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {alerts.length === 0 ? (
          <div className="bg-void-surface border border-edge rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-xl bg-void-raised flex items-center justify-center mx-auto mb-4 border border-edge">
              <AlertTriangle className="w-8 h-8 text-paper-faint" />
            </div>
            <p className="text-paper-muted font-medium tracking-wide">Không có cảnh báo nào</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`bg-void-surface rounded-xl p-5 sm:p-6 border-y border-r border-edge border-l-[3px] hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${getSeverityBorder(alert.severity)}`}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <AlertTriangle className={`w-5 h-5 ${
                      alert.severity === 'critical' ? 'text-destructive' :
                      alert.severity === 'high' ? 'text-warning' :
                      alert.severity === 'medium' ? 'text-warning' : 'text-sentiment-neutral'
                    }`} />
                    <h3 className="font-bold text-paper truncate">{alert.title}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow rounded border ${getSeverityBadge(alert.severity)}`}>
                      {getSeverityLabel(alert.severity)}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow rounded bg-void-raised text-paper-muted border border-edge">
                      {alert.status}
                    </span>
                  </div>
                  {alert.message && <p className="text-sm text-paper-muted mt-3 leading-relaxed">{alert.message}</p>}
                  {alert.mention_id && (
                    <div className="mt-4">
                      <Link
                        href={`/dashboard/mentions/${alert.mention_id}`}
                        className="inline-flex items-center text-xs font-semibold tracking-wide text-signal dark:text-signal-bright bg-signal/10 hover:bg-signal/15 border border-signal/25 px-3 py-1.5 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      >
                        <FileText className="w-3.5 h-3.5 mr-1.5" />
                        Xem Mention Gốc (#{alert.mention_id})
                      </Link>
                    </div>
                  )}
                  <div className="text-xs font-medium text-paper-faint mt-4">
                    {new Date(alert.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-signal dark:text-signal-bright bg-signal/10 hover:bg-signal/15 border border-signal/25 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      title="Xác nhận"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Xác nhận
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-success bg-success/10 hover:bg-success/15 border border-success/25 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      title="Giải quyết"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Giải quyết
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Alert Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowCreate(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-lg transform transition-all duration-150 motion-reduce:transition-none overflow-hidden">
              <div className="p-6 border-b border-edge flex items-center justify-between bg-void-raised">
                <h2 className="text-xl font-bold text-paper">Tạo Cảnh Báo</h2>
                <button onClick={() => setShowCreate(false)} className="text-paper-faint hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Tiêu đề <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Nhập tiêu đề cảnh báo..."
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint"
                  />
                </div>
                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Mức độ <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  >
                    {SEVERITIES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Nội dung
                  </label>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    placeholder="Mô tả chi tiết cảnh báo..."
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>
                {/* Mention ID (optional) */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    ID Mention (tùy chọn)
                  </label>
                  <input
                    type="number"
                    value={form.mention_id}
                    onChange={(e) => setForm({ ...form, mention_id: e.target.value })}
                    placeholder="Nhập ID mention liên quan..."
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !form.title.trim()}
                  className="px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright disabled:bg-void-raised disabled:text-paper-faint disabled:cursor-not-allowed transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {submitting ? 'Đang tạo...' : 'Tạo cảnh báo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Rule Check Modal */}
      {showRuleCheck && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowRuleCheck(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-lg transform transition-all duration-150 motion-reduce:transition-none overflow-hidden">
              <div className="p-6 border-b border-edge flex items-center justify-between bg-void-raised">
                <h2 className="text-xl font-bold text-paper flex items-center gap-2">
                  <Play className="w-5 h-5 text-success" />
                  Manual Rule Check
                </h2>
                <button onClick={() => setShowRuleCheck(false)} className="text-paper-faint hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <p className="text-sm text-paper-muted mb-4">
                  Kiểm tra thủ công các rules để tạo cảnh báo dựa trên ngưỡng đã cấu hình.
                </p>
                {/* Rule Type */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Loại Rule
                  </label>
                  <select
                    value={ruleForm.rule_type}
                    onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  >
                    {RULE_TYPES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-paper-faint mt-1">{RULE_TYPES.find(r => r.value === ruleForm.rule_type)?.description}</p>
                </div>
                {/* Threshold */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Ngưỡng (Threshold)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.threshold}
                    onChange={(e) => setRuleForm({ ...ruleForm, threshold: parseFloat(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  />
                </div>
                {/* Window Hours */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    Khoảng thời gian (giờ)
                  </label>
                  <input
                    type="number"
                    value={ruleForm.window_hours}
                    onChange={(e) => setRuleForm({ ...ruleForm, window_hours: parseInt(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  />
                </div>
                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-paper-muted">
                    Kích hoạt rule
                  </label>
                  <button
                    onClick={() => setRuleForm({ ...ruleForm, is_active: !ruleForm.is_active })}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
                      ruleForm.is_active ? 'bg-signal' : 'bg-edge-strong'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-paper transition-transform duration-150 motion-reduce:transition-none ${
                      ruleForm.is_active ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
                <button
                  onClick={() => setShowRuleCheck(false)}
                  className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCheckRules}
                  disabled={checkingRules}
                  className="px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright disabled:bg-void-raised disabled:text-paper-faint disabled:cursor-not-allowed transition-colors duration-150 motion-reduce:transition-none font-medium flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {checkingRules ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                      Đang kiểm tra...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Chạy Kiểm Tra
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
