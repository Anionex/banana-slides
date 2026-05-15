import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TemplateSelector } from '@/components/shared/TemplateSelector'

const mocks = vi.hoisted(() => ({
  show: vi.fn(),
  listUserTemplates: vi.fn(),
  createTemplateCandidates: vi.fn(),
}))

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}))

vi.mock('@/components/shared', async () => {
  const actual = await vi.importActual<any>('@/components/shared')
  return {
    ...actual,
    useToast: () => ({
      show: mocks.show,
      ToastContainer: () => null,
    }),
  }
})

vi.mock('@/components/shared/MaterialSelector', () => ({
  MaterialSelector: () => null,
  materialUrlToFile: vi.fn(),
}))

vi.mock('@/api/client', () => ({
  getImageUrl: (url: string) => url,
}))

vi.mock('@/api/endpoints', async () => {
  const actual = await vi.importActual<any>('@/api/endpoints')
  return {
    ...actual,
    listUserTemplates: mocks.listUserTemplates,
    createTemplateCandidates: mocks.createTemplateCandidates,
    uploadUserTemplate: vi.fn(),
    deleteUserTemplate: vi.fn(),
  }
})

describe('TemplateSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listUserTemplates.mockResolvedValue({ data: { templates: [] } })
    mocks.createTemplateCandidates.mockResolvedValue({
      data: {
        prompt: 'Generate slide template/style candidate images',
        usage: 'Selecting a candidate must continue through the existing project template upload flow',
        candidates: [
          {
            candidate_id: 'project-1-candidate-1',
            image_url: 'data:image/png;base64,ZmFrZQ==',
          },
        ],
      },
    })
    vi.mocked(fetch).mockResolvedValue({
      blob: async () => new Blob(['fake-image'], { type: 'image/png' }),
    } as Response)
  })

  it('generates transient candidates and selects one through the existing upload flow', async () => {
    const onSelect = vi.fn()

    render(
      <TemplateSelector
        onSelect={onSelect}
        selectedTemplateId={null}
        selectedPresetTemplateId={null}
        projectId="project-1"
      />
    )

    fireEvent.change(screen.getByPlaceholderText('template.stylePromptPlaceholder'), {
      target: { value: 'minimal business blue white' },
    })
    fireEvent.click(screen.getByText('template.generateCandidates'))

    await waitFor(() => {
      expect(mocks.createTemplateCandidates).toHaveBeenCalledWith('project-1', 'minimal business blue white')
      expect(screen.getByText('project-1-candidate-1')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('project-1-candidate-1'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('data:image/png;base64,ZmFrZQ==')
      expect(onSelect).toHaveBeenCalledTimes(1)
    })

    const selectedFile = onSelect.mock.calls[0][0]
    expect(selectedFile).toBeInstanceOf(File)
    expect(selectedFile.name).toBe('project-1-candidate-1.png')
    expect(selectedFile.type).toBe('image/png')
    expect(mocks.show).toHaveBeenCalledWith({ message: 'template.messages.candidateSelected', type: 'success' })
  })

  it('shows candidate hint text that keeps template semantics explicit', () => {
    render(
      <TemplateSelector
        onSelect={vi.fn()}
        selectedTemplateId={null}
        selectedPresetTemplateId={null}
        projectId="project-1"
      />
    )

    expect(screen.getByText('template.styleCandidatesHint')).toBeInTheDocument()
    expect(screen.getByText('template.styleCandidates')).toBeInTheDocument()
  })
})
