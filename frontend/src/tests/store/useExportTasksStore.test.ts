import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { activePolls, useExportTasksStore } from '@/store/useExportTasksStore'
import * as api from '@/api/endpoints'

vi.mock('@/api/endpoints', () => ({
  getTaskStatus: vi.fn(),
}))

describe('useExportTasksStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.mocked(api.getTaskStatus).mockReset()
    activePolls.clear()
    act(() => {
      useExportTasksStore.setState({ tasks: [] })
    })
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears completed export tasks only for the selected project', () => {
    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'completed-current',
        taskId: '',
        projectId: 'project-a',
        type: 'pptx',
        status: 'COMPLETED',
      })
      useExportTasksStore.getState().addTask({
        id: 'failed-current',
        taskId: '',
        projectId: 'project-a',
        type: 'pdf',
        status: 'FAILED',
        errorMessage: 'Export failed',
      })
      useExportTasksStore.getState().addTask({
        id: 'completed-other',
        taskId: '',
        projectId: 'project-b',
        type: 'images',
        status: 'COMPLETED',
      })
      useExportTasksStore.getState().addTask({
        id: 'active-current',
        taskId: 'task-1',
        projectId: 'project-a',
        type: 'video',
        status: 'RUNNING',
      })
    })

    act(() => {
      useExportTasksStore.getState().clearCompleted('project-a')
    })

    expect(useExportTasksStore.getState().tasks.map(task => task.id)).toEqual([
      'active-current',
      'completed-other',
    ])
  })

  it('keeps the existing global clear behavior when no project is provided', () => {
    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'completed-current',
        taskId: '',
        projectId: 'project-a',
        type: 'pptx',
        status: 'COMPLETED',
      })
      useExportTasksStore.getState().addTask({
        id: 'active-current',
        taskId: 'task-1',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'PROCESSING',
      })
    })

    act(() => {
      useExportTasksStore.getState().clearCompleted()
    })

    expect(useExportTasksStore.getState().tasks.map(task => task.id)).toEqual([
      'active-current',
    ])
  })

  it('treats an empty project id as a scoped clear instead of a global clear', () => {
    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'empty-project-completed',
        taskId: '',
        projectId: '',
        type: 'pptx',
        status: 'COMPLETED',
      })
      useExportTasksStore.getState().addTask({
        id: 'other-project-completed',
        taskId: '',
        projectId: 'project-b',
        type: 'pdf',
        status: 'COMPLETED',
      })
    })

    act(() => {
      useExportTasksStore.getState().clearCompleted('')
    })

    expect(useExportTasksStore.getState().tasks.map(task => task.id)).toEqual([
      'other-project-completed',
    ])
  })

  it('treats null as the global clear fallback at runtime', () => {
    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'completed-current',
        taskId: '',
        projectId: 'project-a',
        type: 'pptx',
        status: 'COMPLETED',
      })
      useExportTasksStore.getState().addTask({
        id: 'active-current',
        taskId: 'task-1',
        projectId: 'project-a',
        type: 'video',
        status: 'RUNNING',
      })
    })

    act(() => {
      useExportTasksStore.getState().clearCompleted(null)
    })

    expect(useExportTasksStore.getState().tasks.map(task => task.id)).toEqual([
      'active-current',
    ])
  })

  it('pauses monitoring without marking the backend task failed when task data is unusable', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus).mockResolvedValue({
      success: true,
      data: undefined,
    })

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'stale-export',
        taskId: 'missing-task',
        projectId: 'project-a',
        type: 'pptx',
        status: 'RUNNING',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('stale-export', 'project-a', 'missing-task')
    })

    expect(useExportTasksStore.getState().tasks.find(item => item.id === 'stale-export')?.status).toBe('RUNNING')
    expect(api.getTaskStatus).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
    }

    const task = useExportTasksStore.getState().tasks.find(item => item.id === 'stale-export')
    expect(task?.status).toBe('RUNNING')
    expect(task?.monitoring?.state).toBe('paused')
    expect(task?.monitoring?.code).toBe('EXPORT_STATUS_INVALID_RESPONSE')
    expect(task?.completedAt).toBeUndefined()
    expect(api.getTaskStatus).toHaveBeenCalledTimes(4)
  })

  it('stops retrying when the task is removed while polling is active', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus).mockResolvedValue({
      success: true,
      data: undefined,
    })

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'removed-export',
        taskId: 'missing-task',
        projectId: 'project-a',
        type: 'pptx',
        status: 'RUNNING',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('removed-export', 'project-a', 'missing-task')
    })

    act(() => {
      useExportTasksStore.getState().removeTask('removed-export')
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    expect(api.getTaskStatus).toHaveBeenCalledTimes(1)
    expect(useExportTasksStore.getState().tasks).toEqual([])
  })

  it('keeps active export tasks running after transient poll errors', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus)
      .mockRejectedValueOnce({
        message: 'Request failed with status code 502',
        response: { status: 502 },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'COMPLETED',
          progress: {
            download_url: '/files/project-a/exports/demo.pptx',
            filename: 'demo.pptx',
          },
        },
      } as any)

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'active-editable',
        taskId: 'task-a',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'PROCESSING',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('active-editable', 'project-a', 'task-a')
    })

    expect(useExportTasksStore.getState().tasks[0].status).toBe('PROCESSING')
    expect(useExportTasksStore.getState().tasks[0].monitoring?.state).toBe('retrying')
    expect(useExportTasksStore.getState().tasks[0].monitoring?.code).toBe('EXPORT_STATUS_SERVICE_UNAVAILABLE')
    expect(useExportTasksStore.getState().tasks[0].monitoring?.message).toMatch(/后台任务未被判定失败|not marked failed/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    const task = useExportTasksStore.getState().tasks[0]
    expect(api.getTaskStatus).toHaveBeenCalledTimes(2)
    expect(task.status).toBe('COMPLETED')
    expect(task.downloadUrl).toBe('/files/project-a/exports/demo.pptx')
  })

  it('waits for a reserved task id to appear after the create response is interrupted', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus)
      .mockRejectedValueOnce({
        message: 'Request failed with status code 404',
        response: { status: 404 },
      })
      .mockResolvedValueOnce({
        data: {
          status: 'COMPLETED',
          progress: {
            download_url: '/files/project-a/exports/recovered-create.pptx',
            filename: 'recovered-create.pptx',
          },
        },
      } as any)

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'uncertain-create',
        taskId: 'reserved-task-id',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'PROCESSING',
        monitoring: {
          state: 'retrying',
          code: 'EXPORT_CREATE_RESPONSE_INTERRUPTED',
          message: '创建响应中断',
          consecutiveErrors: 1,
          lastErrorAt: new Date().toISOString(),
        },
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('uncertain-create', 'project-a', 'reserved-task-id')
    })

    let task = useExportTasksStore.getState().tasks[0]
    expect(task.status).toBe('PROCESSING')
    expect(task.monitoring?.state).toBe('retrying')
    expect(task.monitoring?.code).toBe('EXPORT_CREATE_CONFIRMATION_PENDING')
    expect(task.monitoring?.message).toMatch(/HTTP 404/)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })

    task = useExportTasksStore.getState().tasks[0]
    expect(api.getTaskStatus).toHaveBeenCalledTimes(2)
    expect(task.status).toBe('COMPLETED')
    expect(task.monitoring).toBeUndefined()
    expect(task.downloadUrl).toBe('/files/project-a/exports/recovered-create.pptx')
  })

  it('pauses monitoring after programming errors without claiming the export failed', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus).mockRejectedValueOnce(new TypeError('Cannot read properties of undefined'))

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'active-editable',
        taskId: 'task-a',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'PROCESSING',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('active-editable', 'project-a', 'task-a')
    })

    const task = useExportTasksStore.getState().tasks[0]
    expect(api.getTaskStatus).toHaveBeenCalledTimes(1)
    expect(task.status).toBe('PROCESSING')
    expect(task.monitoring?.state).toBe('paused')
    expect(task.monitoring?.code).toBe('EXPORT_STATUS_CHECK_FAILED')
    expect(task.monitoring?.message).toMatch(/Cannot read properties/)
    expect(task.completedAt).toBeUndefined()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })

    expect(api.getTaskStatus).toHaveBeenCalledTimes(1)
  })

  it('keeps retrying transient status failures beyond the former six-error limit', async () => {
    vi.useFakeTimers()
    vi.mocked(api.getTaskStatus).mockRejectedValue({
      message: 'timeout of 300000ms exceeded',
      code: 'ECONNABORTED',
      request: {},
    })

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'long-running-editable',
        taskId: 'task-long',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'RUNNING',
        progress: { total: 100, completed: 50, percent: 50 },
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('long-running-editable', 'project-a', 'task-long')
    })

    for (let i = 0; i < 7; i++) {
      await act(async () => {
        await vi.runOnlyPendingTimersAsync()
      })
    }

    const task = useExportTasksStore.getState().tasks[0]
    expect(api.getTaskStatus).toHaveBeenCalledTimes(8)
    expect(task.status).toBe('RUNNING')
    expect(task.progress?.percent).toBe(50)
    expect(task.monitoring?.state).toBe('retrying')
    expect(task.monitoring?.code).toBe('EXPORT_STATUS_CLIENT_TIMEOUT')
    expect(task.monitoring?.consecutiveErrors).toBe(8)
    expect(task.completedAt).toBeUndefined()
  })

  it('shows structured backend failure details without rewriting them as a generic timeout', async () => {
    vi.mocked(api.getTaskStatus).mockResolvedValue({
      data: {
        status: 'FAILED',
        error_message: '文本样式提取失败：图片识别服务请求超时',
        progress: {
          total: 100,
          completed: 50,
          percent: 50,
          backend_status: 'FAILED',
          error_code: 'EXPORT_STYLE_TIMEOUT',
          error_stage: 'style_extraction',
          error_details: {
            reason: 'timeout',
            provider: 'CodexTextProvider',
            model: 'gpt-5.4',
            request_timeout_seconds: 120,
            max_attempts: 5,
          },
        },
      },
    } as any)

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'backend-failed-editable',
        taskId: 'task-failed',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'RUNNING',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('backend-failed-editable', 'project-a', 'task-failed')
    })

    const task = useExportTasksStore.getState().tasks[0]
    expect(task.status).toBe('FAILED')
    expect(task.errorMessage).toBe('文本样式提取失败：图片识别服务请求超时')
    expect(task.progress?.error_code).toBe('EXPORT_STYLE_TIMEOUT')
    expect(task.progress?.error_details?.provider).toBe('CodexTextProvider')
    expect(task.completedAt).toBeTruthy()
  })

  it('does not poll tasks that are already completed', async () => {
    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'completed-export',
        taskId: 'task-a',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'COMPLETED',
      })
    })

    await act(async () => {
      await useExportTasksStore.getState().pollTask('completed-export', 'project-a', 'task-a')
    })

    expect(api.getTaskStatus).not.toHaveBeenCalled()
  })

  it('does not start duplicate polling loops for the same export task', async () => {
    let resolveStatus: (value: any) => void = () => {}
    vi.mocked(api.getTaskStatus).mockReturnValueOnce(new Promise(resolve => {
      resolveStatus = resolve
    }) as any)

    act(() => {
      useExportTasksStore.getState().addTask({
        id: 'active-editable',
        taskId: 'task-a',
        projectId: 'project-a',
        type: 'editable-pptx',
        status: 'PROCESSING',
      })
    })

    const firstPoll = useExportTasksStore.getState().pollTask('active-editable', 'project-a', 'task-a')

    await Promise.resolve()

    await act(async () => {
      await useExportTasksStore.getState().pollTask('active-editable', 'project-a', 'task-a')
    })

    expect(api.getTaskStatus).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveStatus({
        data: {
          status: 'COMPLETED',
          progress: {
            download_url: '/files/project-a/exports/demo.pptx',
          },
        },
      })
      await firstPoll
    })

    expect(useExportTasksStore.getState().tasks[0].status).toBe('COMPLETED')
  })
})
