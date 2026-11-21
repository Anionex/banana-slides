import { act } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils', async () => {
  const actual = await vi.importActual<typeof import('@/utils')>('@/utils');
  return { ...actual, isDesktop: true };
});

vi.mock('@/utils/appVersion', () => ({
  appVersion: {
    display: 'v0.9.0-rc.3',
    detail: 'v0.9.0-rc.3',
  },
}));

const backendCheckForUpdates = vi.fn();

vi.mock('@/api/endpoints', () => ({
  checkForUpdates: () => backendCheckForUpdates(),
}));

import { SettingsAbout } from '@/pages/Settings';

const labels: Record<string, string> = {
  'settings.sections.about': '关于',
  'settings.about.version': '当前版本',
  'settings.about.source': 'GitHub 项目',
  'settings.about.automaticUpdates': '自动检查更新',
  'settings.about.automaticUpdatesDesc': '自动检查，由用户决定是否更新',
  'settings.about.automaticUpdateChecks': '自动检查更新',
  'settings.about.automaticUpdateChecksDesc': '自动提醒，手动下载',
  'settings.about.automaticUpdatesSaveFailed': '自动更新设置保存失败',
  'settings.about.checkUpdate': '检查更新',
  'settings.about.checking': '检查中...',
  'settings.about.upToDate': '您当前已是最新版本',
  'settings.about.updateAvailable': '有版本更新：{{version}}',
  'settings.about.updateDownloading': '正在下载版本 {{version}}（{{progress}}%）',
  'settings.about.updateReady': '版本 {{version}} 已下载，重启后完成更新',
  'settings.about.unknown': '无法判断当前是否为最新版本',
  'settings.about.failed': '检查更新失败',
  'settings.about.resultTitle': '检查更新结果',
  'settings.about.download': '立即更新',
  'settings.about.fallbackDownload': '前往下载',
  'settings.about.restart': '重启并更新',
  'settings.about.summary': '本次更新',
  'settings.about.changelog': '查看完整更新日志',
  'settings.about.later': '稍后更新',
  'settings.about.close': '关闭',
};

const t = (key: string, vars?: Record<string, string>) => {
  let value = labels[key] || key;
  Object.entries(vars || {}).forEach(([varKey, varValue]) => {
    value = value.replace(`{{${varKey}}}`, varValue);
  });
  return value;
};

describe('SettingsAbout desktop update checks', () => {
  const checkForUpdates = vi.fn();
  const openExternal = vi.fn();
  const getAutoUpdateSettings = vi.fn();
  const setAutomaticUpdatesEnabled = vi.fn();
  const downloadUpdate = vi.fn();
  const installUpdate = vi.fn();
  const onUpdateStatus = vi.fn();

  beforeEach(() => {
    checkForUpdates.mockReset();
    openExternal.mockReset();
    getAutoUpdateSettings.mockReset().mockResolvedValue({ automaticUpdatesEnabled: true });
    setAutomaticUpdatesEnabled.mockReset();
    downloadUpdate.mockReset();
    installUpdate.mockReset();
    onUpdateStatus.mockReset().mockReturnValue(() => undefined);
    backendCheckForUpdates.mockReset();
    (window as any).electronAPI = {
      checkForUpdates,
      openExternal,
      getAutoUpdateSettings,
      setAutomaticUpdatesEnabled,
      downloadUpdate,
      installUpdate,
      onUpdateStatus,
    };
  });

  it('uses Electron release checks and opens the selected release', async () => {
    const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4';
    checkForUpdates.mockResolvedValueOnce({
      status: 'update_available',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      update: {
        version: '0.9.0-rc.4',
        notes: 'Release candidate fixes',
        url: releaseUrl,
      },
    });

    render(<SettingsAbout t={t} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('有版本更新：0.9.0-rc.4')).toBeInTheDocument();
    expect(within(dialog).getByText('本次更新')).toBeInTheDocument();
    expect(within(dialog).getByText('Release candidate fixes')).toBeInTheDocument();
    expect(within(dialog).queryByText('无法判断当前是否为最新版本')).not.toBeInTheDocument();
    expect(backendCheckForUpdates).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: '查看完整更新日志' }));
    expect(openExternal).toHaveBeenCalledWith(releaseUrl);
    await userEvent.click(within(dialog).getByRole('button', { name: '前往下载' }));
    expect(openExternal).toHaveBeenCalledWith(releaseUrl);
  });

  it('reports the desktop app as up to date without calling the backend checker', async () => {
    checkForUpdates.mockResolvedValueOnce({
      status: 'up_to_date',
      currentVersion: '0.9.0-rc.4',
      latestVersion: '0.9.0-rc.4',
      update: null,
    });

    render(<SettingsAbout t={t} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('您当前已是最新版本')).toBeInTheDocument();
    expect(within(dialog).getByTestId('update-success-icon')).toBeInTheDocument();
    expect(backendCheckForUpdates).not.toHaveBeenCalled();
  });

  it('persists the automatic update toggle', async () => {
    setAutomaticUpdatesEnabled.mockResolvedValueOnce({ automaticUpdatesEnabled: false });
    render(<SettingsAbout t={t} />);

    const toggle = await screen.findByRole('switch', { name: '自动检查更新' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);

    expect(setAutomaticUpdatesEnabled).toHaveBeenCalledWith(false);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('explains the manual-download fallback for an ad hoc signed macOS build', async () => {
    getAutoUpdateSettings.mockResolvedValueOnce({
      automaticUpdatesEnabled: true,
      canAutoUpdate: false,
    });

    render(<SettingsAbout t={t} />);

    expect(await screen.findByText('自动检查更新')).toBeInTheDocument();
    expect(screen.getByText('自动提醒，手动下载')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '自动检查更新' })).toHaveAttribute('aria-checked', 'true');
  });

  it('downloads and installs an update inside the desktop app', async () => {
    const releaseUrl = 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4';
    checkForUpdates.mockResolvedValueOnce({
      status: 'update_available',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      canAutoUpdate: true,
      update: {
        version: '0.9.0-rc.4',
        notes: 'Release candidate fixes',
        url: releaseUrl,
      },
    });
    downloadUpdate.mockResolvedValueOnce({
      status: 'update_downloaded',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      canAutoUpdate: true,
      update: {
        version: '0.9.0-rc.4',
        notes: 'Release candidate fixes',
        url: releaseUrl,
      },
    });
    installUpdate.mockResolvedValueOnce({ success: true });

    render(<SettingsAbout t={t} />);
    await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '立即更新' }));

    expect(downloadUpdate).toHaveBeenCalledOnce();
    expect(within(dialog).getByText('版本 0.9.0-rc.4 已下载，重启后完成更新')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '重启并更新' }));
    expect(installUpdate).toHaveBeenCalledOnce();
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('keeps the update action available after a download failure', async () => {
    const updateState = {
      status: 'update_available',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      canAutoUpdate: true,
      checkSource: 'manual',
      update: {
        version: '0.9.0-rc.4',
        notes: 'Release candidate fixes',
        url: 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4',
      },
    };
    let updateListener: ((state: typeof updateState & { error?: string }) => void) | undefined;
    onUpdateStatus.mockImplementation((listener) => {
      updateListener = listener;
      return () => undefined;
    });
    checkForUpdates.mockResolvedValueOnce(updateState);
    downloadUpdate.mockImplementationOnce(async () => {
      updateListener?.({ ...updateState, status: 'error', error: 'network unavailable' });
      throw new Error('network unavailable');
    });

    render(<SettingsAbout t={t} />);
    await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: '立即更新' }));

    expect(within(dialog).getByText('检查更新失败: network unavailable')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '立即更新' })).toBeInTheDocument();
  });

  it('clears a stale update action when the desktop updater reports no update', async () => {
    const updateState = {
      status: 'update_available',
      currentVersion: '0.9.0-rc.3',
      latestVersion: '0.9.0-rc.4',
      canAutoUpdate: true,
      checkSource: 'manual',
      update: {
        version: '0.9.0-rc.4',
        notes: 'Release candidate fixes',
        url: 'https://github.com/Anionex/banana-slides/releases/tag/v0.9.0-rc.4',
      },
    };
    let updateListener: ((state: any) => void) | undefined;
    onUpdateStatus.mockImplementation((listener) => {
      updateListener = listener;
      return () => undefined;
    });
    checkForUpdates.mockResolvedValueOnce(updateState);

    render(<SettingsAbout t={t} />);
    await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '立即更新' })).toBeInTheDocument();

    act(() => {
      updateListener?.({
        status: 'up_to_date',
        currentVersion: '0.9.0-rc.3',
        latestVersion: '0.9.0-rc.3',
        canAutoUpdate: true,
        checkSource: 'manual',
        update: null,
      });
    });

    expect(within(dialog).getByText('您当前已是最新版本')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '立即更新' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看完整更新日志' })).not.toBeInTheDocument();
  });

  it('shows network failures instead of claiming the app is current', async () => {
    checkForUpdates.mockRejectedValueOnce(new Error('GitHub API request timed out'));

    render(<SettingsAbout t={t} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('检查更新失败: GitHub API request timed out')).toBeInTheDocument();
    expect(within(dialog).queryByText('您当前已是最新版本')).not.toBeInTheDocument();
  });
});
