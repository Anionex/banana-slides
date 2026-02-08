import React, { useState } from 'react';
import { X, FileText, Settings as SettingsIcon, Download, Sparkles, AlertTriangle } from 'lucide-react';
import { Button, Textarea } from '@/components/shared';
import { useT } from '@/hooks/useT';
import { Settings } from '@/pages/Settings';
import type { ExportExtractorMethod, ExportInpaintMethod } from '@/types';

// ProjectSettings 组件自包含翻译
const projectSettingsI18n = {
  zh: {
    projectSettings: {
      title: "设置", projectConfig: "项目设置", exportConfig: "导出设置", globalConfig: "全局设置",
      projectConfigTitle: "项目级配置", projectConfigDesc: "这些设置仅应用于当前项目，不影响其他项目",
      globalConfigTitle: "全局设置", globalConfigDesc: "这些设置应用于所有项目",
      extraRequirements: "额外要求", extraRequirementsDesc: "在生成每个页面时，AI 会参考这些额外要求",
      extraRequirementsPlaceholder: "例如：使用紧凑的布局，顶部展示一级大纲标题，加入更丰富的PPT插图...",
      saveExtraRequirements: "保存额外要求",
      styleDescription: "风格描述", styleDescriptionDesc: "描述您期望的 PPT 整体风格，AI 将根据描述生成相应风格的页面",
      styleDescriptionPlaceholder: "例如：简约商务风格，使用深蓝色和白色配色，字体清晰大方，布局整洁...",
      saveStyleDescription: "保存风格描述",
      styleTip: "风格描述会在生成图片时自动添加到提示词中。如果同时上传了模板图片，风格描述会作为补充说明。",
      editablePptxExport: "可编辑 PPTX 导出设置", editablePptxExportDesc: "配置「导出可编辑 PPTX」功能的处理方式。这些设置影响导出质量和API调用成本。",
      extractorMethod: "组件提取方法", extractorMethodDesc: "选择如何从PPT图片中提取文字、表格等可编辑组件",
      extractorHybrid: "混合提取（推荐）", extractorHybridDesc: "MinerU版面分析 + 百度高精度OCR，文字识别更精确",
      extractorMineru: "MinerU提取", extractorMineruDesc: "仅使用MinerU进行版面分析和文字识别",
      backgroundMethod: "背景图获取方法", backgroundMethodDesc: "选择如何生成干净的背景图（移除原图中的文字后用于PPT背景）",
      backgroundHybrid: "混合方式获取（推荐）", backgroundHybridDesc: "百度精确去除文字 + 生成式模型提升画质",
      backgroundGenerative: "生成式获取", backgroundGenerativeDesc: "使用生成式大模型（如Gemini）直接生成背景，背景质量高但有遗留元素的可能",
      backgroundBaidu: "百度抹除服务获取", backgroundBaiduDesc: "使用百度图像修复API，速度快但画质一般",
      usesAiModel: "使用文生图模型",
      costTip: "标有「使用文生图模型」的选项会调用AI图片生成API（如Gemini），每页会产生额外的API调用费用。如果需要控制成本，可选择「百度修复」方式。",
      errorHandling: "错误处理策略", errorHandlingDesc: "配置导出过程中遇到错误时的处理方式",
      allowPartialResult: "允许返回半成品", allowPartialResultDesc: "开启后，导出过程中遇到错误（如样式提取失败、文本渲染失败等）时会跳过错误继续导出，最终可能得到不完整的结果。关闭时，任何错误都会立即停止导出并提示具体原因。",
      allowPartialResultWarning: "开启此选项可能导致导出的 PPTX 文件中部分文字样式丢失、元素位置错误或内容缺失。建议仅在需要快速获取结果且可以接受质量损失时开启。",
      saveExportSettings: "保存导出设置",
      tip: "提示"
    },
    shared: { saving: "保存中..." }
  },
  en: {
    projectSettings: {
      title: "Settings", projectConfig: "Project Settings", exportConfig: "Export Settings", globalConfig: "Global Settings",
      projectConfigTitle: "Project-level Configuration", projectConfigDesc: "These settings only apply to the current project",
      globalConfigTitle: "Global Settings", globalConfigDesc: "These settings apply to all projects",
      extraRequirements: "Extra Requirements", extraRequirementsDesc: "AI will reference these extra requirements when generating each page",
      extraRequirementsPlaceholder: "e.g., Use compact layout, show first-level outline title at top, add richer PPT illustrations...",
      saveExtraRequirements: "Save Extra Requirements",
      styleDescription: "Style Description", styleDescriptionDesc: "Describe your expected PPT overall style, AI will generate pages in that style",
      styleDescriptionPlaceholder: "e.g., Simple business style, use navy blue and white colors, clear fonts, clean layout...",
      saveStyleDescription: "Save Style Description",
      styleTip: "Style description will be automatically added to the prompt when generating images. If a template image is also uploaded, the style description will serve as supplementary notes.",
      editablePptxExport: "Editable PPTX Export Settings", editablePptxExportDesc: "Configure how \"Export Editable PPTX\" works. These settings affect export quality and API call costs.",
      extractorMethod: "Component Extraction Method", extractorMethodDesc: "Choose how to extract editable components like text and tables from PPT images",
      extractorHybrid: "Hybrid Extraction (Recommended)", extractorHybridDesc: "MinerU layout analysis + Baidu high-precision OCR for more accurate text recognition",
      extractorMineru: "MinerU Extraction", extractorMineruDesc: "Use only MinerU for layout analysis and text recognition",
      backgroundMethod: "Background Image Method", backgroundMethodDesc: "Choose how to generate clean background images (remove text from original for PPT background)",
      backgroundHybrid: "Hybrid Method (Recommended)", backgroundHybridDesc: "Baidu precise text removal + generative model quality enhancement",
      backgroundGenerative: "Generative Method", backgroundGenerativeDesc: "Use generative model (like Gemini) to directly generate background, high quality but may have residual elements",
      backgroundBaidu: "Baidu Inpainting", backgroundBaiduDesc: "Use Baidu image repair API, fast but average quality",
      usesAiModel: "Uses AI Image Model",
      costTip: "Options marked \"Uses AI Image Model\" will call AI image generation API (like Gemini), incurring extra API costs per page. To control costs, choose \"Baidu Inpainting\".",
      errorHandling: "Error Handling Strategy", errorHandlingDesc: "Configure how to handle errors during export",
      allowPartialResult: "Allow Partial Results", allowPartialResultDesc: "When enabled, export will skip errors (like style extraction or text rendering failures) and continue, potentially resulting in incomplete output. When disabled, any error will stop export immediately with a specific reason.",
      allowPartialResultWarning: "Enabling this option may result in PPTX files with missing text styles, mispositioned elements, or missing content. Only enable when you need quick results and can accept quality loss.",
      saveExportSettings: "Save Export Settings",
      tip: "Tip"
    },
    shared: { saving: "Saving..." }
  }
};

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
                  <div className="bg-blue-100 dark:bg-blue-900/30 rounded-md p-3">
                    <p className="text-xs text-blue-900 dark:text-blue-300">
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

                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-6 space-y-4">
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
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
                  <div className="bg-amber-100 dark:bg-amber-900/20 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-900 dark:text-amber-300">
                      <strong>{t('projectSettings.tip')}：</strong>{t('projectSettings.costTip')}
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 space-y-4">
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
                  <div className="bg-red-100 dark:bg-red-900/20 rounded-md p-3 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-700 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-900 dark:text-red-300">
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
