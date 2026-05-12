'use client';

import { useState, useEffect } from 'react';
import { Palette, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AppearanceSettings() {
  const [settings, setSettings] = useState({
    theme: 'system',
    compactMode: false,
    sidebarCollapsed: false,
    language: 'vi'
  });

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('appearance_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('appearance_settings', JSON.stringify(settings));
    toast.success('Đã lưu cài đặt giao diện');
    
    // TODO: Optionally call PUT /api/me/preferences to sync with backend
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Giao diện</h2>
        <p className="text-sm text-gray-600 mt-1">Tùy chỉnh giao diện ứng dụng</p>
      </div>

      {/* Appearance Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Chủ đề
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { value: 'light', label: 'Sáng', icon: '☀️' },
              { value: 'dark', label: 'Tối', icon: '🌙' },
              { value: 'system', label: 'Hệ thống', icon: '💻' }
            ].map((theme) => (
              <button
                key={theme.value}
                onClick={() => setSettings({ ...settings, theme: theme.value })}
                className={`p-4 border-2 rounded-lg transition-colors ${
                  settings.theme === theme.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{theme.icon}</div>
                <div className="text-sm font-medium text-gray-900">{theme.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ngôn ngữ
          </label>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Chế độ thu gọn</p>
            <p className="text-xs text-gray-500 mt-1">Giảm khoảng cách giữa các phần tử</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.compactMode}
              onChange={(e) => setSettings({ ...settings, compactMode: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Sidebar Collapsed */}
        <div className="flex items-center justify-between py-3 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Thu gọn sidebar</p>
            <p className="text-xs text-gray-500 mt-1">Sidebar sẽ thu gọn mặc định</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sidebarCollapsed}
              onChange={(e) => setSettings({ ...settings, sidebarCollapsed: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
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
