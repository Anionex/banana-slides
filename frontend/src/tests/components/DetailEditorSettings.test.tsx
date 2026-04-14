import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DetailEditor } from '@/pages/DetailEditor'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  syncProject: vi.fn(),
  updatePageLocal: vi.fn(),
  generateDescriptions: vi.fn(),
  generatePageDescription: vi.fn(),
  regenerateRenovationPage: vi.fn(),
  showToast: vi.fn(),
  refineDescriptions: vi.fn(),
  getTaskStatus: vi.fn(),
  addPage: vi.fn(),
  updateProject: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
}))

const project = {
  id: 'test-id',
  creation_type: 'outline',
  description_requirements: '',
  pages: [
    {
      id: 'page-1',
      order_index: 0,
      outline_content: { title: 'Page 1', points: ['Point 1'] },
      description_content: { text: 'Description 1' },
    },
  ],
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ projectId: 'test-id' }),
  useLocation: () => ({ state: null }),
}))

vi.mock('@/hooks/useT', () => ({
  useT: (i18n: any) => (key: string, params?: Record<string, string | number>) => {
    const value = key.split('.').reduce<any>((acc, part) => acc?.[part], i18n.en)
    if (typeof value !== 'string') return key
    if (!params) return value
    return Object.entries(params).reduce(
      (result, [paramKey, paramValue]) => result.replace(`{{${paramKey}}}`, String(paramValue)),
      value
    )
  },
}))

vi.mock('@/pages/Settings', () => ({
  Settings: () => <div>Mock Settings Component</div>,
}))

vi.mock('@/components/shared/Modal', () => ({
  Modal: ({ isOpen, title, children }: any) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}))

vi.mock('@/components/shared', () => ({
  Button: ({ children, icon, title, onClick, disabled, className }: any) => (
    <button type="button" title={title} onClick={onClick} disabled={disabled} className={className}>
      {icon}
      {children}
    </button>
  ),
  Loading: ({ message }: any) => <div>{message ?? 'Loading'}</div>,
  useConfirm: () => ({ confirm: vi.fn(), ConfirmDialog: null }),
  useToast: () => ({ show: mocks.showToast, ToastContainer: () => null }),
  AiRefineInput: () => <div data-testid="ai-refine-input" />,
  FilePreviewModal: () => null,
  ReferenceFileList: () => <div data-testid="reference-file-list" />,
  MaterialSelector: () => null,
}))

vi.mock('@/components/shared/MarkdownTextarea', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const React = require('react')
  return {
    MarkdownTextarea: React.forwardRef(({ value, onChange, label, placeholder }: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        insertAtCursor: vi.fn(),
      }))
      return (
        <label>
          {label}
          <textarea
            value={value}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
            placeholder={placeholder}
          />
        </label>
      )
    }),
  }
})

vi.mock('@/components/preview/DescriptionCard', () => ({
  DescriptionCard: ({ page }: any) => <div>{page.outline_content.title}</div>,
}))

vi.mock('@/components/shared/PresetCapsules', () => ({
  default: () => <div data-testid="preset-capsules" />,
}))

vi.mock('@/hooks/useImagePaste', () => ({
  useImagePaste: () => ({
    handlePaste: vi.fn(),
    handleFiles: vi.fn(),
    isUploading: false,
  }),
  buildMaterialsMarkdown: vi.fn(() => ''),
}))

vi.mock('@/store/useProjectStore', () => ({
  useProjectStore: () => ({
    currentProject: project,
    syncProject: mocks.syncProject,
    updatePageLocal: mocks.updatePageLocal,
    generateDescriptions: mocks.generateDescriptions,
    generatePageDescription: mocks.generatePageDescription,
    regenerateRenovationPage: mocks.regenerateRenovationPage,
  }),
}))

vi.mock('@/api/endpoints', () => ({
  refineDescriptions: (...args: any[]) => mocks.refineDescriptions(...args),
  getTaskStatus: (...args: any[]) => mocks.getTaskStatus(...args),
  addPage: (...args: any[]) => mocks.addPage(...args),
  updateProject: (...args: any[]) => mocks.updateProject(...args),
  getSettings: (...args: any[]) => mocks.getSettings(...args),
  updateSettings: (...args: any[]) => mocks.updateSettings(...args),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: any[]) => sensors),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (items: any[]) => items,
  SortableContext: ({ children }: any) => <div>{children}</div>,
  rectSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: () => undefined,
    },
  },
}))

describe('DetailEditor settings entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSettings.mockResolvedValue({ data: {} })
    mocks.updateSettings.mockResolvedValue({ data: {} })
  })

  it('renders a settings button in the header', async () => {
    render(<DetailEditor />)

    expect(screen.getByTitle(/^(Settings|设置)$/)).toBeInTheDocument()

    await waitFor(() => {
      expect(mocks.getSettings).toHaveBeenCalled()
    })
  })

  it('opens the settings modal when the settings button is clicked', async () => {
    render(<DetailEditor />)

    await waitFor(() => {
      expect(mocks.getSettings).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByTitle(/^(Settings|设置)$/))

    expect(screen.getByRole('dialog', { name: /^(Settings|设置)$/ })).toBeInTheDocument()
    expect(screen.getByText('Mock Settings Component')).toBeInTheDocument()
  })

  it('keeps the existing description settings button rendered', async () => {
    render(<DetailEditor />)

    await waitFor(() => {
      expect(mocks.getSettings).toHaveBeenCalled()
    })

    expect(screen.getByTitle('Description Settings')).toBeInTheDocument()
  })
})
