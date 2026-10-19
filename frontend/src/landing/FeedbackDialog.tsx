import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/** Base UI owns focus trapping, background inertness, Escape and focus restoration. */
export function FeedbackDialog({ isOpen, onClose, title, children, className = '', returnFocus }: { isOpen: boolean; onClose: () => void; title?: string; children: ReactNode; className?: string; returnFocus?: () => HTMLElement | null }) {
  const { i18n } = useTranslation();
  return <Dialog.Root open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="landing-dialog-backdrop" />
      <Dialog.Popup className={`landing-dialog ${className}`} aria-describedby={undefined} finalFocus={returnFocus ?? (() => document.querySelector<HTMLButtonElement>('.landing-feedback > button'))}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Close className="landing-dialog-close" aria-label={i18n.language.startsWith('zh') ? '关闭' : 'Close'}><X size={20} /></Dialog.Close>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
