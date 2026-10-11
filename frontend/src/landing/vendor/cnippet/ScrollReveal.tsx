"use client";

import {
  motion,
  type Transition,
  type UseInViewOptions,
  useInView,
  useReducedMotion,
  type Variant,
} from "motion/react";
import { type ReactNode, useRef, useState } from "react";

export type ScrollRevealProps = {
  children: ReactNode;
  variants?: {
    hidden: Variant;
    visible: Variant;
  };
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: React.ElementType;
  once?: boolean;
};

const defaultVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export function ScrollReveal({
  children,
  variants = defaultVariants,
  transition,
  viewOptions,
  as = "div",
  once,
}: ScrollRevealProps) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const isInView = useInView(ref, viewOptions);
  const [isViewed, setIsViewed] = useState(false);

  const MotionComponent = motion[
    as as keyof typeof motion
  ] as typeof motion.div;

  if (reduce) {
    const Component = as;
    return <Component>{children}</Component>;
  }

  return (
    <MotionComponent
      animate={isInView || isViewed ? "visible" : "hidden"}
      initial="hidden"
      onAnimationComplete={(definition) => {
        if (once && definition === "visible") setIsViewed(true);
      }}
      ref={ref}
      transition={transition}
      variants={variants}
    >
      {children}
    </MotionComponent>
  );
}
