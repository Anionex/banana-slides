/**
 * initializeProject 测试 - 验证参考文件在 AI 生成前被关联到项目
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProjectStore } from '@/store/useProjectStore'

// Track call order to verify files are associated before generation
const callOrder: string[] = []

const mockCreateProject = vi.fn()
const mockGetProject = vi.fn()
const mockAssociateFileToProject = vi.fn()
const mockUploadTemplate = vi.fn()
const mockGenerateFromDescription = vi.fn()
const mockGenerateOutline = vi.fn()

vi.mock('@/api/endpoints', () => ({
  createProject: (...args: any[]) => {
    callOrder.push('createProject')
    return mockCreateProject(...args)
  },
  getProject: (...args: any[]) => {
    callOrder.push('getProject')
    return mockGetProject(...args)
  },
  associateFileToProject: (...args: any[]) => {
    callOrder.push('associateFileToProject')
    return mockAssociateFileToProject(...args)
  },
  uploadTemplate: (...args: any[]) => {
    callOrder.push('uploadTemplate')
    return mockUploadTemplate(...args)
  },
  generateFromDescription: (...args: any[]) => {
    callOrder.push('generateFromDescription')
    return mockGenerateFromDescription(...args)
  },
  generateOutline: (...args: any[]) => {
    callOrder.push('generateOutline')
    return mockGenerateOutline(...args)
  },
  // Other mocks needed by the store
  updatePage: vi.fn(),
  updatePageDescription: vi.fn(),
  updatePageOutline: vi.fn(),
  generateDescriptions: vi.fn(),
  generateImages: vi.fn(),
  getTaskStatus: vi.fn(),
  exportPPTX: vi.fn(),
  exportPDF: vi.fn(),
  getStoredOutputLanguage: vi.fn().mockResolvedValue('zh'),
}))

vi.mock('@/api/auth', () => ({
  refreshCredits: vi.fn(),
}))

vi.mock('@/utils', () => ({
  debounce: (fn: any) => fn,
  isDesktop: false,
  normalizeProject: (data: any) => data,
  normalizeErrorMessage: (msg: string) => msg,
}))

describe('initializeProject - reference file association', () => {
  beforeEach(() => {
    callOrder.length = 0
    vi.clearAllMocks()

    // Default mock responses
    mockCreateProject.mockResolvedValue({
      data: { project_id: 'proj-001' }
    })
    mockGetProject.mockResolvedValue({
      data: { id: 'proj-001', status: 'DRAFT', pages: [] }
    })
    mockAssociateFileToProject.mockResolvedValue({
      data: { file: { id: 'file-1', project_id: 'proj-001' } }
    })
    mockUploadTemplate.mockResolvedValue({ data: {} })
    mockGenerateFromDescription.mockResolvedValue({ data: {} })
    mockGenerateOutline.mockResolvedValue({ data: {} })
    localStorage.clear()

    // Reset store
    const { result } = renderHook(() => useProjectStore())
    act(() => {
      result.current.setCurrentProject(null)
      result.current.setError(null)
      result.current.setGlobalLoading(false)
    })
  })

  it('should pass reference file IDs and associate them after project creation', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test idea prompt',
        undefined,
        undefined,
        ['file-1', 'file-2']
      )
    })

    expect(mockAssociateFileToProject).toHaveBeenCalledTimes(2)
    expect(mockAssociateFileToProject).toHaveBeenCalledWith('file-1', 'proj-001')
    expect(mockAssociateFileToProject).toHaveBeenCalledWith('file-2', 'proj-001')
  })

  it('should associate files before loading the created description project', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'description',
        'Full description text',
        undefined,
        undefined,
        ['file-1']
      )
    })

    // Verify call order: create → associate → get project. SSE generation starts on the outline page.
    const createIdx = callOrder.indexOf('createProject')
    const associateIdx = callOrder.indexOf('associateFileToProject')
    const getProjectIdx = callOrder.indexOf('getProject')

    expect(createIdx).toBeLessThan(associateIdx)
    expect(associateIdx).toBeLessThan(getProjectIdx)
    expect(mockGenerateFromDescription).not.toHaveBeenCalled()
    expect(mockGenerateOutline).not.toHaveBeenCalled()
    expect(localStorage.getItem('currentProjectId')).toBe('proj-001')
  })

  it('should create outline projects without calling the long synchronous generation endpoint', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('outline', 'Slide 1\n- Point')
    })

    expect(mockGenerateOutline).not.toHaveBeenCalled()
    expect(mockGenerateFromDescription).not.toHaveBeenCalled()
    expect(localStorage.getItem('currentProjectId')).toBe('proj-001')
  })

  it('should trim project content before sending it to the API', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('outline', '  Slide 1\n- Point  ')
    })

    expect(mockCreateProject).toHaveBeenCalledWith({
      outline_text: 'Slide 1\n- Point',
    })
  })

  it('should safely normalize an unexpected non-string content value', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('idea', null as unknown as string)
    })

    expect(mockCreateProject).toHaveBeenCalledWith({ idea_prompt: '' })
  })

  it('should not call associateFileToProject when no file IDs provided', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('idea', 'Test prompt')
    })

    expect(mockAssociateFileToProject).not.toHaveBeenCalled()
  })

  it('should not call associateFileToProject when empty array provided', async () => {
    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject('idea', 'Test prompt', undefined, undefined, [])
    })

    expect(mockAssociateFileToProject).not.toHaveBeenCalled()
  })

  it('should continue even if file association fails', async () => {
    mockAssociateFileToProject.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test prompt',
        undefined,
        undefined,
        ['file-1']
      )
    })

    // Should still complete successfully
    expect(result.current.currentProject).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should associate files before uploading template', async () => {
    const templateFile = new File(['dummy'], 'template.png', { type: 'image/png' })

    const { result } = renderHook(() => useProjectStore())

    await act(async () => {
      await result.current.initializeProject(
        'idea',
        'Test prompt',
        templateFile,
        undefined,
        ['file-1']
      )
    })

    const associateIdx = callOrder.indexOf('associateFileToProject')
    const templateIdx = callOrder.indexOf('uploadTemplate')

    expect(associateIdx).toBeLessThan(templateIdx)
  })
})
