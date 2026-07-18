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
      pollRetrying: '暂时无法查询导出状态，后台任务未被判定失败，正在自动重连',
      pollPaused: '无法继续自动查询导出状态，后台任务状态未知，请手动重新查询',
      staleTask: '任务状态响应异常，后台任务状态未知，请手动重新查询',
      pollGatewayTimeout: '状态查询经过网关时超时',
      pollRequestTimeout: '本次状态查询超过请求时限',
      pollRateLimited: '状态查询请求过于频繁',
      pollServiceUnavailable: '导出状态服务暂时不可用',
      pollNetworkError: '状态查询网络连接中断',
      createConfirmationPending: '创建响应中断后暂未查到任务，可能仍在经过网关或写入队列',
    },
  },
  en: {
    exportStore: {
      exportFailed: 'Export failed',
      pollFailed: 'Polling failed',
      pollRetrying: 'Export status is temporarily unavailable. The backend task is not marked failed; reconnecting automatically',
      pollPaused: 'Automatic status checks stopped. The backend task status is unknown; check again manually',
      staleTask: 'The task status response is invalid. The backend task status is unknown; check again manually',
      pollGatewayTimeout: 'The status request timed out at the gateway',
      pollRequestTimeout: 'This status request exceeded its request timeout',
      pollRateLimited: 'Status checks are being rate limited',
      pollServiceUnavailable: 'The export status service is temporarily unavailable',
      pollNetworkError: 'The status-check connection was interrupted',
      createConfirmationPending: 'The task is not visible yet after the create response was interrupted; it may still be passing through the gateway or queue',
    },
  },
};
const t = getT(exportI18n);
const EXPORT_POLL_INTERVAL_MS = 2000;
const MAX_POLL_RETRY_DELAY_MS = 30000;
const MAX_CREATE_CONFIRMATION_RETRIES = 6;
export const activePolls = new Set<string>();

interface PollingIssue {
  code: string;
  message: string;
  transient: boolean;
  httpStatus?: number;
}

const describePollingError = (error: any): PollingIssue => {
  const status = error?.response?.status;
  if (status === 408 || status === 504) {
    return {
      code: status === 504 ? 'EXPORT_STATUS_GATEWAY_TIMEOUT' : 'EXPORT_STATUS_REQUEST_TIMEOUT',
      message: `${t('exportStore.pollGatewayTimeout')} (HTTP ${status})`,
      transient: true,
      httpStatus: status,
    };
  }
  if (status === 429) {
    return {
      code: 'EXPORT_STATUS_RATE_LIMITED',
      message: `${t('exportStore.pollRateLimited')} (HTTP 429)`,
      transient: true,
      httpStatus: status,
    };
  }
  if ([500, 502, 503].includes(status)) {
    return {
      code: 'EXPORT_STATUS_SERVICE_UNAVAILABLE',
      message: `${t('exportStore.pollServiceUnavailable')} (HTTP ${status})`,
      transient: true,
      httpStatus: status,
    };
  }

  const isRequestTimeout = error?.code === 'ECONNABORTED'
    || String(error?.message || '').toLowerCase().includes('timeout');
  if (isRequestTimeout) {
    return {
      code: 'EXPORT_STATUS_CLIENT_TIMEOUT',
      message: t('exportStore.pollRequestTimeout'),
      transient: true,
    };
  }

  const isNetworkError = Boolean(
    error?.request
    || error?.code === 'ERR_NETWORK'
    || error?.message?.includes('Network Error')
  );
  if (isNetworkError) {
    return {
      code: 'EXPORT_STATUS_NETWORK_ERROR',
      message: t('exportStore.pollNetworkError'),
      transient: true,
    };
  }

  return {
    code: 'EXPORT_STATUS_CHECK_FAILED',
    message: normalizeErrorMessage(error?.message || t('exportStore.pollFailed')),
    transient: false,
    httpStatus: status,
  };
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
    backend_status?: string;
    error_code?: string;
    error_type?: string;
    error_stage?: string;
    error_details?: {
      stage?: string;
      operation?: string;
      reason?: string;
      provider?: string;
      model?: string;
      retryable?: boolean;
      request_timeout_seconds?: number;
      max_attempts?: number;
      technical_message?: string;
      [key: string]: unknown;
    };
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
  monitoring?: {
    state: 'retrying' | 'paused';
    code: string;
    message: string;
    consecutiveErrors: number;
    lastErrorAt: string;
    nextRetryAt?: string;
    httpStatus?: number;
  };
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
        const existingTask = get().tasks.find(task => task.id === id);
        if (!existingTask || existingTask.status === 'COMPLETED' || existingTask.status === 'FAILED') {
          return;
        }
        if (activePolls.has(id)) {
          return;
        }
        activePolls.add(id);
        let consecutivePollErrors = 0;
        const awaitingCreateConfirmation = existingTask.monitoring?.code === 'EXPORT_CREATE_RESPONSE_INTERRUPTED'
          || existingTask.monitoring?.code === 'EXPORT_CREATE_CONFIRMATION_PENDING';

        if (existingTask.monitoring?.state === 'paused') {
          get().updateTask(id, {
            monitoring: {
              ...existingTask.monitoring,
              state: 'retrying',
              message: t('exportStore.pollRetrying'),
              lastErrorAt: new Date().toISOString(),
            },
          });
        }

        const poll = async () => {
          if (!hasTask(get().tasks, id)) {
            unusableTaskResponseCounts.delete(id);
            activePolls.delete(id);
            return;
          }

          try {
            const response = await api.getTaskStatus(projectId, taskId);
            consecutivePollErrors = 0;
            const task = response.data;

            if (!hasTask(get().tasks, id)) {
              unusableTaskResponseCounts.delete(id);
              activePolls.delete(id);
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
              activePolls.delete(id);
              get().updateTask(id, {
                monitoring: {
                  state: 'paused',
                  code: 'EXPORT_STATUS_INVALID_RESPONSE',
                  message: t('exportStore.staleTask'),
                  consecutiveErrors: retryCount + 1,
                  lastErrorAt: new Date().toISOString(),
                },
              });
              return;
            }
            unusableTaskResponseCounts.delete(id);

            const updates: Partial<ExportTask> = {
              status: task.status,
              monitoring: undefined,
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
              activePolls.delete(id);
              get().updateTask(id, updates);
            } else if (task.status === 'FAILED') {
              const taskErrorMessage = task.error_message
                || (typeof task.error === 'string' ? task.error : task.error?.message)
                || t('exportStore.exportFailed');
              updates.errorMessage = updates.progress?.error_code
                ? taskErrorMessage
                : normalizeErrorMessage(taskErrorMessage);
              updates.completedAt = new Date().toISOString();
              activePolls.delete(id);
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
            let issue = describePollingError(error);
            if (awaitingCreateConfirmation && issue.httpStatus === 404) {
              issue = {
                code: 'EXPORT_CREATE_CONFIRMATION_PENDING',
                message: `${t('exportStore.createConfirmationPending')} (HTTP 404)`,
                transient: consecutivePollErrors <= MAX_CREATE_CONFIRMATION_RETRIES,
                httpStatus: 404,
              };
            }
            if (
              isActiveTask
              && issue.transient
            ) {
              const retryDelayMs = Math.min(
                MAX_POLL_RETRY_DELAY_MS,
                EXPORT_POLL_INTERVAL_MS * (2 ** Math.min(consecutivePollErrors - 1, 4)),
              );
              const nextRetryAt = new Date(Date.now() + retryDelayMs).toISOString();
              console.warn(
                `[ExportTasksStore] Transient poll error ${consecutivePollErrors}; retrying in ${retryDelayMs}ms`
              );
              get().updateTask(id, {
                monitoring: {
                  state: 'retrying',
                  code: issue.code,
                  message: `${issue.message}。${t('exportStore.pollRetrying')}。`,
                  consecutiveErrors: consecutivePollErrors,
                  lastErrorAt: new Date().toISOString(),
                  nextRetryAt,
                  httpStatus: issue.httpStatus,
                },
              });
              setTimeout(poll, retryDelayMs);
              return;
            }

            activePolls.delete(id);
            get().updateTask(id, {
              monitoring: {
                state: 'paused',
                code: issue.code,
                message: `${issue.message}。${t('exportStore.pollPaused')}。`,
                consecutiveErrors: consecutivePollErrors,
                lastErrorAt: new Date().toISOString(),
                httpStatus: issue.httpStatus,
              },
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
