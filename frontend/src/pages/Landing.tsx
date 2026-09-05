import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ChevronLeft, ChevronRight, Github } from 'lucide-react';
import { Button, Footer } from '@/components/shared';
import { Brand } from '@/components/shared/Brand';
import { StudioHero } from '@/components/home/StudioHero';
import { useT } from '@/hooks/useT';

const messages = {
  zh: {
    enter: '开始创作', showcase: '看看不同的表达', previous: '上一个案例', next: '下一个案例',
    source: '演示案例', page: '查看案例 {{count}}',
    content: '从你已有的内容开始', contentDetail: '写下想法、粘贴大纲，或导入文档与旧 PPT。保留熟悉的内容，尝试新的表达。',
    edit: '看着画面，继续修改', editDetail: '用自然语言描述修改要求，也可以框选局部。生成后仍然可以调整，并查看历史版本。',
    export: '准备好，就去分享', exportDetail: '导出 PPTX、PDF 或图片。按用途选择格式，在导出前检查页面与内容。',
  },
  en: {
    enter: 'Start creating', showcase: 'Explore different expressions', previous: 'Previous example', next: 'Next example',
    source: 'Presentation examples', page: 'View example {{count}}',
    content: 'Start with what you have', contentDetail: 'Write an idea, paste an outline, or import documents and existing decks. Keep your content and explore a new expression.',
    edit: 'See it. Then refine it.', editDetail: 'Describe a change in natural language or select a region. Keep refining after generation and revisit earlier versions.',
    export: 'Ready to share', exportDetail: 'Export PPTX, PDF, or images. Choose a format for your needs and check the pages before exporting.',
  },
};

const showcases = [
  { image: 'https://github.com/user-attachments/assets/d58ce3f7-bcec-451d-a3b9-ca3c16223644', titleKey: 'softwareDev' },
  { image: 'https://github.com/user-attachments/assets/c64cd952-2cdf-4a92-8c34-0322cbf3de4e', titleKey: 'deepseek' },
  { image: 'https://github.com/user-attachments/assets/383eb011-a167-4343-99eb-e1d0568830c7', titleKey: 'prefabFood' },
  { image: 'https://github.com/user-attachments/assets/1a63afc9-ad05-4755-8480-fc4aa64987f1', titleKey: 'moneyHistory' },
];

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(messages);
  const [current, setCurrent] = useState(0);
  return (
    <div className="studio-page min-h-screen flex flex-col">
      <nav className="studio-nav">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}>{i18n.language?.startsWith('zh') ? 'EN' : '中'}</Button>
            <Button size="sm" onClick={() => navigate('/')}>{t('enter')}</Button>
          </div>
        </div>
      </nav>
      <main className="studio-home-main w-full">
        <StudioHero />
        <div className="flex items-center gap-5 mb-12">
          <Button size="lg" onClick={() => navigate('/')} icon={<ArrowRight size={18} />}>{t('enter')}</Button>
          <a className="inline-flex items-center gap-2 text-sm text-foreground-secondary" href="https://github.com/Anionex/banana-slides" target="_blank" rel="noopener noreferrer"><Github size={17} />GitHub</a>
        </div>
        <section id="creation-style" className="studio-showcase" aria-label={t('source')}>
          <div className="studio-section-heading">
            <h2>{t('showcase')}</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" aria-label={t('previous')} icon={<ChevronLeft size={16} />} onClick={() => setCurrent(value => (value + showcases.length - 1) % showcases.length)} />
              <Button size="sm" variant="secondary" aria-label={t('next')} icon={<ChevronRight size={16} />} onClick={() => setCurrent(value => (value + 1) % showcases.length)} />
            </div>
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border-primary bg-background-tertiary">
            {showcases.map((item, index) => <img key={item.titleKey} src={item.image} alt={index === current ? t(`help.showcaseTitles.${item.titleKey}`) : ''} aria-hidden={index !== current} loading="lazy" className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${index === current ? 'opacity-100' : 'opacity-0'}`} />)}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 justify-between items-center">
            <p className="text-sm text-foreground-secondary" aria-live="polite">{t(`help.showcaseTitles.${showcases[current].titleKey}`)}</p>
            <div className="flex gap-1">{showcases.map((item, index) => <button key={item.titleKey} type="button" className="studio-mode" aria-label={t('page', { count: index + 1 })} aria-pressed={index === current} onClick={() => setCurrent(index)}>{String(index + 1).padStart(2, '0')}</button>)}</div>
          </div>
        </section>
        <section className="studio-feature-grid">
          {['content', 'edit', 'export'].map((key, index) => <div key={key}><span className="text-xs text-foreground-tertiary">0{index + 1}</span><h2>{t(key)}</h2><p>{t(`${key}Detail`)}</p></div>)}
        </section>
      </main>
      <Footer />
    </div>
  );
};
