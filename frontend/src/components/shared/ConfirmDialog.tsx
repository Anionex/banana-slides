import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'warning',
}) => {
  const { t } = useTranslation();

  const displayTitle = title ?? t('components.confirmDialog.defaultTitle');
  const displayConfirmText = confirmText ?? t('common.confirm');
  const displayCancelText = cancelText ?? t('common.cancel');

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const variantStyles = {
    danger: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={displayTitle} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <AlertTriangle
            size={24}
            className={`flex-shrink-0 mt-0.5 ${variantStyles[variant]}`}
          />
          <p className="text-gray-700 flex-1">{message}</p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            {displayCancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'primary' : 'secondary'}
            onClick={handleConfirm}
          >
            {displayConfirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// Hook for easy confirmation dialogs
export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    message: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  } | null>(null);

  const confirm = useCallback(
    (
      message: string,
      onConfirm: () => void,
      options?: {
        title?: string;
        confirmText?: string;
        cancelText?: string;
        variant?: 'danger' | 'warning' | 'info';
      }
    ) => {
      setConfig({
        message,
        onConfirm,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.variant || 'warning',
      });
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (config?.onConfirm) {
      config.onConfirm();
    }
    close();
  }, [config, close]);

  return {
    confirm,
    ConfirmDialog: config ? (
      <ConfirmDialog
        isOpen={isOpen}
        onClose={close}
        onConfirm={handleConfirm}
        message={config.message}
        title={config.title}
        confirmText={config.confirmText}
        cancelText={config.cancelText}
        variant={config.variant}
      />
    ) : null,
  };
};

