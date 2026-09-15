import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

interface ProviderPillProps {
  value: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  hint?: string | null;
  promotion?: 'apimart' | 'volcengine' | null;
  describedBy?: string;
  onSelect: () => void;
  children?: ReactNode;
}

/** Shared provider presentation for full settings and the public demo. */
export function ProviderPill({ value, label, selected, disabled, hint, promotion, describedBy, onSelect, children }: ProviderPillProps) {
  return <button
    type="button"
    role="radio"
    aria-checked={selected}
    aria-describedby={describedBy}
    disabled={disabled}
    data-provider={value}
    onClick={onSelect}
    className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 dark:focus:ring-offset-background-primary ${
      selected
        ? 'border-banana-500 bg-banana-400 font-medium text-gray-950 shadow-sm'
        : 'border-gray-200 bg-white text-gray-700 hover:border-banana-300 hover:bg-banana-50 dark:border-border-primary dark:bg-background-secondary dark:text-foreground-secondary dark:hover:border-banana-700 dark:hover:bg-banana-950/30'
    } disabled:cursor-not-allowed disabled:opacity-45`}
  >
    <span>{label}</span>
    {promotion && <span aria-hidden="true" className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${promotion === 'apimart' ? 'bg-violet-100 text-violet-600 dark:bg-violet-950/70 dark:text-violet-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300'}`}><Sparkles size={10} className="animate-pulse" /></span>}
    {hint && <span className={`text-[11px] ${selected ? 'text-gray-800' : 'text-amber-700 dark:text-amber-300'}`}>{hint}</span>}
    {children}
  </button>;
}
