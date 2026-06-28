import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useExportTasksStore } from '@/store/useExportTasksStore'

describe('useExportTasksStore', () => {
  beforeEach(() => {
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
})
