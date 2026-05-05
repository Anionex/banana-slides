import React, { useState } from 'react';
import { Sparkles, FileText, Palette, MessageSquare, Download, ChevronLeft, ChevronRight, ExternalLink, Settings, Check, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { useT } from '@/hooks/useT';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------
const i18nDict = {
  zh: {
    guide: {
      brand: '蕉幻 · Banana Slides',
      setup: '快速开始',
      setupSub: '完成基础配置，开启 AI 创作之旅',
      features: '功能介绍',
      featuresSub: '探索如何使用 AI 快速创建精美 PPT',
      gallery: '结果案例',
      gallerySub: '以下是使用蕉幻生成的 PPT 案例展示',
      galleryMore: '查看更多使用案例',
      hi: '欢迎使用蕉幻！',
      hiSub: '在开始前，让我们先完成基础配置',
      s1: '配置 API Key',
      s1d: '前往设置页面，配置项目需要使用的API服务，包括：',
      s1i: ['您的 AI 服务提供商的 API Base 和 API Key', '配置文本、图像生成模型(banana pro)和图像描述模型', '若需要文件解析功能，请配置 MinerU Token', '若需要可编辑导出功能，请配置MinerU TOKEN 和 Baidu API KEY'],
      s2: '保存并测试',
      s2d: '配置完成后，务必点击「保存设置」按钮，然后在页面底部进行服务测试，确保各项服务正常工作。',
      s3: '开始创作',
      s3d: '配置成功后，返回首页即可开始使用 AI 生成精美的 PPT！',
      s4: '*问题反馈',
      s4d: '若使用过程中遇到问题，可在github issue提出',
      issueLink: '前往Github issue',
      settingsBtn: '前往设置页面',
      hint: '提示',
      hintBody: '如果您还没有 API Key，可以前往对应服务商官网注册获取。配置完成后，建议先进行服务测试，避免后续使用出现问题。',
      prev: '上一页',
      next: '下一页',
      cases: { softwareDev: '软件开发最佳实践', deepseek: 'DeepSeek-V3.2技术展示', prefabFood: '预制菜智能产线装备研发和产业化', moneyHistory: '钱的演变：从贝壳到纸币的旅程' },
      feat: {
        paths: { t: '灵活多样的创作路径', d: '支持想法、大纲、页面描述三种起步方式，满足不同创作习惯。', items: ['一句话生成：输入一个主题，AI 自动生成结构清晰的大纲和逐页内容描述', '自然语言编辑：支持以 Vibe 形式口头修改大纲或描述，AI 实时响应调整', '大纲/描述模式：既可一键批量生成，也可手动调整细节'] },
        parse: { t: '强大的素材解析能力', d: '上传多种格式文件，自动解析内容，为生成提供丰富素材。', items: ['多格式支持：上传 PDF/Docx/MD/Txt 等文件，后台自动解析内容', '智能提取：自动识别文本中的关键点、图片链接和图表信息', '风格参考：支持上传参考图片或模板，定制 PPT 风格'] },
        vibe: { t: '「Vibe」式自然语言修改', d: '不再受限于复杂的菜单按钮，直接通过自然语言下达修改指令。', items: ['局部重绘：对不满意的区域进行口头式修改（如「把这个图换成饼图」）', '整页优化：基于 nano banana pro🍌 生成高清、风格统一的页面'] },
        export: { t: '开箱即用的格式导出', d: '一键导出标准格式，直接演示无需调整。', items: ['多格式支持：一键导出标准 PPTX 或 PDF 文件', '完美适配：默认 16:9 比例，排版无需二次调整'] },
        video: { t: 'TTS 讲解视频导出', d: '一键将幻灯片转换为带 AI 语音旁白和字幕的讲解视频。', items: ['AI 自动将页面描述转为口语化旁白，通过 edge-tts 合成语音', '支持中/英/日三种语言，多种音色可选', '逐句滚动字幕，自动按语音节奏切换', '可选 Ken Burns 画面动效（缩放/平移）'] },
      },
    },
  },
  en: {
    guide: {
      brand: 'Banana Slides',
      setup: 'Quick Start',
      setupSub: 'Complete basic configuration and start your AI creation journey',
      features: 'Features',
      featuresSub: 'Explore how to use AI to quickly create beautiful PPT',
      gallery: 'Showcases',
      gallerySub: 'Here are PPT examples generated with Banana Slides',
      galleryMore: 'View more examples',
      hi: 'Welcome to Banana Slides!',
      hiSub: "Let's complete the basic configuration before you start",
      s1: 'Configure API Key',
      s1d: 'Go to settings page to configure the API services needed for the project, including:',
      s1i: ["Your AI service provider's API Base and API Key", 'Configure text, image generation model (banana pro) and image caption model', 'If you need file parsing, configure MinerU Token', 'If you need editable export, configure MinerU TOKEN and Baidu API KEY'],
      s2: 'Save and Test',
      s2d: 'After configuration, be sure to click "Save Settings" button, then test services at the bottom of the page to ensure everything works properly.',
      s3: 'Start Creating',
      s3d: 'After successful configuration, return to home page to start using AI to generate beautiful PPT!',
      s4: '*Feedback',
      s4d: 'If you encounter issues while using, please raise them on GitHub issues',
      issueLink: 'Go to GitHub Issues',
      settingsBtn: 'Go to Settings',
      hint: 'Tip',
      hintBody: "If you don't have an API Key yet, you can register on the corresponding service provider's website. After configuration, it's recommended to test services first to avoid issues later.",
      prev: 'Previous',
      next: 'Next',
      cases: { softwareDev: 'Software Development Best Practices', deepseek: 'DeepSeek-V3.2 Technical Showcase', prefabFood: 'Prefab Food Intelligent Production Line R&D', moneyHistory: 'The Evolution of Money: From Shells to Paper' },
      feat: {
        paths: { t: 'Flexible Creation Paths', d: 'Support idea, outline, and page description as starting points to meet different creative habits.', items: ['One-line generation: Enter a topic, AI automatically generates a clear outline and page-by-page content description', 'Natural language editing: Support Vibe-style verbal modification of outlines or descriptions, AI responds in real-time', 'Outline/Description mode: Either batch generate with one click, or manually adjust details'] },
        parse: { t: 'Powerful Material Parsing', d: 'Upload multiple format files, automatically parse content to provide rich materials for generation.', items: ['Multi-format support: Upload PDF/Docx/MD/Txt files, backend automatically parses content', 'Smart extraction: Automatically identify key points, image links and chart information in text', 'Style reference: Support uploading reference images or templates to customize PPT style'] },
        vibe: { t: '"Vibe" Style Natural Language Editing', d: 'No longer limited by complex menu buttons, directly issue modification commands through natural language.', items: ['Partial redraw: Make verbal modifications to unsatisfying areas (e.g., "Change this chart to a pie chart")', 'Full page optimization: Generate HD, style-consistent pages based on nano banana pro🍌'] },
        export: { t: 'Ready-to-Use Format Export', d: 'One-click export to standard formats, present directly without adjustments.', items: ['Multi-format support: One-click export to standard PPTX or PDF files', 'Perfect fit: Default 16:9 ratio, no secondary layout adjustments needed'] },
        video: { t: 'TTS Narration Video Export', d: 'One-click conversion of slides into narrated videos with AI voiceover and subtitles.', items: ['AI converts page descriptions into natural spoken narration via edge-tts', 'Supports Chinese, English, and Japanese with multiple voice options', 'Sentence-by-sentence scrolling subtitles synchronized with speech', 'Optional Ken Burns animation effect (zoom/pan)'] },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------
const SHOWCASES = [
  { img: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644', key: 'softwareDev' },
  { img: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e', key: 'deepseek' },
  { img: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7', key: 'prefabFood' },
  { img: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1', key: 'moneyHistory' },
];

const FEATURES: { key: string; icon: React.ReactNode }[] = [
  { key: 'paths', icon: <Sparkles className="text-yellow-500" size={24} /> },
  { key: 'parse', icon: <FileText className="text-blue-500" size={24} /> },
  { key: 'vibe', icon: <MessageSquare className="text-green-500" size={24} /> },
  { key: 'export', icon: <Download className="text-purple-500" size={24} /> },
  { key: 'video', icon: <Video className="text-red-500" size={24} /> },
];

// ---------------------------------------------------------------------------
// Page renderers
// ---------------------------------------------------------------------------
/** Retrieve an array value from i18nDict by dot-path (useT only handles strings). */
function tList(lang: 'zh' | 'en', path: string): string[] {
  const dict = i18nDict[lang] as Record<string, unknown>;
  let cur: unknown = dict;
  for (const seg of path.split('.')) {
    if (cur && typeof cur === 'object' && seg in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return [];
    }
  }
  return Array.isArray(cur) ? cur : [];
}

type PageRenderer = (ctx: {
  t: ReturnType<typeof useT>;
  lang: 'zh' | 'en';
  navigate: ReturnType<typeof useNavigate>;
  onClose: () => void;
  showcaseIdx: number;
  setShowcaseIdx: (i: number) => void;
  expandedFeat: number | null;
  setExpandedFeat: (i: number | null) => void;
}) => React.ReactNode;

const renderSetupPage: PageRenderer = ({ t, lang, navigate, onClose }) => {
  const steps = [
    { num: '1', bg: 'bg-banana-500', content: (
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('guide.s1')}</h4>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('guide.s1d')}</p>
        <ul className="text-sm text-gray-600 dark:text-foreground-tertiary space-y-1 pl-4">
          {tList(lang, 'guide.s1i').map((item, i) => (
            <li key={i}>• {item}</li>
          ))}
        </ul>
      </div>
    ), highlight: true },
    { num: '2', bg: 'bg-orange-500', content: (
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('guide.s2')}</h4>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('guide.s2d')}</p>
      </div>
    ) },
    { num: <Check size={18} />, bg: 'bg-green-500', content: (
      <div className="flex-1 space-y-2">
        <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('guide.s3')}</h4>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('guide.s3d')}</p>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center mr-4">
          <img src="/logo.png" alt="Banana Slides Logo" className="h-16 w-16 object-contain" />
        </div>
        <h3 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">{t('guide.hi')}</h3>
        <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('guide.hiSub')}</p>
      </div>

      <div className="space-y-4">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex gap-4 p-4 rounded-xl border ${
              s.highlight
                ? 'bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 border-banana-200'
                : 'bg-white dark:bg-background-secondary border-gray-200 dark:border-border-primary'
            }`}
          >
            <div className={`flex-shrink-0 w-8 h-8 ${s.bg} text-white rounded-full flex items-center justify-center font-bold`}>
              {s.num}
            </div>
            {s.content}
          </div>
        ))}
      </div>

      <div className="flex gap-4 p-4 bg-white dark:bg-background-secondary rounded-xl border border-gray-200 dark:border-border-primary">
        <div className="flex-shrink-0 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
        <div className="flex-1 space-y-2">
          <h4 className="font-semibold text-gray-800 dark:text-foreground-primary">{t('guide.s4')}</h4>
          <p className="text-sm text-gray-600 dark:text-foreground-tertiary">{t('guide.s4d')}</p>
        </div>
        <a href="https://github.com/Anionex/banana-slides/issues" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium">
          <ExternalLink size={14} />
          {t('guide.issueLink')}
        </a>
      </div>

      <div className="flex justify-center pt-2">
        <Button onClick={() => { onClose(); navigate('/settings', { state: { from: window.location.pathname } }); }} className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white shadow-lg" icon={<Settings size={18} />}>
          {t('guide.settingsBtn')}
        </Button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          💡 <strong>{t('guide.hint')}</strong>：{t('guide.hintBody')}
        </p>
      </div>
    </div>
  );
};

const renderFeaturesPage: PageRenderer = ({ t, lang, expandedFeat, setExpandedFeat }) => (
  <div className="space-y-3">
    {FEATURES.map((f, idx) => (
      <div
        key={f.key}
        className={`border rounded-xl transition-all cursor-pointer ${
          expandedFeat === idx
            ? 'border-banana-300 bg-banana-50/50 shadow-sm dark:shadow-background-primary/30'
            : 'border-gray-200 dark:border-border-primary hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-background-hover'
        }`}
        onClick={() => setExpandedFeat(expandedFeat === idx ? null : idx)}
      >
        <div className="flex items-center gap-3 p-4">
          <div className="flex-shrink-0 w-10 h-10 bg-white dark:bg-background-secondary rounded-lg shadow-sm dark:shadow-background-primary/30 flex items-center justify-center">
            {f.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-gray-800 dark:text-foreground-primary">{t(`guide.feat.${f.key}.t`)}</h4>
            <p className="text-sm text-gray-500 dark:text-foreground-tertiary truncate">{t(`guide.feat.${f.key}.d`)}</p>
          </div>
          <ChevronRight size={18} className={`text-gray-400 transition-transform flex-shrink-0 ${expandedFeat === idx ? 'rotate-90' : ''}`} />
        </div>
        {expandedFeat === idx && (
          <div className="px-4 pb-4 pt-0">
            <div className="pl-13 space-y-2">
              {tList(lang, `guide.feat.${f.key}.items`).map((line, li) => (
                <div key={li} className="flex items-start gap-2 text-sm text-gray-600 dark:text-foreground-tertiary">
                  <span className="text-banana-500 mt-1">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    ))}
  </div>
);

const renderGalleryPage: PageRenderer = ({ t, showcaseIdx, setShowcaseIdx }) => {
  const prev = () => setShowcaseIdx(showcaseIdx === 0 ? SHOWCASES.length - 1 : showcaseIdx - 1);
  const next = () => setShowcaseIdx(showcaseIdx === SHOWCASES.length - 1 ? 0 : showcaseIdx + 1);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-foreground-tertiary text-center">{t('guide.gallerySub')}</p>

      <div className="relative">
        <div className="aspect-video bg-gray-100 dark:bg-background-secondary rounded-xl overflow-hidden shadow-lg">
          <img src={SHOWCASES[showcaseIdx].img} alt={t(`guide.cases.${SHOWCASES[showcaseIdx].key}`)} className="w-full h-full object-cover" />
        </div>
        <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
          <ChevronLeft size={20} />
        </button>
        <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-foreground-primary">{t(`guide.cases.${SHOWCASES[showcaseIdx].key}`)}</h3>
      </div>

      <div className="flex justify-center gap-2">
        {SHOWCASES.map((_, i) => (
          <button key={i} onClick={() => setShowcaseIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === showcaseIdx ? 'bg-banana-500 w-6' : 'bg-gray-300 hover:bg-gray-400'}`} />
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        {SHOWCASES.map((sc, i) => (
          <button key={i} onClick={() => setShowcaseIdx(i)} className={`aspect-video rounded-lg overflow-hidden border-2 transition-all ${i === showcaseIdx ? 'border-banana-500 ring-2 ring-banana-200' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'}`}>
            <img src={sc.img} alt={t(`guide.cases.${sc.key}`)} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      <div className="text-center pt-4">
        <a href="https://github.com/Anionex/banana-slides/issues/2" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-banana-600 hover:text-banana-700 font-medium">
          <ExternalLink size={14} />
          {t('guide.galleryMore')}
        </a>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pages definition
// ---------------------------------------------------------------------------
interface PageDef {
  titleKey: string;
  subtitleKey: string;
  render: PageRenderer;
}

const PAGES: PageDef[] = [
  { titleKey: 'guide.setup', subtitleKey: 'guide.setupSub', render: renderSetupPage },
  { titleKey: 'guide.features', subtitleKey: 'guide.featuresSub', render: renderFeaturesPage },
  { titleKey: 'guide.gallery', subtitleKey: 'guide.gallerySub', render: renderGalleryPage },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const t = useT(i18nDict);
  const { i18n } = useTranslation();
  const lang: 'zh' | 'en' = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const navigate = useNavigate();
  const [pageIdx, setPageIdx] = useState(0);
  const [showcaseIdx, setShowcaseIdx] = useState(0);
  const [expandedFeat, setExpandedFeat] = useState<number | null>(null);

  const page = PAGES[pageIdx];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-6">
        {/* header */}
        <div className="text-center pb-4 border-b border-gray-100 dark:border-border-primary">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-banana-50 dark:from-background-primary to-orange-50 rounded-full mb-3">
            <Palette size={18} className="text-banana-600" />
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('guide.brand')}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-foreground-primary">{t(page.titleKey)}</h2>
          <p className="text-sm text-gray-500 dark:text-foreground-tertiary mt-1">{t(page.subtitleKey)}</p>
        </div>

        {/* dots */}
        <div className="flex justify-center gap-2">
          {PAGES.map((p, i) => (
            <button
              key={i}
              onClick={() => setPageIdx(i)}
              className={`h-2 rounded-full transition-all ${i === pageIdx ? 'bg-banana-500 w-8' : 'bg-gray-300 hover:bg-gray-400 w-2'}`}
              title={t(p.titleKey)}
            />
          ))}
        </div>

        {/* body */}
        <div className="min-h-[400px]">
          {page.render({ t, lang, navigate, onClose, showcaseIdx, setShowcaseIdx, expandedFeat, setExpandedFeat })}
        </div>

        {/* footer */}
        <div className="pt-4 border-t flex justify-between items-center">
          <div className="flex items-center gap-2">
            {pageIdx > 0 && (
              <Button variant="ghost" onClick={() => setPageIdx(pageIdx - 1)} icon={<ChevronLeft size={16} />} size="sm">
                {t('guide.prev')}
              </Button>
            )}
          </div>

          <a href="https://github.com/Anionex/banana-slides" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-foreground-tertiary hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
            <ExternalLink size={14} />
            GitHub
          </a>

          <div className="flex items-center gap-2">
            {pageIdx < PAGES.length - 1 ? (
              <Button onClick={() => setPageIdx(pageIdx + 1)} icon={<ChevronRight size={16} />} size="sm" className="bg-banana-500 hover:bg-banana-600 text-black dark:text-white">
                {t('guide.next')}
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
