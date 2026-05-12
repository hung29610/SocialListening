'use client';

import { useState } from 'react';
import { Bell, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PersonalNotifications() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    alertNotifications: true,
    incidentNotifications: true,
    reportNotifications: false
  });

  const handleSave = () => {
    // TODO: Call PUT /api/me/notification-settings
    toast.success('Đã lưu cài đặt thông báo');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Thông báo cá nhân</h2>
        <p className="text-sm text-gray-600 mt-1">Quản lý thông báo bạn nhận được</p>
      </div>

      {/* Notification Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="space-y-4">
          {[
            { key: 'emailNotifications', label: 'Email notifications', description: 'Nhận thông báo qua email' },
            { key: 'inAppNotifications', label: 'In-app notifications', description: 'Hiển thị thông báo trong ứng dụng' },
            { key: 'alertNotifications', label: 'Cảnh báo', description: 'Thông báo khi có cảnh báo mới' },
            { key: 'incidentNotifications', label: 'Sự cố', description: 'Thông báo khi được gán sự cố' },
            { key: 'reportNotifications', label: 'Báo cáo', description: 'Nhận báo cáo định kỳ' }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings]}
                  onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}
