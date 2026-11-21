import React from 'react';
import { cn } from '@/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white dark:bg-background-secondary rounded-card shadow-md border border-gray-100 dark:border-border-primary',
        hoverable && 'hover:shadow-lg hover:-translate-y-1 hover:border-banana-500 transition-all duration-200 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

