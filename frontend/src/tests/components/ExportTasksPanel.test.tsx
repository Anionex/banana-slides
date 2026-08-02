import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportTasksPanel } from '@/components/shared/ExportTasksPanel';
import { useExportTasksStore } from '@/store/useExportTasksStore';

const mockListExports = vi.fn();
const mockTriggerDownload = vi.fn();
const originalRestoreActiveTasks = useExportTasksStore.getState().restoreActiveTasks;

vi.mock('@/api/endpoints', () => ({
  listExports: (...args: unknown[]) => mockListExports(...args),
  deleteExport: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
}));

describe('ExportTasksPanel', () => {
  beforeEach(() => {
    mockListExports.mockReset();
    mockTriggerDownload.mockReset();
    useExportTasksStore.setState({
      tasks: [],
      restoreActiveTasks: originalRestoreActiveTasks,
    });
  });

  it('routes task and exported-file downloads through the shared desktop-aware helper', async () => {
    useExportTasksStore.setState({
      restoreActiveTasks: vi.fn(),
      tasks: [{
        id: 'export-1',
        taskId: 'task-1',
        projectId: 'project-1',
        type: 'editable-pptx',
        status: 'COMPLETED',
        downloadUrl: '/files/project-1/exports/task-result.pptx',
        filename: 'task-result.pptx',
        createdAt: new Date().toISOString(),
      }],
    });
    mockListExports.mockResolvedValue({
      data: {
        files: [{
          filename: 'saved-result.pptx',
          type: 'pptx',
          size: 1024,
          modified_at: new Date().toISOString(),
          download_url: '/files/project-1/exports/saved-result.pptx',
        }],
      },
    });

    render(<ExportTasksPanel projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /下载|Download/ })).toHaveLength(2);
    });
    const downloadButtons = screen.getAllByRole('button', { name: /下载|Download/ });

    await userEvent.click(downloadButtons[0]);
    await userEvent.click(downloadButtons[1]);

    await waitFor(() => {
      expect(mockTriggerDownload).toHaveBeenNthCalledWith(
        1,
        '/files/project-1/exports/task-result.pptx',
        'task-result.pptx',
      );
      expect(mockTriggerDownload).toHaveBeenNthCalledWith(
        2,
        '/files/project-1/exports/saved-result.pptx',
        'saved-result.pptx',
      );
    });
  });

  it('explains that an interrupted status check is not a backend export failure', async () => {
    useExportTasksStore.setState({
      restoreActiveTasks: vi.fn(),
      tasks: [{
        id: 'export-monitoring',
        taskId: 'task-monitoring',
        projectId: 'project-1',
        type: 'editable-pptx',
        status: 'RUNNING',
        progress: { total: 100, completed: 50, percent: 50 },
        monitoring: {
          state: 'paused',
          code: 'EXPORT_STATUS_GATEWAY_TIMEOUT',
          message: '状态查询经过网关时超时 (HTTP 504)。后台任务状态未知。',
          consecutiveErrors: 3,
          lastErrorAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      }],
    });
    mockListExports.mockResolvedValue({ data: { files: [] } });

    render(<ExportTasksPanel projectId="project-1" />);

    expect(await screen.findByText(/这不代表后台导出失败|does not mean the backend export failed/)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 504/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重新查询|Check Again/ })).toBeInTheDocument();
    expect(screen.queryByText(/^导出失败$|^Export Failed$/)).not.toBeInTheDocument();
  });

  it('shows the backend-confirmed failure stage, provider, model, and retry policy', async () => {
    useExportTasksStore.setState({
      tasks: [{
        id: 'export-failed',
        taskId: 'task-failed',
        projectId: 'project-1',
        type: 'editable-pptx',
        status: 'FAILED',
        errorMessage: '文本样式提取失败：图片识别服务请求超时',
        progress: {
          total: 100,
          completed: 50,
          percent: 50,
          backend_status: 'FAILED',
          error_code: 'EXPORT_STYLE_TIMEOUT',
          error_stage: 'style_extraction',
          error_details: {
            reason: 'timeout',
            provider: 'CodexTextProvider',
            model: 'gpt-5.4',
            request_timeout_seconds: 120,
            max_attempts: 5,
            technical_message: 'Read timed out after retries',
          },
          help_text: '请稍后重试。',
        },
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      }],
    });
    mockListExports.mockResolvedValue({ data: { files: [] } });

    render(<ExportTasksPanel projectId="project-1" />);

    expect(await screen.findByText('文本样式提取失败：图片识别服务请求超时')).toBeInTheDocument();
    expect(screen.getByText('EXPORT_STYLE_TIMEOUT')).toBeInTheDocument();
    expect(screen.getByText('CodexTextProvider')).toBeInTheDocument();
    expect(screen.getByText('gpt-5.4')).toBeInTheDocument();
    expect(screen.getByText(/120.*5/)).toBeInTheDocument();
    expect(screen.getByText(/技术原因|Technical reason/)).toBeInTheDocument();
  });
});
