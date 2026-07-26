'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Save, TestTube2, Loader2, CheckCircle, XCircle, Eye, EyeOff, Zap } from 'lucide-react';
import { aiConfig } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

interface AIModelConfigData {
  provider: string;
  api_key_masked: string;
  model_name: string;
  base_url: string | null;
  max_tokens: number;
  temperature: number;
  is_enabled: boolean;
  system_prompt: string;
}

const buildProviderOptions = (t: (key: string) => string) => [
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Flash, 2.0 Flash, 1.5 Pro',
    icon: '✦',
    gradient: 'bg-signal',
    models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    id: 'openai',
    name: 'OpenAI GPT',
    description: 'GPT-4o, GPT-4o Mini, GPT-4 Turbo',
    icon: '◎',
    gradient: 'bg-signal',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'custom',
    name: t('settingsPage.aiModel.customProvider'),
    description: t('settingsPage.aiModel.customProviderDesc'),
    icon: '⚙',
    gradient: 'bg-signal',
    models: [] as string[],
  },
];

export default function AIModelSettings() {
  const { t } = useLanguage();
  const PROVIDER_OPTIONS = buildProviderOptions(t);
  const [config, setConfig] = useState<AIModelConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; preview?: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('gemini-2.5-flash');
  const [baseUrl, setBaseUrl] = useState('');
  const [maxTokens, setMaxTokens] = useState(2048);
  const [temperature, setTemperature] = useState(0.7);
  const [isEnabled, setIsEnabled] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await aiConfig.getConfig();
      setConfig(data);
      setProvider(data.provider || 'gemini');
      setModelName(data.model_name || 'gemini-2.5-flash');
      setBaseUrl(data.base_url || '');
      setMaxTokens(data.max_tokens || 2048);
      setTemperature(data.temperature ?? 0.7);
      setIsEnabled(data.is_enabled ?? true);
      setSystemPrompt(data.system_prompt || '');
    } catch (err: any) {
      if (err?.response?.status !== 403) {
        toast.error(t('settingsPage.aiModel.errors.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    setTestResult(null);
    // Set default model for the provider
    const providerOption = PROVIDER_OPTIONS.find(p => p.id === newProvider);
    if (providerOption && providerOption.models.length > 0) {
      setModelName(providerOption.models[0]);
    } else if (newProvider === 'custom') {
      setModelName('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: any = {
        provider,
        model_name: modelName,
        max_tokens: maxTokens,
        temperature,
        is_enabled: isEnabled,
      };
      data.system_prompt = systemPrompt;
      if (apiKey) data.api_key = apiKey;
      if (provider === 'custom') data.base_url = baseUrl;
      else data.base_url = '';

      const result = await aiConfig.updateConfig(data);
      setConfig(result);
      setApiKey(''); // Clear entered key after save
      toast.success(t('settingsPage.aiModel.saveSuccess'));
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || t('settingsPage.aiModel.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const keyToTest = apiKey || config?.api_key_masked || '';
      if (!keyToTest || keyToTest.includes('...')) {
        // If no new key entered and current is masked, we need to test with the stored key
        // The backend test endpoint will use the provided key
        if (!apiKey) {
          toast.error(t('settingsPage.aiModel.errors.apiKeyRequired'));
          setTesting(false);
          return;
        }
      }
      const result = await aiConfig.testConnection({
        provider,
        api_key: apiKey,
        model_name: modelName,
        base_url: provider === 'custom' ? baseUrl : undefined,
      });
      setTestResult(result);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || t('settingsPage.aiModel.errors.connectionFailed');
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin motion-reduce:animate-none text-signal dark:text-signal-bright" />
      </div>
    );
  }

  const selectedProvider = PROVIDER_OPTIONS.find(p => p.id === provider);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-paper flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-signal flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {t('settingsPage.aiModel.title')}
        </h2>
        <p className="text-sm text-paper-muted mt-2">
          {t('settingsPage.aiModel.subtitle')}
        </p>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-void-raised border border-edge rounded-xl">
        <div className="flex items-center gap-3">
          <Zap className={`w-5 h-5 ${isEnabled ? 'text-success' : 'text-paper-faint'}`} />
          <div>
            <p className="text-sm font-semibold text-paper">{t('settingsPage.aiModel.enableAssistant')}</p>
            <p className="text-xs text-paper-muted">{t('settingsPage.aiModel.enableAssistantDesc')}</p>
          </div>
        </div>
        <button
          onClick={() => setIsEnabled(!isEnabled)}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
            isEnabled ? 'bg-signal' : 'bg-edge-strong'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-void-surface rounded-full shadow transition-transform duration-200 motion-reduce:transition-none ${
              isEnabled ? 'translate-x-6' : ''
            }`}
          />
        </button>
      </div>

      {/* Provider Selection */}
      <div>
        <label className="block text-sm font-semibold text-paper-muted mb-3">{t('settingsPage.aiModel.selectProvider')}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PROVIDER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleProviderChange(opt.id)}
              className={`relative p-4 rounded-xl border-2 text-left transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
                provider === opt.id
                  ? 'border-signal bg-signal/10'
                  : 'border-edge hover:border-edge-strong bg-void-surface'
              }`}
            >
              {provider === opt.id && (
                <div className="absolute top-2 right-2">
                  <CheckCircle className="w-4 h-4 text-signal dark:text-signal-bright" />
                </div>
              )}
              <div className={`w-10 h-10 rounded-lg ${opt.gradient} flex items-center justify-center text-white text-lg font-bold mb-3`}>
                {opt.icon}
              </div>
              <p className="font-semibold text-paper text-sm">{opt.name}</p>
              <p className="text-xs text-paper-muted mt-1">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div>
 <label className="block text-sm font-semibold text-paper-muted mb-2">{t('settingsPage.aiModel.apiKey')}</label>
        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.api_key_masked || t('settingsPage.aiModel.apiKeyPlaceholder')}
            autoComplete="new-password"
            className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal pr-10"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-paper-faint hover:text-paper rounded transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        {config?.api_key_masked && !apiKey && (
          <p className="text-xs text-paper-faint mt-1">
            {t('settingsPage.aiModel.currentKeyHint', { key: config.api_key_masked })}
          </p>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <label className="block text-sm font-semibold text-paper-muted mb-2">{t('settingsPage.aiModel.model')}</label>
        {selectedProvider && selectedProvider.models.length > 0 ? (
          <select
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal appearance-none"
          >
            {selectedProvider.models.map((m) => (
              <option key={m} value={m} className="bg-void-surface">{m}</option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            placeholder={t('settingsPage.aiModel.modelPlaceholder')}
            className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          />
        )}
      </div>

      {/* Custom Provider: Base URL */}
      {provider === 'custom' && (
        <div>
          <label className="block text-sm font-semibold text-paper-muted mb-2">{t('settingsPage.aiModel.baseUrl')}</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.together.ai/v1"
            className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          />
          <p className="text-xs text-paper-faint mt-1">
            {t('settingsPage.aiModel.baseUrlHint')}
          </p>
        </div>
      )}

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-semibold text-paper-muted mb-2">{t('settingsPage.aiModel.systemPrompt')}</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={t('settingsPage.aiModel.systemPromptPlaceholder')}
          rows={4}
          className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal resize-y"
        />
        <p className="text-xs text-paper-faint mt-1">
          {t('settingsPage.aiModel.systemPromptHint')}
        </p>
      </div>

      {/* Advanced Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-paper-muted mb-2">
            {t('settingsPage.aiModel.temperature', { value: temperature.toFixed(1) })}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          />
          <div className="flex justify-between text-xs text-paper-faint mt-1">
            <span>{t('settingsPage.aiModel.temperaturePrecise')}</span>
            <span>{t('settingsPage.aiModel.temperatureCreative')}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-paper-muted mb-2">{t('settingsPage.aiModel.maxTokens')}</label>
          <input
            type="number"
            min={128}
            max={16384}
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
            className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          />
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div className={`p-4 rounded-xl border ${
          testResult.success
            ? 'bg-success/10 border-success/25'
            : 'bg-destructive/10 border-destructive/25'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {testResult.success ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <span className={`text-sm font-semibold ${testResult.success ? 'text-success' : 'text-destructive'}`}>
              {testResult.message}
            </span>
          </div>
          {testResult.preview && (
            <p className="text-xs text-paper-muted mt-2 italic">
              {t('settingsPage.aiModel.aiReplied', { preview: testResult.preview })}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <Save className="w-4 h-4" />}
          {t('settings.saveConfig')}
        </button>
        <button
          onClick={handleTest}
          disabled={testing || (!apiKey && !config?.api_key_masked)}
          className="flex items-center gap-2 px-6 py-2.5 bg-void-surface hover:bg-void-raised text-paper border border-edge-strong rounded-xl font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <TestTube2 className="w-4 h-4" />}
          {t('settingsPage.aiModel.testConnection')}
        </button>
      </div>
    </div>
  );
}
