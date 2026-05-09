'use client';

import { useEffect, useState } from 'react';
import { mentions } from '@/lib/api';
import { Search, Filter, ExternalLink, Calendar } from 'lucide-react';

export default function MentionsPage() {
  const [mentionList, setMentionList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    sentiment: '',
    platform: '',
    date_from: '',
    date_to: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchMentions();
  }, [filters]);

  const fetchMentions = async () => {
    try {
      const params: any = {};
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.platform) params.platform_type = filters.platform;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;

      const data = await mentions.list(params);
      setMentionList(data);
    } catch (error) {
      console.error('Failed to fetch mentions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMentions = mentionList.filter(mention =>
    mention.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mention.content_snippet?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mentions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tất cả các đề cập được phát hiện
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Filter className="w-4 h-4 mr-2" />
          Bộ lọc
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 bg-white rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cảm xúc
              </label>
              <select
                value={filters.sentiment}
                onChange={(e) => setFilters({ ...filters, sentiment: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="positive">Tích cực</option>
                <option value="neutral">Trung lập</option>
                <option value="negative_low">Tiêu cực thấp</option>
                <option value="negative_medium">Tiêu cực trung bình</option>
                <option value="negative_high">Tiêu cực cao</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nền tảng
              </label>
              <select
                value={filters.platform}
                onChange={(e) => setFilters({ ...filters, platform: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tất cả</option>
                <option value="facebook">Facebook</option>
                <option value="youtube">YouTube</option>
                <option value="news">Báo chí</option>
                <option value="rss">RSS</option>
                <option value="web">Web</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Từ ngày
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Đến ngày
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setFilters({ sentiment: '', platform: '', date_from: '', date_to: '' })}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Xóa bộ lọc
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm mentions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-sm text-gray-600">Tổng mentions</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">
            {filteredMentions.length}
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-sm text-gray-600">Tiêu cực</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {filteredMentions.filter(m => m.sentiment?.startsWith('negative')).length}
          </div>
        </div>
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="text-sm text-gray-600">Tích cực</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {filteredMentions.filter(m => m.sentiment === 'positive').length}
          </div>
        </div>
      </div>

      {/* Mentions List */}
      <div className="space-y-4">
        {filteredMentions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">Không có mentions nào</p>
          </div>
        ) : (
          filteredMentions.map((mention) => (
            <MentionCard key={mention.id} mention={mention} />
          ))
        )}
      </div>
    </div>
  );
}

function MentionCard({ mention }: any) {
  const sentimentColors: any = {
    positive: 'bg-green-100 text-green-800',
    neutral: 'bg-gray-100 text-gray-800',
    negative_low: 'bg-yellow-100 text-yellow-800',
    negative_medium: 'bg-orange-100 text-orange-800',
    negative_high: 'bg-red-100 text-red-800',
  };

  const sentimentLabels: any = {
    positive: 'Tích cực',
    neutral: 'Trung lập',
    negative_low: 'Tiêu cực thấp',
    negative_medium: 'Tiêu cực TB',
    negative_high: 'Tiêu cực cao',
  };

  const platformColors: any = {
    facebook: 'bg-blue-100 text-blue-800',
    youtube: 'bg-red-100 text-red-800',
    news: 'bg-purple-100 text-purple-800',
    rss: 'bg-orange-100 text-orange-800',
    web: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              sentimentColors[mention.sentiment] || sentimentColors.neutral
            }`}>
              {sentimentLabels[mention.sentiment] || 'Chưa phân tích'}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              platformColors[mention.platform_type] || platformColors.web
            }`}>
              {mention.platform_type?.toUpperCase()}
            </span>
            {mention.risk_score !== null && mention.risk_score >= 60 && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-800">
                Risk: {mention.risk_score}/100
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900">
            {mention.title || 'Không có tiêu đề'}
          </h3>

          <p className="mt-2 text-sm text-gray-600 line-clamp-3">
            {mention.content_snippet}
          </p>

          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
            {mention.published_at && (
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                {new Date(mention.published_at).toLocaleString('vi-VN')}
              </div>
            )}
            {mention.source_name && (
              <div>Nguồn: {mention.source_name}</div>
            )}
            {mention.matched_keywords && mention.matched_keywords.length > 0 && (
              <div>
                Từ khóa: {mention.matched_keywords.join(', ')}
              </div>
            )}
          </div>

          {mention.url && (
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
            >
              Xem nguồn
              <ExternalLink className="w-4 h-4 ml-1" />
            </a>
          )}
        </div>
      </div>

      {/* AI Analysis Summary */}
      {mention.ai_summary && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-sm">
            <span className="font-medium text-gray-700">Phân tích AI:</span>
            <p className="mt-1 text-gray-600">{mention.ai_summary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
