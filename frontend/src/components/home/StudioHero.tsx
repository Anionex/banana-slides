import { ArrowDownRight } from 'lucide-react';
import { useT } from '@/hooks/useT';
import { isDesktop } from '@/utils';

const messages = {
  zh: { eyebrow: '给想法一个新开场', first: '你的想法，', second: '不必套版。', description: '从一句想法、一份文档或旧 PPT 开始。创作，再调整成你想要的样子。', browse: '找找风格灵感', reference: '风格参考', illustration: '矢量插画', glass: '拟物玻璃' },
  en: { eyebrow: 'A fresh start for your ideas', first: 'Your ideas.', second: 'Beyond templates.', description: 'Start with an idea, a document, or an old deck. Create, then make it your own.', browse: 'Explore styles', reference: 'Style references', illustration: 'Vector illustration', glass: 'Glass effect' },
};

export function StudioHero() {
  const t = useT(messages);
  const asset = (name: string) => `${isDesktop ? '.' : ''}/templates/${name}`;
  return (
    <section className="studio-hero">
      <div className="studio-hero-copy studio-enter">
        <p className="studio-eyebrow"><span />{t('eyebrow')}</p>
        <h1>{t('first')}<br /><span>{t('second')}</span></h1>
        <p className="studio-hero-description">{t('description')}</p>
        <button type="button" className="studio-text-link" onClick={() => document.getElementById('creation-style')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>{t('browse')}<ArrowDownRight size={17} /></button>
      </div>
      <figure className="studio-hero-art studio-enter" aria-label={t('reference')}>
        <div className="studio-sample studio-sample-back"><img src={asset('template_glass-thumb.webp')} alt={t('glass')} width={600} height={335} /></div>
        <div className="studio-sample studio-sample-front"><img src={asset('template_vector_illustration-thumb.webp')} alt={t('illustration')} width={600} height={334} /></div>
        <figcaption>{t('reference')}</figcaption>
      </figure>
    </section>
  );
}
