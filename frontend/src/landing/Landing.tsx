import { ArrowRight, ArrowUpRight, FileText, Layers, Download, Github, ChevronDown, Sparkles } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '@/hooks/useT';
import './landing.css';
import { GrainSteps } from './GrainSteps';
import { GalleryCurvedShowcase } from './gallery/GalleryCurvedShowcase';
import { BetaRibbon } from './BetaRibbon';
import { GithubStars } from './GithubStars';
import { LandingHeader } from './LandingHeader';
import { ProductShowcase, AudienceShowcase } from './TemplateSections';
import { Footer } from './Footer';
import { FeedbackWidget } from '@/components/shared/FeedbackWidget';
import CallToAction from './vendor/tailark/CallToAction';
import './landing-cta.css';
import './desktop-layout.css';
import './mobile-layout.css';
import Reveal from './vendor/asanshay/Reveal';
import './landing-header.css';
import './landing-typography.css';
import { LandingTheme } from './LandingTheme';
import { FeedbackDialog } from './FeedbackDialog';
import { useLandingMetadata } from './metadata';
import './landing-theme.css';
import { navigateSection } from './sectionNavigation';

const copy = {
  zh: {
    pauseAnimation: '暂停动画', playAnimation: '播放动画',
    product: '产品能力', scenarios: '使用场景', faq: '常见问题', docs: '文档', enter: '体验 Demo', waitlistNav: '在线版内测',
    faqIntro: '关于创作、素材与导出',
    ctaTitle: '让 PPT 创作，回归直觉', ctaAlternative: '或留下邮箱, 优先获得在线托管版内测邀请。',
    title: '让想法落地，', title2: '无需繁琐排版',
    intro: '图像生成模型驱动的原生 AI PPT 应用。用自然语言描述想法、调整页面，从内容到视觉，生成完整的演示文稿。', start: '体验 Demo', waitlistOpen: '预约在线版内测', waitlistPlaceholder: '你的邮箱地址', waitlistSubmit: '预约内测', waitlistSubmitting: '提交中…', waitlistSuccess: '已收到预约，内测开放时我们会通过邮件联系你。', waitlistError: '提交失败，请稍后重试。', waitlistInvalid: '请输入有效的邮箱地址。', waitlistRateLimited: '提交较频繁，请稍后再试。',
    strip1: '一句话生成', strip2: '资料智能解析', strip3: '自然语言修改', strip4: '多格式导出',
    featureTitle: '全新的 PPT 制作体验',
    featureIntro: '每一页都由 AI 原生渲染，让内容结构与视觉设计一起成型。',
    f1: '原生渲染，视觉统一', f1Text: '基于图像生成模型，将文字、图形与布局作为整页画面生成。通过参考图或风格描述引导视觉方向，让整份演示保持一致。',
    f2: '多种路径，自由起步', f2Text: '从一句话想法、结构化大纲或逐页描述开始创建。已有演示文稿？通过 PPT 翻新导入 PPTX 或 PDF，重新设计页面。',
    f3: '智能素材解析', f3Text: '上传 PDF、DOCX、Markdown 或 TXT 文件，自动解析文本与图片素材。让已有资料成为生成内容的依据，减少重复整理。',
    f4: '自然语言编辑', f4Text: '对大纲、描述或已生成的页面，直接用自然语言提出修改。支持整页调整与框选局部重绘，把精力放在内容和效果上。',
    f5: '多格式导出', f5Text: '导出 PPTX、PDF 或视频，用于演示和分享。需要继续编辑时，可使用可编辑 PPTX。',
    scenarioTitle: '适合每一位需要演示的人',
    scenarioIntro: '从课堂讲解到工作汇报，找到适合你的创作方式',
    s1: '零基础用户', s1Title: '告别从零开始的焦虑', s1Text: '无需从空白页开始摸索排版。描述你的想法，让 AI 生成内容与画面，再按自己的需要调整。',
    s2: 'PPT 设计师', s2Title: '打破视觉灵感的瓶颈', s2Text: '将生成结果作为设计起点。快速探索不同的图文组合与排版方案，把更多时间留给创意和细节。',
    s3: '教育工作者', s3Title: '从讲义到教学课件', s3Text: '将长篇资料转化为结构清晰、图文并茂的教学幻灯片。调整章节和页面内容，把精力留给备课与讲授。',
    s4: '学生', s4Title: '轻松准备课程汇报', s4Text: '从课题资料和汇报大纲出发，生成演示初稿。减少反复排版，把时间花在研究内容和表达上。',
    s5: '职场人士', s5Title: '让商业提案更快成型', s5Text: '将方案、大纲和参考材料转化为可预览的演示文稿。按反馈修改页面，为下一场汇报做好准备。',
    q1: '我需要会设计或排版吗？', a1: '不需要。你可以从一句话开始，让 AI 生成内容与页面；也可以提供更详细的大纲、描述和模板，掌握更多创作细节。',
    q2: '可以使用我自己的资料和模板吗？', a2: '可以。在创作页面上传参考资料、选择模板，或用文字描述视觉风格。已有的 PPTX/PDF 也可以通过 PPT 翻新流程重新制作。',
    q3: '导出的 PPTX 可以编辑吗？', a3: '普通 PPTX 导出以整页图片呈现。可编辑 PPTX（Beta）会提取文字和页面元素，便于继续修改；复杂版式的还原可能存在偏差，请在交付前检查。',
    q4: '开始使用前需要配置什么？', a4: '在个人设置中选择 API 提供商并填写自己的 API Key，保存后即可返回创作。模型调用可能产生所选服务商的费用。',
  },
  en: {
    pauseAnimation: 'Pause animation', playAnimation: 'Play animation',
    product: 'Product', scenarios: 'Use cases', faq: 'FAQ', docs: 'Docs', enter: 'Try the demo', waitlistNav: 'Hosted beta',
    faqIntro: 'Answers to common questions about creating, using your materials, and exporting.',
    ctaTitle: 'Make creating presentations feel intuitive.', ctaAlternative: 'Or leave your email for an early invitation to the hosted beta.',
    title: 'Describe it', title2: 'AI renders it',
    intro: 'An AI-native presentation app powered by image-generation models. Describe your ideas, refine slides with natural language, and generate a complete deck with content and visuals together.', start: 'Try the demo', waitlistOpen: 'Join the hosted beta', waitlistPlaceholder: 'Your email address', waitlistSubmit: 'Join the waitlist', waitlistSubmitting: 'Submitting…', waitlistSuccess: 'You are on the list. We will email you when the beta opens.', waitlistError: 'Could not submit. Please try again.', waitlistInvalid: 'Enter a valid email address.', waitlistRateLimited: 'Too many submissions. Please try again later.',
    strip1: 'Create from a prompt', strip2: 'AI-powered file parsing', strip3: 'Edit in natural language', strip4: 'Multi-format export',
    featureTitle: 'A new way to create presentations',
    featureIntro: 'Every slide is rendered as a unified visual by AI — structure and style, together.',
    f1: 'AI-rendered, visually consistent', f1Text: 'Image-generation models render text, graphics, and layout as a complete slide. Use reference images or a style description to guide the look across your deck.',
    f2: 'Start however you think', f2Text: 'Start with a single sentence, a structured outline, or detailed page-by-page notes. Already have a deck? Import a PPTX or PDF through the renovation flow to redesign it.',
    f3: 'Drop in your materials', f3Text: 'Upload PDF, DOCX, Markdown, or TXT files and extract text and images automatically. Your existing materials become the foundation for generated content.',
    f4: 'Edit with natural language', f4Text: 'Describe changes to your outline, page descriptions, or generated slides. Refine a whole page or select a region to redraw, keeping your focus on the result.',
    f5: 'Export for your next presentation', f5Text: 'Export PPTX, PDF, or video to present and share. For further editing, use editable PPTX.',
    scenarioTitle: 'For everyone with something to present',
    scenarioIntro: 'For lessons, reports, and pitches, find a workflow that fits.',
    s1: 'Beginners', s1Title: 'Start without a blank canvas', s1Text: 'Describe your ideas and let AI create the content and visuals. Refine the result as you go, without building every layout from scratch.',
    s2: 'Designers', s2Title: 'Explore more visual directions', s2Text: 'Use AI-generated drafts as a creative starting point. Try different compositions and layouts, leaving more time for ideas and finishing details.',
    s3: 'Educators', s3Title: 'Turn lecture notes into courseware', s3Text: 'Transform long-form material into structured, visual slides. Refine the sections and page content, and save your energy for teaching.',
    s4: 'Students', s4Title: 'Get ready for your class presentation', s4Text: 'Build a first draft from your research and outline. Spend less time on slide formatting and more on the substance of your work.',
    s5: 'Professionals', s5Title: 'Bring your proposal into focus', s5Text: 'Turn plans, outlines, and reference materials into a deck you can preview. Revise slides with feedback and prepare for your next presentation.',
    q1: 'Do I need design experience?', a1: 'No. Start with a simple idea and let AI help with content and slide creation. Add a detailed outline, descriptions, or a template whenever you want more control.',
    q2: 'Can I bring my own files and templates?', a2: 'Yes. Add reference documents, choose a template, or describe a visual style in the workspace. You can also rework existing PPTX/PDF files with the renovation flow.',
    q3: 'Can I edit the exported PPTX?', a3: 'Standard PPTX exports contain full-slide images. Editable PPTX (Beta) extracts text and page elements for further editing. Complex layouts may not reproduce exactly, so review the export before delivery.',
    q4: 'What do I need to get started?', a4: 'Choose an API provider and enter your own API key in personal settings, then save and return to the workspace. Model calls may incur fees from your chosen provider.',
  },
};

const githubUrl = 'https://github.com/Anionex/banana-slides';

export function Landing() { return <LandingTheme><LandingContent /></LandingTheme>; }

function LandingContent() {
  const language = useLandingMetadata();
  const t = useT(copy);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const footer = document.getElementById('landing-ribbon');
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const [email, setEmail] = useState('');
  const [waitlistState, setWaitlistState] = useState<'idle' | 'submitting' | 'success' | 'error' | 'invalid' | 'rate-limited'>('idle');
  const submitWaitlist = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (waitlistState === 'submitting') return;
    setWaitlistState('submitting');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 400) {
        setWaitlistState('invalid');
        return;
      }
      if (response.status === 429) {
        setWaitlistState('rate-limited');
        return;
      }
      if (!response.ok) throw new Error('waitlist submission failed');
      setEmail('');
      setWaitlistState('success');
    } catch {
      setWaitlistState('error');
    }
  };
  const waitlistFeedback = waitlistState === 'success' ? t('waitlistSuccess') : waitlistState === 'error' ? t('waitlistError') : waitlistState === 'invalid' ? t('waitlistInvalid') : waitlistState === 'rate-limited' ? t('waitlistRateLimited') : '';
  return <div className="landing-page" onClick={navigateSection}>
    <a className="landing-skip" href="#landing-main">{language === 'zh' ? '跳到主要内容' : 'Skip to content'}</a>
    <div className="landing-feedback" data-hidden={footerVisible}><FeedbackWidget DialogComponent={FeedbackDialog} /></div>
    <LandingHeader language={language} />
    <main id="landing-main" tabIndex={-1}>
      <section className="landing-hero">
        <Reveal className="landing-hero-copy"><h1>{t('title')}<br />{t('title2')}</h1><p className="landing-intro">{t('intro')}</p>
          <div className="landing-hero-actions"><a href="/app" className="studio-button studio-button-dark">{t('start')}<ArrowRight size={17} /></a><a className="studio-button landing-github-button" href={githubUrl} target="_blank" rel="noopener noreferrer"><Github size={18} aria-hidden="true" />GitHub<GithubStars /></a><a className="studio-button landing-beta-button" href="#landing-cta"><BetaRibbon /><span>{t('waitlistOpen')}</span><ArrowUpRight size={16} /></a></div>
          <a className="landing-gallery-link" href={language === 'zh' ? '/gallery/' : '/en/gallery/'}>{language === 'zh' ? '先逛逛作品画廊' : 'Explore the gallery'}<ArrowRight size={16} /></a>
        </Reveal>
        <Reveal className="landing-hero-art" index={1}><GrainSteps bitmapGrain interactive /><span className="landing-art-label">IDEA<br />OUTLINE<br />DESIGN<br />PRESENT<span /></span></Reveal>
        <Reveal className="landing-strip" index={6}><div>{[FileText, Layers, Sparkles, Download].map((Icon, i) => <span key={i}><Icon size={20} />{t(`strip${i + 1}`)}</span>)}</div></Reveal>
      </section>
      <ProductShowcase t={t} />
      <GalleryCurvedShowcase language={language} />
      <AudienceShowcase t={t} />
      <section id="faq" className="landing-faq landing-section landing-container">
        <Reveal className="landing-section-heading landing-faq-heading"><h2>{t('faq')}</h2><p>{t('faqIntro')}</p></Reveal>
        <Reveal className="landing-faq-panel">
          {[0, 1, 2, 3].map(i => <article key={i}>
            <h3><button type="button" aria-expanded={expanded === i} aria-controls={`faq-answer-${i}`} onClick={() => setExpanded(expanded === i ? null : i)}>{t(`q${i + 1}`)}<ChevronDown size={16} aria-hidden="true" /></button></h3>
            <div id={`faq-answer-${i}`} className="landing-faq-answer" data-expanded={expanded === i} aria-hidden={expanded !== i}>
              <div><p>{t(`a${i + 1}`)}</p></div>
            </div>
          </article>)}
        </Reveal>
      </section>
      <Reveal><CallToAction
        id="landing-cta"
        className="landing-cta"
        title={t('ctaTitle')}
        beforeForm={<>
          <a href="/app" className="studio-button studio-button-dark landing-cta-primary">{t('start')}<ArrowRight size={18} aria-hidden="true" /></a>
          <p id="landing-cta-alternative" className="landing-cta-alternative">{t('ctaAlternative')}</p>
        </>}
        submitLabel={t(waitlistState === 'submitting' ? 'waitlistSubmitting' : 'waitlistSubmit')}
        submitting={waitlistState === 'submitting'}
        onSubmit={event => { void submitWaitlist(event); }}
        inputProps={{
          id: 'landing-cta-email', 'aria-label': t('waitlistPlaceholder'),
          'aria-describedby': 'landing-cta-alternative landing-cta-status',
          'aria-invalid': waitlistState === 'invalid',
          autoComplete: 'email', required: true, maxLength: 254,
          placeholder: t('waitlistPlaceholder'), value: email,
          onChange: event => { setEmail(event.target.value); setWaitlistState('idle'); },
          disabled: waitlistState === 'submitting',
        }}
        footer={<>
          <p id="landing-cta-status" className="landing-cta-status" data-state={waitlistState} role="status" aria-live="polite">{waitlistFeedback}</p>
        </>}
      /></Reveal>
    </main>
    <Footer />
  </div>;
}
