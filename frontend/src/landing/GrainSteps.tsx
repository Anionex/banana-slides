/** Rounded rectangle motif; color and local noise texture are styled in landing.css. */
export function GrainSteps({ className = '' }: { className?: string }) {
  return <div className={`grain-steps ${className}`} aria-hidden="true">
    <span /><span /><span /><span />
  </div>;
}
