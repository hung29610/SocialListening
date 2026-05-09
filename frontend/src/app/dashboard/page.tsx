'use client';

import { useEffect, useState } from 'react';
import { dashboard } from '@/lib/api';
import { 
  FileText, 
  AlertTriangle, 
  Bell, 
  TrendingUp,
  TrendingDown,
  Activity
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await dashboard.get(30);
        setData(result);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Không có dữ liệu</div>
      </div>
    );
  }

  const metrics = data.metrics;
  const sentimentData = [
    { name: 'Tích cực', value: data.sentiment_distribution.positive, color: '#10b981' },
    { name: 'Trung lập', value: data.sentiment_distribution.neutral, color: '#6b7280' },
    { name: 'Tiêu cực thấp', value: data.sentiment_distribution.negative_low, color: '#f59e0b' },
    { name: 'Tiêu cực TB', value: data.sentiment_distribution.negative_medium, color: '#ef4444' },
    { name: 'Tiêu cực cao', value: data.sentiment_distribution.negative_high, color: '#dc2626' },
  ];

  const riskData = [
    { name: 'Thấp', value: data.risk_distribution.low, color: '#10b981' },
    { name: 'Trung bình', value: data.risk_distribution.medium, color: '#f59e0b' },
    { name: 'Cao', value: data.risk_distribution.high, color: '#ef4444' },
    { name: 'Nghiêm trọng', value: data.risk_distribution.critical, color: '#dc2626' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tổng quan hoạt động giám sát danh tiếng
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Mentions hôm nay"
          value={metrics.total_mentions_today}
          icon={FileText}
          color="blue"
        />
        <MetricCard
          title="Cảnh báo nghiêm trọng"
          value={metrics.critical_alerts}
          icon={Bell}
          color="red"
        />
        <MetricCard
          title="Sự cố đang mở"
          value={metrics.open_incidents}
          icon={AlertTriangle}
          color="orange"
        />
        <MetricCard
          title="Quá hạn SLA"
          value={metrics.overdue_incidents}
          icon={Activity}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Sentiment Distribution */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Phân bố cảm xúc
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sentimentData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sentimentData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Risk Distribution */}
        <div className="p-6 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Phân bố rủi ro
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {riskData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mentions Trend */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Xu hướng mentions (30 ngày)
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.mention_trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" name="Tổng" />
            <Line type="monotone" dataKey="positive" stroke="#10b981" name="Tích cực" />
            <Line type="monotone" dataKey="negative" stroke="#ef4444" name="Tiêu cực" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Risky Mentions */}
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Mentions rủi ro cao nhất
        </h2>
        <div className="space-y-4">
          {data.top_risky_mentions.slice(0, 5).map((mention: any) => (
            <div
              key={mention.mention_id}
              className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {mention.title || 'Không có tiêu đề'}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                    {mention.content_snippet}
                  </p>
                  <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                    <span>Risk: {mention.risk_score}/100</span>
                    <span>Crisis: {mention.crisis_level}/5</span>
                    {mention.published_at && (
                      <span>{new Date(mention.published_at).toLocaleDateString('vi-VN')}</span>
                    )}
                  </div>
                </div>
                <div className={`ml-4 px-3 py-1 text-xs font-medium rounded-full ${
                  mention.risk_score >= 80 ? 'bg-red-100 text-red-800' :
                  mention.risk_score >= 60 ? 'bg-orange-100 text-orange-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {mention.risk_score >= 80 ? 'Nghiêm trọng' :
                   mention.risk_score >= 60 ? 'Cao' : 'Trung bình'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: any; 
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }[color];

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
