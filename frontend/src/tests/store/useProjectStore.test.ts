/**
 * Zustand Store 测试
 * 
 * 测试useProjectStore的核心状态管理功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from '@/store/useProjectStore'

// Mock API模块
vi.mock('@/api/endpoints', () => ({
  createProject: vi.fn(),
  getProject: vi.fn(),
  updatePage: vi.fn(),
  updatePageDescription: vi.fn(),
  updatePageOutline: vi.fn(),
  generateOutline: vi.fn(),
  generateDescriptions: vi.fn(),
  generateImages: vi.fn(),
  getTaskStatus: vi.fn(),
  exportPPTX: vi.fn(),
  exportPDF: vi.fn(),
  uploadTemplateAsset: vi.fn(),
  deleteTemplateAsset: vi.fn(),
  generateOutlineStream: vi.fn(),
}))

import {
  deleteTemplateAsset,
  generateDescriptions,
  generateOutlineStream,
  getProject,
  getTaskStatus,
  uploadTemplateAsset,
} from '@/api/endpoints'

describe('useProjectStore', () => {
  beforeEach(() => {
    // 重置store状态
    const { result } = renderHook(() => useProjectStore())
    act(() => {
      result.current.setCurrentProject(null)
      result.current.setError(null)
      result.current.setGlobalLoading(false)
      useProjectStore.setState({ templateAssets: [] })
    })
  })

  describe('初始状态', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useProjectStore())
      
      expect(result.current.currentProject).toBeNull()
      expect(result.current.isGlobalLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.activeTaskId).toBeNull()
    })
  })

  describe('基础Setters', () => {
    it('should set current project correctly', () => {
      const { result } = renderHook(() => useProjectStore())
      const mockProject = { 
        id: '123', 
        status: 'DRAFT',
        pages: [],
        created_at: new Date().toISOString()
      }
      
      act(() => {
        result.current.setCurrentProject(mockProject as any)
      })
      
      expect(result.current.currentProject).toEqual(mockProject)
    })

    it('should set global loading state', () => {
      const { result } = renderHook(() => useProjectStore())
      
      act(() => {
        result.current.setGlobalLoading(true)
      })
      
      expect(result.current.isGlobalLoading).toBe(true)
      
      act(() => {
        result.current.setGlobalLoading(false)
      })
      
      expect(result.current.isGlobalLoading).toBe(false)
    })

    it('should set error correctly', () => {
      const { result } = renderHook(() => useProjectStore())
      
      act(() => {
        result.current.setError('Test error')
      })
      
      expect(result.current.error).toBe('Test error')
      
      act(() => {
        result.current.setError(null)
      })
      
      expect(result.current.error).toBeNull()
    })
  })

  describe('本地页面更新', () => {
    it('should update page locally (optimistic update)', () => {
      const { result } = renderHook(() => useProjectStore())
      
      // 先设置项目
      const mockProject = {
        id: 'proj-123',
        status: 'DRAFT',
        pages: [
          { id: 'page-1', outline_content: { title: 'Page 1', points: [] } },
          { id: 'page-2', outline_content: { title: 'Page 2', points: [] } },
        ]
      }
      
      act(() => {
        result.current.setCurrentProject(mockProject as any)
      })
      
      // 更新页面
      act(() => {
        result.current.updatePageLocal('page-1', { 
          outline_content: { title: 'Updated Page 1', points: ['new point'] }
        })
      })
      
      // 验证乐观更新
      const updatedPage = result.current.currentProject?.pages.find(p => p.id === 'page-1')
      expect(updatedPage?.outline_content?.title).toBe('Updated Page 1')
    })
  })

  describe('模板资产删除', () => {
    it('should bind uploaded template by page_id and clear stale match metadata', async () => {
      vi.mocked(uploadTemplateAsset).mockResolvedValue({
        data: {
          asset: { id: 'asset-1', project_id: 'proj-123', image_path: 'a.png' },
          analyze_task_id: null,
        },
      } as any)
      const { result } = renderHook(() => useProjectStore())

      act(() => {
        result.current.setCurrentProject({
          id: 'proj-123',
          status: 'DRAFT',
          pages: [{
            page_id: 'page-1',
            template_asset_id: 'old-asset',
            template_selection_source: 'auto_match',
            template_match_reason: 'stale',
            template_match_confidence: 0.91,
          }],
        } as any)
      })

      await act(async () => {
        await result.current.uploadTemplateAsset(
          'proj-123',
          new File(['x'], 'a.png', { type: 'image/png' }),
          { bindToPageId: 'page-1' }
        )
      })

      const page = result.current.currentProject?.pages[0]
      expect(page?.template_asset_id).toBe('asset-1')
      expect(page?.template_selection_source).toBe('manual')
      expect(page?.template_match_reason).toBeNull()
      expect(page?.template_match_confidence).toBeNull()
    })

    it('should clear optimistic template match metadata for affected pages', async () => {
      vi.mocked(deleteTemplateAsset).mockResolvedValue({
        data: { cleared_page_ids: ['page-1'] },
      } as any)
      const { result } = renderHook(() => useProjectStore())

      act(() => {
        result.current.setCurrentProject({
          id: 'proj-123',
          status: 'DRAFT',
          pages: [
            {
              id: 'page-1',
              template_asset_id: 'asset-1',
              template_selection_source: 'auto_match',
              template_match_reason: 'fits',
              template_match_confidence: 0.92,
            },
            {
              id: 'page-2',
              template_asset_id: 'asset-2',
              template_selection_source: 'manual',
              template_match_reason: 'keep',
              template_match_confidence: 0.8,
            },
          ],
        } as any)
        useProjectStore.setState({
          templateAssets: [
          { id: 'asset-1', project_id: 'proj-123', image_path: 'a.png' },
          { id: 'asset-2', project_id: 'proj-123', image_path: 'b.png' },
          ] as any,
        })
      })

      await act(async () => {
        await result.current.deleteTemplateAsset('proj-123', 'asset-1')
      })

      expect(result.current.templateAssets.map((a) => a.id)).toEqual(['asset-2'])
      const clearedPage = result.current.currentProject?.pages[0]
      expect(clearedPage?.template_asset_id).toBeNull()
      expect(clearedPage?.template_selection_source).toBeNull()
      expect(clearedPage?.template_match_reason).toBeNull()
      expect(clearedPage?.template_match_confidence).toBeNull()
      expect(result.current.currentProject?.pages[1].template_match_reason).toBe('keep')
    })
  })

  describe('清除状态', () => {
    it('should clear project by setting null', () => {
      const { result } = renderHook(() => useProjectStore())
      
      // 先设置项目
      act(() => {
        result.current.setCurrentProject({ id: '123', pages: [] } as any)
      })
      
      expect(result.current.currentProject).not.toBeNull()
      
      // 清除
      act(() => {
        result.current.setCurrentProject(null)
      })
      
      expect(result.current.currentProject).toBeNull()
    })
  })
})

describe('useProjectStore 流式大纲项目隔离', () => {
  const projectA = { id: 'proj-a', status: 'DRAFT', pages: [], created_at: '2026-01-01T00:00:00' }
  const projectB = { id: 'proj-b', status: 'DRAFT', pages: [], created_at: '2026-01-01T00:00:00' }

  beforeEach(() => {
    vi.mocked(generateOutlineStream).mockReset()
    useProjectStore.setState({
      currentProject: null,
      error: null,
      isOutlineStreaming: false,
      outlineStreamingProjectIds: [],
    })
  })

  it('离开项目后，该项目的流式失败不设置错误、不抛出并返回 active=false', async () => {
    const { result } = renderHook(() => useProjectStore())
    let rejectStream!: (err: Error) => void
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      () => new Promise<void>((_, reject) => { rejectStream = reject })
    )

    act(() => { result.current.setCurrentProject(projectA as any) })

    let pending!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pending = result.current.generateOutlineStream() })

    // 流未结束时切到另一个项目
    act(() => { result.current.setCurrentProject(projectB as any) })

    await act(async () => {
      rejectStream(new Error('Failed to fetch'))
      await expect(pending).resolves.toEqual({ complete: false, active: false })
    })

    expect(result.current.error).toBeNull()
    expect(result.current.isOutlineStreaming).toBe(false)
    expect(result.current.outlineStreamingProjectIds).toEqual([])
    expect(result.current.currentProject?.id).toBe('proj-b')
  })

  it('流进行中切到其他项目时，页面与完成回调不写入当前项目', async () => {
    const { result } = renderHook(() => useProjectStore())
    let emitPage!: (page: any) => void
    let emitDone!: (data: any) => void
    let resolveStream!: () => void
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      ((projectId: string, callbacks: any) => new Promise<void>((resolve) => {
        emitPage = callbacks.onPage
        emitDone = callbacks.onDone
        resolveStream = resolve
      })) as any
    )

    act(() => { result.current.setCurrentProject(projectA as any) })
    let pending!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pending = result.current.generateOutlineStream() })

    // 流未结束时切到另一个项目
    act(() => { result.current.setCurrentProject(projectB as any) })

    await act(async () => {
      // 页面事件与完成事件现在才到达，且当前项目是 B
      emitPage({ index: 0, title: 'Source page', points: ['p'] })
      emitDone({ total: 1, complete: true, pages: [{ id: 'real-1', order_index: 0, outline_content: { title: 'Source page', points: ['p'] } }] })
      resolveStream()
      await expect(pending).resolves.toEqual({ complete: true, active: false })
    })

    // B 的页面保持不变，错误状态保持为空
    expect(result.current.currentProject?.id).toBe('proj-b')
    expect(result.current.currentProject?.pages).toHaveLength(0)
    expect(result.current.error).toBeNull()
    expect(result.current.isOutlineStreaming).toBe(false)
  })

  it('SSE error 事件在切走项目后到达时不设置错误、不抛出', async () => {
    const { result } = renderHook(() => useProjectStore())
    let emitError!: (message: string) => void
    let resolveStream!: () => void
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      ((projectId: string, callbacks: any) => new Promise<void>((resolve) => {
        emitError = callbacks.onError
        resolveStream = resolve
      })) as any
    )

    act(() => { result.current.setCurrentProject(projectA as any) })
    let pending!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pending = result.current.generateOutlineStream() })

    // 流未结束时切到另一个项目
    act(() => { result.current.setCurrentProject(projectB as any) })

    await act(async () => {
      emitError('AI service unavailable')
      resolveStream()
      await expect(pending).resolves.toEqual({ complete: false, active: false })
    })

    expect(result.current.error).toBeNull()
    expect(result.current.currentProject?.id).toBe('proj-b')
    expect(result.current.currentProject?.pages).toHaveLength(0)
  })

  it('两个项目可同时流式生成，A 结束后 B 仍保持 streaming', async () => {
    const { result } = renderHook(() => useProjectStore())
    const resolvers: Array<() => void> = []
    vi.mocked(generateOutlineStream).mockImplementation(
      () => new Promise<void>((resolve) => { resolvers.push(resolve) })
    )

    act(() => { result.current.setCurrentProject(projectA as any) })
    let pendingA!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pendingA = result.current.generateOutlineStream() })
    expect(result.current.outlineStreamingProjectIds).toEqual(['proj-a'])
    expect(result.current.isOutlineStreaming).toBe(true)

    act(() => { result.current.setCurrentProject(projectB as any) })
    let pendingB!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pendingB = result.current.generateOutlineStream() })
    expect([...result.current.outlineStreamingProjectIds].sort()).toEqual(['proj-a', 'proj-b'])
    expect(result.current.isOutlineStreaming).toBe(true)

    // A 先完成：只清理 A，B 仍在流式
    await act(async () => { resolvers[0](); await pendingA })
    expect(result.current.outlineStreamingProjectIds).toEqual(['proj-b'])
    expect(result.current.isOutlineStreaming).toBe(true)

    // B 完成：全部清理
    await act(async () => { resolvers[1](); await pendingB })
    expect(result.current.outlineStreamingProjectIds).toEqual([])
    expect(result.current.isOutlineStreaming).toBe(false)
  })

  it('停留在发起项目时，流式失败仍设置错误并抛出', async () => {
    const { result } = renderHook(() => useProjectStore())
    let rejectStream!: (err: Error) => void
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      () => new Promise<void>((_, reject) => { rejectStream = reject })
    )

    act(() => { result.current.setCurrentProject(projectA as any) })

    let pending!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { pending = result.current.generateOutlineStream() })

    await act(async () => {
      rejectStream(new Error('boom'))
      await expect(pending).rejects.toThrow('boom')
    })

    expect(result.current.error).toBe('boom')
    expect(result.current.isOutlineStreaming).toBe(false)
  })

  it('页面事件后传输失败时等待队列结束并恢复原页面', async () => {
    const oldPage = { id: 'old-page', order_index: 0, outline_content: { title: 'Old', points: [] } }
    const { result } = renderHook(() => useProjectStore())
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      (async (_projectId: string, callbacks: any) => {
        callbacks.onPage({ index: 0, title: 'Temporary', points: ['p'] })
        throw new Error('connection reset')
      }) as any
    )

    act(() => { result.current.setCurrentProject({ ...projectA, pages: [oldPage] } as any) })

    await act(async () => {
      await expect(result.current.generateOutlineStream()).rejects.toThrow('connection reset')
    })

    expect(result.current.currentProject?.pages).toEqual([oldPage])
  })

  it('done 事件后的传输失败保留已持久化的新页面', async () => {
    const newPage = { id: 'new-page', order_index: 0, outline_content: { title: 'New', points: [] } }
    const { result } = renderHook(() => useProjectStore())
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      (async (_projectId: string, callbacks: any) => {
        callbacks.onDone({ total: 1, complete: true, pages: [newPage] })
        throw new Error('connection reset after done')
      }) as any
    )

    act(() => { result.current.setCurrentProject(projectA as any) })

    await act(async () => {
      await expect(result.current.generateOutlineStream()).resolves.toEqual({ complete: true, active: true })
    })

    expect(result.current.currentProject?.pages).toEqual([newPage])
    expect(result.current.error).toBeNull()
  })

  it('同项目已有流式任务时，重复调用直接返回', async () => {
    const { result } = renderHook(() => useProjectStore())
    let resolveStream!: () => void
    vi.mocked(generateOutlineStream).mockImplementationOnce(
      () => new Promise<void>((resolve) => { resolveStream = resolve })
    )

    act(() => { result.current.setCurrentProject(projectA as any) })
    let first!: Promise<{ complete: boolean; active: boolean } | undefined>
    act(() => { first = result.current.generateOutlineStream() })
    const second = await act(async () => result.current.generateOutlineStream())
    expect(second).toBeUndefined()
    expect(vi.mocked(generateOutlineStream)).toHaveBeenCalledTimes(1)

    // 收尾后状态复位
    resolveStream()
    await act(async () => { await first })
    expect(result.current.isOutlineStreaming).toBe(false)
  })
})

describe('useProjectStore 描述失败回滚', () => {
  beforeEach(() => {
    vi.mocked(generateDescriptions).mockReset()
    vi.mocked(getProject).mockReset()
    vi.mocked(getTaskStatus).mockReset()
    sessionStorage.setItem('banana-settings', JSON.stringify({ description_generation_mode: 'parallel' }))
    window.history.pushState({}, '', '/project/proj-desc/detail')
    useProjectStore.setState({
      currentProject: {
        id: 'proj-desc',
        status: 'OUTLINE_GENERATED',
        pages: [{ id: 'page-1', status: 'DRAFT', order_index: 0, outline_content: { title: 'Page', points: [] } }],
      } as any,
      error: null,
    })
  })

  it('补偿同步失败时仍回滚乐观生成状态', async () => {
    vi.mocked(generateDescriptions).mockRejectedValueOnce(new Error('start failed'))
    vi.mocked(getProject).mockRejectedValueOnce(new Error('sync failed'))
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await expect(result.current.generateDescriptions()).rejects.toThrow('start failed')
    })

    expect(result.current.currentProject?.pages[0].status).toBe('DRAFT')
  })

  it('轮询连续失败后保持生成锁定并继续恢复任务状态', async () => {
    vi.useFakeTimers()
    vi.mocked(generateDescriptions).mockResolvedValueOnce({ data: { task_id: 'task-desc' } } as any)
    vi.mocked(getTaskStatus).mockRejectedValue(new Error('poll unavailable'))
    vi.mocked(getProject).mockRejectedValue(new Error('sync unavailable'))
    const completedProject = {
      ...useProjectStore.getState().currentProject,
      pages: [{ id: 'page-1', status: 'DESCRIPTION_GENERATED', order_index: 0, outline_content: { title: 'Page', points: [] } }],
    }
    const { result } = renderHook(() => useProjectStore())

    try {
      await act(async () => {
        await result.current.generateDescriptions()
      })

      expect(result.current.activeTaskId).toBe('task-desc')
      expect(result.current.currentProject?.pages[0].status).toBe('GENERATING_DESCRIPTION')

      for (let attempt = 0; attempt < 10; attempt++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(2000)
        })
      }

      expect(vi.mocked(getTaskStatus)).toHaveBeenCalledTimes(10)
      expect(result.current.activeTaskId).toBe('task-desc')
      expect(result.current.currentProject?.pages[0].status).toBe('GENERATING_DESCRIPTION')

      await act(async () => {
        await result.current.generateDescriptions()
      })
      expect(vi.mocked(generateDescriptions)).toHaveBeenCalledTimes(1)

      vi.mocked(getTaskStatus).mockResolvedValue({
        data: { task_id: 'task-desc', status: 'COMPLETED' },
      } as any)
      window.history.pushState({}, '', '/')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10000)
      })

      expect(vi.mocked(getTaskStatus)).toHaveBeenCalledTimes(11)
      expect(result.current.activeTaskId).toBe('task-desc')
      expect(result.current.currentProject?.pages[0].status).toBe('GENERATING_DESCRIPTION')

      window.history.pushState({}, '', '/project/proj-desc/detail')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(vi.mocked(getTaskStatus)).toHaveBeenCalledTimes(12)
      expect(result.current.activeTaskId).toBe('task-desc')
      expect(result.current.currentProject?.pages[0].status).toBe('GENERATING_DESCRIPTION')

      vi.mocked(getProject).mockResolvedValue({ data: completedProject } as any)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(vi.mocked(getTaskStatus)).toHaveBeenCalledTimes(13)
      expect(result.current.activeTaskId).toBeNull()
      expect(result.current.currentProject?.pages[0].status).toBe('DESCRIPTION_GENERATED')
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })

  it('任务在 Home 失败时等待返回来源项目同步部分成功结果', async () => {
    vi.useFakeTimers()
    vi.mocked(generateDescriptions).mockResolvedValueOnce({ data: { task_id: 'task-partial' } } as any)
    vi.mocked(getTaskStatus).mockResolvedValue({
      data: {
        task_id: 'task-partial',
        status: 'FAILED',
        error_message: 'API quota or balance is insufficient',
      },
    } as any)
    const finalProject = {
      ...useProjectStore.getState().currentProject,
      pages: [{
        id: 'page-1',
        status: 'DESCRIPTION_GENERATED',
        order_index: 0,
        outline_content: { title: 'Page', points: [] },
        description_content: { text: 'backend partial result' },
      }],
    }
    vi.mocked(getProject).mockResolvedValue({ data: finalProject } as any)
    const { result } = renderHook(() => useProjectStore())

    try {
      await act(async () => {
        await result.current.generateDescriptions()
      })
      window.history.pushState({}, '', '/')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(result.current.activeTaskId).toBe('task-partial')
      expect(result.current.currentProject?.pages[0].status).toBe('GENERATING_DESCRIPTION')
      expect(result.current.errorRecovery?.path).toBe('/project/proj-desc/detail')
      expect(getProject).not.toHaveBeenCalled()

      window.history.pushState({}, '', '/project/proj-desc/detail')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })

      expect(result.current.activeTaskId).toBeNull()
      expect(result.current.currentProject?.pages[0].description_content).toEqual({ text: 'backend partial result' })
    } finally {
      vi.clearAllTimers()
      vi.useRealTimers()
    }
  })
})
