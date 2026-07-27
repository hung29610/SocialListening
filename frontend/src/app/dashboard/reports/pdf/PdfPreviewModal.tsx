import { X, Loader2 } from 'lucide-react';
import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  ChartA11ySummary,
} from '@/components/dashboard/chartTheme';

/* SIGNAL shared micro-interaction primitive (150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

export function PdfPreviewModal({ isOpen, onClose, data, loading, config }: any) {
  if (!isOpen) return null;

  const { sections, theme, accentColor, fontColor, fontFamily, aspectRatio } = config;
  const isDark = theme === 'dark';

  // Export-document fidelity palette — this block previews the PDF the
  // backend will generate, so it follows the document's OWN light/dark
  // export setting (config.theme), not the app theme. These values are
  // baked into the exported asset and cannot resolve through SIGNAL
  // tokens; raw hex is intentional here (see W-D migration report).
  const doc = isDark
    ? { bg: '#0f172a', border: '#1e293b', card: '#1e293b', muted: '#94a3b8', text: '#f8fafc' }
    : { bg: '#ffffff', border: '#e5e7eb', card: '#f9fafb', muted: '#64748b', text: fontColor };

  const enabledSections = sections.filter((s: any) => s.enabled).map((s: any) => s.id);

  const getSentimentData = () => {
    if (!data?.metrics?.sentiment) return [];
    return [
      { name: 'Positive', value: data.metrics.sentiment.positive || 0, color: chartColors.positive },
      { name: 'Negative', value: data.metrics.sentiment.negative || 0, color: chartColors.negative },
      { name: 'Neutral', value: data.metrics.sentiment.neutral || 0, color: chartColors.neutral }
    ].filter(d => d.value > 0);
  };

  const getTrendData = () => {
    if (!data?.metrics?.daily_trend) return [];
    const trend = data.metrics.daily_trend;
    return Object.keys(trend).sort().map(dt => ({
      date: dt.substring(5), // MM-DD
      mentions: trend[dt].count || trend[dt].mentions || 0
    }));
  };

  const renderSection = (id: string) => {
    switch (id) {
      case 'summary':
      case 'overview':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-2xl font-bold">Overview</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                <div className="text-sm font-semibold opacity-70">Total Mentions</div>
                <div className="text-2xl font-bold mt-1 tabular-nums">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                <div className="text-sm font-semibold opacity-70">Total Reach</div>
                <div className="text-2xl font-bold mt-1 tabular-nums">{data?.metrics?.total_reach?.toLocaleString() || 0}</div>
              </div>
              <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                <div className="text-sm font-semibold opacity-70">Positive Results</div>
                <div className="text-2xl font-bold mt-1 tabular-nums text-sentiment-positive">{data?.metrics?.sentiment?.positive?.toLocaleString() || 0}</div>
              </div>
            </div>
          </div>
        );
      case 'executive_summary':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Executive Summary</h2>
            <div className="p-6 rounded-xl text-sm leading-relaxed" style={{ backgroundColor: doc.card }}>
              {data?.exec_summary || "No executive summary available for this period."}
            </div>
          </div>
        );
      case 'analysis':
        const pieData = getSentimentData();
        const trendData = getTrendData();
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Analysis & Trends</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-xl flex flex-col items-center justify-center h-64" role="img" aria-labelledby="pdf-sentiment-summary" style={{ backgroundColor: doc.card }}>
                <ChartA11ySummary id="pdf-sentiment-summary">PDF sentiment breakdown chart showing analyzed sentiment counts.</ChartA11ySummary>
                <h3 className="font-bold mb-2">Sentiment Breakdown</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie isAnimationActive={false} data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}>
                        {pieData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} labelStyle={chartTooltipLabelStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="opacity-50 text-sm">No sentiment data available.</div>
                )}
              </div>
              <div className="p-6 rounded-xl flex flex-col items-center justify-center h-64" role="img" aria-labelledby="pdf-volume-summary" style={{ backgroundColor: doc.card }}>
                <ChartA11ySummary id="pdf-volume-summary">PDF daily volume chart showing analyzed mention counts over time.</ChartA11ySummary>
                <h3 className="font-bold mb-2">Daily Volume</h3>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <XAxis dataKey="date" tick={{ ...chartAxisTick, fontSize: 10 }} stroke={chartGrid.stroke} />
                      <YAxis tick={{ ...chartAxisTick, fontSize: 10 }} stroke={chartGrid.stroke} />
                      <Tooltip contentStyle={chartTooltipStyle} itemStyle={chartTooltipItemStyle} labelStyle={chartTooltipLabelStyle} />
                      <Bar isAnimationActive={false} dataKey="mentions" fill={chartColors.accent} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="opacity-50 text-sm">No trend data available.</div>
                )}
              </div>
            </div>
          </div>
        );
      case 'period_comparison':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Period Comparison</h2>
            {!data?.comparison ? (
               <div className="opacity-50 text-sm">No comparison data available.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                  <div className="text-sm font-semibold opacity-70">Mentions Change</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{data.comparison.mentions_change}</div>
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                  <div className="text-sm font-semibold opacity-70">Reach Change</div>
                  <div className="text-2xl font-bold mt-1 tabular-nums">{data.comparison.reach_change}</div>
                </div>
              </div>
            )}
          </div>
        );
      case 'categories':
      case 'influencers_sources':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Sources & Topics</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl" style={{ backgroundColor: doc.card }}>
                <h3 className="font-bold mb-3">Top Domains</h3>
                {data?.sources_list?.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {data.sources_list.slice(0,5).map((s: any, i: number) => (
                      <li key={i} className="flex justify-between border-b pb-1" style={{ borderColor: doc.border }}><span>{s.name}</span><span className="font-semibold tabular-nums">{s.count}</span></li>
                    ))}
                  </ul>
                ) : (
                  <div className="opacity-50 text-sm">No source data available.</div>
                )}
              </div>
            </div>
          </div>
        );
      case 'top_mentions':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Top Mentions by Reach</h2>
            <div className="space-y-3">
              {data?.top_mentions?.length > 0 ? data.top_mentions.slice(0,3).map((m: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border-l-4" style={{ borderLeftColor: accentColor, backgroundColor: doc.card }}>
                  <div className="font-bold">{m.title || 'Untitled'}</div>
                  <div className="text-xs mt-1 mb-2 opacity-70">{m.domain} • Reach: {m.reach}</div>
                  <div className="text-sm italic opacity-80">"{m.content?.substring(0, 150)}..."</div>
                </div>
              )) : (
                <div className="opacity-50 text-sm">No top mentions available.</div>
              )}
            </div>
          </div>
        );
      case 'recent_mentions':
        return (
          <div key={id} className="space-y-4">
            <h2 className="text-xl font-bold" style={{ color: accentColor }}>Recent Mentions</h2>
            <div className="space-y-3">
              {data?.raw_mentions?.length > 0 ? data.raw_mentions.slice(0,3).map((m: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border-l-4" style={{ borderLeftColor: accentColor, backgroundColor: doc.card }}>
                  <div className="font-bold">{m.title || 'Untitled'}</div>
                  <div className="text-xs mt-1 mb-2 opacity-70">{m.domain} • {m.date}</div>
                  <div className="text-sm italic opacity-80">"{m.content?.substring(0, 150)}..."</div>
                </div>
              )) : (
                <div className="opacity-50 text-sm">No recent mentions available.</div>
              )}
            </div>
          </div>
        );
      case 'mentions_reach':
      case 'sentiment':
        // Covered in analysis mostly, placeholder mapping for these explicit sections if needed
        return null;
      default: return null;
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-void-surface border border-edge shadow-tile transition-all flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-edge">
                  <Dialog.Title className="text-lg font-bold text-paper">PDF Live Preview</Dialog.Title>
                  <button onClick={onClose} className={`p-2 hover:bg-void-raised rounded-full transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}><X className="w-5 h-5 text-paper-faint" /></button>
                </div>

                <div className="p-8 bg-void-raised overflow-y-auto flex-1 flex justify-center">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 text-paper-muted">
                      <Loader2 className="w-8 h-8 animate-spin mb-4 text-signal dark:text-signal-bright" />
                      Loading preview data...
                    </div>
                  ) : (
                    <div
                      className="shadow-tile overflow-hidden"
                      style={{
                        width: aspectRatio === 'horizontal' ? '100%' : '21cm',
                        minHeight: aspectRatio === 'horizontal' ? '21cm' : '29.7cm',
                        maxWidth: '100%',
                        backgroundColor: doc.bg,
                        color: doc.text,
                        fontFamily: fontFamily === 'Helvetica' ? 'Helvetica, sans-serif' :
                                   fontFamily === 'Courier' ? 'Courier, monospace' :
                                   '"Times New Roman", serif'
                      }}
                    >
                      {/* Cover */}
                      <div className="h-64 flex flex-col items-center justify-center border-b" style={{ borderColor: doc.border }}>
                        <h1 className="text-4xl font-bold mb-4">{data?.project_name || 'Project Name'}</h1>
                        <p style={{ color: doc.muted }}>{data?.date_from} to {data?.date_to}</p>
                      </div>

                      {/* Content */}
                      <div className="p-12 space-y-12">
                        {enabledSections.map((id: string) => renderSection(id))}
                      </div>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
