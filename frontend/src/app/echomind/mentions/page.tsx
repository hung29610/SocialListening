'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Twitter, MessageCircle, Globe, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { SentimentBadge } from '@/components/ui/SentimentBadge';

interface Mention {
  id: number;
  keyword: string;
  source: string;
  content: string;
  author: string;
  created_at: string;
  sentiment: string;
  sentiment_score: number;
}

export default function MentionsPage() {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMentions = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/api/echomind/mentions');
      setMentions(res.data);
    } catch (error) {
      toast.error('Failed to load mentions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Poll every 10 seconds for real-time feel (Disabled to stop spam)
  useEffect(() => {
    fetchMentions();
  }, []);

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'x': return <Twitter size={18} className="text-signal" />;
      case 'reddit': return <MessageCircle size={18} className="text-paper-muted" />;
      default: return <Globe size={18} className="text-paper-muted" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    return <SentimentBadge sentiment={sentiment} size="sm" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-paper">Mentions Feed</h2>
          <p className="text-paper-muted mt-1">Live stream of conversations across the web.</p>
        </div>
        <button
          onClick={() => fetchMentions(true)}
          className="flex items-center gap-2 px-4 py-2 bg-void-surface border border-edge rounded-lg hover:bg-void-raised text-paper-muted transition-colors motion-reduce:transition-none"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin motion-reduce:animate-none text-signal" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-4">
        {loading && !mentions.length ? (
          <div className="p-8 text-center text-paper-muted bg-void-surface rounded-xl border border-edge">Loading mentions...</div>
        ) : mentions.length === 0 ? (
          <div className="p-8 text-center text-paper-muted bg-void-surface rounded-xl border border-edge">No mentions found yet. Make sure you have active keywords!</div>
        ) : (
          mentions.map((mention) => (
            <div key={mention.id} className="bg-void-surface border border-edge rounded-xl p-5 hover:border-edge-strong transition-colors motion-reduce:transition-none">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="bg-void p-2 rounded-lg border border-edge">
                    {getSourceIcon(mention.source)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-paper">@{mention.author}</h3>
                    <p className="text-xs text-paper-faint">{new Date(mention.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-signal/10 text-signal border border-signal/20">
                    #{mention.keyword}
                  </span>
                  {getSentimentBadge(mention.sentiment)}
                </div>
              </div>
              <p className="text-paper-muted text-sm leading-relaxed">{mention.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
