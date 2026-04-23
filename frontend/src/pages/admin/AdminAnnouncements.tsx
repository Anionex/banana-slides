/**
 * Admin Announcements Management Page
 */
import { useEffect, useState } from 'react';
import { useT } from '../../hooks/useT';
import { getAdminAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement } from '../../api/adminApi';
import type { Announcement } from '../../api/announcements';

const i18n = {
  zh: {
    title: '公告管理',
    create: '发布公告',
    edit: '编辑',
    delete: '删除',
    confirmDelete: '确认删除此公告？',
    titleLabel: '标题',
    contentLabel: '内容',
    active: '已发布',
    inactive: '已下线',
    toggleOn: '上线',
    toggleOff: '下线',
    save: '保存',
    cancel: '取消',
    noData: '暂无公告',
    loading: '加载中...',
    error: '加载失败',
    titlePlaceholder: '请输入公告标题',
    contentPlaceholder: '请输入公告内容（支持纯文本）',
  },
  en: {
    title: 'Announcements',
    create: 'New Announcement',
    edit: 'Edit',
    delete: 'Delete',
    confirmDelete: 'Delete this announcement?',
    titleLabel: 'Title',
    contentLabel: 'Content',
    active: 'Active',
    inactive: 'Inactive',
    toggleOn: 'Activate',
    toggleOff: 'Deactivate',
    save: 'Save',
    cancel: 'Cancel',
    noData: 'No announcements yet',
    loading: 'Loading...',
    error: 'Failed to load',
    titlePlaceholder: 'Enter announcement title',
    contentPlaceholder: 'Enter announcement content (plain text)',
  },
};

export default function AdminAnnouncements() {
  const t = useT(i18n);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  const load = async () => {
    try {
      setLoading(true);
      const res = await getAdminAnnouncements({ limit: 200 });
      setItems(res.data.data.items);
    } catch (err) { console.error('Failed to load announcements:', err); } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    await createAnnouncement({ title: form.title, content: form.content });
    setCreating(false);
    setForm({ title: '', content: '' });
    load();
  };

  const handleUpdate = async () => {
    if (!editing || !form.title.trim() || !form.content.trim()) return;
    await updateAnnouncement(editing.id, { title: form.title, content: form.content });
    setEditing(null);
    setForm({ title: '', content: '' });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;
    await deleteAnnouncement(id);
    load();
  };

  const handleToggle = async (item: Announcement) => {
    await updateAnnouncement(item.id, { is_active: !item.is_active });
    load();
  };

  const startEdit = (item: Announcement) => {
    setEditing(item);
    setCreating(false);
    setForm({ title: item.title, content: item.content });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: '', content: '' });
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
    setForm({ title: '', content: '' });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 dark:text-foreground-secondary">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('title')}</h1>
        <button onClick={startCreate} className="px-4 py-2 bg-banana-500 text-white rounded-lg hover:bg-banana-600 text-sm font-medium">
          {t('create')}
        </button>
      </div>

      {/* Create / Edit Form */}
        {(creating || editing) && (
          <div className="mb-6 p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('titleLabel')}</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder={t('titlePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-primary text-gray-900 dark:text-foreground-primary focus:ring-2 focus:ring-banana-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-1">{t('contentLabel')}</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={t('contentPlaceholder')}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-background-primary text-gray-900 dark:text-foreground-primary focus:ring-2 focus:ring-banana-500 focus:border-transparent resize-y"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={editing ? handleUpdate : handleCreate} className="px-4 py-2 bg-banana-500 text-white rounded-lg hover:bg-banana-600 text-sm font-medium">
                  {t('save')}
                </button>
                <button onClick={cancelForm} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-foreground-secondary rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium">
                  {t('cancel')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        {items.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-foreground-secondary py-12">{t('noData')}</p>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-foreground-primary truncate">{item.title}</h3>
                      <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${item.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {item.is_active ? t('active') : t('inactive')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-foreground-secondary whitespace-pre-wrap">{item.content}</p>
                    <p className="text-xs text-gray-400 dark:text-foreground-tertiary mt-2">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleToggle(item)} className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover">
                      {item.is_active ? t('toggleOff') : t('toggleOn')}
                    </button>
                    <button onClick={() => startEdit(item)} className="px-3 py-1.5 text-xs rounded-lg border border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10">
                      {t('edit')}
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="px-3 py-1.5 text-xs rounded-lg border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10">
                      {t('delete')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
