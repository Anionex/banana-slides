/**
 * DescriptionCard 组件测试 - 验证图片粘贴功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DescriptionCard } from '@/components/preview/DescriptionCard'
import type { Page } from '@/types'

// Mock uploadMaterial
const mockUploadMaterial = vi.fn()
vi.mock('@/api/endpoints', () => ({
  uploadMaterial: (...args: any[]) => mockUploadMaterial(...args),
}))

// Mock MarkdownTextarea as a plain textarea so getByDisplayValue works
vi.mock('@/components/shared/MarkdownTextarea', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react')
  return {
    MarkdownTextarea: React.forwardRef(
      ({ value, onChange, onPaste, placeholder, label }: any, ref: any) => {
        const textareaRef = React.useRef<HTMLTextAreaElement>(null)
        React.useImperativeHandle(ref, () => ({
          insertAtCursor: (text: string) => {
            // Simulate inserting text at end
            onChange(value + text)
          },
          focus: () => textareaRef.current?.focus(),
        }))
        return (
          <div>
            {label && <label>{label}</label>}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e: any) => onChange(e.target.value)}
              onPaste={onPaste}
              placeholder={placeholder}
            />
          </div>
        )
      }
    ),
  }
})

// Mock useT hook to return the key as-is for testing
vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string, params?: Record<string, any>) => {
    if (params) {
      let result = key
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{{${k}}}`, String(v))
      }
      return result
    }
    return key
  },
}))

// Mock useGeneratingState hook
vi.mock('@/hooks/useGeneratingState', () => ({
  useDescriptionGeneratingState: (isGenerating: boolean) => isGenerating,
}))

// jsdom doesn't have URL.createObjectURL
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = vi.fn(() => 'blob:mock-url')
  URL.revokeObjectURL = vi.fn()
}

describe('DescriptionCard', () => {
  const mockPage: Page = {
    id: 'page-1',
    project_id: 'proj-1',
    order_index: 0,
    status: 'DESCRIPTION_GENERATED',
    description_content: { text: 'Test description content' },
    outline_content: { title: 'Test Page', points: ['point 1'] },
  } as Page

  const defaultProps = {
    page: mockPage,
    index: 0,
    projectId: 'proj-1',
    showToast: vi.fn(),
    onUpdate: vi.fn(),
    onRegenerate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders description text', () => {
    render(<DescriptionCard {...defaultProps} />)
    expect(screen.getByText('Test description content')).toBeInTheDocument()
  })

  it('renders page number', () => {
    render(<DescriptionCard {...defaultProps} />)
    expect(screen.getByText('descriptionCard.page')).toBeInTheDocument()
  })

  it('opens edit modal when edit button is clicked', () => {
    render(<DescriptionCard {...defaultProps} />)
    fireEvent.click(screen.getByText('common.edit'))
    // Modal should now be open with the textarea
    expect(screen.getByText('descriptionCard.descriptionTitle')).toBeInTheDocument()
  })

  it('saves edited content when save is clicked', async () => {
    const onUpdate = vi.fn()
    render(<DescriptionCard {...defaultProps} onUpdate={onUpdate} />)

    // Open edit modal
    fireEvent.click(screen.getByText('common.edit'))

    // Find textarea and change content
    const textarea = screen.getByDisplayValue('Test description content')
    fireEvent.change(textarea, { target: { value: 'Updated content' } })

    // Save
    fireEvent.click(screen.getByText('common.save'))

    expect(onUpdate).toHaveBeenCalledWith({
      description_content: { text: 'Updated content' },
    })
  })

  it('handles image paste in edit modal', async () => {
    mockUploadMaterial.mockResolvedValue({
      data: { url: 'https://example.com/uploaded-image.png' },
    })

    render(<DescriptionCard {...defaultProps} />)

    // Open edit modal
    fireEvent.click(screen.getByText('common.edit'))

    // Get the textarea
    const textarea = screen.getByDisplayValue('Test description content')

    // Create a mock paste event with an image file
    const file = new File(['image-data'], 'screenshot.png', { type: 'image/png' })
    const clipboardData = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        },
      ],
    }

    // Fire paste event
    fireEvent.paste(textarea, { clipboardData })

    // Wait for upload to complete
    await waitFor(() => {
      expect(mockUploadMaterial).toHaveBeenCalledWith(file, 'proj-1', true)
    })

    // The textarea value should contain the markdown image link after state update
    await waitFor(() => {
      const updatedTextarea = screen.getByRole('textbox') as HTMLTextAreaElement
      expect(updatedTextarea.value).toContain('![screenshot](https://example.com/uploaded-image.png)')
    })
  })

  it('does not trigger upload for non-image paste', () => {
    render(<DescriptionCard {...defaultProps} />)

    // Open edit modal
    fireEvent.click(screen.getByText('common.edit'))

    const textarea = screen.getByDisplayValue('Test description content')

    // Paste plain text (no file items)
    const clipboardData = {
      items: [
        {
          kind: 'string',
          type: 'text/plain',
          getAsFile: () => null,
        },
      ],
    }

    fireEvent.paste(textarea, { clipboardData })

    expect(mockUploadMaterial).not.toHaveBeenCalled()
  })

  it('shows no description message when description is empty', () => {
    const emptyPage = { ...mockPage, description_content: undefined }
    render(<DescriptionCard {...defaultProps} page={emptyPage as Page} />)
    expect(screen.getByText('descriptionCard.noDescription')).toBeInTheDocument()
  })

  it('shows generating state when isGenerating is true', () => {
    render(<DescriptionCard {...defaultProps} isGenerating={true} />)
    // "common.generating" appears both in skeleton area and regenerate button
    const generatingElements = screen.getAllByText('common.generating')
    expect(generatingElements.length).toBeGreaterThanOrEqual(1)
  })

  it('passes projectId to uploadMaterial for paste', async () => {
    mockUploadMaterial.mockResolvedValue({
      data: { url: 'https://example.com/img.png' },
    })

    render(<DescriptionCard {...defaultProps} projectId="proj-42" />)

    fireEvent.click(screen.getByText('common.edit'))

    const textarea = screen.getByDisplayValue('Test description content')

    const file = new File(['data'], 'img.png', { type: 'image/png' })
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        }],
      },
    })

    await waitFor(() => {
      expect(mockUploadMaterial).toHaveBeenCalledWith(file, 'proj-42', true)
    })
  })

  it('uses null projectId when not provided', async () => {
    mockUploadMaterial.mockResolvedValue({
      data: { url: 'https://example.com/img.png' },
    })

    render(<DescriptionCard {...defaultProps} projectId={undefined} />)

    fireEvent.click(screen.getByText('common.edit'))

    const textarea = screen.getByDisplayValue('Test description content')

    const file = new File(['data'], 'img.png', { type: 'image/png' })
    fireEvent.paste(textarea, {
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => file,
        }],
      },
    })

    await waitFor(() => {
      expect(mockUploadMaterial).toHaveBeenCalledWith(file, null, true)
    })
  })
})
