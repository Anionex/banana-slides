import { FeatureArtwork } from './FeatureArtwork';
import { ScenarioArtwork } from './ScenarioArtwork';
import { Feature01 } from './vendor/flexnative/Feature01';
import './template-sections.css';
import Reveal from './vendor/asanshay/Reveal';
import { ScrollReveal } from './vendor/cnippet/ScrollReveal';

type SectionProps = { t: (key: string) => string };
const featureArt = [1, 0, 4, 2, 3];

// Waymark's workflow layout with existing Banana Slides copy and illustrations.
export function ProductShowcase({ t }: SectionProps) {
  return <section id="product" className="landing-section landing-waymark landing-waymark-workflow" aria-labelledby="landing-product-title">
    <div className="landing-waymark-container">
      <Reveal><header className="landing-waymark-heading">
        <h2 id="landing-product-title">{t('featureTitle')}</h2>
        <p className="landing-waymark-intro">{t('featureIntro')}</p>
      </header></Reveal>
      <div className="landing-waymark-workflow-grid">
        {featureArt.map((kind, index) => <ScrollReveal key={kind} as="article" once
          transition={{ delay: index * 0.12, duration: 0.5, ease: 'easeOut' }}
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } }}
          viewOptions={{ amount: 0.3 }}>
          <div className="landing-waymark-workflow-visual"><FeatureArtwork kind={kind} /></div>
          <div className="landing-waymark-caption">
            <h3>{t(`f${index + 1}`)}</h3>
            <p>{t(`f${index + 1}Text`)}</p>
          </div>
        </ScrollReveal>)}
      </div>
    </div>
  </section>;
}

export function AudienceShowcase({ t }: SectionProps) {
  return <section id="scenarios" className="landing-section landing-waymark landing-waymark-features" aria-labelledby="landing-audience-title">
    <div className="landing-waymark-container">
      <Reveal><header className="landing-waymark-heading">
        <h2 id="landing-audience-title">{t('scenarioTitle')}</h2>
        <p className="landing-waymark-intro">{t('scenarioIntro')}</p>
      </header></Reveal>
      <div className="landing-audience-selector">
        <Feature01 animation="subtle" label={t('scenarios')} items={[1, 2, 3, 4, 5].map(scenario => ({
          id: `audience-${scenario}`,
          title: t(`s${scenario}`),
          description: `${t(`s${scenario}Title`)}\n${t(`s${scenario}Text`)}`,
          media: { src: '', alt: '' },
          mediaContent: <ScenarioArtwork scenario={scenario} />,
        }))} />
      </div>
    </div>
  </section>;
}
