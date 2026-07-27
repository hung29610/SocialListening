'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, RefreshCcw, Clock, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { reports, systemSettings } from '@/lib/api';

export default function EmailReportsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);

  const [form, setForm] = useState({
    report_email_recipients: '',
    daily_report_enabled: false,
    daily_report_time: '09:00',
    weekly_report_enabled: false,
    weekly_report_day: 0,
    weekly_report_time: '09:00'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await reports.getEmailSchedules();
      setForm({
        report_email_recipients: data.report_email_recipients || '',
        daily_report_enabled: data.daily_report_enabled || false,
        daily_report_time: data.daily_report_time || '09:00',
        weekly_report_enabled: data.weekly_report_enabled || false,
        weekly_report_day: data.weekly_report_day || 0,
        weekly_report_time: data.weekly_report_time || '09:00'
      });
      setEmailConfigured(data.email_provider_configured);
    } catch (err: any) {
      toast.error('Lỗi tải cấu hình báo cáo email: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const emails = form.report_email_recipients.trim();
    if ((form.daily_report_enabled || form.weekly_report_enabled) && !emails) {
      toast.error('Vui lòng nhập ít nhất 1 email nhận báo cáo khi bật lịch gửi');
      return;
    }

    if (emails) {
      const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
      const invalid = emailList.filter(e => !e.includes('@'));
      if (invalid.length > 0) {
        toast.error(`Email không hợp lệ: ${invalid.join(', ')}`);
        return;
      }
    }

    setSaving(true);
    try {
      // First get all current system settings to not overwrite them
      const currentSettings = await systemSettings.getNotifications();

      await systemSettings.updateNotifications({
        ...currentSettings,
        report_email_recipients: emails,
        daily_report_enabled: form.daily_report_enabled,
        daily_report_time: form.daily_report_time,
        weekly_report_enabled: form.weekly_report_enabled,
        weekly_report_day: Number(form.weekly_report_day),
        weekly_report_time: form.weekly_report_time
      });
      toast.success('Đã lưu cấu hình báo cáo email thành công!');
    } catch (err: any) {
      toast.error('Lỗi lưu cấu hình: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async (type: 'daily' | 'weekly') => {
    setSending(true);
    try {
      const res = await reports.sendEmailReportNow(type);
      toast.success(res.message || 'Đã gửi báo cáo thành công!');
    } catch (err: any) {
      toast.error('Lỗi gửi báo cáo: ' + (err?.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><RefreshCcw className="w-8 h-8 animate-spin text-signal dark:text-signal-bright" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-paper tracking-wide flex items-center gap-2">
          <Mail className="w-6 h-6 text-signal dark:text-signal-bright" />
          Email Reports Setup
        </h1>
        <p className="text-sm text-paper-muted mt-1">
          Lên lịch nhận báo cáo tự động qua Email định kỳ. (Yêu cầu tài khoản Admin)
        </p>
      </div>

      {!emailConfigured && (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-4 text-sm text-destructive font-medium flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>Chưa cấu hình Email Provider:</strong> Hệ thống chưa cấu hình SMTP hoặc Resend API. Các báo cáo sẽ không thể gửi được.
            <br />
            Vui lòng vào phần Cài đặt Hệ thống &gt; Cấu hình Email để thiết lập.
          </div>
        </div>
      )}

      <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-8">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-edge">
          <div className="w-16 h-16 bg-signal/10 rounded-full flex items-center justify-center">
            <Send className="w-8 h-8 text-signal dark:text-signal-bright" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-paper">Cấu hình lịch gửi</h2>
            <p className="text-sm text-paper-muted mt-1">Hệ thống sẽ tổng hợp báo cáo và gửi trực tiếp vào hộp thư cấu hình bên dưới.</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-paper-muted">Email nhận báo cáo (cách nhau bởi dấu phẩy)</label>
            <input
              type="text"
              value={form.report_email_recipients}
              onChange={e => setForm({ ...form, report_email_recipients: e.target.value })}
              placeholder="admin@company.com, marketing@company.com"
              className="w-full bg-void-surface border border-edge-strong rounded-lg px-4 py-3 text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Daily Settings */}
            <div className="bg-void-raised border border-edge rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-paper flex items-center gap-2">
                    <Clock className="w-4 h-4 text-signal dark:text-signal-bright" />
                    Báo cáo Hàng ngày
                  </h3>
                  <p className="text-xs text-paper-faint mt-1">Gửi tóm tắt số liệu ngày hôm qua</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.daily_report_enabled} onChange={e => setForm({ ...form, daily_report_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-edge-strong peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-signal/70 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-void after:border-edge after:border after:rounded-full after:h-5 after:w-5 after:transition-all motion-reduce:after:transition-none peer-checked:bg-signal"></div>
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-paper-muted">Giờ gửi</label>
                <input
                  type="time"
                  disabled={!form.daily_report_enabled}
                  value={form.daily_report_time}
                  onChange={e => setForm({ ...form, daily_report_time: e.target.value })}
                  className="w-full bg-void-surface border border-edge-strong rounded-lg px-4 py-2 text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal disabled:opacity-50"
                />
              </div>

              <button
                onClick={() => handleSendNow('daily')}
                disabled={sending || !emailConfigured || !form.report_email_recipients}
                className="w-full py-2 bg-void-surface border border-signal/25 text-signal dark:text-signal-bright rounded-lg text-sm font-medium hover:bg-signal/10 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3 h-3" />
                Gửi Test Ngay (Daily)
              </button>
            </div>

            {/* Weekly Settings */}
            <div className="bg-void-raised border border-edge rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-paper flex items-center gap-2">
                    <Clock className="w-4 h-4 text-signal dark:text-signal-bright" />
                    Báo cáo Hàng tuần
                  </h3>
                  <p className="text-xs text-paper-faint mt-1">Gửi tóm tắt số liệu 7 ngày qua</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.weekly_report_enabled} onChange={e => setForm({ ...form, weekly_report_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-edge-strong peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-signal/70 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-void after:border-edge after:border after:rounded-full after:h-5 after:w-5 after:transition-all motion-reduce:after:transition-none peer-checked:bg-signal"></div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-paper-muted">Ngày gửi</label>
                  <select
                    disabled={!form.weekly_report_enabled}
                    value={form.weekly_report_day}
                    onChange={e => setForm({ ...form, weekly_report_day: Number(e.target.value) })}
                    className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal disabled:opacity-50"
                  >
                    <option value={0}>Thứ 2</option>
                    <option value={1}>Thứ 3</option>
                    <option value={2}>Thứ 4</option>
                    <option value={3}>Thứ 5</option>
                    <option value={4}>Thứ 6</option>
                    <option value={5}>Thứ 7</option>
                    <option value={6}>Chủ nhật</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-paper-muted">Giờ gửi</label>
                  <input
                    type="time"
                    disabled={!form.weekly_report_enabled}
                    value={form.weekly_report_time}
                    onChange={e => setForm({ ...form, weekly_report_time: e.target.value })}
                    className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSendNow('weekly')}
                disabled={sending || !emailConfigured || !form.report_email_recipients}
                className="w-full py-2 bg-void-surface border border-signal/25 text-signal dark:text-signal-bright rounded-lg text-sm font-medium hover:bg-signal/10 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3 h-3" />
                Gửi Test Ngay (Weekly)
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-edge flex justify-end gap-3">
            <button
              onClick={loadSettings}
              className="px-6 py-2.5 bg-void-raised border border-edge text-paper-muted hover:text-paper hover:border-edge-strong rounded-lg font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-lg font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
