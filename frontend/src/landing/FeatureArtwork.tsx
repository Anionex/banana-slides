import { ArrowRight, FileImage, FileText, FileVideo, Files, Lightbulb, ListTree, MessageSquare, Presentation } from 'lucide-react';
import { GrainSteps } from './GrainSteps';

/** Decorative capability diagrams, not interactive product controls. */
export function FeatureArtwork({ kind }: { kind: number }) {
  return <div className={`feature-artwork feature-artwork-${kind}`} aria-hidden="true">
    <div className="feature-artwork-field"><GrainSteps /></div>
    {kind === 0 && <div className="art-document-stack art-input-scene">
      <div className="art-input-options">{[Lightbulb, ListTree, FileText, Files].map((Icon, index) => <div key={index}><Icon size={27} strokeWidth={1.3} /></div>)}</div>
      <svg className="art-input-connectors" viewBox="0 0 100 200" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M25 100H75 M65 93L75 100L65 107" />
      </svg>
      <div className="art-input-result"><div className="art-slide"><GrainSteps /><div className="art-slide-title"><i /><i /></div></div></div>
    </div>}
    {kind === 1 && <div className="art-style-deck">{[0, 1, 2].map(n => <div className={`art-slide art-style-${n}`} key={n}><GrainSteps /><div className="art-slide-title"><i /><i /></div></div>)}</div>}
    {kind === 2 && <div className="art-edit-scene"><div className="art-slide art-edit-slide"><GrainSteps /><div className="art-slide-title"><i /><i /></div><div className="art-selection"><i /><i /><i /><i /></div></div><div className="art-comment"><MessageSquare size={18} strokeWidth={1.5} /><span><i /><i /></span></div></div>}
    {kind === 3 && <div className="art-export-scene art-format-scene"><div className="art-slide art-export-slide"><GrainSteps /><div className="art-slide-title"><i /><i /></div></div><ArrowRight className="art-export-arrow" size={26} strokeWidth={1.2} /><div className="art-export-files"><div><Presentation size={29} strokeWidth={1.3} /></div><div><FileText size={29} strokeWidth={1.3} /></div><div><FileVideo size={29} strokeWidth={1.3} /></div></div></div>}
    {kind === 4 && <div className="art-export-scene art-parse-scene"><div className="art-export-files"><div><FileText size={29} strokeWidth={1.1} /><i /></div><div><FileImage size={29} strokeWidth={1.1} /><i /></div></div><ArrowRight className="art-export-arrow" size={26} strokeWidth={1.2} /><div className="art-document art-parsed-document"><span className="art-document-title" /><span className="art-document-subtitle" /><div className="art-outline-lines">{[0, 1, 2].map(n => <div key={n}><b /><span><i /><i /></span></div>)}</div></div></div>}
  </div>;
}
