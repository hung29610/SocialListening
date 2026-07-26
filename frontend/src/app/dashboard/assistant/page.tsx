'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, ArrowRight, AlertTriangle, Settings, Trash2 } from 'lucide-react';
import { aiChat } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ChatConfig {
  is_configured: boolean;
  is_enabled: boolean;
  provider: string | null;
  model_name: string | null;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

export default function AssistantPage() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<{role: string, content: string}[]>([
    { role: 'assistant', content: t('misc.assistant.greeting') }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatConfig, setChatConfig] = useState<ChatConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    loadChatConfig();
  }, []);

  const loadChatConfig = async () => {
    try {
      const config = await aiChat.getChatConfig();
      setChatConfig(config);
    } catch (err) {
      // If it fails, assume not configured
      setChatConfig({ is_configured: false, is_enabled: false, provider: null, model_name: null });
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await aiChat.chat(newMessages.filter(m => m.role !== 'system'));
      setMessages([...newMessages, response]);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || t('misc.assistant.errors.connectionFailed');
      toast.error(detail);
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ ${detail}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
  };

  const handleClearChat = () => {
    setMessages([
      { role: 'assistant', content: t('misc.assistant.greeting') }
    ]);
  };

  const suggestions = [
    t('misc.assistant.suggestions.weeklySummary'),
    t('misc.assistant.suggestions.negativeBuzz'),
    t('misc.assistant.suggestions.shareOfVoice'),
    t('misc.assistant.suggestions.topInfluencer'),
  ];

  const providerLabel = chatConfig?.model_name
    ? `${chatConfig.provider === 'openai' ? 'GPT' : chatConfig.provider === 'gemini' ? 'Gemini' : 'Custom'} • ${chatConfig.model_name}`
    : 'Enterprise LLM';

  // Not configured state
  if (!configLoading && chatConfig && (!chatConfig.is_configured || !chatConfig.is_enabled)) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)] max-w-lg mx-auto text-center px-4">
        <div className="w-20 h-20 rounded-2xl bg-warning/10 flex items-center justify-center mb-6 border border-warning/25">
          <AlertTriangle className="w-10 h-10 text-warning" />
        </div>
        <h2 className="text-2xl font-bold text-paper mb-3">{t('misc.assistant.notConfigured.title')}</h2>
        <p className="text-paper-muted mb-6 leading-relaxed">
          {!chatConfig.is_configured
            ? t('misc.assistant.notConfigured.needsSetup')
            : t('misc.assistant.notConfigured.disabled')
          }
        </p>
        <Link
          href="/dashboard/settings"
          className={`flex items-center gap-2 px-6 py-3 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-medium transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
        >
          <Settings className="w-4 h-4" />
          {t('misc.assistant.notConfigured.goToSettings')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-5xl mx-auto bg-void-surface border border-edge rounded-2xl shadow-tile overflow-hidden relative">
      {/* Header */}
      <div className="p-4 border-b border-edge flex items-center justify-between bg-void-surface z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-signal flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-paper tracking-wide">{t('misc.assistant.title')}</h1>
            <p className="text-xs text-signal dark:text-signal-bright font-medium">
              {configLoading ? t('misc.assistant.connecting') : `${t('reports.poweredBy')} ${providerLabel}`}
            </p>
          </div>
        </div>
        <button
          onClick={handleClearChat}
          title={t('misc.assistant.clearChat')}
          className={`p-2 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-void">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
            <div className={`flex max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                msg.role === 'user' ? 'bg-signal ml-3' : 'bg-void-raised border border-edge mr-3'
              }`}>
                {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-signal dark:text-signal-bright" />}
              </div>

              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-signal/10 border border-signal/20 text-paper rounded-tr-none'
                  : 'bg-void-surface text-paper border border-edge rounded-tl-none whitespace-pre-wrap'
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="flex max-w-[85%] sm:max-w-[75%] flex-row">
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 bg-void-raised border border-edge mr-3">
                <Bot className="w-4 h-4 text-signal dark:text-signal-bright" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-void-surface border border-edge rounded-tl-none flex items-center space-x-2">
                <div className="w-2 h-2 bg-signal dark:bg-signal-bright rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-signal dark:bg-signal-bright rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-signal dark:bg-signal-bright rounded-full animate-bounce motion-reduce:animate-none" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-edge bg-void-surface shrink-0">
        {messages.length === 1 && (
          <div className="mb-4 hidden sm:flex flex-wrap gap-2 justify-center">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(s)}
                className={`text-xs bg-void-raised hover:bg-signal/10 border border-edge hover:border-signal/25 text-paper-muted hover:text-signal dark:hover:text-signal-bright px-3 py-1.5 rounded-full transition-colors duration-150 motion-reduce:transition-none flex items-center ${focusRing}`}
              >
                {s} <ArrowRight className="w-3 h-3 ml-1.5 opacity-50" />
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('misc.assistant.inputPlaceholder')}
            className="w-full pl-5 pr-14 py-4 bg-void-surface border border-edge-strong rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`absolute right-2 p-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright disabled:bg-void-raised disabled:text-paper-faint transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
        <div className="mt-3 text-center">
          <p className="text-[10px] text-paper-faint">{t('misc.assistant.disclaimer')}</p>
        </div>
      </div>
    </div>
  );
}
