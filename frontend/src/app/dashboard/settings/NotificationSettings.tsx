'use client';

import { useState } from 'react';
import { Bell, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationSettings() {
  const [settings, setSettings] = useState({
    emailNotifications: true,
    newMentionAlert: true,
    highRiskAlert: true,
    dailyReport: true,
    weeklyReport: false,
    incidentCreated: true,
    incidentResolved: true,
    serviceRequestUpdate: true,
    systemMaintenance: true
  });

  const handleSave = () => {
    toast.error('Chưa tích hợp: Backend API chưa được implement');
  };

  const notificationGroups = [
    {
      title: 'Cảnh báo & Mentions',
      items: [
        { key: 'newMentionAlert', label: 'Mention mới', description: 'Thông báo khi có mention mới' },
        { key: 'highRiskAlert', label: 'Cảnh báo rủi ro cao', description: 'Thông báo ngay khi phát hiện rủi ro cao' }
      ]
    },
    {
      title: 'Báo cáo',
      items: [
        { key: 'dailyReport', label: 'Báo cáo hằng ngày', description: 'Gửi báo cáo tổng hợp hằng ngày' },
        { key: 'weeklyReport', label: 'Báo cáo hằng tuần', description: 'Gửi báo cáo tổng hợp hằng tuần' }
      ]
    },
    {
      title: 'Sự cố',
      items: [
        { key: 'incidentCreated', label: 'Sự cố mới', description: 'Thông báo khi có sự cố mới' },
        { key: 'incidentResolved', label: 'Sự cố đã giải quyết', description: 'Thông báo khi sự cố được giải quyết' }
      ]
    },
    {
      title: 'Dịch vụ & Hệ thống',
      items: [
        { key: 'serviceRequestUpdate', label: 'Cập nhật yêu cầu dịch vụ', description: 'Thông báo khi có cập nhật yêu cầu dịch vụ' },
        { key: 'systemMaintenance', label: 'Bảo trì hệ thống', description: 'Thông báo về lịch bảo trì hệ thống' }
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Cấu hình thông báo</h2>
        <p className="text-sm text-gray-600 mt-1">Quản lý các loại thông báo và cảnh báo</p>
      </div>

      {/* Pending Integration Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          <strong>⚠️ Chưa tích hợp:</strong> Cấu hình thông báo hệ thống đang hiển thị dữ liệu mẫu. Backend API chưa được implement.
        </p>
      </div>

      {/* Master Toggle */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Email Notifications</h3>
            <p className="text-sm text-gray-600 mt-1">Bật/tắt tất cả thông báo qua email</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Notification Groups */}
      {notificationGroups.map((group, idx) => (
        <div key={idx} className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">{group.title}</h3>
          
          <div className="space-y-4">
            {group.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={settings[item.key as keyof typeof settings] as boolean}
                    onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                    disabled={!settings.emailNotifications}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      ))}

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
