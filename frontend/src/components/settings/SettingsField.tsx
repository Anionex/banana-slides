import { Input } from "@/components/shared";
import type { useT } from "@/hooks/useT";
export interface SettingsFieldConfig {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "select" | "buttons" | "switch";
  placeholder?: string;
  description?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  link?: string;
}
export function SettingsField({
  field,
  value,
  placeholder = "",
  isDisabled = false,
  onChange,
  t,
}: {
  field: SettingsFieldConfig;
  value: string | number | boolean;
  placeholder?: string;
  isDisabled?: boolean;
  onChange: (value: string | number | boolean) => void;
  t: ReturnType<typeof useT>;
}) {
  if (field.type === "buttons" && field.options) {
    return (
      <div key={field.key} data-testid={`setting-${field.key}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {field.label}
        </label>
        <div className="flex flex-wrap gap-2">
          {field.options.map((option) => (
            <button
              key={option.value}
              data-value={option.value}
              aria-pressed={value === option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                value === option.value
                  ? option.value === "openai"
                    ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md"
                    : option.value === "lazyllm"
                      ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md"
                      : "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : "bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-gray-50 dark:hover:bg-background-hover hover:border-gray-300 dark:hover:border-gray-500"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {field.description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-foreground-tertiary">
            {field.description}
          </p>
        )}
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div key={field.key} data-testid={`setting-${field.key}`}>
        <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
          {field.label}
        </label>
        <select
          aria-label={field.label}
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-4 rounded-lg border border-gray-200 dark:border-border-primary bg-white dark:bg-background-secondary focus:outline-none focus:ring-2 focus:ring-banana-500 focus:border-transparent"
        >
          {!(value as string) && (
            <option value="" disabled>
              {field.placeholder || t("settings.fields.selectPlaceholder")}
            </option>
          )}
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {field.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {field.description}
          </p>
        )}
      </div>
    );
  }

  // switch 类型 - 开关切换
  if (field.type === "switch") {
    const isEnabled = Boolean(value);
    return (
      <div key={field.key} data-testid={`setting-${field.key}`}>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary">
            {field.label}
          </label>
          <button
            type="button"
            role="switch"
            aria-label={field.label}
            aria-checked={isEnabled}
            onClick={() => onChange(!isEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-banana-500 focus:ring-offset-2 ${
              isEnabled ? "bg-banana-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-background-secondary transition-transform ${
                isEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {field.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
            {field.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div key={field.key} className={isDisabled ? "opacity-50" : ""}>
      <Input
        label={field.label}
        aria-label={field.label}
        type={field.type === "number" ? "number" : field.type}
        placeholder={placeholder}
        value={value as string | number}
        onChange={(e) => {
          const newValue =
            field.type === "number"
              ? parseInt(e.target.value) || (field.min ?? 0)
              : e.target.value;
          onChange(newValue);
        }}
        min={field.min}
        max={field.max}
        disabled={isDisabled}
      />
      {(field.description || field.link) && (
        <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
          {field.description}
          {field.link && (
            <a
              href={field.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-banana-500 hover:underline"
            >
              {t("settings.fields.applyLink")}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
