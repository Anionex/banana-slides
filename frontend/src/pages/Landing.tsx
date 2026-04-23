import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/useAuthStore';

// ── Copy ────────────────────────────────────────────────────
const copy = {
  zh: {
    brand: 'Banana Slides',
    tagline: 'Vibe your slides like vibe coding',
    nav: {
      sections: [
        { id: 'workflow', label: '功能介绍' },
        { id: 'scenarios', label: '使用场景' },
        { id: 'start', label: '马上开始' },
      ],
      demo: 'Demo',
      docs: '文档',
      github: 'GitHub',
      enter: '进入应用',
      lang: 'EN',
    },
    hero: {
      eyebrow: '原生 AI PPT 生成器',
      line1: '让想法',
      accent: '瞬间落地',
      line3: '无需繁琐排版',
      sub: `一款图像生成模型驱动的原生 AI PPT 应用。告别模板味和繁琐的排版美化，用自然语言修改一切，几分钟内获得兼具结构与美感的演示文稿。`,
      cta1: '立即体验',
      cta2: '在 GitHub 上查看',
      chips: ['Outline First', 'AI Images', 'Editable PPTX', 'Export Ready'],
    },
    workflow: {
      eyebrow: 'HOW IT WORKS',
      title: '全新的 PPT 制作体验',
      sub: '不拼接割裂的图文元素。每一页都由 AI 原生渲染，从结构到视觉，一次成型。',
      steps: [
        {
          n: '01',
          title: '三种路径，自由起步',
          subtitle: '适配你的创作习惯，而非相反',
          desc: '支持从一句话想法、结构化大纲或逐页描述三种方式开始创建。无论你是灵感驱动还是结构先行，都能找到合适的起点。',
          hint: 'CREATE',
        },
        {
          n: '02',
          title: '智能素材解析',
          subtitle: '上传文件，自动解析内容',
          desc: '支持 PDF、DOCX、Markdown、TXT 等多格式文件上传与解析，自动识别文本与图片素材，为实际生成提供充分的内容支撑。',
          hint: 'PARSE',
        },
        {
          n: '03',
          title: '自然语言编辑',
          subtitle: '说话编辑，告别菜单迷宫',
          desc: '对大纲、描述或已生成的页面，直接用自然语言下达修改指令。支持框选局部重绘与整页优化，告别菜单层级和按钮寻找。',
          hint: 'VIBE EDIT',
        },
        {
          n: '04',
          title: '原生渲染，视觉统一',
          subtitle: '不是割裂拼凑，而是整体成型',
          desc: '基于原生图像模型渲染，确保图文风格高度统一。拒绝模板同质化，支持通过参考图精准定义视觉走向。',
          hint: 'RENDER',
        },
        {
          n: '05',
          title: '多格式导出，开箱即用',
          subtitle: '从生成到交付，一气呵成',
          desc: '一键导出标准 PPTX 或 PDF 文件。支持可编辑 PPTX 导出，高还原度保留文字样式与布局，直接用于演示或二次编辑。',
          hint: 'EXPORT',
        },
      ],
    },
    scenarios: {
      eyebrow: 'WHO IS IT FOR',
      title: '适合每一位需要演示的人',
      sub: '把时间还给真正有价值的内容。无论你是什么身份，都能在这里让灵感瞬间变成现实。',
      items: [
        { tag: '零基础用户', bg: 'A', title: '告别从零开始的焦虑', text: '零门槛生成具备专业审美的幻灯片。无需辛苦排版和美化，让你的好想法不再被糟糕的排版拖后腿。' },
        { tag: 'PPT 设计师', bg: 'P', title: '打破视觉灵感的瓶颈', text: '将高质量的生成结果作为设计起点。快速获取丰富的图文组合与排版方案，比面对空白页更高效地探索可能性。' },
        { tag: '教育工作者', bg: 'E', title: '繁杂讲义秒变精美课件', text: '轻松将长篇文本转化为结构清晰、图文并茂的教学幻灯片。把宝贵的精力留给备课与讲授本身。' },
        { tag: '学生', bg: 'S', title: '轻松搞定课程汇报', text: '告别熬夜填充PPT的折磨。把时间花在课题研究上，用高颜值的专业汇报在课堂中脱颖而出。' },
        { tag: '职场人士', bg: 'W', title: '极速交付商业级演示', text: '从容应对紧迫的汇报需求，将商业提案快速可视化。成倍缩短从构思到汇报的周期，让每一次展现都充满说服力。' },
      ],
    },
    start: {
      eyebrow: 'START NOW',
      title: '让 PPT 创作，回归直觉',
      sub: '说出心中所想，剩下的交给 Banana Slides。',
      cta1: '进入应用',
      cta2: '在 GitHub 上收藏',
      footerNote: '开源可自托管 | 支持私有化部署',
    },
    footer: {
      note: 'Vibe your slides like Vibe Coding',
      copy: `© ${new Date().getFullYear()} Banana Slides`,
      links: [
        { label: '功能介绍', href: '#workflow' },
        { label: '使用场景', href: '#scenarios' },
        { label: '马上开始', href: '#start' },
      ],
    },
  },
  en: {
    brand: 'Banana Slides',
    tagline: 'Vibe your slides like vibe coding',
    nav: {
      sections: [
        { id: 'workflow', label: 'Features' },
        { id: 'scenarios', label: 'Use Cases' },
        { id: 'start', label: 'Get Started' },
      ],
      demo: 'Demo',
      docs: 'Docs',
      github: 'GitHub',
      enter: 'Open App',
      lang: '中',
    },
    hero: {
      eyebrow: 'AI-Native Presentation Engine',
      line1: 'Describe it.',
      accent: 'AI renders it.',
      line3: 'Beautiful slides in minutes.',
      sub: 'Stop wrestling with templates and layout tools. Banana Slides renders every page as a cohesive visual — powered by image-generation models. Just say what you want, tweak with natural language, and export a polished deck.',
      cta1: 'Open App',
      cta2: 'View on GitHub',
      chips: ['Outline First', 'AI Images', 'Editable PPTX', 'Export Ready'],
    },
    workflow: {
      eyebrow: 'HOW IT WORKS',
      title: 'From idea to deck in five steps',
      sub: 'No stitching clip-art onto templates. Every slide is rendered as a unified visual by AI — structure and style, all at once.',
      steps: [
        {
          n: '01',
          title: 'Start however you think',
          subtitle: 'One-liner, outline, or full brief — your call',
          desc: 'Drop in a single sentence, a structured outline, or detailed page-by-page notes. The workflow adapts to you, not the other way around.',
          hint: 'CREATE',
        },
        {
          n: '02',
          title: 'Drop in your materials',
          subtitle: 'PDFs, docs, markdown — all fair game',
          desc: 'Upload reference files and let the system extract text and images automatically. Your content becomes the foundation, not an afterthought.',
          hint: 'PARSE',
        },
        {
          n: '03',
          title: 'Edit by talking, not clicking',
          subtitle: 'Natural language, zero menu-diving',
          desc: 'Tell it what to change — rewrite a heading, swap a layout, redraw a section. Iterate on intent, not toolbar buttons.',
          hint: 'VIBE EDIT',
        },
        {
          n: '04',
          title: 'AI-rendered, visually consistent',
          subtitle: 'Every page is generated as one cohesive image',
          desc: 'Powered by image-generation models, so text, graphics, and layout share a unified style. Use reference images to steer the look precisely.',
          hint: 'RENDER',
        },
        {
          n: '05',
          title: 'Export and go',
          subtitle: 'PPTX or PDF, one click',
          desc: 'Download an editable PPTX that preserves text, styles, and layout — or a clean PDF. Ready to present or hand off, no post-processing needed.',
          hint: 'EXPORT',
        },
      ],
    },
    scenarios: {
      eyebrow: 'WHO IS IT FOR',
      title: 'For anyone who presents',
      sub: 'Spend your time on what you\'re saying, not how it looks. Banana Slides handles the design so you can focus on the message.',
      items: [
        { tag: 'Beginners', bg: 'A', title: 'No design skills? No problem.', text: 'Get professional-looking slides on your first try. Your ideas deserve better than a bad layout — now they get it automatically.' },
        { tag: 'Designers', bg: 'P', title: 'Skip the blank canvas', text: 'Use AI-generated drafts as a creative springboard. Explore more visual directions in less time than starting from scratch.' },
        { tag: 'Educators', bg: 'E', title: 'Lecture notes to courseware, instantly', text: 'Turn long-form material into structured, visual slides without the manual grind. Save your energy for teaching.' },
        { tag: 'Students', bg: 'S', title: 'Nail the class presentation', text: 'Stop pulling all-nighters over slide formatting. Focus on your research, then show up with a deck that actually impresses.' },
        { tag: 'Professionals', bg: 'W', title: 'Pitch-ready in minutes', text: 'Tight deadline? Visualize your proposal fast and walk into the room with a polished, convincing deck.' },
      ],
    },
    start: {
      eyebrow: 'START NOW',
      title: 'Just describe it. We\'ll design it.',
      sub: 'Tell Banana Slides what you need — the rest is automatic.',
      cta1: 'Open App',
      cta2: 'Star on GitHub',
      footerNote: 'Open-source & self-hostable | Private deployment ready',
    },
    footer: {
      note: 'Vibe your slides like vibe coding',
      copy: `© ${new Date().getFullYear()} Banana Slides`,
      links: [
        { label: 'Features', href: '#workflow' },
        { label: 'Use Cases', href: '#scenarios' },
        { label: 'Get Started', href: '#start' },
      ],
    },
  },
} as const;

// ── Scenario card background icons (viewBox 0 0 24 24) ───────
const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  // person silhouette — beginners
  A: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" /></>,
  // stacked slides — PPT professionals
  P: <><rect x="3" y="5" width="18" height="3" rx="1" /><rect x="3" y="10.5" width="18" height="3" rx="1" /><rect x="3" y="16" width="18" height="3" rx="1" /></>,
  // open book — educators
  E: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>,
  // pencil — students
  S: <><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></>,
  // briefcase — professionals
  W: <><rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
};

const WORKFLOW_CARD_LAYOUTS: Record<string, { card: string }> = {
  '01': {
    card: 'lg:col-span-7 lg:row-span-1',
  },
  '02': {
    card: 'lg:col-span-5 lg:row-span-1',
  },
  '03': {
    card: 'lg:col-span-4 lg:row-span-1',
  },
  '04': {
    card: 'lg:col-span-4 lg:row-span-1',
  },
  '05': {
    card: 'lg:col-span-4 lg:row-span-1',
  },
};

// ── Spotlight hover card ─────────────────────────────────────
const SpotCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, className = '', style }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);
  return (
    <div ref={ref} className={`lp2-card ${className}`} style={style} onMouseMove={onMove}>
      <div className="lp2-card-accent" />
      <div className="lp2-card-spot" />
      <div className="lp2-card-glow" />
      {children}
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────
export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isAuthenticated, isLoading } = useAuthStore();
  const lang = i18n.language?.startsWith('zh') ? 'zh' : 'en';
  const t = copy[lang];
  const [scrolled, setScrolled] = useState(false);
  const primaryEntryPath = isAuthenticated ? '/app' : '/register';

  const handlePrimaryEntry = () => {
    if (isLoading) return;
    navigate(primaryEntryPath);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Unified scroll-triggered animation observer
  useEffect(() => {
    // Individual component reveal (.lp2-anim): fires when element enters viewport
    const ioComponents = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('lp2-playing');
          ioComponents.unobserve(e.target); // play once
        }
      }),
      { threshold: 0.14, rootMargin: '0px 0px -10% 0px' },
    );
    document.querySelectorAll('.lp2-anim').forEach((el) => ioComponents.observe(el));

    // Legacy transition-based reveal (.lp2-reveal)
    const ioReveal = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('lp2-shown')),
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' },
    );
    document.querySelectorAll('.lp2-reveal').forEach((el) => ioReveal.observe(el));

    return () => { ioComponents.disconnect(); ioReveal.disconnect(); };
  }, [lang]);

  return (
    <div className="lp2-page relative min-h-screen overflow-x-hidden">

      {/* ══════════ NAV ══════════ */}
      <header className={`fixed inset-x-0 top-0 z-50 backdrop-blur-xl transition-all duration-300 ${scrolled ? 'border-b border-black/[0.06] bg-white/90' : 'border-b border-transparent bg-transparent'}`}>
        {/* full-width inner, generous padding */}
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 sm:py-3 lg:px-10">

          {/* Left: Logo */}
          <a href="#overview" className="flex min-w-0 shrink items-center gap-2 sm:gap-2.5">
            <img
              src="/logo.png"
              alt="Banana Slides"
              className="h-8 w-8 object-contain sm:h-9 sm:w-9"
            />
            <span className="hidden truncate text-[13px] font-semibold tracking-tight text-slate-900 min-[360px]:inline sm:text-sm">
              {t.brand}
            </span>
          </a>

          {/* Center: section bookmarks */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 text-sm text-slate-500 xl:flex">
            {t.nav.sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-lg px-3.5 py-2 transition-colors hover:bg-black/[0.04] hover:text-slate-900"
              >
                {s.label}
              </a>
            ))}
          </nav>

          {/* Right: external links + CTA */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <a
              href="https://bananaslides.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 md:block"
            >
              {t.nav.demo}
            </a>
            <a
              href="https://docs.bananaslides.online/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 md:block"
            >
              {t.nav.docs}
            </a>
            <a
              href="https://github.com/Anionex/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 md:block"
            >
              {t.nav.github}
            </a>
            <div className="mx-1 hidden h-4 w-px bg-black/10 md:block" />
            <button
              type="button"
              onClick={() => i18n.changeLanguage(lang === 'zh' ? 'en' : 'zh')}
              className="rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-black/[0.04] hover:text-slate-900 sm:px-3 sm:text-sm"
            >
              {t.nav.lang}
            </button>
            <button
              type="button"
              onClick={handlePrimaryEntry}
              disabled={isLoading}
              className="lp2-btn-primary rounded-lg px-3 py-1.5 text-xs font-medium sm:px-4 sm:text-sm"
            >
              <span className="relative z-10 hidden min-[380px]:inline">{t.nav.enter}</span>
              <span className="relative z-10 min-[380px]:hidden">{lang === 'zh' ? '开始' : 'Start'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ══════════ HERO / OVERVIEW ══════════ */}
      <section
        id="overview"
        className="lp2-snap relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-24 text-center lg:px-10"
      >
        {/* Banana yellow orbs */}
        <div
          className="lp2-orb lp2-orb-1 pointer-events-none absolute"
          style={{ width: 600, height: 360, background: 'rgba(255,215,0,0.15)', top: '8%', right: '-6%' }}
        />
        <div
          className="lp2-orb lp2-orb-2 pointer-events-none absolute"
          style={{ width: 440, height: 300, background: 'rgba(255,228,77,0.12)', top: '14%', left: '-8%' }}
        />
        <div
          className="lp2-orb lp2-orb-3 pointer-events-none absolute"
          style={{ width: 320, height: 220, background: 'rgba(255,215,0,0.08)', bottom: '16%', left: '32%' }}
        />


        <div className="relative z-10 max-w-4xl">
          <div className="lp2-anim mb-7 inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-4 py-1.5 font-mono text-xs font-medium tracking-[0.18em] text-slate-500 shadow-sm" style={{ transitionDelay: '0ms' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFD700]" />
            {t.hero.eyebrow}
          </div>

          <h1 className="lp2-anim lp2-hero-title text-[3rem] leading-[1.12] tracking-[-0.04em] text-slate-950 sm:text-[4.2rem] lg:text-[5.4rem]" style={{ transitionDelay: '120ms' }}>
            <span>{t.hero.line1}</span>
            <span className="relative lp2-gradient-text">
              {t.hero.accent}
              {/* Upward arc underline */}
              <svg
                aria-hidden="true"
                className="absolute -bottom-2 left-0 w-full overflow-visible"
                viewBox="0 0 400 22"
                preserveAspectRatio="none"
              >
                <path
                  className="lp2-underline-path"
                  d="M 8 18 Q 200 2 392 18"
                  fill="none"
                  stroke="#FFD700"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="block">{t.hero.line3}</span>
          </h1>

          <p className="lp2-anim mx-auto mt-8 max-w-2xl text-base leading-8 text-slate-500 md:text-lg" style={{ transitionDelay: '240ms', wordBreak: 'keep-all', textWrap: 'pretty' } as React.CSSProperties}>
            {t.hero.sub}
          </p>

          <div className="lp2-anim mt-10 flex flex-wrap justify-center gap-3" style={{ transitionDelay: '360ms' }}>
            <button
              type="button"
              onClick={handlePrimaryEntry}
              disabled={isLoading}
              className="lp2-btn-primary rounded-xl px-8 py-3.5 text-sm font-medium tracking-wide"
            >
              <span className="relative z-10">{t.hero.cta1}</span>
            </button>
            {/* GitHub Star button */}
            <a
              href="https://github.com/Anionex/banana-slides"
              target="_blank"
              rel="noopener noreferrer"
              className="lp2-btn-secondary inline-flex items-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-medium tracking-wide"
            >
              {/* GitHub mark */}
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" className="text-slate-700">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {t.hero.cta2}
            </a>
          </div>
        </div>

        {/* ── Hero Preview: stacked cards ── */}
        <div className="lp2-anim lp2-anim-pop relative mx-auto mt-16 w-full max-w-5xl sm:mt-20 lg:mt-24" style={{ transitionDelay: '480ms' }}>
          {/* Perspective wrapper */}
          <div className="lp2-hero-stack relative" style={{ perspective: '1200px' }}>
            {/* Layer 3 (deepest) — offset most to the left */}
            <div
              className="lp2-hero-stack-card absolute inset-0 origin-center"
              style={{
                transform: 'translate3d(-48px, 8px, -60px) rotateY(2deg)',
                zIndex: 1,
              }}
            >
              <div className="lp2-hero-card-frame">
                <div className="lp2-hero-card-dots" />
                <div className="bg-gradient-to-br from-slate-100 to-slate-200">
                  <img src="/hero-preview-3.webp" alt="" className="w-full" loading="eager" />
                </div>
              </div>
            </div>
            {/* Layer 2 (middle) — offset slightly left */}
            <div
              className="lp2-hero-stack-card absolute inset-0 origin-center"
              style={{
                transform: 'translate3d(-26px, 4px, -30px) rotateY(1.2deg)',
                zIndex: 2,
              }}
            >
              <div className="lp2-hero-card-frame">
                <div className="lp2-hero-card-dots" />
                <div className="bg-gradient-to-br from-slate-100 to-slate-200">
                  <img src="/hero-preview-2.webp" alt="" className="w-full" loading="eager" />
                </div>
              </div>
            </div>
            {/* Layer 1 (front / main) — full visible */}
            <div
              className="lp2-hero-stack-card relative"
              style={{ zIndex: 3 }}
            >
              <div className="lp2-hero-card-frame lp2-hero-card-front">
                <div className="lp2-hero-card-dots" />
                <div className="bg-gradient-to-br from-slate-50 to-slate-100">
                  <img src="/hero-preview-1.webp" alt="Banana Slides preview" className="w-full" loading="eager" />
                </div>
              </div>
            </div>
          </div>
          {/* Soft reflection glow */}
          <div className="pointer-events-none absolute -bottom-12 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-[#FFD700]/8 blur-3xl" />
        </div>

      </section>

      {/* ══════════ WORKFLOW (flowchart) ══════════ */}
      {/* ══════════ MARQUEE ══════════ */}
      <div
        className="overflow-hidden bg-white py-5"
        style={{
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          maskImage: 'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div className="lp2-marquee-track">
          {/* duplicate for seamless loop */}
          {[0, 1].map((k) => (
            <div key={k} className="flex items-center">
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className="flex items-center whitespace-nowrap px-8 font-mono text-sm font-medium tracking-[0.12em] text-slate-400">
                  Banana Slides
                  <span className="ml-8 inline-block h-1 w-1 rounded-full bg-[#FFD700]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* hero → workflow 渐变过渡 */}
      <div className="h-16 bg-gradient-to-b from-white to-[#fafafa]" aria-hidden="true" />
      <section
        id="workflow"
        className="lp2-snap scroll-mt-14 bg-[#fafafa]"
      >
        <div className="px-6 py-24 lg:px-16">
          <div className="lp2-anim mx-auto max-w-4xl text-center" style={{ transitionDelay: '0ms' }}>
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-slate-400">
              {t.workflow.eyebrow}
            </div>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 md:text-4xl">
              {t.workflow.title}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-500">{t.workflow.sub}</p>
          </div>

          <div className="mt-16 lg:mt-20">
            <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
              {t.workflow.steps.map((step, i) => {
                const layout = WORKFLOW_CARD_LAYOUTS[step.n];

                return (
                  <SpotCard
                    key={step.n}
                    className={`lp2-anim lp2-workflow-card relative overflow-hidden rounded-[1.9rem] border border-black/[0.06] bg-white/80 p-4 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur md:p-5 ${layout.card}`}
                    style={{
                      transitionDelay: `${60 + i * 55}ms`,
                      ['--lp2-enter-x' as string]: i % 2 === 0 ? '-8px' : '8px',
                      ['--lp2-enter-y' as string]: '14px',
                      ['--lp2-enter-scale' as string]: '0.992',
                    } as React.CSSProperties}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(250,250,252,0.84)_100%)]" />
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.08),transparent)]" />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-5 top-4 select-none font-mono text-[2rem] font-semibold tracking-[-0.05em] text-black/[0.04] sm:text-[2.4rem] lg:text-[2.8rem]"
                    >
                      {step.hint}
                    </div>

                    <div className="relative z-10 flex h-full min-h-[15rem] flex-col justify-between sm:min-h-[16rem] lg:min-h-[17rem]">
                      <div className="relative z-10 max-w-2xl">
                        <div className="lp2-workflow-meta mb-3 flex items-center gap-3">
                          <div className="font-mono text-[11px] tracking-[0.24em] text-slate-400">
                            {step.n}
                          </div>
                          <div className="h-px w-10 bg-black/[0.08]" />
                        </div>
                        <h3 className="lp2-workflow-title max-w-2xl text-[1.35rem] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[1.55rem] lg:text-[1.75rem]">
                          {step.title}
                        </h3>
                        <p className="lp2-workflow-subtitle mt-2.5 text-sm font-medium text-slate-700 sm:text-[15px]">
                          {step.subtitle}
                        </p>
                        <p className="lp2-workflow-copy mt-3.5 max-w-2xl text-[13px] leading-6 text-slate-500 sm:text-sm">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </SpotCard>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SCENARIOS ══════════ */}
      {/* workflow → scenarios 渐变过渡 */}
      <div className="h-16 bg-gradient-to-b from-[#fafafa] to-white" aria-hidden="true" />
      <section id="scenarios" className="lp2-snap scroll-mt-14 bg-white">
        <div className="px-6 py-24 lg:px-16">
          <div className="lp2-anim mb-14 text-center" style={{ transitionDelay: '0ms' }}>
            <div className="mb-3 font-mono text-xs tracking-[0.28em] text-slate-400">
              {t.scenarios.eyebrow}
            </div>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 md:text-4xl">
              {t.scenarios.title}
            </h2>
            <p
              className="mx-auto mt-4 max-w-xl text-slate-500"
              style={{ textWrap: 'pretty' }}
            >
              {t.scenarios.sub}
            </p>
          </div>

          {/* 5-card grid: 2+2+1 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {t.scenarios.items.map((item, i) => (
              <SpotCard
                key={item.tag}
                className={`lp2-anim lp2-anim-pop p-7 ${i === 4 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                style={{ transitionDelay: `${140 + i * 120}ms, ${140 + i * 120}ms, ${140 + i * 120}ms, 0ms` }}
              >
                {/* Faded SVG icon in background */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute bottom-4 right-4 h-20 w-20 text-black/[0.055]"
                >
                  {SCENARIO_ICONS[item.bg]}
                </svg>
                <div className="relative z-10">
                  <div className="mb-4 font-mono text-xs tracking-[0.22em] text-[#c9a800]">
                    {item.tag}
                  </div>
                  <h3 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-6 text-slate-500">{item.text}</p>
                </div>
              </SpotCard>
            ))}
          </div>
        </div>
      </section>

      {/* scenarios → start 渐变过渡 */}
      <div className="h-16 bg-gradient-to-b from-white to-[#fafafa]" aria-hidden="true" />

      {/* ══════════ START / CTA ══════════ */}
      <section
        id="start"
        className="lp2-snap scroll-mt-14"
        style={{
          background: '#fafafa',
        }}
      >
        <div className="relative overflow-hidden px-6 py-32 text-center lg:px-16">
          {/* Background decoration */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 select-none font-mono text-[14rem] font-bold leading-none text-amber-400/[0.06] lg:text-[20rem]"
          >
            GO
          </div>

          <div className="lp2-anim relative z-10 mx-auto max-w-2xl" style={{ transitionDelay: '0ms' }}>
            <div className="mb-4 font-mono text-xs tracking-[0.28em] text-slate-400">
              {t.start.eyebrow}
            </div>
            <h2 className="text-3xl font-bold tracking-[-0.04em] text-slate-950 md:text-4xl lg:text-5xl" style={{ wordBreak: 'keep-all' }}>
              {t.start.title}
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-slate-500 md:text-lg">
              {t.start.sub}
            </p>
            <div className="mt-12 flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryEntry}
                disabled={isLoading}
                className="lp2-btn-primary rounded-xl px-9 py-4 text-sm font-medium tracking-wide"
              >
                <span className="relative z-10">{t.start.cta1}</span>
              </button>
              <a
                href="https://github.com/Anionex/banana-slides"
                target="_blank"
                rel="noopener noreferrer"
                className="lp2-btn-secondary inline-flex items-center gap-2.5 rounded-xl px-8 py-4 text-sm font-medium tracking-wide"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true" className="text-slate-700">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                {t.start.cta2}
              </a>
            </div>
            <div className="mt-6 text-sm text-slate-400">
              {t.start.footerNote}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t border-black/[0.06] bg-white">
        <div className="px-6 pb-10 pt-16 lg:px-16">
          {/* Top: brand block */}
          <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <a href="#overview" className="inline-flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="Banana Slides"
                  className="h-16 w-16 object-contain"
                />
                  <div>
                    <div className="text-2xl font-bold tracking-[-0.04em] text-slate-950">
                      {t.brand}
                    </div>
                    <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.28em] text-slate-400">
                      {t.footer.note}
                    </div>
                  </div>
                </a>
              </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-400">
              {t.footer.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-slate-700"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://github.com/Anionex/banana-slides"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-700"
              >
                GitHub
              </a>
              <a
                href="https://docs.bananaslides.online/"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-slate-700"
              >
                {t.nav.docs}
              </a>
            </div>
          </div>

          {/* Bottom: copyright */}
          <div className="border-t border-black/[0.05] pt-6 text-sm text-slate-300">
            {t.footer.copy}
          </div>
        </div>
      </footer>
    </div>
  );
};
