import { createPortal } from 'react-dom';
import { useEffect, useState, type ReactNode } from 'react';

const isDesktop = typeof window !== 'undefined' && 'electronAPI' in window;

export function TitleBarPortal({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isDesktop) return;
    const el = document.getElementById('desktop-titlebar-actions');
    if (el) setContainer(el);
  }, []);

  if (!isDesktop || !container) return null;
  return createPortal(children, container);
}
