/**
 * Announcements Page - view all announcements history
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../hooks/useT';
import { getActiveAnnouncements, type Announcement } from '../api/announcements';

const i18n = {
  zh: {
    title: '系统公告',
    back: '返回',
    noData: '暂无公告',
    loading: '加载中...',
  },
  en: {
    title: 'Announcements',
    back: 'Back',
    noData: 'No announcements',
    loading: 'Loading...',
  },
};

export default function AnnouncementsPage() {
  const t = useT(i18n);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveAnnouncements()
      .then(res => setItems(res.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background-primary">
      <header className="bg-white dark:bg-background-secondary border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center gap-4">
        <Link to="/app" className="text-gray-500 hover:text-gray-700 dark:text-foreground-secondary dark:hover:text-foreground-primary">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('title')}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <p className="text-center text-gray-500 dark:text-foreground-secondary py-12">{t('loading')}</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-foreground-secondary py-12">{t('noData')}</p>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-background-secondary shadow-sm">
                <h3 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-1">{item.title}</h3>
                <p className="text-xs text-gray-400 dark:text-foreground-tertiary mb-3">
                  {new Date(item.created_at).toLocaleString()}
                </p>
                <p className="text-sm text-gray-700 dark:text-foreground-secondary whitespace-pre-wrap">{item.content}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
