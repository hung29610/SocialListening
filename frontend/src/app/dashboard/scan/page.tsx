'use client';

import { useEffect, useState } from 'react';
import { Play, Link as LinkIcon, History } from 'lucide-react';
import { crawl, keywords as keywordsApi, sources as sourcesApi } from '@/lib/api';

export default function ScanPage() {
  const [keywordGroups, setKeywordGroups] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchScanHistory();
  }, []);

  const fetchData = async () => {
    try {
      const [groupsData, sourcesData] = await Promise.all([
        keywordsApi.listGroups(),
        sourcesApi.list()
      ]);
      setKeywordGroups(groupsData);
      setSources(sourcesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchScanHistory = async () => {
    try {
      const data = await crawl.getScanHistory(1, 10);
      setScanHistory(data.items);
    } catch (error) {
      console.error('Error fetching scan history:', error);
    }
  };

  const handleScan = async () => {
    if (selectedGroups.length === 0) {
      alert('Vui lòng chọn ít nhất 1 nhóm từ khóa');
      return;
    }

    if (selectedSources.length === 0 && !customUrl) {
      alert('Vui lòng chọn nguồn hoặc nhập URL');
      return;
    }

    try {
      setScanning(true);
      const result = await crawl.manualScan({
        keyword_group_ids: selectedGroups,
        source_ids: selectedSources.length > 0 ? selectedSources : undefined,
        url: customUrl || undefined
      });
      
      alert(`Scan thành công!\nTìm thấy ${result.total_mentions_found} mentions mới`);
      
      // Reset form
      setSelectedGroups([]);
      setSelectedSources([]);
      setCustomUrl('');
      
      // Refresh history
      fetchScanHistory();
    } catch (error: any) {
      console.error('Error scanning:', error);
      alert('Lỗi khi scan: ' + (error.response?.data?.detail || error.message));
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan Center</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quét nguồn dữ liệu để thu thập mentions
        </p>
      </div>

      {/* Scan Form */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 className="text-lg font-semibold">Scan Mới</h2>

        {/* Select Keyword Groups */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn Nhóm Từ Khóa *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {keywordGroups.map((group) => (
              <label key={group.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedGroups([...selectedGroups, group.id]);
                    } else {
                      setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                    }
                  }}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500">{group.keyword_count} từ khóa</div>
                </div>
              </label>
            ))}
          </div>
          {keywordGroups.length === 0 && (
            <p className="text-sm text-gray-500">Chưa có nhóm từ khóa. Hãy tạo nhóm từ khóa trước!</p>
          )}
        </div>

        {/* Select Sources OR Custom URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chọn Nguồn
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {sources.map((source) => (
              <label key={source.id} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedSources.includes(source.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedSources([...selectedSources, source.id]);
                      setCustomUrl(''); // Clear custom URL
                    } else {
                      setSelectedSources(selectedSources.filter(id => id !== source.id));
                    }
                  }}
                  className="rounded"
                />
                <div className="flex-1">
                  <div className="font-medium">{source.name}</div>
                  <div className="text-xs text-gray-500 truncate">{source.url}</div>
                </div>
              </label>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">HOẶC</span>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nhập URL Tùy Chỉnh
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  if (e.target.value) {
                    setSelectedSources([]); // Clear selected sources
                  }
                }}
                placeholder="https://example.com hoặc https://example.com/rss"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Hỗ trợ: Website, RSS Feed, Blog
            </p>
          </div>
        </div>

        {/* Scan Button */}
        <button
          onClick={handleScan}
          disabled={scanning}
          className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-5 h-5 mr-2" />
          {scanning ? 'Đang Scan...' : 'Bắt Đầu Scan'}
        </button>
      </div>

      {/* Scan History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b flex items-center">
          <History className="w-5 h-5 mr-2 text-gray-600" />
          <h2 className="text-lg font-semibold">Lịch Sử Scan</h2>
        </div>
        <div className="p-6">
          {scanHistory.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có lịch sử scan</p>
          ) : (
            <div className="space-y-3">
              {scanHistory.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{item.title || 'Scan'}</div>
                    <div className="text-sm text-gray-600">{item.url}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(item.collected_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  {item.matched_keywords && item.matched_keywords.length > 0 && (
                    <div className="text-sm">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        {item.matched_keywords.length} keywords
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
