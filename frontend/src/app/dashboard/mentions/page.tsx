'use client';

import { useEffect, useState } from 'react';
import { Search, Eye, Trash2, AlertTriangle, FileText, X } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

export default function MentionsPage() {
  const [mentions, setMentions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMention, setSelectedMention] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchMentions();
  }, [page, searchTerm]);

  const fetchMentions = async () => {
    try {
      setLoading(true);
      const data = await mentionsApi.list({
        page,
        page_size: 20,
        search_query: searchTerm || undefined
      });
      setMentions(data.items);
      setTotalPages(data.total_pages);
    } catch (error: any) {
      console.error('Error fetching mentions:', error);
      toast.error('Lỗi khi tải mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (mentionId: number) => {
    try {
      const data = await mentionsApi.get(mentionId);
      setSelectedMention(data);
      setShowDetailModal(true);
    } catch (error: any) {
      console.error('Error fetching mention detail:', error);
      toast.error('Lỗi khi tải chi tiết mention');
    }
  };

  const handleCreateAlert = async () => {
    if (!selectedMention) return;
    
    try {
      await alertsApi.create({
        mention_id: selectedMention.id,
        title: `Alert: ${selectedMention.title || 'No title'}`,
        severity: selectedMention.ai_analysis?.risk_score >= 70 ? 'high' : 'medium',
        message: `Risk score: ${selectedMention.ai_analysis?.risk_score}`
      });
      toast.success('Tạo cảnh báo thành công!');
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error('Lỗi khi tạo cảnh báo');
    }
  };

  const handleCreateIncident = async () => {
    if (!selectedMention) return;
    
    try {
      await incidentsApi.create({
        mention_id: selectedMention.id,
        title: `Incident: ${selectedMention.title || 'No title'}`,
        description: selectedMention.ai_analysis?.summary_vi || ''
      });
      toast.success('Tạo sự cố thành công!');
      setShowDetailModal(false);
    } catch (error: any) {
      console.error('Error creating incident:', error);
      toast.error('Lỗi khi tạo sự cố');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa mention này?')) return;
    
    try {
      await mentionsApi.delete(id);
      toast.success('Xóa mention thành công!');
      fetchMentions();
    } catch (error: any) {
      console.error('Error deleting mention:', error);
      toast.error('Lỗi khi xóa mention');
    }
  };

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-green-100 text-green-800';
    if (sentiment === 'neutral') return 'bg-gray-100 text-gray-800';
    if (sentiment === 'negative_low') return 'bg-yellow-100 text-yellow-800';
    if (sentiment === 'negative_medium') return 'bg-orange-100 text-orange-800';
    if (sentiment === 'negative_high') return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading && mentions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Danh sách các mentions đã thu thập
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm mentions..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Mentions List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {mentions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Chưa có mention nào. Hãy thực hiện scan để thu thập dữ liệu!
          </div>
        ) : (
          <div className="divide-y">
            {mentions.map((mention) => (
              <div key={mention.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{mention.title || 'No title'}</h3>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{mention.content}</p>
                    
                    <div className="flex items-center space-x-4 mt-3">
                      {mention.ai_analysis && (
                        <>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(mention.ai_analysis.sentiment)}`}>
                            {mention.ai_analysis.sentiment}
                          </span>
                          <span className={`text-sm font-medium ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                            Risk: {mention.ai_analysis.risk_score}
                          </span>
                          <span className="text-xs text-gray-500">
                            Crisis Level: {mention.ai_analysis.crisis_level}/5
                          </span>
                        </>
                      )}
                      <span className="text-xs text-gray-500">
                        {new Date(mention.collected_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewDetail(mention.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(mention.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Xóa"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Trước
          </button>
          <span className="px-4 py-2">
            Trang {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedMention && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white rounded-t-xl flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Chi tiết Mention</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3">{selectedMention.title || 'No title'}</h3>
                    <p className="text-gray-700 mb-4 leading-relaxed">{selectedMention.content}</p>
                    <a 
                      href={selectedMention.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Xem nguồn gốc →
                    </a>
                  </div>

                  {/* Matched Keywords */}
                  {selectedMention.matched_keywords && selectedMention.matched_keywords.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="font-semibold mb-3 text-blue-900">Từ khóa khớp</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMention.matched_keywords.map((kw: any, idx: number) => (
                          <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                            {kw.keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* AI Analysis */}
                  {selectedMention.ai_analysis && (
                    <div className="bg-white border rounded-lg p-4">
                      <h4 className="font-semibold mb-4 text-gray-900">AI Analysis</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Sentiment:</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSentimentColor(selectedMention.ai_analysis.sentiment)}`}>
                            {selectedMention.ai_analysis.sentiment}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Risk Score:</span>
                          <span className={`font-bold ${getRiskColor(selectedMention.ai_analysis.risk_score)}`}>
                            {selectedMention.ai_analysis.risk_score}/100
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Crisis Level:</span>
                          <span className="font-bold text-gray-900">{selectedMention.ai_analysis.crisis_level}/5</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Action:</span>
                          <span className="text-sm font-medium text-gray-900">{selectedMention.ai_analysis.suggested_action}</span>
                        </div>
                        {selectedMention.ai_analysis.responsible_department && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Department:</span>
                            <span className="text-sm font-medium text-gray-900">{selectedMention.ai_analysis.responsible_department}</span>
                          </div>
                        )}
                      </div>
                      {selectedMention.ai_analysis.summary_vi && (
                        <div className="mt-4 pt-4 border-t">
                          <span className="text-sm text-gray-600 block mb-2">Tóm tắt:</span>
                          <p className="text-sm text-gray-800 bg-gray-50 p-3 rounded">{selectedMention.ai_analysis.summary_vi}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="bg-white border rounded-lg p-4">
                    <h4 className="font-semibold mb-4 text-gray-900">Hành động</h4>
                    <div className="space-y-3">
                      <button
                        onClick={handleCreateAlert}
                        className="w-full flex items-center justify-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Tạo Cảnh Báo
                      </button>
                      <button
                        onClick={handleCreateIncident}
                        className="w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Tạo Sự Cố
                      </button>
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold mb-3 text-gray-900">Thông tin</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Thu thập:</span>
                        <span className="ml-2 text-gray-900">{new Date(selectedMention.collected_at).toLocaleString('vi-VN')}</span>
                      </div>
                      {selectedMention.published_at && (
                        <div>
                          <span className="text-gray-600">Xuất bản:</span>
                          <span className="ml-2 text-gray-900">{new Date(selectedMention.published_at).toLocaleString('vi-VN')}</span>
                        </div>
                      )}
                      {selectedMention.author && (
                        <div>
                          <span className="text-gray-600">Tác giả:</span>
                          <span className="ml-2 text-gray-900">{selectedMention.author}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
