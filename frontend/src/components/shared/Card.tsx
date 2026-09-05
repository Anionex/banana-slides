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
        'bg-background-secondary rounded-card border border-border-primary',
        hoverable && 'hover:border-border-hover hover:shadow-sm transition-[border-color,box-shadow] duration-150 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
