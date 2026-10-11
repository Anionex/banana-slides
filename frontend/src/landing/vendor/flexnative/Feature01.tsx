// Adapted from Flexnative (AGPL-3.0); see NOTICE.md for source and changes.
'use client'

import * as React from 'react'
import { useState } from 'react'

import { motion, useReducedMotion, type Variants } from 'motion/react'

import { Button } from './Button'
import { cn } from './utils'

export interface Feature01Item {
  id: string
  title: string
  description: string
  mediaContent?: React.ReactNode
  media: {
    src: string
    alt: string
  }
}

export interface Feature01Props {
  items: Feature01Item[]
  label?: string
  variant?: 'standard' | 'compact' | 'prominent'
  animation?: 'none' | 'subtle'
}

const variantStyles = {
  standard: {
    container: 'py-12 sm:py-16',
    grid: 'grid-cols-1 gap-10 md:grid-cols-2 md:items-center md:gap-14',
    nav: 'gap-1',
    button: 'py-2.5',
    title: 'text-base',
    titleSelected: 'font-medium',
    desc: 'text-sm',
    media: 'min-h-[320px] md:min-h-[420px]',
    mediaRadius: 'rounded-lg',
  },
  compact: {
    container: 'py-10 sm:py-12',
    grid: 'grid-cols-1 gap-6 md:grid-cols-2 md:items-center md:gap-10',
    nav: 'gap-0.5',
    button: 'py-2',
    title: 'text-sm md:text-base',
    titleSelected: 'font-medium',
    desc: 'text-xs',
    media: 'min-h-[260px] md:min-h-[340px]',
    mediaRadius: 'rounded-md',
  },
  prominent: {
    container: 'py-14 sm:py-20',
    grid: 'grid-cols-1 gap-12 md:grid-cols-2 md:items-center md:gap-16',
    nav: 'gap-1.5',
    button: 'py-3',
    title: 'text-base md:text-lg',
    titleSelected: 'font-semibold',
    desc: 'text-sm md:text-base',
    media: 'min-h-[380px] md:min-h-[480px]',
    mediaRadius: 'rounded-xl',
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

const navList: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

const navItem: Variants = {
  hidden: { opacity: 0, y: 12, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
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

export function Feature01({
  items,
  label = 'List of items',
  variant = 'standard',
  animation = 'none',
}: Readonly<Feature01Props>) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const reduce = useReducedMotion()
  const animate = animation === 'subtle' && !reduce
  const vs = variantStyles[variant]

  if (!items.length) return null

  const renderNavButton = (item: Feature01Item, index: number) => {
    const isSelected = index === selectedIndex

    return (
      <Button
        variant="ghost"
        type="button"
        onClick={() => setSelectedIndex(index)}
        aria-current={isSelected ? 'true' : undefined}
        aria-expanded={isSelected}
        className={cn(
          'h-auto w-full justify-start rounded-sm text-left font-normal whitespace-normal',
          vs.button,
          'hover:bg-muted/50 hover:opacity-100',
          isSelected && 'text-foreground bg-muted/50',
          !isSelected && 'text-muted-foreground hover:text-foreground',
        )}
      >
        <span className="flex flex-col gap-1">
          <span className={cn(vs.title, isSelected && vs.titleSelected)}>
            {item.title}
          </span>
          <span
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
              isSelected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <span className="overflow-hidden" aria-hidden={!isSelected}>
              <span
                className={cn(
                  'text-muted-foreground block pb-0.5 transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  vs.desc,
                  isSelected ? 'opacity-100' : 'opacity-0',
                )}
              >
                {item.description}
              </span>
            </span>
          </span>
        </span>
      </Button>
    )
  }

  const mediaCrossfade = (
    <div
      className={cn(
        'relative w-full overflow-hidden outline outline-black/10 dark:outline-white/10',
        vs.media,
        vs.mediaRadius,
      )}
    >
      {items.map((item, index) => (
        <div
          key={item.id}
          aria-hidden={index !== selectedIndex}
          className={cn(
            'absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
            index === selectedIndex ? 'opacity-100' : 'opacity-0',
          )}
        >
          {item.mediaContent ?? <img
            src={item.media.src}
            alt={item.media.alt || item.title}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'low'}
            className="absolute inset-0 size-full object-cover"
          />}
        </div>
      ))}
    </div>
  )

  const gridElement = (
    <div className={cn('grid grid-cols-1 md:grid-cols-2', vs.grid)}>
      <nav
        className={cn('flex flex-col justify-center', vs.nav)}
        aria-label={label}
      >
        {items.map((item, index) => (
          <div key={item.id}>{renderNavButton(item, index)}</div>
        ))}
      </nav>
      {mediaCrossfade}
    </div>
  )

  const animatedGridElement = (
    <div className={cn('grid grid-cols-1 md:grid-cols-2', vs.grid)}>
      <Reveal active={animate} className="w-full self-center">
        <motion.nav
          className={cn('flex flex-col justify-center', vs.nav)}
          variants={navList}
          aria-label={label}
        >
          {items.map((item, index) => (
            <motion.div key={item.id} variants={navItem}>
              {renderNavButton(item, index)}
            </motion.div>
          ))}
        </motion.nav>
      </Reveal>
      <Reveal
        active={animate}
        variants={mediaEnter}
        className="relative min-w-0"
      >
        {mediaCrossfade}
      </Reveal>
    </div>
  )

  if (animate) {
    return (
      <section className="w-full">
        <div
          className={cn('mx-auto w-full max-w-6xl px-6', vs.container)}
        >
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
          >
            {animatedGridElement}
          </motion.div>
        </div>
      </section>
    )
  }

  return (
    <section className="w-full">
      <div className={cn('mx-auto w-full max-w-6xl px-6', vs.container)}>
        {gridElement}
      </div>
    </section>
  )
}
