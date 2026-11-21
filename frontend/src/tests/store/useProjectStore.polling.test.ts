import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getProject, getTaskStatus } from '@/api/endpoints'
import { useProjectStore } from '@/store/useProjectStore'
import type { ApiResponse, Project, Task } from '@/types'

vi.mock('@/api/endpoints', () => ({
  getProject: vi.fn(),
  getTaskStatus: vi.fn(),
}))

const progress = { total: 3, completed: 1 }

function project(id: string, pages: Project['pages'] = []): Project {
  return {
    id,
    project_id: id,
    idea_prompt: '',
    created_at: '',
    updated_at: '',
    status: 'DRAFT',
    pages,
  }
}

// The backend or a proxy can return null even though the expected payload is a task.
const emptyTask = { success: true, data: null } as unknown as ApiResponse<Task>

function deferredTask() {
  let resolve!: (response: ApiResponse<Task>) => void
  const response = new Promise<ApiResponse<Task>>(settle => { resolve = settle })
  vi.mocked(getTaskStatus).mockReturnValueOnce(response)
  return resolve
}

describe('useProjectStore task polling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useProjectStore.setState({
      currentProject: project('project-a'),
      activeTaskId: 'task-a',
      isGlobalLoading: true,
      taskProgress: progress,
      pageGeneratingTasks: {},
      error: null,
    })
  })

  afterEach(() => vi.useRealTimers())

  it('clears the active task if its project is gone', async () => {
    useProjectStore.setState({ currentProject: null })

    await useProjectStore.getState().pollTask('task-a')

    expect(getTaskStatus).not.toHaveBeenCalled()
    expect(useProjectStore.getState()).toMatchObject({
      activeTaskId: null,
      taskProgress: null,
      isGlobalLoading: false,
    })
  })

  it('clears the active task on a successful response with no task', async () => {
    vi.mocked(getTaskStatus).mockResolvedValueOnce(emptyTask)

    await useProjectStore.getState().pollTask('task-a')

    expect(getTaskStatus).toHaveBeenCalledWith('project-a', 'task-a')
    expect(useProjectStore.getState()).toMatchObject({
      activeTaskId: null,
      taskProgress: null,
      isGlobalLoading: false,
    })
  })

  it.each(['project-a', 'project-b'])(
    'keeps a newer active task in %s when an old response arrives',
    async projectId => {
      const resolve = deferredTask()
      const polling = useProjectStore.getState().pollTask('task-a')
      useProjectStore.setState({ currentProject: project(projectId), activeTaskId: 'task-b' })

      resolve(emptyTask)
      await polling

      expect(useProjectStore.getState()).toMatchObject({
        activeTaskId: 'task-b',
        taskProgress: progress,
        isGlobalLoading: true,
      })
    },
  )

  it('stops applying progress when the polled project is no longer open', async () => {
    const resolve = deferredTask()
    const polling = useProjectStore.getState().pollTask('task-a')
    const nextProject = project('project-b')
    useProjectStore.setState({ currentProject: nextProject })

    resolve({ data: { task_id: 'task-a', status: 'COMPLETED', progress } })
    await polling

    expect(getProject).not.toHaveBeenCalled()
    expect(useProjectStore.getState()).toMatchObject({
      currentProject: nextProject,
      activeTaskId: null,
      taskProgress: null,
      isGlobalLoading: false,
    })
  })

  it('continues polling a pending task until it completes and refreshes its project', async () => {
    vi.useFakeTimers()
    vi.mocked(getTaskStatus)
      .mockResolvedValueOnce({ data: { task_id: 'task-a', status: 'PENDING', progress } })
      .mockResolvedValueOnce({ data: { task_id: 'task-a', status: 'COMPLETED', progress } })
    vi.mocked(getProject).mockResolvedValueOnce({ data: project('project-a') })

    await useProjectStore.getState().pollTask('task-a')
    expect(useProjectStore.getState().isGlobalLoading).toBe(true)
    await vi.advanceTimersByTimeAsync(2000)

    expect(getTaskStatus).toHaveBeenCalledTimes(2)
    expect(getProject).toHaveBeenCalledWith('project-a')
    expect(useProjectStore.getState()).toMatchObject({
      activeTaskId: null,
      taskProgress: null,
      isGlobalLoading: false,
    })
  })

  it('clears only the image page markers owned by a task with no current project', async () => {
    useProjectStore.setState({
      currentProject: null,
      pageGeneratingTasks: { 'page-a': 'task-a', 'page-b': 'task-b' },
    })

    await useProjectStore.getState().pollImageTask('task-a', ['page-a', 'page-b'])

    expect(getTaskStatus).not.toHaveBeenCalled()
    expect(useProjectStore.getState().pageGeneratingTasks).toEqual({ 'page-b': 'task-b' })
  })

  it('clears only markers still owned by an image task when its response is empty', async () => {
    const resolve = deferredTask()
    useProjectStore.setState({
      pageGeneratingTasks: { 'page-a': 'task-a', 'page-b': 'task-a' },
    })
    useProjectStore.getState().pollImageTask('task-a', ['page-a', 'page-b'])
    useProjectStore.setState({
      currentProject: project('project-b'),
      pageGeneratingTasks: { 'page-a': 'task-a', 'page-b': 'task-b', 'page-c': 'task-c' },
    })

    resolve(emptyTask)

    expect(getTaskStatus).toHaveBeenCalledWith('project-a', 'task-a')
    await vi.waitFor(() => expect(useProjectStore.getState().pageGeneratingTasks).toEqual({
      'page-b': 'task-b',
      'page-c': 'task-c',
    }))
  })

  it('keeps other image tasks active when a normal image generation completes', async () => {
    useProjectStore.setState({
      pageGeneratingTasks: { 'page-a': 'task-a', 'page-b': 'task-b' },
    })
    vi.mocked(getTaskStatus).mockResolvedValueOnce({
      data: { task_id: 'task-a', status: 'COMPLETED', progress },
    })
    vi.mocked(getProject).mockResolvedValueOnce({
      data: project('project-a', [{
        page_id: 'page-a',
        order_index: 0,
        outline_content: null,
        status: 'COMPLETED',
        generated_image_path: 'project-a/page-a.png',
      }]),
    })

    await useProjectStore.getState().pollImageTask('task-a', ['page-a'])

    await vi.waitFor(() => expect(useProjectStore.getState().currentProject?.pages[0]?.generated_image_path)
      .toBe('project-a/page-a.png'))
    expect(useProjectStore.getState().pageGeneratingTasks).toEqual({ 'page-b': 'task-b' })
  })
})
