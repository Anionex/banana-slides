import { useEffect, useState } from 'react';
import { ArrowUpRight, Download, RefreshCw, Rocket } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { DESKTOP_TITLEBAR_HEIGHT, isDesktop } from '@/utils';
import type { DesktopUpdateCheckResult, DesktopUpdateElectronApi } from '@/types/desktopUpdate';
import { Button } from './Button';
import { Markdown } from './Markdown';
import { Modal } from './Modal';

const updateI18n = {
  zh: {
    title: '发现新版本',
    versionAvailable: 'Banana Slides v{{version}} 已发布',
    summary: '本次更新',
    changelog: '查看完整更新日志',
    updateNow: '立即更新',
    openDownload: '前往下载',
    later: '稍后更新',
    downloading: '正在下载更新',
    downloadProgress: '已下载 {{progress}}%',
    ready: '更新已下载完成',
    readyDescription: '重启 Banana Slides 即可完成安装。',
    restart: '重启并更新',
    restartLater: '稍后重启',
    failed: '更新失败，请重试',
  },
  en: {
    title: 'New version available',
    versionAvailable: 'Banana Slides v{{version}} is available',
    summary: "What's new",
    changelog: 'View full changelog',
    updateNow: 'Update now',
    openDownload: 'Open download page',
    later: 'Update later',
    downloading: 'Downloading update',
    downloadProgress: '{{progress}}% downloaded',
    ready: 'Update downloaded',
    readyDescription: 'Restart Banana Slides to finish installing the update.',
    restart: 'Restart to update',
    restartLater: 'Restart later',
    failed: 'Update failed. Try again.',
  },
};

export function UpdateChecker() {
  const [updateState, setUpdateState] = useState<DesktopUpdateCheckResult | null>(null);
  const [deferredVersion, setDeferredVersion] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState('');
  const t = useT(updateI18n);

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

  if (!isDesktop) return null;

  const update = updateState?.update;
  const isAutomaticPrompt = updateState?.checkSource === 'automatic';
  const isActionable = updateState?.status === 'update_available'
    || updateState?.status === 'downloading'
    || updateState?.status === 'update_downloaded'
    || updateState?.status === 'error';
  const isOpen = !!update
    && isAutomaticPrompt
    && isActionable
    && deferredVersion !== update.version;

  if (!update) return null;

  const electronApi = (window as typeof window & { electronAPI?: DesktopUpdateElectronApi }).electronAPI;
  const isDownloading = updateState?.status === 'downloading';
  const isDownloaded = updateState?.status === 'update_downloaded';
  const progress = Math.max(0, Math.min(100, updateState?.progress?.percent || 0));
  const releaseNotes = update.notes.trim();

  const handleLater = () => {
    setDeferredVersion(update.version);
    setActionError('');
  };

  const handleChangelog = async () => {
    try {
      await electronApi?.openExternal(update.url);
    } catch {
      setActionError(t('failed'));
    }
  };

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
        setDeferredVersion(update.version);
      }
    } catch {
      setActionError(t('failed'));
    } finally {
      setActionPending(false);
    }
  };

  const primaryLabel = isDownloaded
    ? t('restart')
    : updateState?.canAutoUpdate
      ? t('updateNow')
      : t('openDownload');

  return (
    <Modal isOpen={isOpen} onClose={handleLater} title={t('title')} size="md">
      <div className="space-y-5">
        <div className="flex items-start gap-4 rounded-2xl bg-banana-50 p-4 dark:bg-banana-950/20">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-banana-500 text-white shadow-sm">
            <Rocket size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 pt-0.5">
            <p className="text-base font-semibold text-gray-900 dark:text-foreground-primary">
              {isDownloaded ? t('ready') : t('versionAvailable', { version: update.version })}
            </p>
            {isDownloaded && (
              <p className="mt-1 text-sm text-gray-600 dark:text-foreground-secondary">
                {t('readyDescription')}
              </p>
            )}
          </div>
        </div>

        {releaseNotes && (
          <section aria-label={t('summary')} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-foreground-primary">
              {t('summary')}
            </h3>
            <div className="max-h-52 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-secondary">
              <Markdown>{releaseNotes}</Markdown>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={handleChangelog}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-banana-700 hover:text-banana-800 hover:underline dark:text-banana-300 dark:hover:text-banana-200"
        >
          {t('changelog')}
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>

        {isDownloading && (
          <div className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-foreground-secondary">
              <span>{t('downloading')}</span>
              <span>{t('downloadProgress', { progress: String(Math.round(progress)) })}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-banana-500 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {actionError && <p className="text-sm font-medium text-red-600 dark:text-red-400">{actionError}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="sm" onClick={handleLater}>
            {isDownloaded ? t('restartLater') : t('later')}
          </Button>
          {!isDownloading && (
            <Button
              size="sm"
              onClick={handlePrimaryAction}
              loading={actionPending}
              icon={isDownloaded ? <RefreshCw size={16} /> : <Download size={16} />}
            >
              {primaryLabel}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function getDesktopTopInset(): number {
  return DESKTOP_TITLEBAR_HEIGHT;
}
