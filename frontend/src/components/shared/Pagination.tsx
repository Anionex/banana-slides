import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  pageSizeLabel = '/ page',
}) => {
  // When only page size selector is needed (totalPages <= 1), still render if onPageSizeChange is provided
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    // Show all pages when total is small enough
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [1];

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('ellipsis');

    pages.push(totalPages);
    return pages;
  };

  const buttonBase =
    'flex items-center justify-center rounded-lg transition-all duration-200 select-none';
  const btnSize = 'w-9 h-9 text-sm';

  return (
    <nav className="flex items-center justify-center gap-1.5" aria-label="Pagination">
      {/* Previous */}
      <button
        className={cn(buttonBase, btnSize, 'text-gray-500 dark:text-foreground-tertiary', {
          'hover:bg-gray-100 dark:hover:bg-background-hover cursor-pointer': currentPage > 1,
          'opacity-30 cursor-not-allowed': currentPage <= 1,
        })}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={18} />
      </button>

      {/* Page numbers */}
      {getPageNumbers().map((page, idx) =>
        page === 'ellipsis' ? (
          <span
            key={`ellipsis-${idx}`}
            className="w-9 h-9 flex items-center justify-center text-gray-400 dark:text-foreground-tertiary text-sm select-none"
          >
            ...
          </span>
        ) : (
          <button
            key={page}
            className={cn(buttonBase, btnSize, 'font-medium', {
              'bg-banana-500 text-black shadow-sm': page === currentPage,
              'text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover':
                page !== currentPage,
            })}
            onClick={() => onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        className={cn(buttonBase, btnSize, 'text-gray-500 dark:text-foreground-tertiary', {
          'hover:bg-gray-100 dark:hover:bg-background-hover cursor-pointer': currentPage < totalPages,
          'opacity-30 cursor-not-allowed': currentPage >= totalPages,
        })}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={18} />
      </button>

      {/* Page size selector */}
      {onPageSizeChange && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="ml-3 h-9 px-2 text-sm rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary text-gray-700 dark:text-foreground-secondary cursor-pointer focus:outline-none focus:ring-1 focus:ring-banana-500"
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>{size} {pageSizeLabel}</option>
          ))}
        </select>
      )}
    </nav>
  );
};
