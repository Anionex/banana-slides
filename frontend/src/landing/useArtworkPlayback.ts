import { useEffect, useRef, useState } from 'react';

/** Decorative motion only runs while its section and browser tab are visible. */
export function useArtworkPlayback() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [foreground, setForeground] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    const updateVisibility = () => setForeground(!document.hidden);
    observer.observe(node);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  return { ref, active: visible && foreground };
}
