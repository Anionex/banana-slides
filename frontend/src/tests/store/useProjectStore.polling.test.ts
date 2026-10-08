import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProjectStore } from '@/store/useProjectStore';
import { getTaskStatus } from '@/api/endpoints';

vi.mock('@/api/endpoints', () => ({ getTaskStatus: vi.fn() }));
const project = (id: string) => ({ id, pages: [], status: 'DRAFT' } as any);
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('polling cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useProjectStore.setState({ currentProject: project('old'), activeTaskId: 'task',
      isGlobalLoading: true, taskProgress: { total: 1 } as any,
      pageGeneratingTasks: { page: 'task', other: 'other-task' }, error: null });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it.each([null, project('old')])('clears global loading for no project or missing task', async currentProject => {
    useProjectStore.setState({ currentProject });
    vi.mocked(getTaskStatus).mockResolvedValue({ data: undefined } as any);
    await useProjectStore.getState().pollTask('task');
    expect(useProjectStore.getState()).toMatchObject({ activeTaskId: null, taskProgress: null, isGlobalLoading: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([null, project('old')])('clears only matching page tasks for no project or missing task', async currentProject => {
    useProjectStore.setState({ currentProject });
    vi.mocked(getTaskStatus).mockResolvedValue({ data: undefined } as any);
    useProjectStore.getState().pollImageTask('task', ['page', 'other']);
    await flush();
    expect(useProjectStore.getState().pageGeneratingTasks).toEqual({ other: 'other-task' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['global', 'image'])('does not clear a new project after an old %s response', async kind => {
    let resolve!: (value: any) => void;
    vi.mocked(getTaskStatus).mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = kind === 'global' ? useProjectStore.getState().pollTask('task') :
      useProjectStore.getState().pollImageTask('task', ['page']);
    useProjectStore.setState({ currentProject: project('new') });
    resolve({ data: undefined });
    await pending;
    await flush();
    expect(useProjectStore.getState()).toMatchObject({ isGlobalLoading: true, activeTaskId: 'task', pageGeneratingTasks: { page: 'task' } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['global', 'image'])('does not clear replacement %s tasks on the same project', async kind => {
    let resolve!: (value: any) => void;
    vi.mocked(getTaskStatus).mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = kind === 'global' ? useProjectStore.getState().pollTask('task') :
      useProjectStore.getState().pollImageTask('task', ['page']);
    useProjectStore.setState({ activeTaskId: 'replacement', pageGeneratingTasks: { page: 'replacement' } });
    resolve({ data: undefined });
    await pending;
    await flush();
    expect(useProjectStore.getState()).toMatchObject({ isGlobalLoading: true, activeTaskId: 'replacement', pageGeneratingTasks: { page: 'replacement' } });
  });

  it.each(['global', 'image'])('does not clear a new project after an old %s request fails', async kind => {
    let reject!: (error: Error) => void;
    vi.mocked(getTaskStatus).mockReturnValue(new Promise((_, r) => { reject = r; }));
    const pending = kind === 'global' ? useProjectStore.getState().pollTask('task') :
      useProjectStore.getState().pollImageTask('task', ['page']);
    useProjectStore.setState({ currentProject: project('new') });
    reject(new Error('old request failed'));
    await pending;
    await flush();
    expect(useProjectStore.getState()).toMatchObject({ isGlobalLoading: true, pageGeneratingTasks: { page: 'task' }, error: null });
  });

  it.each(['global', 'image'])('stops scheduled %s polls on project navigation', async kind => {
    const syncProject = useProjectStore.getState().syncProject;
    useProjectStore.setState({ syncProject: vi.fn().mockResolvedValue(undefined) });
    try {
      vi.mocked(getTaskStatus).mockResolvedValue({ data: { status: 'PENDING' } } as any);
      await (kind === 'global' ? useProjectStore.getState().pollTask('task') : useProjectStore.getState().pollImageTask('task', ['page']));
      await flush();
      useProjectStore.setState({ currentProject: project('new') });
      await vi.advanceTimersByTimeAsync(2000);
      expect(getTaskStatus).toHaveBeenCalledTimes(1);
    } finally { useProjectStore.setState({ syncProject }); }
  });
});
