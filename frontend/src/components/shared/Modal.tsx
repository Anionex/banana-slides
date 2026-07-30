import React, { useEffect, useState, useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { cn } from '@/utils';

let openModalCount = 0;
let bodyOverflowBeforeFirstModal = '';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const style = window.getComputedStyle(element);
      return !element.hidden
        && element.getAttribute('aria-hidden') !== 'true'
        && style.display !== 'none'
        && style.visibility !== 'hidden';
    }
  );
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'wide' | 'full';
  showCloseButton?: boolean;
  headerActions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  ariaLabel,
  children,
  size = 'md',
  showCloseButton = true,
  headerActions,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (openModalCount === 0) {
      bodyOverflowBeforeFirstModal = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    openModalCount += 1;

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = bodyOverflowBeforeFirstModal;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isVisible) return;
    dialogRef.current?.focus();
  }, [isOpen, isVisible]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const root = rootRef.current;
      const dialog = dialogRef.current;
      const visibleModalRoots = document.querySelectorAll('[data-modal-root="true"]');
      const topmostModalRoot = visibleModalRoots[visibleModalRoots.length - 1];

      if (!root || !dialog || topmostModalRoot !== root) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialog);
      if (focusableElements.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!dialog.contains(activeElement) || activeElement === dialog) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeElement === last) {
        e.preventDefault();
        first.focus();
      }
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
    wide: 'max-w-[1120px]',
    full: 'max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]',
  };

  return createPortal(
    <div
      ref={rootRef}
      data-modal-root={isOpen ? 'true' : 'false'}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain"
    >
      {/* 遮罩 */}
      <div
        className={cn(
          'fixed inset-0 z-0 transition-all duration-300',
          'bg-gradient-to-br from-black/50 via-black/40 to-black/50',
          'backdrop-blur-md',
          isAnimating ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 容器 */}
      <div
        className="relative z-10 flex min-h-full items-center justify-center p-4 sm:p-6"
        onClick={handleBackdropClick}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-label={title ? undefined : ariaLabel || t('common.dialog')}
          tabIndex={-1}
          className={cn(
            'relative w-full flex flex-col',
            size === 'full' ? 'max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)]' : 'max-h-[85vh]',
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
                id={titleId}
                className={cn(
                  'text-xl font-semibold text-gray-900 dark:text-white tracking-tight',
                  showCloseButton || headerActions ? 'pr-24' : ''
                )}
              >
                {title}
              </h2>
            </div>
          )}

          {headerActions && (
            <div
              className={cn(
                'absolute z-20 flex items-center gap-2',
                title ? 'top-5 right-16' : 'top-4 right-14'
              )}
            >
              {headerActions}
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
              aria-label={t('common.close')}
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
              size === 'full' ? 'max-h-[calc(100vh-8rem)]' : 'max-h-[85vh]',
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
    </div>,
    document.body
  );
};
