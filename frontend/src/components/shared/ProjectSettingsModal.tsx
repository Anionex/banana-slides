import React, { useState } from 'react';
import { X, FileText, Settings as SettingsIcon, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Textarea } from '@/components/shared';
import { useT } from '@/hooks/useT';
import { projectSettingsI18n } from '@/i18n/projectSettingsI18n';
import { Settings } from '@/pages/Settings';
import type { ExportExtractorMethod, ExportInpaintMethod } from '@/types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  extraRequirements: string;
  templateStyle: string;
  onExtraRequirementsChange: (value: string) => void;
  onTemplateStyleChange: (value: string) => void;
  onSaveExtraRequirements: () => void;
  onSaveTemplateStyle: () => void;
  isSavingRequirements: boolean;
  isSavingTemplateStyle: boolean;
  exportExtractorMethod?: ExportExtractorMethod;
  exportInpaintMethod?: ExportInpaintMethod;
  exportAllowPartial?: boolean;
  onExportExtractorMethodChange?: (value: ExportExtractorMethod) => void;
  onExportInpaintMethodChange?: (value: ExportInpaintMethod) => void;
  onExportAllowPartialChange?: (value: boolean) => void;
  onSaveExportSettings?: () => void;
  isSavingExportSettings?: boolean;
}

type SettingsTab = 'project' | 'global' | 'export';

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  extraRequirements,
  templateStyle,
  onExtraRequirementsChange,
  onTemplateStyleChange,
  onSaveExtraRequirements,
  onSaveTemplateStyle,
  isSavingRequirements,
  isSavingTemplateStyle,
  exportExtractorMethod = 'hybrid',
  exportInpaintMethod = 'hybrid',
  exportAllowPartial = false,
  onExportExtractorMethodChange,
  onExportInpaintMethodChange,
  onExportAllowPartialChange,
  onSaveExportSettings,
  isSavingExportSettings = false,
}) => {
  const t = useT(projectSettingsI18n);
  const [activeTab, setActiveTab] = useState<SettingsTab>('project');

  const EXTRACTOR_METHOD_OPTIONS: { value: ExportExtractorMethod; labelKey: string; descKey: string }[] = [
    { value: 'hybrid', labelKey: 'projectSettings.extractorHybrid', descKey: 'projectSettings.extractorHybridDesc' },
    { value: 'mineru', labelKey: 'projectSettings.extractorMineru', descKey: 'projectSettings.extractorMineruDesc' },
  ];

  const INPAINT_METHOD_OPTIONS: { value: ExportInpaintMethod; labelKey: string; descKey: string; usesAI: boolean }[] = [
    { value: 'hybrid', labelKey: 'projectSettings.backgroundHybrid', descKey: 'projectSettings.backgroundHybridDesc', usesAI: true },
    { value: 'generative', labelKey: 'projectSettings.backgroundGenerative', descKey: 'projectSettings.backgroundGenerativeDesc', usesAI: true },
    { value: 'baidu', labelKey: 'projectSettings.backgroundBaidu', descKey: 'projectSettings.backgroundBaiduDesc', usesAI: false },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-background-secondary rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-border-primary flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-foreground-primary">{t('projectSettings.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-background-hover rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden min-h-0">
          <aside className="w-64 bg-gray-50 dark:bg-background-primary border-r border-gray-200 dark:border-border-primary flex-shrink-0">
            <nav className="p-4 space-y-2">
              <button
                onClick={() => setActiveTab('project')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'project'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white dark:bg-background-secondary text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover'
                }`}
              >
                <FileText size={20} />
                <span className="font-medium">{t('projectSettings.projectConfig')}</span>
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'export'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white dark:bg-background-secondary text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover'
                }`}
              >
                <Download size={20} />
                <span className="font-medium">{t('projectSettings.exportConfig')}</span>
              </button>
              <button
                onClick={() => setActiveTab('global')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'global'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white dark:bg-background-secondary text-gray-700 dark:text-foreground-secondary hover:bg-gray-100 dark:hover:bg-background-hover'
                }`}
              >
                <SettingsIcon size={20} />
                <span className="font-medium">{t('projectSettings.globalConfig')}</span>
              </button>
            </nav>
          </aside>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'project' ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary mb-4">{t('projectSettings.projectConfigTitle')}</h3>
                  <p className="text-sm text-gray-600 dark:text-foreground-tertiary mb-6">
                    {t('projectSettings.projectConfigDesc')}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-background-primary rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.extraRequirements')}</h4>
                    <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                      {t('projectSettings.extraRequirementsDesc')}
                    </p>
                  </div>
                  <Textarea
                    value={extraRequirements}
                    onChange={(e) => onExtraRequirementsChange(e.target.value)}
                    placeholder={t('projectSettings.extraRequirementsPlaceholder')}
                    rows={4}
                    className="text-sm"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onSaveExtraRequirements}
                    disabled={isSavingRequirements}
                    className="w-full sm:w-auto"
                  >
                    {isSavingRequirements ? t('shared.saving') : t('projectSettings.saveExtraRequirements')}
                  </Button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.styleDescription')}</h4>
                    <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                      {t('projectSettings.styleDescriptionDesc')}
                    </p>
                  </div>
                  <Textarea
                    value={templateStyle}
                    onChange={(e) => onTemplateStyleChange(e.target.value)}
                    placeholder={t('projectSettings.styleDescriptionPlaceholder')}
                    rows={5}
                    className="text-sm"
                  />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onSaveTemplateStyle}
                      disabled={isSavingTemplateStyle}
                      className="w-full sm:w-auto"
                    >
                      {isSavingTemplateStyle ? t('shared.saving') : t('projectSettings.saveStyleDescription')}
                    </Button>
                  </div>
                  <div className="bg-blue-100 rounded-md p-3">
                    <p className="text-xs text-blue-900">
                      💡 <strong>{t('projectSettings.tip')}：</strong>{t('projectSettings.styleTip')}
                    </p>
                  </div>
                </div>
              </div>
            ) : activeTab === 'export' ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary mb-4">{t('projectSettings.editablePptxExport')}</h3>
                  <p className="text-sm text-gray-600 dark:text-foreground-tertiary mb-6">
                    {t('projectSettings.editablePptxExportDesc')}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-background-primary rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.extractorMethod')}</h4>
                    <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                      {t('projectSettings.extractorMethodDesc')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {EXTRACTOR_METHOD_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          exportExtractorMethod === option.value
                            ? 'border-banana-500 bg-banana-50 dark:bg-background-secondary'
                            : 'border-gray-200 dark:border-border-primary hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-background-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="extractorMethod"
                          value={option.value}
                          checked={exportExtractorMethod === option.value}
                          onChange={(e) => onExportExtractorMethodChange?.(e.target.value as ExportExtractorMethod)}
                          className="mt-1 w-4 h-4 text-banana-500 focus:ring-banana-500"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-foreground-primary">{t(option.labelKey)}</div>
                          <div className="text-sm text-gray-600 dark:text-foreground-tertiary mt-1">{t(option.descKey)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.backgroundMethod')}</h4>
                    <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                      {t('projectSettings.backgroundMethodDesc')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {INPAINT_METHOD_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          exportInpaintMethod === option.value
                            ? 'border-banana-500 bg-banana-50 dark:bg-background-secondary'
                            : 'border-gray-200 dark:border-border-primary hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-background-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="inpaintMethod"
                          value={option.value}
                          checked={exportInpaintMethod === option.value}
                          onChange={(e) => onExportInpaintMethodChange?.(e.target.value as ExportInpaintMethod)}
                          className="mt-1 w-4 h-4 text-banana-500 focus:ring-banana-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-foreground-primary">{t(option.labelKey)}</span>
                            {option.usesAI && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Sparkles size={12} />
                                {t('projectSettings.usesAiModel')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-foreground-tertiary mt-1">{t(option.descKey)}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="bg-amber-100 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900">
                      <strong>{t('projectSettings.tip')}：</strong>{t('projectSettings.costTip')}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.errorHandling')}</h4>
                    <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                      {t('projectSettings.errorHandlingDesc')}
                    </p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportAllowPartial}
                      onChange={(e) => onExportAllowPartialChange?.(e.target.checked)}
                      className="mt-1 w-4 h-4 text-red-500 focus:ring-red-500 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-foreground-primary">{t('projectSettings.allowPartialResult')}</div>
                      <div className="text-sm text-gray-600 dark:text-foreground-tertiary mt-1">
                        {t('projectSettings.allowPartialResultDesc')}
                      </div>
                    </div>
                  </label>
                  <div className="bg-red-100 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-700 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-900">
                      <strong>{t('common.warning')}：</strong>{t('projectSettings.allowPartialResultWarning')}
                    </p>
                  </div>
                </div>

                {onSaveExportSettings && (
                  <div className="flex justify-end pt-4">
                    <Button
                      variant="primary"
                      onClick={onSaveExportSettings}
                      disabled={isSavingExportSettings}
                    >
                      {isSavingExportSettings ? t('shared.saving') : t('projectSettings.saveExportSettings')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-4xl">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-foreground-primary mb-2">{t('projectSettings.globalConfigTitle')}</h3>
                  <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
                    {t('projectSettings.globalConfigDesc')}
                  </p>
                </div>
                <Settings />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
