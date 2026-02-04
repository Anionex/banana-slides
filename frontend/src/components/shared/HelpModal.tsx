import React, { useState } from 'react';
import { Sparkles, FileText, Palette, MessageSquare, Download, ChevronLeft, ChevronRight, ExternalLink, Settings, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { useT } from '@/hooks/useT';

const helpI18n = {
  zh: {
    help: {
      title: "蕉幻 · Banana Slides", quickStart: "快速开始", quickStartDesc: "完成基础配置，开启 AI 创作之旅",
      featuresIntro: "功能介绍", featuresIntroDesc: "探索如何使用 AI 快速创建精美 PPT",
      showcases: "结果案例", showcasesDesc: "以下是使用蕉幻生成的 PPT 案例展示", viewMoreCases: "查看更多使用案例",
      welcome: "欢迎使用蕉幻！", welcomeDesc: "在开始前，让我们先完成基础配置",
      step1Title: "配置 API Key", step1Desc: "前往设置页面，配置项目需要使用的API服务，包括：",
      step1Items: { apiConfig: "您的 AI 服务提供商的 API Base 和 API Key", modelConfig: "配置文本、图像生成模型(banana pro)和图像描述模型", mineruConfig: "若需要文件解析功能，请配置 MinerU Token", editableExport: "若需要可编辑导出功能，请配置MinerU TOKEN 和 Baidu API KEY" },
      step2Title: "保存并测试", step2Desc: "配置完成后，务必点击「保存设置」按钮，然后在页面底部进行服务测试，确保各项服务正常工作。",
      step3Title: "开始创作", step3Desc: "配置成功后，返回首页即可开始使用 AI 生成精美的 PPT！",
      step4Title: "*问题反馈", step4Desc: "若使用过程中遇到问题，可在github issue提出",
      goToGithubIssue: "前往Github issue", goToSettings: "前往设置页面",
      tip: "提示", tipContent: "如果您还没有 API Key，可以前往对应服务商官网注册获取。配置完成后，建议先进行服务测试，避免后续使用出现问题。",
      prevPage: "上一页", nextPage: "下一页", guidePage: "引导页",
      showcaseTitles: { softwareDev: "软件开发最佳实践", deepseek: "DeepSeek-V3.2技术展示", prefabFood: "预制菜智能产线装备研发和产业化", moneyHistory: "钱的演变：从贝壳到纸币的旅程" },
      features: {
        flexiblePaths: { title: "灵活多样的创作路径", description: "支持想法、大纲、页面描述三种起步方式，满足不同创作习惯。", details: ["一句话生成：输入一个主题，AI 自动生成结构清晰的大纲和逐页内容描述", "自然语言编辑：支持以 Vibe 形式口头修改大纲或描述，AI 实时响应调整", "大纲/描述模式：既可一键批量生成，也可手动调整细节"] },
        materialParsing: { title: "强大的素材解析能力", description: "上传多种格式文件，自动解析内容，为生成提供丰富素材。", details: ["多格式支持：上传 PDF/Docx/MD/Txt 等文件，后台自动解析内容", "智能提取：自动识别文本中的关键点、图片链接和图表信息", "风格参考：支持上传参考图片或模板，定制 PPT 风格"] },
        vibeEditing: { title: "「Vibe」式自然语言修改", description: "不再受限于复杂的菜单按钮，直接通过自然语言下达修改指令。", details: ["局部重绘：对不满意的区域进行口头式修改（如「把这个图换成饼图」）", "整页优化：基于 nano banana pro🍌 生成高清、风格统一的页面"] },
        easyExport: { title: "开箱即用的格式导出", description: "一键导出标准格式，直接演示无需调整。", details: ["多格式支持：一键导出标准 PPTX 或 PDF 文件", "完美适配：默认 16:9 比例，排版无需二次调整"] }
      }
    }
  },
  en: {
    help: {
      title: "Banana Slides", quickStart: "Quick Start", quickStartDesc: "Complete basic configuration and start your AI creation journey",
      featuresIntro: "Features", featuresIntroDesc: "Explore how to use AI to quickly create beautiful PPT",
      showcases: "Showcases", showcasesDesc: "Here are PPT examples generated with Banana Slides", viewMoreCases: "View more examples",
      welcome: "Welcome to Banana Slides!", welcomeDesc: "Let's complete the basic configuration before you start",
      step1Title: "Configure API Key", step1Desc: "Go to settings page to configure the API services needed for the project, including:",
      step1Items: { apiConfig: "Your AI service provider's API Base and API Key", modelConfig: "Configure text, image generation model (banana pro) and image caption model", mineruConfig: "If you need file parsing, configure MinerU Token", editableExport: "If you need editable export, configure MinerU TOKEN and Baidu API KEY" },
      step2Title: "Save and Test", step2Desc: "After configuration, be sure to click \"Save Settings\" button, then test services at the bottom of the page to ensure everything works properly.",
      step3Title: "Start Creating", step3Desc: "After successful configuration, return to home page to start using AI to generate beautiful PPT!",
      step4Title: "*Feedback", step4Desc: "If you encounter issues while using, please raise them on GitHub issues",
      goToGithubIssue: "Go to GitHub Issues", goToSettings: "Go to Settings",
      tip: "Tip", tipContent: "If you don't have an API Key yet, you can register on the corresponding service provider's website. After configuration, it's recommended to test services first to avoid issues later.",
      prevPage: "Previous", nextPage: "Next", guidePage: "Guide",
      showcaseTitles: { softwareDev: "Software Development Best Practices", deepseek: "DeepSeek-V3.2 Technical Showcase", prefabFood: "Prefab Food Intelligent Production Line R&D", moneyHistory: "The Evolution of Money: From Shells to Paper" },
      features: {
        flexiblePaths: { title: "Flexible Creation Paths", description: "Support idea, outline, and page description as starting points to meet different creative habits.", details: ["One-line generation: Enter a topic, AI automatically generates a clear outline and page-by-page content description", "Natural language editing: Support Vibe-style verbal modification of outlines or descriptions, AI responds in real-time", "Outline/Description mode: Either batch generate with one click, or manually adjust details"] },
        materialParsing: { title: "Powerful Material Parsing", description: "Upload multiple format files, automatically parse content to provide rich materials for generation.", details: ["Multi-format support: Upload PDF/Docx/MD/Txt files, backend automatically parses content", "Smart extraction: Automatically identify key points, image links and chart information in text", "Style reference: Support uploading reference images or templates to customize PPT style"] },
        vibeEditing: { title: "\"Vibe\" Style Natural Language Editing", description: "No longer limited by complex menu buttons, directly issue modification commands through natural language.", details: ["Partial redraw: Make verbal modifications to unsatisfying areas (e.g., \"Change this chart to a pie chart\")", "Full page optimization: Generate HD, style-consistent pages based on nano banana pro🍌"] },
        easyExport: { title: "Ready-to-Use Format Export", description: "One-click export to standard formats, present directly without adjustments.", details: ["Multi-format support: One-click export to standard PPTX or PDF files", "Perfect fit: Default 16:9 ratio, no secondary layout adjustments needed"] }
      }
    }
  }
};

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Showcase data with i18n keys
const showcaseKeys = [
  { image: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644', titleKey: 'softwareDev' },
  { image: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e', titleKey: 'deepseek' },
  { image: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7', titleKey: 'prefabFood' },
  { image: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1', titleKey: 'moneyHistory' },
];

// Feature keys for i18n
const featureKeys = ['flexiblePaths', 'materialParsing', 'vibeEditing', 'easyExport'] as const;
const featureIcons = [
  <Sparkles className="text-yellow-500" size={24} />,
  <FileText className="text-blue-500" size={24} />,
  <MessageSquare className="text-green-500" size={24} />,
  <Download className="text-purple-500" size={24} />,
];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const t = useT(helpI18n);
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(0);
  const [currentShowcase, setCurrentShowcase] = useState(0);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);

  const totalPages = 3;

  const handlePrevShowcase = () => {
    setCurrentShowcase((prev) => (prev === 0 ? showcaseKeys.length - 1 : prev - 1));
  };

  const handleNextShowcase = () => {
    setCurrentShowcase((prev) => (prev === showcaseKeys.length - 1 ? 0 : prev + 1));
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings');
  };

  const renderGuidePage = () => (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center mr-4">
          <img
            src="/logo.png"
            alt="Banana Slides Logo"
            className="h-16 w-16 object-contain"
          />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">{t('help.welcome')}</h3>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('help.welcomeDesc')}</p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-4 p-4 bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 rounded-xl border border-banana-200">
          <div className="flex-shrink-0 w-8 h-8 bg-banana-500 text-white rounded-full flex items-center justify-center font-bold">
            1
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step1Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step1Desc')}
            </p>
            <ul className="text-sm text-gray-600 dark:text-foreground-tertiary space-y-1 pl-4">
              <li>• {t('help.step1Items.apiConfig')}</li>
              <li>• {t('help.step1Items.modelConfig')}</li>
              <li>• {t('help.step1Items.mineruConfig')}</li>
              <li>• {t('help.step1Items.editableExport')}</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
          <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
            2
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step2Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step2Desc')}
            </p>
          </div>
        </div>

        <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
          <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">
            <Check size={18} />
          </div>
          <div className="flex-1 space-y-2">
            <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step3Title')}</h4>
            <p className="text-sm text-gray-600 dark:text-foreground-tertiary">
              {t('help.step3Desc')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
        <div className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">
          4
        </div>
        <div className="flex-1 space-y-2">
          <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('help.step4Title')}</h4>
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('help.step4Desc')}</p>
        </div>
        <a
          href="https://github.com/Anionex/banana-slides/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium"
        >
          <ExternalLink size={14} />
          {t('help.goToGithubIssue')}
        </a>
      </div>

      <div className="flex justify-center pt-2">
        <Button
          onClick={handleGoToSettings}
          className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white shadow-lg"
          icon={<Settings size={18} />}
        >
          {t('help.goToSettings')}
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          💡 <strong>{t('help.tip')}</strong>：{t('help.tipContent')}
        </p>
      </div>
    </div>
  );

  const renderShowcasePage = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-foreground-tertiary text-center">
        {t('help.showcasesDesc')}
      </p>

      <div className="relative">
        <div className="aspect-video bg-gray-100 dark:bg-background-secondary rounded-xl overflow-hidden shadow-lg">
          <img
            src={showcaseKeys[currentShowcase].image}
            alt={t(`help.showcaseTitles.${showcaseKeys[currentShowcase].titleKey}`)}
            className="w-full h-full object-cover"
          />
        </div>

        <button
          onClick={handlePrevShowcase}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={handleNextShowcase}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground-primary">
          {t(`help.showcaseTitles.${showcaseKeys[currentShowcase].titleKey}`)}
        </h3>
      </div>

      <div className="flex justify-center gap-2">
        {showcaseKeys.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentShowcase(idx)}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentShowcase
                ? 'bg-banana-500 w-6'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {showcaseKeys.map((showcase, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentShowcase(idx)}
            className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${
              idx === currentShowcase
                ? 'border-banana-500 ring-2 ring-banana-200'
                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <img
              src={showcase.image}
              alt={t(`help.showcaseTitles.${showcase.titleKey}`)}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      <div className="text-center pt-4">
        <a
          href="https://github.com/Anionex/banana-slides/issues/2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium"
        >
          <ExternalLink size={14} />
          {t('help.viewMoreCases')}
        </a>
      </div>
    </div>
  );

  const renderFeaturesPage = () => (
    <div className="space-y-3">
      {featureKeys.map((featureKey, idx) => (
        <div
          key={idx}
          className={`border rounded-xl transition-all cursor-pointer ${
            expandedFeature === idx
              ? 'border-banana-300 bg-banana-50/50 shadow-sm dark:shadow-background-primary/30'
              : 'border-gray-200 dark:border-border-primary hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-background-hover'
          }`}
          onClick={() => setExpandedFeature(expandedFeature === idx ? null : idx)}
        >
          <div className="flex items-center gap-3 p-4">
            <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-background-secondary rounded-lg shadow-sm dark:shadow-background-primary/30 flex items-center justify-center">
              {featureIcons[idx]}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-gray-800 dark:text-foreground-primary">
                {t(`help.features.${featureKey}.title`)}
              </h4>
              <p className="text-sm text-gray-500 dark:text-foreground-tertiary truncate">
                {t(`help.features.${featureKey}.description`)}
              </p>
            </div>
            <ChevronRight
              size={18}
              className={`text-gray-400 transition-transform flex-shrink-0 ${
                expandedFeature === idx ? 'rotate-90' : ''
              }`}
            />
          </div>

          {expandedFeature === idx && (
            <div className="px-4 pb-4 pt-0">
              <div className="pl-13 space-y-2">
                {(t(`help.features.${featureKey}.details`, { returnObjects: true }) as string[]).map((detail: string, detailIdx: number) => (
                  <div key={detailIdx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
                    <span className="text-banana-500 mt-1">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        <div className="text-center pb-4 border-b border-gray-100 dark:border-border-primary">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 rounded-full mb-3">
            <Palette size={18} className="text-banana-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('help.title')}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">
            {currentPage === 0 ? t('help.quickStart') : currentPage === 1 ? t('help.featuresIntro') : t('help.showcases')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">
            {currentPage === 0 ? t('help.quickStartDesc') : t('help.featuresIntroDesc')}
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPage(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === currentPage
                  ? 'bg-banana-500 w-8'
                  : 'bg-gray-300 hover:bg-gray-400 w-2'
              }`}
              title={idx === 0 ? t('help.guidePage') : idx === 1 ? t('help.featuresIntro') : t('help.showcases')}
            />
          ))}
        </div>

        <div className="min-h-[400px]">
          {currentPage === 0 && renderGuidePage()}
          {currentPage === 1 && renderFeaturesPage()}
          {currentPage === 2 && renderShowcasePage()}
        </div>

        <div className="pt-4 border-t flex justify-between items-center">
          <div className="flex items-center gap-2">
            {currentPage > 0 && (
              <Button
                variant="ghost"
                onClick={handlePrevPage}
                icon={<ChevronLeft size={16} />}
                size="sm"
              >
                {t('help.prevPage')}
              </Button>
            )}
          </div>

          <a
            href="https://github.com/Anionex/banana-slides"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
          >
            <ExternalLink size={14} />
            GitHub
          </a>

          <div className="flex items-center gap-2">
            {currentPage < totalPages - 1 ? (
              <Button
                onClick={handleNextPage}
                icon={<ChevronRight size={16} />}
                size="sm"
                className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white"
              >
                {t('help.nextPage')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onClose} size="sm">
                {t('common.close')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
