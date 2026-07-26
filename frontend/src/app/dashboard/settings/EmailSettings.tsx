'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Mail, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function EmailSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    smtpHost: '',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    fromEmail: '',
    fromName: '',
    useTls: true,
    useSsl: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/admin/settings/email');
      const data = response.data;
      setSettings({
        smtpHost: data.smtp_host || '',
        smtpPort: data.smtp_port || 587,
        smtpUsername: data.smtp_username || '',
        smtpPassword: '', // Never load password from backend
        fromEmail: data.from_email || '',
        fromName: data.from_name || '',
        useTls: data.use_tls !== undefined ? data.use_tls : true,
        useSsl: data.use_ssl !== undefined ? data.use_ssl : false
      });
      setIsConfigured(data.is_configured || false);
    } catch (error) {
      console.error('Failed to load email settings:', error);
      toast.error('Không thể tải cấu hình email');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings.smtpHost || !settings.smtpUsername || !settings.fromEmail) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        smtp_host: settings.smtpHost,
        smtp_port: settings.smtpPort,
        smtp_username: settings.smtpUsername,
        from_email: settings.fromEmail,
        from_name: settings.fromName,
        use_tls: settings.useTls,
        use_ssl: settings.useSsl
      };

      // Only include password if it was changed
      if (settings.smtpPassword) {
        payload.smtp_password = settings.smtpPassword;
      }

      const response = await api.put('/api/admin/settings/email', payload);
      const data = response.data;
      
      setIsConfigured(data.is_configured);
      toast.success('Đã lưu cấu hình email');
      // Clear password field after save
      setSettings({ ...settings, smtpPassword: '' });
    } catch (error: any) {
      console.error('Failed to save email settings:', error);
      toast.error('Không thể lưu cấu hình email');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!isConfigured) {
      toast.error('Vui lòng lưu cấu hình trước khi test');
      return;
    }

    setTesting(true);
    try {
      const response = await api.post('/api/admin/settings/email/test');
      const data = response.data;
      
      toast.success(data.message || 'Email test thành công');
    } catch (error: any) {
      console.error('Failed to test email:', error);
      toast.error('Không thể test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-signal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-paper tracking-wide">Cấu hình Email</h2>
        <p className="text-sm text-paper-muted mt-1">Cấu hình SMTP để gửi email thông báo</p>
      </div>

      {/* Status Badge */}
      {isConfigured && (
        <div className="bg-success/10 border border-success/25 rounded-xl p-4">
          <p className="text-sm font-medium text-success flex items-center">
            <span className="mr-2">✅</span> Email đã được cấu hình. Hệ thống có thể gửi email thông báo.
          </p>
        </div>
      )}

      {/* SMTP Settings */}
      <div className="bg-void-surface border border-edge rounded-xl shadow-sm p-6 space-y-6">
        <h3 className="text-lg font-bold text-paper tracking-wide flex items-center">
          <Mail className="w-5 h-5 mr-2 text-signal dark:text-signal-bright" />
          Cấu hình SMTP
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              SMTP Port *
            </label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder="587"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              SMTP Username *
            </label>
            <input
              type="text"
              value={settings.smtpUsername}
              onChange={(e) => setSettings({ ...settings, smtpUsername: e.target.value })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder="your-email@gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              SMTP Password {isConfigured && <span className="text-paper-faint font-normal">(để trống nếu không đổi)</span>}
            </label>
            <input
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder={isConfigured ? '••••••••' : 'Mật khẩu SMTP'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              From Email *
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder="noreply@company.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-paper-muted mb-2">
              From Name
            </label>
            <input
              type="text"
              value={settings.fromName}
              onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              placeholder="Nope360"
            />
          </div>
        </div>

        {/* TLS/SSL Options */}
        <div className="flex items-center space-x-8 pt-6 border-t border-edge">
          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.useTls}
              onChange={(e) => setSettings({ ...settings, useTls: e.target.checked, useSsl: false })}
              className="w-4 h-4 rounded accent-signal bg-void-surface border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 transition-colors duration-150 motion-reduce:transition-none"
            />
            <span className="ml-3 text-sm font-medium text-paper-muted group-hover:text-paper transition-colors duration-150 motion-reduce:transition-none">Use TLS (Port 587)</span>
          </label>

          <label className="flex items-center cursor-pointer group">
            <input
              type="checkbox"
              checked={settings.useSsl}
              onChange={(e) => setSettings({ ...settings, useSsl: e.target.checked, useTls: false })}
              className="w-4 h-4 rounded accent-signal bg-void-surface border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 transition-colors duration-150 motion-reduce:transition-none"
            />
            <span className="ml-3 text-sm font-medium text-paper-muted group-hover:text-paper transition-colors duration-150 motion-reduce:transition-none">Use SSL (Port 465)</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4 pt-6 border-t border-edge">
          <button
            onClick={handleTest}
            disabled={testing || !isConfigured}
            className="flex items-center px-6 py-2.5 border border-signal/25 bg-signal/10 text-signal dark:text-signal-bright rounded-xl hover:bg-signal/20 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <Send className="w-4 h-4 mr-2" />
            {testing ? 'Đang test...' : 'Test Email'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none disabled:bg-void-raised disabled:text-paper-faint disabled:cursor-not-allowed font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settings.saveConfig')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-signal/10 border border-signal/25 rounded-xl p-4">
        <p className="text-sm text-paper-muted">
          <strong className="text-signal dark:text-signal-bright">Lưu ý:</strong> Mật khẩu SMTP được mã hóa trước khi lưu vào database.
          Nếu sử dụng Gmail, bạn cần tạo App Password thay vì dùng mật khẩu thường.
        </p>
      </div>
    </div>
  );
}
