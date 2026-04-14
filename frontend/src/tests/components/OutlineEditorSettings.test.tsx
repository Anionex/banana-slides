import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OutlineEditor } from '@/pages/OutlineEditor'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  syncProject: vi.fn(),
  updatePageLocal: vi.fn(),
  saveAllPages: vi.fn(),
  reorderPages: vi.fn(),
  deletePageById: vi.fn(),
  addNewPage: vi.fn(),
  generateOutlineStream: vi.fn(),
  showToast: vi.fn(),
  updateProject: vi.fn(),
  refineOutline: vi.fn(),
  addPage: vi.fn(),
}))

const project = {
  id: 'test-id',
  creation_type: 'outline',
  outline_text: 'Existing outline',
  idea_prompt: 'Idea',
  outline_requirements: '',
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
      const innerRef = React.useRef(null)
      React.useImperativeHandle(ref, () => ({
        insertAtCursor: vi.fn(),
      }))
      return (
        <label>
          {label}
          <textarea
            ref={innerRef}
            value={value}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
            placeholder={placeholder}
          />
        </label>
      )
    }),
  }
})

vi.mock('@/components/outline/OutlineCard', () => ({
  OutlineCard: ({ page }: any) => <div>{page.outline_content.title}</div>,
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

vi.mock('@/store/useProjectStore', () => {
  const useProjectStore = Object.assign(
    () => ({
      currentProject: project,
      syncProject: mocks.syncProject,
      updatePageLocal: mocks.updatePageLocal,
      saveAllPages: mocks.saveAllPages,
      reorderPages: mocks.reorderPages,
      deletePageById: mocks.deletePageById,
      addNewPage: mocks.addNewPage,
      generateOutlineStream: mocks.generateOutlineStream,
      isGlobalLoading: false,
      isOutlineStreaming: false,
    }),
    {
      getState: () => ({ currentProject: project }),
    }
  )

  return { useProjectStore }
})

vi.mock('@/api/endpoints', () => ({
  refineOutline: (...args: any[]) => mocks.refineOutline(...args),
  updateProject: (...args: any[]) => mocks.updateProject(...args),
  addPage: (...args: any[]) => mocks.addPage(...args),
}))

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: class {},
  PointerSensor: class {},
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn((...sensors: any[]) => sensors),
}))

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (items: any[]) => items,
  SortableContext: ({ children }: any) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
  }),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: () => undefined,
    },
  },
}))

describe('OutlineEditor settings entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a settings button in the header', () => {
    render(<OutlineEditor />)

    expect(screen.getByTitle(/^(Settings|设置)$/)).toBeInTheDocument()
  })

  it('opens the settings modal when the settings button is clicked', () => {
    render(<OutlineEditor />)

    fireEvent.click(screen.getByTitle(/^(Settings|设置)$/))

    expect(screen.getByRole('dialog', { name: /^(Settings|设置)$/ })).toBeInTheDocument()
    expect(screen.getByText('Mock Settings Component')).toBeInTheDocument()
  })
})
