import { ArrowUpRight, Github } from 'lucide-react';
import logoUrl from '@/assets/landing/logo.webp';
import { LanguageMenu } from './LanguageMenu';
import { ThemeToggle } from './LandingTheme';
import ScrollHeader from './vendor/waymark/ScrollHeader';
import './landing.css';
import './desktop-layout.css';
import './mobile-layout.css';
import './landing-header.css';

export function LandingHeader({ language, currentPage = 'home' }: { language: 'zh' | 'en'; currentPage?: 'home' | 'gallery' }) {
  const zh = language === 'zh';
  const home = zh ? '/' : '/en/';
  const section = (id: string) => `${currentPage === 'home' ? '' : home}#${id}`;

  return <ScrollHeader label={zh ? '主导航' : 'Main navigation'} sticky={currentPage === 'home'}
    brand={<a href={home} className="brand" aria-label={zh ? 'Banana Slides 首页' : 'Banana Slides home'}><img src={logoUrl} alt="" width="32" height="32" /><span>Banana Slides</span></a>}
    navigation={<>
      <a href={section('product')}>{zh ? '产品能力' : 'Product'}</a>
      <a href={`${home}gallery/`} aria-current={currentPage === 'gallery' ? 'page' : undefined}>{zh ? '作品画廊' : 'Gallery'}</a>
      <a href={section('scenarios')}>{zh ? '使用场景' : 'Use cases'}</a>
      <a href={section('faq')}>{zh ? '常见问题' : 'FAQ'}</a>
      <a href={section('landing-cta')}>{zh ? '在线版内测' : 'Hosted beta'}</a>
      <a href="https://docs.bananaslides.online" target="_blank" rel="noopener noreferrer">{zh ? '文档' : 'Docs'}</a>
    </>}
    actions={<>
      <a className="landing-github-icon" href="https://github.com/Anionex/banana-slides" target="_blank" rel="noopener noreferrer" aria-label="GitHub"><Github size={19} aria-hidden="true" /></a>
      <LanguageMenu /><ThemeToggle />
      <a className="studio-button studio-button-dark" href="/app">{zh ? '体验 Demo' : 'Try the demo'}<ArrowUpRight size={15} /></a>
    </>}
  />;
}
