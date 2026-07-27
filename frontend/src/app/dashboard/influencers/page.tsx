'use client';

import { useState, useEffect } from 'react';
import { Users, TrendingUp, Search, RefreshCcw, Award, Star, Activity } from 'lucide-react';
import { influencers } from '@/lib/api';
import toast from 'react-hot-toast';

export default function InfluencersPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await influencers.leaderboard();
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu influencers');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = data?.items?.filter((i: any) => i.author.toLowerCase().includes(search.toLowerCase())) || [];

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-paper-muted font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin motion-reduce:animate-none text-signal dark:text-signal-bright" />
          Đang tổng hợp dữ liệu Influencers...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">Influencers Leaderboard</h1>
          <p className="text-sm text-paper-muted mt-1">Danh sách những người có sức ảnh hưởng và lượng thảo luận cao nhất.</p>
        </div>
      </div>

      {/* Top 3 Cards */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.isArray(filteredItems) && filteredItems.slice(0, 3).map((inf: any, idx: number) => (
            <div key={idx} className="bg-void-surface border border-edge hover:border-edge-strong rounded-2xl p-6 relative overflow-hidden group transition-colors duration-150 motion-reduce:transition-none">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity duration-150 motion-reduce:transition-none">
                {idx === 0 ? <TrophyIcon className="text-warning" /> : idx === 1 ? <TrophyIcon className="text-paper-faint" /> : <TrophyIcon className="text-warning/70" />}
              </div>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold tabular-nums border-2 ${
                    idx === 0 ? 'bg-warning/10 text-warning border-warning/25' :
                    idx === 1 ? 'bg-paper-faint/10 text-paper-muted border-paper-faint/25' :
                    'bg-warning/[0.06] text-warning border-warning/20'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-paper line-clamp-1">{inf.author}</h3>
                    <div className="flex items-center text-xs text-paper-faint mt-1">
                      <Star className="w-3 h-3 text-warning mr-1" />
                      Điểm ảnh hưởng: <span className="font-bold text-paper tabular-nums ml-1">{inf.influence_score}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-void-raised rounded-xl p-3 border border-edge">
                  <div className="text-xs text-paper-faint mb-1">Mentions</div>
                  <div className="font-bold text-paper tabular-nums">{inf.mentions_count.toLocaleString()}</div>
                </div>
                <div className="bg-void-raised rounded-xl p-3 border border-edge">
                  <div className="text-xs text-paper-faint mb-1">Reach (Est)</div>
                  <div className="font-bold text-signal dark:text-signal-bright tabular-nums">{inf.reach.toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Table */}
      <div className="bg-void-surface border border-edge rounded-2xl overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-edge bg-void-surface flex items-center justify-between shrink-0">
          <h3 className="font-bold text-paper">Toàn bộ Influencers ({filteredItems.length})</h3>
          <div className="relative">
            <Search className="w-4 h-4 text-paper-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm tác giả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-void-surface border border-edge-strong rounded-xl text-sm text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal w-64 transition-colors duration-150 motion-reduce:transition-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-void-raised z-10">
              <tr className="text-eyebrow font-semibold uppercase text-paper-faint border-b border-edge">
                <th scope="col" className="px-6 py-4">Hạng</th>
                <th scope="col" className="px-6 py-4">Tác giả / Kênh</th>
                <th scope="col" className="px-6 py-4">Nền tảng</th>
                <th scope="col" className="px-6 py-4">Lượng Mentions</th>
                <th scope="col" className="px-6 py-4">Reach Ước tính</th>
                <th scope="col" className="px-6 py-4 text-right">Influence Score</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row: any, i: number) => (
                <tr key={i} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                  <td className="px-6 py-4">
                    <span className={`text-sm font-bold tabular-nums ${i < 3 ? 'text-warning' : 'text-paper-faint'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-paper">{row.author}</div>
                  </td>
                  <td className="px-6 py-4 text-paper-muted text-sm">
                    {row.platform}
                  </td>
                  <td className="px-6 py-4 text-paper-muted font-medium tabular-nums">
                    {row.mentions_count.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-signal dark:text-signal-bright font-medium tabular-nums">
                    {row.reach.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-signal/10 border border-signal/25 text-signal dark:text-signal-bright font-bold text-sm tabular-nums">
                      <Activity className="w-3 h-3 mr-1" />
                      {row.influence_score}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-paper-faint">
                    Không tìm thấy dữ liệu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
      <path d="M4 22h16"></path>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
    </svg>
  );
}
