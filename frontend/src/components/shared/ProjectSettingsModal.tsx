import React, { useState } from 'react';
import { X, FileText, Settings as SettingsIcon, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Textarea } from '@/components/shared';
import { Settings } from '@/pages/Settings';
import type { ExportExtractorMethod, ExportInpaintMethod } from '@/types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 项目设置
  extraRequirements: string;
  templateStyle: string;
  onExtraRequirementsChange: (value: string) => void;
  onTemplateStyleChange: (value: string) => void;
  onSaveExtraRequirements: () => void;
  onSaveTemplateStyle: () => void;
  isSavingRequirements: boolean;
  isSavingTemplateStyle: boolean;
  // 导出设置
  exportExtractorMethod?: ExportExtractorMethod;
  exportInpaintMethod?: ExportInpaintMethod;
  onExportExtractorMethodChange?: (value: ExportExtractorMethod) => void;
  onExportInpaintMethodChange?: (value: ExportInpaintMethod) => void;
  onSaveExportSettings?: () => void;
  isSavingExportSettings?: boolean;
}

type SettingsTab = 'project' | 'global' | 'export';

// Hook to get extractor method options with i18n
const useExtractorMethodOptions = () => {
  const { t } = useTranslation();
  return [
    {
      value: 'hybrid' as ExportExtractorMethod,
      label: t('components.projectSettings.export.extractor.hybrid.label'),
      description: t('components.projectSettings.export.extractor.hybrid.description'),
    },
    {
      value: 'mineru' as ExportExtractorMethod,
      label: t('components.projectSettings.export.extractor.mineru.label'),
      description: t('components.projectSettings.export.extractor.mineru.description'),
    },
  ];
};

// Hook to get inpaint method options with i18n
const useInpaintMethodOptions = () => {
  const { t } = useTranslation();
  return [
    {
      value: 'hybrid' as ExportInpaintMethod,
      label: t('components.projectSettings.export.inpaint.hybrid.label'),
      description: t('components.projectSettings.export.inpaint.hybrid.description'),
      usesAI: true,
    },
    {
      value: 'generative' as ExportInpaintMethod,
      label: t('components.projectSettings.export.inpaint.generative.label'),
      description: t('components.projectSettings.export.inpaint.generative.description'),
      usesAI: true,
    },
    {
      value: 'baidu' as ExportInpaintMethod,
      label: t('components.projectSettings.export.inpaint.baidu.label'),
      description: t('components.projectSettings.export.inpaint.baidu.description'),
      usesAI: false,
    },
  ];
};

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
  // 导出设置
  exportExtractorMethod = 'hybrid',
  exportInpaintMethod = 'hybrid',
  onExportExtractorMethodChange,
  onExportInpaintMethodChange,
  onSaveExportSettings,
  isSavingExportSettings = false,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('project');
  const { t } = useTranslation();
  const EXTRACTOR_METHOD_OPTIONS = useExtractorMethodOptions();
  const INPAINT_METHOD_OPTIONS = useInpaintMethodOptions();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900">{t('components.projectSettings.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        {/* 主内容区 */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* 左侧导航栏 */}
          <aside className="w-64 bg-gray-50 border-r border-gray-200 flex-shrink-0">
            <nav className="p-4 space-y-2">
              <button
                onClick={() => setActiveTab('project')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'project'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <FileText size={20} />
                <span className="font-medium">{t('components.projectSettings.tabs.project')}</span>
              </button>
              <button
                onClick={() => setActiveTab('export')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'export'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Download size={20} />
                <span className="font-medium">{t('components.projectSettings.tabs.export')}</span>
              </button>
              <button
                onClick={() => setActiveTab('global')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  activeTab === 'global'
                    ? 'bg-banana-500 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <SettingsIcon size={20} />
                <span className="font-medium">{t('components.projectSettings.tabs.global')}</span>
              </button>
            </nav>
          </aside>

          {/* 右侧内容区 */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'project' ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('components.projectSettings.project.title')}</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {t('components.projectSettings.project.description')}
                  </p>
                </div>

                {/* 额外要求 */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">{t('components.projectSettings.project.extraRequirements.title')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('components.projectSettings.project.extraRequirements.description')}
                    </p>
                  </div>
                  <Textarea
                    value={extraRequirements}
                    onChange={(e) => onExtraRequirementsChange(e.target.value)}
                    placeholder={t('components.projectSettings.project.extraRequirements.placeholder')}
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
                    {isSavingRequirements ? t('components.projectSettings.project.extraRequirements.saving') : t('components.projectSettings.project.extraRequirements.save')}
                  </Button>
                </div>

                {/* 风格描述 */}
                <div className="bg-blue-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">{t('components.projectSettings.project.style.title')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('components.projectSettings.project.style.description')}
                    </p>
                  </div>
                  <Textarea
                    value={templateStyle}
                    onChange={(e) => onTemplateStyleChange(e.target.value)}
                    placeholder={t('components.projectSettings.project.style.placeholder')}
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
                      {isSavingTemplateStyle ? t('components.projectSettings.project.style.saving') : t('components.projectSettings.project.style.save')}
                    </Button>
                  </div>
                  <div className="bg-blue-100 rounded-md p-3">
                    <p className="text-xs text-blue-900">
                      {t('components.projectSettings.project.style.tip')}
                    </p>
                  </div>
                </div>
              </div>
            ) : activeTab === 'export' ? (
              <div className="max-w-3xl space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('components.projectSettings.export.title')}</h3>
                  <p className="text-sm text-gray-600 mb-6">
                    {t('components.projectSettings.export.description')}
                  </p>
                </div>

                {/* 组件提取方法 */}
                <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">{t('components.projectSettings.export.extractor.title')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('components.projectSettings.export.extractor.description')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {EXTRACTOR_METHOD_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          exportExtractorMethod === option.value
                            ? 'border-banana-500 bg-banana-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
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
                          <div className="font-medium text-gray-900">{option.label}</div>
                          <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 背景图获取方法 */}
                <div className="bg-orange-50 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">{t('components.projectSettings.export.inpaint.title')}</h4>
                    <p className="text-sm text-gray-600">
                      {t('components.projectSettings.export.inpaint.description')}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {INPAINT_METHOD_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          exportInpaintMethod === option.value
                            ? 'border-banana-500 bg-banana-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
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
                            <span className="font-medium text-gray-900">{option.label}</span>
                            {option.usesAI && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                <Sparkles size={12} />
                                {t('components.projectSettings.export.inpaint.usesAI')}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="bg-amber-100 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900">
                      {t('components.projectSettings.export.costTip')}
                    </p>
                  </div>
                </div>

                {/* 保存按钮 */}
                {onSaveExportSettings && (
                  <div className="flex justify-end pt-4">
                    <Button
                      variant="primary"
                      onClick={onSaveExportSettings}
                      disabled={isSavingExportSettings}
                    >
                      {isSavingExportSettings ? t('components.projectSettings.export.saving') : t('components.projectSettings.export.save')}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="max-w-4xl">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('components.projectSettings.global.title')}</h3>
                  <p className="text-sm text-gray-600">
                    {t('components.projectSettings.global.description')}
                  </p>
                </div>
                {/* 复用 Settings 组件的内容 */}
                <Settings />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

