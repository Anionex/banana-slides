import React from 'react';
import { cn } from '@/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon node (e.g. a lucide icon). */
  icon: React.ReactNode;
  /** Accessible name + hover tooltip text. */
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  size?: 'sm' | 'md';
  active?: boolean;
  loading?: boolean;
  /** Tooltip placement relative to the button. */
  tooltipSide?: 'top' | 'bottom';
}

const sizeClass: Record<NonNullable<IconButtonProps['size']>, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
};

const variantClass: Record<NonNullable<IconButtonProps['variant']>, string> = {
  default:
    'text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700',
  primary:
    'text-banana-600 hover:text-banana-700 hover:bg-banana-50 dark:text-banana-400 dark:hover:bg-banana-900/30',
  danger:
    'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-900/30',
};

/**
 * Light, square icon button with an elegant hover tooltip. Designed for compact
 * action clusters where text labels would create clutter.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  variant = 'default',
  size = 'md',
  active = false,
  loading = false,
  tooltipSide = 'top',
  className,
  disabled,
  ...props
}) => (
  <span className={cn('group relative inline-flex', className)}>
    <button
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-banana-500 disabled:cursor-not-allowed disabled:opacity-40',
        sizeClass[size],
        variantClass[variant],
        active && 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
      )}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        icon
      )}
    </button>
    <span
      role="tooltip"
      className={cn(
        'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 dark:bg-gray-700',
        tooltipSide === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      )}
    >
      {label}
    </span>
  </span>
);
