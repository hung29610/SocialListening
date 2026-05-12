'use client';

import { useState } from 'react';
import { Building, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrganizationSettings() {
  const [settings, setSettings] = useState({
    name: 'TTH Group',
    email: 'contact@tthgroup.com',
    phone: '+84 123 456 789',
    address: 'Hà Nội, Việt Nam',
    website: 'https://tthgroup.com',
    taxCode: '0123456789',
    legalRepresentative: 'Nguyễn Văn A',
    businessType: 'Công ty TNHH'
  });

  const handleSave = () => {
    toast.success('Đã lưu thông tin tổ chức');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Thông tin tổ chức</h2>
        <p className="text-sm text-gray-600 mt-1">Cấu hình thông tin công ty và tổ chức</p>
      </div>

      {/* Form */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tên tổ chức *
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Loại hình doanh nghiệp
            </label>
            <select
              value={settings.businessType}
              onChange={(e) => setSettings({ ...settings, businessType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Công ty TNHH">Công ty TNHH</option>
              <option value="Công ty Cổ phần">Công ty Cổ phần</option>
              <option value="Doanh nghiệp tư nhân">Doanh nghiệp tư nhân</option>
              <option value="Hợp tác xã">Hợp tác xã</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email liên hệ
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Số điện thoại
            </label>
            <input
              type="tel"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website
            </label>
            <input
              type="url"
              value={settings.website}
              onChange={(e) => setSettings({ ...settings, website: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mã số thuế
            </label>
            <input
              type="text"
              value={settings.taxCode}
              onChange={(e) => setSettings({ ...settings, taxCode: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Người đại diện pháp luật
            </label>
            <input
              type="text"
              value={settings.legalRepresentative}
              onChange={(e) => setSettings({ ...settings, legalRepresentative: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Địa chỉ
          </label>
          <textarea
            value={settings.address}
            onChange={(e) => setSettings({ ...settings, address: e.target.value })}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
