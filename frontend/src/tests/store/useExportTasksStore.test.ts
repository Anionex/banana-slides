import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { useExportTasksStore } from '@/store/useExportTasksStore'
import * as api from '@/api/endpoints'

vi.mock('@/api/endpoints', () => ({
  getTaskStatus: vi.fn(),
}))

describe('useExportTasksStore', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    act(() => {
      useExportTasksStore.setState({ tasks: [] })
    })
    window.localStorage.clear()
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

  it('marks a restored active task as failed when the backend no longer returns task data', async () => {
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
    expect(task?.status).toBe('FAILED')
    expect(task?.errorMessage).toMatch(/导出任务已不可用|no longer available/)
    expect(task?.completedAt).toBeTruthy()
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
})
