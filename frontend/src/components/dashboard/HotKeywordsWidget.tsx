import React from 'react';
import { Flame } from 'lucide-react';

interface HotKeyword {
  keyword: string;
  count: number;
  negative_count: number;
  risk_score_avg: number;
}

export default function HotKeywordsWidget({ data, isLoading }: { data: HotKeyword[] | null; isLoading: boolean }) {
  if (isLoading) {
    return <div className="h-48 flex items-center justify-center text-paper-muted font-medium tracking-wide">Đang tải từ khóa...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-paper-muted font-medium tracking-wide">Chưa có từ khóa nổi bật</div>;
  }

  return (
    <div className="space-y-4">
      {Array.isArray(data) && data.slice(0, 5).map((kw, i) => (
        <div key={kw.keyword} className="flex items-center justify-between p-3.5 bg-void-surface hover:bg-void-raised rounded-xl border border-edge transition-colors duration-150 motion-reduce:transition-none">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${i < 3 ? 'bg-warning/10 text-warning border border-warning/25' : 'bg-void-raised text-paper-muted border border-edge'}`}>
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <p className="font-semibold text-paper tracking-wide">{kw.keyword}</p>
              <div className="flex space-x-2 mt-1 text-xs font-medium">
                <span className="text-paper-muted tabular-nums">{kw.count} mentions</span>
                {kw.negative_count > 0 && (
                  <span className="text-sentiment-negative tabular-nums">({kw.negative_count} tiêu cực)</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`px-2.5 py-1 text-xs rounded-md font-medium tracking-wide tabular-nums ${
              kw.risk_score_avg >= 70 ? 'bg-destructive/10 text-destructive border border-destructive/25' :
              kw.risk_score_avg >= 40 ? 'bg-warning/10 text-warning border border-warning/25' :
              'bg-sentiment-neutral/10 text-sentiment-neutral border border-sentiment-neutral/25'
            }`}>
              Rủi ro: {kw.risk_score_avg.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
