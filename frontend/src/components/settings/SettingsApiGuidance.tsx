import { HelpCircle } from "lucide-react";
import { Button } from "@/components/shared";
import type { useT } from "@/hooks/useT";
interface Props {
  t: ReturnType<typeof useT>;
  usesVolcengineCampaignPromo: boolean;
  providerFormat: string;
  volcengineAgentPlansUrl: string;
  volcengineLogoUrl: string;
  isZh: boolean;
  activeVolcenginePromoKey: string;
  activeApiKeyHelpKey: string;
  activeApiKeyTipKey: string;
  activeApiKeyHelpUrl: string;
  copyToClipboard: (text: string) => void;
  applyVolcengineRecommendedModels?: () => void;
}
const VOLCENGINE_AGENTPLANS_APIKEY_URL =
  "https://ai.volcengine.com/console/apikey";
export function SettingsApiGuidance({
  t,
  usesVolcengineCampaignPromo,
  providerFormat,
  volcengineAgentPlansUrl,
  volcengineLogoUrl,
  isZh,
  activeVolcenginePromoKey,
  activeApiKeyHelpKey,
  activeApiKeyTipKey,
  activeApiKeyHelpUrl,
  copyToClipboard,
  applyVolcengineRecommendedModels,
}: Props) {
  return (
    <>
      {" "}
      {usesVolcengineCampaignPromo ? (
        <div
          data-testid="volcengine-campaign-promo"
          className="mt-3 pl-4 border-l-4 border-amber-300 dark:border-amber-600"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={volcengineAgentPlansUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <img
                src={volcengineLogoUrl}
                alt={isZh ? "火山引擎" : "BytePlus"}
                className="h-9 w-auto max-w-[160px] object-contain"
              />
            </a>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary">
                {t(`${activeVolcenginePromoKey}.title`)}
              </p>
              <p className="text-sm text-gray-700 dark:text-foreground-secondary">
                {t(`${activeVolcenginePromoKey}.body`)}{" "}
                <a
                  href={volcengineAgentPlansUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium"
                >
                  {t(`${activeVolcenginePromoKey}.cta`)}
                </a>
              </p>
              <div className="pt-1">
                <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary flex items-center gap-1.5">
                  <HelpCircle size={15} className="text-amber-500" />
                  {t(`${activeApiKeyHelpKey}.title`)}
                </p>
                <ol className="mt-1 text-sm text-gray-700 dark:text-foreground-secondary space-y-1 list-decimal list-inside">
                  <li>
                    {t(`${activeApiKeyHelpKey}.step1`)}{" "}
                    <span className="inline-flex items-center gap-2">
                      <a
                        href={volcengineAgentPlansUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium"
                      >
                        {t(`${activeVolcenginePromoKey}.guideLink`)}
                      </a>
                      <button
                        onClick={() => copyToClipboard(volcengineAgentPlansUrl)}
                        className="text-xs px-2 py-0.5 rounded transition-colors bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                      >
                        {t(`${activeVolcenginePromoKey}.copy`)}
                      </button>
                    </span>
                  </li>
                  <li>{t(`${activeApiKeyHelpKey}.step2`)}</li>
                  <li>
                    {t(`${activeApiKeyHelpKey}.step3`)}
                    {providerFormat === "volcengine" && (
                      <span className="inline-flex items-center gap-2">
                        <a
                          href={VOLCENGINE_AGENTPLANS_APIKEY_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 underline font-medium"
                        >
                          {t(`${activeApiKeyHelpKey}.apikeyConsoleLabel`)}
                        </a>
                        <button
                          onClick={() =>
                            copyToClipboard(VOLCENGINE_AGENTPLANS_APIKEY_URL)
                          }
                          className="text-xs px-2 py-0.5 rounded transition-colors bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                        >
                          {t(`${activeVolcenginePromoKey}.copy`)}
                        </button>
                      </span>
                    )}
                  </li>
                  <li>{t(`${activeApiKeyHelpKey}.step4`)}</li>
                </ol>
              </div>
              {applyVolcengineRecommendedModels && (
                <div className="pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={applyVolcengineRecommendedModels}
                  >
                    {t(`${activeVolcenginePromoKey}.applyModels`)}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-3 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
          <p className="text-sm text-gray-700 dark:text-foreground-secondary">
            {t(`${activeApiKeyTipKey}.before`)}
            <a
              href={activeApiKeyHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline font-medium"
            >
              {t(`${activeApiKeyTipKey}.linkLabel`)}
            </a>
            {t(`${activeApiKeyTipKey}.after`)}
          </p>
        </div>
      )}
      {/* API Key 获取指南 */}
      {!usesVolcengineCampaignPromo && (
        <div className="mt-2 pl-4 border-l-4 border-blue-300 dark:border-blue-600">
          <p className="text-sm font-medium text-gray-800 dark:text-foreground-primary flex items-center gap-1.5 mb-2">
            <HelpCircle size={15} className="text-blue-500" />
            {t(`${activeApiKeyHelpKey}.title`)}
          </p>
          <ol className="text-sm text-gray-700 dark:text-foreground-secondary space-y-1 list-decimal list-inside ml-1">
            <li>
              {
                t(`${activeApiKeyHelpKey}.step1`, { link: "{{link}}" }).split(
                  "{{link}}",
                )[0]
              }
              <span className="inline-flex items-center gap-2">
                <a
                  href={activeApiKeyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  {t(`${activeApiKeyHelpKey}.linkLabel`)}
                </a>
                <button
                  onClick={() => copyToClipboard(activeApiKeyHelpUrl)}
                  className="text-xs px-2 py-0.5 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded transition-colors"
                >
                  {t(`${activeApiKeyHelpKey}.copyLink`)}
                </button>
              </span>
              {
                t(`${activeApiKeyHelpKey}.step1`, { link: "{{link}}" }).split(
                  "{{link}}",
                )[1]
              }
            </li>
            <li>{t(`${activeApiKeyHelpKey}.step2`)}</li>
            <li>{t(`${activeApiKeyHelpKey}.step3`)}</li>
            <li>{t(`${activeApiKeyHelpKey}.step4`)}</li>
          </ol>
        </div>
      )}
    </>
  );
}
