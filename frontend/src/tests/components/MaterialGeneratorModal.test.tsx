import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MaterialGeneratorModal } from '@/components/shared/MaterialGeneratorModal'
import { getTaskStatus } from '@/api/endpoints'

vi.stubGlobal('URL', {
  ...URL,
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
})

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string, params?: Record<string, string | number>) => {
    if (params) {
      return `${key}:${Object.values(params).join('x')}`
    }
    return key
  },
}))

vi.mock('@/store/useProjectStore', () => ({
  useProjectStore: (selector: any) => selector({ currentProject: null }),
}))

vi.mock('@/components/shared/Toast', () => ({
  useToast: () => ({ show: vi.fn() }),
}))

vi.mock('@/components/shared/MaterialSelector', () => ({
  MaterialSelector: () => null,
  materialUrlToFile: vi.fn(),
}))

vi.mock('@/api/endpoints', async () => {
  const actual = await vi.importActual<any>('@/api/endpoints')
  return {
    ...actual,
    processMaterialImage: vi.fn(),
    getTaskStatus: vi.fn(),
  }
})

describe('MaterialGeneratorModal', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('renders swiss-army tool modes', () => {
    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    expect(screen.getByText('material.toolGenerate')).toBeInTheDocument()
    expect(screen.getByText('material.toolEditFull')).toBeInTheDocument()
    expect(screen.getByText('material.toolRegionEdit')).toBeInTheDocument()
    expect(screen.getByText('material.toolEraseRegion')).toBeInTheDocument()
  })

  it('shows region apply mode controls when region edit is selected', () => {
    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    fireEvent.click(screen.getByText('material.toolRegionEdit'))

    expect(screen.getByText('material.applyModeLabel')).toBeInTheDocument()
    expect(screen.getByText('material.applyOverlay')).toBeInTheDocument()
    expect(screen.getByText('material.applyReplaceFull')).toBeInTheDocument()
  })

  it('triggers hidden file inputs from upload buttons', () => {
    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    const sourceClick = vi.spyOn(screen.getByTestId('material-source-input'), 'click')
    const refClick = vi.spyOn(screen.getByTestId('material-ref-input'), 'click')
    const extraClick = vi.spyOn(screen.getByTestId('material-extra-input'), 'click')

    fireEvent.click(screen.getByTestId('material-source-trigger'))
    fireEvent.click(screen.getByTestId('material-ref-trigger'))
    fireEvent.click(screen.getByTestId('material-extra-trigger'))

    expect(sourceClick).toHaveBeenCalledTimes(1)
    expect(refClick).toHaveBeenCalledTimes(1)
    expect(extraClick).toHaveBeenCalledTimes(1)
  })

  it('shows source preview after choosing a source image', () => {
    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    const file = new File(['fake-image'], 'source.png', { type: 'image/png' })
    const input = screen.getByTestId('material-source-input') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByAltText('material.sourceImage')).toBeInTheDocument()
  })

  it('toggles fullscreen mode from the header icon button', () => {
    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    const dialog = screen.getByRole('dialog')
    const toggle = screen.getByTestId('material-fullscreen-toggle')

    expect(dialog.className).toContain('max-w-[1120px]')

    fireEvent.click(toggle)
    expect(dialog.className).toContain('max-w-[calc(100vw-2rem)]')

    fireEvent.click(toggle)
    expect(dialog.className).toContain('max-w-[1120px]')
  })

  it('restores the last completed preview when reopened', async () => {
    sessionStorage.setItem(
      'banana-material-toolbox:global',
      JSON.stringify({
        taskId: 'task-complete',
        previewUrl: '/files/materials/restored.png',
        status: 'completed',
        updatedAt: Date.now(),
      })
    )

    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    await waitFor(() => {
      expect(screen.getByAltText('material.generatedResult')).toBeInTheDocument()
    })
  })

  it('resumes polling for a pending task when reopened', async () => {
    vi.mocked(getTaskStatus).mockResolvedValue({
      success: true,
      message: 'Success',
      data: {
        id: 'task-pending',
        task_id: 'task-pending',
        status: 'COMPLETED',
        progress: { image_url: '/files/materials/resumed.png' },
      },
    } as any)

    sessionStorage.setItem(
      'banana-material-toolbox:global',
      JSON.stringify({
        taskId: 'task-pending',
        previewUrl: null,
        status: 'pending',
        updatedAt: Date.now(),
      })
    )

    render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    await waitFor(() => {
      expect(getTaskStatus).toHaveBeenCalledWith('global', 'task-pending')
      expect(screen.getByAltText('material.generatedResult')).toBeInTheDocument()
    })
  })

  it('resets region apply mode to overlay when the modal is reopened', () => {
    vi.useFakeTimers()

    const { rerender } = render(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)

    fireEvent.click(screen.getByText('material.toolRegionEdit'))
    fireEvent.click(screen.getByText('material.applyReplaceFull'))
    expect(screen.getByText('material.applyReplaceFull').closest('button')?.className).toContain('border-banana-500')

    rerender(<MaterialGeneratorModal isOpen={false} onClose={() => {}} projectId={null} />)
    act(() => {
      vi.runAllTimers()
    })

    rerender(<MaterialGeneratorModal isOpen onClose={() => {}} projectId={null} />)
    fireEvent.click(screen.getByText('material.toolRegionEdit'))

    expect(screen.getByText('material.applyOverlay').closest('button')?.className).toContain('border-banana-500')
    expect(screen.getByText('material.applyReplaceFull').closest('button')?.className).not.toContain('border-banana-500')

    vi.useRealTimers()
  })
})
