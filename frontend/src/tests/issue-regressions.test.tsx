import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyReportPreset, buildReportPrompt, emptyReport } from '@/components/shared/ReportForm';
import { generateUuid } from '@/utils/uuid';
import { useMaterialRuns } from '@/hooks/useMaterialRuns';
import { getTaskStatus } from '@/api/endpoints';

vi.mock('@/api/endpoints', () => ({ getTaskStatus: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('HTTP export UUID', () => {
  it('uses secure random bytes on HTTP and produces unique v4 UUIDs', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = Array.from({ length: 100 }, generateUuid);
    expect(new Set(ids).size).toBe(100);
    ids.forEach(id => expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
  });
});
describe('report presets', () => {
  it('fills only empty fields in every scenario and retains user content', () => {
    for (const zh of [true, false]) for (let i = 0; i < 5; i++) {
      const fields = { ...emptyReport, topic: 'My topic', audience: 'My team', pages: '23', requirements: 'No invented data' };
      const result = applyReportPreset(fields, i, zh);
      expect(result.audience).toBe('My team');
      expect(result.pages).toBe('23');
      expect(buildReportPrompt(result, zh)).toContain('No invented data');
      expect(buildReportPrompt(result, zh)).toContain('My topic');
    }
  });
});
describe('independent material tasks', () => {
  it('keeps multiple pending tasks, accepts out-of-order success/failure and restores them', async () => {
    let finishFirst: (value: any) => void = () => {};
    vi.mocked(getTaskStatus).mockImplementation((_scope, id) => id === 'one'
      ? new Promise(resolve => { finishFirst = resolve; })
      : Promise.resolve({ data: { status: 'FAILED', error_message: 'provider unavailable' } } as any));
    const { result, unmount } = renderHook(() => useMaterialRuns('global'));
    act(() => {
      result.current.addRun({ taskId: 'one', prompt: 'first', status: 'pending' });
      result.current.addRun({ taskId: 'two', prompt: 'second', status: 'pending' });
    });
    await waitFor(() => expect(result.current.runs[1].status).toBe('failed'));
    expect(result.current.runs[0].status).toBe('pending');
    await act(async () => finishFirst({ data: { status: 'COMPLETED', progress: { image_url: '/files/one.png' } } }));
    await waitFor(() => expect(result.current.runs[0].status).toBe('completed'));
    unmount();
    const restored = renderHook(() => useMaterialRuns('global'));
    expect(restored.result.current.runs.map(run => run.status)).toEqual(['completed', 'failed']);
  });
  it('isolates projects from late task responses', async () => {
    let finish: (value: any) => void = () => {};
    vi.mocked(getTaskStatus).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ scope }) => useMaterialRuns(scope), { initialProps: { scope: 'a' } });
    act(() => result.current.addRun({ taskId: 'one', prompt: 'first', status: 'pending' }));
    await waitFor(() => expect(getTaskStatus).toHaveBeenCalled());
    rerender({ scope: 'b' });
    await act(async () => finish({ data: { status: 'COMPLETED', progress: { image_url: '/files/a.png' } } }));
    expect(result.current.runs).toEqual([]);
  });
});
