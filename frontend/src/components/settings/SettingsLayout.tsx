import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function SettingsSection({
  title,
  icon,
  children,
  description,
  label,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  description?: string;
  label?: string;
}) {
  return (
    <section aria-label={label || title}>
      <h2
        className={`text-xl font-semibold text-gray-900 dark:text-foreground-primary ${description ? "mb-1" : "mb-4"} flex items-center`}
      >
        {icon}
        <span className="ml-2">{title}</span>
      </h2>
      {description && (
        <p className="text-sm text-gray-500 dark:text-foreground-tertiary mb-4">
          {description}
        </p>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
export function SettingsAdvanced({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-gray-200 dark:border-border-primary pt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-0 py-3 text-left hover:opacity-80 transition-opacity"
      >
        <span className="text-lg font-semibold text-gray-900 dark:text-foreground-primary">
          {label}
        </span>
        <ChevronDown
          size={20}
          className={`text-gray-500 dark:text-foreground-tertiary transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="pb-4 space-y-8">{children}</div>}
    </div>
  );
}
export function SettingsServiceRow({
  title,
  description,
  action,
  children,
  testId,
}: {
  title: string;
  description: string;
  action: ReactNode;
  children?: ReactNode;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="py-4 border-b border-gray-200 dark:border-border-primary last:border-b-0 space-y-2"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-base font-semibold text-gray-800 dark:text-foreground-primary">
            {title}
          </div>
          <div className="text-sm text-gray-500 dark:text-foreground-tertiary">
            {description}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
export function SettingsActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-border-primary">
      {children}
    </div>
  );
}
