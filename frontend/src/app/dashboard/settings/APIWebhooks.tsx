'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Power, PowerOff, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface APIKeyCreateResponse extends APIKey {
  full_key: string;
}

export default function APIWebhooks() {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: [] as string[],
    expires_at: ''
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [availablePermissions] = useState([
    'mentions.read', 'mentions.write',
    'keywords.read', 'keywords.write',
    'sources.read', 'sources.write',
    'reports.read', 'alerts.read'
  ]);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/api-keys/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load API keys');
      
      const data = await response.json();
      setApiKeys(data);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error('Không thể tải danh sách API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('access_token');
      const payload = {
        name: newKeyData.name,
        permissions: newKeyData.permissions,
        expires_at: newKeyData.expires_at || null
      };

      const response = await fetch('https://social-listening-backend.onrender.com/api/api-keys/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create API key');
      }

      const data: APIKeyCreateResponse = await response.json();
      setCreatedKey(data.full_key);
      toast.success('Tạo API key thành công');
      loadAPIKeys();
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(error.message || 'Không thể tạo API key');
    }
  };

  const handleRevoke = async (keyId: number) => {
    if (!confirm('Bạn có chắc muốn thu hồi API key này? Hành động này không thể hoàn tác.')) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://social-listening-backend.onrender.com/api/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to revoke API key');

      toast.success('Thu hồi API key thành công');
      loadAPIKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error('Không thể thu hồi API key');
    }
  };

  const handleToggleActive = async (keyId: number, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      const action = currentStatus ? 'deactivate' : 'activate';
      const response = await fetch(`https://social-listening-backend.onrender.com/api/api-keys/${keyId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error(`Failed to ${action} API key`);

      toast.success(currentStatus ? 'Vô hiệu hóa thành công' : 'Kích hoạt thành công');
      loadAPIKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error('Không thể thay đổi trạng thái');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Đã sao chép vào clipboard');
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Không giới hạn';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">API Keys & Webhooks</h2>
          <p className="text-sm text-gray-600 mt-1">Quản lý API keys để truy cập programmatic</p>
        </div>
        <button 
          onClick={() => {
            setShowModal(true);
            setCreatedKey(null);
            setNewKeyData({ name: '', permissions: [], expires_at: '' });
          }}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tạo API Key
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-3">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Key className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600">Chưa có API key nào</p>
            <p className="text-sm text-gray-500 mt-1">Tạo API key để truy cập hệ thống qua API</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className={`bg-white border border-gray-200 rounded-lg p-4 ${!key.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <Key className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">{key.name}</h3>
                    {!key.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                        Vô hiệu hóa
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 mb-2">
                    <code className="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm font-mono">
                      {key.prefix}••••••••
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.prefix)}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      title="Sao chép prefix"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                    <span className="flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Tạo: {formatDate(key.created_at)}
                    </span>
                    {key.expires_at && (
                      <span className="flex items-center text-orange-600">
                        <Calendar className="w-3 h-3 mr-1" />
                        Hết hạn: {formatDate(key.expires_at)}
                      </span>
                    )}
                    {key.last_used_at && (
                      <span>Dùng lần cuối: {formatDate(key.last_used_at)}</span>
                    )}
                  </div>

                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">Quyền hạn ({key.permissions.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {key.permissions.slice(0, 5).map((perm, idx) => (
                        <span key={idx} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                          {perm}
                        </span>
                      ))}
                      {key.permissions.length > 5 && (
                        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                          +{key.permissions.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-1 ml-4">
                  <button
                    onClick={() => handleToggleActive(key.id, key.is_active)}
                    className={`p-2 ${key.is_active ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}`}
                    title={key.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                  >
                    {key.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="p-2 text-red-600 hover:text-red-700"
                    title="Thu hồi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                {createdKey ? 'API Key đã tạo' : 'Tạo API Key mới'}
              </h3>
            </div>

            {createdKey ? (
              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    ⚠️ Lưu ý quan trọng
                  </p>
                  <p className="text-sm text-yellow-700">
                    Đây là lần duy nhất bạn có thể xem API key đầy đủ. Hãy sao chép và lưu trữ an toàn.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    API Key của bạn:
                  </label>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 px-3 py-2 bg-gray-100 text-gray-800 rounded text-sm font-mono break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-2 text-blue-600 hover:text-blue-700"
                      title="Sao chép"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey(null);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newKeyData.name}
                    onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Production API Key"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quyền hạn
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {availablePermissions.map((perm) => (
                      <label key={perm} className="flex items-center space-x-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyData.permissions.includes(perm)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewKeyData({ ...newKeyData, permissions: [...newKeyData.permissions, perm] });
                            } else {
                              setNewKeyData({ ...newKeyData, permissions: newKeyData.permissions.filter(p => p !== perm) });
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày hết hạn (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={newKeyData.expires_at}
                    onChange={(e) => setNewKeyData({ ...newKeyData, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Tạo API Key
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> API keys cho phép truy cập programmatic vào hệ thống. 
          Hãy giữ chúng an toàn và không chia sẻ công khai. Bạn có thể tạo tối đa 10 API keys đang hoạt động.
        </p>
      </div>
    </div>
  );
}
