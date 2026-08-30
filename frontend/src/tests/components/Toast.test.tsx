import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Toast } from '@/components/shared/Toast';

describe('Toast', () => {
  test('runs an optional recovery action and closes the toast', () => {
    const onAction = vi.fn();
    const onClose = vi.fn();

    render(
      <Toast
        message="认证失败"
        type="error"
        actionLabel="检查 API 设置"
        onAction={onAction}
        onClose={onClose}
        duration={0}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '检查 API 设置' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('keeps ordinary toasts free of unrelated actions', () => {
    render(
      <Toast
        message="服务器暂时不可用"
        type="error"
        onClose={vi.fn()}
        duration={0}
      />
    );

    expect(screen.queryByText('检查 API 设置')).not.toBeInTheDocument();
  });
});
