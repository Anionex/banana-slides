import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity duration-200"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={cn(
            'relative bg-white dark:bg-background-secondary rounded-panel shadow-xl w-full transition-all duration-200',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          {title ? (
            <div className="flex items-center justify-between px-8 py-6 bg-banana-50 dark:bg-background-hover rounded-t-panel">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-foreground-primary">{title}</h2>
              <button
                onClick={onClose}
                className="text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 text-gray-400 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X size={20} />
            </button>
          )}

          {/* 内容 */}
          <div className="px-8 py-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

