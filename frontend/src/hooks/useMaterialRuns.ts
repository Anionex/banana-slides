import { useEffect, useRef, useState } from 'react';
import { getTaskStatus } from '@/api/endpoints';

export type MaterialRun = {
  taskId: string; prompt: string; status: 'pending' | 'completed' | 'failed';
  previewUrl?: string | null; error?: string; paused?: boolean;
};
const storageKey = (scope: string) => `banana-material-runs:${scope}`;
function readRuns(scope: string): MaterialRun[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(scope)) || 'null');
    if (Array.isArray(saved)) return saved.filter(run => run && typeof run.taskId === 'string' && ['pending', 'completed', 'failed'].includes(run.status));
    // Preserve an unfinished task from the previous single-task toolbox.
    const legacy = JSON.parse(sessionStorage.getItem(`banana-material-toolbox:${scope}`) || 'null');
    return legacy?.taskId && ['pending', 'completed', 'failed'].includes(legacy.status)
      ? [{ ...legacy, prompt: '' }] : [];
  } catch { return []; }
}

/** Poll each run independently; a slow or failed task must not lock the toolbox. */
export function useMaterialRuns(scope: string) {
  const [state, setState] = useState(() => ({ scope, runs: readRuns(scope) }));
  const runs = state.scope === scope ? state.runs : [];
  const attempts = useRef(new Map<string, number>());
  useEffect(() => { setState({ scope, runs: readRuns(scope) }); attempts.current.clear(); }, [scope]);
  useEffect(() => {
    if (state.scope !== scope) return;
    try { sessionStorage.setItem(storageKey(scope), JSON.stringify(state.runs)); } catch { /* Storage may be unavailable. */ }
  }, [state, scope]);
  const update = (taskId: string, patch: Partial<MaterialRun>) => setState(prev => prev.scope !== scope ? prev : ({
    ...prev, runs: prev.runs.map(run => run.taskId === taskId ? { ...run, ...patch } : run),
  }));
  const pending = runs.filter(run => run.status === 'pending' && !run.paused).map(run => run.taskId).join(',');
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const poll = async (taskId: string) => {
      const count = (attempts.current.get(taskId) || 0) + 1;
      attempts.current.set(taskId, count);
      try {
        const response = await getTaskStatus(scope, taskId);
        if (cancelled) return;
        const task = response.data;
        if (!task) throw new Error('Missing task status');
        if (task.status === 'COMPLETED') {
          update(taskId, task.progress?.image_url
            ? { status: 'completed', previewUrl: task.progress.image_url }
            : { status: 'failed', error: 'No image returned' });
          return;
        }
        if (task.status === 'FAILED') {
          update(taskId, { status: 'failed', error: task.error_message || 'Generation failed' });
          return;
        }
      } catch { /* Keep the backend task until polling can be resumed. */ }
      if (cancelled) return;
      if (count >= 90) { update(taskId, { paused: true }); return; }
      timers.push(setTimeout(() => void poll(taskId), 2000));
    };
    pending.split(',').forEach(taskId => void poll(taskId));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // A task's identity and scope define its polling lifetime.
  }, [scope, pending]);
  return {
    runs,
    addRun: (run: MaterialRun) => setState(prev => ({ scope, runs: [...(prev.scope === scope ? prev.runs : []), run] })),
    resume: (taskId: string) => { attempts.current.delete(taskId); update(taskId, { paused: false }); },
  };
}
