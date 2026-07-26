'use client';

import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, RefreshCcw, Save, Tag, Search } from 'lucide-react';
import { keywords as keywordsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';

interface KeywordGroup {
  id: number;
  name: string;
  description?: string;
  keywords?: Keyword[];
}

interface Keyword {
  id: number;
  keyword: string;
  is_active: boolean;
  keyword_type: string;
}

export default function ProjectSettingsPage() {
  const { activeProject, projects } = useProject();
  const { t } = useLanguage();
  const { confirm } = useDialog();
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [newKeywords, setNewKeywords] = useState<Record<number, string>>({});
  const [addingGroup, setAddingGroup] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

  useEffect(() => {
    fetchGroups();
  }, [activeProject?.id]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const groupList: KeywordGroup[] = await keywordsApi.listGroups();
      // Load keywords for each group
      const withKeywords = await Promise.all(
        groupList.map(async (g) => {
          try {
            const kws = await keywordsApi.listKeywordsInGroup(g.id);
            return { ...g, keywords: kws };
          } catch {
            return { ...g, keywords: [] };
          }
        })
      );
      setGroups(withKeywords);
    } catch {
      toast.error(t('settingsPage.projectSettings.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) { toast.error(t('settingsPage.projectSettings.errors.groupNameRequired')); return; }
    try {
      setAddingGroup(true);
      await keywordsApi.createGroup({ name });
      setNewGroupName('');
      toast.success(t('settingsPage.projectSettings.groupCreated', { name }));
      fetchGroups();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('settingsPage.projectSettings.errors.createGroupFailed'));
    } finally {
      setAddingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    const ok = await confirm({
      title: t('keywords.deleteGroupTitle'),
      message: t('settingsPage.projectSettings.deleteGroupMessage', { name: groupName }),
      confirmText: t('settingsPage.projectSettings.deleteGroup'),
      cancelText: t('common.cancel'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await keywordsApi.deleteGroup(groupId);
      toast.success(t('keywords.deleteGroupOk'));
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('settingsPage.projectSettings.errors.deleteGroupFailed'));
    }
  };

  const handleAddKeyword = async (groupId: number) => {
    const rawInput = (newKeywords[groupId] || '').trim();
    if (!rawInput) { toast.error(t('settingsPage.projectSettings.errors.keywordRequired')); return; }
    const kwList = rawInput.split(',').map(k => k.trim()).filter(Boolean);
    if (kwList.length === 0) { toast.error(t('settingsPage.projectSettings.errors.noValidKeyword')); return; }
    try {
      if (kwList.length === 1) {
        await keywordsApi.createKeyword({ group_id: groupId, keyword: kwList[0] });
      } else {
        await keywordsApi.createKeywordsBulk({ group_id: groupId, keywords: kwList });
      }
      setNewKeywords({ ...newKeywords, [groupId]: '' });
      toast.success(t('settingsPage.projectSettings.keywordsAdded', { count: kwList.length }));
      fetchGroups();
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      if (detail.toLowerCase().includes('duplicate') || detail.toLowerCase().includes('already exists')) {
        toast.error(t('settingsPage.projectSettings.errors.duplicateKeyword'));
      } else {
        toast.error(detail || t('settingsPage.projectSettings.errors.addKeywordFailed'));
      }
    }
  };

  const handleDeleteKeyword = async (keywordId: number, keyword: string) => {
    try {
      await keywordsApi.deleteKeyword(keywordId);
      toast.success(t('settingsPage.projectSettings.keywordDeleted', { keyword }));
      fetchGroups();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('settingsPage.projectSettings.errors.deleteKeywordFailed'));
    }
  };

  const handleToggleKeyword = async (kw: Keyword) => {
    try {
      await keywordsApi.updateKeyword(kw.id, { is_active: !kw.is_active });
      fetchGroups();
    } catch {
      toast.error(t('settingsPage.projectSettings.errors.toggleKeywordFailed'));
    }
  };

  return (
    <div className="space-y-6 max-w-[1000px] mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-500" />
          {t('nav.projectSettings')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          {activeProject
            ? t('settingsPage.projectSettings.subtitleForProject', { project: activeProject.name })
            : t('settingsPage.projectSettings.subtitle')}
        </p>
      </div>

      {/* Keyword Groups */}
      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" />
            {t('settingsPage.projectSettings.groupsTitle')}
          </h2>
          <button
            onClick={fetchGroups}
            disabled={loading}
            className="text-slate-500 dark:text-gray-400 hover:text-indigo-500 transition-colors"
            title={t('settingsPage.projectSettings.refresh')}
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Add Group */}
        <div className="flex gap-3 mb-6 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
          <input
            type="text"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddGroup()}
            placeholder={t('settingsPage.projectSettings.newGroupPlaceholder')}
            className="flex-1 bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleAddGroup}
            disabled={addingGroup}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            {addingGroup ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {t('settingsPage.projectSettings.createGroup')}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2" />
            {t('common.loading')}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8">
            <Tag className="w-10 h-10 text-slate-700 dark:text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-gray-400 text-sm">{t('settingsPage.projectSettings.emptyGroups')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Tag className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-slate-900 dark:text-white">{group.name}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                      {t('settingsPage.projectSettings.keywordCount', { count: (group.keywords || []).length })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id, group.name); }}
                      className="p-1 text-slate-500 dark:text-gray-400 hover:text-red-500 transition-colors"
                      title={t('settingsPage.projectSettings.deleteGroup')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-slate-500 dark:text-gray-400 text-xs">{expandedGroup === group.id ? '▲' : '▼'}</span>
                  </div>
                </button>

                {expandedGroup === group.id && (
                  <div className="p-4 space-y-3">
                    {/* Add keyword */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newKeywords[group.id] || ''}
                        onChange={e => setNewKeywords({ ...newKeywords, [group.id]: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleAddKeyword(group.id)}
                        placeholder={t('settingsPage.projectSettings.keywordsPlaceholder')}
                        className="flex-1 bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => handleAddKeyword(group.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('common.add')}
                      </button>
                    </div>

                    {/* Keywords list */}
                    {(group.keywords || []).length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-gray-400 text-center py-2">{t('settingsPage.projectSettings.emptyKeywords')}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(group.keywords || []).map((kw) => (
                          <div
                            key={kw.id}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                              kw.is_active
                                ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                                : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-500 opacity-60'
                            }`}
                          >
                            <span
                              className="cursor-pointer hover:opacity-70"
                              onClick={() => handleToggleKeyword(kw)}
                              title={kw.is_active ? t('settingsPage.projectSettings.clickToDisable') : t('settingsPage.projectSettings.clickToEnable')}
                            >
                              {kw.keyword}
                            </span>
                            <button
                              onClick={() => handleDeleteKeyword(kw.id, kw.keyword)}
                              className="ml-1 text-slate-500 dark:text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
