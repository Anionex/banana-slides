import React from 'react';
import { cn } from '@/utils';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const TextareaComponent = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({
  label,
  error,
  className,
  ...props
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'w-full min-h-[120px] px-4 py-3 rounded-lg border border-gray-200 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent',
          'placeholder:text-gray-400 transition-all resize-y',
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
});

TextareaComponent.displayName = 'Textarea';

// 使用 memo 包装，避免父组件频繁重渲染时影响输入框
export const Textarea = React.memo(TextareaComponent);

