import { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { DESKTOP_TITLEBAR_HEIGHT, DESKTOP_UPDATE_BANNER_HEIGHT, isDesktop } from '@/utils';
import type { DesktopUpdateCheckResult, DesktopUpdateElectronApi } from '@/types/desktopUpdate';

const updateI18n = {
  zh: {
    newVersion: '新版本',
    available: '可用',
    download: '下载更新',
    downloading: '正在下载',
    ready: '更新已就绪',
    restart: '重启并更新',
    fallbackDownload: '前往下载',
    failed: '更新失败，请重试',
  },
  en: {
    newVersion: 'New version',
    available: 'available',
    download: 'Download update',
    downloading: 'Downloading',
    ready: 'Update ready',
    restart: 'Restart to update',
    fallbackDownload: 'Open download page',
    failed: 'Update failed. Try again.',
  },
};

interface UpdateCheckerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export function UpdateChecker({ onVisibilityChange }: UpdateCheckerProps) {
  const [updateState, setUpdateState] = useState<DesktopUpdateCheckResult | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const onVisibilityChangeRef = useRef(onVisibilityChange);
  const t = useT(updateI18n);
  const update = updateState?.update;
  const isActionable = updateState?.status === 'update_available'
    || updateState?.status === 'downloading'
    || updateState?.status === 'update_downloaded';
  const isVisible = isDesktop && !!update && isActionable && !dismissed;

  useEffect(() => {
    onVisibilityChangeRef.current = onVisibilityChange;
  });

  useEffect(() => {
    if (!isDesktop) return;
    const electronApi = (window as typeof window & { electronAPI?: DesktopUpdateElectronApi }).electronAPI;
    if (!electronApi) return;
    let disposed = false;
    const applyState = (state: DesktopUpdateCheckResult) => {
      if (!disposed) setUpdateState(state);
    };
    const unsubscribe = electronApi.onUpdateStatus?.(applyState);

    if (electronApi.getUpdateState) {
      electronApi.getUpdateState().then(applyState).catch(() => undefined);
    } else {
      const timer = window.setTimeout(() => {
        electronApi.checkForUpdates().then(applyState).catch(() => undefined);
      }, 5000);
      return () => {
        disposed = true;
        window.clearTimeout(timer);
        unsubscribe?.();
      };
    }

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setDismissed(false);
  }, [updateState?.status, update?.version]);

  useEffect(() => {
    onVisibilityChangeRef.current?.(isVisible);
  }, [isVisible]);

  if (!isVisible || !update || dismissed) return null;

  const electronApi = (window as typeof window & { electronAPI?: DesktopUpdateElectronApi }).electronAPI;
  const isDownloading = updateState?.status === 'downloading';
  const isDownloaded = updateState?.status === 'update_downloaded';
  const progress = Math.max(0, Math.min(100, updateState?.progress?.percent || 0));
  const label = isDownloaded
    ? `${t('ready')}: v${update.version}`
    : isDownloading
      ? `${t('downloading')} v${update.version} · ${Math.round(progress)}%`
      : `${t('newVersion')} v${update.version} ${t('available')}`;

  const handlePrimaryAction = async () => {
    if (!electronApi || actionPending || isDownloading) return;
    setActionPending(true);
    setActionError('');
    try {
      if (isDownloaded && electronApi.installUpdate) {
        const result = await electronApi.installUpdate();
        if (!result.success) throw new Error(result.error || 'UPDATE_INSTALL_FAILED');
      } else if (updateState?.canAutoUpdate && electronApi.downloadUpdate) {
        setUpdateState(await electronApi.downloadUpdate());
      } else {
        await electronApi.openExternal(update.url);
      }
    } catch {
      setActionError(t('failed'));
    } finally {
      setActionPending(false);
    }
  };

  const actionLabel = isDownloaded
    ? t('restart')
    : updateState?.canAutoUpdate
      ? t('download')
      : t('fallbackDownload');

  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center justify-center px-4 py-1.5"
      style={{
        top: DESKTOP_TITLEBAR_HEIGHT,
        background: 'linear-gradient(135deg, #FFF8E1, #FFE082)',
        borderBottom: '1px solid rgba(255, 183, 77, 0.3)',
        minHeight: DESKTOP_UPDATE_BANNER_HEIGHT,
      }}
    >
      <div className="flex items-center gap-3 text-sm text-amber-900">
        <span className="font-medium">
          {label}
        </span>
        {actionError && <span className="text-xs font-medium text-red-700">{actionError}</span>}
        {!isDownloading && (
          <button
            onClick={handlePrimaryAction}
            disabled={actionPending}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:cursor-wait disabled:opacity-70 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {actionPending ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
            {actionLabel}
          </button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notification"
          className="p-1 rounded-full hover:bg-amber-200/50 transition-colors"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <X size={14} className="text-amber-700" />
        </button>
      </div>
    </div>
  );
}

export function getDesktopTopInset(showingUpdateBanner: boolean): number {
  return DESKTOP_TITLEBAR_HEIGHT + (showingUpdateBanner ? DESKTOP_UPDATE_BANNER_HEIGHT : 0);
}
