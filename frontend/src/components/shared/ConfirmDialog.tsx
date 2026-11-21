import React, { useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (checkboxValue?: boolean) => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  checkboxLabel?: string;
  checkboxDefaultChecked?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = '确认操作',
  message,
  confirmText = '确定',
  cancelText = '取消',
  variant = 'warning',
  checkboxLabel,
  checkboxDefaultChecked = false,
}) => {
  const [checkboxChecked, setCheckboxChecked] = useState(checkboxDefaultChecked);

  const handleConfirm = () => {
    onConfirm(checkboxLabel ? checkboxChecked : undefined);
    onClose();
  };

  const variantStyles = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <AlertTriangle
            size={24}
            className={`flex-shrink-0 mt-0.5 ${variantStyles[variant]}`}
          />
          <p className="text-gray-700 dark:text-foreground-secondary flex-1">{message}</p>
        </div>
        {checkboxLabel && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checkboxChecked}
              onChange={(e) => setCheckboxChecked(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-foreground-secondary">{checkboxLabel}</span>
          </label>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'primary' : 'secondary'}
            onClick={handleConfirm}
          >
            {confirmText}
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
    checkboxLabel?: string;
    checkboxDefaultChecked?: boolean;
    onConfirm: (checkboxValue?: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (
      message: string,
      onConfirm: (checkboxValue?: boolean) => void,
      options?: {
        title?: string;
        confirmText?: string;
        cancelText?: string;
        variant?: 'danger' | 'warning' | 'info';
        checkboxLabel?: string;
        checkboxDefaultChecked?: boolean;
      }
    ) => {
      setConfig({
        message,
        onConfirm,
        title: options?.title,
        confirmText: options?.confirmText,
        cancelText: options?.cancelText,
        variant: options?.variant || 'warning',
        checkboxLabel: options?.checkboxLabel,
        checkboxDefaultChecked: options?.checkboxDefaultChecked,
      });
      setIsOpen(true);
    },
    []
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setConfig(null);
  }, []);

  const handleConfirm = useCallback((checkboxValue?: boolean) => {
    if (config?.onConfirm) {
      config.onConfirm(checkboxValue);
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
        checkboxLabel={config.checkboxLabel}
        checkboxDefaultChecked={config.checkboxDefaultChecked}
      />
    ) : null,
  };
};

