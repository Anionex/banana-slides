import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/store/useProjectStore';
import { getProject } from '@/api/endpoints';

vi.mock('@/api/endpoints', () => ({
  getProject: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useProjectStore project loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('i18nextLng', 'zh-CN');
    useProjectStore.setState({
      currentProject: null,
      error: null,
      projectLoad: { projectId: null, status: 'idle', error: null },
    });
  });

  it('moves from loading to success and stores the loaded project', async () => {
    vi.mocked(getProject).mockResolvedValue({
      data: { project_id: 'project-1', pages: [], status: 'DRAFT' },
    } as any);

    let request!: Promise<void>;
    act(() => {
      request = useProjectStore.getState().syncProject('project-1');
    });
    expect(useProjectStore.getState().projectLoad).toEqual({
      projectId: 'project-1', status: 'loading', error: null,
    });

    await act(async () => request);

    expect(useProjectStore.getState().currentProject?.id).toBe('project-1');
    expect(useProjectStore.getState().projectLoad).toEqual({
      projectId: 'project-1', status: 'success', error: null,
    });
    expect(localStorage.getItem('currentProjectId')).toBe('project-1');
  });

  it('exposes a recoverable initial-load error instead of leaving the page loading', async () => {
    vi.mocked(getProject).mockRejectedValue({ request: {} });

    await act(async () => {
      await useProjectStore.getState().syncProject('project-offline');
    });

    expect(useProjectStore.getState().projectLoad.status).toBe('error');
    expect(useProjectStore.getState().projectLoad.error).toContain('网络');
    expect(useProjectStore.getState().currentProject).toBeNull();
  });

  it('treats a malformed success response as a recoverable load error', async () => {
    vi.mocked(getProject).mockResolvedValue({ data: undefined } as any);

    await act(async () => {
      await useProjectStore.getState().syncProject('project-malformed');
    });

    expect(useProjectStore.getState().projectLoad).toMatchObject({
      projectId: 'project-malformed',
      status: 'error',
      error: expect.stringMatching(/缺少项目数据|missing project data/),
    });
  });

  it('clears a stale saved project id after a real 404 response shape', async () => {
    localStorage.setItem('currentProjectId', 'missing-project');
    vi.mocked(getProject).mockRejectedValue({
      response: {
        status: 404,
        data: { error: { message: 'Project not found' } },
      },
    });

    await act(async () => {
      await useProjectStore.getState().syncProject('missing-project');
    });

    expect(localStorage.getItem('currentProjectId')).toBeNull();
    expect(useProjectStore.getState().projectLoad).toMatchObject({
      projectId: 'missing-project',
      status: 'error',
      error: expect.stringMatching(/项目不存在|Project not found/),
    });
  });

  it('recovers when the user retries after a transient failure', async () => {
    vi.mocked(getProject)
      .mockRejectedValueOnce({ request: {} })
      .mockResolvedValueOnce({ data: { project_id: 'project-retry', pages: [] } } as any);

    await act(async () => {
      await useProjectStore.getState().syncProject('project-retry');
    });
    expect(useProjectStore.getState().projectLoad.status).toBe('error');

    await act(async () => {
      await useProjectStore.getState().syncProject('project-retry');
    });

    expect(useProjectStore.getState().projectLoad.status).toBe('success');
    expect(useProjectStore.getState().currentProject?.id).toBe('project-retry');
  });

  it('deduplicates the same initial load when React effects run twice', async () => {
    const request = deferred<any>();
    vi.mocked(getProject).mockReturnValue(request.promise);

    const firstRequest = useProjectStore.getState().syncProject('project-strict-mode');
    const duplicateRequest = useProjectStore.getState().syncProject('project-strict-mode');

    expect(getProject).toHaveBeenCalledTimes(1);
    request.resolve({ data: { project_id: 'project-strict-mode', pages: [] } });
    await act(async () => Promise.all([firstRequest, duplicateRequest]));

    expect(useProjectStore.getState().currentProject?.id).toBe('project-strict-mode');
  });

  it('ignores an older response after navigation starts loading another project', async () => {
    const first = deferred<any>();
    const second = deferred<any>();
    vi.mocked(getProject)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const firstRequest = useProjectStore.getState().syncProject('project-old');
    const secondRequest = useProjectStore.getState().syncProject('project-new');

    second.resolve({ data: { project_id: 'project-new', pages: [] } });
    await act(async () => secondRequest);
    first.resolve({ data: { project_id: 'project-old', pages: [] } });
    await act(async () => firstRequest);

    expect(useProjectStore.getState().currentProject?.id).toBe('project-new');
    expect(localStorage.getItem('currentProjectId')).toBe('project-new');
  });
});
