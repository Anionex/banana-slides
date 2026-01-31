import React from 'react';
import { cn } from '@/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary',
          'focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent',
          'placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all',
          'text-gray-900 dark:text-foreground-primary',
          error && 'border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

