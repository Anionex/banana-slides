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
  'settings.about.checkUpdate': '检查更新',
  'settings.about.checking': '检查中...',
  'settings.about.upToDate': '您当前已是最新版本',
  'settings.about.updateAvailable': '有版本更新：{{version}}',
  'settings.about.unknown': '无法判断当前是否为最新版本',
  'settings.about.failed': '检查更新失败',
  'settings.about.resultTitle': '检查更新结果',
  'settings.about.download': '前往下载',
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

  beforeEach(() => {
    checkForUpdates.mockReset();
    openExternal.mockReset();
    backendCheckForUpdates.mockReset();
    (window as any).electronAPI = { checkForUpdates, openExternal };
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
    expect(within(dialog).queryByText('无法判断当前是否为最新版本')).not.toBeInTheDocument();
    expect(backendCheckForUpdates).not.toHaveBeenCalled();

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
