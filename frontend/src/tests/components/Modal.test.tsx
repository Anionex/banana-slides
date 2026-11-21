import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '@/components/shared/Modal';

const close = () => {};

const nestedModals = (parentOpen: boolean, childOpen: boolean) => (
  <Modal isOpen={parentOpen} onClose={close}>
    <Modal isOpen={childOpen} onClose={close}>Child content</Modal>
  </Modal>
);

const finishExit = () => act(() => {
  vi.advanceTimersByTime(300);
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
  vi.useRealTimers();
});

describe('Modal scroll locking', () => {
  it('retains the outer lock through child exit and restores overflow after the last exit', () => {
    vi.useFakeTimers();
    document.body.style.overflow = 'scroll';
    const { rerender } = render(nestedModals(true, false));
    expect(document.body.style.overflow).toBe('hidden');

    rerender(nestedModals(true, true));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    rerender(nestedModals(true, false));
    expect(document.body.style.overflow).toBe('hidden');

    finishExit();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(nestedModals(false, false));
    expect(document.body.style.overflow).toBe('hidden');
    finishExit();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('retains the lock when reopening during exit and releases it on unmount', () => {
    vi.useFakeTimers();
    document.body.style.overflow = 'auto';
    const { rerender, unmount } = render(nestedModals(true, true));
    rerender(nestedModals(true, false));
    rerender(nestedModals(true, true));
    finishExit();

    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});
