import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/utils';

export interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastProps extends ToastOptions {
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  actionLabel,
  onAction,
  duration = actionLabel && onAction ? 10000 : type === 'error' ? 5000 : 3000,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />,
    warning: <AlertTriangle size={20} />,
  };

  const styles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-gray-900 dark:bg-background-hover text-white',
    warning: 'bg-amber-500 text-white',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        'animate-in slide-in-from-right transition-all duration-300',
        styles[type]
      )}
    >
      {icons[type]}
      <span className="flex-1">{message}</span>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={() => {
            onAction();
            onClose();
          }}
          className="shrink-0 rounded-md bg-white/20 px-2.5 py-1.5 text-sm font-semibold hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-colors"
        >
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        className="hover:opacity-75 transition-opacity"
        aria-label="Close"
      >
        <X size={18} />
      </button>
    </div>
  );
};

// Toast 管理器
export const useToast = () => {
  const [toasts, setToasts] = React.useState<Array<{ id: string; props: ToastOptions }>>([]);

  const show = React.useCallback((props: ToastOptions) => {
    const id = Math.random().toString(36);
    setToasts((prev) => {
      const newToasts = [...prev, { id, props }];
      // 最多保留5个toast，超过则移除最早的
      return newToasts.length > 5 ? newToasts.slice(-5) : newToasts;
    });
  }, []);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ToastContainer = React.useCallback(() => (
    <div className="fixed top-20 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto max-w-full">
          <Toast
            {...toast.props}
            onClose={() => remove(toast.id)}
          />
        </div>
      ))}
    </div>
  ), [remove, toasts]);

  return {
    show,
    ToastContainer,
  };
};
