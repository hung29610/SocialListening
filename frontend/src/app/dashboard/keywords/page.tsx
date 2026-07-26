'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Trash2, Search, ChevronDown, ChevronRight, Edit } from 'lucide-react';
import { keywords as keywordsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Keyword {
  id: number;
  keyword: string;
  keyword_type: string;
  is_active: boolean;
  created_at: string;
  group_id: number;
}

interface KeywordGroup {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  keyword_count: number;
  created_at: string;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';
const inputClass =
  'bg-void-surface border border-edge-strong text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal';

export default function KeywordsPage() {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupKeywords, setGroupKeywords] = useState<Record<number, Keyword[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddKeywordModal, setShowAddKeywordModal] = useState(false);
  const [showEditKeywordModal, setShowEditKeywordModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState<{ isOpen: boolean; groupId: number | null; groupName: string }>({
    isOpen: false,
    groupId: null,
    groupName: ''
  });
  const [deleteKeywordConfirm, setDeleteKeywordConfirm] = useState<{ isOpen: boolean; keywordId: number | null; keyword: string; groupId: number | null }>({
    isOpen: false,
    keywordId: null,
    keyword: '',
    groupId: null
  });

  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    priority: 3
  });

  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    keyword_type: 'general'
  });
  const [showBulkKeywordModal, setShowBulkKeywordModal] = useState(false);
  const [bulkKeyword, setBulkKeyword] = useState({
    keywords_text: '',
    keyword_type: 'general'
  });

  const KEYWORD_TYPES = [
    { value: 'general', labelKey: 'keywordsPage.type.general' },
    { value: 'brand', labelKey: 'keywordsPage.type.brand' },
    { value: 'competitor', labelKey: 'keywordsPage.type.competitor' },
    { value: 'person', labelKey: 'keywordsPage.type.person' },
    { value: 'service', labelKey: 'keywordsPage.type.service' },
    { value: 'location', labelKey: 'keywordsPage.type.location' },
    { value: 'hashtag', labelKey: 'keywordsPage.type.hashtag' },
    { value: 'negative_phrase', labelKey: 'keywordsPage.type.negativePhrase' },
    { value: 'positive_phrase', labelKey: 'keywordsPage.type.positivePhrase' },
  ];

  const keywordTypeLabel = (value: string) => {
    const match = KEYWORD_TYPES.find((kt) => kt.value === value);
    return match ? t(match.labelKey) : value;
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await keywordsApi.listGroups();
      setGroups(data);
      // Pre-fetch keywords for global search
      data.forEach((g: KeywordGroup) => {
        keywordsApi.listKeywordsInGroup(g.id).then((kws) => {
          setGroupKeywords(prev => ({ ...prev, [g.id]: kws }));
        }).catch(() => {});
      });
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      toast.error(t('keywordsPage.errors.loadGroupsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchKeywordsInGroup = async (groupId: number) => {
    try {
      const data = await keywordsApi.listKeywordsInGroup(groupId);
      setGroupKeywords(prev => ({ ...prev, [groupId]: data }));
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      toast.error(t('keywordsPage.errors.loadKeywordsFailed'));
    }
  };

  const toggleGroup = async (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      if (!groupKeywords[groupId]) {
        await fetchKeywordsInGroup(groupId);
      }
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      toast.error(t('keywordsPage.errors.groupNameRequired'));
      return;
    }

    try {
      await keywordsApi.createGroup({
        name: newGroup.name,
        description: newGroup.description || undefined,
        priority: newGroup.priority,
        is_active: true
      } as any);

      setShowAddGroupModal(false);
      setNewGroup({ name: '', description: '', priority: 3 });
      toast.success(t('keywords.addGroupOk'));
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding group:', error);
      toast.error(t('keywordsPage.errors.addGroupFailed'));
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim() || !selectedGroupId) {
      toast.error(t('keywordsPage.errors.keywordRequired'));
      return;
    }

    try {
      await keywordsApi.createKeyword({
        keyword: newKeyword.keyword,
        keyword_type: newKeyword.keyword_type,
        group_id: selectedGroupId,
        is_active: true,
      });

      setShowAddKeywordModal(false);
      setNewKeyword({ keyword: '', keyword_type: 'general' });
      toast.success(t('keywords.addKeywordOk'));

      await fetchKeywordsInGroup(selectedGroupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding keyword:', error);
      if (error.response?.status === 409) {
        toast(t('keywordsPage.errors.duplicateKeyword'), { icon: 'ℹ️' });
      } else {
        toast.error(error.response?.data?.detail || t('keywordsPage.errors.addKeywordFailed'));
      }
    }
  };

  const handleAddBulkKeyword = async () => {
    if (!bulkKeyword.keywords_text.trim() || !selectedGroupId) {
      toast.error(t('keywordsPage.errors.keywordRequired'));
      return;
    }
    const lines = bulkKeyword.keywords_text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast.error(t('keywordsPage.errors.atLeastOneKeyword'));
      return;
    }

    try {
      const result = await keywordsApi.createKeywordsBulk({
        group_id: selectedGroupId,
        keywords: lines,
        keyword_type: bulkKeyword.keyword_type,
        is_active: true
      });

      setShowBulkKeywordModal(false);
      setBulkKeyword({ keywords_text: '', keyword_type: 'general' });
      toast.success(t('keywordsPage.bulkAdded', { added: result.created_count, skipped: result.skipped_count }));
      await fetchKeywordsInGroup(selectedGroupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding bulk keywords:', error);
      toast.error(error.response?.data?.detail || t('keywordsPage.errors.addBulkFailed'));
    }
  };

  const handleEditKeyword = async () => {
    if (!selectedKeyword || !selectedKeyword.keyword.trim()) {
      toast.error(t('keywordsPage.errors.keywordRequired'));
      return;
    }

    try {
      await keywordsApi.updateKeyword(selectedKeyword.id, {
        keyword: selectedKeyword.keyword,
        keyword_type: selectedKeyword.keyword_type,
        is_active: selectedKeyword.is_active,
      });

      setShowEditKeywordModal(false);
      setSelectedKeyword(null);
      toast.success(t('keywordsPage.updateKeywordOk'));

      await fetchKeywordsInGroup(selectedKeyword.group_id);
      fetchGroups();
    } catch (error: any) {
      console.error('Error updating keyword:', error);
      toast.error(t('keywordsPage.errors.updateKeywordFailed'));
    }
  };

  const openEditKeywordModal = (keyword: Keyword) => {
    setSelectedKeyword({ ...keyword });
    setShowEditKeywordModal(true);
  };

  const handleDeleteKeyword = async () => {
    if (!deleteKeywordConfirm.keywordId || !deleteKeywordConfirm.groupId) return;

    try {
      await keywordsApi.deleteKeyword(deleteKeywordConfirm.keywordId);
      toast.success(t('keywords.deleteKeywordOk'));

      await fetchKeywordsInGroup(deleteKeywordConfirm.groupId);
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting keyword:', error);
      toast.error(t('keywordsPage.errors.deleteKeywordFailed'));
    }
  };

  const handleToggleKeywordActive = async (keyword: Keyword) => {
    try {
      await keywordsApi.updateKeyword(keyword.id, {
        is_active: !keyword.is_active
      });

      await fetchKeywordsInGroup(keyword.group_id);
    } catch (error: any) {
      console.error('Error toggling keyword:', error);
      toast.error(t('keywordsPage.errors.updateKeywordFailed'));
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupConfirm.groupId) return;

    try {
      await keywordsApi.deleteGroup(deleteGroupConfirm.groupId);
      toast.success(t('keywords.deleteGroupOk'));
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting group:', error);
      toast.error(t('keywordsPage.errors.deleteGroupFailed'));
    }
  };

  const openAddKeywordModal = (groupId: number) => {
    setSelectedGroupId(groupId);
    setShowAddKeywordModal(true);
  };

  const openBulkKeywordModal = (groupId: number) => {
    setSelectedGroupId(groupId);
    setShowBulkKeywordModal(true);
  };

  const filteredGroups = groups.filter(g => {
    const term = searchTerm.toLowerCase();
    if (g.name.toLowerCase().includes(term)) return true;
    if (groupKeywords[g.id]) {
      return groupKeywords[g.id].some(k => k.keyword.toLowerCase().includes(term));
    }
    return false;
  });

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-destructive/10 text-destructive';
    if (priority >= 3) return 'bg-warning/10 text-warning';
    return 'bg-sentiment-neutral/10 text-sentiment-neutral';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 4) return t('keywordsPage.priority.high');
    if (priority >= 3) return t('keywordsPage.priority.medium');
    return t('keywordsPage.priority.low');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">{t('keywordsPage.title')}</h1>
          <p className="text-sm text-paper-muted mt-1">
            {t('keywordsPage.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowAddGroupModal(true)}
          className={`flex items-center px-4 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium ${focusRingOffset}`}
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('keywordsPage.addGroup')}
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-paper-faint w-5 h-5" />
        <input
          type="text"
          placeholder={t('keywords.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full pl-11 pr-4 py-3 rounded-xl ${inputClass}`}
        />
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-void-surface border border-edge rounded-xl p-10 text-center text-paper-muted font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-void-raised flex items-center justify-center mx-auto mb-4 border border-edge">
              <Search className="w-8 h-8 text-paper-faint" />
            </div>
            {searchTerm ? t('keywordsPage.noSearchResults') : t('keywordsPage.emptyGroups')}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className="bg-void-surface rounded-xl border border-edge overflow-hidden">
              {/* Group Header */}
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-edge bg-void-raised">
                <div className="flex items-start sm:items-center space-x-4 flex-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className={`p-1 mt-1 sm:mt-0 bg-void-surface border border-edge-strong rounded-lg text-paper-muted hover:text-paper hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                  >
                    {expandedGroups.has(group.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-paper tracking-wide truncate">{group.name}</h3>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold tracking-eyebrow uppercase rounded-md border ${
                        group.priority >= 4 ? 'bg-destructive/10 text-destructive border-destructive/25' :
                        group.priority >= 3 ? 'bg-warning/10 text-warning border-warning/25' :
                        'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25'
                      }`}>
                        {getPriorityText(group.priority)}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold tracking-eyebrow uppercase rounded-md border ${
                        group.is_active ? 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25' : 'bg-void-raised text-paper-faint border-edge'
                      }`}>
                        {group.is_active ? t('common.active') : t('keywordsPage.inactive')}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-paper-muted mt-1.5 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  <div className="hidden sm:flex flex-col items-end text-sm text-paper-muted">
                    <div className="font-semibold text-paper tabular-nums bg-void-surface px-3 py-1 rounded-lg border border-edge">
                      {group.keyword_count} <span className="font-normal text-paper-muted ml-1">{t('keywordsPage.keywordsUnit')}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pl-12 lg:pl-0">
                  <button
                    onClick={() => openBulkKeywordModal(group.id)}
                    className={`flex-1 lg:flex-none px-3 py-1.5 text-xs font-medium bg-void-surface text-paper border border-edge-strong rounded-lg hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap ${focusRing}`}
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    {t('keywordsPage.addMany')}
                  </button>
                  <button
                    onClick={() => openAddKeywordModal(group.id)}
                    className={`flex-1 lg:flex-none px-3 py-1.5 text-xs font-medium bg-signal/10 text-signal dark:text-signal-bright border border-signal/25 rounded-lg hover:bg-signal/20 transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap ${focusRing}`}
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    {t('keywordsPage.addOne')}
                  </button>
                  <button
                    onClick={() => setDeleteGroupConfirm({ isOpen: true, groupId: group.id, groupName: group.name })}
                    className={`p-1.5 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-destructive/20 ${focusRing}`}
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Keywords List */}
              {expandedGroups.has(group.id) && (
                <div className="p-0 sm:p-2 bg-void-raised">
                  {!groupKeywords[group.id] ? (
                    <div className="text-center text-paper-faint py-8 text-sm">{t('keywordsPage.loadingKeywords')}</div>
                  ) : groupKeywords[group.id].length === 0 ? (
                    <div className="text-center text-paper-faint py-8 text-sm">
                      {t('keywordsPage.emptyKeywords')}
                    </div>
                  ) : (
                    <div className="divide-y divide-edge">
                      {groupKeywords[group.id].map((keyword) => (
                        <div
                          key={keyword.id}
                          className="flex items-center justify-between p-3 sm:px-5 hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none group"
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-medium text-paper">{keyword.keyword}</span>
                            <span className="text-[10px] font-semibold tracking-eyebrow uppercase text-paper-muted px-2 py-0.5 bg-void-raised rounded-md border border-edge">
                              {keywordTypeLabel(keyword.keyword_type)}
                            </span>
                            {keyword.created_at && (
                              <span className="text-xs text-paper-faint font-medium hidden sm:inline-block">
                                {new Date(keyword.created_at).toLocaleDateString('vi-VN')}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2 opacity-100 sm:opacity-50 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none">
                            <button
                              onClick={() => openEditKeywordModal(keyword)}
                              className={`p-1.5 text-paper-muted hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                              title={t('common.update')}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleKeywordActive(keyword)}
                              className={`px-2 py-1 text-[10px] font-semibold tracking-eyebrow rounded border transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
                                keyword.is_active
                                  ? 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25 hover:bg-signal/20'
                                  : 'bg-void-raised text-paper-faint border-edge hover:text-paper-muted'
                              }`}
                            >
                              {keyword.is_active ? 'ON' : 'OFF'}
                            </button>
                            <button
                              onClick={() => setDeleteKeywordConfirm({ isOpen: true, keywordId: keyword.id, keyword: keyword.keyword, groupId: group.id })}
                              className={`p-1.5 text-paper-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                              title={t('common.delete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-edge bg-void-raised">
              <h2 className="text-xl font-bold text-paper">{t('keywordsPage.addGroupModal.title')}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.addGroupModal.nameLabel')}
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                  placeholder={t('keywordsPage.addGroupModal.namePlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.addGroupModal.descriptionLabel')}
                </label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                  placeholder={t('keywordsPage.addGroupModal.descriptionPlaceholder')}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.addGroupModal.priorityLabel')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newGroup.priority}
                  onChange={(e) => setNewGroup({ ...newGroup, priority: parseInt(e.target.value) })}
                  className={`w-full px-4 py-2.5 rounded-xl tabular-nums ${inputClass}`}
                />
              </div>
            </div>

            <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
              <button
                onClick={() => setShowAddGroupModal(false)}
                className={`px-5 py-2.5 text-sm font-medium text-paper bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddGroup}
                className={`px-5 py-2.5 text-sm font-medium text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
              >
                {t('keywordsPage.addGroupModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteGroupConfirm.isOpen}
        onClose={() => setDeleteGroupConfirm({ isOpen: false, groupId: null, groupName: '' })}
        onConfirm={handleDeleteGroup}
        title={t('keywords.deleteGroupTitle')}
        message={t('keywordsPage.deleteGroupMessage', { name: deleteGroupConfirm.groupName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Delete Keyword Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteKeywordConfirm.isOpen}
        onClose={() => setDeleteKeywordConfirm({ isOpen: false, keywordId: null, keyword: '', groupId: null })}
        onConfirm={handleDeleteKeyword}
        title={t('common.delete')}
        message={t('keywordsPage.deleteKeywordMessage', { keyword: deleteKeywordConfirm.keyword })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        type="danger"
      />

      {/* Add Keyword Modal */}
      {showAddKeywordModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-edge bg-void-raised">
              <h2 className="text-xl font-bold text-paper">{t('keywordsPage.addKeywordModal.title')}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.keywordLabel')}
                </label>
                <input
                  type="text"
                  value={newKeyword.keyword}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                  placeholder={t('keywordsPage.keywordPlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.keywordTypeLabel')}
                </label>
                <select
                  value={newKeyword.keyword_type}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword_type: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                >
                  <option value="" disabled className="text-paper-faint">{t('keywordsPage.selectType')}</option>
                  {KEYWORD_TYPES.map(kt => (
                    <option key={kt.value} value={kt.value}>{t(kt.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
              <button
                onClick={() => setShowAddKeywordModal(false)}
                className={`px-5 py-2.5 text-sm font-medium text-paper bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddKeyword}
                className={`px-5 py-2.5 text-sm font-medium text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
              >
                {t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Keyword Modal */}
      {showBulkKeywordModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-edge bg-void-raised">
              <h2 className="text-xl font-bold text-paper">{t('keywordsPage.bulkModal.title')}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.bulkModal.listLabel')}
                </label>
                <textarea
                  value={bulkKeyword.keywords_text}
                  onChange={(e) => setBulkKeyword({ ...bulkKeyword, keywords_text: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl custom-scrollbar ${inputClass}`}
                  placeholder={t('keywordsPage.bulkModal.listPlaceholder')}
                  rows={6}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.bulkModal.sharedTypeLabel')}
                </label>
                <select
                  value={bulkKeyword.keyword_type}
                  onChange={(e) => setBulkKeyword({ ...bulkKeyword, keyword_type: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                >
                  <option value="" disabled className="text-paper-faint">{t('keywordsPage.selectType')}</option>
                  {KEYWORD_TYPES.map(kt => (
                    <option key={kt.value} value={kt.value}>{t(kt.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
              <button
                onClick={() => setShowBulkKeywordModal(false)}
                className={`px-5 py-2.5 text-sm font-medium text-paper bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddBulkKeyword}
                className={`px-5 py-2.5 text-sm font-medium text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
              >
                {t('keywordsPage.bulkModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Keyword Modal */}
      {showEditKeywordModal && selectedKeyword && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-edge bg-void-raised">
              <h2 className="text-xl font-bold text-paper">{t('keywordsPage.editKeywordModal.title')}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.keywordLabel')}
                </label>
                <input
                  type="text"
                  value={selectedKeyword.keyword}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, keyword: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                  placeholder={t('keywordsPage.keywordPlaceholder')}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('keywordsPage.keywordTypeLabel')}
                </label>
                <select
                  value={selectedKeyword.keyword_type}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, keyword_type: e.target.value })}
                  className={`w-full px-4 py-2.5 rounded-xl ${inputClass}`}
                >
                  <option value="" disabled className="text-paper-faint">{t('keywordsPage.selectType')}</option>
                  {KEYWORD_TYPES.map(kt => (
                    <option key={kt.value} value={kt.value}>{t(kt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center mt-2 p-3 bg-void-raised border border-edge-strong rounded-xl">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={selectedKeyword.is_active}
                  onChange={(e) => setSelectedKeyword({ ...selectedKeyword, is_active: e.target.checked })}
                  className={`w-4 h-4 accent-signal bg-void-surface border-edge-strong rounded ${focusRing}`}
                />
                <label htmlFor="edit_is_active" className="ml-3 text-sm font-medium text-paper-muted cursor-pointer select-none">
                  {t('keywordsPage.editKeywordModal.activeLabel')}
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowEditKeywordModal(false);
                  setSelectedKeyword(null);
                }}
                className={`px-5 py-2.5 text-sm font-medium text-paper bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleEditKeyword}
                className={`px-5 py-2.5 text-sm font-medium text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
              >
                {t('common.update')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
