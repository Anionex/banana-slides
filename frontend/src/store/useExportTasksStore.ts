import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as api from '@/api/endpoints';
import { devLog } from '@/utils/logger';
import { getT } from '@/utils/i18nHelper';
import { normalizeErrorMessage } from '@/utils';

const exportI18n = {
  zh: {
    exportStore: {
      exportFailed: '导出失败',
      pollFailed: '轮询失败',
      pollRetrying: '正在继续查询任务状态...',
      staleTask: '导出任务已不可用，请重新导出',
    },
  },
  en: {
    exportStore: {
      exportFailed: 'Export failed',
      pollFailed: 'Polling failed',
      pollRetrying: 'Continuing to check task status...',
      staleTask: 'This export task is no longer available. Please export again.',
    },
  },
};
const t = getT(exportI18n);
const EXPORT_POLL_INTERVAL_MS = 2000;
const MAX_TRANSIENT_POLL_ERRORS = 6;

const isTransientPollingError = (error: any): boolean => {
  const status = error?.response?.status;
  if (status) {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }
  return Boolean(
    error?.request
    || error?.code === 'ERR_NETWORK'
    || error?.code === 'ECONNABORTED'
    || error?.message?.includes('Network Error')
  );
};

// Note: Backend uses 'RUNNING' but we also accept 'PROCESSING' for compatibility
export type ExportTaskStatus = 'PENDING' | 'PROCESSING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
export type ExportTaskType = 'pptx' | 'pdf' | 'editable-pptx' | 'images' | 'video';
const EXPORT_TASK_STATUSES = new Set<ExportTaskStatus>(['PENDING', 'PROCESSING', 'RUNNING', 'COMPLETED', 'FAILED']);
const MAX_UNUSABLE_TASK_RESPONSES = 3;
const unusableTaskResponseCounts = new Map<string, number>();

const isExportTaskStatus = (status: unknown): status is ExportTaskStatus => (
  typeof status === 'string' && EXPORT_TASK_STATUSES.has(status as ExportTaskStatus)
);

const hasTask = (tasks: ExportTask[], id: string) => tasks.some(task => task.id === id);

export interface ExportTask {
  id: string;
  taskId: string;
  projectId: string;
  type: ExportTaskType;
  status: ExportTaskStatus;
  pageIds?: string[]; // 选中的页面ID列表，undefined表示全部
  progress?: {
    total: number;
    completed: number;
    percent?: number;
    current_step?: string;
    help_text?: string;
    messages?: string[];
    warnings?: string[];  // 导出警告信息
    warning_details?: {   // 警告详细信息
      style_extraction_failed?: Array<{ element_id: string; reason: string }>;
      text_render_failed?: Array<{ text: string; reason: string }>;
      image_add_failed?: Array<{ path: string; reason: string }>;
      json_parse_failed?: Array<{ context: string; reason: string }>;
      other_warnings?: string[];
      total_warnings?: number;
    };
  };
  downloadUrl?: string;
  filename?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

interface ExportTasksState {
  tasks: ExportTask[];
  
  // Actions
  addTask: (task: Omit<ExportTask, 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<ExportTask>) => void;
  removeTask: (id: string) => void;
  clearCompleted: (projectId?: string | null) => void;
  pollTask: (id: string, projectId: string, taskId: string) => Promise<void>;
  restoreActiveTasks: () => void; // 恢复正在进行的任务并重新开始轮询
}

export const useExportTasksStore = create<ExportTasksState>()(
  persist(
    (set, get) => ({
      tasks: [],

      addTask: (task) => {
        set((state) => {
          // Check if task with this id already exists
          const existingIndex = state.tasks.findIndex(t => t.id === task.id);
          
          if (existingIndex >= 0) {
            // Update existing task
            const updatedTasks = [...state.tasks];
            updatedTasks[existingIndex] = {
              ...updatedTasks[existingIndex],
              ...task,
              // Update completedAt if status changed to completed/failed
              completedAt: (task.status === 'COMPLETED' || task.status === 'FAILED')
                ? new Date().toISOString()
                : updatedTasks[existingIndex].completedAt,
            };
            return { tasks: updatedTasks };
          } else {
            // Add new task
            const newTask: ExportTask = {
              ...task,
              createdAt: new Date().toISOString(),
            };
            return {
              tasks: [newTask, ...state.tasks].slice(0, 20), // Keep max 20 tasks
            };
          }
        });
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id ? { ...task, ...updates } : task
          ),
        }));
      },

      removeTask: (id) => {
        unusableTaskResponseCounts.delete(id);
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
      },

      clearCompleted: (projectId) => {
        set((state) => ({
          tasks: state.tasks.filter(
            (task) => {
              const isCompleted = task.status === 'COMPLETED' || task.status === 'FAILED';
              if (!isCompleted) return true;
              return projectId != null ? task.projectId !== projectId : false;
            }
          ),
        }));
      },

      pollTask: async (id, projectId, taskId) => {
        let consecutivePollErrors = 0;

        const poll = async () => {
          if (!hasTask(get().tasks, id)) {
            unusableTaskResponseCounts.delete(id);
            return;
          }

          try {
            const response = await api.getTaskStatus(projectId, taskId);
            consecutivePollErrors = 0;
            const task = response.data;

            if (!hasTask(get().tasks, id)) {
              unusableTaskResponseCounts.delete(id);
              return;
            }

            if (!task || !isExportTaskStatus(task.status)) {
              const retryCount = unusableTaskResponseCounts.get(id) ?? 0;
              if (retryCount < MAX_UNUSABLE_TASK_RESPONSES) {
                unusableTaskResponseCounts.set(id, retryCount + 1);
                console.warn(
                  `[ExportTasksStore] No usable task data in response, retrying (${retryCount + 1}/${MAX_UNUSABLE_TASK_RESPONSES})`
                );
                setTimeout(poll, 2000);
                return;
              }

              console.warn('[ExportTasksStore] No usable task data in response after retries');
              unusableTaskResponseCounts.delete(id);
              get().updateTask(id, {
                status: 'FAILED',
                errorMessage: t('exportStore.staleTask'),
                completedAt: new Date().toISOString(),
              });
              return;
            }
            unusableTaskResponseCounts.delete(id);

            const updates: Partial<ExportTask> = {
              status: task.status,
            };

            if (task.progress) {
              // Parse progress if it's a string (from database JSON field)
              let progressData = task.progress;
              if (typeof progressData === 'string') {
                try {
                  progressData = JSON.parse(progressData);
                } catch (e) {
                  console.warn('[ExportTasksStore] Failed to parse progress:', e);
                }
              }
              
              updates.progress = progressData;
              
              // Extract download URL if available
              if (progressData.download_url) {
                updates.downloadUrl = progressData.download_url;
              }
              if (progressData.filename) {
                updates.filename = progressData.filename;
              }
            }

            if (task.status === 'COMPLETED') {
              updates.completedAt = new Date().toISOString();
              get().updateTask(id, updates);
            } else if (task.status === 'FAILED') {
              const taskErrorMessage = task.error_message
                || (typeof task.error === 'string' ? task.error : task.error?.message)
                || t('exportStore.exportFailed');
              updates.errorMessage = normalizeErrorMessage(taskErrorMessage);
              updates.completedAt = new Date().toISOString();
              get().updateTask(id, updates);
            } else if (task.status === 'PENDING' || task.status === 'RUNNING' || task.status === 'PROCESSING') {
              get().updateTask(id, updates);
              // Continue polling
              setTimeout(poll, EXPORT_POLL_INTERVAL_MS);
            }
          } catch (error: any) {
            console.error('[ExportTasksStore] Poll error:', error);
            const currentTask = get().tasks.find(task => task.id === id);
            const isActiveTask = currentTask
              && (currentTask.status === 'PENDING' || currentTask.status === 'RUNNING' || currentTask.status === 'PROCESSING');

            consecutivePollErrors += 1;
            if (
              isActiveTask
              && isTransientPollingError(error)
              && consecutivePollErrors <= MAX_TRANSIENT_POLL_ERRORS
            ) {
              const retryDelayMs = Math.min(10000, EXPORT_POLL_INTERVAL_MS * consecutivePollErrors);
              const normalizedMessage = normalizeErrorMessage(error.message || t('exportStore.pollFailed'));
              console.warn(
                `[ExportTasksStore] Transient poll error ${consecutivePollErrors}/${MAX_TRANSIENT_POLL_ERRORS}; retrying in ${retryDelayMs}ms`
              );
              get().updateTask(id, {
                progress: {
                  ...(currentTask.progress || { total: 100, completed: 0 }),
                  help_text: `${normalizedMessage} ${t('exportStore.pollRetrying')}`,
                },
              });
              setTimeout(poll, retryDelayMs);
              return;
            }

            get().updateTask(id, {
              status: 'FAILED',
              errorMessage: normalizeErrorMessage(error.message || t('exportStore.pollFailed')),
              completedAt: new Date().toISOString(),
            });
          }
        };

        await poll();
      },

      restoreActiveTasks: () => {
        // 恢复所有正在进行的任务并重新开始轮询
        const state = get();
        const activeTasks = state.tasks.filter(
          task => task.status === 'PENDING' || task.status === 'PROCESSING' || task.status === 'RUNNING'
        );
        
        if (activeTasks.length > 0) {
          devLog(`[ExportTasksStore] 恢复 ${activeTasks.length} 个正在进行的任务`);
          activeTasks.forEach(task => {
            // 重新开始轮询
            state.pollTask(task.id, task.projectId, task.taskId).catch(err => {
              console.error(`[ExportTasksStore] 恢复任务 ${task.id} 失败:`, err);
            });
          });
        }
      },
    }),
    {
      name: 'export-tasks-storage',
      partialize: (state) => ({
        // Persist all tasks (including active ones) so they can be restored after page refresh
        tasks: state.tasks.slice(0, 20), // Keep max 20 tasks
      }),
    }
  )
);
