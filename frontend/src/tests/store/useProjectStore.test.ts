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
}))

import { deleteTemplateAsset, uploadTemplateAsset } from '@/api/endpoints'

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
