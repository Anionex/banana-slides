import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, MessageSquare, Download, ChevronRight, Github, ChevronLeft } from 'lucide-react';
import { Button, Footer } from '@/components/shared';
import { useT } from '@/hooks/useT';

// 组件内翻译
const landingI18n = {
  zh: {
    landing: {
      nav: { enter: "进入应用" },
      hero: {
        badge: "新一代 AI 演示文稿生成器",
        title_start: "让创意",
        title_highlight: "瞬间落地",
        title_end: "无需繁琐排版",
        subtitle: "专注于您的内容与想法，剩下的交给 Banana Slides。从大纲到精美幻灯片，只需几分钟。",
        cta_primary: "免费开始使用"
      }
    }
  },
  en: {
    landing: {
      nav: { enter: "Enter App" },
      hero: {
        badge: "Next Gen AI Presentation Generator",
        title_start: "Turn Ideas into",
        title_highlight: "Reality Instantly",
        title_end: "No Formatting Hassle",
        subtitle: "Focus on your content and ideas, leave the rest to Banana Slides. From outline to beautiful slides in seconds.",
        cta_primary: "Get Started for Free"
      }
    }
  }
};

// Feature keys consistent with HelpModal
const _featureKeys = ['flexiblePaths', 'materialParsing', 'vibeEditing', 'easyExport'] as const;

// Showcase data consistent with HelpModal
const showcaseKeys = [
  { image: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644', titleKey: 'softwareDev' },
  { image: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e', titleKey: 'deepseek' },
  { image: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7', titleKey: 'prefabFood' },
  { image: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1', titleKey: 'moneyHistory' },
];

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(landingI18n);
  const [currentShowcase, setCurrentShowcase] = useState(0);

  // Auto-rotate showcase
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentShowcase((prev) => (prev + 1) % showcaseKeys.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      key: 'flexiblePaths',
      icon: <Sparkles size={24} className="text-yellow-600 dark:text-banana" />,
      bg: "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20"
    },
    {
      key: 'materialParsing',
      icon: <FileText size={24} className="text-blue-600 dark:text-blue-400" />,
      bg: "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20"
    },
    {
      key: 'vibeEditing',
      icon: <MessageSquare size={24} className="text-green-600 dark:text-green-400" />,
      bg: "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20"
    },
    {
      key: 'easyExport',
      icon: <Download size={24} className="text-purple-600 dark:text-purple-400" />,
      bg: "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/20"
    }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-background-primary relative overflow-hidden flex flex-col font-sans">
      {/* 动态背景 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-banana-100/40 to-transparent dark:from-banana-900/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 animate-float-slow"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-orange-100/40 to-transparent dark:from-orange-900/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 animate-float-delayed"></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative z-50 w-full px-6 py-6 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-8 h-8 md:w-10 md:h-10 object-contain rounded-lg shadow-sm" />
          <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Banana Slides
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10"
          >
            {i18n.language?.startsWith('zh') ? 'EN' : '中'}
          </button>
          <Button 
            variant="primary" 
            size="sm"
            onClick={() => navigate('/')}
            className="shadow-lg shadow-banana-500/20 hover:shadow-banana-500/30 transition-all"
          >
            {t('landing.nav.enter')}
          </Button>
        </div>
      </nav>

      {/* Hero 区域 */}
      <main className="flex-1 relative z-10 flex flex-col justify-center max-w-7xl mx-auto px-6 py-12 lg:py-20 text-center">
        <div className="space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 text-sm font-medium mx-auto backdrop-blur-sm shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-banana-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-banana-500"></span>
            </span>
            {t('landing.hero.badge')}
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight text-gray-900 dark:text-white leading-[1.1]">
            {t('landing.hero.title_start')}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-banana-500 via-orange-500 to-pink-500 px-2 relative inline-block">
              {t('landing.hero.title_highlight')}
              <svg className="absolute w-full h-3 -bottom-1 left-0 text-banana-200 dark:text-banana-900/30 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
                <path d="M0 5 Q 50 10 100 5" stroke="currentColor" strokeWidth="8" fill="none" />
              </svg>
            </span>
            <br className="hidden md:block" />
            {t('landing.hero.title_end')}
          </h1>

          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-light">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              className="w-full sm:w-auto text-base px-8 py-6 rounded-full shadow-xl shadow-banana-500/20 hover:shadow-banana-500/30 hover:-translate-y-1 transition-all duration-300 font-bold"
              onClick={() => navigate('/')}
              icon={<ChevronRight size={20} />}
            >
              {t('landing.hero.cta_primary')}
            </Button>
            <a
              href="https://github.com/Anionex/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-all duration-200 hover:shadow-md"
            >
              <Github size={20} />
              GitHub
            </a>
          </div>

          {/* 案例展示区域 (Carousel) */}
          <div className="relative mt-20 mx-auto max-w-5xl rounded-2xl overflow-hidden shadow-2xl border border-gray-200/50 dark:border-white/10 bg-white dark:bg-gray-900 animate-float-slow group">
            {/* 顶部标题栏模拟 */}
            <div className="h-8 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 text-center text-xs text-gray-400 dark:text-gray-500 font-mono">
                {t(`help.showcaseTitles.${showcaseKeys[currentShowcase].titleKey}`)}
              </div>
            </div>

            <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
               {showcaseKeys.map((showcase, idx) => (
                <img 
                  key={idx}
                  src={showcase.image}
                  alt={t(`help.showcaseTitles.${showcase.titleKey}`)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
                    idx === currentShowcase ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              
              {/* 左右切换按钮 */}
              <button 
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-800 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg backdrop-blur-sm"
                onClick={() => setCurrentShowcase((prev) => (prev === 0 ? showcaseKeys.length - 1 : prev - 1))}
              >
                <ChevronLeft size={24} />
              </button>
              <button 
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-800 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 shadow-lg backdrop-blur-sm"
                onClick={() => setCurrentShowcase((prev) => (prev + 1) % showcaseKeys.length)}
              >
                <ChevronRight size={24} />
              </button>

              {/* 底部指示器 */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {showcaseKeys.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentShowcase(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentShowcase 
                        ? 'w-6 bg-white shadow-sm' 
                        : 'w-1.5 bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 特性区域 */}
      <div className="relative z-10 bg-white dark:bg-black/20">
        {features.map((feature, idx) => (
          <section 
            key={idx} 
            className={`min-h-[80vh] flex items-center py-24 ${
              idx % 2 === 0 ? 'bg-gray-50/50 dark:bg-white/5' : 'bg-white dark:bg-transparent'
            }`}
          >
            <div className="max-w-7xl mx-auto px-6 w-full">
              <div className={`flex flex-col lg:flex-row items-center gap-12 lg:gap-24 ${
                idx % 2 === 1 ? 'lg:flex-row-reverse' : ''
              }`}>
                {/* 文本区域 */}
                <div className="flex-1 space-y-6">
                  <div className={`inline-flex p-3 rounded-2xl ${feature.bg} shadow-sm`}>
                    {feature.icon}
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                    {t(`help.features.${feature.key}.title`)}
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t(`help.features.${feature.key}.description`)}
                  </p>
                  
                  {/* 详情列表 */}
                  <ul className="space-y-4 pt-4">
                    {(t(`help.features.${feature.key}.details`, { returnObjects: true }) as string[])?.map((detail: string, i: number) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-banana-500 shrink-0" />
                        <span className="text-gray-600 dark:text-gray-400 font-medium">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 视觉区域 */}
                <div className="flex-1 w-full max-w-lg lg:max-w-none">
                  <div className={`aspect-square rounded-3xl overflow-hidden shadow-2xl border border-gray-100 dark:border-white/10 ${feature.bg} bg-opacity-30 dark:bg-opacity-10 backdrop-blur-sm flex items-center justify-center relative group hover:scale-[1.02] transition-transform duration-500`}>
                    {/* 装饰背景 */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent dark:from-white/5 dark:to-transparent" />
                    
                    {/* 中心图标/内容 */}
                    <div className="relative z-10 transform transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3">
                      {React.cloneElement(feature.icon as React.ReactElement, { size: 120, strokeWidth: 1.5 })}
                    </div>

                    {/* 装饰元素 */}
                    <div className="absolute top-1/4 left-1/4 w-24 h-24 bg-current opacity-10 rounded-full blur-2xl animate-pulse" style={{ color: feature.icon.props.className.includes('yellow') ? '#EAB308' : feature.icon.props.className.includes('blue') ? '#3B82F6' : feature.icon.props.className.includes('green') ? '#22C55E' : '#A855F7' }} />
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      <Footer />
    </div>
  );
};
