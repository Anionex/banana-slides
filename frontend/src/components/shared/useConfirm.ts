import { useState, useCallback } from 'react';

interface ConfirmConfig {
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
}

// Hook for easy confirmation dialogs
export const useConfirm = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig | null>(null);

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
    isOpen,
    config,
    close,
    handleConfirm,
  };
};
