'use client';

import { useState } from 'react';
import { Mail, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUser: 'noreply@tthgroup.com',
    smtpPassword: '',
    smtpSecure: true,
    fromName: 'TTH Group Social Listening',
    fromEmail: 'noreply@tthgroup.com',
    replyToEmail: 'support@tthgroup.com'
  });

  const [testEmail, setTestEmail] = useState('');

  const handleSave = () => {
    toast.error('Chưa tích hợp: Backend API chưa được implement');
  };

  const handleTestEmail = () => {
    if (!testEmail) {
      toast.error('Vui lòng nhập email để test');
      return;
    }
    toast.error('Chưa tích hợp: Backend API chưa được implement');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Cấu hình Email</h2>
        <p className="text-sm text-gray-600 mt-1">Thiết lập SMTP và email templates</p>
      </div>

      {/* Pending Integration Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Chưa tích hợp:</strong> Cấu hình Email đang hiển thị dữ liệu mẫu. Backend API chưa được implement.
        </p>
      </div>

      {/* SMTP Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cấu hình SMTP</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Host *
            </label>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="smtp.gmail.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Port *
            </label>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="587"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Username *
            </label>
            <input
              type="text"
              value={settings.smtpUser}
              onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              SMTP Password *
            </label>
            <input
              type="password"
              value={settings.smtpPassword}
              onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="smtp-secure"
            checked={settings.smtpSecure}
            onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="smtp-secure" className="ml-2 text-sm text-gray-700">
            Sử dụng TLS/SSL
          </label>
        </div>
      </div>

      {/* Sender Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Thông tin người gửi</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên người gửi
            </label>
            <input
              type="text"
              value={settings.fromName}
              onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email người gửi
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings({ ...settings, fromEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reply-To Email
            </label>
            <input
              type="email"
              value={settings.replyToEmail}
              onChange={(e) => setSettings({ ...settings, replyToEmail: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Test Email */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Test Email</h3>
        
        <div className="flex space-x-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Nhập email để test"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleTestEmail}
            className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Send className="w-4 h-4 mr-2" />
            Gửi test
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          Lưu cấu hình
        </button>
      </div>
    </div>
  );
}
