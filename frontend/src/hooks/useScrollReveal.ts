import { useEffect, useRef, useState } from 'react';

interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  once?: boolean;
}

/**
 * Hook for scroll-based reveal animations
 * Returns a ref to attach to the element and a boolean indicating if it's visible
 */
export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  options: ScrollRevealOptions = {}
): [React.RefObject<T>, boolean] {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options;
  const ref = useRef<T>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(element);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref as React.RefObject<T>, isVisible];
}

/**
 * Hook for multiple elements with staggered animations
 */
export function useScrollRevealMultiple(
  count: number,
  options: ScrollRevealOptions = {}
): [(index: number) => (el: HTMLElement | null) => void, boolean[]] {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options;
  const refs = useRef<(HTMLElement | null)[]>(new Array(count).fill(null));
  const [visibleStates, setVisibleStates] = useState<boolean[]>(new Array(count).fill(false));

  const setRef = (index: number) => (el: HTMLElement | null) => {
    refs.current[index] = el;
  };

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    refs.current.forEach((element, index) => {
      if (!element) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleStates(prev => {
              const newStates = [...prev];
              newStates[index] = true;
              return newStates;
            });
            if (once) {
              observer.unobserve(element);
            }
          } else if (!once) {
            setVisibleStates(prev => {
              const newStates = [...prev];
              newStates[index] = false;
              return newStates;
            });
          }
        },
        { threshold, rootMargin }
      );

      observer.observe(element);
      observers.push(observer);
    });

    return () => observers.forEach(obs => obs.disconnect());
  }, [count, threshold, rootMargin, once]);

  return [setRef, visibleStates];
}
