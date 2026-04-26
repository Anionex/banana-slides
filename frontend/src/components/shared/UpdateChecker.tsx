import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { isDesktop } from '@/utils';

interface UpdateInfo {
  version: string;
  notes: string;
  url: string;
}

const updateI18n = {
  zh: { newVersion: '新版本', available: '可用', download: '前往下载' },
  en: { newVersion: 'New version', available: 'available', download: 'Download' },
};

export function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const t = useT(updateI18n);

  useEffect(() => {
    if (!isDesktop) return;

    const timer = setTimeout(async () => {
      try {
        const result = await (window as any).electronAPI.checkForUpdates();
        if (result) setUpdate(result);
      } catch {
        // silently ignore update check failures
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  if (!isDesktop || !update || dismissed) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center justify-center px-4 py-1.5"
      style={{
        top: 34,
        background: 'linear-gradient(135deg, #FFF8E1, #FFE082)',
        borderBottom: '1px solid rgba(255, 183, 77, 0.3)',
      }}
    >
      <div className="flex items-center gap-3 text-sm text-amber-900">
        <span className="font-medium">
          {t('newVersion')} v{update.version} {t('available')}
        </span>
        <button
          onClick={() => (window as any).electronAPI.openExternal(update.url)}
          className="px-3 py-1 rounded-full text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
          // @ts-expect-error -- WebkitAppRegion is a non-standard Electron CSS property
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          {t('download')}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-amber-200/50 transition-colors"
          // @ts-expect-error -- WebkitAppRegion is a non-standard Electron CSS property
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <X size={14} className="text-amber-700" />
        </button>
      </div>
    </div>
  );
}
