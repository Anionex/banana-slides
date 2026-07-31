import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectLoadState } from '@/components/shared/ProjectLoadState';
import { useProjectStore } from '@/store/useProjectStore';
import i18n from '@/i18n';

const originalSyncProject = useProjectStore.getState().syncProject;

describe('ProjectLoadState', () => {
  beforeEach(async () => {
    localStorage.setItem('i18nextLng', 'zh-CN');
    await i18n.changeLanguage('zh-CN');
    act(() => {
      useProjectStore.setState({
        projectLoad: { projectId: null, status: 'idle', error: null },
        syncProject: originalSyncProject,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useProjectStore.setState({ syncProject: originalSyncProject });
    });
  });

  it('shows the loading state until this project has a confirmed failure', () => {
    render(
      <MemoryRouter>
        <ProjectLoadState projectId="project-1" loadingMessage="加载项目中..." />
      </MemoryRouter>,
    );

    expect(screen.getByText('加载项目中...')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces the error and retries the same project', async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    act(() => {
      useProjectStore.setState({
        projectLoad: { projectId: 'project-1', status: 'error', error: '后端暂时不可用' },
        syncProject: retry,
      });
    });
    render(
      <MemoryRouter>
        <ProjectLoadState projectId="project-1" loadingMessage="加载项目中..." />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('后端暂时不可用');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith('project-1');
  });

  it('lets the user leave the failed route for the home page', async () => {
    act(() => {
      useProjectStore.setState({
        projectLoad: { projectId: 'project-1', status: 'error', error: 'Project not found' },
      });
    });
    render(
      <MemoryRouter initialEntries={['/project/project-1/outline']}>
        <Routes>
          <Route path="/project/:projectId/outline" element={<ProjectLoadState projectId="project-1" loadingMessage="Loading" />} />
          <Route path="/" element={<p>首页已打开</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: '返回首页' }));
    });
    expect(screen.getByText('首页已打开')).toBeInTheDocument();
  });
});
