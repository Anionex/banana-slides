/** A quiet, flat geometric motif. Texture is local SVG noise, never a remote image. */
export function GrainSteps({ className = '' }: { className?: string }) {
  return <div className={`grain-steps ${className}`} aria-hidden="true">
    <span /><span /><span /><span />
  </div>;
}
