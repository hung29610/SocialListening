'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Check, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

export default function RoleManagement() {
  const { t } = useLanguage();
  const { confirm } = useDialog();
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    display_name: '',
    description: '',
    permissions: [],
    is_active: true
  });

  useEffect(() => {
    loadRoles();
    loadAvailablePermissions();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/admin/roles/');
      setRoles(response.data);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error(t('settingsPage.roleManagement.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePermissions = async () => {
    try {
      const response = await api.get('/api/admin/roles/permissions/available');
      setAvailablePermissions(response.data);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: [],
      is_active: true
    });
    setShowModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions,
      is_active: role.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingRole
        ? `/api/admin/roles/${editingRole.id}`
        : '/api/admin/roles/';
      
      const payload = editingRole?.is_system
        ? { permissions: formData.permissions, is_active: formData.is_active }
        : formData;

      if (editingRole) {
        await api.put(url, payload);
      } else {
        await api.post(url, payload);
      }

      toast.success(editingRole
        ? t('settingsPage.roleManagement.updateSuccess')
        : t('settingsPage.roleManagement.createSuccess'));
      setShowModal(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.response?.data?.detail || error.message || t('settingsPage.roleManagement.errors.saveFailed'));
    }
  };

  const handleDelete = async (role: Role) => {
    const ok = await confirm({
      title: t('settingsPage.roleManagement.deleteTitle'),
      message: t('settingsPage.roleManagement.deleteMessage', { name: role.display_name }),
      variant: 'danger',
    });
    if (!ok) return;

    try {
      await api.delete(`/api/admin/roles/${role.id}`);
      toast.success(t('settingsPage.roleManagement.deleteSuccess'));
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.response?.data?.detail || error.message || t('settingsPage.roleManagement.errors.deleteFailed'));
    }
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-signal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-paper tracking-wide">{t('settingsPage.roleManagement.title')}</h2>
          <p className="text-sm text-paper-muted mt-1">{t('settingsPage.roleManagement.subtitle')}</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('settingsPage.roleManagement.addRole')}
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {roles.map((role) => (
          <div key={role.id} className={`bg-void-surface border border-edge rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow motion-reduce:transition-none ${!role.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl border ${role.is_system ? 'bg-void-raised border-edge-strong' : 'bg-signal/10 border-signal/25'}`}>
                  <Shield className={`w-6 h-6 ${role.is_system ? 'text-paper-muted' : 'text-signal dark:text-signal-bright'}`} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-paper tracking-wide">{role.display_name}</h3>
                  <p className="text-xs text-paper-muted font-mono mt-0.5">{role.name}</p>
                  {role.is_system && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-void-raised text-paper-muted border border-edge-strong rounded-md">
                      {t('settingsPage.roleManagement.systemBadge')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-1">
                <button
                  onClick={() => handleEdit(role)}
                  className="p-2 text-signal dark:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                  title={t('settingsPage.roleManagement.actions.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!role.is_system && (
                  <button
                    onClick={() => handleDelete(role)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title={t('common.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {role.description && (
              <p className="text-sm text-paper-muted mb-4">{role.description}</p>
            )}

            <div>
              <p className="text-xs font-medium text-paper-muted mb-2.5">{t('settingsPage.roleManagement.permissionsCount', { count: role.permissions.length })}</p>
              <div className="flex flex-wrap gap-2">
                {Array.isArray(role.permissions) && role.permissions.slice(0, 5).map((perm, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 text-xs bg-void-raised text-paper-muted border border-edge rounded-md"
                  >
                    {perm}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="px-2.5 py-1 text-xs bg-void-raised text-paper-faint border border-edge rounded-md tabular-nums">
                    {t('settingsPage.roleManagement.morePermissions', { count: role.permissions.length - 5 })}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-edge flex items-center justify-between">
              <h3 className="text-lg font-bold text-paper tracking-wide">
                {editingRole
                  ? t('settingsPage.roleManagement.editModalTitle', { name: editingRole.display_name })
                  : t('settingsPage.roleManagement.createModalTitle')}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {editingRole?.is_system && (
                <div className="bg-warning/10 border border-warning/25 rounded-xl p-4 text-sm text-paper-muted">
                  <strong className="text-warning">{t('settingsPage.roleManagement.noteLabel')}</strong> {t('settingsPage.roleManagement.systemRoleNote')}
                </div>
              )}

              {!editingRole?.is_system && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-2">
                      {t('settingsPage.roleManagement.form.code')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                      placeholder={t('settingsPage.roleManagement.form.codePlaceholder')}
                      required
                      disabled={!!editingRole}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-2">
                      {t('settingsPage.roleManagement.form.displayName')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                      placeholder={t('settingsPage.roleManagement.form.displayNamePlaceholder')}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.roleManagement.form.description')}</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                      rows={2}
                      placeholder={t('settingsPage.roleManagement.form.descriptionPlaceholder')}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('settingsPage.roleManagement.form.permissions')} <span className="text-destructive">*</span>
                </label>
                <div className="border border-edge bg-void-raised rounded-xl p-4 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-3">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center space-x-3 cursor-pointer hover:bg-paper/[0.04] p-2 rounded-lg transition-colors duration-150 motion-reduce:transition-none">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="w-4 h-4 rounded accent-signal bg-void-surface border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                        />
                        <span className="text-sm font-medium text-paper-muted">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-paper-muted mt-2 font-medium">
                  {t('settingsPage.roleManagement.form.selectedPrefix')} <span className="text-signal dark:text-signal-bright tabular-nums">{formData.permissions.length}</span> {t('settingsPage.roleManagement.form.selectedSuffix')}
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 rounded accent-signal bg-void-surface border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-paper-muted">
                  {t('settingsPage.roleManagement.form.isActive')}
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-6 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 bg-void-surface text-paper-muted border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {editingRole ? t('common.update') : t('settingsPage.roleManagement.form.submitCreate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-signal/10 border border-signal/25 rounded-xl p-4">
        <p className="text-sm text-paper-muted">
          <strong className="text-signal dark:text-signal-bright">{t('settingsPage.roleManagement.noteLabel')}</strong> {t('settingsPage.roleManagement.infoNote')}
        </p>
      </div>
    </div>
  );
}
