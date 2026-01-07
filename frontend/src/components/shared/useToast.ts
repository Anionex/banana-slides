import React from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
}

// Toast 管理器
export const useToast = () => {
  const [toasts, setToasts] = React.useState<Array<{ id: string; props: Omit<ToastProps, 'onClose'> }>>([]);

  const show = (props: Omit<ToastProps, 'onClose'>) => {
    const id = Math.random().toString(36);
    setToasts((prev) => [...prev, { id, props }]);
  };

  const remove = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return {
    show,
    toasts,
    remove,
  };
};
