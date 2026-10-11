// Adapted from Flexnative (AGPL-3.0); see NOTICE.md for source and changes.
'use client'

import * as React from 'react'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import Balancer from 'react-wrap-balancer'

import type { CtaProps } from './Cta'
import { Cta } from './Cta'
import { cn } from './utils'

export interface Content06Props {
  title: string
  description: string
  media: {
    src: string
    alt: string
  }
  mediaContent?: React.ReactNode
  cta?: CtaProps
  variant?: 'standard' | 'compact'
  animation?: 'none' | 'subtle'
}

const variantStyles = {
  standard: {
    container: 'py-12 sm:py-16',
    grid: 'grid-cols-1 gap-10 md:grid-cols-2 md:items-center md:gap-14',
    copy: 'gap-8',
    header: 'gap-3',
    title: 'text-2xl sm:text-3xl',
    description: 'max-w-sm text-sm sm:text-base',
    media: 'min-h-80 md:min-h-[420px]',
    mediaRadius: 'rounded-lg',
  },
  compact: {
    container: 'py-10 sm:py-12',
    grid: 'grid-cols-1 gap-8 md:grid-cols-2 md:items-center md:gap-10',
    copy: 'gap-6',
    header: 'gap-2',
    title: 'text-xl sm:text-2xl',
    description: 'max-w-sm text-sm',
    media: 'min-h-64 md:min-h-80',
    mediaRadius: 'rounded-md',
  },
} as const

const container: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

const mediaEnter: Variants = {
  hidden: { opacity: 0, scale: 0.96, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.08 },
  },
}

const viewport = {
  once: true,
  margin: '-80px' as const,
}

function Reveal({
  active,
  variants,
  className,
  children,
}: Readonly<{
  active: boolean
  variants?: Variants
  className?: string
  children: React.ReactNode
}>) {
  if (!active) return <div className={className}>{children}</div>

  return (
    <motion.div variants={variants ?? item} className={className}>
      {children}
    </motion.div>
  )
}

export function Content06({
  title,
  description,
  media,
  mediaContent,
  cta,
  variant = 'standard',
  animation = 'none',
}: Readonly<Content06Props>) {
  const reduce = useReducedMotion()
  const animate = animation === 'subtle' && !reduce
  const vs = variantStyles[variant]

  const titleElement = title && (
    <h3
      className={cn(
        'text-foreground font-serif font-normal tracking-tight text-balance',
        vs.title,
      )}
    >
      <Balancer>{title}</Balancer>
    </h3>
  )

  const descriptionElement = description && (
    <p
      className={cn(
        'text-muted-foreground whitespace-pre-line',
        vs.description,
      )}
    >
      <Balancer>{description}</Balancer>
    </p>
  )

  const ctaElement = cta?.ctaEnabled && <Cta cta={cta} />

  const copyElement = (
    <div
      className={cn(
        'order-1 flex w-full min-w-0 flex-col self-center',
        vs.copy,
      )}
    >
      <div className={cn('flex flex-col', vs.header)}>
        {titleElement}
        {descriptionElement}
      </div>
      {ctaElement}
    </div>
  )

  const mediaElement = media && (
    <div className="relative order-2 flex md:h-full md:items-center">
      <div
        className={cn(
          'group/image relative w-full overflow-hidden outline outline-black/10 dark:outline-white/10',
          vs.media,
          vs.mediaRadius,
        )}
      >
        {mediaContent ?? <img
          src={media.src}
          alt={media.alt || title}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/image:scale-[1.03]"
        />}
      </div>
    </div>
  )

  const gridElement = (
    <div className={cn('grid w-full overflow-x-hidden', vs.grid)}>
      {copyElement}
      {mediaElement}
    </div>
  )

  const animatedGridElement = (
    <motion.div
      className={cn('grid w-full overflow-x-hidden', vs.grid)}
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
    >
      <Reveal active={animate} className="w-full self-center">
        {copyElement}
      </Reveal>
      <Reveal active={animate} variants={mediaEnter} className="relative min-w-0">
        {mediaElement}
      </Reveal>
    </motion.div>
  )

  return (
    <section className="w-full">
      <div className={cn('mx-auto w-full max-w-6xl px-6', vs.container)}>
        {animate ? animatedGridElement : gridElement}
      </div>
    </section>
  )
}
