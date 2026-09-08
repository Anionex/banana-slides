import { CheckCircle } from "lucide-react";
import { Button } from "@/components/shared";
import { ProviderPill } from "./ProviderPill";
export interface ProviderPromotion {
  key: string;
  testId: string;
  active: boolean;
  name: string;
  tagline: string;
  suitedFor: string;
  points: string[];
  cta: string;
  activeLabel: string;
  note: string;
  onSelect: () => void;
  href: string;
  linkLabel: string;
}
interface Props {
  label: string;
  globalProviderSources: {
    value: string;
    label: string;
    disabled?: boolean;
    hint?: string | null;
  }[];
  selectedGlobalProvider: string;
  providerPromotions: ProviderPromotion[];
  selectGlobalProvider: (value: string) => void;
  disabledLabel?: string;
}
export function SettingsProviderPicker({
  label,
  globalProviderSources,
  selectedGlobalProvider,
  providerPromotions,
  selectGlobalProvider,
  disabledLabel,
}: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid="global-provider-pills"
      className="relative flex flex-wrap gap-2"
    >
      {globalProviderSources.map((option) => {
        const isSelected = selectedGlobalProvider === option.value;
        const isDisabled = Boolean(option.disabled);
        const hint = option.hint;
        const hoverPlanKey =
          option.value === "apimart" || option.value === "volcengine"
            ? option.value
            : null;
        const hoverPlan = hoverPlanKey
          ? (providerPromotions.find((plan) => plan.key === hoverPlanKey) ??
            null)
          : null;

        return (
          <div key={option.value} className="group sm:relative">
            <ProviderPill
              value={option.value}
              label={option.label}
              selected={isSelected}
              disabled={isDisabled}
              hint={hint}
              promotion={hoverPlanKey}
              describedBy={
                hoverPlan ? `${hoverPlan.testId}-popover` : undefined
              }
              onSelect={() => selectGlobalProvider(option.value)}
            >
              {isDisabled && (
                <span className="text-[11px]">{disabledLabel}</span>
              )}
            </ProviderPill>

            {hoverPlan && (
              <div
                id={`${hoverPlan.testId}-popover`}
                data-testid={hoverPlan.testId}
                className="pointer-events-none invisible absolute left-0 top-full z-50 w-full sm:w-[22rem] sm:max-w-[calc(100vw-3rem)] translate-y-1 pt-2 opacity-0 transition-all duration-150 group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
              >
                <div
                  className={`rounded-xl border bg-white p-4 shadow-xl dark:bg-background-secondary ${
                    hoverPlan.key === "apimart"
                      ? "border-violet-200 dark:border-violet-900"
                      : "border-amber-200 dark:border-amber-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-foreground-primary">
                        {hoverPlan.name}
                      </p>
                      <p
                        className={`mt-0.5 text-xs font-medium ${
                          hoverPlan.key === "apimart"
                            ? "text-violet-600 dark:text-violet-300"
                            : "text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {hoverPlan.tagline}
                      </p>
                    </div>
                    {hoverPlan.active && (
                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-white/10 dark:text-foreground-secondary">
                        {hoverPlan.activeLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-foreground-tertiary">
                    {hoverPlan.suitedFor}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {hoverPlan.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-foreground-secondary"
                      >
                        <CheckCircle
                          size={14}
                          className="mt-0.5 shrink-0 text-emerald-500"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-gray-400 dark:text-foreground-tertiary">
                    {hoverPlan.note}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant={hoverPlan.active ? "secondary" : "primary"}
                      size="sm"
                      disabled={hoverPlan.active}
                      onClick={hoverPlan.onSelect}
                    >
                      {hoverPlan.active ? hoverPlan.activeLabel : hoverPlan.cta}
                    </Button>
                    <a
                      href={hoverPlan.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-xs font-medium underline-offset-2 hover:underline ${
                        hoverPlan.key === "apimart"
                          ? "text-violet-600 hover:text-violet-700 dark:text-violet-300"
                          : "text-amber-700 hover:text-amber-800 dark:text-amber-300"
                      }`}
                    >
                      {hoverPlan.linkLabel}
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
