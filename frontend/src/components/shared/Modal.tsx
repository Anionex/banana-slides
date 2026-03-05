import React, { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 250);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isVisible) return null;

  const sizes = {
    sm: 'max-w-[380px]',
    md: 'max-w-[480px]',
    lg: 'max-w-[640px]',
    xl: 'max-w-[800px]',
    full: 'max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      {/* 遮罩 */}
      <div
        className={cn(
          'fixed inset-0 transition-all duration-300',
          'bg-gradient-to-br from-black/50 via-black/40 to-black/50',
          'backdrop-blur-md',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 容器 */}
      <div
        className="relative flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          className={cn(
            'relative w-full flex flex-col',
            'max-h-[85vh]',
            // 背景和边框
            'bg-white/95 dark:bg-[#1a1a24]/95',
            'backdrop-blur-xl',
            'border border-white/20 dark:border-white/10',
            // 圆角 + 裁剪滚动条
            'rounded-3xl overflow-hidden',
            // 阴影 - 多层次
            'shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05),0_12px_24px_rgba(0,0,0,0.09)]',
            'dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_2px_4px_rgba(0,0,0,0.2),0_12px_24px_rgba(0,0,0,0.4)]',
            // 动画
            'transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            isAnimating
              ? 'opacity-100 scale-100 translate-y-0'
              : 'opacity-0 scale-[0.96] translate-y-3',
            sizes[size]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 顶部光晕效果 */}
          <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-banana-400/50 to-transparent" />

          {/* 内部光晕 */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-banana-400/10 dark:bg-banana-400/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-banana-300/10 dark:bg-banana-300/5 rounded-full blur-3xl" />
          </div>

          {/* 标题栏 */}
          {title && (
            <div className="relative flex-shrink-0 px-7 pt-7 pb-5">
              <h2
                id="modal-title"
                className="text-xl font-semibold text-gray-900 dark:text-white tracking-tight pr-10"
              >
                {title}
              </h2>
            </div>
          )}

          {/* 关闭按钮 */}
          {showCloseButton && (
            <button
              onClick={onClose}
              className={cn(
                'absolute z-20 group',
                'w-9 h-9 flex items-center justify-center',
                'rounded-xl',
                'text-gray-400 dark:text-gray-500',
                'hover:text-gray-600 dark:hover:text-gray-300',
                'hover:bg-gray-100/80 dark:hover:bg-white/10',
                'active:scale-95',
                'transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#1a1a24]',
                title ? 'top-5 right-5' : 'top-4 right-4'
              )}
              aria-label="关闭"
            >
              <X
                size={18}
                strokeWidth={2}
                className="transition-transform duration-150 group-hover:scale-110"
              />
            </button>
          )}

          {/* 内容区域 */}
          <div
            className={cn(
              'relative px-7 pb-7 overflow-y-auto flex-1',
              'scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
              title ? '' : 'pt-7'
            )}
          >
            {children}
          </div>

          {/* 底部边框光晕 */}
          <div className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
        </div>
      </div>
    </div>
  );
};
