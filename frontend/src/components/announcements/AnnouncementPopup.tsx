/**
 * AnnouncementPopup - shows active announcements on login
 * Uses localStorage to track "don't remind again" per announcement
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useT } from '../../hooks/useT';
import { getActiveAnnouncements, type Announcement } from '../../api/announcements';
import { useAuthStore } from '../../store/useAuthStore';

const DISMISSED_KEY = 'dismissed_announcements';

const i18n = {
  zh: {
    dontRemind: '不再提醒',
    viewAll: '查看全部公告',
  },
  en: {
    dontRemind: "Don't remind again",
    viewAll: 'View all announcements',
  },
};

function getDismissedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function dismissId(id: string) {
  const ids = new Set(getDismissedIds());
  ids.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

export default function AnnouncementPopup() {
  const t = useT(i18n);
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<Announcement[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dontRemind, setDontRemind] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    getActiveAnnouncements().then(res => {
      const dismissed = getDismissedIds();
      const visible = (res.data.data || []).filter(a => !dismissed.includes(a.id));
      setItems(visible);
      setCurrentIdx(0);
    }).catch(() => {});
  }, [isAuthenticated]);

  if (items.length === 0) return null;

  const current = items[currentIdx];
  if (!current) return null;

  const handleClose = () => {
    if (dontRemind) {
      dismissId(current.id);
    }
    const next = items.filter((_, i) => i !== currentIdx);
    setItems(next);
    setCurrentIdx(0);
    setDontRemind(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-background-secondary rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
            {current.title}
          </h3>
          <p className="text-xs text-gray-400 dark:text-foreground-tertiary mt-1">
            {new Date(current.created_at).toLocaleString()}
          </p>
        </div>

        {/* Content */}
        <div className="px-5 py-3 max-h-60 overflow-y-auto">
          <p className="text-sm text-gray-700 dark:text-foreground-secondary whitespace-pre-wrap">
            {current.content}
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontRemind}
              onChange={e => setDontRemind(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-banana-500 focus:ring-banana-500"
            />
            <span className="text-xs text-gray-500 dark:text-foreground-tertiary">{t('dontRemind')}</span>
          </label>
          <div className="flex items-center gap-3">
            <Link
              to="/announcements"
              onClick={handleClose}
              className="text-xs text-banana-600 dark:text-banana-400 hover:underline"
            >
              {t('viewAll')}
            </Link>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-background-hover text-gray-500 dark:text-foreground-tertiary"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
