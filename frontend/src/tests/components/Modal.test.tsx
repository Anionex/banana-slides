import { useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { Modal } from '@/components/shared/Modal';

function ModalHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open preferences</button>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Preferences">
        <button>First action</button>
        <button>Last action</button>
      </Modal>
    </>
  );
}

function StackedModalHarness() {
  const [isSecondOpen, setIsSecondOpen] = useState(false);

  return (
    <>
      <button>Background action</button>
      <Modal isOpen onClose={vi.fn()} title="First dialog">
        <button onClick={() => setIsSecondOpen(true)}>Open second dialog</button>
        <button>First dialog last action</button>
      </Modal>
      <Modal
        isOpen={isSecondOpen}
        onClose={() => setIsSecondOpen(false)}
        title="Second dialog"
      >
        <button>Second action</button>
      </Modal>
    </>
  );
}

describe('Modal keyboard accessibility', () => {
  beforeEach(async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  it('moves focus into the dialog and restores the trigger after Escape', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const trigger = screen.getByRole('button', { name: 'Open preferences' });
    await act(async () => user.click(trigger));

    const dialog = await screen.findByRole('dialog', { name: 'Preferences' });
    await waitFor(() => expect(dialog).toHaveFocus());

    await act(async () => user.keyboard('{Escape}'));

    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps forward and reverse Tab navigation inside the topmost dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await act(async () => user.click(screen.getByRole('button', { name: 'Open preferences' })));

    const dialog = await screen.findByRole('dialog', { name: 'Preferences' });
    const closeButton = within(dialog).getByRole('button', { name: 'Close' });
    const lastButton = within(dialog).getByRole('button', { name: 'Last action' });

    await act(async () => user.tab());
    expect(closeButton).toHaveFocus();

    lastButton.focus();
    await act(async () => user.tab());
    expect(closeButton).toHaveFocus();

    await act(async () => user.tab({ shift: true }));
    expect(lastButton).toHaveFocus();
  });

  it('closes only the topmost dialog when Escape is pressed', async () => {
    const user = userEvent.setup();
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeFirst} title="First dialog">
          <button>First action</button>
        </Modal>
        <Modal isOpen onClose={closeSecond} title="Second dialog">
          <button>Second action</button>
        </Modal>
      </>
    );

    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Second dialog' })).toHaveFocus());
    await act(async () => user.keyboard('{Escape}'));

    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(closeFirst).not.toHaveBeenCalled();
  });

  it('reactivates the underlying focus trap while the closing dialog animates out', async () => {
    const user = userEvent.setup();
    render(<StackedModalHarness />);

    const opener = screen.getByRole('button', { name: 'Open second dialog' });
    await act(async () => user.click(opener));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Second dialog' })).toHaveFocus());

    await act(async () => user.keyboard('{Escape}'));
    expect(opener).toHaveFocus();

    screen.getByRole('button', { name: 'First dialog last action' }).focus();
    await act(async () => user.tab());
    const firstDialog = screen.getByRole('dialog', { name: 'First dialog' });
    expect(within(firstDialog).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it('uses localized accessible names and unique title associations', async () => {
    await i18n.changeLanguage('zh');
    render(
      <>
        <Modal isOpen onClose={vi.fn()} title="弹窗一">内容一</Modal>
        <Modal isOpen onClose={vi.fn()} title="弹窗二">内容二</Modal>
        <Modal isOpen onClose={vi.fn()} ariaLabel="功能指南">无标题内容</Modal>
      </>
    );

    const first = screen.getByRole('dialog', { name: '弹窗一' });
    const second = screen.getByRole('dialog', { name: '弹窗二' });
    expect(first.getAttribute('aria-labelledby')).not.toBe(second.getAttribute('aria-labelledby'));
    expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(3);
    expect(screen.getByRole('dialog', { name: '功能指南' })).toBeInTheDocument();
  });

  it('keeps background scrolling locked until the last stacked dialog closes', () => {
    document.body.style.overflow = 'scroll';
    const { rerender } = render(
      <>
        <Modal isOpen onClose={vi.fn()} title="First dialog">First</Modal>
        <Modal isOpen onClose={vi.fn()} title="Second dialog">Second</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen={false} onClose={vi.fn()} title="First dialog">First</Modal>
        <Modal isOpen onClose={vi.fn()} title="Second dialog">Second</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <>
        <Modal isOpen={false} onClose={vi.fn()} title="First dialog">First</Modal>
        <Modal isOpen={false} onClose={vi.fn()} title="Second dialog">Second</Modal>
      </>
    );
    expect(document.body.style.overflow).toBe('scroll');
  });
});
