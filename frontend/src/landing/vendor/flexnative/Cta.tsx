// Adapted from Flexnative (AGPL-3.0); see NOTICE.md for source and changes.
import { cva } from 'class-variance-authority'

import { Button, buttonVariants } from './Button'
import { cn } from './utils'

export type ButtonVariant =
  'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'

export interface CtaProps {
  ctaEnabled?: boolean
  text: string
  link: string
  variant?: ButtonVariant
  size?: 'default' | 'sm' | 'lg'
}

const ctaVariants = cva('w-fit rounded-full px-4', {
  variants: {
    invert: {
      true: 'bg-white! text-zinc-900! border-transparent! hover:bg-zinc-100!',
      false: '',
    },
  },
  defaultVariants: {
    invert: false,
  },
})

export function Cta({
  cta,
  className,
  invert,
}: Readonly<{ cta?: CtaProps; className?: string; invert?: boolean }>) {
  if (!cta?.ctaEnabled) {
    return null
  }

  const variant = cta.variant ?? (invert ? 'secondary' : 'default')

  if (!cta?.link) {
    return (
      <Button
        className={cn(ctaVariants({ invert }), className)}
        variant={variant}
        size={cta?.size ?? 'default'}
        aria-label={cta?.text}
        type="button"
      >
        {cta?.text}
      </Button>
    )
  }

  return (
    <a
      href={cta.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={cta?.text}
      className={cn(
        buttonVariants({
          variant,
          size: cta?.size ?? 'default',
          className: cn(ctaVariants({ invert }), className),
        }),
      )}
    >
      {cta?.text}
      <span className="sr-only">{`${cta?.text} (opens in new tab)`}</span>
    </a>
  )
}
