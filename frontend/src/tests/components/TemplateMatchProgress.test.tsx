import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TemplateMatchProgress } from '@/components/template/TemplateMatchProgress';
import type { Task } from '@/types';

vi.mock('@/hooks/useT', () => ({
  useT: () => (key: string) => key,
}));

describe('TemplateMatchProgress', () => {
  it('renders progress without the old outer card container', () => {
    const task: Task = {
      task_id: 'match-task',
      status: 'RUNNING',
      progress: { total: 4, completed: 2, failed: 0 },
    };

    render(<TemplateMatchProgress task={task} />);

    const progress = screen.getByTestId('template-match-progress');
    expect(progress).not.toHaveClass('rounded-xl');
    expect(progress).not.toHaveClass('border');
    expect(progress).not.toHaveClass('bg-white');
    expect(progress).not.toHaveClass('p-4');
    expect(screen.getByText('tmp.matching')).toBeVisible();
  });
});
