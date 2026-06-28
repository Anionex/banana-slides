import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { SettingsAbout } from '@/pages/Settings';

vi.mock('@/utils/appVersion', () => ({
  appVersion: {
    display: 'v9.9.9',
    detail: 'v9.9.9 (abcdef1234567890)',
  },
}));

const checkForUpdates = vi.fn();

vi.mock('@/api/endpoints', () => ({
  checkForUpdates: () => checkForUpdates(),
}));

const labels: Record<string, string> = {
  'settings.sections.about': '关于',
  'settings.about.version': '当前版本',
  'settings.about.source': 'GitHub 项目',
  'settings.about.checkUpdate': '检查更新',
  'settings.about.checking': '检查中...',
  'settings.about.upToDate': '您当前已是最新版本',
  'settings.about.updateAvailable': '有版本更新：{{version}}',
  'settings.about.unknown': '无法判断当前是否为最新版本',
  'settings.about.resultTitle': '检查更新结果',
  'settings.about.close': '关闭',
};

const t = (key: string, vars?: Record<string, string>) => {
  let value = labels[key] || key;
  Object.entries(vars || {}).forEach(([varKey, varValue]) => {
    value = value.replace(`{{${varKey}}}`, varValue);
  });
  return value;
};

describe('SettingsAbout', () => {
  it('shows the current app version in settings', () => {
    render(<SettingsAbout t={t} />);

    expect(screen.getByText('关于')).toBeInTheDocument();
    expect(screen.getByText('当前版本: v9.9.9')).toBeInTheDocument();
    expect(screen.getByLabelText('当前版本 v9.9.9 (abcdef1234567890)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GitHub 项目' })).toHaveAttribute('href', 'https://github.com/Anionex/banana-slides');
  });

  it('shows a user-friendly message when an update is available', async () => {
    checkForUpdates.mockResolvedValueOnce({
      data: {
        status: 'update_available',
        update_available: true,
        message: 'A newer Docker image is available.',
        repository: 'anoinex/banana-slides',
        current: { short_sha: '1111111', is_docker: true },
        latest: {
          tag: 'latest',
          sha: '2222222333333333344444444444555555555555',
          image: 'anoinex/banana-slides:latest',
          last_updated: '2026-06-01T08:11:22Z',
        },
      },
    });

    render(<SettingsAbout t={t} />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('有版本更新：2222222')).toBeInTheDocument();
    expect(within(dialog).getByTestId('update-available-icon')).toBeInTheDocument();
    expect(within(dialog).getByText('检查更新结果')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Docker Hub/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/镜像/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/SHA/i)).not.toBeInTheDocument();
  });

  it('shows a green check when the app is up to date', async () => {
    render(<SettingsAbout t={t} />);

    checkForUpdates.mockResolvedValueOnce({
      data: {
        status: 'up_to_date',
        update_available: false,
        message: 'Current image is up to date.',
        repository: 'anoinex/banana-slides',
        current: { short_sha: '2222222', is_docker: true },
        latest: {
          tag: 'latest',
          sha: '2222222',
          image: 'anoinex/banana-slides:latest',
          last_updated: '2026-06-01T08:11:22Z',
        },
      },
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /检查更新/ }));
    });

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('您当前已是最新版本')).toBeInTheDocument();
    expect(within(dialog).getByTestId('update-success-icon')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Docker Hub/)).not.toBeInTheDocument();
  });
});
