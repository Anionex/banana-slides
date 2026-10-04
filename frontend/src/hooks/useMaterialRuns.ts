import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getTaskStatus } from '@/api/endpoints';

export type MaterialRun = {
  taskId: string; prompt: string; status: 'pending' | 'completed' | 'failed';
  previewUrl?: string | null; error?: string; paused?: boolean;
};
type Poller = { cancelled: boolean; timer?: ReturnType<typeof setTimeout> };
type RunStore = {
  scope: string;
  runs: MaterialRun[];
  listeners: Set<() => void>;
  pollers: Map<string, Poller>;
};
const stores = new Map<string, RunStore>();
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
function getStore(scope: string): RunStore {
  let store = stores.get(scope);
  if (!store) {
    store = { scope, runs: readRuns(scope), listeners: new Set(), pollers: new Map() };
    stores.set(scope, store);
  } else if (!store.listeners.size) {
    // A new mount must honor restored or cleared session data as well.
    store.runs = readRuns(scope);
  }
  return store;
}
function publish(store: RunStore, runs: MaterialRun[]) {
  store.runs = runs;
  try { sessionStorage.setItem(storageKey(store.scope), JSON.stringify(runs)); } catch { /* Storage may be unavailable. */ }
  store.listeners.forEach(listener => listener());
  startPendingPolls(store);
}
function update(store: RunStore, taskId: string, patch: Partial<MaterialRun>) {
  publish(store, store.runs.map(run => run.taskId === taskId ? { ...run, ...patch } : run));
}
function startPendingPolls(store: RunStore) {
  if (!store.listeners.size) return;
  for (const run of store.runs) {
    if (run.status !== 'pending' || run.paused || store.pollers.has(run.taskId)) continue;
    const poller: Poller = { cancelled: false };
    store.pollers.set(run.taskId, poller);
    let attempts = 0;
    const finish = (patch: Partial<MaterialRun>) => {
      store.pollers.delete(run.taskId);
      update(store, run.taskId, patch);
    };
    const poll = async () => {
      attempts += 1;
      try {
        const response = await getTaskStatus(store.scope, run.taskId);
        if (poller.cancelled) return;
        const task = response.data;
        if (!task) throw new Error('Missing task status');
        if (task.status === 'COMPLETED') {
          finish(task.progress?.image_url
            ? { status: 'completed', previewUrl: task.progress.image_url }
            : { status: 'failed', error: 'No image returned' });
          return;
        }
        if (task.status === 'FAILED') {
          finish({ status: 'failed', error: task.error_message || 'Generation failed' });
          return;
        }
      } catch { /* Keep the backend task until polling can be resumed. */ }
      if (poller.cancelled) return;
      if (attempts >= 90) { finish({ paused: true }); return; }
      poller.timer = setTimeout(() => void poll(), 2000);
    };
    void poll();
  }
}
function subscribe(store: RunStore, listener: () => void) {
  store.listeners.add(listener);
  startPendingPolls(store);
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size) return;
    for (const poller of store.pollers.values()) {
      poller.cancelled = true;
      clearTimeout(poller.timer);
    }
    store.pollers.clear();
  };
}

/** All toolbox instances for a project share one snapshot and one poller per task. */
export function useMaterialRuns(scope: string) {
  const store = useMemo(() => getStore(scope), [scope]);
  const listen = useCallback((listener: () => void) => subscribe(store, listener), [store]);
  const runs = useSyncExternalStore(listen, () => store.runs);
  return {
    runs,
    addRun: (run: MaterialRun) => {
      if (!store.runs.some(existing => existing.taskId === run.taskId)) publish(store, [...store.runs, run]);
    },
    resume: (taskId: string) => update(store, taskId, { paused: false }),
  };
}
