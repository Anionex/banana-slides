import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExportTasksPanel } from '@/components/shared/ExportTasksPanel';
import { useExportTasksStore } from '@/store/useExportTasksStore';

const mockListExports = vi.fn();
const mockTriggerDownload = vi.fn();

vi.mock('@/api/endpoints', () => ({
  listExports: (...args: unknown[]) => mockListExports(...args),
  deleteExport: vi.fn(),
}));

vi.mock('@/api/client', () => ({
  triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
}));

describe('ExportTasksPanel desktop download routing', () => {
  beforeEach(() => {
    mockListExports.mockReset();
    mockTriggerDownload.mockReset();
    useExportTasksStore.setState({ tasks: [] });
  });

  it('routes task and exported-file downloads through the shared desktop-aware helper', async () => {
    useExportTasksStore.setState({
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
});
