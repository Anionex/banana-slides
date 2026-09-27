import { ArrowRight, FileImage, FileText, MessageSquare } from 'lucide-react';
import { GrainSteps } from './GrainSteps';

/** Decorative capability diagrams, not interactive product controls. */
export function FeatureArtwork({ kind }: { kind: number }) {
  return <div className={`feature-artwork feature-artwork-${kind}`} aria-hidden="true">
    <div className="feature-artwork-field"><GrainSteps /></div>
    {kind === 0 && <div className="art-document-stack">
      <div className="art-document art-document-back"><FileText size={23} strokeWidth={1.3} /><i /><i /></div>
      <div className="art-document art-document-front"><span className="art-document-title" /><span className="art-document-subtitle" /><div className="art-outline-lines">{[0, 1, 2].map(n => <div key={n}><b /><span><i /><i /></span></div>)}</div></div>
    </div>}
    {kind === 1 && <div className="art-style-deck">{[0, 1, 2].map(n => <div className={`art-slide art-style-${n}`} key={n}><GrainSteps /><div className="art-slide-title"><i /><i /></div></div>)}</div>}
    {kind === 2 && <div className="art-edit-scene"><div className="art-slide art-edit-slide"><GrainSteps /><div className="art-slide-title"><i /><i /></div><div className="art-selection"><i /><i /><i /><i /></div></div><div className="art-comment"><MessageSquare size={18} strokeWidth={1.5} /><span><i /><i /></span></div></div>}
    {kind === 3 && <div className="art-export-scene"><div className="art-slide art-export-slide"><GrainSteps /><div className="art-slide-title"><i /><i /></div></div><ArrowRight className="art-export-arrow" size={26} strokeWidth={1.2} /><div className="art-export-files"><div><FileText size={29} strokeWidth={1.1} /><i /></div><div><FileText size={29} strokeWidth={1.1} /><i /></div></div></div>}
    {kind === 4 && <div className="art-export-scene art-parse-scene"><div className="art-export-files"><div><FileText size={29} strokeWidth={1.1} /><i /></div><div><FileImage size={29} strokeWidth={1.1} /><i /></div></div><ArrowRight className="art-export-arrow" size={26} strokeWidth={1.2} /><div className="art-document art-parsed-document"><span className="art-document-title" /><span className="art-document-subtitle" /><div className="art-outline-lines">{[0, 1, 2].map(n => <div key={n}><b /><span><i /><i /></span></div>)}</div></div></div>}
  </div>;
}
